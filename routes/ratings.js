const express = require("express");
const router = express.Router();
const { backendFetch } = require("../lib/backend");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// Baut die Backend-Adresse für die Bewertungen eines Films.
function ratingsUrl(movieId) {
  return `${BACKEND_URL.replace(/\/+$/, "")}/api/movies/${encodeURIComponent(movieId)}/ratings`;
}

// Übernimmt den Authorization-Header der SPA, damit das Backend weiß, wer bewertet.
function authHeaders(req) {
  const headers = {};
  const authorization = req.get("Authorization");

  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

// KI-Log C13 (mit Claude Opus 5.5-Unterstützung)
// POST /bff/movies/:movieId/ratings leitet eine Bewertung an das Backend weiter.
// 201 = neue Bewertung, 200 = eigene Bewertung geändert (entscheidet das Backend).
router.post("/movies/:movieId/ratings", async (req, res) => {
  try {
    const backendResponse = await backendFetch(ratingsUrl(req.params.movieId), {
      method: "POST",
      headers: { ...authHeaders(req), "Content-Type": "application/json" },
      body: JSON.stringify({ stars: req.body?.stars }),
    });

    const responseData = await backendResponse.json();
    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({ message: "Backend is not reachable." });
  }
});

// GET /bff/movies/:movieId/ratings liefert Durchschnitt, Anzahl und eigene Sterne.
router.get("/movies/:movieId/ratings", async (req, res) => {
  try {
    const backendResponse = await backendFetch(ratingsUrl(req.params.movieId), {
      method: "GET",
      headers: authHeaders(req),
    });

    const responseData = await backendResponse.json();
    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({ message: "Backend is not reachable." });
  }
});

module.exports = router;