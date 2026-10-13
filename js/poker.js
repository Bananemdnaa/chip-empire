/* Chip Empire – Video-Poker „Jacks or Better“: 5 Karten, halten, tauschen, Pokerhand zählt */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
/* Gesamtrückgabe als Vielfaches des Einsatzes; Auszahlungsquote mit guter Strategie etwa 98 % */
var HANDS = [
  { key: 'royal', name: 'Royal Flush', pay: 250 },
  { key: 'sflush', name: 'Straight Flush', pay: 50 },
  { key: 'quads', name: 'Vierling', pay: 25 },
  { key: 'full', name: 'Full House', pay: 9 },
  { key: 'flush', name: 'Flush', pay: 6 },
  { key: 'straight', name: 'Straße', pay: 4 },
  { key: 'trips', name: 'Drilling', pay: 3 },
  { key: 'twopair', name: 'Zwei Paare', pay: 2 },
  { key: 'jacks', name: 'Paar ab Bube', pay: 1 }
];
var RANK_OF = { jacks: 1, twopair: 2, trips: 3, straight: 4, flush: 5, full: 6, quads: 7, sflush: 8, royal: 9 };
var KEYS = ['q', 'w', 'e', 'r', 't'];
function val(c) { return c.r === 'A' ? 14 : c.r === 'K' ? 13 : c.r === 'Q' ? 12 : c.r === 'J' ? 11 : Number(c.r); }

/* Bewertung einer 5-Karten-Hand; gibt Schlüssel und die zählenden Karten zurück */
function evaluate(cards) {
  var vs = cards.map(val).sort(function (a, b) { return a - b; });
  var cnt = {}; vs.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
  var groups = Object.keys(cnt).map(Number).sort(function (a, b) { return cnt[b] - cnt[a] || b - a; });
  var flush = cards.every(function (c) { return c.s === cards[0].s; });
  var uniq = groups.length === 5;
  var wheel = uniq && vs.join() === '2,3,4,5,14';
  var straight = uniq && (vs[4] - vs[0] === 4 || wheel);
  var all = [0, 1, 2, 3, 4];
  function idxOf(vals) { return all.filter(function (i) { return vals.indexOf(val(cards[i])) >= 0; }); }
  if (straight && flush) return { key: vs[0] === 10 ? 'royal' : 'sflush', idx: all };
  if (cnt[groups[0]] === 4) return { key: 'quads', idx: idxOf([groups[0]]) };
  if (cnt[groups[0]] === 3 && cnt[groups[1]] === 2) return { key: 'full', idx: all };
  if (flush) return { key: 'flush', idx: all };
  if (straight) return { key: 'straight', idx: all };
  if (cnt[groups[0]] === 3) return { key: 'trips', idx: idxOf([groups[0]]) };
  if (cnt[groups[0]] === 2 && cnt[groups[1]] === 2) return { key: 'twopair', idx: idxOf([groups[0], groups[1]]) };
  if (cnt[groups[0]] === 2 && groups[0] >= 11) return { key: 'jacks', idx: idxOf([groups[0]]) };
  return { key: null, idx: [] };
}
/* Einfacher Halte-Tipp nach gängiger Strategie */
function advise(cards) {
  var ev = evaluate(cards), all = [0, 1, 2, 3, 4];
  if (ev.key && ['straight', 'flush', 'full', 'sflush', 'royal'].indexOf(ev.key) >= 0) return all;
  if (ev.key) return ev.idx;
  var bySuit = {}; cards.forEach(function (c, i) { (bySuit[c.s] = bySuit[c.s] || []).push(i); });
  for (var s in bySuit) if (bySuit[s].length === 4) return bySuit[s];
  var pairs = {}; cards.forEach(function (c, i) { (pairs[c.r] = pairs[c.r] || []).push(i); });
  for (var r in pairs) if (pairs[r].length === 2) return pairs[r];
  var vs = cards.map(val);
  for (var lo = 2; lo <= 10; lo++) {
    var need = [lo, lo + 1, lo + 2, lo + 3], hit = [];
    need.forEach(function (v) { var i = vs.indexOf(v); if (i >= 0) hit.push(i); });
    if (hit.length === 4 && lo >= 2 && lo + 3 <= 13) return hit;
  }
  return all.filter(function (i) { return vs[i] >= 11; }).slice(0, 2);
}

var root, cardsEl, payEl, bet, goBtn, tipBtn, msgEl, slots = [];
var phase = 'idle', deck = null, hand = [], held = [false, false, false, false, false], stake = 0;

function isRed(c) { return c.s === '♥' || c.s === '♦'; }
function cardNode(c, i) {
  var n = c ? el('div', { class: 'pcard pk ' + (isRed(c) ? 'red' : 'blk'), 'aria-label': c.r + ' ' + c.s },
    el('span', { class: 'cr', text: c.r }), el('span', { class: 'cs', text: c.s }), el('span', { class: 'cmid', text: c.s }),
    el('span', { class: 'cbr' }, el('b', { text: c.r }), el('i', { text: c.s })))
    : el('div', { class: 'pcard pk back' });
  return n;
}

function build() {
  root = V.$('#g-poker');
  payEl = el('div', { class: 'vp-pay' });
  HANDS.forEach(function (h) { payEl.appendChild(el('div', { class: 'vp-row', 'data-key': h.key }, el('span', { text: h.name }), el('b', { class: 'num', text: h.pay + '×' }))); });
  cardsEl = el('div', { class: 'vp-cards' });
  for (var i = 0; i < 5; i++) (function (i) {
    var slot = el('button', { class: 'vp-slot', type: 'button', disabled: true, 'aria-pressed': 'false', onclick: function () { toggle(i); } },
      el('div', { class: 'vp-card' }), el('span', { class: 'vp-hold' }, 'Halten', V.kbd(KEYS[i].toUpperCase())));
    slots.push(slot); cardsEl.appendChild(slot);
  })(i);
  bet = V.betControl('poker');
  goBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onGo }, el('span'), V.kbd('Leertaste'));
  tipBtn = el('button', { class: 'btn ghost sm', type: 'button', onclick: tip, disabled: true }, 'Halte-Tipp', V.kbd('H'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Teil aus, halte die Karten, die du behalten willst, und tausch den Rest einmal.' });
  root.appendChild(el('div', { class: 'vp-machine' }, payEl, cardsEl, msgEl,
    el('div', { class: 'controls' }, bet.el, el('div', { class: 'spinbox' }, goBtn, tipBtn))));
  root.appendChild(el('p', { class: 'fine', text: 'Jacks or Better mit einem Deck. Ab einem Paar Buben gibt es den Einsatz zurück, darüber Gewinne bis 250× für den Royal Flush. Mit guter Strategie liegt die Auszahlung bei etwa 98 %.' }));
  V.busyFns.push(function () { return phase !== 'idle'; });
  render();
}

function render(win) {
  slots.forEach(function (s, i) {
    var holder = s.querySelector('.vp-card');
    holder.innerHTML = '';
    holder.appendChild(cardNode(hand[i], i));
    s.disabled = phase !== 'hold';
    s.setAttribute('aria-pressed', String(held[i]));
    s.classList.toggle('held', held[i]);
    s.classList.toggle('win', !!(win && win.idx.indexOf(i) >= 0));
  });
  var lb = goBtn.firstChild;
  lb.textContent = phase === 'hold' ? 'Tauschen' : phase === 'busy' ? 'Läuft …' : 'Austeilen · ' + fmt(V.S.bets.poker);
  goBtn.disabled = phase === 'busy';
  tipBtn.disabled = phase !== 'hold';
  bet.disable(phase !== 'idle');
  Array.prototype.forEach.call(payEl.children, function (r) { r.classList.toggle('hit', !!(win && win.key === r.getAttribute('data-key'))); });
}

async function deal() {
  var S = V.S, b0 = S.bets.poker;
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  V.debit(b0, true); V.hud();
  stake = b0;
  deck = E.newShoe(1);
  hand = [null, null, null, null, null]; held = [false, false, false, false, false];
  phase = 'busy'; render();
  for (var i = 0; i < 5; i++) { hand[i] = E.draw(deck); V.Snd.card(); render(); await sleep(90); }
  phase = 'hold';
  var ev = evaluate(hand);
  msgEl.className = 'slot-msg';
  msgEl.textContent = ev.key ? 'Du hast schon: ' + nameOf(ev.key) + '. Was hältst du?' : 'Wähle die Karten, die du halten willst.';
  render(ev.key ? ev : null);
}
function nameOf(key) { var n = ''; HANDS.forEach(function (h) { if (h.key === key) n = h.name; }); return n; }
function payOf(key) { var p = 0; HANDS.forEach(function (h) { if (h.key === key) p = h.pay; }); return p; }

function toggle(i) {
  if (phase !== 'hold') return;
  held[i] = !held[i]; V.Snd.click(); render();
}
function tip() {
  if (phase !== 'hold') return;
  var keep = advise(hand);
  held = [0, 1, 2, 3, 4].map(function (i) { return keep.indexOf(i) >= 0; });
  V.Snd.click(); render();
  msgEl.className = 'slot-msg'; msgEl.textContent = keep.length ? 'Tipp: ' + keep.length + ' Karte' + (keep.length > 1 ? 'n' : '') + ' halten.' : 'Tipp: Alle fünf tauschen.';
}

async function draw() {
  phase = 'busy'; render();
  for (var i = 0; i < 5; i++) {
    if (held[i]) continue;
    hand[i] = null; render(); await sleep(70);
    hand[i] = E.draw(deck); V.Snd.card(); render(); await sleep(90);
  }
  var ev = evaluate(hand), pay = ev.key ? payOf(ev.key) : 0, ret = V.payout(stake, pay), net = ret - stake;
  V.settle('poker', stake, ret, { pokerRank: ev.key ? RANK_OF[ev.key] : 0 });
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = ev.key ? nameOf(ev.key) + '! ' + (net > 0 ? '+' + fmt(net) + ' Chips' : 'Einsatz zurück.') : 'Keine Gewinnhand. ' + fmt(stake) + ' Chips gehen ans Haus.';
  if (pay >= 25) { V.Snd.big(); V.burst(V.$('#g-poker .vp-cards'), 36); V.banner(nameOf(ev.key), '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2600 }); }
  else if (net > 0) V.Snd.win(); else if (net < 0) V.Snd.lose();
  phase = 'idle';
  render(ev.key ? ev : null);
}

function onGo() { if (phase === 'idle') deal(); else if (phase === 'hold') draw(); }

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { onGo(); return true; }
  var i = KEYS.indexOf(k);
  if (i >= 0) { toggle(i); return true; }
  if (k === 'h') { tip(); return true; }
  if ((k === 'arrowup' || k === '+') && phase === 'idle') { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && phase === 'idle') { bet.step(-1); return true; }
  return false;
}

V.games.push({
  id: 'poker', init: build, onKey: onKey,
  keys: [['Leertaste', 'Austeilen / Tauschen'], ['Q W E R T', 'Karte 1 bis 5 halten'], ['H', 'Halte-Tipp'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); render(); }, refresh: function () { if (phase === 'idle') { bet.render(); render(); } }
});
})();
