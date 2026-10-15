/* Chip Empire – Gastspiel Limbo: Ziel-Multiplikator wählen, eine Zufallszahl steigt hoch.
   Erreicht sie das Ziel, zahlt die Runde Einsatz × Ziel. Chance = 97 % / Ziel, Auszahlungsquote damit immer 97 %. */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var RTP = 0.97, MIN_T = 1.01, MAX_T = 1000;
var root, bet, numEl, subEl, tIn, chanceEl, payEl, playBtn, msgEl, histEl, busy = false, hist = [];

function target() { var t = V.S.limboT || 2; return Math.min(MAX_T, Math.max(MIN_T, Math.round(t * 100) / 100)); }
function setTarget(t) {
  t = Number(String(t).replace(',', '.'));
  if (!isFinite(t)) return;
  V.S.limboT = Math.min(MAX_T, Math.max(MIN_T, Math.round(t * 100) / 100));
  renderInfo(); V.save();
}
/* Ergebnis: 0,97 / U, auf zwei Stellen abgerundet. P(Ergebnis ≥ Ziel) = 0,97 / Ziel (Abrunden macht es nur kleiner). */
function roll() { var u = 1 - E.rand(); return Math.min(1e6, Math.floor(RTP / u * 100) / 100); }
function x(v) { return v.toFixed(2).replace('.', ',') + '×'; }

function renderInfo() {
  var t = target(), c = RTP / t;
  if (document.activeElement !== tIn) tIn.value = String(t).replace('.', ',');
  chanceEl.textContent = (c * 100 >= 10 ? (c * 100).toFixed(1) : (c * 100).toFixed(2)).replace('.', ',') + ' %';
  payEl.textContent = fmt(V.payout(V.S.bets.limbo, t));
}
function build() {
  root = V.$('#g-limbo');
  bet = V.betControl('limbo', renderInfo);
  numEl = el('div', { class: 'lb-num', text: '1,00×' });
  subEl = el('div', { class: 'lb-sub', text: 'Wähle dein Ziel und spiel los.' });
  var stage = el('div', { class: 'lb-stage' }, el('div', { class: 'lb-glow' }), numEl, subEl);
  tIn = el('input', { class: 'name-in lb-in', type: 'text', inputmode: 'decimal', 'aria-label': 'Ziel-Multiplikator' });
  tIn.addEventListener('change', function () { setTarget(tIn.value); });
  tIn.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { setTarget(tIn.value); tIn.blur(); } });
  var presets = el('div', { class: 'presets' });
  [1.5, 2, 3, 5, 10, 100].forEach(function (v) { presets.appendChild(el('button', { class: 'chipbtn', type: 'button', text: String(v).replace('.', ',') + '×', onclick: function () { setTarget(v); V.Snd.click(); } })); });
  chanceEl = el('b', { class: 'num' }); payEl = el('b', { class: 'num' });
  playBtn = el('button', { class: 'btn gold big', type: 'button', onclick: play }, 'Spielen', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Je höher das Ziel, desto seltener, desto mehr zahlt es.' });
  histEl = el('div', { class: 'fw-hist', 'aria-label': 'Letzte Ergebnisse' });
  root.appendChild(el('div', { class: 'gx-layout' }, el('div', { class: 'gx-board' }, stage, histEl),
    el('div', { class: 'gx-side' },
      el('span', { class: 'lbl', text: 'Ziel-Multiplikator' }), tIn, presets,
      el('div', { class: 'gx-kv' }, el('span', { text: 'Gewinnchance' }), chanceEl),
      el('div', { class: 'gx-kv' }, el('span', { text: 'Auszahlung' }), payEl),
      bet.el, playBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Gastspiel. Ziel zwischen 1,01× und 1.000×. Die Chance ist immer 97 % geteilt durch das Ziel, die Auszahlungsquote also bei jedem Ziel 97 %.' }));
  V.busyFns.push(function () { return busy; });
  renderInfo();
}

async function play() {
  if (busy) return;
  var S = V.S, b0 = S.bets.limbo, t = target();
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  busy = true; bet.disable(true); playBtn.disabled = true; tIn.disabled = true;
  V.debit(b0, true); V.hud();
  var r = roll(), win = r >= t;
  /* Zahl steigt schnell hoch, bei hohen Ergebnissen etwas länger */
  numEl.className = 'lb-num run';
  var steps = 14, show = Math.min(r, 1000);
  for (var i = 1; i <= steps; i++) {
    var k = i / steps, v = 1 + (show - 1) * (1 - Math.pow(1 - k, 3));
    numEl.textContent = x(Math.max(1, v));
    if (i % 3 === 0) V.Snd.tick();
    await sleep(28);
  }
  numEl.textContent = x(r);
  numEl.className = 'lb-num ' + (win ? 'win' : 'lose');
  var ret = win ? V.payout(b0, t) : 0;
  subEl.textContent = (win ? 'Getroffen! Ziel ' : 'Ziel verpasst: ') + x(t);
  hist.push([r, win]);
  histEl.innerHTML = '';
  hist.slice(-12).reverse().forEach(function (h) { histEl.appendChild(el('span', { class: h[1] ? 'dbl' : '', text: x(h[0]) })); });
  V.settle('limbo', b0, ret, { limboT: t });
  msgEl.className = 'slot-msg ' + (win ? 'win' : '');
  msgEl.textContent = win ? '+' + fmt(ret - b0) + ' Chips' : 'Einsatz verloren.';
  if (win && t >= 10) { V.Snd.big(); V.burst(root.querySelector('.lb-stage'), 30); V.banner(x(t) + ' getroffen!', '+' + fmt(ret - b0) + ' Chips', { kind: 'win', ms: 2200 }); }
  else if (win) V.Snd.win(); else V.Snd.lose();
  busy = false; bet.disable(false); playBtn.disabled = false; tIn.disabled = false;
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { play(); return true; }
  if ((k === 'arrowup' || k === '+') && !busy) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !busy) { bet.step(-1); return true; }
  return false;
}
V.games.push({ id: 'limbo', init: build, onKey: onKey, keys: [['Leertaste', 'Spielen'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); renderInfo(); }, refresh: function () { if (!busy) bet.render(); } });
})();
