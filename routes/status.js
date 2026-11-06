// Statusroute: prüft, ob das BFF erreichbar ist und das Kern-Backend
// antwortet. Die TMDB-Anbindung erfolgt im Kern-Backend.
const express = require("express");
const router = express.Router();
const { backendFetch } = require("../lib/backend");
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C1 (mit KI Claude-Unterstützung)
router.get("/status", async (req, res) => {
  try {
    const backendResponse = await backendFetch(`${BACKEND_URL}/api/status`);
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
