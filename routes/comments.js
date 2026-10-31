const express = require("express");
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// Baut die Backend-Adresse für die Kommentare eines Films (optional mit Kommentar-ID).
function commentsUrl(movieId, commentId) {
  const base = `${BACKEND_URL.replace(/\/+$/, "")}/api/movies/${encodeURIComponent(movieId)}/comments`;
  return commentId === undefined ? base : `${base}/${encodeURIComponent(commentId)}`;
}

// Übernimmt den Authorization-Header, damit das Backend weiß, wer schreibt oder löscht.
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

// KI-Log C20 (mit Claude Opus 5.5-Unterstützung)
// POST /bff/movies/:movieId/comments schreibt einen Kommentar. Nur der Text geht weiter.
router.post("/movies/:movieId/comments", (req, res) => {
  return forward(res, commentsUrl(req.params.movieId), {
    method: "POST",
    headers: { ...authHeaders(req), "Content-Type": "application/json" },
    body: JSON.stringify({ text: req.body?.text }),
  });
});

// GET /bff/movies/:movieId/comments liefert die Kommentare, neueste zuerst, 20 pro Seite.
router.get("/movies/:movieId/comments", (req, res) => {
  const url = new URL(commentsUrl(req.params.movieId));
  if (req.query.page !== undefined) {
    url.searchParams.set("page", req.query.page);
  }

  return forward(res, url, { method: "GET", headers: authHeaders(req) });
});

// PUT /bff/movies/:movieId/comments/:commentId bearbeitet den eigenen Kommentar.
router.put("/movies/:movieId/comments/:commentId", (req, res) => {
  return forward(res, commentsUrl(req.params.movieId, req.params.commentId), {
    method: "PUT",
    headers: { ...authHeaders(req), "Content-Type": "application/json" },
    body: JSON.stringify({ text: req.body?.text }),
  });
});

// DELETE /bff/movies/:movieId/comments/:commentId löscht einen Kommentar (Autor oder Moderator).
router.delete("/movies/:movieId/comments/:commentId", (req, res) => {
  return forward(res, commentsUrl(req.params.movieId, req.params.commentId), {
    method: "DELETE",
    headers: authHeaders(req),
  });
});

module.exports = router;