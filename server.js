// KI-Log C1 (mit KI Claude-Unterstützung)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const statusRoute = require("./routes/status");
const usersRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const moviesRoute = require("./routes/movies");
const graphqlRoute = require("./routes/graphql");
const ratingsRoute = require("./routes/ratings");
const watchlistRoute = require("./routes/watchlist");
const recommendationsRoute = require("./routes/recommendations");

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
app.use("/bff", authRoute);
app.use("/bff", moviesRoute);
app.use("/bff/graphql", graphqlRoute);
app.use("/bff", ratingsRoute);
app.use("/bff", watchlistRoute);
app.use("/bff", recommendationsRoute);

app.listen(PORT, () => {
  console.log(`CineRate-BFF läuft auf http://localhost:${PORT}`);
});
