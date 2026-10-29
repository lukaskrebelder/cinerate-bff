// KI-Log C2, C18 : Erstellt mithilfe von KI (Claude)
// Tests für Anmelden und Abmelden (US-2): routes/auth.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendRequest } = require("./helpers");

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