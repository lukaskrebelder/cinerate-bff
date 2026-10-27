// Tests für Watchlist (US-3): routes/watchlist.js und GraphQL watchlist / filmVormerken / vonWatchlistEntfernen
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendGraphql } = require("./helpers");

const AUTH = { Authorization: "Bearer testtoken" };

// KI-Log C
// Watchlist abrufen: der Token geht mit, die Filmliste kommt unverändert zurück.
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

// Film vormerken: nur die movieId geht weiter (extra-Feld nicht), 201 kommt durch.
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

// Film ist schon auf der Watchlist: die 409 vom Backend wird weitergegeben.
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

// Film entfernen: ID im Pfad, Methode DELETE, Token dabei.
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

// Film war gar nicht auf der Watchlist: die 404 vom Backend kommt durch.
test("DELETE /bff/watchlist/:movieId gibt 404 weiter, wenn der Film nicht drauf ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(404, { message: "Movie is not on your watchlist." }));

  const response = await originalFetch(`${baseUrl}/bff/watchlist/157336`, { method: "DELETE", headers: AUTH });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "Movie is not on your watchlist." });
});

// Backend ist weg: GET, POST und DELETE antworten alle mit 503.
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

// KI-Log C
// GraphQL-Tests (sendGraphql kommt aus helpers.js)
// Watchlist per GraphQL: kommt direkt als Liste zurück (ohne movies-Hülle wie bei REST).
test("GraphQL watchlist liefert die Liste der Filme", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;
  const movies = [{ movieId: 157336, title: "Interstellar", posterUrl: null }];

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { movies });
  });

  const body = await sendGraphql(originalFetch, baseUrl, "{ watchlist { movieId title posterUrl } }");

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.watchlist, movies);
  assert.match(backendCall.url, /\/api\/watchlist$/);
  assert.equal(backendCall.options.method, "GET");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Die Mutation macht einen POST mit der movieId und gibt die Meldung zurück.
test("GraphQL filmVormerken schickt die movieId per POST", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Movie was added to your watchlist." });
  });

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { filmVormerken(movieId: 157336) { message } }");

  assert.equal(body.errors, undefined);
  assert.equal(body.data.filmVormerken.message, "Movie was added to your watchlist.");
  assert.equal(backendCall.options.method, "POST");
  assert.deepEqual(JSON.parse(backendCall.options.body), { movieId: 157336 });
});

// Schon vorgemerkt: Fehlertext plus Status 409 in extensions.
test("GraphQL filmVormerken meldet 409 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(409, { message: "Movie is already on your watchlist." }));

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { filmVormerken(movieId: 157336) { message } }");

  assert.equal(body.errors[0].message, "Movie is already on your watchlist.");
  assert.equal(body.errors[0].extensions.status, 409);
});

// Die Mutation macht einen DELETE auf /api/watchlist/<ID>.
test("GraphQL vonWatchlistEntfernen schickt DELETE mit der ID", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { message: "Movie was removed from your watchlist." });
  });

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { vonWatchlistEntfernen(movieId: 157336) { message } }");

  assert.equal(body.errors, undefined);
  assert.equal(body.data.vonWatchlistEntfernen.message, "Movie was removed from your watchlist.");
  assert.match(backendCall.url, /\/api\/watchlist\/157336$/);
  assert.equal(backendCall.options.method, "DELETE");
});

// Nicht auf der Watchlist: Fehlertext plus Status 404 in extensions.
test("GraphQL vonWatchlistEntfernen meldet 404 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(404, { message: "Movie is not on your watchlist." }));

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { vonWatchlistEntfernen(movieId: 157336) { message } }");

  assert.equal(body.errors[0].message, "Movie is not on your watchlist.");
  assert.equal(body.errors[0].extensions.status, 404);
});