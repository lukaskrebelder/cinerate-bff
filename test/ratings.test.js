// KI-Log C13, C15, C18: Erstellt mithilfe von KI (Claude)
// Tests für Bewertungen (US-4): routes/ratings.js und GraphQL bewertungen / filmBewerten
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendGraphql } = require("./helpers");

// Neue Bewertung: nur die Sterne gehen weiter (extra-Feld nicht), 201 kommt durch.
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

// Bewertung schon vorhanden: das Backend sagt 200 (geändert), das BFF übernimmt das.
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

// 7 Sterne prüft nicht das BFF, sondern das Backend – das BFF reicht die 400 nur durch.
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

// Film ohne Bewertungen: null und 0 sollen genau so ankommen (nicht zu 0 umgewandelt).
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

// Ohne gültigen Token sagt das Backend nein, das BFF gibt die 401 weiter.
test("GET /bff/movies/:movieId/ratings gibt 401 ohne gültiges Token weiter", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(401, { message: "Invalid token." }));

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/ratings`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Invalid token." });
});

// Backend ist weg: GET und POST antworten beide mit 503.
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

// GraphQL-Tests (sendGraphql kommt aus helpers.js)
// Bewertungen per GraphQL: richtige Route, GET, Token dabei, null-Werte bleiben null.
test("GraphQL bewertungen leitet ID und Token weiter und liefert null-Werte", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { avgRating: null, ratingCount: 0, ownStars: null });
  });

  const body = await sendGraphql(originalFetch, baseUrl, "{ bewertungen(movieId: 157336) { avgRating ratingCount ownStars } }");

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.bewertungen, { avgRating: null, ratingCount: 0, ownStars: null });
  assert.match(backendCall.url, /\/api\/movies\/157336\/ratings$/);
  assert.equal(backendCall.options.method, "GET");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Die Mutation macht einen POST mit den Sternen und gibt message, stars und avgRating zurück.
test("GraphQL filmBewerten schickt die Sterne per POST und liefert die Antwort", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Your rating has been saved.", stars: 5, avgRating: 4.5 });
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    "mutation { filmBewerten(movieId: 157336, stars: 5) { message stars avgRating } }"
  );

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.filmBewerten, { message: "Your rating has been saved.", stars: 5, avgRating: 4.5 });
  assert.equal(backendCall.options.method, "POST");
  assert.deepEqual(JSON.parse(backendCall.options.body), { stars: 5 });
});

// Ungültige Sterne: Fehlertext vom Backend plus Status 400 in extensions.
test("GraphQL filmBewerten meldet 400 des Backends mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(400, { message: "Please choose 1 to 5 stars." }));

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { filmBewerten(movieId: 157336, stars: 7) { message } }");

  assert.equal(body.errors[0].message, "Please choose 1 to 5 stars.");
  assert.equal(body.errors[0].extensions.status, 400);
});

// Token abgelehnt: Fehlertext plus Status 401 in extensions.
test("GraphQL bewertungen meldet 401 des Backends mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(401, { message: "Invalid token." }));

  const body = await sendGraphql(originalFetch, baseUrl, "{ bewertungen(movieId: 157336) { ratingCount } }");

  assert.equal(body.errors[0].message, "Invalid token.");
  assert.equal(body.errors[0].extensions.status, 401);
});

// 3.5 ist kein Int – GraphQL lehnt das selbst ab, das Backend wird nicht aufgerufen.
test("GraphQL filmBewerten lehnt Kommazahlen ab, ohne das Backend zu fragen", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCalled = false;

  mockBackend(t, async () => {
    backendCalled = true;
    return mockResponse(500, {});
  });

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { filmBewerten(movieId: 157336, stars: 3.5) { message } }");

  assert.ok(Array.isArray(body.errors));
  assert.equal(backendCalled, false);
});