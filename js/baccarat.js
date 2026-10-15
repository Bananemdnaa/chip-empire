/* Chip Empire – Gastspiel Baccarat: Wetten auf Spieler, Bank oder Unentschieden, Karten nach den klassischen Regeln.
   Spieler zahlt 2×, Bank 1,95× (5 % Kommission), Unentschieden 9×; bei Unentschieden gibt es Spieler- und Bankwetten zurück.
   Auszahlungsquote: Spieler 98,8 %, Bank 98,9 %, Unentschieden 85,9 % (nachgerechnet, 8 Decks ≈ unendlicher Schuh). */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
var FIELDS = [
  { key: 'P', label: 'Spieler', pay: 2, sub: 'zahlt 2×' },
  { key: 'T', label: 'Remis', pay: 9, sub: 'zahlt 9×' },
  { key: 'B', label: 'Bank', pay: 1.95, sub: 'zahlt 1,95×' }
];
var root, table, cells = {}, pHand, bHand, pVal, bVal, dealBtn, msgEl, histEl, busy = false, hist = [];

function draw() { return { r: RANKS[E.randInt(13)], s: SUITS[E.randInt(4)] }; }
function pts(c) { var i = RANKS.indexOf(c.r); return i >= 9 ? 0 : i + 1; }
function total(h) { var t = 0; h.forEach(function (c) { t += pts(c); }); return t % 10; }
/* Dritte Karte der Bank, abhängig von ihrer Summe und der dritten Karte des Spielers */
function bankDraws(b, p3) {
  if (b <= 2) return true;
  if (b === 3) return p3 !== 8;
  if (b === 4) return p3 >= 2 && p3 <= 7;
  if (b === 5) return p3 >= 4 && p3 <= 7;
  if (b === 6) return p3 === 6 || p3 === 7;
  return false;
}
function cardEl(c) {
  var red = c.s === '♥' || c.s === '♦';
  return el('div', { class: 'pcard deal ' + (red ? 'red' : 'blk'), 'aria-label': c.r + ' ' + c.s },
    el('span', { class: 'cr', text: c.r }), el('span', { class: 'cs', text: c.s }), el('span', { class: 'cmid', text: c.s }),
    el('span', { class: 'cbr' }, el('b', { text: c.r }), el('i', { text: c.s })));
}

function renderCells(bets, locked) {
  FIELDS.forEach(function (f) {
    var c = cells[f.key], amt = bets[f.key] || 0, ch = c.querySelector('.rchip');
    ch.hidden = amt <= 0; ch.textContent = amt > 0 ? V.short(amt) : '';
    c.classList.toggle('has', amt > 0); c.disabled = locked;
  });
  if (dealBtn) dealBtn.disabled = locked || table.total() <= 0;
}
function build() {
  root = V.$('#g-bacc');
  table = V.chipBets({ onRender: renderCells });
  pHand = el('div', { class: 'bc-cards' }); bHand = el('div', { class: 'bc-cards' });
  pVal = el('b', { class: 'bc-val' }); bVal = el('b', { class: 'bc-val' });
  var felt = el('div', { class: 'bc-felt' },
    el('div', { class: 'bc-side' }, el('span', { class: 'lbl', text: 'Spieler' }), pVal, pHand),
    el('div', { class: 'bc-side' }, el('span', { class: 'lbl', text: 'Bank' }), bVal, bHand));
  var bets = el('div', { class: 'bc-bets' });
  FIELDS.forEach(function (f) {
    var c = el('button', { class: 'dcell big bc-' + f.key, type: 'button', onclick: function () { table.place(f.key); } },
      el('b', { text: f.label }), el('span', { class: 'pay', text: f.sub }), el('span', { class: 'rchip', hidden: true }));
    cells[f.key] = c; bets.appendChild(c);
  });
  dealBtn = el('button', { class: 'btn gold big', type: 'button', onclick: deal }, 'Austeilen', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Setz auf Spieler, Bank oder Remis (Unentschieden). Näher an 9 gewinnt.' });
  histEl = el('div', { class: 'fw-hist', 'aria-label': 'Letzte Ergebnisse' });
  root.appendChild(el('div', { class: 'gx-layout' }, el('div', { class: 'gx-board' }, felt, histEl),
    el('div', { class: 'gx-side' }, bets, table.controls(), dealBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Gastspiel. Bildkarten und Zehner zählen 0, Asse 1, gezählt wird nur die Einerstelle. Eine dritte Karte gibt es nach festen Regeln. Auszahlungsquote: Spieler 98,8 %, Bank 98,9 %, Remis 85,9 %.' }));
  V.busyFns.push(function () { return busy || table.total() > 0; });
  renderCells(table.bets(), false);
}

async function show(hand, box, valEl, c) { hand.push(c); box.appendChild(cardEl(c)); valEl.textContent = String(total(hand)); V.Snd.card(); await sleep(380); }
async function deal() {
  if (busy) return;
  var bets = table.commit();
  if (!bets) return;
  V.Snd.ensure();
  busy = true;
  pHand.innerHTML = ''; bHand.innerHTML = ''; pVal.textContent = ''; bVal.textContent = '';
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Karten …';
  var p = [], b = [];
  await show(p, pHand, pVal, draw()); await show(b, bHand, bVal, draw());
  await show(p, pHand, pVal, draw()); await show(b, bHand, bVal, draw());
  var pt = total(p), bt = total(b);
  if (pt < 8 && bt < 8) {
    var p3 = null;
    if (pt <= 5) { var c3 = draw(); p3 = pts(c3); await show(p, pHand, pVal, c3); }
    if (p3 === null ? bt <= 5 : bankDraws(bt, p3)) await show(b, bHand, bVal, draw());
  }
  pt = total(p); bt = total(b);
  var res = pt > bt ? 'P' : bt > pt ? 'B' : 'T', stake = 0, ret = 0;
  for (var k in bets) {
    stake += bets[k];
    if (k === res) ret += V.payout(bets[k], FIELDS.filter(function (f) { return f.key === k; })[0].pay);
    else if (res === 'T') ret += bets[k];
  }
  hist.push(res);
  histEl.innerHTML = '';
  hist.slice(-14).reverse().forEach(function (h) { histEl.appendChild(el('span', { class: 'bc-h ' + h, text: h === 'P' ? 'S' : h === 'B' ? 'B' : 'R' })); });
  busy = false;
  V.settle('bacc', stake, ret, { baccRes: res });
  table.reset();
  var net = ret - stake;
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = (res === 'P' ? 'Spieler gewinnt ' : res === 'B' ? 'Bank gewinnt ' : 'Remis ') + pt + ' : ' + bt + ' · ' + (net > 0 ? '+' : net < 0 ? '−' : '±') + fmt(Math.abs(net)) + ' Chips';
  if (net > 0) (res === 'T' ? V.Snd.big : V.Snd.win)(); else if (net < 0) V.Snd.lose();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { deal(); return true; }
  if (k === 's') { table.place('P'); return true; }
  if (k === 'b') { table.place('B'); return true; }
  if (k === 'r') { table.place('T'); return true; }
  return table.onKey(k);
}
V.games.push({ id: 'bacc', init: build, onKey: onKey, keys: [['Leertaste', 'Austeilen'], ['S / B / R', 'Auf Spieler, Bank oder Remis setzen']],
  onRoom: function () { table.render(); }, refresh: function () { if (!busy) table.render(); } });
})();
