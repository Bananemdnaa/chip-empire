/* Chip Empire – Gastspiel Früchte-Slot: klassischer Automat mit 3 Walzen und einer Linie.
   Drei gleiche zahlen laut Tabelle, Kirschen auf den ersten Walzen zahlen auch einzeln. Auszahlungsquote ≈ 95,8 % (nachgerechnet). */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
/* Symbol, Gewicht auf jeder Walze, Faktor für drei gleiche */
var SYM = [['🍒', 8, 10], ['🍋', 7, 12], ['🍊', 6, 20], ['🍇', 5, 30], ['🔔', 3, 60], ['⭐', 2, 150], ['7️⃣', 1, 500]];
var CHERRY2 = 3, CHERRY1 = 1;
var root, bet, reels = [], spinBtn, msgEl, payEl, busy = false;

function pickSym() { return V.pickW(SYM.map(function (s) { return [s[0], s[1]]; })); }
function payOf(a, b, c) {
  if (a === b && b === c) { for (var i = 0; i < SYM.length; i++) if (SYM[i][0] === a) return SYM[i][2]; }
  if (a === '🍒' && b === '🍒') return CHERRY2;
  if (a === '🍒') return CHERRY1;
  return 0;
}
function strip(r, mid) { var s = reels[r].querySelectorAll('.fr-sym'); s[0].textContent = pickSym(); s[1].textContent = mid; s[2].textContent = pickSym(); }

function build() {
  root = V.$('#g-fruit');
  bet = V.betControl('fruit');
  var box = el('div', { class: 'fr-reels' });
  for (var i = 0; i < 3; i++) {
    var r = el('div', { class: 'fr-reel' }, el('span', { class: 'fr-sym' }), el('span', { class: 'fr-sym mid' }), el('span', { class: 'fr-sym' }));
    reels.push(r); box.appendChild(r);
  }
  for (var j = 0; j < 3; j++) strip(j, ['7️⃣', '7️⃣', '7️⃣'][j]);
  var machine = el('div', { class: 'fr-machine' }, el('div', { class: 'fr-top', text: '🍒 FRÜCHTE-KLASSIKER 🍒' }), box, el('div', { class: 'fr-line' }));
  payEl = el('div', { class: 'sc-pays' }, SYM.slice().reverse().map(function (s) { return el('span', {}, el('b', { text: s[0] + s[0] + s[0] }), ' ' + s[2] + '×'); }),
    el('span', {}, el('b', { text: '🍒🍒' }), ' ' + CHERRY2 + '×'), el('span', {}, el('b', { text: '🍒' }), ' ' + CHERRY1 + '×'));
  spinBtn = el('button', { class: 'btn gold big', type: 'button', onclick: spin }, 'Drehen', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Drei gleiche auf der Linie gewinnen. Kirschen links zahlen schon einzeln.' });
  root.appendChild(el('div', { class: 'gx-layout' }, el('div', { class: 'gx-board' }, machine),
    el('div', { class: 'gx-side' }, el('span', { class: 'lbl', text: 'Gewinne' }), payEl, bet.el, spinBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Gastspiel. Klassischer Automat mit 3 Walzen und einer Gewinnlinie. Auszahlungsquote etwa 95,8 %.' }));
  V.busyFns.push(function () { return busy; });
}

async function spin() {
  if (busy) return;
  var S = V.S, b0 = S.bets.fruit;
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  busy = true; bet.disable(true); spinBtn.disabled = true;
  V.debit(b0, true); V.hud();
  var res = [pickSym(), pickSym(), pickSym()];
  reels.forEach(function (r) { r.classList.remove('stop'); r.classList.add('spin'); });
  msgEl.className = 'slot-msg'; msgEl.textContent = '…';
  /* Walzen halten nacheinander an */
  for (var t = 0, stopAt = [10, 16, 22]; t <= 22; t++) {
    for (var k = 0; k < 3; k++) {
      if (t < stopAt[k]) strip(k, pickSym());
      else if (t === stopAt[k]) { strip(k, res[k]); reels[k].classList.remove('spin'); reels[k].classList.add('stop'); V.Snd.card(); }
    }
    if (t % 2 === 0) V.Snd.tick();
    await sleep(55);
  }
  var m = payOf(res[0], res[1], res[2]), ret = m ? V.payout(b0, m) : 0;
  busy = false; bet.disable(false); spinBtn.disabled = false;
  V.settle('fruit', b0, ret, { fruitMult: m, near: !m && res[0] === res[1] });
  root.querySelector('.fr-machine').classList.toggle('won', m >= 10);
  msgEl.className = 'slot-msg ' + (ret > b0 ? 'win' : '');
  msgEl.textContent = m ? res.join(' ') + ' · ' + m + '× · ' + (ret > b0 ? '+' + fmt(ret - b0) + ' Chips' : 'Einsatz zurück') : res.join(' ') + ' · leider nichts';
  if (m >= 60) { V.Snd.big(); V.burst(root.querySelector('.fr-machine'), 50); V.banner(res[0] + res[1] + res[2], m + '× · +' + fmt(ret - b0) + ' Chips', { kind: 'win', ms: 2600 }); }
  else if (m > 1) V.Snd.win(); else if (!m) V.Snd.lose();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { spin(); return true; }
  if ((k === 'arrowup' || k === '+') && !busy) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !busy) { bet.step(-1); return true; }
  return false;
}
V.games.push({ id: 'fruit', init: build, onKey: onKey, keys: [['Leertaste', 'Drehen'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); }, refresh: function () { if (!busy) bet.render(); } });
})();
