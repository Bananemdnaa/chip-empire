# Chip Empire

Ein Browser-Casinospiel mit Spielgeld: Slots, Roulette, Blackjack und Crash. Steig durch die Lounges auf, sammle Comps und baue dein Chip-Imperium.

**Spielen:** https://bananemdnaa.github.io/chip-empire/

Alles läuft lokal im Browser, der Spielstand wird im `localStorage` gespeichert. Es gibt kein echtes Geld und keine Auszahlungen.

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
| `css/style.css` | Gesamtes Styling |
| `js/engine.js` | Reine Spiellogik (Zufall, Stufen, Slots, Roulette, Blackjack, Crash, Profil) |
| `js/art.js` | Hostessen-Porträts als SVG |
| `js/core.js` | Zustand, Speichern, Ton, HUD, Hostess, Einsatz-Steuerung |
| `js/slots.js`, `roulette.js`, `blackjack.js`, `crash.js` | Die vier Spiele |
| `js/side.js` | Seitenpanel: Stufen, Profil, Statistik, Hinter den Kulissen |
| `js/main.js` | Start und Navigation |
