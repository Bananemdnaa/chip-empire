/* Chip Empire – Plinko: Kugel fällt durch 12 Nagelreihen in Fächer mit Multiplikatoren */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt;
var NS = 'http://www.w3.org/2000/svg';
var ROWS = 12, SP = 40, CX = 300, TOP = 46, DY = 34;
/* Multiplikatoren je Risiko (symmetrisch, 13 Fächer); Auszahlungsquote jeweils etwa 99 % */
var RISK = {
  low: { name: 'Niedrig', m: [10, 3, 1.6, 1.4, 1.1, 1, 0.5] },
  mid: { name: 'Mittel', m: [33, 11, 4, 2, 1.1, 0.6, 0.3] },
  high: { name: 'Hoch', m: [170, 24, 8.1, 2, 0.7, 0.2, 0.2] }
};
function mults(risk) { var h = RISK[risk].m; return h.concat(h.slice(0, -1).reverse()); }

var root, svg, ballsG, buckets = [], bet, dropBtn, riskBtns = {}, msgEl, histEl;
var inFlight = 0, hist = [];

function node(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
function pegX(r, j) { return CX + (j - (r + 2) / 2) * SP; }
function bucketY() { return TOP + ROWS * DY + 18; }

function build() {
  root = V.$('#g-plinko');
  svg = node('svg', { viewBox: '0 0 600 ' + (bucketY() + 34), class: 'plinko-board', 'aria-hidden': 'true' });
  for (var r = 0; r < ROWS; r++) for (var j = 0; j < r + 3; j++) svg.appendChild(node('circle', { cx: pegX(r, j), cy: TOP + r * DY, r: 4.2, class: 'peg' }));
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
  root.appendChild(el('p', { class: 'fine', text: 'Du kannst mehrere Kugeln nacheinander fallen lassen. Höheres Risiko: größere Ränder, aber mehr Fächer unter 1×. Auszahlungsquote bei allen Stufen etwa 99 %.' }));
  V.busyFns.push(function () { return inFlight > 0; });
  setRisk(V.S.plinkoRisk || 'mid', true);
}

function setRisk(key, quiet) {
  if (inFlight > 0) { V.toast('Warte, bis alle Kugeln gelandet sind.', 'bad'); return; }
  V.S.plinkoRisk = key;
  Object.keys(riskBtns).forEach(function (k) { riskBtns[k].setAttribute('aria-selected', String(k === key)); riskBtns[k].setAttribute('aria-checked', String(k === key)); });
  var m = mults(key);
  buckets.forEach(function (b, i) {
    b.querySelector('text').textContent = String(m[i]).replace('.', ',') + (m[i] >= 100 ? '' : '×');
    b.setAttribute('class', 'pk-b ' + (m[i] >= 10 ? 'hot' : m[i] >= 2 ? 'warm' : m[i] >= 1 ? 'mild' : 'cold'));
  });
  if (!quiet) { V.Snd.click(); V.save(); }
}

/* Ein Ball: Weg vorher würfeln, dann Punkt für Punkt mit kleinen Hüpfern animieren */
function drop() {
  var S = V.S, b0 = S.bets.plinko, risk = S.plinkoRisk || 'mid';
  if (S.balance < b0) { V.needChips(); return; }
  if (inFlight >= 8) return;
  V.Snd.ensure();
  V.debit(b0, true);
  inFlight++; bet.disable(true); V.hud();
  var rights = 0, pts = [[CX, 8]];
  for (var r = 0; r < ROWS; r++) {
    pts.push([CX + (rights - r / 2) * SP, TOP + r * DY - 10]);
    if (E.rand() < 0.5) rights++;
  }
  pts.push([CX + (rights - ROWS / 2) * SP, bucketY() - 4]);
  var ball = node('circle', { r: 8, class: 'pk-ball', cx: CX, cy: 8 });
  ballsG.appendChild(ball);
  var seg = 0, t0 = performance.now(), D = 95;
  (function step(now) {
    var k = Math.min(1, (now - t0) / D), a = pts[seg], b = pts[seg + 1];
    var x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k * k - Math.sin(Math.PI * k) * 6;
    ball.setAttribute('cx', x.toFixed(1)); ball.setAttribute('cy', y.toFixed(1));
    if (k >= 1) {
      seg++; t0 = now;
      if (seg < pts.length - 1) { if (seg > 1) V.Snd.tick(); }
      else return land(ball, rights, b0, risk);
    }
    V.frame(step);
  })(t0);
}

function land(ball, k, b0, risk) {
  var m = mults(risk)[k], ret = V.payout(b0, m);
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
  if (k === 'r') { var keys = Object.keys(RISK), i = keys.indexOf(V.S.plinkoRisk || 'mid'); setRisk(keys[(i + 1) % keys.length]); return true; }
  return false;
}

V.games.push({
  id: 'plinko', init: build, onKey: onKey,
  keys: [['Leertaste', 'Kugel fallen lassen (auch mehrmals)'], ['↑ / ↓', 'Einsatz ändern'], ['R', 'Risiko wechseln']],
  onRoom: function () { bet.render(); }, refresh: function () { if (!inFlight) bet.render(); }
});
})();
