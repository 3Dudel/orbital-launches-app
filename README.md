# 🚀 LaunchHub

Zeigt geplante orbitale Raketenstarts aus zwei Quellen: der deutschen [Wikipedia-Liste](https://de.wikipedia.org/wiki/Liste_geplanter_orbitaler_Raketenstarts) und der [Launch Library 2 von The Space Devs](https://thespacedevs.com/llapi).

Pro Start wird verglichen, ob beide Quellen übereinstimmen oder die Startzeiten abweichen. Wenn The Space Devs einen Livestream hinterlegt hat, ist er direkt verlinkt – sonst gibt es eine YouTube-Suche. Zusätzlich werden offene Termine ohne festen Zeitpunkt (Quartal, Halbjahr, Jahr) in einer eigenen Liste angezeigt.

## Funktionen

- Mobile-first Web-App, lädt wie eine native Anwendung
- Zwei Datenquellen: Wikipedia (stündlich via GitHub Actions) + The Space Devs (live, 30 min Cache)
- Vergleich der Quellen mit ✓/Δ-Badges
- Livestream-Links (YouTube, etc.) falls verfügbar
- Liste offener Termine (ohne konkrete Uhrzeit)
- Karte aller Startplätze
- Startplatz-Übersicht mit geplanten Starts
- Untere Tab-Leiste wie in einer nativen App

## Daten aktualisieren

`scripts/sync.mjs` wird stündlich per GitHub Actions ausgeführt und schreibt `data/launches.json` aus der Wikipedia-Tabelle.

## Lokal starten

Einfach `index.html` im Browser öffnen.

## Datenschutz / Impressum

In der App über das Menü erreichbar. Keine Server-seitige Speicherung; beim Aufruf werden Daten von The Space Devs, OpenStreetMap und unpkg.com geladen (IP-Übermittlung). Gehostet via GitHub Pages.
