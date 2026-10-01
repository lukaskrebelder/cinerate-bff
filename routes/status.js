// Beispiel-Route: zeigt, dass das BFF erreichbar ist und das Kern-Backend
// ansprechen kann. Sobald Film-Endpunkte existieren, kombiniert das BFF hier
// zusätzlich Daten von TMDB (siehe tmdbClient.js).
const express = require("express");
const router = express.Router();
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

router.get("/status", async (req, res) => {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/status`);
    const backendData = await backendResponse.json();

    res.json({
      status: "ok",
      nachricht: "CineRate-BFF läuft",
      backend: backendData,
    });
  } catch (err) {
    res.status(502).json({
      status: "error",
      nachricht: "Kern-Backend nicht erreichbar: " + err.message,
    });
  }
});

module.exports = router;
