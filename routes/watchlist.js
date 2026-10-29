const express = require("express");
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// Baut die Backend-Adresse der Watchlist, optional mit Film-ID (für DELETE).
function watchlistUrl(movieId) {
  const base = `${BACKEND_URL.replace(/\/+$/, "")}/api/watchlist`;
  return movieId === undefined ? base : `${base}/${encodeURIComponent(movieId)}`;
}

// Übernimmt den Authorization-Header, damit das Backend weiß, wessen Watchlist gemeint ist.
function authHeaders(req) {
  const headers = {};
  const authorization = req.get("Authorization");

  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

// Schickt die Anfrage ans Backend und gibt Status und Antwort unverändert zurück.
async function forward(res, url, options) {
  try {
    const backendResponse = await fetch(url, options);
    const responseData = await backendResponse.json();
    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({ message: "Backend is not reachable." });
  }
}

// KI-Log C16 (mit Claude Opus 5.5-Unterstützung)
// GET /bff/watchlist liefert die Watchlist des angemeldeten Nutzers (neueste zuerst).
router.get("/watchlist", (req, res) => {
  return forward(res, watchlistUrl(), {
    method: "GET",
    headers: authHeaders(req),
  });
});

// POST /bff/watchlist setzt einen Film auf die Watchlist. Body: { "movieId": 157336 }
// 201 = hinzugefügt, 404 = Film unbekannt, 409 = schon auf der Watchlist.
router.post("/watchlist", (req, res) => {
  return forward(res, watchlistUrl(), {
    method: "POST",
    headers: { ...authHeaders(req), "Content-Type": "application/json" },
    body: JSON.stringify({ movieId: req.body?.movieId }),
  });
});

// DELETE /bff/watchlist/:movieId nimmt einen Film von der Watchlist.
// 200 = entfernt, 404 = nicht auf der Watchlist.
router.delete("/watchlist/:movieId", (req, res) => {
  return forward(res, watchlistUrl(req.params.movieId), {
    method: "DELETE",
    headers: authHeaders(req),
  });
});

module.exports = router;