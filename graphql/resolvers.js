const { GraphQLError } = require("graphql");
const { backendFetch } = require("../lib/backend");

const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C14 (mit KI Claude-Unterstützung)
// Baut einen GraphQL-Fehler mit dem HTTP-Statuscode.
// So kann die MPA den Status lesen (errors[0].extensions.status).
function backendError(status, message) {
  return new GraphQLError(message, {
    extensions: { status },
  });
}

// KI-Log C4 (mit KI Claude-Unterstützung)
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
    backendResponse = await backendFetch(backendUrl, {
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

// KI-Log C7 (mit KI Claude-Unterstützung)
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
    backendResponse = await backendFetch(backendUrl, {
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

// KI-Log C15 (mit KI Claude-Unterstützung)
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
    backendResponse = await backendFetch(`${BACKEND_URL.replace(/\/+$/, "")}${path}`, {
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

// KI-Log C16 (mit KI Claude-Unterstützung)
// Resolver für die Abfrage "watchlist": Filme des angemeldeten Nutzers, neueste zuerst.
// Das Backend liefert { movies: [...] }, die MPA bekommt direkt die Liste.
async function watchlist(args, context) {
  const responseData = await requestBackend("/api/watchlist", {
    authorization: context.authorization,
    fallbackMessage: "Loading the watchlist failed.",
  });
  return responseData.movies;
}

// Resolver für die Mutation "filmVormerken": Film auf die Watchlist setzen.
async function filmVormerken(args, context) {
  return requestBackend("/api/watchlist", {
    method: "POST",
    body: { movieId: args.movieId },
    authorization: context.authorization,
    fallbackMessage: "Adding the movie failed.",
  });
}

// Resolver für die Mutation "vonWatchlistEntfernen": Film von der Watchlist nehmen.
async function vonWatchlistEntfernen(args, context) {
  return requestBackend(`/api/watchlist/${encodeURIComponent(args.movieId)}`, {
    method: "DELETE",
    authorization: context.authorization,
    fallbackMessage: "Removing the movie failed.",
  });
}

// KI-Log C19 (mit KI Claude-Unterstützung)
// Resolver für die Abfrage "vorschlaege": Lieblingsgenre und bis zu 10 Filmvorschläge (US-1).
async function vorschlaege(args, context) {
  return requestBackend("/api/recommendations", {
    authorization: context.authorization,
    fallbackMessage: "Loading the recommendations failed.",
  });
}

// KI-Log C20 (mit Claude Opus 5.5-Unterstützung)
// Resolver für die Abfrage "kommentare": Kommentare eines Films, neueste zuerst, 20 pro Seite.
async function kommentare(args, context) {
  const query = args.page === undefined || args.page === null ? "" : `?page=${encodeURIComponent(args.page)}`;
  return requestBackend(`/api/movies/${encodeURIComponent(args.movieId)}/comments${query}`, {
    authorization: context.authorization,
    fallbackMessage: "Loading the comments failed.",
  });
}

// Resolver für die Mutation "filmKommentieren": neuen Kommentar schreiben.
async function filmKommentieren(args, context) {
  return requestBackend(`/api/movies/${encodeURIComponent(args.movieId)}/comments`, {
    method: "POST",
    body: { text: args.text },
    authorization: context.authorization,
    fallbackMessage: "Posting the comment failed.",
  });
}

// Resolver für die Mutation "kommentarBearbeiten": eigenen Kommentar ändern.
async function kommentarBearbeiten(args, context) {
  return requestBackend(
    `/api/movies/${encodeURIComponent(args.movieId)}/comments/${encodeURIComponent(args.commentId)}`,
    {
      method: "PUT",
      body: { text: args.text },
      authorization: context.authorization,
      fallbackMessage: "Updating the comment failed.",
    }
  );
}

// Resolver für die Mutation "kommentarLoeschen": Kommentar löschen (Autor oder Moderator).
async function kommentarLoeschen(args, context) {
  return requestBackend(
    `/api/movies/${encodeURIComponent(args.movieId)}/comments/${encodeURIComponent(args.commentId)}`,
    {
      method: "DELETE",
      authorization: context.authorization,
      fallbackMessage: "Deleting the comment failed.",
    }
  );
}

// KI-Log C26 (mit Claude Opus 5.5-Unterstützung)
// Resolver für die Abfrage "status": prüft wie GET /bff/status, ob BFF und Backend laufen (kein Token nötig).
async function status() {
  const backend = await requestBackend("/api/status", {
    fallbackMessage: "Loading the status failed.",
  });
  return { status: "ok", nachricht: "CineRate-BFF läuft", backend };
}

// Resolver für die Mutation "registrieren": neues Konto anlegen (kein Token nötig).
async function registrieren(args) {
  return requestBackend("/api/users", {
    method: "POST",
    body: {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      password: args.password,
    },
    fallbackMessage: "Registration failed.",
  });
}

// Resolver für die Mutation "anmelden": liefert Token, userId und Rolle (kein Token nötig).
async function anmelden(args) {
  return requestBackend("/api/auth", {
    method: "POST",
    body: { email: args.email, password: args.password },
    fallbackMessage: "Login failed.",
  });
}

// Resolver für die Mutation "abmelden": macht das mitgeschickte Token ungültig.
async function abmelden(args, context) {
  return requestBackend("/api/auth", {
    method: "DELETE",
    authorization: context.authorization,
    fallbackMessage: "Logout failed.",
  });
}

// Resolver für die Mutation "kontoLoeschen": löscht das eigene Konto (userId im Format "u_67").
async function kontoLoeschen(args, context) {
  return requestBackend(`/api/users/${encodeURIComponent(args.userId)}`, {
    method: "DELETE",
    authorization: context.authorization,
    fallbackMessage: "Deleting the account failed.",
  });
}

module.exports = {
  filme,
  film,
  bewertungen,
  filmBewerten,
  watchlist,
  filmVormerken,
  vonWatchlistEntfernen,
  vorschlaege,
  kommentare,
  filmKommentieren,
  kommentarBearbeiten,
  kommentarLoeschen,
  registrieren,
  anmelden,
  abmelden,
  kontoLoeschen,
  status,
};