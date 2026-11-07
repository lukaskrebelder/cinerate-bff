const express = require("express");
const router = express.Router();
const { backendFetch } = require("../lib/backend");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// KI-Log C1 (mit KI Claude-Unterstützung)
// POST /bff/auth leitet den Login an POST /api/auth weiter.
router.post("/auth", async (req, res) => {
  try {
    const backendResponse = await backendFetch(`${BACKEND_URL}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // KI-Log C26 (mit Claude Opus 5.5-Unterstützung)
      // Nur E-Mail und Passwort gehen weiter (ADR-02).
      body: JSON.stringify({ email: req.body?.email, password: req.body?.password }),
    });

    const responseData = await backendResponse.json();

    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({
      message: "Backend is not reachable.",
    });
  }
});

// DELETE /bff/auth leitet den Logout an DELETE /api/auth weiter.
router.delete("/auth", async (req, res) => {
  try {
    const headers = {};

    // Authorization-Header an das Backend weitergeben.
    const authorization = req.get("Authorization");

    if (authorization) {
      headers.Authorization = authorization;
    }

    const backendResponse = await backendFetch(`${BACKEND_URL}/api/auth`, {
      method: "DELETE",
      headers: headers,
    });

    const responseData = await backendResponse.json();

    return res.status(backendResponse.status).json(responseData);
  } catch (error) {
    return res.status(503).json({
      message: "Backend is not reachable.",
    });
  }
});

module.exports = router;