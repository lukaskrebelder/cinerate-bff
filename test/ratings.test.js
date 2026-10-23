const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const ratingsRoute = require("../routes/ratings");

// Startet das BFF nur mit der Bewertungs-Route auf einem freien Port.
function createTestServer(t) {
  const app = express();
  app.use(express.json());
  app.use("/bff", ratingsRoute);

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

// KI-Log C8
test("POST /bff/movies/:movieId/ratings leitet Sterne und Token weiter (201 neu)", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Your rating has been saved.", stars: 4, avgRating: 4 });
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer testtoken" },
    body: JSON.stringify({ stars: 4, extra: "wird nicht weitergegeben" }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { message: "Your rating has been saved.", stars: 4, avgRating: 4 });
  assert.match(backendCall.url, /\/api\/movies\/157336\/ratings$/);
  assert.equal(backendCall.options.method, "POST");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
  assert.deepEqual(JSON.parse(backendCall.options.body), { stars: 4 });
});

test("POST /bff/movies/:movieId/ratings gibt 200 weiter, wenn die eigene Bewertung geändert wird", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(200, { message: "Your rating has been updated.", stars: 2, avgRating: 3.5 }));

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer testtoken" },
    body: JSON.stringify({ stars: 2 }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).message, "Your rating has been updated.");
});

test("POST /bff/movies/:movieId/ratings gibt 400 bei ungültigen Sternen weiter", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(400, { message: "Please choose 1 to 5 stars." }));

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer testtoken" },
    body: JSON.stringify({ stars: 7 }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Please choose 1 to 5 stars." });
});

test("GET /bff/movies/:movieId/ratings liefert Durchschnitt, Anzahl und eigene Sterne", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { avgRating: null, ratingCount: 0, ownStars: null });
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`, {
    headers: { Authorization: "Bearer testtoken" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { avgRating: null, ratingCount: 0, ownStars: null });
  assert.equal(backendCall.options.method, "GET");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

test("GET /bff/movies/:movieId/ratings gibt 401 ohne gültiges Token weiter", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(401, { message: "Invalid token." }));

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Invalid token." });
});

test("Bewertungs-Routen ergeben HTTP 503, wenn das Backend nicht erreichbar ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => {
    throw new Error("connect ECONNREFUSED");
  });

  const getResponse = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`);
  const postResponse = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stars: 3 }),
  });

  assert.equal(getResponse.status, 503);
  assert.equal(postResponse.status, 503);
  assert.deepEqual(await postResponse.json(), { message: "Backend is not reachable." });
});