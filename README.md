# cinerate-bff

Backend-for-Frontend (BFF) von CineRate. Teil der Fallstudie Software
Engineering, WS 2026/27.

## Architektur

Das BFF ist die **einzige Schnittstelle**, mit der die SPA
([cinerate-spa](../cinerate-spa)) kommuniziert. Es ruft intern

- das Kern-Backend ([cinerate-backend](../cinerate-backend)) für
  Nutzer-, Film- und Bewertungsdaten, und
- die **TMDB-API** direkt für externe Filmdaten (Poster, Beschreibungen, Empfehlungen)

auf und kombiniert beides zu einer für die SPA passenden Antwort. Die SPA
muss diese Kombination nicht selbst durchführen und kennt TMDB gar nicht.

Das entspricht dem BFF-Muster: lose Kopplung von Frontend und Backend,
zentraler, geschützter Zugriff auf die Datenquellen.

## Setup

```
npm install
cp .env.example .env   # TMDB_API_KEY und BACKEND_URL eintragen
npm start
```

Läuft auf [http://localhost:4000](http://localhost:4000).

## Deployment auf Heroku

```
heroku create cinerate-bff
heroku config:set TMDB_API_KEY=... BACKEND_URL=https://cinerate-backend.herokuapp.com
git push heroku main
```

## Tech-Stack

Node.js, Express
