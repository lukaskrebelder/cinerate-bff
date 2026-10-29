const express = require("express");
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C3 (mit KI Claude-Unterstützung)
// GET /bff/movies leitet die Filmsuche an GET /api/movies weiter.
router.get("/movies", async (req, res) => {
  try {
    const backendUrl = new URL(
      `${BACKEND_URL.replace(/\/+$/, "")}/api/movies`
    );

    // Unterstützte Suchparameter an das Backend weitergeben.
    const queryParameters = ["query", "genre", "fsk", "page"];

    for (const parameter of queryParameters) {
      const value = req.query[parameter];

      if (typeof value === "string") {
        backendUrl.searchParams.set(parameter, value);
      }
    }

    // Authorization-Header an das Backend weitergeben.
    const headers = {};
    const authorization = req.get("Authorization");

    if (authorization) {
      headers.Authorization = authorization;
    }

    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers,
    });

    const responseData = await backendResponse.json();

    // Status und JSON-Antwort des Backends unverändert weitergeben.
    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({
      message: "Backend is not reachable.",
    });
  }
});

// KI-Log C7 (mit Claude Opus 5.5-Unterstützung)
// GET /bff/movies/:movieId leitet die Detailansicht an GET /api/movies/{movieId} weiter.
router.get("/movies/:movieId", async (req, res) => {
  try {
    const backendUrl = `${BACKEND_URL.replace(/\/+$/, "")}/api/movies/${encodeURIComponent(
      req.params.movieId
    )}`;

    // Authorization-Header an das Backend weitergeben.
    const headers = {};
    const authorization = req.get("Authorization");

    if (authorization) {
      headers.Authorization = authorization;
    }

    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers,
    });

    const responseData = await backendResponse.json();

    // Status und JSON-Antwort des Backends unverändert weitergeben.
    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({
      message: "Backend is not reachable.",
    });
  }
});

module.exports = router;