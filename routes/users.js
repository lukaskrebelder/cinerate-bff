const express = require("express");
const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

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

  const backendResponse = await fetch(`${BACKEND_URL}/api/users`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(req.body),
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