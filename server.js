require("dotenv").config();
const express = require("express");
const cors = require("cors");
const statusRoute = require("./routes/status");

const app = express();
const PORT = process.env.PORT || 4000;

// BFF (Backend-for-Frontend): einzige Schnittstelle für die SPA.
// Ruft intern das Kern-Backend UND die TMDB-API auf und kombiniert beides
// zu einer für die SPA passenden Antwort (BFF-Muster aus der Vorlesung).
app.use(
  cors({
    origin: process.env.SPA_URL || "*",
  })
);

app.use(express.json());

app.use("/bff", statusRoute);

app.listen(PORT, () => {
  console.log(`CineRate-BFF läuft auf http://localhost:${PORT}`);
});
