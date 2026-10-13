/* Chip Empire – Europäisches Roulette */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep, short = V.short;
var NS = 'http://www.w3.org/2000/svg';

var root, cellMap = {}, chipsRow, totalEl, msgEl, histEl, hotEl, spinBtn, undoBtn, clearBtn, rebetBtn, dblBtn, neighBtn;
var wheelRot, ballOrbit, resultBadge;
var bets = {}, stack = [], last = {}, spinning = false, resolving = false, neigh = false;
var wheelAngle = 0, ballAngle = 0;
var COLORS = { red: 'Rot', black: 'Schwarz', green: 'Grün' };

function sum(o) { var t = 0; for (var k in o) t += o[k]; return t; }

function wheelSvg() {
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 240 240'); svg.setAttribute('aria-hidden', 'true');
  var cx = 120, cy = 120, R = 114, r = 78, d = 360 / 37;
  function pt(rad, deg) { var a = deg * Math.PI / 180; return [cx + rad * Math.sin(a), cy - rad * Math.cos(a)]; }
  var bg = document.createElementNS(NS, 'circle');
  bg.setAttribute('cx', cx); bg.setAttribute('cy', cy); bg.setAttribute('r', 119); bg.setAttribute('fill', '#2a1a10'); bg.setAttribute('stroke', '#D4AB52'); bg.setAttribute('stroke-width', '3');
  svg.appendChild(bg);
  for (var i = 0; i < 37; i++) {
    var n = E.R_ORDER[i], a0 = i * d, a1 = (i + 1) * d;
    var p0 = pt(R, a0), p1 = pt(R, a1), q1 = pt(r, a1), q0 = pt(r, a0);
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
      ' L' + q1[0].toFixed(2) + ' ' + q1[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 0 0 ' + q0[0].toFixed(2) + ' ' + q0[1].toFixed(2) + ' Z');
    var col = E.rColor(n);
    path.setAttribute('fill', col === 'red' ? '#B3182F' : col === 'black' ? '#15101A' : '#0F6A4A');
    path.setAttribute('stroke', '#D4AB52'); path.setAttribute('stroke-width', '0.8');
    svg.appendChild(path);
    var mid = (i + 0.5) * d, tp = pt(97, mid);
    var t = document.createElementNS(NS, 'text');
    t.setAttribute('x', tp[0].toFixed(2)); t.setAttribute('y', (tp[1] + 3).toFixed(2));
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9.5'); t.setAttribute('font-weight', '700');
    t.setAttribute('font-family', 'IBM Plex Mono, monospace'); t.setAttribute('fill', '#F4EBDB');
    t.setAttribute('transform', 'rotate(' + mid.toFixed(2) + ' ' + tp[0].toFixed(2) + ' ' + tp[1].toFixed(2) + ')');
    t.textContent = String(n);
    svg.appendChild(t);
  }
  var ring = document.createElementNS(NS, 'circle');
  ring.setAttribute('cx', cx); ring.setAttribute('cy', cy); ring.setAttribute('r', 66); ring.setAttribute('fill', '#1a0d10'); ring.setAttribute('stroke', '#D4AB52'); ring.setAttribute('stroke-width', '2');
  svg.appendChild(ring);
  var hub = document.createElementNS(NS, 'path');
  hub.setAttribute('d', 'M120 78 L126 114 L162 120 L126 126 L120 162 L114 126 L78 120 L114 114 Z');
  hub.setAttribute('fill', '#D4AB52'); hub.setAttribute('opacity', '.9');
  svg.appendChild(hub);
  return svg;
}

function build() {
  root = V.$('#g-roulette');
  /* Rad */
  wheelRot = el('div', { class: 'wheel-rot' });
  wheelRot.appendChild(wheelSvg());
  ballOrbit = el('div', { class: 'ball-orbit' }, el('i', { class: 'ball' }));
  resultBadge = el('div', { class: 'result-badge', 'aria-live': 'polite', text: '–' });
  var wheel = el('div', { class: 'wheel' }, wheelRot, ballOrbit, el('div', { class: 'pointer' }), resultBadge);
  histEl = el('div', { class: 'rhist', 'aria-label': 'Letzte Zahlen' });
  hotEl = el('div', { class: 'hotcold' });
  var left = el('div', { class: 'rleft' }, wheel, histEl, hotEl);

  /* Tisch */
  var board = el('div', { class: 'rboard' });
  function cell(key, label, cls, col, row) {
    var c = el('button', { class: 'rcell ' + cls, type: 'button', 'data-key': key, 'aria-label': label.label || label, onclick: function () { onCell(key); },
      oncontextmenu: function (e) { e.preventDefault(); clearSpot(key); } },
      el('span', { class: 'rl', html: label.html || label }), el('span', { class: 'rchip', hidden: true }));
    c.style.gridColumn = col; c.style.gridRow = row;
    board.appendChild(c); cellMap[key] = c;
    return c;
  }
  cell('n0', '0', 'green', '1', '1 / 4');
  for (var n = 1; n <= 36; n++) {
    var col = Math.ceil(n / 3) + 1, row = 3 - ((n - 1) % 3);
    cell('n' + n, String(n), E.rColor(n), String(col), String(row));
  }
  cell('c3', '2:1', 'out', '14', '1'); cell('c2', '2:1', 'out', '14', '2'); cell('c1', '2:1', 'out', '14', '3');
  cell('d1', '1. Dutzend', 'out', '2 / 6', '4'); cell('d2', '2. Dutzend', 'out', '6 / 10', '4'); cell('d3', '3. Dutzend', 'out', '10 / 14', '4');
  cell('low', '1 – 18', 'out', '2 / 4', '5'); cell('even', 'Gerade', 'out', '4 / 6', '5');
  cell('red', { label: 'Rot', html: '<i class="dia red"></i>' }, 'out', '6 / 8', '5');
  cell('black', { label: 'Schwarz', html: '<i class="dia black"></i>' }, 'out', '8 / 10', '5');
  cell('odd', 'Ungerade', 'out', '10 / 12', '5'); cell('high', '19 – 36', 'out', '12 / 14', '5');
  var scroll = el('div', { class: 'rscroll' }, board);

  /* Steuerung */
  chipsRow = el('div', { class: 'chips', role: 'group', 'aria-label': 'Chipwert' });
  neighBtn = el('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', title: 'Setzt auf die Zahl und die je zwei Nachbarn im Kessel',
    onclick: function () { neigh = !neigh; neighBtn.setAttribute('aria-pressed', String(neigh)); neighBtn.classList.toggle('on', neigh); V.Snd.click(); } }, 'Nachbarn ±2', V.kbd('N'));
  undoBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: undo }, 'Zurück', V.kbd('⌫'));
  clearBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: clearAll }, 'Leeren', V.kbd('L'));
  rebetBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: rebet }, 'Wiederholen', V.kbd('W'));
  dblBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: dbl }, 'Verdoppeln', V.kbd('D'));
  spinBtn = el('button', { class: 'btn gold big', type: 'button', onclick: spin }, 'Kugel rollen lassen', V.kbd('Leertaste'));
  totalEl = el('div', { class: 'rtotal', text: 'Auf dem Tisch: 0' });
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Setz Chips auf Zahlen oder Felder. Rechtsklick entfernt ein Feld. Einzelzahl zahlt 35:1.' });
  var ctl = el('div', { class: 'rctl' },
    el('div', { class: 'rrow' }, el('span', { class: 'lbl', text: 'Chip' }), chipsRow, neighBtn),
    el('div', { class: 'rrow' }, undoBtn, clearBtn, rebetBtn, dblBtn, totalEl),
    spinBtn);
  var right = el('div', { class: 'rright' }, scroll, ctl, msgEl);
  root.appendChild(el('div', { class: 'rlayout' }, left, right));
  root.appendChild(el('p', { class: 'fine', text: 'Europäisches Roulette mit einer Null: Jede Wette hat 97,3 % Auszahlungsquote (2,7 % Hausvorteil). Die Kugel hat kein Gedächtnis, heiß und kalt sind reiner Zufall.' }));
  V.busyFns.push(function () { return spinning || resolving || Object.keys(bets).length > 0; });
  renderChips(); renderHist(); renderBets();
}

function renderChips() {
  var S = V.S, list = V.chipList();
  if (list.indexOf(S.rchip) < 0) S.rchip = list[0];
  chipsRow.innerHTML = '';
  list.forEach(function (v) {
    chipsRow.appendChild(el('button', { class: 'chip c' + String(v).length, type: 'button', 'aria-pressed': String(v === S.rchip), text: short(v), 'aria-label': 'Chip ' + fmt(v),
      onclick: function () { S.rchip = v; V.Snd.click(); renderChips(); V.save(); } }));
  });
}

function renderBets() {
  var t = sum(bets);
  for (var k in cellMap) {
    var c = cellMap[k], amt = bets[k] || 0, ch = c.querySelector('.rchip');
    ch.hidden = amt <= 0; ch.textContent = amt > 0 ? short(amt) : '';
    c.classList.toggle('has', amt > 0);
  }
  totalEl.textContent = 'Auf dem Tisch: ' + fmt(t);
  var off = spinning || resolving;
  spinBtn.disabled = off || t <= 0;
  undoBtn.disabled = off || stack.length === 0;
  clearBtn.disabled = off || t <= 0;
  rebetBtn.disabled = off || t > 0 || sum(last) <= 0;
  dblBtn.disabled = off || t <= 0;
  chipsRow.querySelectorAll('button').forEach(function (b) { b.disabled = off; });
  neighBtn.disabled = off;
}

function place(keys, amt) {
  var S = V.S, r = V.room();
  if (spinning || resolving) return false;
  if (amt < r.min) { V.toast('Mindesteinsatz in diesem Raum: ' + fmt(r.min), 'bad'); return false; }
  var cost = amt * keys.length;
  if (S.balance < cost) { V.needChips(); return false; }
  for (var i = 0; i < keys.length; i++) {
    if ((bets[keys[i]] || 0) + amt > r.max) { V.toast('Tischlimit pro Feld: ' + fmt(r.max), 'bad'); return false; }
  }
  V.debit(cost);
  keys.forEach(function (k) { bets[k] = (bets[k] || 0) + amt; });
  stack.push(keys.map(function (k) { return { key: k, amount: amt }; }));
  V.Snd.chip(); V.hud(); renderBets();
  return true;
}
function onCell(key) {
  var amt = V.S.rchip, keys = [key];
  if (neigh && key.charAt(0) === 'n') {
    keys = E.rNeighbors(Number(key.slice(1)), 2).map(function (n) { return 'n' + n; });
  }
  place(keys, amt);
}
function undo() {
  if (spinning || resolving || !stack.length) return;
  var g = stack.pop(), back = 0;
  g.forEach(function (x) {
    bets[x.key] -= x.amount; back += x.amount;
    if (bets[x.key] <= 0) delete bets[x.key];
  });
  V.refund(back); V.hud(); renderBets(); V.Snd.click();
}
function clearAll() {
  if (spinning || resolving) return;
  var t = sum(bets);
  if (t > 0) V.refund(t);
  bets = {}; stack = [];
  V.hud(); renderBets();
}
function clearSpot(key) {
  if (spinning || resolving || !bets[key]) return;
  V.refund(bets[key]);
  delete bets[key];
  stack = stack.map(function (g) { return g.filter(function (x) { return x.key !== key; }); }).filter(function (g) { return g.length; });
  V.hud(); renderBets();
}
function rebet() {
  if (spinning || resolving || sum(bets) > 0 || sum(last) <= 0) return;
  var r = V.room(), t = sum(last), ok = true;
  for (var k in last) if (last[k] < r.min || last[k] > r.max) ok = false;
  if (!ok) { V.toast('Die letzte Wette passt nicht zu den Limits dieses Raums.', 'bad'); return; }
  if (V.S.balance < t) { V.needChips(); return; }
  V.debit(t);
  bets = Object.assign({}, last);
  stack = [Object.keys(last).map(function (k2) { return { key: k2, amount: last[k2] }; })];
  V.Snd.chip(); V.hud(); renderBets();
}
function dbl() {
  if (spinning || resolving) return;
  var t = sum(bets), r = V.room();
  if (t <= 0) return;
  for (var k in bets) if (bets[k] * 2 > r.max) { V.toast('Tischlimit pro Feld: ' + fmt(r.max), 'bad'); return; }
  if (V.S.balance < t) { V.needChips(); return; }
  V.debit(t);
  var g = [];
  for (var k2 in bets) { g.push({ key: k2, amount: bets[k2] }); bets[k2] *= 2; }
  stack.push(g);
  V.Snd.chip(); V.hud(); renderBets();
}

function renderHist() {
  var S = V.S;
  histEl.innerHTML = '';
  S.rhist.slice(-14).reverse().forEach(function (n) {
    histEl.appendChild(el('span', { class: 'hp ' + E.rColor(n), text: String(n) }));
  });
  hotEl.innerHTML = '';
  if (S.rhist.length < 10) { hotEl.appendChild(el('span', { text: 'Heiß-und-Kalt-Liste ab 10 Spins.' })); return; }
  var cnt = []; for (var i = 0; i < 37; i++) cnt.push({ n: i, c: 0 });
  S.rhist.forEach(function (n) { cnt[n].c++; });
  var sorted = cnt.slice().sort(function (a, b) { return b.c - a.c || a.n - b.n; });
  var hot = sorted.slice(0, 3), cold = sorted.slice(-3).reverse();
  hotEl.appendChild(el('span', { class: 'hot', text: 'Heiß: ' + hot.map(function (x) { return x.n + ' (' + x.c + '×)'; }).join(', ') }));
  hotEl.appendChild(el('span', { class: 'cold', text: 'Kalt: ' + cold.map(function (x) { return x.n + ' (' + x.c + '×)'; }).join(', ') }));
  hotEl.appendChild(el('span', { class: 'fine', text: 'Beliebt, aber ohne Aussagekraft: Jede Zahl hat jedes Mal dieselbe Chance.' }));
}

async function spin() {
  if (spinning || resolving) return;
  var t = sum(bets);
  if (t <= 0) { V.toast('Setz zuerst Chips auf den Tisch.', 'bad'); return; }
  V.Snd.ensure();
  spinning = true; renderBets();
  V.lock(t);
  last = Object.assign({}, bets);
  var n = E.rSpin(), idx = E.R_ORDER.indexOf(n), d = 360 / 37;
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Rien ne va plus …';
  resultBadge.textContent = '…'; resultBadge.className = 'result-badge';
  ballOrbit.classList.remove('drop');
  wheelAngle = Math.ceil(wheelAngle / 360) * 360 + 1800 - (idx + 0.5) * d;
  ballAngle = Math.floor(ballAngle / 360) * 360 - 2160;
  wheelRot.style.transform = 'rotate(' + wheelAngle.toFixed(3) + 'deg)';
  ballOrbit.style.transform = 'rotate(' + ballAngle.toFixed(3) + 'deg)';
  var tk = setInterval(function () { V.Snd.tick(); }, 180);
  setTimeout(function () { ballOrbit.classList.add('drop'); }, 3900);
  await sleep(5300);
  clearInterval(tk);
  var res = E.rResolve(bets, n);
  /* Talent La Partage: bei Zero die Hälfte der einfachen Chancen zurück */
  var partage = 0;
  if (n === 0 && V.meta.perk('partage')) ['red', 'black', 'odd', 'even', 'low', 'high'].forEach(function (k) { if (bets[k]) partage += Math.floor(bets[k] / 2); });
  res.ret += partage;
  var S = V.S;
  S.rhist.push(n); if (S.rhist.length > 120) S.rhist.shift();
  resultBadge.textContent = String(n); resultBadge.className = 'result-badge ' + E.rColor(n);
  spinning = false; resolving = true;
  V.settle('roulette', res.staked, res.ret, { straight: Object.keys(res.won).some(function (k) { return k.charAt(0) === 'n'; }) });
  var net = res.ret - res.staked;
  for (var k in res.won) if (cellMap[k]) cellMap[k].classList.add('won');
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = 'Gewinnzahl ' + n + ' (' + COLORS[E.rColor(n)] + '). ' + (res.ret > 0
    ? 'Zurück: ' + fmt(res.ret) + ' Chips (' + (net >= 0 ? '+' : '') + fmt(net) + ')' + (partage ? ' · La Partage +' + fmt(partage) : '') : 'Kein Treffer, ' + fmt(res.staked) + ' Chips gehen ans Haus.');
  if (net > 0) {
    var ratio = res.ret / res.staked;
    if (ratio >= 8) { V.Snd.big(); V.burst(V.$('#g-roulette .wheel'), 30); V.banner(ratio >= 20 ? 'VOLLTREFFER' : 'BIG WIN', '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2400 }); }
    else V.Snd.win();
  } else V.Snd.lose();
  renderHist(); renderBets();
  await sleep(2200);
  for (var k2 in cellMap) cellMap[k2].classList.remove('won');
  bets = {}; stack = []; resolving = false;
  renderBets();
}

function stepChip(dir) {
  if (spinning || resolving) return;
  var S = V.S, list = V.chipList(), i = list.indexOf(S.rchip);
  S.rchip = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i) + dir))];
  V.Snd.click(); renderChips(); V.save();
}
function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { spin(); return true; }
  if (k === 'backspace') { undo(); return true; }
  if (k === 'l') { clearAll(); return true; }
  if (k === 'w') { rebet(); return true; }
  if (k === 'd') { dbl(); return true; }
  if (k === 'n') { if (!neighBtn.disabled) neighBtn.click(); return true; }
  if (k === 'arrowleft' || k === 'arrowright') { stepChip(k === 'arrowright' ? 1 : -1); return true; }
  return false;
}

V.games.push({
  id: 'roulette',
  init: build,
  onKey: onKey,
  keys: [['Leertaste', 'Kugel rollen lassen'], ['← / →', 'Chipwert wählen'], ['⌫', 'Letzten Einsatz zurück'], ['L', 'Tisch leeren'], ['W', 'Letzte Wette wiederholen'], ['D', 'Alle Einsätze verdoppeln'], ['N', 'Nachbarn ±2 an/aus'], ['Maus', 'Chips auf Felder setzen, Rechtsklick entfernt']],
  onRoom: function () { renderChips(); renderBets(); },
  refresh: function () { renderBets(); }
});
})();
