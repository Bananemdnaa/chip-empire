/* Chip Empire – Gastspiel Rubbellos: Los kaufen, 9 Felder freirubbeln, drei gleiche Symbole gewinnen.
   Das Ergebnis steht beim Kauf fest (wie bei echten Losen). Gewinnchance 40,8 %, Auszahlungsquote 95 %. */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt;
/* Symbol, Faktor, Wahrscheinlichkeit */
var PRIZES = [['💎', 100, 0.001], ['7️⃣', 20, 0.005], ['🍀', 10, 0.012], ['🔔', 5, 0.03], ['🍒', 2, 0.12], ['⭐', 1, 0.24]];
var root, bet, gridEl, buyBtn, allBtn, msgEl, payEl, card = null, cellEls = [];

/* Los erzeugen: bei Gewinn genau ein Symbol dreimal, alle anderen höchstens zweimal */
function makeCard() {
  var r = E.rand(), win = null, acc = 0;
  for (var i = 0; i < PRIZES.length; i++) { acc += PRIZES[i][2]; if (r < acc) { win = PRIZES[i]; break; } }
  var syms = PRIZES.map(function (p) { return p[0]; }), cells = [], count = {};
  if (win) { cells.push(win[0], win[0], win[0]); count[win[0]] = 3; }
  while (cells.length < 9) {
    var s = syms[E.randInt(syms.length)];
    if ((count[s] || 0) >= 2 || (win && s === win[0])) continue;
    count[s] = (count[s] || 0) + 1; cells.push(s);
  }
  for (var k = cells.length - 1; k > 0; k--) { var j = E.randInt(k + 1), t = cells[k]; cells[k] = cells[j]; cells[j] = t; }
  return { cells: cells, open: [], win: win };
}
function mult(sym) { for (var i = 0; i < PRIZES.length; i++) if (PRIZES[i][0] === sym) return PRIZES[i][1]; return 0; }

function render() {
  cellEls.forEach(function (c, i) {
    var open = card && card.open.indexOf(i) >= 0, sym = card ? card.cells[i] : '';
    c.className = 'sc-cell' + (card ? '' : ' empty') + (open ? ' open' : '') + (open && card.win && sym === card.win[0] && done() ? ' win' : '');
    c.textContent = open ? sym : card ? '' : '';
    c.disabled = !card || open;
    c.setAttribute('aria-label', open ? 'Feld ' + (i + 1) + ': ' + sym : 'Feld ' + (i + 1) + ' freirubbeln');
  });
  buyBtn.hidden = !!card; allBtn.hidden = !card;
  bet.disable(!!card);
}
function done() { return card && card.open.length >= 9; }
function reveal(i) {
  if (!card || card.open.indexOf(i) >= 0) return;
  card.open.push(i);
  V.Snd.tick();
  render();
  if (done()) finish();
}
function revealAll() { if (!card) return; for (var i = 0; i < 9; i++) if (card.open.indexOf(i) < 0) card.open.push(i); V.Snd.card(); render(); finish(); }

function buy() {
  var S = V.S, b0 = S.bets.scratch;
  if (card) return;
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  V.debit(b0, true); V.hud();
  card = makeCard(); card.bet = b0;
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Tipp auf die Felder zum Freirubbeln.';
  V.Snd.chip();
  render();
}
function finish() {
  var c = card, m = c.win ? c.win[1] : 0, ret = m ? V.payout(c.bet, m) : 0;
  card = null;
  /* Gewinnfelder kurz hervorheben, dann das Los behalten, bis ein neues gekauft wird */
  cellEls.forEach(function (el2, i) { el2.className = 'sc-cell open' + (c.win && c.cells[i] === c.win[0] ? ' win' : ' dim'); el2.textContent = c.cells[i]; el2.disabled = true; });
  buyBtn.hidden = false; allBtn.hidden = true; bet.disable(false);
  V.settle('scratch', c.bet, ret, { scratchMult: m });
  msgEl.className = 'slot-msg ' + (ret > c.bet ? 'win' : '');
  msgEl.textContent = m ? 'Dreimal ' + c.win[0] + ': ' + String(m).replace('.', ',') + '× · ' + (ret > c.bet ? '+' + fmt(ret - c.bet) + ' Chips' : 'Einsatz zurück') : 'Leider nichts. Nächstes Los?';
  if (m >= 10) { V.Snd.big(); V.burst(gridEl, 40); V.banner('Dreimal ' + c.win[0], String(m) + '× · +' + fmt(ret - c.bet) + ' Chips', { kind: 'win', ms: 2600 }); }
  else if (m > 1) V.Snd.win(); else if (!m) V.Snd.lose(); else V.Snd.card();
}

function build() {
  root = V.$('#g-scratch');
  bet = V.betControl('scratch');
  gridEl = el('div', { class: 'sc-grid' });
  for (var i = 0; i < 9; i++) (function (i) {
    var c = el('button', { class: 'sc-cell empty', type: 'button', onclick: function () { reveal(i); } });
    /* Am Handy: mit dem Finger über die Felder wischen rubbelt sie frei */
    c.addEventListener('pointerenter', function (e) { if (e.buttons || e.pointerType === 'touch') reveal(i); });
    cellEls.push(c); gridEl.appendChild(c);
  })(i);
  gridEl.addEventListener('touchmove', function (e) {
    var t = e.touches[0], n = t && document.elementFromPoint(t.clientX, t.clientY), k = cellEls.indexOf(n);
    if (k >= 0) { e.preventDefault(); reveal(k); }
  }, { passive: false });
  buyBtn = el('button', { class: 'btn gold big', type: 'button', onclick: buy }, 'Los kaufen', V.kbd('Leertaste'));
  allBtn = el('button', { class: 'btn ghost big', type: 'button', hidden: true, onclick: revealAll }, 'Alles aufdecken', V.kbd('Leertaste'));
  payEl = el('div', { class: 'sc-pays' }, PRIZES.map(function (p) { return el('span', {}, el('b', { text: p[0] + p[0] + p[0] }), ' ' + p[1] + '×'); }));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Kauf ein Los und rubbel die Felder frei. Drei gleiche Symbole gewinnen.' });
  root.appendChild(el('div', { class: 'gx-layout' }, el('div', { class: 'gx-board sc-board' }, el('div', { class: 'sc-ticket' }, el('div', { class: 'sc-head', text: '✨ Goldrausch-Los ✨' }), gridEl)),
    el('div', { class: 'gx-side' }, el('span', { class: 'lbl', text: 'Gewinne' }), payEl, bet.el, buyBtn, allBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Gastspiel. Jedes Los hat höchstens einen Gewinn. Gewinnchance 40,8 %, Auszahlungsquote 95 %.' }));
  V.busyFns.push(function () { return !!card; });
  render();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { if (card) revealAll(); else buy(); return true; }
  if ((k === 'arrowup' || k === '+') && !card) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !card) { bet.step(-1); return true; }
  return false;
}
V.games.push({ id: 'scratch', init: build, onKey: onKey, keys: [['Leertaste', 'Los kaufen / alles aufdecken'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); }, refresh: function () { if (!card) bet.render(); } });
})();
