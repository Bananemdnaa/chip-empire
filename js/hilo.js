/* Chip Empire – Hi-Lo-Leiter: Ist die nächste Karte höher oder tiefer? Jede richtige Antwort
   ist eine Sprosse nach oben, der Multiplikator wächst. Eine falsche, und der Einsatz ist weg. */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, fmtX = V.fmtX, sleep = V.sleep;
var RTP = 0.98, CAP = 10000, RUNGS = 12;
/* Ass ist hoch: 2 = 2 … A = 14. Endloses Deck, jeder Rang gleich wahrscheinlich */
var NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
function rankName(r) { return NAMES[r] || String(r); }
function draw() { return { r: 2 + E.randInt(13), s: E.SUITS[E.randInt(4)] }; }
function pHi(r) { return (15 - r) / 13; }   /* höher oder gleich */
function pLo(r) { return (r - 1) / 13; }    /* tiefer oder gleich */
/* Talent Kartenzähler verbessert jede Sprosse leicht */
function factor(p) { return p >= 1 ? 0 : (RTP + V.meta.perk('hiloRead')) / p; }
function shown(m) { return Math.floor(m * 100) / 100; }

var root, cardBox, ladderEl, multEl, hiBtn, loBtn, skipBtn, goBtn, bet, msgEl;
var run = null; /* { bet, card, mult, steps, trail: [{card, ok, mult}], over } */

function cardEl(c, cls) {
  var red = c.s === '♥' || c.s === '♦', n = rankName(c.r);
  return el('div', { class: 'pcard ' + (red ? 'red' : 'blk') + (cls ? ' ' + cls : ''), 'aria-label': n + ' ' + c.s },
    el('span', { class: 'cr', text: n }), el('span', { class: 'cs', text: c.s }), el('span', { class: 'cmid', text: c.s }),
    el('span', { class: 'cbr' }, el('b', { text: n }), el('i', { text: c.s })));
}

function build() {
  root = V.$('#g-hilo');
  cardBox = el('div', { class: 'hl-card' });
  multEl = el('div', { class: 'hl-mult', 'aria-live': 'polite', text: '1,00×' });
  ladderEl = el('ol', { class: 'hl-ladder', 'aria-label': 'Leiter' });
  hiBtn = el('button', { class: 'hl-guess hi', type: 'button', onclick: function () { guess('hi'); } });
  loBtn = el('button', { class: 'hl-guess lo', type: 'button', onclick: function () { guess('lo'); } });
  skipBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: skip }, 'Karte überspringen', V.kbd('S'));
  var table = el('div', { class: 'hl-table' },
    el('div', { class: 'hl-stage' }, hiBtn, el('div', { class: 'hl-center' }, cardBox, multEl), loBtn), skipBtn);
  bet = V.betControl('hilo');
  goBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onGo }, el('span'), V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite' });
  root.appendChild(el('div', { class: 'hl-layout' }, table,
    el('div', { class: 'hl-side' }, el('span', { class: 'lbl', text: 'Deine Leiter' }), ladderEl, bet.el, goBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Rate, ob die nächste Karte höher oder tiefer ist (gleich zählt als richtig). Unwahrscheinliche Tipps zahlen mehr. Jede richtige Antwort multipliziert deinen Gewinn, eine falsche kostet den Einsatz. Überspringen ist kostenlos. Auszahlungsquote 98 % pro Sprosse, das Ass ist hoch.' }));
  V.busyFns.push(function () { return !!run; });
  render();
}

function guessLabel(btn, dir, card) {
  var p = dir === 'hi' ? pHi(card.r) : pLo(card.r), f = factor(p);
  btn.innerHTML = '';
  btn.appendChild(el('b', { text: dir === 'hi' ? '▲ Höher' : '▼ Tiefer' }));
  btn.appendChild(el('small', { text: f ? fmtX(shown(f)) + ' · ' + Math.round(p * 100) + ' %' : 'sicher, zahlt nichts' }));
  btn.appendChild(V.kbd(dir === 'hi' ? '↑' : '↓'));
  btn.disabled = !run || run.over || !f;
}

function render() {
  var card = run ? run.card : null;
  cardBox.innerHTML = '';
  cardBox.appendChild(card ? cardEl(card, 'deal') : el('div', { class: 'pcard back' }));
  multEl.textContent = fmtX(run ? shown(run.mult) : 1);
  multEl.classList.toggle('hot', !!(run && run.steps));
  if (card) { guessLabel(hiBtn, 'hi', card); guessLabel(loBtn, 'lo', card); }
  else {
    [hiBtn, loBtn].forEach(function (b, i) { b.innerHTML = ''; b.appendChild(el('b', { text: i ? '▼ Tiefer' : '▲ Höher' })); b.disabled = true; });
  }
  skipBtn.disabled = !run || run.over;
  /* Leiter: oben die nächste Sprosse, darunter die geschafften */
  ladderEl.innerHTML = '';
  var steps = run ? run.steps : 0;
  for (var i = Math.max(RUNGS, steps + 1); i >= 1; i--) {
    var t = run && run.trail[i - 1], cls = 'hl-rung' + (i <= steps ? ' done' : i === steps + 1 && run && !run.over ? ' next' : '') + (t && !t.ok ? ' fail' : '');
    ladderEl.appendChild(el('li', { class: cls }, el('span', { class: 'hl-no', text: String(i) }),
      el('span', { class: 'hl-c', text: t ? rankName(t.card.r) + t.card.s : '' }),
      el('b', { text: t && t.ok ? fmtX(shown(t.mult)) : '' })));
  }
  bet.disable(!!run);
  var lb = goBtn.firstChild;
  if (!run) { lb.textContent = 'Erste Karte · ' + fmt(V.S.bets.hilo); goBtn.disabled = false; goBtn.classList.remove('cash'); }
  else if (!run.steps) { lb.textContent = 'Höher oder tiefer?'; goBtn.disabled = true; goBtn.classList.remove('cash'); }
  else { lb.textContent = 'Auszahlen · ' + fmt(V.payout(run.bet, shown(run.mult))); goBtn.disabled = run.over; goBtn.classList.add('cash'); }
  if (!run && !msgEl.textContent) msgEl.textContent = 'Setz deinen Einsatz und dreh die erste Karte um.';
}

function start() {
  var S = V.S, b0 = S.bets.hilo;
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  V.debit(b0, true); V.hud();
  run = { bet: b0, card: draw(), mult: 1, steps: 0, trail: [], over: false };
  V.Snd.card();
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Höher oder tiefer?';
  render();
}

function skip() {
  if (!run || run.over) return;
  run.card = draw();
  V.Snd.card();
  render();
}

async function guess(dir) {
  if (!run || run.over) return;
  var c = run.card, p = dir === 'hi' ? pHi(c.r) : pLo(c.r), f = factor(p);
  if (!f) return;
  var n = draw(), ok = dir === 'hi' ? n.r >= c.r : n.r <= c.r;
  run.card = n;
  if (!ok) {
    run.over = true;
    run.trail.push({ card: n, ok: false, mult: 0 });
    render();
    cardBox.classList.remove('shake'); void cardBox.offsetWidth; cardBox.classList.add('shake');
    V.Snd.crash();
    V.settle('hilo', run.bet, 0, { hiloSteps: run.steps });
    msgEl.className = 'slot-msg';
    msgEl.textContent = rankName(n.r) + n.s + ' – daneben. ' + (run.steps ? 'Nach ' + run.steps + ' Sprossen sind ' + fmtX(shown(run.mult)) + ' weg.' : fmt(run.bet) + ' Chips gehen ans Haus.');
    await sleep(1700);
    run = null; render();
    return;
  }
  run.mult = Math.min(CAP, run.mult * f); run.steps++;
  run.trail.push({ card: n, ok: true, mult: run.mult });
  V.Snd.step(run.steps);
  multEl.classList.remove('bump'); void multEl.offsetWidth; multEl.classList.add('bump');
  render();
  if (run.mult >= CAP) { await cashout(); return; }
  msgEl.className = 'slot-msg win';
  msgEl.textContent = rankName(n.r) + n.s + ' – richtig! Sprosse ' + run.steps + ': ' + fmtX(shown(run.mult)) + '. Weiter oder auszahlen?';
}

async function cashout() {
  if (!run || !run.steps || run.over) return;
  var m = shown(run.mult), ret = V.payout(run.bet, m), net = ret - run.bet;
  run.over = true;
  render();
  V.settle('hilo', run.bet, ret, { hiloSteps: run.steps, hiloMult: m });
  msgEl.className = 'slot-msg win';
  msgEl.textContent = 'Ausgezahlt nach ' + run.steps + ' Sprossen: ' + fmtX(m) + ', +' + fmt(net) + ' Chips';
  if (m >= 10) { V.Snd.big(); V.burst(cardBox, 36); V.banner(fmtX(m), '+' + fmt(net) + ' Chips · ' + run.steps + ' Sprossen', { kind: 'win', ms: 2600 }); }
  else V.Snd.cash();
  await sleep(1300);
  run = null; render();
}

function onGo() { if (!run) start(); else cashout(); }

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { onGo(); return true; }
  if (run) {
    if (k === 'arrowup' || k === 'h') { guess('hi'); return true; }
    if (k === 'arrowdown' || k === 't') { guess('lo'); return true; }
    if (k === 's') { skip(); return true; }
    return false;
  }
  if (k === 'arrowup' || k === '+') { bet.step(1); return true; }
  if (k === 'arrowdown' || k === '-') { bet.step(-1); return true; }
  return false;
}

V.games.push({
  id: 'hilo', init: build, onKey: onKey,
  keys: [['Leertaste', 'Erste Karte / Auszahlen'], ['↑ / ↓', 'Höher / tiefer (im Spiel), sonst Einsatz'], ['S', 'Karte überspringen']],
  onRoom: function () { bet.render(); render(); }, refresh: function () { if (!run) { bet.render(); render(); } }
});
})();
