const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const watchlistRoute = require("../routes/watchlist");

// Startet das BFF nur mit der Watchlist-Route auf einem freien Port.
function createTestServer(t) {
  const app = express();
  app.use(express.json());
  app.use("/bff", watchlistRoute);

  const server = app.listen(0, "127.0.0.1");

  return new Promise((resolve, reject) => {
    server.once("listening", () => {
      t.after(() => new Promise((done) => server.close(() => done())));
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
    server.once("error", reject);
  });
}

// Ersetzt fetch, damit kein echtes Backend nötig ist. Danach wird das echte fetch zurückgesetzt.
function mockBackend(t, implementation) {
  const originalFetch = global.fetch;
  global.fetch = implementation;
  t.after(() => {
    global.fetch = originalFetch;
  });
}

function mockResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

const AUTH = { Authorization: "Bearer testtoken" };

// KI-Log C11
test("GET /bff/watchlist leitet Token weiter und liefert die Filme", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;
  const movies = [{ movieId: 157336, title: "Interstellar", posterUrl: null }];

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { movies });
  });

  const response = await originalFetch(`${baseUrl}/bff/watchlist`, { headers: AUTH });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { movies });
  assert.match(backendCall.url, /\/api\/watchlist$/);
  assert.equal(backendCall.options.method, "GET");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

test("POST /bff/watchlist gibt nur movieId weiter (201)", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Movie was added to your watchlist." });
  });

  const response = await originalFetch(`${baseUrl}/bff/watchlist`, {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ movieId: 157336, extra: "wird nicht weitergegeben" }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { message: "Movie was added to your watchlist." });
  assert.match(backendCall.url, /\/api\/watchlist$/);
  assert.equal(backendCall.options.method, "POST");
  assert.deepEqual(JSON.parse(backendCall.options.body), { movieId: 157336 });
});

test("POST /bff/watchlist gibt 409 weiter, wenn der Film schon drauf ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(409, { message: "Movie is already on your watchlist." }));

  const response = await originalFetch(`${baseUrl}/bff/watchlist`, {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ movieId: 157336 }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: "Movie is already on your watchlist." });
});

test("DELETE /bff/watchlist/:movieId leitet ID und Token weiter (200)", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { message: "Movie was removed from your watchlist." });
  });

  const response = await originalFetch(`${baseUrl}/bff/watchlist/157336`, { method: "DELETE", headers: AUTH });

  assert.equal(response.status, 200);
  assert.match(backendCall.url, /\/api\/watchlist\/157336$/);
  assert.equal(backendCall.options.method, "DELETE");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

test("DELETE /bff/watchlist/:movieId gibt 404 weiter, wenn der Film nicht drauf ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(404, { message: "Movie is not on your watchlist." }));

  const response = await originalFetch(`${baseUrl}/bff/watchlist/157336`, { method: "DELETE", headers: AUTH });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "Movie is not on your watchlist." });
});

test("Watchlist-Routen ergeben HTTP 503, wenn das Backend nicht erreichbar ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => {
    throw new Error("connect ECONNREFUSED");
  });

  const getResponse = await originalFetch(`${baseUrl}/bff/watchlist`);
  const postResponse = await originalFetch(`${baseUrl}/bff/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movieId: 157336 }),
  });
  const deleteResponse = await originalFetch(`${baseUrl}/bff/watchlist/157336`, { method: "DELETE" });

  assert.equal(getResponse.status, 503);
  assert.equal(postResponse.status, 503);
  assert.equal(deleteResponse.status, 503);
});