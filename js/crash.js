/* Chip Empire – Crash ("Rocket Lounge") */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, fmtX = V.fmtX;

var root, canvas, ctx, multEl, subEl, histEl, betCtl, goBtn, autoIn, autoChk, msgEl;
var running = false, cashed = false, cp = 1, t0 = 0, raf = 0, bet = 0, cashAt = 0, curM = 1, curT = 0, crashedAt = 0;
var colors = {};

function readColors() {
  var cs = getComputedStyle(document.documentElement);
  ['--gold', '--gold-hi', '--crimson', '--ivory', '--muted', '--line', '--felt', '--good'].forEach(function (k) { colors[k] = cs.getPropertyValue(k).trim() || '#ccc'; });
}

function build() {
  root = V.$('#g-crash');
  canvas = el('canvas', { class: 'crash-cv', 'aria-hidden': 'true' });
  multEl = el('div', { class: 'crash-mult', text: '1,00×' });
  subEl = el('div', { class: 'crash-sub', 'aria-live': 'polite', text: 'Steig ein und zahl aus, bevor die Kurve abstürzt.' });
  var stage = el('div', { class: 'crash-stage' }, canvas, el('div', { class: 'crash-over' }, multEl, subEl));
  histEl = el('div', { class: 'chist', 'aria-label': 'Letzte Crash-Punkte' });

  betCtl = V.betControl('crash');
  autoChk = el('input', { type: 'checkbox', id: 'crashAutoChk', checked: !!V.S.crashAutoOn });
  autoIn = el('input', { type: 'number', id: 'crashAuto', min: '1.01', max: '10000', step: '0.01', value: V.S.crashAuto || '2.00', inputmode: 'decimal' });
  function keepAuto() { V.S.crashAutoOn = autoChk.checked; V.S.crashAuto = String(autoIn.value || '2.00'); V.save(); }
  autoChk.addEventListener('change', keepAuto); autoIn.addEventListener('change', keepAuto);
  var autoRow = el('label', { class: 'autorow', for: 'crashAutoChk' }, autoChk, el('span', { text: 'Auto-Auszahlen bei' }), autoIn, el('span', { text: '×' }));
  goBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onGo }, el('span'), V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite' });
  root.appendChild(stage); root.appendChild(histEl); root.appendChild(msgEl);
  root.appendChild(el('div', { class: 'controls' }, betCtl.el, el('div', { class: 'spinbox' }, goBtn, autoRow)));
  root.appendChild(el('p', { class: 'fine', text: 'Der Multiplikator steigt, bis er an einem zufälligen Punkt abstürzt. Zahlst du vorher aus, bekommst du Einsatz × Multiplikator. Hausvorteil 1 %: Die Chance, 2,00× zu erreichen, liegt bei 49,5 %, für 10× bei 9,9 %.' }));
  V.busyFns.push(function () { return running; });
  window.addEventListener('resize', function () { size(); draw(); });
  readColors(); renderHist(); renderBtn();
}

function size() {
  if (!canvas) return;
  var r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  var w = Math.max(10, Math.round(r.width * d)), h = Math.max(10, Math.round(r.height * d));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx = canvas.getContext('2d');
}

function autoVal() {
  if (!autoChk.checked) return 0;
  var v = parseFloat(String(autoIn.value).replace(',', '.'));
  if (!isFinite(v) || v < 1.01) return 0;
  return Math.floor(v * 100) / 100;
}

function renderBtn() {
  var lb = goBtn.firstChild;
  if (!running) { lb.textContent = 'Einsteigen · ' + fmt(V.S.bets.crash); goBtn.disabled = false; goBtn.classList.remove('cash'); }
  else if (!cashed) { lb.textContent = 'Auszahlen · ' + fmt(Math.floor(bet * Math.floor(curM * 100) / 100)); goBtn.disabled = false; goBtn.classList.add('cash'); }
  else { lb.textContent = 'Überspringen'; goBtn.disabled = false; goBtn.classList.remove('cash'); }
  betCtl.disable(running);
  autoIn.disabled = running; autoChk.disabled = running;
}

function renderHist() {
  histEl.innerHTML = '';
  V.S.chist.slice(-16).reverse().forEach(function (c) {
    histEl.appendChild(el('span', { class: 'cp ' + (c >= 10 ? 'hi' : c >= 2 ? 'mid' : 'lo'), text: fmtX(c) }));
  });
}

function draw() {
  if (!ctx) size();
  if (!ctx) return;
  var w = canvas.width, h = canvas.height, d = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, w, h);
  var padL = 44 * d, padB = 26 * d, padT = 14 * d, padR = 14 * d;
  var tMax = Math.max(8, curT * 1.12), mMax = Math.max(2, 1 + (curM - 1) * 1.15);
  function X(t) { return padL + (t / tMax) * (w - padL - padR); }
  function Y(m) { return h - padB - ((m - 1) / (mMax - 1)) * (h - padB - padT); }
  ctx.font = (11 * d) + 'px "IBM Plex Mono", monospace';
  ctx.fillStyle = colors['--muted']; ctx.strokeStyle = colors['--line']; ctx.lineWidth = 1 * d;
  var steps = niceSteps(mMax - 1);
  for (var v = 0; v <= mMax - 1 + 1e-9; v += steps) {
    var y = Y(1 + v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText((1 + v).toFixed(steps < 1 ? 1 : 0).replace('.', ',') + '×', padL - 6 * d, y + 4 * d);
  }
  var ts = tMax > 30 ? 10 : tMax > 14 ? 4 : 2;
  ctx.textAlign = 'center';
  for (var t = 0; t <= tMax; t += ts) ctx.fillText(t + 's', X(t), h - 8 * d);
  if (curT <= 0) return;
  var col = crashedAt ? colors['--crimson'] : colors['--gold-hi'];
  ctx.beginPath(); ctx.moveTo(X(0), Y(1));
  var n = 80;
  for (var i = 1; i <= n; i++) { var tt = curT * i / n; ctx.lineTo(X(tt), Y(Math.min(E.crashMult(tt), curM))); }
  ctx.lineTo(X(curT), Y(1)); ctx.closePath();
  var g = ctx.createLinearGradient(0, padT, 0, h - padB);
  g.addColorStop(0, hexA(col, 0.35)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.moveTo(X(0), Y(1));
  for (var j = 1; j <= n; j++) { var t2 = curT * j / n; ctx.lineTo(X(t2), Y(Math.min(E.crashMult(t2), curM))); }
  ctx.strokeStyle = col; ctx.lineWidth = 3 * d; ctx.lineJoin = 'round'; ctx.stroke();
  /* Rakete an der Spitze, beim Absturz eine Explosion */
  var tx = X(curT), ty = Y(curM), tb = curT * 0.96;
  var ang = Math.atan2(ty - Y(Math.min(E.crashMult(tb), curM)), tx - X(tb));
  ctx.save(); ctx.translate(tx, ty); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (crashedAt) { ctx.font = (38 * d) + 'px serif'; ctx.fillText('💥', 0, 0); }
  else { ctx.rotate(ang + Math.PI / 4); ctx.font = (28 * d) + 'px serif'; ctx.fillText('🚀', 0, 0); }
  ctx.restore();
  if (cashed && cashAt > 0) {
    var tc = E.crashTime(cashAt);
    if (tc <= curT) {
      ctx.setLineDash([4 * d, 4 * d]); ctx.strokeStyle = colors['--good']; ctx.lineWidth = 1.5 * d;
      ctx.beginPath(); ctx.moveTo(padL, Y(cashAt)); ctx.lineTo(w - padR, Y(cashAt)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = colors['--good']; ctx.textAlign = 'left';
      ctx.fillText('ausgezahlt ' + fmtX(cashAt), padL + 6 * d, Y(cashAt) - 6 * d);
    }
  }
}
function niceSteps(range) {
  var raw = range / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
function hexA(c, a) {
  var m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return c;
  var n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

function onGo() {
  V.Snd.ensure();
  if (!running) start();
  else if (!cashed) cashout(Math.floor(curM * 100) / 100);
  else finish();
}

function start() {
  var S = V.S;
  bet = S.bets.crash;
  if (S.balance < bet) { V.needChips(); return; }
  V.debit(bet, true); V.hud();
  readColors(); size();
  cp = E.crashPoint();
  running = true; cashed = false; cashAt = 0; curM = 1; curT = 0; crashedAt = 0;
  root.querySelector('.crash-stage').classList.add('flying');
  multEl.className = 'crash-mult live'; subEl.textContent = 'Läuft …'; msgEl.textContent = ''; msgEl.className = 'slot-msg';
  t0 = performance.now();
  renderBtn();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

var lastTick = 0;
function loop(now) {
  if (!running) return;
  curT = (now - t0) / 1000;
  curM = E.crashMult(curT);
  var auto = autoVal();
  if (!cashed && auto && auto <= cp && curM >= auto) cashout(auto);
  if (curM >= cp) { curM = cp; curT = E.crashTime(cp); crash(); return; }
  multEl.textContent = fmtX(Math.floor(curM * 100) / 100);
  if (!cashed) renderBtn();
  if (now - lastTick > Math.max(70, 260 - curM * 20)) { V.Snd.tick(); lastTick = now; }
  draw();
  raf = requestAnimationFrame(loop);
}

function cashout(at) {
  if (!running || cashed || at > cp) return;
  cashed = true; cashAt = at;
  var ret = Math.floor(bet * at);
  V.settle('crash', bet, ret, { mult: at });
  V.S.bestMult = Math.max(V.S.bestMult, at);
  V.Snd.cash();
  subEl.textContent = 'Ausgezahlt bei ' + fmtX(at) + ': +' + fmt(ret - bet) + ' Chips';
  msgEl.className = 'slot-msg win';
  msgEl.textContent = 'Ausgezahlt: ' + fmt(ret) + ' Chips. Die Kurve läuft weiter, du kannst überspringen.';
  if (at >= 10) { V.Snd.big(); V.burst(V.$('#g-crash .crash-stage'), 30); V.banner('BIG CASHOUT', fmtX(at) + ' · +' + fmt(ret - bet), { kind: 'win', ms: 2400 }); }
  renderBtn();
}

function crash() {
  running = false; crashedAt = cp;
  root.querySelector('.crash-stage').classList.remove('flying');
  cancelAnimationFrame(raf);
  multEl.textContent = fmtX(cp); multEl.className = 'crash-mult dead';
  V.S.chist.push(cp); if (V.S.chist.length > 30) V.S.chist.shift();
  if (!cashed) {
    /* Talent Fallschirm: Sofort-Crash bei 1,00× kostet nichts */
    var safe = cp <= 1 && V.meta.perk('crashSafe') ? bet : 0;
    V.settle('crash', bet, safe, {});
    V.Snd.crash();
    subEl.textContent = 'Abgestürzt bei ' + fmtX(cp) + '. Einsatz verloren.';
    msgEl.className = 'slot-msg';
    msgEl.textContent = safe ? 'Sofort-Crash, aber dein Fallschirm hat den Einsatz gerettet.' : cp <= 1.0 ? 'Sofort-Crash bei 1,00×. Das passiert in etwa 2 von 100 Runden.' : 'Zu spät. ' + fmt(bet) + ' Chips gehen ans Haus.';
  } else {
    subEl.textContent = 'Abgestürzt bei ' + fmtX(cp) + ' · du hattest bei ' + fmtX(cashAt) + ' ausgezahlt.';
    if (cp > cashAt * 1.5) msgEl.textContent = 'Hättest du gewartet: ' + fmtX(cp) + '. Genau dieses Gefühl hält Spieler am Tisch.';
    V.save();
  }
  draw(); renderHist(); renderBtn();
}

function finish() {
  if (!running) return;
  curM = cp; curT = E.crashTime(cp);
  crash();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { onGo(); return true; }
  if ((k === 'arrowup' || k === '+') && !running) { betCtl.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !running) { betCtl.step(-1); return true; }
  if (k === 'a' && !running) { autoChk.checked = !autoChk.checked; autoChk.dispatchEvent(new Event('change')); V.Snd.click(); return true; }
  return false;
}

V.games.push({
  id: 'crash',
  init: build,
  onKey: onKey,
  keys: [['Leertaste', 'Einsteigen / Auszahlen'], ['↑ / ↓', 'Einsatz ändern'], ['A', 'Auto-Auszahlen an/aus']],
  onShow: function () { readColors(); size(); draw(); },
  onRoom: function () { betCtl.render(); renderBtn(); },
  refresh: function () { if (betCtl) { betCtl.render(); if (!running) renderBtn(); } }
});
})();
