/* Chip Empire – Gastspiel Keno: 1 bis 8 Zahlen aus 40 tippen, 10 werden gezogen.
   Gewinn nach Zahl der Treffer. Auszahlungsquote je nach Anzahl getippter Zahlen 94,9 bis 97 % (nachgerechnet). */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var N = 40, DRAW = 10, MAX = 8;
/* Auszahlung (Faktor auf den Einsatz) je getippter Zahlen → Treffer */
var PAY = {
  1: { 1: 3.8 }, 2: { 1: 1.3, 2: 7.8 }, 3: { 2: 3.8, 3: 36 }, 4: { 2: 1.8, 3: 9, 4: 100 },
  5: { 2: 0.8, 3: 4, 4: 25, 5: 450 }, 6: { 3: 3, 4: 12, 5: 100, 6: 1600 },
  7: { 3: 2, 4: 5.5, 5: 35, 6: 350, 7: 4000 }, 8: { 3: 0.9, 4: 4, 5: 18, 6: 110, 7: 1500, 8: 15000 }
};
var root, bet, cells = [], payEl, playBtn, msgEl, busy = false, drawn = [];

function picks() { var p = V.S.kenoPick; return Array.isArray(p) ? p.filter(function (n) { return n >= 1 && n <= N; }).slice(0, MAX) : []; }
function toggle(n) {
  if (busy) return;
  var p = picks(), i = p.indexOf(n);
  if (i >= 0) p.splice(i, 1);
  else if (p.length >= MAX) { V.toast('Höchstens ' + MAX + ' Zahlen.', 'bad'); return; }
  else p.push(n);
  V.S.kenoPick = p; drawn = []; V.Snd.click(); render(); V.save();
}
function quick() {
  if (busy) return;
  var k = Math.max(picks().length, 5), pool = [], out = [];
  for (var i = 1; i <= N; i++) pool.push(i);
  for (var j = 0; j < k; j++) out.push(pool.splice(E.randInt(pool.length), 1)[0]);
  V.S.kenoPick = out; drawn = []; V.Snd.chip(); render(); V.save();
}
function clear() { if (busy) return; V.S.kenoPick = []; drawn = []; render(); V.save(); }

function render() {
  var p = picks();
  cells.forEach(function (c, i) {
    var n = i + 1, picked = p.indexOf(n) >= 0, hit = drawn.indexOf(n) >= 0;
    c.className = 'kn-cell' + (picked ? ' pick' : '') + (hit ? ' drawn' : '') + (picked && hit ? ' hit' : '');
    c.disabled = busy;
  });
  payEl.innerHTML = '';
  var t = PAY[p.length];
  if (!t) payEl.appendChild(el('p', { class: 'fine', text: 'Tipp 1 bis 8 Zahlen an. Je mehr Zahlen, desto höher die Gewinne für viele Treffer.' }));
  else Object.keys(t).reverse().forEach(function (h) {
    payEl.appendChild(el('div', { class: 'kn-pay' }, el('span', { text: h + ' Treffer' }), el('b', { class: 'num', text: String(t[h]).replace('.', ',') + '×' })));
  });
  playBtn.disabled = busy || !p.length;
}
function build() {
  root = V.$('#g-keno');
  bet = V.betControl('keno');
  var grid = el('div', { class: 'kn-grid', role: 'group', 'aria-label': 'Keno-Zahlen' });
  for (var i = 1; i <= N; i++) (function (n) {
    var c = el('button', { class: 'kn-cell', type: 'button', text: String(n), 'aria-label': 'Zahl ' + n, onclick: function () { toggle(n); } });
    cells.push(c); grid.appendChild(c);
  })(i);
  payEl = el('div', { class: 'kn-pays' });
  playBtn = el('button', { class: 'btn gold big', type: 'button', onclick: play }, 'Ziehen', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Tipp deine Glückszahlen an. Dann werden 10 von 40 gezogen.' });
  root.appendChild(el('div', { class: 'gx-layout' }, el('div', { class: 'gx-board kn-board' }, grid,
    el('div', { class: 'rrow' }, el('button', { class: 'btn ghost sm', type: 'button', text: 'Zufällig', onclick: quick }), el('button', { class: 'btn ghost sm', type: 'button', text: 'Leeren', onclick: clear }))),
    el('div', { class: 'gx-side' }, el('span', { class: 'lbl', text: 'Gewinne' }), payEl, bet.el, playBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Gastspiel. 10 von 40 Zahlen werden gezogen. Auszahlungsquote je nach Anzahl deiner Zahlen 94,9 bis 97 %.' }));
  V.busyFns.push(function () { return busy; });
  render();
}

async function play() {
  if (busy) return;
  var S = V.S, p = picks(), b0 = S.bets.keno;
  if (!p.length) { V.toast('Tipp erst mindestens eine Zahl an.', 'bad'); return; }
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  busy = true; bet.disable(true);
  V.debit(b0, true); V.hud();
  var pool = [], draw = [];
  for (var i = 1; i <= N; i++) pool.push(i);
  for (var j = 0; j < DRAW; j++) draw.push(pool.splice(E.randInt(pool.length), 1)[0]);
  drawn = []; render();
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Ziehung läuft …';
  for (var k = 0; k < DRAW; k++) {
    drawn.push(draw[k]);
    render();
    if (p.indexOf(draw[k]) >= 0) V.Snd.chip(); else V.Snd.tick();
    await sleep(170);
  }
  var hits = p.filter(function (n) { return draw.indexOf(n) >= 0; }).length, m = (PAY[p.length] || {})[hits] || 0;
  var ret = m ? V.payout(b0, m) : 0;
  busy = false;
  V.settle('keno', b0, ret, { kenoHits: hits, kenoPicks: p.length });
  msgEl.className = 'slot-msg ' + (ret > b0 ? 'win' : '');
  msgEl.textContent = hits + ' von ' + p.length + ' getroffen' + (ret ? ': ' + String(m).replace('.', ',') + '× · ' + (ret >= b0 ? '+' : '−') + fmt(Math.abs(ret - b0)) + ' Chips' : '.');
  if (m >= 25) { V.Snd.big(); V.burst(root.querySelector('.kn-grid'), 40); V.banner(hits + ' Treffer!', String(m).replace('.', ',') + '× · +' + fmt(ret - b0) + ' Chips', { kind: 'win', ms: 2600 }); }
  else if (ret > b0) V.Snd.win(); else if (!ret) V.Snd.lose();
  bet.disable(false); render();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { play(); return true; }
  if (k === 'z') { quick(); return true; }
  if ((k === 'arrowup' || k === '+') && !busy) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !busy) { bet.step(-1); return true; }
  return false;
}
V.games.push({ id: 'keno', init: build, onKey: onKey, keys: [['Leertaste', 'Ziehen'], ['Z', 'Zufällige Zahlen'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); }, onShow: function () { if (!busy) render(); }, refresh: function () { if (!busy) { bet.render(); render(); } } });
})();
