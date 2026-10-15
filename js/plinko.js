/* Chip Empire – Plinko: Kugel fällt durch 12 Nagelreihen in Fächer mit Multiplikatoren */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt;
var NS = 'http://www.w3.org/2000/svg';
var ROWS = 12, SP = 40, CX = 300, TOP = 46, DY = 34;
/* Multiplikatoren je Risiko (symmetrisch, 13 Fächer); Auszahlungsquote jeweils etwa 99 % */
var RISK = {
  low: { name: 'Niedrig', m: [10, 3, 1.6, 1.4, 1.1, 1, 0.45] },
  mid: { name: 'Mittel', m: [33, 11, 4, 2, 1.1, 0.6, 0.25] },
  high: { name: 'Hoch', m: [170, 24, 8.1, 2, 0.7, 0.2, 0.15] },
  /* Ab Meisterschaft Gold: fast alles unter 1×, dafür 500× am Rand (Quote etwa 97,7 % mit Goldkugel) */
  extreme: { name: 'Extrem', key: 'extreme', m: [500, 48, 5.5, 1.2, 0.3, 0.1, 0.1] }
};
function riskOpen(k) { return !!RISK[k] && (!RISK[k].key || V.mastery.has('plinko', RISK[k].key)); }
function curRisk() { var k = V.S.plinkoRisk; return riskOpen(k) ? k : 'mid'; }
function mults(risk) { var h = RISK[risk].m; return h.concat(h.slice(0, -1).reverse()); }

var root, svg, ballsG, buckets = [], pegs = [], bet, dropBtn, riskBtns = {}, msgEl, histEl;
var inFlight = 0, hist = [];

function node(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
function pegX(r, j) { return CX + (j - (r + 2) / 2) * SP; }
function bucketY() { return TOP + ROWS * DY + 18; }

function build() {
  root = V.$('#g-plinko');
  svg = node('svg', { viewBox: '0 0 600 ' + (bucketY() + 34), class: 'plinko-board', 'aria-hidden': 'true' });
  for (var r = 0; r < ROWS; r++) {
    pegs.push([]);
    for (var j = 0; j < r + 3; j++) { var pg = node('circle', { cx: pegX(r, j), cy: TOP + r * DY, r: 4.2, class: 'peg' }); pegs[r].push(pg); svg.appendChild(pg); }
  }
  /* Fächer direkt im Brett, damit sie immer unter der letzten Nagelreihe sitzen */
  for (var k = 0; k <= ROWS; k++) {
    var x = CX + (k - ROWS / 2) * SP;
    var g = node('g', { class: 'pk-b' });
    g.appendChild(node('rect', { x: x - 18, y: bucketY() - 2, width: 36, height: 28, rx: 6 }));
    var t = node('text', { x: x, y: bucketY() + 16.5, 'text-anchor': 'middle' });
    g.appendChild(t);
    buckets.push(g); svg.appendChild(g);
  }
  ballsG = node('g', {});
  svg.appendChild(ballsG);
  var board = el('div', { class: 'pk-wrap' }, svg);

  bet = V.betControl('plinko');
  var risk = el('div', { class: 'qseg pk-risk', role: 'radiogroup', 'aria-label': 'Risiko' });
  Object.keys(RISK).forEach(function (key) {
    riskBtns[key] = el('button', { type: 'button', role: 'radio', onclick: function () { setRisk(key); } }, RISK[key].name);
    risk.appendChild(riskBtns[key]);
  });
  dropBtn = el('button', { class: 'btn gold big', type: 'button', onclick: drop }, 'Kugel fallen lassen', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Jede Kugel prallt zwölfmal zufällig nach links oder rechts. Die Ränder sind selten, zahlen aber am meisten.' });
  histEl = el('div', { class: 'fw-hist', 'aria-label': 'Letzte Fächer' });
  root.appendChild(el('div', { class: 'pk-layout' }, board,
    el('div', { class: 'pk-side' }, el('span', { class: 'lbl', text: 'Risiko' }), risk, bet.el, dropBtn, histEl, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Du kannst mehrere Kugeln nacheinander fallen lassen. Höheres Risiko: größere Ränder, aber mehr Fächer unter 1×. Auszahlungsquote bei allen Stufen etwa 99 %, beim Risiko Extrem (ab Meisterschaft Gold) etwa 98 %. Die Goldkugel kommt höchstens alle 20 Sekunden. Weil Plinko so schnell geht, zählt eine Kugel für Erfahrung und Sitzungs-Truhen nur zu einem Drittel.' }));
  V.busyFns.push(function () { return inFlight > 0; });
  setRisk(V.S.plinkoRisk || 'mid', true);
}

function renderRiskBtns(key) {
  Object.keys(riskBtns).forEach(function (k) {
    var b = riskBtns[k], lockd = !riskOpen(k);
    b.setAttribute('aria-selected', String(k === key)); b.setAttribute('aria-checked', String(k === key));
    b.classList.toggle('lockd', lockd);
    b.textContent = (lockd ? '🔒 ' : '') + RISK[k].name;
    b.title = lockd ? V.mastery.lockText('plinko', RISK[k].key) : '';
  });
}

function setRisk(key, quiet) {
  if (inFlight > 0) { V.toast('Warte, bis alle Kugeln gelandet sind.', 'bad'); return; }
  if (!riskOpen(key)) { if (quiet) key = 'mid'; else { V.mastery.locked('plinko', RISK[key].key); return; } }
  V.S.plinkoRisk = key;
  renderRiskBtns(key);
  var m = mults(key);
  buckets.forEach(function (b, i) {
    b.querySelector('text').textContent = String(m[i]).replace('.', ',') + (m[i] >= 100 ? '' : '×');
    b.setAttribute('class', 'pk-b ' + (m[i] >= 10 ? 'hot' : m[i] >= 2 ? 'warm' : m[i] >= 1 ? 'mild' : 'cold'));
  });
  if (!quiet) { V.Snd.click(); V.save(); }
}

/* Goldkugel: im Schnitt jede 80. Kugel zahlt doppelt (das mittlere Fach zahlt dafür etwas weniger).
   Höchstens eine alle 20 Sekunden und nie zwei gleichzeitig: Wer viele Kugeln auf einmal fallen lässt,
   bekommt so nicht öfter eine als jemand, der ruhig spielt. */
var GOLD_P = 1 / 80, GOLD_GAP = 20000, lastGold = 0, goldFlying = false;
function rollGold() {
  if (goldFlying || Date.now() - lastGold < GOLD_GAP || E.rand() >= GOLD_P) return false;
  lastGold = Date.now(); goldFlying = true;
  return true;
}

/* Ein Ball: Weg vorher würfeln, dann von Nagel zu Nagel springen lassen.
   Die Kugel setzt oben auf jedem Nagel auf, leicht zu der Seite, nach der sie abprallt,
   springt in einem kleinen Bogen weiter und wird mit jeder Reihe schneller. */
var BR = 8;
function drop() {
  var S = V.S, b0 = S.bets.plinko, risk = curRisk();
  if (S.balance < b0) { V.needChips(); return; }
  if (inFlight >= 8) return;
  V.Snd.ensure();
  V.debit(b0, true);
  inFlight++; bet.disable(true); V.hud();
  var gold = rollGold(), r0 = gold ? 10 : BR, touch = r0 + 4.2;
  var rights = 0, segs = [], prev = [CX + (E.rand() - 0.5) * 4, 4];
  for (var r = 0; r < ROWS; r++) {
    var right = E.rand() < 0.5, px = CX + (rights - r / 2) * SP;
    var cur = [px + (right ? 1 : -1) * (2 + E.rand() * 2.5), TOP + r * DY - touch];
    segs.push({ a: prev, b: cur, peg: pegs[r][rights + 1], h: r === 0 ? 0 : 4 + E.rand() * 6, d: r === 0 ? 200 : Math.max(76, 126 - r * 4.5) });
    prev = cur;
    if (right) rights++;
  }
  segs.push({ a: prev, b: [CX + (rights - ROWS / 2) * SP + (E.rand() - 0.5) * 6, bucketY() + 4], h: 5, d: 120 });
  var ball = node('circle', { r: r0, class: 'pk-ball' + (gold ? ' gold' : ''), cx: segs[0].a[0], cy: segs[0].a[1] });
  if (gold) V.event('gold', '✨ GOLDKUGEL ✨', 'Diese Kugel zahlt doppelt');
  ballsG.appendChild(ball);
  var seg = 0, t0 = performance.now();
  (function step(now) {
    var g = segs[seg], k = Math.min(1, (now - t0) / g.d);
    /* waagerecht gleichmäßig, senkrecht erst ein kurzer Hüpfer nach oben, dann immer schneller fallen */
    var x = g.a[0] + (g.b[0] - g.a[0]) * k, y = g.a[1] + (g.b[1] - g.a[1]) * k * k - g.h * 4 * k * (1 - k) * (1 - k);
    ball.setAttribute('cx', x.toFixed(1)); ball.setAttribute('cy', y.toFixed(1));
    if (k >= 1) {
      if (g.peg) pegHit(g.peg);
      seg++; t0 = now;
      if (seg < segs.length) { if (seg > 1) V.Snd.tick(); }
      else { if (gold) goldFlying = false; return land(ball, rights, b0, risk, gold); }
    }
    V.frame(step);
  })(t0);
}
/* Getroffener Nagel leuchtet kurz auf */
function pegHit(p) { p.setAttribute('class', 'peg'); void p.getBBox(); p.setAttribute('class', 'peg hit'); }

function land(ball, k, b0, risk, gold) {
  /* Talent Glatte Nägel: Fächer ab 2× zahlen etwas mehr */
  var m = mults(risk)[k], ret = V.payout(b0, (m >= 2 ? m * (1 + V.meta.perk('plinkoSmooth')) : m) * (gold ? 2 : 1));
  if (gold) { V.burst(V.$('#g-plinko .pk-wrap'), 40, ['#FFF3C9', '#F2D68E', '#D4AB52']); V.banner('✨ Goldkugel', String(m).replace('.', ',') + '× doppelt · +' + V.fmt(ret - b0) + ' Chips', { kind: 'win', ms: 2400 }); }
  setTimeout(function () { if (ball.parentNode) ball.parentNode.removeChild(ball); }, 250);
  var bk = buckets[k];
  var base = bk.getAttribute('class').replace(' hit', '');
  bk.setAttribute('class', base); void bk.getBBox(); bk.setAttribute('class', base + ' hit');
  inFlight--;
  V.settle('plinko', b0, ret, { plinkoMult: m, plinkoEdge: k === 0 || k === ROWS });
  hist.push(m);
  histEl.innerHTML = '';
  hist.slice(-12).reverse().forEach(function (x) { histEl.appendChild(el('span', { class: x >= 2 ? 'dbl' : '', text: String(x).replace('.', ',') + '×' })); });
  var net = ret - b0;
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = 'Fach ' + String(m).replace('.', ',') + '×: ' + (net >= 0 ? '+' : '−') + fmt(Math.abs(net)) + ' Chips';
  if (m >= 10) { V.Snd.big(); V.burst(V.$('#g-plinko .pk-wrap'), 26); V.banner(String(m).replace('.', ',') + '×!', '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2200 }); }
  else if (m >= 1.5) V.Snd.win(); else if (m < 1) V.Snd.lose(); else V.Snd.card();
  if (!inFlight) bet.disable(false);
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { drop(); return true; }
  if ((k === 'arrowup' || k === '+') && !inFlight) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !inFlight) { bet.step(-1); return true; }
  if (k === 'r') { var keys = Object.keys(RISK).filter(riskOpen), i = keys.indexOf(curRisk()); setRisk(keys[(i + 1) % keys.length]); return true; }
  return false;
}

V.games.push({
  id: 'plinko', init: build, onKey: onKey,
  keys: [['Leertaste', 'Kugel fallen lassen (auch mehrmals)'], ['↑ / ↓', 'Einsatz ändern'], ['R', 'Risiko wechseln']],
  onRoom: function () { bet.render(); }, onMastery: function () { renderRiskBtns(curRisk()); }, refresh: function () { if (!inFlight) bet.render(); }
});
})();
