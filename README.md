# Chip Empire

Ein Browser-Casinospiel mit Spielgeld und 10 Spielen: Slots, Glücksrad, Würfel, Roulette, Entenrennen, Plinko, Crash, Dragon Tower, Blackjack und Video-Poker. Steig durch die Lounges auf, sammle Comps und baue dein Chip-Imperium.

**Spielen:** https://bananemdnaa.github.io/chip-empire/

## Spielmodi

- **Karriere**: Start mit 1.000 Chips, kein Gratis-Nachschub. Spiele werden mit den Stufen freigeschaltet (Lobby: Slots, Glücksrad, Würfel · Bronze: Roulette, Entenrennen, Plinko · Silver: Crash, Dragon Tower · Gold: Blackjack, Video-Poker). Wer pleite ist, bekommt alle 10 Minuten einen Notgroschen, dazu gibt es einen Tagesbonus mit Serie.
- **Imperium**: Karriere-Regeln plus Geschäfte vom Kiosk bis zum eigenen Casino. Sie verdienen Chips pro Stunde, auch offline, gesammelt im Tresor. Eigene Bestenliste nach Imperiumswert.
- **Sandbox**: Alle Räume und Spiele offen, unbegrenzt Nachschub.

**Fortschritt (in allen Modi):**
- **Talentbaum**: Jede Runde gibt Erfahrung, jedes Level einen Talentpunkt. Vier Äste (Glück, Taktik, Risiko, Business) mit Talenten für alle Spiele, jedes Talent braucht das vorherige im Ast. Alle Boni halten jedes Spiel unter 100 % Auszahlung. Neu verteilen kostet Chips.
- **Quests**: drei Daily Quests pro Tag, drei Weekly Quests pro Woche (Truhe mit Talentpunkt) und dauerhafte Meilensteine in Stufen.
- **Arena** (mit Konto, Taste `D`): Crash-Duelle gegen Freunde, beliebige Spieler oder als offene Herausforderung. Beide fliegen dieselben 10 Runden mit denselben Absturzpunkten und starten mit 1.000 Duell-Chips, der Kontostand spielt keine Rolle. Siege bringen Elo-Punkte für die Duell-Rangliste. Spielerprofile öffnen sich per Klick auf einen Namen in den Bestenlisten.
- **Freunde** (in der Arena): Spieler per Namensanfang suchen, Anfragen senden, annehmen, ablehnen oder zurückziehen. Neue Anfragen und angenommene Anfragen werden gemeldet, auch im Hauptmenü. Freunde, die gerade spielen, sind grün markiert.

Das Hauptmenü hat fünf Bereiche: Spielen (Spielstände), Arena, Freunde, Ranglisten und Profil. Am Handy sitzt die Navigation unten. Bis zu 3 Spielstände pro Browser. Alles läuft lokal im Browser, die Spielstände liegen im `localStorage`. Es gibt kein echtes Geld und keine Auszahlungen.

## Steuerung

Alles geht mit Maus oder Finger. Am PC zusätzlich per Tastatur, `?` im Spiel zeigt alle Kürzel:
`1`–`0` Spiel wechseln, `Leertaste` drehen/austeilen/einsteigen, `↑`/`↓` Einsatz, Blackjack mit `K` Karte, `H` Halten, `V` Verdoppeln, `T` Teilen, `A` Aufgeben.

## Online-Konten (Supabase)

Login per Benutzername und Passwort, Spielstände in der Cloud, Bestenlisten (Karriere, Imperium, Duelle), Freunde und Crash-Duelle.
Das Datenbank-Schema liegt in `supabase/migrations/`. Jede Datei wird einmal (in Reihenfolge) im SQL-Editor von Supabase ausgeführt.
Neue Migrationen vor dem Push des passenden Codes ausführen. Sie ergänzen nur, damit Spieler mit noch offenem altem Tab weiterspielen können. Das Spiel prüft alle 5 Minuten, ob eine neue Version online ist, und bietet dann das Neuladen an.
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
| `js/slots.js`, `roulette.js`, `blackjack.js`, `crash.js`, `wheel.js`, `dice.js`, `ducks.js`, `plinko.js`, `tower.js`, `poker.js` | Die zehn Spiele |
| `js/chipbets.js` | Gemeinsamer Chip-Tisch für Spiele mit mehreren Wettfeldern |
| `css/games2.css` | Glücksrad, Würfel, Entenrennen, Plinko, Dragon Tower, Video-Poker |
| `css/social.css` | Arena, Duell-Fenster, Spielerprofile |
| `js/side.js` | Seitenpanel: Stufen, Profil, Statistik, Hinter den Kulissen |
| `js/menu.js` | Hauptmenü mit Bereichen: Spielen, Arena, Freunde, Ranglisten, Profil |
| `js/social.js` | Arena: Duelle, Freunde, Duell-Rangliste, Spielerprofile |
| `js/friends.js` | Freundesystem: Liste, Anfragen, Spielersuche, Benachrichtigungen |
| `js/duel.js` | Crash-Duell (Spielfenster, Protokoll, Fortsetzen nach Neuladen) |
| `js/main.js` | Start und Navigation |
