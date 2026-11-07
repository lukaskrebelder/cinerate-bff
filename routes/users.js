const express = require("express");
const router = express.Router();
const { backendFetch } = require("../lib/backend");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C1 (mit KI Claude-Unterstützung)
// POST /bff/users leitet die Registrierung an POST /api/users weiter.
router.post("/users", async (req, res) => {
  try {
  const headers = {
    "Content-Type": "application/json",
  };

  // Vorhandenen Authorization-Header weitergeben.
  const authorization = req.get("Authorization");

  if (authorization) {
    headers.Authorization = authorization;
  }

  const backendResponse = await backendFetch(`${BACKEND_URL}/api/users`, {
    method: "POST",
    headers: headers,
    // KI-Log C26 (mit Claude Opus 5.5-Unterstützung)
    // Nur die vorgesehenen Felder gehen weiter (ADR-02).
    body: JSON.stringify({
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
      email: req.body?.email,
      password: req.body?.password,
    }),
  });

  const responseData = await backendResponse.json();

  return res.status(backendResponse.status).json(responseData);
} catch (error) {
    return res.status(503).json({
      message: "Backend is not reachable.",
    });
  }
});

// DELETE /bff/users/:userId leitet das Löschen an das Backend weiter.
router.delete("/users/:userId", async (req, res) => {
  try {
    const headers = {};

    // Authorization-Header an das Backend weitergeben.
    const authorization = req.get("Authorization");

    if (authorization) {
      headers.Authorization = authorization;
    }

    const backendResponse = await backendFetch(
      `${BACKEND_URL}/api/users/${encodeURIComponent(req.params.userId)}`,
      {
        method: "DELETE",
        headers: headers,
      }
    );

    const responseData = await backendResponse.json();

    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({
      message: "Backend is not reachable.",
    });
  }
});

module.exports = router;