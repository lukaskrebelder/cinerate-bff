const express = require("express");
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C
// GET /bff/recommendations liefert bis zu 10 Filmvorschläge für den angemeldeten Nutzer (US-1).
// Wer gemeint ist, erkennt das Backend am Token, deshalb gibt es keine ID noch Body.
// 200 = { favoriteGenre, movies }, 400 = zu wenige Bewertungen, 404 = keine neuen Vorschläge.
router.get("/recommendations", async (req, res) => {
  try {
    const headers = {};
    const authorization = req.get("Authorization");

    if (authorization) {
      headers.Authorization = authorization;
    }

    const backendResponse = await fetch(`${BACKEND_URL.replace(/\/+$/, "")}/api/recommendations`, {
      method: "GET",
      headers,
    });

    const responseData = await backendResponse.json();
    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({ message: "Backend is not reachable." });
  }
});

module.exports = router;