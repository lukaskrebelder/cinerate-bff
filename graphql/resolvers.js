const { GraphQLError } = require("graphql");

const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C
// Baut einen GraphQL-Fehler mit dem HTTP-Statuscode.
// So kann die MPA den Status lesen (errors[0].extensions.status).
function backendError(status, message) {
  return new GraphQLError(message, {
    extensions: { status },
  });
}

// Resolver für die GraphQL-Abfrage "filme".
async function filme(args, context) {
  const backendUrl = new URL(
    `${BACKEND_URL.replace(/\/+$/, "")}/api/movies`
  );

  // Optionale Suchparameter an das Backend weitergeben.
  const queryParameters = {
    query: args.query,
    genre: args.genre,
    fsk: args.fsk,
    page: args.page,
  };

  for (const [parameter, value] of Object.entries(queryParameters)) {
    if (value !== undefined && value !== null) {
      backendUrl.searchParams.set(parameter, String(value));
    }
  }

  // Authorization-Header an das Backend weitergeben.
  const headers = {};

  if (context.authorization) {
    headers.Authorization = context.authorization;
  }

  let backendResponse;

  try {
    backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers,
    });
  } catch (error) {
    throw backendError(503, "Backend is not reachable.");
  }

  let responseData;

  try {
    responseData = await backendResponse.json();
  } catch (error) {
    throw backendError(502, "Invalid response from backend.");
  }

  // Fehlerantworten des Backends als GraphQL-Fehler mit Statuscode zurückgeben.
  if (!backendResponse.ok) {
    throw backendError(
      backendResponse.status,
      responseData.message || "Movie search failed."
    );
  }

  return responseData;
}

// KI-Log C
// Resolver für die GraphQL-Abfrage "film" (Detailansicht).
async function film(args, context) {
  const backendUrl = `${BACKEND_URL.replace(/\/+$/, "")}/api/movies/${encodeURIComponent(
    args.movieId
  )}`;

  // Authorization-Header an das Backend weitergeben.
  const headers = {};

  if (context.authorization) {
    headers.Authorization = context.authorization;
  }

  let backendResponse;

  try {
    backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers,
    });
  } catch (error) {
    throw backendError(503, "Backend is not reachable.");
  }

  let responseData;

  try {
    responseData = await backendResponse.json();
  } catch (error) {
    throw backendError(502, "Invalid response from backend.");
  }

  // Fehlerantworten des Backends (z. B. 404) als GraphQL-Fehler mit Statuscode zurückgeben.
  if (!backendResponse.ok) {
    throw backendError(
      backendResponse.status,
      responseData.message || "Loading the movie failed."
    );
  }

  return responseData;
}

// KI-Log C
// Gemeinsamer Backend-Aufruf für neue Resolver: Token weitergeben, Fehler mit Statuscode werfen.
async function requestBackend(path, { method = "GET", body, authorization, fallbackMessage }) {
  const headers = {};

  if (authorization) {
    headers.Authorization = authorization;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let backendResponse;

  try {
    backendResponse = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw backendError(503, "Backend is not reachable.");
  }

  let responseData;

  try {
    responseData = await backendResponse.json();
  } catch (error) {
    throw backendError(502, "Invalid response from backend.");
  }

  if (!backendResponse.ok) {
    throw backendError(backendResponse.status, responseData.message || fallbackMessage);
  }

  return responseData;
}

// Resolver für die Abfrage "bewertungen": Durchschnitt, Anzahl und eigene Sterne.
async function bewertungen(args, context) {
  return requestBackend(`/api/movies/${encodeURIComponent(args.movieId)}/ratings`, {
    authorization: context.authorization,
    fallbackMessage: "Loading the ratings failed.",
  });
}

// Resolver für die Mutation "filmBewerten": Bewertung abgeben oder die eigene ändern.
async function filmBewerten(args, context) {
  return requestBackend(`/api/movies/${encodeURIComponent(args.movieId)}/ratings`, {
    method: "POST",
    body: { stars: args.stars },
    authorization: context.authorization,
    fallbackMessage: "Saving the rating failed.",
  });
}

module.exports = {
  filme,
  film,
  bewertungen,
  filmBewerten
};