# derarbeitszeitrechner.de

Kostenloser Arbeitszeit- und Stundenrechner mit den Unterseiten Stundenlohnrechner und Brutto-Netto-Rechner. Läuft komplett im Browser
(keine Server-Datenbank, kein Konto), ausgeliefert über einen Cloudflare Worker mit Static Assets.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/js/core.js` | Rechenkern ohne UI-Abhängigkeit (rechnet in ganzen Minuten) |
| `src/js/config.js` | Rechtswerte mit Gültigkeitsdatum (Mindestlohn, Pausen, Ruhezeit …) |
| `src/js/app.js` | Oberfläche: Tag, Woche, Monat, Feierabend, Addieren, Dezimal, Profile |
| `src/js/store.js` | Speicher im Browser (IndexedDB, Fallback localStorage), JSON-Backup |
| `src/js/export.js` | CSV, Excel (.xlsx) und PDF – wird erst beim Export geladen |
| `src/index.html`, `src/styles.css`, `src/faq.mjs` | Seite, Design, FAQ (auch als strukturierte Daten) |
| `src/stundenlohnrechner.html`, `src/js/lohn.js`, `src/faq-stundenlohn.mjs` | Unterseite `/stundenlohnrechner`: Vorlage, Oberfläche, FAQ. Alle Euro-Beträge im Text setzt der Build aus dem Rechenkern ein |
| `src/site.json` | Betreiberdaten für Impressum/Datenschutz, „Stand“-Datum |
| `src/js/netto.js` | Netto-Rechenkern: Lohnsteuer nach dem amtlichen Programmablaufplan des BMF (2026 endgültig, 2027 Entwurf), Solidaritätszuschlag, Kirchensteuer, Sozialversicherung, Netto → Brutto |
| `src/brutto-netto-rechner.html`, `src/js/bn.js`, `src/faq-brutto-netto.mjs` | Unterseite `/brutto-netto-rechner`: Vorlage, Oberfläche, FAQ. Alle Beträge im Text setzt der Build aus dem Netto-Rechenkern ein |
| `scripts/build.mjs` | Build ohne Abhängigkeiten → `public/` (vorgerendert, CSS inline, Assets mit Hash). Kopf, Fußzeile und Rechner-Navigation aller Seiten kommen aus der Liste `TOOLS` |
| `worker/index.js` | Weiterleitungen (www, derstundenrechner.de → 301), Sicherheits- und Cache-Header |
| `test/core.test.js` | Die 12 Abnahme-Testfälle plus Randfälle, dazu die Testfälle des Stundenlohnrechners |
| `test/netto.test.js` | Amtliche Prüftabellen des BMF (2026 und Entwurf 2027, je 516 Werte) und von Hand nachgerechnete Beiträge |

## Entwickeln

```bash
npm test          # Rechenkern-Tests (Node ≥ 20, keine Installation nötig)
npm run build     # erzeugt public/
npx wrangler dev  # lokal ansehen
```

## Deployen

Jeder Push auf `main` wird von Cloudflare (Workers Builds) automatisch deployt.
`wrangler deploy` führt vorher `node scripts/build.mjs` aus (siehe `wrangler.jsonc`).
Manuell: `npm run deploy`.

## Funktionen über das MVP hinaus (Phase 2)

Tagesarten (Urlaub, Krank, Feiertag, Überstundenabbau), Feiertage je Bundesland, Überstundenkonto mit Startsaldo,
Zuschläge nach § 3b EStG, Gehalt ↔ Stundenlohn, Minijob-Check, Stempeluhr, Teilen-Link (Daten nur im URL-Fragment),
PWA mit Service Worker (`public/sw.js` wird vom Build erzeugt). Alles im Rechenkern getestet (`npm test`).

## Jährliche Pflege

- Neue Rechtswerte in `src/js/config.js` mit `from`-Datum anhängen (z. B. Mindestlohn).
- Netto-Rechner: Sobald das BMF den endgültigen Programmablaufplan für das neue Jahr veröffentlicht, die Werte in
  `TAX_YEARS` (`src/js/netto.js`) mit dem Abschnitt MPARA und dem Tarif (UPTAB) abgleichen, die beiden Prüftabellen
  am Ende des Dokuments in `test/netto.test.js` übernehmen und `draft` auf `false` setzen. `npm test` muss alle
  Tabellenwerte auf den Euro genau treffen. Der Rechner nimmt automatisch die Werte des laufenden Kalenderjahres.
- Stand 26.11.2026: 2027 beruht auf dem Entwurf vom 8.10.2026 und wird im Rechner als „vorläufig“ gekennzeichnet.
  Der Entwurf nennt für die Beitragsbemessungsgrenze der Rentenversicherung im Text 106.240 €, im Ablaufplan
  106.200 €; nur mit 106.200 € stimmen seine Prüftabellen. In der endgültigen Fassung prüfen.
- `stand` in `src/site.json` aktualisieren.
- Texte zum Mindestlohn in `src/index.html` (Abschnitt „Stundenrechner mit Lohn“) prüfen.
