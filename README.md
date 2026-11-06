<!-- KI-Log C6, C7, C15, C16, C18, C19, C20, C25, C26: Erstellt mithilfe von KI (Claude) -->
# cinerate-bff

Backend-for-Frontend (BFF) von CineRate. Teil der Fallstudie Software Engineering, WS 2026/27.

## Architektur

Das BFF ist die einzige Schnittstelle für die beiden Touchpoints SPA ([cinerate-spa](../cinerate-spa)) und MPA ([cinerate-mpa](../cinerate-mpa)).

Es nimmt Anfragen entgegen, leitet sie an das Kern-Backend ([cinerate-backend](../cinerate-backend)) weiter und gibt die Antworten zurück. Den Header `Authorization: Bearer <token>` reicht es unverändert durch.

Das Backend nimmt nur Anfragen vom BFF an. Dafür schickt das BFF bei jedem Aufruf den Header `X-Internal-Key` mit dem Wert aus `INTERNAL_API_KEY` mit (gemeinsamer Helfer `lib/backend.js`). Ist die Variable leer, wird kein Header geschickt.

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
| GET | `/bff/movies/{movieId}` | `GET /api/movies/{movieId}` | Filmdetails (`movieId` = TMDB-ID) |
| GET | `/bff/movies/{movieId}/ratings` | `GET /api/movies/{movieId}/ratings` | Bewertungen eines Films: `avgRating`, `ratingCount`, `ownStars` |
| POST | `/bff/movies/{movieId}/ratings` | `POST /api/movies/{movieId}/ratings` | Bewertung abgeben oder ändern (Body: `{ "stars": 1–5 }`), 201 neu / 200 geändert |
| GET | `/bff/watchlist` | `GET /api/watchlist` | Watchlist des angemeldeten Nutzers, neueste zuerst: `{ movies: [...] }` |
| POST | `/bff/watchlist` | `POST /api/watchlist` | Film vormerken (Body: `{ "movieId": 157336 }`), 201 / 404 unbekannter Film / 409 schon vorgemerkt |
| DELETE | `/bff/watchlist/{movieId}` | `DELETE /api/watchlist/{movieId}` | Film entfernen, 200 / 404 nicht auf der Watchlist |
| GET | `/bff/recommendations` | `GET /api/recommendations` | Filmvorschläge: `{ favoriteGenre, movies: [...] }`, bis zu 10 Filme; 400 zu wenige Bewertungen / 404 keine neuen Vorschläge |
| GET | `/bff/movies/{movieId}/comments` | `GET /api/movies/{movieId}/comments` | Kommentare eines Films, neueste zuerst, 20 pro Seite (Query: `page`): `{ page, totalPages, comments: [...] }` |
| POST | `/bff/movies/{movieId}/comments` | `POST /api/movies/{movieId}/comments` | Kommentar schreiben (Body: `{ "text": "…" }`, 1–500 Zeichen), 201 `{ message, commentId }` / 400 / 404 |
| PUT | `/bff/movies/{movieId}/comments/{commentId}` | `PUT /api/movies/{movieId}/comments/{commentId}` | Eigenen Kommentar bearbeiten (Body: `{ "text": "…" }`), 200 / 403 fremder Kommentar / 404 |
| DELETE | `/bff/movies/{movieId}/comments/{commentId}` | `DELETE /api/movies/{movieId}/comments/{commentId}` | Kommentar löschen (Autor oder Moderator), 200 / 403 / 404 |

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

Alle Argumente von `filme` sind optional: `query`, `genre`, `fsk`, `page`. Fehler siehe Abschnitt „Fehler“ weiter unten.

Beispiel für die Detailansicht eines Films:

```graphql
query {
  film(movieId: 157336) {
    title
    description
    genres
    fsk
    releaseYear
    runtime
    avgRating
  }
}
```

`movieId` ist Pflicht und muss eine ganze Zahl sein. `description`, `fsk`, `posterUrl`, `releaseYear`, `runtime` und `avgRating` können `null` sein.

Beispiel für die Bewertungen eines Films:

```graphql
query {
  bewertungen(movieId: 157336) {
    avgRating
    ratingCount
    ownStars
  }
}
```

Ohne Bewertungen sind `avgRating` und `ownStars` `null` und `ratingCount` ist 0.

Bewertung abgeben oder die eigene ändern (Mutation):

```graphql
mutation {
  filmBewerten(movieId: 157336, stars: 4) {
    message
    stars
    avgRating
  }
}
```

`stars` muss eine ganze Zahl sein. Kommazahlen lehnt GraphQL selbst ab, Werte außerhalb von 1 bis 5 lehnt das Backend mit 400 ab.

Watchlist des angemeldeten Nutzers (neueste zuerst):

```graphql
query {
  watchlist {
    movieId
    title
    posterUrl
  }
}
```

Film vormerken und wieder entfernen (Mutationen):

```graphql
mutation {
  filmVormerken(movieId: 157336) {
    message
  }
}
```

```graphql
mutation {
  vonWatchlistEntfernen(movieId: 157336) {
    message
  }
}
```

Ist der Film schon vorgemerkt, kommt ein Fehler mit `extensions.status` 409. Ist er nicht auf der Watchlist, kommt 404.

Filmvorschläge für den angemeldeten Nutzer:

```graphql
query {
  vorschlaege {
    favoriteGenre
    movies {
      movieId
      title
      description
      posterUrl
    }
  }
}
```

Vorschläge gibt es erst ab 3 bewerteten Filmen, davon mindestens einer mit 4 oder 5 Sternen; sonst kommt ein Fehler mit `extensions.status` 400. Gibt es keine neuen Vorschläge, kommt 404.

Kommentare eines Films (neueste zuerst, `page` ist optional):

```graphql
query {
  kommentare(movieId: 157336, page: 1) {
    page
    totalPages
    comments {
      commentId
      firstName
      text
      createdAt
      updatedAt
    }
  }
}
```

Kommentar schreiben, bearbeiten und löschen (Mutationen):

```graphql
mutation {
  filmKommentieren(movieId: 157336, text: "Großartiger Film!") {
    message
    commentId
  }
}
```

```graphql
mutation {
  kommentarBearbeiten(movieId: 157336, commentId: "c_1042", text: "Geändert") {
    message
  }
}
```

```graphql
mutation {
  kommentarLoeschen(movieId: 157336, commentId: "c_1042") {
    message
  }
}
```

`commentId` ist Text (z. B. `c_1042`). `updatedAt` ist `null`, solange der Kommentar nicht bearbeitet wurde. Bearbeiten darf nur der Autor, löschen der Autor oder ein Moderator; sonst kommt ein Fehler mit `extensions.status` 403.

Registrieren, anmelden, abmelden und Konto löschen (Mutationen):

```graphql
mutation {
  registrieren(firstName: "Lena", lastName: "Hartmann", email: "lena.hartmann@example.com", password: "Kino2026!") {
    message
    userId
  }
}
```

```graphql
mutation {
  anmelden(email: "lena.hartmann@example.com", password: "Kino2026!") {
    token
    userId
    rolle
  }
}
```

```graphql
mutation {
  abmelden {
    message
  }
}
```

```graphql
mutation {
  kontoLoeschen(userId: "u_67") {
    message
  }
}
```

Die Anmeldung liefert wie bei REST ein Token. Es wird danach im Header `Authorization: Bearer <token>` mitgegeben, auch für `abmelden` und `kontoLoeschen`. `registrieren` und `anmelden` brauchen kein Token. Gelöscht werden darf nur das eigene Konto, sonst kommt ein Fehler mit `extensions.status` 403.

Status von BFF und Backend (wie `GET /bff/status`, ohne Token):

```graphql
query {
  status {
    status
    nachricht
    backend {
      status
      filmeInDb
    }
  }
}
```

Damit bietet GraphQL alle 17 REST-Routen an.

#### Fehler

Fehler stehen im Feld `errors` der Antwort, der HTTP-Status ist dabei 200. Kommt der Fehler vom Backend, steht dessen Statuscode in `extensions.status`:

```json
{
  "errors": [
    { "message": "Invalid token.", "extensions": { "status": 401 } }
  ],
  "data": null
}
```

Ist das Backend nicht erreichbar, ist der Status 503. Fehler, die GraphQL selbst erkennt (z. B. falscher Datentyp), haben keinen `extensions.status`.

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
| `INTERNAL_API_KEY` | Interner Schlüssel für das Backend (Header `X-Internal-Key`). Lokal leer lassen, wenn das lokale Backend keinen Schlüssel erwartet. |

Zugangsdaten gehören nicht ins Repository.

## Tests

```
npm test
```

Die Tests liegen in `test/`, eine Datei pro Bereich (`users`, `auth`, `movies`, `graphql`, `ratings`, `watchlist`, `recommendations`, `comments`, `backend` für den internen Schlüssel); gemeinsame Hilfsfunktionen stehen in `test/helpers.js`. Sie ersetzen das Backend durch eine Attrappe. Sie prüfen, dass Pfad, Suchparameter, Body und Token richtig weitergegeben werden, dass Fehler des Backends unverändert ankommen (bei GraphQL mit `extensions.status`) und dass GraphQL ungültige Abfragen ablehnt. Die Tests laufen auch in GitHub Actions (`.github/workflows/bff-tests.yml`).

## Deployment auf Heroku

Die Heroku-App `cinerate-bff` braucht die Config Vars `BACKEND_URL` (URL der Backend-App), `SPA_URL` (URL der SPA) und `INTERNAL_API_KEY` (derselbe Wert wie auf der Backend-App).

```
heroku config:set BACKEND_URL=<URL der Backend-App> SPA_URL=<URL der SPA> -a cinerate-bff
git push heroku main
```

## Tech-Stack

Node.js, Express, GraphQL (`graphql`, `graphql-http`)