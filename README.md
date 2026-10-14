# Chip Empire

Ein Browser-Casinospiel mit Spielgeld und 11 Spielen: Slots, Glücksrad, Würfel, Roulette, Entenrennen, Plinko, Crash, Dragon Tower, Blackjack, Hi-Lo-Leiter und Tresorknacker. Steig durch die Lounges auf, sammle Comps und baue dein Chip-Imperium.

**Spielen:** https://bananemdnaa.github.io/chip-empire/

## Spielmodi

- **Karriere**: Start mit 1.000 Chips, kein Gratis-Nachschub. Spiele werden mit den Stufen freigeschaltet (Lobby: Slots, Glücksrad, Würfel · Bronze: Roulette, Entenrennen, Plinko · Silver: Crash, Dragon Tower · Gold: Blackjack, Hi-Lo-Leiter · Platinum: Tresorknacker). Wer pleite ist, bekommt alle 10 Minuten einen Notgroschen, dazu gibt es einen Tagesbonus mit Serie. Comps sind ein Anteil des Hausvorteils (10 bis 35 % je Raum), damit bleibt jedes Spiel auf Dauer ein Minus.
- **Legende** (nur Karriere): Im Black Room ab 25 Mio. Chips (jeder weitere Stern 25 Mio. mehr) kannst du zur Legende aufsteigen. Chips, Räume, Umsatz und Comps gehen zurück auf Anfang, Level, Talente, Quests und Statistik bleiben. Pro Stern gibt es 2 Talentpunkte, dauerhaft +10 % XP und +5 % Comps sowie den Legenden-Ast im Talentbaum. Die Karriere-Bestenliste sortiert zuerst nach Sternen. In Karriere- und Imperium-Rangliste zählt pro Konto nur der beste Spielstand.
- **Sitzung**: Nach 10, 25, 50 und 100 Runden in einer Sitzung öffnet sich eine Truhe mit Zufallsbelohnung, alle 10 Minuten Spielzeit gibt es einen Gratis-Dreh (höchstens 6 pro Sitzung). Einsätze lassen sich frei eintippen (auch „10k“ oder „1,5 Mio“), All-in setzt alle Chips.
- **Blitze und Bonus-Runden**: Roulette hat Blitz-Zahlen (50:1 bis 500:1, normale Einzelzahl 29:1), Würfel eine Blitz-Summe (×2 bis ×5). Seltene Ereignisse: Goldener Dreh in Slots (Gewinne ×2), Doppel-Rakete in Crash, Goldkugel in Plinko, Goldfelder im Dragon Tower. Die Grundquoten sind so angepasst, dass die Auszahlungsquoten gleich bleiben.
- **Wochen-Saison**: Eigene Bestenliste mit dem Gewinn aus allen Karriere-Runden seit Montag, alle Spielstände eines Kontos zusammengezählt. Die Top 10 der Vorwoche bekommen beim nächsten Spielstart einmal pro Konto Talentpunkte (Platz 1: 5, Platz 2: 3, Platz 3: 2, sonst 1).
- **Imperium**: Karriere-Regeln plus Geschäfte vom Kiosk bis zum eigenen Casino. Sie verdienen Chips pro Stunde, auch offline, gesammelt im Tresor. Eigene Bestenliste nach Imperiumswert.
- **Sandbox**: Alle Räume und Spiele offen, unbegrenzt Nachschub.

**Fortschritt (in allen Modi):**
- **Talentbaum**: Jede Runde gibt Erfahrung, jedes Level einen Talentpunkt. Vier Äste (Glück, Taktik, Risiko, Business), dazu der Legenden-Ast in der Karriere, mit Talenten für alle Spiele, jedes Talent braucht das vorherige im Ast. Alle Boni halten jedes Spiel unter 100 % Auszahlung. Neu verteilen kostet Chips.
- **Meisterschaft**: Jedes Spiel hat eigene Ränge nach gespielten Runden: Bronze 50, Silber 200, Gold 600, Platin 1.500, Diamant 4.000 (Diamant bringt einen Titel). Das Abzeichen steht neben dem Spieltitel, die Übersicht im Reiter „Meisterschaft“. Ränge bleiben auch als Legende, in der Sandbox sind alle Varianten sofort offen. Freigeschaltete Varianten:
  - Dragon Tower, Silber: Himmelsturm mit 12 Etagen
  - Tresorknacker, Silber: 6×6 Fächer · Platin: 7×7 Fächer
  - Hi-Lo-Leiter, Silber: Farbe raten (1,96×) · Gold: gleicher Rang (12,73×)
  - Plinko, Gold: Risiko Extrem mit 500× am Rand

  Auszahlungsquoten der Varianten (nachgerechnet, mit den stärksten passenden Talenten): Tower und Tresor höchstens 98 % bei jeder Etage, jeder Alarmzahl und jedem Ausstiegspunkt (97 % plus Talent 1 %; der Multiplikator hängt nur von den geschafften Etagen/Fächern ab, nicht von der Größe). Hi-Lo-Zusatztipps 98 % pro Sprosse, mit Kartenzähler 99 %. Plinko Extrem 97,7 % mit Goldkugel, mit „Glatte Nägel“ 98,5 % (Simulation mit 12 Mio. Kugeln: 98,1 % ± 0,3 %).
- **Quests**: drei Daily Quests pro Tag, drei Weekly Quests pro Woche (Truhe mit Talentpunkt) und dauerhafte Meilensteine in Stufen.
- **Arena** (mit Konto, Taste `P`): Duelle gegen Freunde, beliebige Spieler oder als offene Herausforderung, in drei Spielen: Crash (10 Runden, dieselben Absturzpunkte), Dragon Tower (10 Türme mit denselben Drachen) und Blackjack (8 Hände aus demselben Kartenschuh; Ziehen, Halten, Verdoppeln). Beide starten mit 1.000 Duell-Chips, der Kontostand spielt keine Rolle. Der Server rechnet jedes Ergebnis aus dem Protokoll nach. Siege bringen Elo-Punkte für die Duell-Rangliste. Spielerprofile öffnen sich per Klick auf einen Namen in den Bestenlisten.
- **Freunde** (in der Arena): Spieler per Namensanfang suchen, Anfragen senden, annehmen, ablehnen oder zurückziehen. Neue Anfragen und angenommene Anfragen werden gemeldet, auch im Hauptmenü. Freunde, die gerade spielen, sind grün markiert.

Das Hauptmenü hat fünf Bereiche: Spielen (Spielstände), Arena, Freunde, Ranglisten und Profil. Am Handy sitzt die Navigation unten. Bis zu 3 Spielstände pro Browser. Alles läuft lokal im Browser, die Spielstände liegen im `localStorage`. Es gibt kein echtes Geld und keine Auszahlungen.

## Steuerung

Alles geht mit Maus oder Finger. Am PC zusätzlich per Tastatur, `?` im Spiel zeigt alle Kürzel:
`1`–`0` Spiel wechseln, `Leertaste` drehen/austeilen/einsteigen, `↑`/`↓` Einsatz, Blackjack mit `K` Karte, `H` Halten, `V` Verdoppeln, `T` Teilen, `A` Aufgeben.

## Online-Konten (Supabase)

Login per Benutzername und Passwort, Spielstände in der Cloud, Bestenlisten (Karriere, Imperium, Duelle), Freunde und Duelle. Im Profil lässt sich das Konto samt allen Online-Daten löschen.
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
| `js/mastery.js` | Meisterschaft pro Spiel: Ränge, Freischaltungen, Abzeichen, Übersicht |
| `js/slots.js`, `roulette.js`, `blackjack.js`, `crash.js`, `wheel.js`, `dice.js`, `ducks.js`, `plinko.js`, `tower.js`, `hilo.js`, `vault.js` | Die elf Spiele |
| `js/tracker.js` | Gewinn und Verlust: Sitzungsbilanz, Rundenbeträge, letzte Runden |
| `js/legend.js` | Legende (Prestige) und Wochen-Saison |
| `js/chipbets.js` | Gemeinsamer Chip-Tisch für Spiele mit mehreren Wettfeldern |
| `css/games2.css` | Glücksrad, Würfel, Entenrennen, Plinko, Dragon Tower |
| `css/games3.css` | Tresorknacker, Hi-Lo-Leiter, Dragon-Tower-Goldfelder, Meisterschaft |
| `css/polish.css` | Gewinn/Verlust-Anzeigen, Bilanz-Fenster, Legende, Handy-Feinschliff |
| `css/social.css` | Arena, Duell-Fenster, Spielerprofile |
| `js/side.js` | Seitenpanel: Stufen, Meisterschaft, Profil, Statistik, Einstellungen |
| `js/menu.js` | Hauptmenü mit Bereichen: Spielen, Arena, Freunde, Ranglisten, Profil |
| `js/social.js` | Arena: Duelle, Freunde, Duell-Rangliste, Spielerprofile |
| `js/friends.js` | Freundesystem: Liste, Anfragen, Spielersuche, Benachrichtigungen |
| `js/duel.js` | Duelle: Fenster, Regeln und Ansicht für Crash, Dragon Tower und Blackjack, Fortsetzen nach Neuladen |
| `js/main.js` | Start und Navigation |
