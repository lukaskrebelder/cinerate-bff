const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const moviesRoute = require("../routes/movies");
const graphqlRoute = require("../routes/graphql");

const usersRoute = require("../routes/users");
const authRoute = require("../routes/auth");

function createTestServer(t) {
  const app = express();

  app.use(express.json());
  app.use("/bff", usersRoute);
  app.use("/bff", authRoute);
  app.use("/bff", moviesRoute);
  app.use("/bff/graphql", graphqlRoute);

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
    ok: status >= 200 && status < 300,
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

// GraphQL test Filmsuche und Authorization-Header
test("GraphQL leitet Filmsuche und Authorization-Header weiter", async (t) => {
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

  const graphQLQuery = `
    query {
      filme(genre: "Science Fiction", page: 2) {
        page
        totalPages
        movies {
          movieId
          title
          posterUrl
        }
      }
    }
  `;

  const response = await sendRequest(
    baseUrl,
    "/bff/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: {
        query: graphQLQuery,
      },
    }
  );

  const targetUrl = new URL(forwardedUrl);

  assert.equal(targetUrl.pathname, "/api/movies");
  assert.equal(
    targetUrl.searchParams.get("genre"),
    "Science Fiction"
  );
  assert.equal(targetUrl.searchParams.get("page"), "2");

  assert.equal(forwardedOptions.method, "GET");
  assert.equal(
    forwardedOptions.headers.Authorization,
    "Bearer test-token"
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.errors, undefined);
  assert.deepEqual(response.body.data.filme, backendBody);
});

// REST Fehler testen
test("GET /bff/movies gibt Backend-Fehler korrekt weiter", async (t) => {
  const backendBody = {
    message: "Invalid filter value.",
  };

  mockBackend(t, async () => {
    return mockResponse(400, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(
    baseUrl,
    "/bff/movies?genre=Unbekannt",
    {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
      },
    }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, backendBody);
});

// Fehlendes Token testen
test("GET /bff/movies ohne Token gibt HTTP 401 weiter", async (t) => {
  let forwardedOptions;

  const backendBody = {
    message: "Invalid token.",
  };

  mockBackend(t, async (_url, options) => {
    forwardedOptions = options;

    return mockResponse(401, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(
    baseUrl,
    "/bff/movies?query=Interstellar",
    {
      method: "GET",
    }
  );

  assert.equal(
    forwardedOptions.headers.Authorization,
    undefined
  );
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, backendBody);
});

// GraphQL Fehlerfall testen
test("GraphQL weist ungültige Abfragen zurück", async (t) => {
  let backendCalled = false;

  mockBackend(t, async () => {
    backendCalled = true;
    throw new Error("Backend sollte nicht aufgerufen werden.");
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(
    baseUrl,
    "/bff/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        query: `
          query {
            unbekanntesFeld
          }
        `,
      },
    }
  );

  assert.ok(
    Array.isArray(response.body.errors),
    "Die Antwort sollte GraphQL-Fehler enthalten."
  );

  assert.ok(
    response.body.errors.length > 0,
    "Mindestens ein GraphQL-Fehler sollte zurückgegeben werden."
  );

  assert.equal(
    backendCalled,
    false,
    "Bei einer ungültigen Abfrage darf das Backend nicht aufgerufen werden."
  );
});

// KI-Log
// Akzeptanzkriterium 5.11: Backend nicht erreichbar bei der Filmsuche (REST)
test("GET /bff/movies ergibt HTTP 503, wenn das Backend nicht erreichbar ist", async (t) => {
  mockBackend(t, async () => {
    throw new Error("Network error");
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/movies?query=Interstellar", {
    method: "GET",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    message: "Backend is not reachable.",
  });
});

// Akzeptanzkriterium 5.11: Backend nicht erreichbar bei der Filmsuche (GraphQL)
test("GraphQL meldet einen Fehler, wenn das Backend nicht erreichbar ist", async (t) => {
  mockBackend(t, async () => {
    throw new Error("Network error");
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: {
      query: "query { filme(query: \"Interstellar\") { page } }",
    },
  });

  assert.ok(Array.isArray(response.body.errors));
  assert.equal(response.body.errors[0].message, "Backend is not reachable.");
});

// KI-Log: Tests für die Detailroute geprüft (US-5, Akzeptanzkriterien 5.5, 5.10, 5.11)
test("GET /bff/movies/:movieId leitet ID und Authorization-Header weiter", async (t) => {
  let forwardedUrl;
  let forwardedOptions;

  // description und avgRating dürfen null sein
  const backendBody = {
    movieId: 157336,
    title: "Interstellar",
    description: null,
    genres: ["Science Fiction", "Drama"],
    fsk: 12,
    posterUrl: "https://image.tmdb.org/example.jpg",
    avgRating: null,
  };

  mockBackend(t, async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;

    return mockResponse(200, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/movies/157336", {
    method: "GET",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assert.equal(new URL(forwardedUrl).pathname, "/api/movies/157336");
  assert.equal(forwardedOptions.method, "GET");
  assert.equal(forwardedOptions.headers.Authorization, "Bearer test-token");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, backendBody);
});

test("GET /bff/movies/:movieId gibt 404 des Backends unverändert weiter", async (t) => {
  const backendBody = {
    message: "No movie found for this ID.",
  };

  mockBackend(t, async () => {
    return mockResponse(404, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/movies/999999999", {
    method: "GET",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, backendBody);
});

test("GET /bff/movies/:movieId ergibt HTTP 503, wenn das Backend nicht erreichbar ist", async (t) => {
  mockBackend(t, async () => {
    throw new Error("Network error");
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/movies/157336", {
    method: "GET",
    headers: {
      Authorization: "Bearer test-token",
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    message: "Backend is not reachable.",
  });
});