// KI-Log C2, C18: Erstellt mithilfe von KI (Claude)
// Tests für Registrieren und Account löschen (US-2): routes/users.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendRequest } = require("./helpers");

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