# Chip Empire

Ein Browser-Casinospiel mit Spielgeld: Slots, Roulette, Blackjack und Crash. Steig durch die Lounges auf, sammle Comps und baue dein Chip-Imperium.

**Spielen:** https://bananemdnaa.github.io/chip-empire/

## Spielmodi

- **Karriere**: Start mit 1.000 Chips, kein Gratis-Nachschub. Spiele werden mit den Stufen freigeschaltet (Lobby: Slots, Bronze: Roulette, Silver: Crash, Gold: Blackjack). Wer pleite ist, bekommt alle 10 Minuten einen Notgroschen, dazu gibt es einen Tagesbonus mit Serie.
- **Imperium**: Karriere-Regeln plus Geschäfte vom Kiosk bis zum eigenen Casino. Sie verdienen Chips pro Stunde, auch offline, gesammelt im Tresor. Eigene Bestenliste nach Imperiumswert.
- **Sandbox**: Alle Räume und Spiele offen, unbegrenzt Nachschub.

**Fortschritt (in allen Modi):**
- **Talentbaum**: Jede Runde gibt Erfahrung, jedes Level einen Talentpunkt. Drei Äste (Glück, Taktik, Business), jedes Talent braucht das vorherige im Ast. Neu verteilen kostet Chips.
- **Quests**: drei Daily Quests pro Tag, drei Weekly Quests pro Woche (Truhe mit Talentpunkt) und dauerhafte Meilensteine in Stufen.

Bis zu 3 Spielstände pro Browser, verwaltet im Hauptmenü. Alles läuft lokal im Browser, die Spielstände liegen im `localStorage`. Es gibt kein echtes Geld und keine Auszahlungen.

## Steuerung

Alles geht mit Maus oder Finger. Am PC zusätzlich per Tastatur, `?` im Spiel zeigt alle Kürzel:
`1`–`4` Spiel wechseln, `Leertaste` drehen/austeilen/einsteigen, `↑`/`↓` Einsatz, Blackjack mit `K` Karte, `H` Halten, `V` Verdoppeln, `T` Teilen, `A` Aufgeben.

## Online-Konten (Supabase)

Login per Benutzername und Passwort, Spielstände in der Cloud, Bestenliste für den Karriere-Modus.
Das Datenbank-Schema liegt in `supabase/migrations/`. Jede Datei wird einmal (in Reihenfolge) im SQL-Editor von Supabase ausgeführt.
In Supabase muss unter Authentication der E-Mail-Login an und „Confirm email“ aus sein.

## Lokal starten

`index.html` im Browser öffnen reicht meistens.

Wegen der getrennten Dateien lieber über einen kleinen lokalen Server, z.B.:

```bash
py -3 -m http.server 8765
```

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst der Seite |
| `css/style.css` | Grund-Styling der Spiele und Seitenfenster |
| `css/games.css` | Slot-Automat, Tastenkürzel, Tasten-Hilfe |
| `css/tables.css` | Blackjack-Tisch, Roulette-Rad und -Chips, Crash-Himmel |
| `css/meta.css` | Talentbaum, Quests, Imperium, Hinweis-Punkte |
| `css/host.css` | Gastgeberin rechts: Porträt, Chat-Blase, Beziehung, Aufregung, Raum |
| `css/shell.css` | Rahmen: Titelbildschirm, Spiel-HUD, Seitenleiste, Fenster |
| `js/engine.js` | Reine Spiellogik (Zufall, Stufen, Slots, Roulette, Blackjack, Crash, Profil) |
| `js/art.js` | Porträts der Gastgeberinnen als SVG |
| `js/icons.js` | Icons als Inline-SVG |
| `js/store.js` | Spielstände (Slots) im Browser-Speicher |
| `js/cloud.js` | Online-Konten, Cloud-Spielstände und Bestenliste über Supabase |
| `js/core.js` | Zustand, Speichern, Karriere-Regeln, Ton, HUD, Gastgeberin, Einsatz-Steuerung |
| `js/meta.js` | Level, Talentbaum, Quests, Imperium |
| `js/slots.js`, `roulette.js`, `blackjack.js`, `crash.js` | Die vier Spiele |
| `js/side.js` | Seitenpanel: Stufen, Profil, Statistik, Hinter den Kulissen |
| `js/menu.js` | Hauptmenü |
| `js/main.js` | Start und Navigation |
