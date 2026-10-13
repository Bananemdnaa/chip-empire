/* Chip Empire – Glücksrad: Chips auf Multiplikator-Felder setzen, das Rad entscheidet */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var NS = 'http://www.w3.org/2000/svg';

/* 51 Felder: Anzahl × Multiplikator ergibt je Feld 94–98 % Auszahlung */
var FIELDS = [
  { key: 'x2', mult: 2, count: 24, color: '#5B7FA8', label: '2×' },
  { key: 'x4', mult: 4, count: 12, color: '#2E9E6C', label: '4×' },
  { key: 'x6', mult: 6, count: 8, color: '#8E4AC4', label: '6×' },
  { key: 'x12', mult: 12, count: 4, color: '#E07A2E', label: '12×' },
  { key: 'x25', mult: 25, count: 2, color: '#C4203F', label: '25×' },
  { key: 'x50', mult: 50, count: 1, color: '#D4AB52', label: '50×' }
];
var F_BY = {}; FIELDS.forEach(function (f) { F_BY[f.key] = f; });
/* Felder gleichmäßig verteilen: jedes Feld bekommt Positionen im Abstand 1/count, dann nach Position sortieren */
var SEQ = (function () {
  var items = [];
  FIELDS.forEach(function (f, fi) { for (var i = 0; i < f.count; i++) items.push({ key: f.key, pos: (i + 0.5 + fi * 0.137) / f.count }); });
  items.sort(function (a, b) { return a.pos - b.pos; });
  return items.map(function (x) { return x.key; });
})();
var N = SEQ.length;

var root, rot, badge, tiles = {}, spinBtn, msgEl, histEl, table;
var angle = 0, spinning = false, hist = [];

function wheelSvg() {
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 300'); svg.setAttribute('aria-hidden', 'true');
  var cx = 150, cy = 150, R = 140, r = 52, d = 360 / N;
  function pt(rad, deg) { var a = deg * Math.PI / 180; return [cx + rad * Math.sin(a), cy - rad * Math.cos(a)]; }
  function node(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  svg.appendChild(node('circle', { cx: cx, cy: cy, r: 148, fill: '#2A1208', stroke: '#D4AB52', 'stroke-width': 3 }));
  SEQ.forEach(function (key, i) {
    var f = F_BY[key], a0 = i * d, a1 = (i + 1) * d;
    var p0 = pt(R, a0), p1 = pt(R, a1), q1 = pt(r, a1), q0 = pt(r, a0);
    svg.appendChild(node('path', { d: 'M' + p0.join(' ') + ' A' + R + ' ' + R + ' 0 0 1 ' + p1.join(' ') + ' L' + q1.join(' ') + ' A' + r + ' ' + r + ' 0 0 0 ' + q0.join(' ') + ' Z',
      fill: f.color, stroke: '#1A0A04', 'stroke-width': 0.8 }));
    var mid = (i + 0.5) * d, tp = pt(118, mid);
    var t = node('text', { x: tp[0].toFixed(2), y: (tp[1] + 3.5).toFixed(2), 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 800, 'font-family': 'IBM Plex Mono, monospace',
      fill: '#fff', transform: 'rotate(' + mid.toFixed(2) + ' ' + tp[0].toFixed(2) + ' ' + tp[1].toFixed(2) + ')' });
    t.textContent = String(f.mult);
    svg.appendChild(t);
  });
  /* Stifte am Rand */
  for (var j = 0; j < N; j++) { var pp = pt(143, j * d); svg.appendChild(node('circle', { cx: pp[0].toFixed(2), cy: pp[1].toFixed(2), r: 2.2, fill: '#F2D68E' })); }
  svg.appendChild(node('circle', { cx: cx, cy: cy, r: r, fill: '#1A0A10', stroke: '#D4AB52', 'stroke-width': 3 }));
  return svg;
}

function build() {
  root = V.$('#g-wheel');
  rot = el('div', { class: 'fw-rot' }); rot.appendChild(wheelSvg());
  badge = el('div', { class: 'fw-badge', text: '?' });
  var wheel = el('div', { class: 'fw-wheel' }, rot, el('div', { class: 'fw-pointer' }), badge);
  histEl = el('div', { class: 'fw-hist', 'aria-label': 'Letzte Ergebnisse' });

  table = V.chipBets({ onRender: renderTiles });
  var grid = el('div', { class: 'fw-fields' });
  FIELDS.forEach(function (f) {
    var t = el('button', { class: 'fw-field', type: 'button', 'aria-label': 'Auf ' + f.label + ' setzen', onclick: function () { table.place(f.key); },
      oncontextmenu: function (e) { e.preventDefault(); } },
      el('b', { text: f.label }), el('small', { text: f.count + ' von ' + N + ' Feldern' }), el('span', { class: 'rchip', hidden: true }));
    t.style.setProperty('--fc', f.color);
    tiles[f.key] = t; grid.appendChild(t);
  });
  spinBtn = el('button', { class: 'btn gold big', type: 'button', onclick: spin }, 'Rad drehen', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Setz Chips auf ein oder mehrere Felder. Landet der Zeiger dort, zahlt das Feld seinen Multiplikator.' });
  root.appendChild(el('div', { class: 'fw-layout' },
    el('div', { class: 'fw-left' }, wheel, histEl),
    el('div', { class: 'fw-right' }, grid, table.controls(), spinBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Glücksrad mit 51 Feldern. Je seltener ein Feld, desto höher der Multiplikator. Auszahlungsquote je Feld 94 bis 98 %.' }));
  V.busyFns.push(function () { return spinning || table.total() > 0; });
  renderTiles(table.bets(), false);
}

function renderTiles(bets, locked) {
  FIELDS.forEach(function (f) {
    var t = tiles[f.key]; if (!t) return;
    var amt = bets[f.key] || 0, ch = t.querySelector('.rchip');
    ch.hidden = amt <= 0; ch.textContent = amt > 0 ? V.short(amt) : '';
    t.classList.toggle('has', amt > 0);
    t.disabled = locked;
  });
  if (spinBtn) spinBtn.disabled = locked || table.total() <= 0;
}
function renderHist() {
  histEl.innerHTML = '';
  hist.slice(-12).reverse().forEach(function (k) { var s = el('span', { text: F_BY[k].label }); s.style.background = F_BY[k].color; histEl.appendChild(s); });
}

async function spin() {
  if (spinning) return;
  var bets = table.commit();
  if (!bets) return;
  V.Snd.ensure();
  spinning = true;
  var idx = E.randInt(N), key = SEQ[idx], f = F_BY[key], d = 360 / N;
  /* leicht zufällige Position innerhalb des Feldes, Zeiger oben */
  var jitter = (E.rand() - 0.5) * d * 0.7;
  angle = Math.ceil(angle / 360) * 360 + 360 * 5 - (idx + 0.5) * d + jitter;
  rot.style.transform = 'rotate(' + angle.toFixed(3) + 'deg)';
  badge.textContent = '…'; badge.style.background = '';
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Das Rad dreht sich …';
  var tick = setInterval(function () { V.Snd.tick(); }, 140);
  await sleep(4700);
  clearInterval(tick);
  var stake = 0, ret = 0;
  /* Talent Glücksfee: das 2×-Feld zahlt etwas mehr */
  var mult = f.mult + (key === 'x2' ? V.meta.perk('wheelLuck') : 0);
  for (var k in bets) { stake += bets[k]; if (k === key) ret += V.payout(bets[k], mult); }
  hist.push(key); renderHist();
  badge.textContent = f.label; badge.style.background = f.color;
  tiles[key].classList.add('won');
  V.settle('wheel', stake, ret, { wheelMult: f.mult, wheelHit: ret > 0 });
  var net = ret - stake;
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = 'Ergebnis: ' + f.label + '. ' + (ret > 0 ? 'Zurück: ' + fmt(ret) + ' Chips (' + (net >= 0 ? '+' : '') + fmt(net) + ')' : 'Kein Treffer, ' + fmt(stake) + ' Chips gehen ans Haus.');
  if (ret > 0 && f.mult >= 12) { V.Snd.big(); V.burst(V.$('#g-wheel .fw-wheel'), 30); V.banner(f.label + '!', '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2400 }); }
  else if (net > 0) V.Snd.win(); else V.Snd.lose();
  await sleep(1400);
  tiles[key].classList.remove('won');
  spinning = false;
  table.reset();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { spin(); return true; }
  return spinning ? false : table.onKey(k);
}

V.games.push({
  id: 'wheel', init: build, onKey: onKey,
  keys: [['Leertaste', 'Rad drehen'], ['Maus', 'Chips auf Felder setzen'], ['← / →', 'Chipwert wählen'], ['⌫ / L / W / D', 'Zurück, Leeren, Wiederholen, Verdoppeln']],
  onRoom: function () { table.render(); }, refresh: function () { table.render(); }
});
})();
