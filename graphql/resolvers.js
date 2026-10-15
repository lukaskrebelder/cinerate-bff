const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:3000";

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
    throw new Error("Backend is not reachable.");
  }

  let responseData;

  try {
    responseData = await backendResponse.json();
  } catch (error) {
    throw new Error("Invalid response from backend.");
  }

  // Fehlerantworten des Backends als GraphQL-Fehler zurückgeben.
  if (!backendResponse.ok) {
    throw new Error(
      responseData.message || "Movie search failed."
    );
  }

  return responseData;
}

module.exports = {
  filme,
};