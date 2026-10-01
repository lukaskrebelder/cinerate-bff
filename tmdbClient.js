// Zentraler Client für Anfragen an die TMDB-API.
// Wird vom BFF genutzt, um externe Filmdaten zu holen und mit den Daten
// aus dem Kern-Backend zu kombinieren (BFF-Muster: eine Datenquelle von mehreren).
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbRequest(path) {
  const url = `${TMDB_BASE_URL}${path}${path.includes("?") ? "&" : "?"}api_key=${process.env.TMDB_API_KEY}&language=de-DE`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB-Anfrage fehlgeschlagen: ${response.status}`);
  }
  return response.json();
}

// Beispiel für künftige Nutzung, z. B. in einer Film-Detail-Route:
// const filmDetails = await tmdbClient.sucheFilm("Inception");
async function sucheFilm(titel) {
  return tmdbRequest(`/search/movie?query=${encodeURIComponent(titel)}`);
}

async function empfehlungenFuerFilm(tmdbId) {
  return tmdbRequest(`/movie/${tmdbId}/recommendations`);
}

module.exports = { sucheFilm, empfehlungenFuerFilm };
