// Tests für Filmsuche und Filmdetail per REST (US-5): routes/movies.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendRequest } = require("./helpers");

// Test for GET /bff/movies
// Alle Suchparameter (query, genre, fsk, page) und der Token müssen beim Backend ankommen.
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

// REST Fehler testen
// Meldet das Backend 400 (z. B. unbekanntes Genre), gibt das BFF genau das weiter.
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
// Ohne Token schickt das BFF auch keinen Authorization-Header mit und reicht die 401 durch.
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

// KI-Log
// Akzeptanzkriterium 5.11: Backend nicht erreichbar bei der Filmsuche (REST)
// Backend ist weg: die Suche antwortet mit 503.
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

// KI-Log: Tests für die Detailroute geprüft (US-5, Akzeptanzkriterien 5.5, 5.10, 5.11)
// Die Film-ID aus der Adresse landet im Backend-Pfad, die Antwort kommt unverändert zurück.
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

// Unbekannte ID: Status und Text vom Backend werden 1:1 weitergegeben.
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

// Backend ist weg: auch die Detailseite antwortet mit 503.
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