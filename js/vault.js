/* Chip Empire – Tresorknacker: 25 Schließfächer (ab Meisterschaft Silber 36, ab Platin 49), hinter einigen liegt der Alarm.
   Jedes sichere Fach treibt den Multiplikator hoch, auszahlen geht jederzeit. */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, fmtX = V.fmtX, sleep = V.sleep;
var RTP = 0.97;
var PRESETS = [1, 3, 5, 10, 20];
/* Rastergrößen und die Meisterschaft, die sie freischaltet */
var SIZES = [{ n: 5, name: '5×5' }, { n: 6, name: '6×6', key: 'grid6' }, { n: 7, name: '7×7', key: 'grid7' }];
function sizeOpen(n) { var z = SIZES.filter(function (s) { return s.n === n; })[0]; return !!z && (!z.key || V.mastery.has('vault', z.key)); }
function size() { return run ? run.size : sizeOpen(V.S.vaultSize) ? V.S.vaultSize : 5; }
function cells() { var n = size(); return n * n; }

/* Multiplikator nach k sicheren Fächern bei m Alarmen: fair geteilt durch die Überlebenschance, mal 97 % */
/* Talent Meisterdieb erhöht die Quote leicht */
function multAt(m, k) {
  if (!k) return 1;
  var f = 1, CELLS = cells();
  for (var i = 0; i < k; i++) f *= (CELLS - i) / (CELLS - m - i);
  return Math.floor(f * (RTP + V.meta.perk('vaultLuck')) * 100) / 100;
}
function chanceNext(m, k) { var CELLS = cells(); return (CELLS - m - k) / (CELLS - k); }
function fach(k) { return k + (k === 1 ? ' Fach' : ' Fächern'); }

var root, gridEl, cellEls = [], sizeBtns = {}, bet, goBtn, randBtn, minesOut, minusBtn, plusBtn, presetBtns = [], multEl, nextEl, msgEl;
var run = null; /* { bet, mines, alarms: {i: true}, open: {i: true}, k, over } */

function mines() { return V.clamp(V.S.vaultMines || 3, 1, cells() - 1); }

function build() {
  root = V.$('#g-vault');
  multEl = el('div', { class: 'vt-mult', 'aria-live': 'polite', text: '1,00×' });
  nextEl = el('div', { class: 'vt-next' });
  gridEl = el('div', { class: 'vt-grid', role: 'grid', 'aria-label': 'Schließfächer' });
  buildGrid();
  var board = el('div', { class: 'vt-board' }, el('div', { class: 'vt-top' }, multEl, nextEl), gridEl);

  bet = V.betControl('vault');
  minesOut = el('output', { class: 'betval' });
  minusBtn = el('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Weniger Alarme', text: '−', onclick: function () { setMines(mines() - 1); } });
  plusBtn = el('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Mehr Alarme', text: '+', onclick: function () { setMines(mines() + 1); } });
  var pr = el('div', { class: 'presets' });
  PRESETS.forEach(function (n) {
    var b = el('button', { class: 'chipbtn', type: 'button', text: String(n), onclick: function () { setMines(n); } });
    presetBtns.push(b); pr.appendChild(b);
  });
  var ssel = el('div', { class: 'qseg', role: 'radiogroup', 'aria-label': 'Tresorgröße' });
  SIZES.forEach(function (z) {
    sizeBtns[z.n] = el('button', { type: 'button', role: 'radio', onclick: function () { setSize(z.n); } }, z.name);
    ssel.appendChild(sizeBtns[z.n]);
  });
  var mctl = el('div', { class: 'betctl' }, el('span', { class: 'lbl', text: 'Alarmanlagen' }), el('div', { class: 'betrow' }, minusBtn, minesOut, plusBtn), pr);
  goBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onGo }, el('span'), V.kbd('Leertaste'));
  randBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: pickRandom }, 'Zufälliges Fach', V.kbd('R'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite' });
  root.appendChild(el('div', { class: 'vt-layout' }, board,
    el('div', { class: 'vt-side' }, el('span', { class: 'lbl', text: 'Tresorgröße' }), ssel, mctl, bet.el, goBtn, randBtn, msgEl,
      el('p', { class: 'fine', text: 'Hinter manchen Fächern sitzt eine Alarmanlage. Jedes sichere Fach erhöht den Multiplikator, je mehr Alarme, desto schneller. Löst du den Alarm aus, ist der Einsatz weg. Auszahlen kannst du nach jedem Fach. Größere Tresore gibt es mit der Meisterschaft (Silber 6×6, Platin 7×7). Auszahlungsquote 97 %.' }))));
  V.busyFns.push(function () { return !!run; });
  render();
}

/* Fächer passend zur Rastergröße neu anlegen */
function buildGrid() {
  var n = size();
  if (cellEls.length === n * n) return;
  gridEl.innerHTML = ''; cellEls = [];
  gridEl.style.setProperty('--cols', n);
  gridEl.setAttribute('data-size', String(n));
  for (var i = 0; i < n * n; i++) (function (i) {
    var c = el('button', { class: 'vt-cell', type: 'button', 'aria-label': 'Fach ' + (i + 1), onclick: function () { pick(i); } }, el('span', { class: 'vt-face' }));
    cellEls.push(c); gridEl.appendChild(c);
  })(i);
}

function setSize(n) {
  if (run) return;
  var z = SIZES.filter(function (s) { return s.n === n; })[0];
  if (z.key && V.mastery.locked('vault', z.key)) return;
  V.S.vaultSize = n;
  V.Snd.click(); render(); V.save();
}

function setMines(n) {
  if (run) return;
  V.S.vaultMines = V.clamp(n, 1, cells() - 1);
  V.Snd.click(); render(); V.save();
}

function render(reveal) {
  buildGrid();
  var m = run ? run.mines : mines(), k = run ? run.k : 0, CELLS = cells(), sz = size();
  SIZES.forEach(function (z) {
    var b = sizeBtns[z.n], lockd = !sizeOpen(z.n);
    b.setAttribute('aria-selected', String(z.n === sz)); b.setAttribute('aria-checked', String(z.n === sz));
    b.disabled = !!run; b.classList.toggle('lockd', lockd);
    b.title = lockd ? V.mastery.lockText('vault', z.key) : '';
    b.textContent = (lockd ? '🔒 ' : '') + z.name;
  });
  minesOut.textContent = m;
  minusBtn.disabled = !!run || m <= 1; plusBtn.disabled = !!run || m >= CELLS - 1;
  presetBtns.forEach(function (b, i) { b.disabled = !!run; b.classList.toggle('on', PRESETS[i] === m); });
  bet.disable(!!run);
  var cur = multAt(m, k), nxt = multAt(m, k + 1);
  multEl.textContent = fmtX(cur);
  multEl.classList.toggle('hot', k > 0);
  nextEl.textContent = run && run.over ? '' : k >= CELLS - m ? 'Alles geknackt' :
    'Nächstes Fach: ' + fmtX(nxt) + ' · sicher zu ' + Math.round(chanceNext(m, k) * 100) + ' %';
  /* Je höher der Multiplikator, desto heißer glüht der Tresor */
  gridEl.style.setProperty('--heat', V.clamp(Math.log(cur) / Math.log(50), 0, 1).toFixed(2));
  cellEls.forEach(function (c, i) {
    var open = run && run.open[i], alarm = run && run.alarms[i], show = open || (reveal && run);
    c.className = 'vt-cell' + (open ? ' safe' : '') + (show && !open ? (alarm ? ' alarm' : ' miss') : '') + (run && run.hit === i ? ' hit' : '');
    c.disabled = !run || run.over || open;
    c.firstChild.textContent = show ? (alarm ? '🚨' : '💎') : '';
  });
  var lb = goBtn.firstChild;
  if (!run) { lb.textContent = 'Tresor knacken · ' + fmt(V.S.bets.vault); goBtn.disabled = false; goBtn.classList.remove('cash'); }
  else if (!run.k) { lb.textContent = 'Wähle ein Fach'; goBtn.disabled = true; goBtn.classList.remove('cash'); }
  else { lb.textContent = 'Auszahlen · ' + fmt(V.payout(run.bet, cur)); goBtn.disabled = run.over; goBtn.classList.add('cash'); }
  randBtn.disabled = !run || run.over;
  if (!run && !msgEl.textContent) msgEl.textContent = 'Stell die Alarmanlagen ein und knack den Tresor.';
}

function start() {
  var S = V.S, b0 = S.bets.vault, m = mines(), sz = size(), CELLS = sz * sz;
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  V.debit(b0, true); V.hud();
  var order = E.shuffle(Array.apply(null, { length: CELLS }).map(function (x, i) { return i; })), alarms = {};
  order.slice(0, m).forEach(function (i) { alarms[i] = true; });
  run = { bet: b0, size: sz, mines: m, alarms: alarms, open: {}, k: 0, over: false, hit: -1 };
  msgEl.className = 'slot-msg'; msgEl.textContent = m + ' Alarm' + (m > 1 ? 'e' : '') + ' versteckt. Welches Fach öffnest du?';
  V.Snd.click();
  render();
}

function pickRandom() {
  if (!run || run.over) return;
  var free = [];
  for (var i = 0; i < cells(); i++) if (!run.open[i]) free.push(i);
  pick(free[E.randInt(free.length)]);
}

async function pick(i) {
  if (!run || run.over || run.open[i]) return;
  if (run.alarms[i]) {
    run.over = true; run.hit = i;
    V.Snd.crash();
    render(true);
    gridEl.classList.remove('shake'); void gridEl.offsetWidth; gridEl.classList.add('shake');
    V.settle('vault', run.bet, 0, { vaultPicks: run.k, vaultMult: 0 });
    msgEl.className = 'slot-msg';
    msgEl.textContent = run.k ? 'Alarm! Nach ' + fach(run.k) + ' war Schluss, ' + fmtX(multAt(run.mines, run.k)) + ' sind weg.' : 'Alarm gleich im ersten Fach. ' + fmt(run.bet) + ' Chips gehen ans Haus.';
    await sleep(1800);
    run = null; render();
    return;
  }
  run.open[i] = true; run.k++;
  V.Snd.step(run.k);
  multEl.classList.remove('bump'); void multEl.offsetWidth; multEl.classList.add('bump');
  if (run.k >= cells() - run.mines) { render(); await cashout(true); return; }
  msgEl.className = 'slot-msg win';
  msgEl.textContent = 'Sicher! ' + run.k + (run.k === 1 ? ' Fach' : ' Fächer') + ' offen: ' + fmtX(multAt(run.mines, run.k)) + '. Weiter oder auszahlen?';
  render();
}

async function cashout(all) {
  if (!run || !run.k || run.over) return;
  var m = multAt(run.mines, run.k), ret = V.payout(run.bet, m), net = ret - run.bet;
  run.over = true;
  render(true);
  V.settle('vault', run.bet, ret, { vaultPicks: run.k, vaultMult: m });
  msgEl.className = 'slot-msg win';
  msgEl.textContent = (all ? 'Tresor leergeräumt! ' : 'Ausgezahlt nach ' + fach(run.k) + '. ') + fmtX(m) + ': +' + fmt(net) + ' Chips';
  if (all || m >= 10) {
    V.Snd.big(); V.burst(gridEl, all ? 60 : 36);
    V.banner(all ? 'Tresor geknackt!' : fmtX(m), '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2800 });
  } else V.Snd.cash();
  await sleep(1500);
  run = null; render();
}

function onGo() { if (!run) start(); else cashout(false); }

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { onGo(); return true; }
  if (k === 'r' && run) { pickRandom(); return true; }
  if ((k === 'arrowup' || k === '+') && !run) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !run) { bet.step(-1); return true; }
  if (k === 'arrowright' && !run) { setMines(mines() + 1); return true; }
  if (k === 'arrowleft' && !run) { setMines(mines() - 1); return true; }
  return false;
}

V.games.push({
  id: 'vault', init: build, onKey: onKey,
  keys: [['Leertaste', 'Tresor knacken / Auszahlen'], ['R', 'Zufälliges Fach öffnen'], ['← / →', 'Alarmanlagen ändern'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); render(); }, onMastery: function () { if (!run) render(); }, refresh: function () { if (!run) { bet.render(); render(); } }
});
})();
