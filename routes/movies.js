const express = require("express");
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

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

module.exports = router;