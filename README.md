# cinerate-bff

Backend-for-Frontend (BFF) von CineRate. Teil der Fallstudie Software Engineering, WS 2026/27.

## Architektur

Das BFF ist die einzige Schnittstelle, mit der die SPA (cinerate-spa) kommuniziert.

Es leitet Anfragen an das Kern-Backend (cinerate-backend) weiter und gibt die Antworten an die SPA zurück.

Das Kern-Backend ist für die Verarbeitung der Nutzer-, Film- und Bewertungsdaten sowie den Zugriff auf die Datenbank zuständig. Es ruft bei Bedarf die TMDB-API auf und speichert die benötigten Filmdaten in der Datenbank.

Die SPA kommuniziert ausschließlich mit dem BFF und greift nicht direkt auf das Kern-Backend oder die TMDB-API zu.

## Setup
npm install
cp .env.example .env
npm start

Der Server läuft lokal auf http://localhost:4000.

Die lokale .env-Datei enthält die benötigten Umgebungsvariablen, insbesondere BACKEND_URL. Zugangsdaten gehören nicht ins Repository.

## Deployment auf Heroku

Die bestehende Heroku-App cinerate-bff benötigt die Config Var BACKEND_URL, die auf die URL der Backend-App zeigt.

heroku config:set BACKEND_URL=https://cinerate-backend.herokuapp.com -a cinerate-bff
git push heroku main

Vor dem Deployment muss sichergestellt sein, dass die verwendete Backend-URL stimmt und das lokale Git-Repository mit der bestehenden Heroku-App verbunden ist.

## Tech-Stack

Node.js, Express