/* Chip Empire – Gastspiele und Happy Hour: Alle 6 Stunden wechseln zwei Gastspiele aus einem Pool,
   dazu hat ein bekanntes Spiel Happy Hour (+100 % Erfahrung, Sitzungs-Truhen zählen doppelt).
   Der Plan hängt nur von der Uhrzeit ab (UTC), also sehen alle Spieler dasselbe. Auszahlungsquoten ändern sich nicht. */
(function () {
'use strict';
var el = V.el;
var PERIOD = 6 * 36e5;
/* Reihenfolge im Pool: bei 5 Spielen wechseln die Paare jede Runde, nach 2,5 Tagen beginnt es von vorn */
var POOL = ['limbo', 'keno', 'scratch', 'bacc', 'fruit'];
function guests() { return POOL.filter(function (id) { return V.GAME_BY[id]; }); }
function base() { return V.GAME_LIST.filter(function (g) { return !g.guest; }).map(function (g) { return g.id; }); }
function period(t) { return Math.floor((t || Date.now()) / PERIOD); }
function activeAt(p) { var G = guests(), n = G.length; return n < 2 ? G.slice() : [G[(2 * p) % n], G[(2 * p + 1) % n]]; }
function happyAt(p) { var B = base(); return B[(p * 7 + 3) % B.length]; }
function active() { return activeAt(period()); }
function isActive(id) { return active().indexOf(id) >= 0; }
function happy() { return happyAt(period()); }
function isHappy(id) { return happy() === id; }
function endsAt() { return (period() + 1) * PERIOD; }
function left() { return Math.max(0, endsAt() - Date.now()); }
function next() { return { games: activeAt(period() + 1), happy: happyAt(period() + 1), at: endsAt() }; }
function names(ids) { return ids.map(function (id) { return V.GAME_NAME[id]; }).join(' und '); }
function hm(ms) { var m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h ? h + ' Std. ' + (m % 60) + ' Min.' : m + ' Min.'; }
function at(ts) { return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }

/* Hinweis-Leiste unter dem Spieltitel: Gastspiel oder Happy Hour, mit Restzeit */
function strip() {
  var box = V.$('#rotStrip'); if (!box) return;
  var g = V.S.game, nx = next();
  box.innerHTML = '';
  if (V.GAME_BY[g] && V.GAME_BY[g].guest) {
    box.className = 'rot-strip guest';
    box.appendChild(el('span', { text: '✨ Gastspiel · noch ' + hm(left()) + ' · danach ' + names(nx.games) }));
  } else if (isHappy(g)) {
    box.className = 'rot-strip happy';
    box.appendChild(el('span', { text: '🔥 Happy Hour: +100 % Erfahrung, Truhen-Runden zählen doppelt · noch ' + hm(left()) }));
  } else { box.className = 'rot-strip'; box.hidden = true; return; }
  box.hidden = false;
}

/* Wechsel erkennen: Leiste neu, Meldung, und wer gerade ein ausgelaufenes Gastspiel offen hat, kommt zurück zu den Slots */
var lastP = null;
function tick() {
  var p = period();
  if (lastP !== null && p !== lastP) {
    if (V.renderNav) V.renderNav();
    var g = V.S.game;
    if (V.GAME_BY[g] && V.GAME_BY[g].guest && !V.gameOpen(g) && !V.isBusy()) V.showGame('slots');
    V.banner('✨ Neue Gastspiele', names(active()) + ' sind jetzt da · Happy Hour: ' + V.GAME_NAME[happy()], { kind: 'level', ms: 6000 });
    V.Snd.unlock();
  }
  lastP = p;
  strip();
}

/* Übersicht für die Spielanleitung: jetzt, danach und der restliche Tag */
function plan() {
  var p = period(), rows = [];
  for (var i = 0; i < 4; i++) {
    var q = p + i;
    rows.push({ from: q * PERIOD, games: activeAt(q), happy: happyAt(q), now: i === 0 });
  }
  return rows;
}
function planBox() {
  var box = el('div', { class: 'rot-plan' });
  plan().forEach(function (r) {
    box.appendChild(el('div', { class: 'rp-row' + (r.now ? ' now' : '') },
      el('span', { class: 'rp-t', text: r.now ? 'Jetzt' : 'ab ' + at(r.from) }),
      el('span', {}, el('b', { text: names(r.games) }), el('small', { text: ' · Happy Hour: ' + V.GAME_NAME[r.happy] }))));
  });
  return box;
}

V.rotation = { active: active, isActive: isActive, happy: happy, isHappy: isHappy, left: left, next: next, tick: tick, strip: strip, planBox: planBox, POOL: POOL };
})();
