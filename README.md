# cinerate-bff

Backend-for-Frontend (BFF) von CineRate. Teil der Fallstudie Software Engineering, WS 2026/27.

## Architektur

Das BFF ist die einzige Schnittstelle für die beiden Touchpoints SPA ([cinerate-spa](../cinerate-spa)) und MPA ([cinerate-mpa](../cinerate-mpa)).

Es nimmt Anfragen entgegen, leitet sie an das Kern-Backend ([cinerate-backend](../cinerate-backend)) weiter und gibt die Antworten zurück. Den Header `Authorization: Bearer <token>` reicht es unverändert durch.

Das BFF bietet die Daten auf zwei Wegen an:

- **REST** unter `/bff/...`
- **GraphQL** unter `/bff/graphql`. Die Resolver rufen das Backend ebenfalls per REST auf.

Das BFF hat keinen Datenbankzugriff und ruft TMDB nicht selbst auf. Beides übernimmt das Kern-Backend.

## Endpunkte

### REST

| Methode | Pfad | Weiter an | Zweck |
| --- | --- | --- | --- |
| GET | `/bff/status` | `GET /api/status` | Prüft, ob BFF und Backend laufen |
| POST | `/bff/users` | `POST /api/users` | Registrieren |
| DELETE | `/bff/users/{userId}` | `DELETE /api/users/{userId}` | Account löschen |
| POST | `/bff/auth` | `POST /api/auth` | Anmelden |
| DELETE | `/bff/auth` | `DELETE /api/auth` | Abmelden |
| GET | `/bff/movies` | `GET /api/movies` | Filmsuche (Query: `query`, `genre`, `fsk`, `page`) |

Statuscode und JSON-Antwort des Backends gibt das BFF unverändert weiter. Ist das Backend nicht erreichbar, antwortet es mit 503 `{ "message": "Backend is not reachable." }`. Die Statusroute antwortet in diesem Fall mit 502. Die Routen und Antworten sind in `CineRate_API-2.pdf` beschrieben.

### GraphQL

Endpunkt: `POST /bff/graphql`

Beispiel für eine Filmsuche nach Genre:

```graphql
query {
  filme(genre: "Science Fiction", page: 1) {
    page
    totalPages
    movies {
      movieId
      title
      posterUrl
    }
  }
}
```

Alle Argumente von `filme` sind optional: `query`, `genre`, `fsk`, `page`. Meldet das Backend einen Fehler, steht dessen Meldung im Feld `errors` der GraphQL-Antwort.

## Setup

```
npm install
cp .env.example .env
npm start
```

Unter Windows (PowerShell): `copy .env.example .env` und `npm.cmd` statt `npm`.

Der Server läuft lokal auf http://localhost:4000.

| Variable | Bedeutung |
| --- | --- |
| `PORT` | Port des Servers (Heroku setzt ihn selbst) |
| `BACKEND_URL` | Adresse des Kern-Backends |
| `SPA_URL` | Adresse der SPA, für CORS. Lokal kann sie leer bleiben. |

Zugangsdaten gehören nicht ins Repository.

## Tests

```
npm test
```

Die Tests in `test/bff.test.js` ersetzen das Backend durch eine Attrappe. Sie prüfen, dass Pfad, Suchparameter, Body und Token richtig weitergegeben werden, dass Fehler des Backends unverändert ankommen und dass GraphQL ungültige Abfragen ablehnt. Die Tests laufen auch in GitHub Actions (`.github/workflows/bff-tests.yml`).

## Deployment auf Heroku

Die Heroku-App `cinerate-bff` braucht die Config Vars `BACKEND_URL` (URL der Backend-App) und `SPA_URL` (URL der SPA).

```
heroku config:set BACKEND_URL=https://cinerate-backend.herokuapp.com SPA_URL=<URL der SPA> -a cinerate-bff
git push heroku main
```

## Tech-Stack

Node.js, Express, GraphQL (`graphql`, `graphql-http`)