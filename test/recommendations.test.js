// Tests für Filmvorschläge (US-1): routes/recommendations.js und GraphQL vorschlaege
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendGraphql } = require("./helpers");

const AUTH = { Authorization: "Bearer testtoken" };

const vorschlagsAntwort = {
  favoriteGenre: "Science Fiction",
  movies: [
    { movieId: 329865, title: "Arrival", description: null, posterUrl: "https://image.tmdb.org/example.jpg" },
  ],
};

// KI-Log C14
// Vorschläge abrufen: GET an /api/recommendations, Token dabei, Antwort kommt unverändert zurück.
test("GET /bff/recommendations leitet Token weiter und liefert Genre und Filme", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, vorschlagsAntwort);
  });

  const response = await originalFetch(`${baseUrl}/bff/recommendations`, { headers: AUTH });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), vorschlagsAntwort);
  assert.match(backendCall.url, /\/api\/recommendations$/);
  assert.equal(backendCall.options.method, "GET");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Zu wenige Bewertungen: die 400 und der Text vom Backend kommen unverändert durch.
test("GET /bff/recommendations gibt 400 weiter, wenn zu wenige Filme bewertet sind", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(400, { message: "Please rate at least 3 movies first." }));

  const response = await originalFetch(`${baseUrl}/bff/recommendations`, { headers: AUTH });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Please rate at least 3 movies first." });
});

// Keine neuen Vorschläge: die 404 vom Backend wird weitergegeben.
test("GET /bff/recommendations gibt 404 weiter, wenn es keine neuen Vorschläge gibt", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(404, { message: "No new recommendations available." }));

  const response = await originalFetch(`${baseUrl}/bff/recommendations`, { headers: AUTH });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "No new recommendations available." });
});

// Backend ist weg: die Vorschläge antworten mit 503.
test("GET /bff/recommendations ergibt HTTP 503, wenn das Backend nicht erreichbar ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => {
    throw new Error("connect ECONNREFUSED");
  });

  const response = await originalFetch(`${baseUrl}/bff/recommendations`, { headers: AUTH });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: "Backend is not reachable." });
});

// Vorschläge per GraphQL: Genre und Filme kommen an, eine fehlende Beschreibung bleibt null.
test("GraphQL vorschlaege liefert Lieblingsgenre und Filme", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, vorschlagsAntwort);
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    "{ vorschlaege { favoriteGenre movies { movieId title description posterUrl } } }"
  );

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.vorschlaege, vorschlagsAntwort);
  assert.match(backendCall.url, /\/api\/recommendations$/);
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Zu wenige 4- oder 5-Sterne-Bewertungen: Fehlertext plus Status 400 in extensions.
test("GraphQL vorschlaege meldet 400 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(400, { message: "Please rate at least one movie with 4 or 5 stars." }));

  const body = await sendGraphql(originalFetch, baseUrl, "{ vorschlaege { favoriteGenre } }");

  assert.equal(body.errors[0].message, "Please rate at least one movie with 4 or 5 stars.");
  assert.equal(body.errors[0].extensions.status, 400);
});

// Keine neuen Vorschläge: Fehlertext plus Status 404 in extensions.
test("GraphQL vorschlaege meldet 404 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(404, { message: "No new recommendations available." }));

  const body = await sendGraphql(originalFetch, baseUrl, "{ vorschlaege { favoriteGenre } }");

  assert.equal(body.errors[0].message, "No new recommendations available.");
  assert.equal(body.errors[0].extensions.status, 404);
});