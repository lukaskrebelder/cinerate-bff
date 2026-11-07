// KI-Log C2, C18, C26: Erstellt mithilfe von KI (Claude)
// Tests für Anmelden und Abmelden (US-2): routes/auth.js und GraphQL anmelden / abmelden
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendRequest, sendGraphql } = require("./helpers");

// E-Mail und Passwort sollen unverändert beim Backend ankommen, der Token kommt zurück.
test("POST /bff/auth leitet Login weiter", async (t) => {
  let forwardedOptions;

  const backendBody = {
    token: "test-token",
  };

  mockBackend(t, async (_url, options) => {
    forwardedOptions = options;

    return mockResponse(200, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const loginData = {
    email: "test@example.com",
    password: "testpassword123",
  };

  const response = await sendRequest(baseUrl, "/bff/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: loginData,
  });

  assert.equal(forwardedOptions.method, "POST");
  assert.deepEqual(JSON.parse(forwardedOptions.body), loginData);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, backendBody);
});

// Beim Abmelden muss der Token mitgehen, sonst weiß das Backend nicht, welche Sitzung endet.
test("DELETE /bff/auth leitet den Authorization-Header weiter", async (t) => {
  let forwardedUrl;
  let forwardedOptions;

  const backendBody = {
    message: "Logged out",
  };

  mockBackend(t, async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;

    return mockResponse(200, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/auth", {
    method: "DELETE",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assert.equal(new URL(forwardedUrl).pathname, "/api/auth");
  assert.equal(forwardedOptions.method, "DELETE");
  assert.equal(
    forwardedOptions.headers.Authorization,
    "Bearer test-token"
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, backendBody);
});

// Backend ist weg (fetch wirft einen Fehler): das BFF soll mit 503 antworten statt abzustürzen.
test("nicht erreichbares Backend ergibt HTTP 503", async (t) => {
  mockBackend(t, async () => {
    throw new Error("Network error");
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      email: "test@example.com",
      password: "testpassword123",
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    message: "Backend is not reachable.",
  });
});

// GraphQL anmelden: E-Mail und Passwort gehen per POST an /api/auth, ohne Token; token, userId und rolle kommen zurück.
test("GraphQL anmelden schickt die Zugangsdaten ohne Token und liefert token, userId und rolle", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { token: "abc123", userId: "u_67", rolle: "Nutzer" });
  });

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { anmelden(email: "lena@example.com", password: "Kino2026!") { token userId rolle } }'
  );

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data.anmelden, { token: "abc123", userId: "u_67", rolle: "Nutzer" });
  assert.match(backendCall.url, /\/api\/auth$/);
  assert.equal(backendCall.options.method, "POST");
  assert.deepEqual(JSON.parse(backendCall.options.body), { email: "lena@example.com", password: "Kino2026!" });
  assert.equal(backendCall.options.headers.Authorization, undefined);
});

// Falsche Zugangsdaten: der Fehler kommt mit extensions.status 401 an.
test("GraphQL anmelden meldet 401 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(401, { message: "Email or password is incorrect." }));

  const body = await sendGraphql(
    originalFetch,
    baseUrl,
    'mutation { anmelden(email: "lena@example.com", password: "falsch") { token } }'
  );

  assert.equal(body.errors[0].message, "Email or password is incorrect.");
  assert.equal(body.errors[0].extensions.status, 401);
});

// Ohne Passwort lehnt GraphQL die Abfrage ab, ohne das Backend zu fragen.
test("GraphQL anmelden ohne Passwort wird abgelehnt, ohne das Backend zu fragen", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let called = false;

  mockBackend(t, async () => {
    called = true;
    return mockResponse(200, {});
  });

  const body = await sendGraphql(originalFetch, baseUrl, 'mutation { anmelden(email: "lena@example.com") { token } }');

  assert.ok(body.errors.length > 0);
  assert.equal(called, false);
});

// GraphQL abmelden: DELETE an /api/auth mit dem Token.
test("GraphQL abmelden schickt DELETE mit dem Token", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;
  let backendCall;

  mockBackend(t, async (url, options) => {
    backendCall = { url: String(url), options };
    return mockResponse(200, { message: "Logout successful." });
  });

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { abmelden { message } }");

  assert.equal(body.errors, undefined);
  assert.equal(body.data.abmelden.message, "Logout successful.");
  assert.match(backendCall.url, /\/api\/auth$/);
  assert.equal(backendCall.options.method, "DELETE");
  assert.equal(backendCall.options.headers.Authorization, "Bearer testtoken");
});

// Ungültiges Token: der Fehler kommt mit extensions.status 401 an.
test("GraphQL abmelden meldet 401 mit extensions.status", async (t) => {
  const baseUrl = await createTestServer(t);
  const originalFetch = global.fetch;

  mockBackend(t, async () => mockResponse(401, { message: "Invalid token." }));

  const body = await sendGraphql(originalFetch, baseUrl, "mutation { abmelden { message } }");

  assert.equal(body.errors[0].message, "Invalid token.");
  assert.equal(body.errors[0].extensions.status, 401);
});

// REST anmelden: zusätzliche Felder im Body gehen nicht ans Backend, nur E-Mail und Passwort.
test("POST /bff/auth gibt nur E-Mail und Passwort weiter", async (t) => {
  const baseUrl = await createTestServer(t);
  let forwardedOptions;

  mockBackend(t, async (_url, options) => {
    forwardedOptions = options;
    return mockResponse(200, { token: "abc123", userId: "u_67", rolle: "Nutzer" });
  });

  const response = await sendRequest(baseUrl, "/bff/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { email: "lena@example.com", password: "Kino2026!", extra: "nicht weitergeben" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(forwardedOptions.body), { email: "lena@example.com", password: "Kino2026!" });
});
