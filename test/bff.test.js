const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const moviesRoute = require("../routes/movies");

const usersRoute = require("../routes/users");
const authRoute = require("../routes/auth");

function createTestServer(t) {
  const app = express();

  app.use(express.json());
  app.use("/bff", usersRoute);
  app.use("/bff", authRoute);
  app.use("/bff", moviesRoute);

  const server = app.listen(0, "127.0.0.1");

  return new Promise((resolve, reject) => {
    server.once("listening", () => {
      t.after(
        () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error);
              } else {
                resolveClose();
              }
            });
          })
      );

      resolve(`http://127.0.0.1:${server.address().port}`);
    });

    server.once("error", reject);
  });
}

function mockBackend(t, implementation) {
  const originalFetch = global.fetch;

  global.fetch = implementation;

  t.after(() => {
    global.fetch = originalFetch;
  });
}

function mockResponse(status, body) {
  return {
    status,
    json: async () => body,
  };
}

function sendRequest(baseUrl, path, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      new URL(path, baseUrl),
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (response) => {
        let rawBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });

        response.on("end", () => {
          resolve({
            status: response.statusCode,
            body: rawBody ? JSON.parse(rawBody) : null,
          });
        });
      }
    );

    request.on("error", reject);

    if (options.body !== undefined) {
      request.write(JSON.stringify(options.body));
    }

    request.end();
  });
}

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

// Test for GET /bff/movies
test("GET /bff/movies leitet Suchparameter und Authorization-Header weiter", async (t) => {
  let forwardedUrl;
  let forwardedOptions;

  const backendBody = {
    page: 2,
    totalPages: 5,
    movies: [
      {
        movieId: 157336,
        title: "Interstellar",
        posterUrl: "https://image.tmdb.org/example.jpg",
      },
    ],
  };

  mockBackend(t, async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;

    return mockResponse(200, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(
    baseUrl,
    "/bff/movies?query=Interstellar&genre=Science%20Fiction&fsk=12&page=2",
    {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
      },
    }
  );

  const targetUrl = new URL(forwardedUrl);

  assert.equal(targetUrl.pathname, "/api/movies");
  assert.equal(targetUrl.searchParams.get("query"), "Interstellar");
  assert.equal(targetUrl.searchParams.get("genre"), "Science Fiction");
  assert.equal(targetUrl.searchParams.get("fsk"), "12");
  assert.equal(targetUrl.searchParams.get("page"), "2");

  assert.equal(forwardedOptions.method, "GET");
  assert.equal(
    forwardedOptions.headers.Authorization,
    "Bearer test-token"
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, backendBody);
});