// Gemeinsame Hilfsfunktionen für alle BFF-Tests.
// Diese Datei enthält selbst keine Tests.
const express = require("express");
const http = require("node:http");

const statusRoute = require("../routes/status");
const usersRoute = require("../routes/users");
const authRoute = require("../routes/auth");
const moviesRoute = require("../routes/movies");
const graphqlRoute = require("../routes/graphql");
const ratingsRoute = require("../routes/ratings");
const watchlistRoute = require("../routes/watchlist");

// Startet ein Test-BFF mit allen Routen auf einem freien Port (wie server.js, nur ohne CORS und festen Port).
// Nach dem Test wird der Server wieder geschlossen.
function createTestServer(t) {
  const app = express();

  app.use(express.json());
  app.use("/bff", statusRoute);
  app.use("/bff", usersRoute);
  app.use("/bff", authRoute);
  app.use("/bff", moviesRoute);
  app.use("/bff/graphql", graphqlRoute);
  app.use("/bff", ratingsRoute);
  app.use("/bff", watchlistRoute);

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

// Ersetzt fetch, damit kein echtes Backend nötig ist. Nach dem Test wird das echte fetch zurückgesetzt.
function mockBackend(t, implementation) {
  const originalFetch = global.fetch;

  global.fetch = implementation;

  t.after(() => {
    global.fetch = originalFetch;
  });
}

// Baut eine Antwort, wie sie fetch vom Backend zurückgeben würde.
function mockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

// Schickt eine Anfrage an das Test-BFF über node:http (unabhängig vom ersetzten fetch).
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

// Schickt eine GraphQL-Anfrage mit Test-Token an das Test-BFF (mit dem echten fetch).
async function sendGraphql(fetchFn, baseUrl, query) {
  const response = await fetchFn(`${baseUrl}/bff/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer testtoken" },
    body: JSON.stringify({ query }),
  });
  return response.json();
}

module.exports = {
  createTestServer,
  mockBackend,
  mockResponse,
  sendRequest,
  sendGraphql,
};