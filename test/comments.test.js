// KI-Log C20: Erstellt mithilfe von KI (Claude)
// Tests für Kommentare (PB-32 bis PB-35): routes/comments.js und GraphQL kommentare / filmKommentieren / kommentarBearbeiten / kommentarLoeschen
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendGraphql } = require("./helpers");

const AUTH = { Authorization: "Bearer testtoken" };

const kommentarSeite = {
  page: 1,
  totalPages: 1,
  comments: [
    {
      commentId: "c_1042",
      userId: "u_7",
      firstName: "Madlen",
      text: "Großartiger Film!",
      createdAt: "2026-10-30T12:00:00.000Z",
      updatedAt: null,
    },
  ],
};

// Kommentar schreiben: nur der Text geht weiter (extra-Feld nicht), Token dabei, 201 kommt durch.
test("POST /bff/movies/:movieId/comments leitet Text und Token weiter (201)", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Your comment has been posted.", commentId: "c_1042" });
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/comments`, {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Großartiger Film!", userId: "u_99" }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { message: "Your comment has been posted.", commentId: "c_1042" });
  assert.match(backendCall.url, /\/api\/movies\/157336\/comments$/);
  assert.equal(backendCall.options.method, "POST");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
  assert.deepEqual(JSON.parse(backendCall.options.body), { text: "Großartiger Film!" });
});

// Kommentare abrufen: die Seite geht als Query mit, die Liste kommt unverändert zurück.
test("GET /bff/movies/:movieId/comments leitet die Seite weiter und liefert die Kommentare", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, kommentarSeite);
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/comments?page=2`, { headers: AUTH });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), kommentarSeite);
  assert.match(backendCall.url, /\/api\/movies\/157336\/comments\?page=2$/);
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Fremden Kommentar bearbeiten: die 403 vom Backend kommt unverändert durch.
test("PUT /bff/movies/:movieId/comments/:commentId gibt 403 weiter", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(403, { message: "You can only edit your own comments." });
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/comments/c_1042`, {
    method: "PUT",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Geändert" }),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: "You can only edit your own comments." });
  assert.match(backendCall.url, /\/api\/movies\/157336\/comments\/c_1042$/);
  assert.equal(backendCall.options.method, "PUT");
  assert.deepEqual(JSON.parse(backendCall.options.body), { text: "Geändert" });
});

// Kommentar löschen: DELETE mit Token, 200 und Nachricht kommen durch.
test("DELETE /bff/movies/:movieId/comments/:commentId leitet weiter (200)", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { message: "Comment was deleted." });
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/comments/c_1042`, {
    method: "DELETE",
    headers: AUTH,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: "Comment was deleted." });
  assert.equal(backendCall.options.method, "DELETE");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Backend ist weg: die Kommentare antworten mit 503.
test("GET /bff/movies/:movieId/comments ergibt HTTP 503, wenn das Backend nicht erreichbar ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => {
    throw new Error("connect ECONNREFUSED");
  });

  const response = await originalFetch(`${baseUrl}/bff/movies/157336/comments`, { headers: AUTH });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: "Backend is not reachable." });
});

// GraphQL-Tests (sendGraphql kommt aus helpers.js)
// Kommentare per GraphQL: Seite geht mit, ein fehlendes updatedAt bleibt null.
test("GraphQL kommentare leitet Seite und Token weiter und liefert die Kommentare", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, kommentarSeite);
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    "{ kommentare(movieId: 157336, page: 2) { page totalPages comments { commentId userId firstName text createdAt updatedAt } } }"
  );

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.kommentare, kommentarSeite);
  assert.match(backendCall.url, /\/api\/movies\/157336\/comments\?page=2$/);
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Kommentar per GraphQL schreiben: POST mit dem Text, Nachricht und ID kommen zurück.
test("GraphQL filmKommentieren schickt den Text und liefert Nachricht und ID", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Your comment has been posted.", commentId: "c_1042" });
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { filmKommentieren(movieId: 157336, text: "Großartiger Film!") { message commentId } }'
  );

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.filmKommentieren, { message: "Your comment has been posted.", commentId: "c_1042" });
  assert.equal(backendCall.options.method, "POST");
  assert.deepEqual(JSON.parse(backendCall.options.body), { text: "Großartiger Film!" });
});

// Fremden Kommentar per GraphQL bearbeiten: Fehlertext plus Status 403 in extensions.
test("GraphQL kommentarBearbeiten meldet 403 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(403, { message: "You can only edit your own comments." }));

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { kommentarBearbeiten(movieId: 157336, commentId: "c_1042", text: "Geändert") { message } }'
  );

  assert.equal(body.errors[0].message, "You can only edit your own comments.");
  assert.equal(body.errors[0].extensions.status, 403);
});

// Unbekannten Kommentar per GraphQL löschen: Fehlertext plus Status 404 in extensions.
test("GraphQL kommentarLoeschen meldet 404 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(404, { message: "No comment found for this ID." });
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { kommentarLoeschen(movieId: 157336, commentId: "c_9999") { message } }'
  );

  assert.equal(body.errors[0].message, "No comment found for this ID.");
  assert.equal(body.errors[0].extensions.status, 404);
  assert.equal(backendCall.options.method, "DELETE");
  assert.match(backendCall.url, /\/comments\/c_9999$/);
});