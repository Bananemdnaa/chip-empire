/* Velvet Room – Blackjack (6 Decks, Dealer steht auf soft 17, Blackjack zahlt 3:2) */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;

var root, dealerEl, handsEl, msgEl, ctlEl, betCtl, dealBtn, hintBtn, shoeEl, btns = {}, insRow, adviceEl;
var st = null, shoe = null, dealerShown = 1, busy = false, seen = new Map();
var NAMEACT = { hit: 'Karte', stand: 'Halten', double: 'Verdoppeln', split: 'Teilen', surrender: 'Aufgeben' };

function isRed(c) { return c.s === '♥' || c.s === '♦'; }
function cardEl(c, down) {
  var key = down ? 'down' : 'up', prev = seen.get(c);
  var n;
  if (down) n = el('div', { class: 'pcard back', 'aria-label': 'Verdeckte Karte' });
  else n = el('div', { class: 'pcard ' + (isRed(c) ? 'red' : 'blk'), 'aria-label': c.r + ' ' + c.s },
    el('span', { class: 'cr', text: c.r }), el('span', { class: 'cs', text: c.s }), el('span', { class: 'cbig', text: c.s }));
  if (prev !== key) { n.classList.add('deal'); seen.set(c, key); }
  return n;
}
function valText(cards) {
  var v = E.handValue(cards);
  return v.soft && v.total < 21 ? (v.total - 10) + ' / ' + v.total : String(v.total);
}

function build() {
  root = V.$('#g-bj');
  dealerEl = el('div', { class: 'bj-dealer' });
  handsEl = el('div', { class: 'bj-hands' });
  msgEl = el('div', { class: 'bj-msg', 'aria-live': 'polite', text: 'Schlag den Dealer, ohne über 21 zu kommen. Blackjack zahlt 3:2.' });
  shoeEl = el('div', { class: 'fine bj-shoe' });
  var table = el('div', { class: 'bj-table' }, dealerEl, msgEl, handsEl, shoeEl);

  betCtl = V.betControl('bj');
  dealBtn = el('button', { class: 'btn gold big', type: 'button', text: 'Austeilen', onclick: deal });
  ['hit', 'stand', 'double', 'split', 'surrender'].forEach(function (k) {
    btns[k] = el('button', { class: 'btn act', type: 'button', text: NAMEACT[k], onclick: function () { act(k); } });
  });
  insRow = el('div', { class: 'ins-row', hidden: true },
    el('span', { class: 'ins-txt' }),
    el('button', { class: 'btn ghost', type: 'button', text: 'Versichern', onclick: function () { insure(true); } }),
    el('button', { class: 'btn ghost', type: 'button', text: 'Nein danke', onclick: function () { insure(false); } }));
  hintBtn = el('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': String(V.S.hint), text: V.S.hint ? 'Strategie-Tipp an' : 'Strategie-Tipp aus', onclick: function () {
    V.S.hint = !V.S.hint; V.save(); renderBJ(); V.Snd.click();
  } });
  adviceEl = el('div', { class: 'advice', 'aria-live': 'polite' });
  var acts = el('div', { class: 'acts' }, btns.hit, btns.stand, btns.double, btns.split, btns.surrender);
  ctlEl = el('div', { class: 'controls' }, betCtl.el, el('div', { class: 'spinbox' }, dealBtn, hintBtn));
  root.appendChild(table); root.appendChild(insRow); root.appendChild(acts); root.appendChild(adviceEl); root.appendChild(ctlEl);
  root.appendChild(el('p', { class: 'fine', text: '6 Decks, Dealer steht auf soft 17, Verdoppeln nach dem Teilen, bis zu 4 Hände, späte Aufgabe, Versicherung 2:1. Mit Basisstrategie liegt der Hausvorteil bei etwa 0,4 %. Ohne sie deutlich höher.' }));
  V.busyFns.push(function () { return busy || (st && st.phase !== 'done'); });
  renderBJ();
}

function active() { return st && st.phase !== 'done'; }

function renderBJ() {
  var S = V.S;
  dealerEl.innerHTML = '';
  handsEl.innerHTML = '';
  var inRound = st && !busy && st.phase !== 'done';
  if (!st) {
    dealerEl.appendChild(el('div', { class: 'hand-h' }, el('b', { text: 'Dealer' })));
    dealerEl.appendChild(el('div', { class: 'hand-cards empty', text: 'Setz deinen Einsatz und teile aus.' }));
  } else {
    var shownCards = st.dealer.slice(0, dealerShown);
    var head = el('div', { class: 'hand-h' }, el('b', { text: 'Dealer' }), el('span', { class: 'hv', text: valText(shownCards) }));
    var cards = el('div', { class: 'hand-cards' });
    st.dealer.forEach(function (c, i) {
      if (i === 1 && dealerShown < 2) cards.appendChild(cardEl(c, true));
      else if (i < dealerShown) cards.appendChild(cardEl(c, false));
    });
    dealerEl.appendChild(head); dealerEl.appendChild(cards);
    st.hands.forEach(function (h, i) {
      var isAct = st.phase === 'player' && i === st.active && !busy;
      var wrap = el('div', { class: 'hand' + (isAct ? ' active' : '') + (h.result ? ' res-' + h.result : '') });
      var hh = el('div', { class: 'hand-h' }, el('b', { text: st.hands.length > 1 ? 'Hand ' + (i + 1) : 'Du' }),
        el('span', { class: 'hv', text: valText(h.cards) }), el('span', { class: 'hbet', text: fmt(h.bet) }));
      var hc = el('div', { class: 'hand-cards' });
      h.cards.forEach(function (c) { hc.appendChild(cardEl(c, false)); });
      wrap.appendChild(hh); wrap.appendChild(hc);
      if (h.result && st.settled) {
        var L = { win: 'Gewonnen', blackjack: 'Blackjack', push: 'Push', lose: 'Verloren', bust: 'Bust', surrender: 'Aufgegeben' }[h.result];
        var d = h.payout - h.bet;
        wrap.appendChild(el('div', { class: 'hres ' + h.result, text: L + (d !== 0 && h.result !== 'surrender' ? ' ' + (d > 0 ? '+' : '−') + fmt(Math.abs(d)) : (h.result === 'surrender' ? ' −' + fmt(h.bet - h.payout) : '')) }));
      }
      handsEl.appendChild(wrap);
    });
  }
  /* Schuh */
  if (shoe) {
    var left = Math.round((1 - shoe.pos / shoe.cards.length) * 100);
    shoeEl.textContent = 'Schuh: ' + left + ' % übrig, Mischen bei 25 %.';
  } else shoeEl.textContent = 'Frischer Schuh mit 6 Decks.';
  /* Knöpfe */
  var can = inRound ? E.bjCan(st, S.balance) : { hit: false, stand: false, double: false, split: false, surrender: false, insurance: false };
  var inIns = st && st.phase === 'insurance' && !busy;
  insRow.hidden = !inIns;
  if (inIns) {
    var cost = Math.floor(st.bet0 / 2);
    insRow.querySelector('.ins-txt').textContent = 'Dealer zeigt ein Ass. Versicherung für ' + fmt(cost) + ' Chips (zahlt 2:1)?';
    insRow.querySelectorAll('button')[0].disabled = S.balance < cost;
  }
  ['hit', 'stand', 'double', 'split', 'surrender'].forEach(function (k) {
    btns[k].disabled = !can[k];
    btns[k].classList.remove('rec');
  });
  var canDeal = !busy && (!st || st.phase === 'done');
  dealBtn.disabled = !canDeal;
  dealBtn.textContent = canDeal ? 'Austeilen · ' + fmt(S.bets.bj) : 'Läuft …';
  betCtl.disable(!canDeal);
  hintBtn.setAttribute('aria-pressed', String(S.hint));
  hintBtn.textContent = S.hint ? 'Strategie-Tipp an' : 'Strategie-Tipp aus';
  adviceEl.textContent = '';
  if (S.hint && inRound) {
    var h2 = st.hands[st.active];
    var a = E.bjAdvice(h2.cards, st.dealer[0], can);
    if (!can[a]) a = can.stand ? 'stand' : 'hit';
    if (btns[a]) btns[a].classList.add('rec');
    adviceEl.textContent = 'Basisstrategie empfiehlt: ' + NAMEACT[a] + '.';
  } else if (S.hint && inIns) {
    adviceEl.textContent = 'Basisstrategie empfiehlt: keine Versicherung. Auf lange Sicht ist sie eine Verlustwette.';
  }
}

async function deal() {
  var S = V.S;
  if (busy || (st && st.phase !== 'done')) return;
  var bet = S.bets.bj;
  if (S.balance < bet) { V.needChips(); return; }
  V.Snd.ensure();
  if (!shoe || E.shoeNeedsShuffle(shoe)) { if (shoe) V.toast('Der Dealer mischt einen neuen Schuh.', ''); shoe = E.newShoe(6); }
  V.debit(bet, true);
  seen = new Map();
  dealerShown = 1;
  st = E.bjDeal(shoe, bet);
  msgEl.className = 'bj-msg'; msgEl.textContent = '';
  V.Snd.card();
  V.hud();
  renderBJ();
  if (st.phase === 'done') await finishRound();
  else if (st.phase === 'insurance') msgEl.textContent = 'Dealer zeigt ein Ass.';
}

async function act(name) {
  var S = V.S;
  if (busy || !st || st.phase !== 'player') return;
  var can = E.bjCan(st, S.balance);
  if (!can[name]) return;
  V.Snd.card();
  if (name === 'hit') E.bjHit(st);
  else if (name === 'stand') E.bjStand(st);
  else if (name === 'surrender') E.bjSurrender(st);
  else if (name === 'double') {
    var c1 = st.hands[st.active].bet; V.debit(c1, true); E.bjDouble(st);
  } else if (name === 'split') {
    var c2 = st.hands[st.active].bet; V.debit(c2, true); E.bjSplit(st);
  }
  V.hud();
  renderBJ();
  if (st.phase === 'done') await finishRound();
  else {
    var h = st.hands[st.active];
    if (h && E.handValue(h.cards).total > 21) msgEl.textContent = '';
  }
}

async function insure(take) {
  if (busy || !st || st.phase !== 'insurance') return;
  var S = V.S, cost = Math.floor(st.bet0 / 2);
  if (take) {
    if (S.balance < cost) { V.needChips(); return; }
    V.debit(cost, true);
  }
  E.bjInsurance(st, take);
  V.hud();
  msgEl.textContent = '';
  renderBJ();
  if (st.phase === 'done') await finishRound();
}

async function finishRound() {
  busy = true; renderBJ();
  dealerShown = Math.max(dealerShown, 2); renderBJ(); V.Snd.card();
  await sleep(600);
  for (var i = 2; i < st.dealer.length; i++) {
    dealerShown = i + 1; renderBJ(); V.Snd.card(); await sleep(650);
  }
  st.settled = true;
  var net = st.returned - st.staked;
  var bust = st.hands.length === 1 && st.hands[0].result === 'bust';
  var nat = st.hands.some(function (h) { return h.result === 'blackjack'; });
  V.settle('bj', st.staked, st.returned, {});
  var txt;
  if (nat) txt = 'Blackjack! ' + (net > 0 ? '+' + fmt(net) + ' Chips' : '');
  else if (net > 0) txt = 'Gewonnen: +' + fmt(net) + ' Chips';
  else if (net < 0) txt = (bust ? 'Bust. ' : '') + 'Verloren: −' + fmt(-net) + ' Chips';
  else txt = 'Push: Einsatz zurück.';
  if (st.insuranceReturn > 0) txt += ' Versicherung zahlt +' + fmt(st.insuranceReturn - st.insurance) + '.';
  msgEl.className = 'bj-msg ' + (net > 0 ? 'win' : net < 0 ? 'lose' : '');
  msgEl.textContent = txt;
  if (bust && net < 0 && Math.random() < 0.6) V.say('bust', true);
  if (net > 0) { if (nat || net >= st.bet0 * 3) { V.Snd.big(); V.burst(V.$('#g-bj .bj-table'), 26); } else V.Snd.win(); }
  else if (net < 0) V.Snd.lose();
  busy = false;
  renderBJ();
}

V.games.push({
  id: 'bj',
  init: build,
  onRoom: function () { betCtl.render(); renderBJ(); },
  refresh: function () { if (betCtl) { betCtl.render(); renderBJ(); } }
});
})();
