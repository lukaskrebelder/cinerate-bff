// Tests für GraphQL-Filmsuche und -Filmdetail (US-5): graphql/schema.js, graphql/resolvers.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestServer, mockBackend, mockResponse, sendRequest } = require("./helpers");

// GraphQL test Filmsuche und Authorization-Header
// Die GraphQL-Suche soll dieselben Parameter wie REST ans Backend schicken, inklusive Token.
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

// GraphQL Fehlerfall testen
// Ein Feld, das es im Schema nicht gibt, lehnt GraphQL selbst ab – das Backend wird gar nicht gefragt.
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

// Akzeptanzkriterium 5.11: Backend nicht erreichbar bei der Filmsuche (GraphQL)
// Backend ist weg: GraphQL liefert einen Fehler mit Status 503 in extensions.
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
    assert.equal(response.body.errors[0].extensions.status, 503);
});

// KI-Log
// Detailansicht per GraphQL: richtige ID ans Backend, alle Felder kommen zurück, null bleibt null.
test("GraphQL film leitet ID und Token weiter und liefert die Detailfelder", async (t) => {
  let forwardedUrl;
  let forwardedOptions;

  // Antwortform laut CineRate_API-2.pdf; mehrere Felder dürfen null sein
  const backendBody = {
    movieId: 157336,
    title: "Interstellar",
    description: null,
    genres: ["Drama", "Science Fiction"],
    fsk: 12,
    posterUrl: null,
    releaseYear: 2014,
    runtime: 169,
    avgRating: null,
  };

  mockBackend(t, async (url, options) => {
    forwardedUrl = url;
    forwardedOptions = options;

    return mockResponse(200, backendBody);
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: {
      query: `
        query {
          film(movieId: 157336) {
            movieId
            title
            description
            genres
            fsk
            posterUrl
            releaseYear
            runtime
            avgRating
          }
        }
      `,
    },
  });

  assert.equal(new URL(forwardedUrl).pathname, "/api/movies/157336");
  assert.equal(forwardedOptions.headers.Authorization, "Bearer test-token");
  assert.equal(response.body.errors, undefined);
  assert.deepEqual(response.body.data.film, backendBody);
});

// Unbekannte Film-ID: der 404-Text des Backends steht im Fehler, dazu Status 404.
test("GraphQL film gibt 404 des Backends als Fehler zurück", async (t) => {
  mockBackend(t, async () => {
    return mockResponse(404, { message: "No movie found for this ID." });
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: {
      query: "query { film(movieId: 999999999) { title } }",
    },
  });

  assert.ok(Array.isArray(response.body.errors));
  assert.equal(response.body.errors[0].message, "No movie found for this ID.");
    assert.equal(response.body.errors[0].extensions.status, 404);
});

// "abc" ist keine Zahl (Int!) – GraphQL lehnt das ab, bevor das Backend etwas davon mitbekommt.
test("GraphQL film lehnt eine ungültige ID ab, ohne das Backend zu fragen", async (t) => {
  let backendCalled = false;

  mockBackend(t, async () => {
    backendCalled = true;
    throw new Error("Backend sollte nicht aufgerufen werden.");
  });

  const baseUrl = await createTestServer(t);

  const response = await sendRequest(baseUrl, "/bff/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: {
      query: 'query { film(movieId: "abc") { title } }',
    },
  });

  assert.ok(Array.isArray(response.body.errors));
  assert.equal(backendCalled, false);
});