# Chip Empire

Ein Browser-Casinospiel mit Spielgeld: Slots, Roulette, Blackjack und Crash. Steig durch die Lounges auf, sammle Comps und baue dein Chip-Imperium.

**Spielen:** https://bananemdnaa.github.io/chip-empire/

## Spielmodi

- **Karriere**: Start mit 1.000 Chips, kein Gratis-Nachschub. Spiele werden mit den Stufen freigeschaltet (Lobby: Slots, Bronze: Roulette, Silver: Crash, Gold: Blackjack). Wer pleite ist, bekommt alle 10 Minuten einen Notgroschen, dazu gibt es einen Tagesbonus mit Serie.
- **Sandbox**: Alle Räume und Spiele offen, unbegrenzt Nachschub.

Bis zu 3 Spielstände pro Browser, verwaltet im Hauptmenü. Alles läuft lokal im Browser, die Spielstände liegen im `localStorage`. Es gibt kein echtes Geld und keine Auszahlungen.

## Online-Konten (Supabase)

Login per Benutzername und Passwort, Spielstände in der Cloud, Bestenliste für den Karriere-Modus.
Das Datenbank-Schema liegt in `supabase/migrations/` und wird einmal im SQL-Editor von Supabase ausgeführt.
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
| `css/style.css` | Styling der Spiele (Slots, Roulette, Blackjack, Crash, Seitenfenster) |
| `css/shell.css` | Rahmen: Titelbildschirm, Spiel-HUD, Seitenleiste, Fenster |
| `js/engine.js` | Reine Spiellogik (Zufall, Stufen, Slots, Roulette, Blackjack, Crash, Profil) |
| `js/art.js` | Hostessen-Porträts als SVG |
| `js/icons.js` | Icons als Inline-SVG |
| `js/store.js` | Spielstände (Slots) im Browser-Speicher |
| `js/cloud.js` | Online-Konten, Cloud-Spielstände und Bestenliste über Supabase |
| `js/core.js` | Zustand, Speichern, Karriere-Regeln, Ton, HUD, Hostess, Einsatz-Steuerung |
| `js/slots.js`, `roulette.js`, `blackjack.js`, `crash.js` | Die vier Spiele |
| `js/side.js` | Seitenpanel: Stufen, Profil, Statistik, Hinter den Kulissen |
| `js/menu.js` | Hauptmenü |
| `js/main.js` | Start und Navigation |
