// KI-Log C25: Erstellt mithilfe von KI (Claude)
// Tests für den internen Schlüssel: Das BFF schickt bei jedem Aufruf ans Backend
// den Header X-Internal-Key mit, wenn INTERNAL_API_KEY gesetzt ist.
const test = require("node:test");
const assert = require("node:assert/strict");

const { createTestServer, mockBackend, mockResponse, sendRequest, sendGraphql } = require("./helpers");

const AUTH = { Authorization: "Bearer testtoken" };

// Setzt INTERNAL_API_KEY für einen Test und stellt den alten Wert danach wieder her.
function setInternalKey(t, value) {
  const before = process.env.INTERNAL_API_KEY;

  if (value === undefined) {
    delete process.env.INTERNAL_API_KEY;
  } else {
    process.env.INTERNAL_API_KEY = value;
  }

  t.after(() => {
    if (before === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = before;
    }
  });
}

// REST: der Schlüssel geht mit, der Token des Nutzers bleibt erhalten.
test("REST schickt X-Internal-Key und den Authorization-Header ans Backend", async (t) => {
  setInternalKey(t, "geheim123");
  const baseUrl = await createTestServer(t);
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { movies: [] });
  });

  const response = await sendRequest(baseUrl, "/bff/watchlist", { headers: AUTH });

  assert.equal(response.status, 200);
  assert.equal(backendCall.options.headers["X-Internal-Key"], "geheim123");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// REST mit Body: Content-Type bleibt neben dem Schlüssel erhalten.
test("REST mit Body behält Content-Type und schickt X-Internal-Key", async (t) => {
  setInternalKey(t, "geheim123");
  const baseUrl = await createTestServer(t);
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Account has been created.", userId: "u_1" });
  });

  const response = await sendRequest(baseUrl, "/bff/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { firstName: "Lena", lastName: "Hartmann", email: "lena@example.com", password: "Kino2026!" },
  });

  assert.equal(response.status, 201);
  assert.equal(backendCall.options.headers["Content-Type"], "application/json");
  assert.equal(backendCall.options.headers["X-Internal-Key"], "geheim123");
});

// Statusroute: auch der Aufruf ohne weitere Optionen bekommt den Schlüssel.
test("GET /bff/status schickt X-Internal-Key", async (t) => {
  setInternalKey(t, "geheim123");
  const baseUrl = await createTestServer(t);
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { status: "ok" });
  });

  const response = await sendRequest(baseUrl, "/bff/status");

  assert.equal(response.status, 200);
  assert.equal(backendCall.options.headers["X-Internal-Key"], "geheim123");
});

// GraphQL über requestBackend (z. B. watchlist) schickt den Schlüssel.
test("GraphQL (requestBackend) schickt X-Internal-Key", async (t) => {
  setInternalKey(t, "geheim123");
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { movies: [] });
  });

  const body = await sendGraphql(originalFetch, baseUrl, "{ watchlist { movieId } }");

  assert.equal(body.errors, undefined);
  assert.equal(backendCall.options.headers["X-Internal-Key"], "geheim123");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// GraphQL "filme" hat noch einen eigenen Aufruf und schickt den Schlüssel ebenfalls.
test("GraphQL (filme) schickt X-Internal-Key", async (t) => {
  setInternalKey(t, "geheim123");
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { page: 1, totalPages: 1, movies: [] });
  });

  const body = await sendGraphql(originalFetch, baseUrl, '{ filme(query: "Interstellar") { page } }');

  assert.equal(body.errors, undefined);
  assert.equal(backendCall.options.headers["X-Internal-Key"], "geheim123");
});

// Ohne INTERNAL_API_KEY (z. B. lokal) wird kein Header geschickt.
test("ohne INTERNAL_API_KEY wird kein X-Internal-Key geschickt", async (t) => {
  setInternalKey(t, undefined);
  const baseUrl = await createTestServer(t);
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { movies: [] });
  });

  const response = await sendRequest(baseUrl, "/bff/watchlist", { headers: AUTH });

  assert.equal(response.status, 200);
  assert.equal("X-Internal-Key" in backendCall.options.headers, false);
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});
