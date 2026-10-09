require("dotenv").config();
const express = require("express");
const cors = require("cors");
const statusRoute = require("./routes/status");
const usersRoute = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 4000;

// BFF (Backend-for-Frontend): einzige Schnittstelle für die SPA.
// Leitet Anfragen an das Kern-Backend weiter.
// Das Backend übernimmt die TMDB-Anbindung und das Speichern der Filmdaten.
app.use(
  cors({
    origin: process.env.SPA_URL || "*",
  })
);

app.use(express.json());

app.use("/bff", statusRoute);
app.use("/bff", usersRoute);

app.listen(PORT, () => {
  console.log(`CineRate-BFF läuft auf http://localhost:${PORT}`);
});
