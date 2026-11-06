// KI-Log C2, C18, C26: Erstellt mithilfe von KI (Claude)
// Tests für Registrieren und Account löschen (US-2): routes/users.js und GraphQL registrieren / kontoLoeschen
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendRequest, sendGraphql } = require("./helpers");

// Die Registrierungsdaten sollen unverändert beim Backend ankommen, 201 kommt zurück.
test("POST /bff/users leitet Registrierung weiter", async (t) => {
  let forwardedUrl;
  let forwardedOptions;

  const backendBody = {
    message: "User created",
    userId: 123,
  };

  mockBackend(t, async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;

    return mockResponse(201, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const registrationData = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    password: "testpassword123",
  };

  const response = await sendRequest(baseUrl, "/bff/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: registrationData,
  });

  assert.equal(new URL(forwardedUrl).pathname, "/api/users");
  assert.equal(forwardedOptions.method, "POST");
  assert.deepEqual(JSON.parse(forwardedOptions.body), registrationData);
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, backendBody);
});

// Konto löschen: die User-ID steht im Pfad und der Token geht mit.
test("DELETE /bff/users/:userId leitet ID und Token weiter", async (t) => {
  let forwardedUrl;
  let forwardedOptions;

  const backendBody = {
    message: "User deleted",
  };

  mockBackend(t, async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;

    return mockResponse(200, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/users/123", {
    method: "DELETE",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assert.equal(new URL(forwardedUrl).pathname, "/api/users/123");
  assert.equal(forwardedOptions.method, "DELETE");
  assert.equal(
    forwardedOptions.headers.Authorization,
    "Bearer test-token"
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, backendBody);
});

// GraphQL registrieren: alle vier Felder gehen per POST an /api/users, ohne Token.
test("GraphQL registrieren schickt die Daten ohne Token und liefert Nachricht und ID", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(201, { message: "Account has been created.", userId: "u_67" });
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { registrieren(firstName: "Lena", lastName: "Hartmann", email: "lena@example.com", password: "Kino2026!") { message userId } }'
  );

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.registrieren, { message: "Account has been created.", userId: "u_67" });
  assert.match(backendCall.url, /\/api\/users$/);
  assert.equal(backendCall.options.method, "POST");
  assert.deepEqual(JSON.parse(backendCall.options.body), {
    firstName: "Lena",
    lastName: "Hartmann",
    email: "lena@example.com",
    password: "Kino2026!",
  });
  assert.equal(backendCall.options.headers.Authorization, undefined);
});

// E-Mail schon vergeben: der Fehler kommt mit extensions.status 409 an.
test("GraphQL registrieren meldet 409 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(409, { message: "An account with this email already exists." }));

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { registrieren(firstName: "Lena", lastName: "Hartmann", email: "lena@example.com", password: "Kino2026!") { message } }'
  );

  assert.equal(body.errors[0].message, "An account with this email already exists.");
  assert.equal(body.errors[0].extensions.status, 409);
});

// Fehlt ein Pflichtfeld, lehnt GraphQL die Abfrage ab, ohne das Backend zu fragen.
test("GraphQL registrieren ohne Passwort wird abgelehnt, ohne das Backend zu fragen", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let called = false;

  mockBackend(t, async () => {
    called = true;
    return mockResponse(201, {});
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { registrieren(firstName: "Lena", lastName: "Hartmann", email: "lena@example.com") { message } }'
  );

  assert.ok(body.errors.length > 0);
  assert.equal(called, false);
});

// Backend nicht erreichbar: Fehler mit Status 503.
test("GraphQL registrieren meldet 503, wenn das Backend nicht erreichbar ist", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => {
    throw new Error("connect ECONNREFUSED");
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { registrieren(firstName: "Lena", lastName: "Hartmann", email: "lena@example.com", password: "Kino2026!") { message } }'
  );

  assert.equal(body.errors[0].message, "Backend is not reachable.");
  assert.equal(body.errors[0].extensions.status, 503);
});

// GraphQL kontoLoeschen: die userId steht im Pfad und der Token geht mit.
test("GraphQL kontoLoeschen schickt DELETE mit ID und Token", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { message: "Account has been deleted." });
  });

  const body = await sendGraphql(originalFetch, baseUrl, 'mutation { kontoLoeschen(userId: "u_67") { message } }');

  assert.equal(body.errors, undefined);
  assert.equal(body.data.kontoLoeschen.message, "Account has been deleted.");
  assert.match(backendCall.url, /\/api\/users\/u_67$/);
  assert.equal(backendCall.options.method, "DELETE");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Fremdes Konto: der Fehler kommt mit extensions.status 403 an.
test("GraphQL kontoLoeschen meldet 403 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(403, { message: "You can only delete your own account." }));

  const body = await sendGraphql(originalFetch, baseUrl, 'mutation { kontoLoeschen(userId: "u_1") { message } }');

  assert.equal(body.errors[0].message, "You can only delete your own account.");
  assert.equal(body.errors[0].extensions.status, 403);
});

// Ohne userId lehnt GraphQL die Abfrage ab, ohne das Backend zu fragen.
test("GraphQL kontoLoeschen ohne userId wird abgelehnt, ohne das Backend zu fragen", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let called = false;

  mockBackend(t, async () => {
    called = true;
    return mockResponse(200, {});
  });

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { kontoLoeschen { message } }");

  assert.ok(body.errors.length > 0);
  assert.equal(called, false);
});
