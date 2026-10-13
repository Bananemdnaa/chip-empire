/* Chip Empire – Spiel-Engine (reine Logik, keine DOM-Zugriffe) */
var Engine = (function () {
'use strict';

/* ---------- Zufall ---------- */
var rng = (function () {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    var buf = new Uint32Array(2);
    return function () {
      globalThis.crypto.getRandomValues(buf);
      return (buf[0] * 2097152 + (buf[1] >>> 11)) / 9007199254740992;
    };
  }
  return Math.random;
})();
function setRng(fn) { rng = fn; }
function rand() { return rng(); }
function randInt(n) { return Math.floor(rng() * n); }
function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ---------- Stufen / Räume ---------- */
var TIERS = [
  { id: 0, name: 'Lobby',              wager: 0,        min: 10,    max: 500,     comp: 0.002, reload: 10000,    bonus: 0 },
  { id: 1, name: 'Bronze Lounge',      wager: 15000,    min: 50,    max: 2500,    comp: 0.004, reload: 25000,    bonus: 5000 },
  { id: 2, name: 'Silver Salon',       wager: 75000,    min: 100,   max: 10000,   comp: 0.006, reload: 100000,   bonus: 10000 },
  { id: 3, name: 'Gold Suite',         wager: 350000,   min: 500,   max: 50000,   comp: 0.009, reload: 500000,   bonus: 50000 },
  { id: 4, name: 'Platinum Penthouse', wager: 1500000,  min: 2000,  max: 250000,  comp: 0.012, reload: 2500000,  bonus: 200000 },
  { id: 5, name: 'Black Room',         wager: 7500000,  min: 10000, max: 1000000, comp: 0.015, reload: 10000000, bonus: 1000000 }
];
function tierFor(wagered) {
  var t = 0;
  for (var i = 0; i < TIERS.length; i++) if (wagered >= TIERS[i].wager) t = i;
  return t;
}
var BET_LADDER = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
var CHIP_VALUES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

/* ---------- Slots: 5 Walzen x 3 Reihen, 10 Linien ---------- */
var SYM = { T: 0, J: 1, Q: 2, K: 3, A: 4, GEM: 5, BAR: 6, SEVEN: 7, WILD: 8, SCAT: 9 };
var SLOT_LINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 0, 1, 0]
];
/* Auszahlung als Vielfaches des Linieneinsatzes */
var SLOT_PAY = {
  0: { 3: 7,  4: 22,  5: 70 },
  1: { 3: 7,  4: 22,  5: 70 },
  2: { 3: 9,  4: 28,  5: 90 },
  3: { 3: 11, 4: 34,  5: 135 },
  4: { 3: 14, 4: 45,  5: 170 },
  5: { 2: 2, 3: 22, 4: 90,  5: 340 },
  6: { 2: 3, 3: 34, 4: 135, 5: 680 },
  7: { 2: 6, 3: 68, 4: 340, 5: 1700 },
  8: { 3: 68, 4: 340, 5: 1700 }
};
/* Scatter: Vielfaches des Gesamteinsatzes + Freispiele */
var SCATTER_PAY = { 3: 2, 4: 10, 5: 50 };
var FREE_SPINS = { 3: 8, 4: 12, 5: 20 };
var FREE_MULT = 2;
var SLOT_COUNTS = [
  [7, 7, 6, 6, 5, 3, 2, 2, 0, 1],
  [6, 6, 6, 5, 5, 3, 2, 2, 3, 1],
  [6, 6, 6, 5, 5, 3, 2, 2, 3, 1],
  [6, 6, 6, 5, 5, 3, 2, 2, 3, 1],
  [7, 7, 6, 6, 5, 3, 2, 2, 0, 1]
];
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function buildStrip(counts, seed) {
  var r = mulberry32(seed);
  var L = counts.reduce(function (a, b) { return a + b; }, 0);
  var strip = new Array(L).fill(-1);
  var sc = counts[SYM.SCAT];
  for (var k = 0; k < sc; k++) strip[Math.floor(k * L / sc + L / (2 * sc))] = SYM.SCAT;
  var rest = [];
  for (var s = 0; s < 10; s++) {
    if (s === SYM.SCAT) continue;
    for (var i = 0; i < counts[s]; i++) rest.push(s);
  }
  for (var a = rest.length - 1; a > 0; a--) {
    var j = Math.floor(r() * (a + 1)), tmp = rest[a]; rest[a] = rest[j]; rest[j] = tmp;
  }
  var ri = 0;
  for (var p = 0; p < L; p++) if (strip[p] === -1) strip[p] = rest[ri++];
  return strip;
}
var SLOT_STRIPS = SLOT_COUNTS.map(function (c, i) { return buildStrip(c, 1337 + i * 101); });

/* Auswertung einer Linie (5 Symbole, links nach rechts) */
function lineWin(syms) {
  var i = 0;
  while (i < 5 && syms[i] === SYM.WILD) i++;
  var leadW = i;
  var best = null;
  if (leadW >= 3) best = { sym: SYM.WILD, count: leadW, mult: SLOT_PAY[SYM.WILD][leadW] };
  if (leadW === 5) return best;
  if (syms[i] === SYM.SCAT) return best;
  var target = syms[i];
  var j = i;
  while (j < 5 && (syms[j] === target || syms[j] === SYM.WILD)) j++;
  var count = j;
  var m = SLOT_PAY[target][count];
  if (m && (!best || m > best.mult)) best = { sym: target, count: count, mult: m };
  return best;
}
function slotResolve(grid, lineBet, mult) {
  mult = mult || 1;
  var wins = [], lineTotal = 0;
  for (var l = 0; l < SLOT_LINES.length; l++) {
    var syms = [];
    for (var r = 0; r < 5; r++) syms.push(grid[r][SLOT_LINES[l][r]]);
    var w = lineWin(syms);
    if (w) {
      var pay = w.mult * lineBet * mult;
      var cells = [];
      for (var c = 0; c < w.count; c++) cells.push([c, SLOT_LINES[l][c]]);
      wins.push({ line: l, sym: w.sym, count: w.count, pay: pay, cells: cells });
      lineTotal += pay;
    }
  }
  var scat = 0, scatCells = [];
  for (var rr = 0; rr < 5; rr++) for (var row = 0; row < 3; row++) {
    if (grid[rr][row] === SYM.SCAT) { scat++; scatCells.push([rr, row]); }
  }
  var sKey = Math.min(scat, 5);
  var scatterPay = scat >= 3 ? SCATTER_PAY[sKey] * lineBet * SLOT_LINES.length * mult : 0;
  var free = scat >= 3 ? FREE_SPINS[sKey] : 0;
  return {
    grid: grid, wins: wins, lineTotal: lineTotal, scat: scat, scatCells: scatCells,
    scatterPay: scatterPay, free: free, total: lineTotal + scatterPay, nearMiss: scat === 2
  };
}
function slotPlay(lineBet, mult, strips) {
  strips = strips || SLOT_STRIPS;
  var stops = [], grid = [];
  for (var r = 0; r < 5; r++) {
    var L = strips[r].length, p = randInt(L);
    stops.push(p);
    grid.push([strips[r][p], strips[r][(p + 1) % L], strips[r][(p + 2) % L]]);
  }
  var res = slotResolve(grid, lineBet, mult);
  res.stops = stops;
  return res;
}

/* ---------- Roulette (europäisch, Single-Zero) ---------- */
var R_REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
var R_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
function rColor(n) { return n === 0 ? 'green' : (R_REDS.indexOf(n) >= 0 ? 'red' : 'black'); }
function rWins(key, n) {
  if (key.charAt(0) === 'n') return Number(key.slice(1)) === n;
  if (n === 0) return false;
  switch (key) {
    case 'red': return rColor(n) === 'red';
    case 'black': return rColor(n) === 'black';
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'd1': return n <= 12;
    case 'd2': return n >= 13 && n <= 24;
    case 'd3': return n >= 25;
    case 'c1': return n % 3 === 1;
    case 'c2': return n % 3 === 2;
    case 'c3': return n % 3 === 0;
  }
  return false;
}
function rPay(key) {
  if (key.charAt(0) === 'n') return 35;
  if (/^[dc][123]$/.test(key)) return 2;
  return 1;
}
function rResolve(bets, n) {
  var ret = 0, staked = 0, won = {};
  for (var k in bets) {
    var a = bets[k];
    staked += a;
    if (rWins(k, n)) { ret += a * (rPay(k) + 1); won[k] = a * rPay(k); }
  }
  return { ret: ret, staked: staked, won: won };
}
function rSpin() { return randInt(37); }
function rNeighbors(n, k) {
  var idx = R_ORDER.indexOf(n), out = [];
  for (var d = -k; d <= k; d++) out.push(R_ORDER[(idx + d + 37 * 4) % 37]);
  return out;
}

/* ---------- Blackjack: 6 Decks, Dealer steht auf soft 17, BJ 3:2 ---------- */
var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
var SUITS = ['♠', '♥', '♦', '♣'];
function newShoe(decks) {
  decks = decks || 6;
  var cards = [];
  for (var d = 0; d < decks; d++) for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) cards.push({ r: RANKS[r], s: SUITS[s] });
  shuffle(cards);
  return { cards: cards, pos: 0, decks: decks };
}
function shoeNeedsShuffle(shoe) { return shoe.pos >= shoe.cards.length * 0.75; }
function draw(shoe) {
  if (shoe.pos >= shoe.cards.length) { shuffle(shoe.cards); shoe.pos = 0; }
  return shoe.cards[shoe.pos++];
}
function cardVal(c) {
  if (c.r === 'A') return 11;
  if (c.r === 'K' || c.r === 'Q' || c.r === 'J' || c.r === '10') return 10;
  return parseInt(c.r, 10);
}
function handValue(cards) {
  var total = 0, aces = 0;
  for (var i = 0; i < cards.length; i++) {
    var v = cardVal(cards[i]);
    if (v === 11) aces++;
    total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total: total, soft: aces > 0 };
}
function newHand(cards, bet, fromSplit) {
  return { cards: cards, bet: bet, doubled: false, done: false, fromSplit: !!fromSplit, splitAces: false,
           surrendered: false, result: null, payout: 0 };
}
function isNatural(h, st) {
  return st.hands.length === 1 && !h.fromSplit && h.cards.length === 2 && handValue(h.cards).total === 21;
}
function dealerHasBJ(st) {
  return st.dealer.length === 2 && handValue(st.dealer).total === 21;
}
function bjDeal(shoe, bet, bjPay) {
  var p1 = draw(shoe), d1 = draw(shoe), p2 = draw(shoe), d2 = draw(shoe);
  var st = {
    shoe: shoe, hands: [newHand([p1, p2], bet, false)], active: 0, dealer: [d1, d2],
    insurance: 0, insuranceReturn: 0, phase: 'player', staked: bet, returned: 0, settled: false, bet0: bet, bjPay: bjPay || 1.5
  };
  if (d1.r === 'A') { st.phase = 'insurance'; return st; }
  afterPeek(st);
  return st;
}
function bjInsurance(st, take) {
  if (st.phase !== 'insurance') return { cost: 0 };
  var cost = 0;
  if (take) { cost = Math.floor(st.bet0 / 2); st.insurance = cost; st.staked += cost; }
  afterPeek(st);
  return { cost: cost };
}
function afterPeek(st) {
  var h = st.hands[0];
  if (dealerHasBJ(st)) { st.phase = 'player'; h.done = true; finish(st); return; }
  if (isNatural(h, st)) { h.done = true; st.phase = 'player'; finish(st); return; }
  st.phase = 'player';
}
function bjCan(st, balance) {
  var none = { hit: false, stand: false, double: false, split: false, surrender: false, insurance: false };
  if (!st) return none;
  if (st.phase === 'insurance') { none.insurance = balance >= Math.floor(st.bet0 / 2); return none; }
  if (st.phase !== 'player') return none;
  var h = st.hands[st.active];
  if (!h || h.done) return none;
  var two = h.cards.length === 2;
  return {
    hit: true, stand: true,
    double: two && balance >= h.bet,
    split: two && st.hands.length < 4 && cardVal(h.cards[0]) === cardVal(h.cards[1]) && balance >= h.bet,
    surrender: two && st.hands.length === 1 && !h.fromSplit,
    insurance: false
  };
}
function after(st) {
  var h = st.hands[st.active];
  if (!h.done) return;
  for (var i = st.active + 1; i < st.hands.length; i++) {
    if (!st.hands[i].done) { st.active = i; return; }
  }
  finish(st);
}
function bjHit(st) {
  var h = st.hands[st.active];
  h.cards.push(draw(st.shoe));
  var t = handValue(h.cards).total;
  if (t >= 21) h.done = true;
  after(st);
}
function bjStand(st) { st.hands[st.active].done = true; after(st); }
function bjDouble(st) {
  var h = st.hands[st.active], cost = h.bet;
  st.staked += cost; h.bet *= 2; h.doubled = true;
  h.cards.push(draw(st.shoe));
  h.done = true;
  after(st);
  return { cost: cost };
}
function bjSplit(st) {
  var h = st.hands[st.active], cost = h.bet;
  st.staked += cost;
  var second = newHand([h.cards.pop()], h.bet, true);
  h.fromSplit = true;
  var aces = h.cards[0].r === 'A';
  h.cards.push(draw(st.shoe));
  second.cards.push(draw(st.shoe));
  st.hands.splice(st.active + 1, 0, second);
  if (aces) { h.splitAces = true; second.splitAces = true; h.done = true; second.done = true; }
  else {
    if (handValue(h.cards).total >= 21) h.done = true;
    if (handValue(second.cards).total >= 21) second.done = true;
  }
  after(st);
  return { cost: cost };
}
function bjSurrender(st) {
  var h = st.hands[st.active];
  h.surrendered = true; h.done = true;
  after(st);
}
function finish(st) {
  var needDealer = st.hands.some(function (h) {
    return !h.surrendered && handValue(h.cards).total <= 21 && !isNatural(h, st);
  });
  if (needDealer) {
    while (handValue(st.dealer).total < 17) st.dealer.push(draw(st.shoe));
  }
  settle(st);
}
function settle(st) {
  var dv = handValue(st.dealer).total, dBJ = dealerHasBJ(st);
  var returned = 0;
  st.hands.forEach(function (h) {
    var pv = handValue(h.cards).total, pay = 0, res;
    if (h.surrendered) { pay = Math.floor(h.bet / 2); res = 'surrender'; }
    else if (isNatural(h, st)) {
      if (dBJ) { pay = h.bet; res = 'push'; } else { pay = h.bet + h.bet * (st.bjPay || 1.5); res = 'blackjack'; }
    }
    else if (pv > 21) { pay = 0; res = 'bust'; }
    else if (dBJ) { pay = 0; res = 'lose'; }
    else if (dv > 21) { pay = h.bet * 2; res = 'win'; }
    else if (pv > dv) { pay = h.bet * 2; res = 'win'; }
    else if (pv === dv) { pay = h.bet; res = 'push'; }
    else { pay = 0; res = 'lose'; }
    h.result = res; h.payout = pay; returned += pay;
  });
  if (st.insurance > 0 && dBJ) { st.insuranceReturn = st.insurance * 3; returned += st.insuranceReturn; }
  st.returned = returned;
  st.phase = 'done';
}

/* Basic Strategy (6 Decks, S17, DAS, Late Surrender, Aufteilen bis 4 Hände) */
function bjAdvice(cards, upCard, can) {
  var up = cardVal(upCard);
  var v = handValue(cards), t = v.total;
  var pair = cards.length === 2 && cardVal(cards[0]) === cardVal(cards[1]);
  if (pair && can.split) {
    var p = cardVal(cards[0]), sp = false;
    if (p === 11 || p === 8) sp = true;
    else if (p === 9) sp = (up >= 2 && up <= 6) || up === 8 || up === 9;
    else if (p === 7) sp = up >= 2 && up <= 7;
    else if (p === 6) sp = up >= 2 && up <= 6;
    else if (p === 4) sp = up === 5 || up === 6;
    else if (p === 3 || p === 2) sp = up >= 2 && up <= 7;
    if (sp) return 'split';
  }
  if (cards.length === 2 && can.surrender && !v.soft) {
    if (t === 16 && (up === 9 || up === 10 || up === 11)) return 'surrender';
    if (t === 15 && up === 10) return 'surrender';
  }
  if (v.soft) {
    if (t >= 19) return 'stand';
    if (t === 18) {
      if (up >= 3 && up <= 6) return can.double ? 'double' : 'stand';
      if (up === 2 || up === 7 || up === 8) return 'stand';
      return 'hit';
    }
    if (t === 17) return (up >= 3 && up <= 6 && can.double) ? 'double' : 'hit';
    if (t === 15 || t === 16) return (up >= 4 && up <= 6 && can.double) ? 'double' : 'hit';
    if (t === 13 || t === 14) return (up >= 5 && up <= 6 && can.double) ? 'double' : 'hit';
    return 'hit';
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return up <= 6 ? 'stand' : 'hit';
  if (t === 12) return (up >= 4 && up <= 6) ? 'stand' : 'hit';
  if (t === 11) return (up !== 11 && can.double) ? 'double' : 'hit';
  if (t === 10) return (up <= 9 && can.double) ? 'double' : 'hit';
  if (t === 9) return (up >= 3 && up <= 6 && can.double) ? 'double' : 'hit';
  return 'hit';
}

/* ---------- Crash (1 % Hausvorteil) ---------- */
var CRASH_CAP = 100000;
function crashPoint() {
  var r = rand();
  var c = Math.floor(99 / (1 - r)) / 100;
  if (c < 1) c = 1;
  if (c > CRASH_CAP) c = CRASH_CAP;
  return c;
}
function crashMult(t) { return Math.exp(0.08 * t + 0.004 * t * t); }
function crashTime(m) {
  var l = Math.log(m);
  return (-0.08 + Math.sqrt(0.0064 + 0.016 * l)) / 0.008;
}

/* ---------- Zockerprofil ---------- */
var PROFILES = {
  rookie: { name: 'Frischling', game: 'slots', pct: [0.005, 0.02],
    desc: 'Noch zu wenig Daten. Spiel ein paar Runden, dann erkennt das Haus deinen Typ.',
    kick: 'Das Haus beobachtet: Spielwahl, Einsatzhöhe im Verhältnis zum Guthaben, Tempo und wie du nach Verlusten reagierst.' },
  thrill: { name: 'Der Thrill-Jäger', game: 'crash', pct: [0.03, 0.08],
    desc: 'Du suchst den Moment kurz vor dem Absturz. Hohe Varianz, große Einsätze, Auszahlen auf den letzten Drücker.',
    kick: 'Variable Belohnung pur: Jede Sekunde kann alles vorbei sein. Der Kick sitzt beim Auszahlen, und danach siehst du, wie hoch es noch gegangen wäre.' },
  strat: { name: 'Der Stratege', game: 'bj', pct: [0.01, 0.03],
    desc: 'Du willst Kontrolle. Entscheidungen, Zahlen, ein System. Du spielst gleichmäßig und überlegt.',
    kick: 'Die Kontrollillusion: Jede Entscheidung fühlt sich nach Können an, obwohl der Hausvorteil bleibt. Kleine Siege halten dich lange am Tisch.' },
  ritual: { name: 'Der Ritualist', game: 'roulette', pct: [0.01, 0.04],
    desc: 'Lieblingszahlen, Muster, Heiß-und-Kalt-Listen. Du liest Bedeutung in den Zufall.',
    kick: 'Der Spielerfehlschluss: Die Hot-and-Cold-Anzeige lässt Zufall wie ein Muster wirken. Dazu kommt das Ritual aus Chips setzen, Warten, Spannung.' },
  dream: { name: 'Der Jackpot-Träumer', game: 'slots', pct: [0.002, 0.01],
    desc: 'Kleine Einsätze, lange Sessions, immer auf der Suche nach dem Bonus.',
    kick: 'Fast-Treffer und Verluste, die als Gewinn gefeiert werden: Zwei Scatter, Lichter und Sound, obwohl du weniger zurückbekommst als eingesetzt.' }
};
var DEFAULT_CAT = { crash: 'thrill', bj: 'strat', roulette: 'ritual', slots: 'dream' };
/* catOf ordnet jedes Spiel einem Spielertyp zu (thrill, strat, ritual, dream) */
function profileOf(hist, catOf) {
  var n = hist.length;
  if (n < 8) return { key: 'rookie', hi: false, shares: {}, ratio: 0 };
  var cnt = {}, cat = { thrill: 0, strat: 0, ritual: 0, dream: 0 }, ratioSum = 0;
  hist.forEach(function (h) {
    cnt[h.g] = (cnt[h.g] || 0) + 1;
    var c = catOf ? catOf(h.g) : DEFAULT_CAT[h.g];
    if (cat.hasOwnProperty(c)) cat[c]++;
    ratioSum += Math.min(1, h.bet / Math.max(1, h.bal));
  });
  var shares = {};
  for (var g in cnt) shares[g] = cnt[g] / n;
  var ratio = ratioSum / n;
  var scores = {
    thrill: cat.thrill / n + (ratio > 0.05 ? 0.15 : 0),
    strat: cat.strat / n,
    ritual: cat.ritual / n,
    dream: cat.dream / n + (ratio < 0.012 ? 0.1 : 0)
  };
  var best = 'dream', bv = -1;
  ['thrill', 'strat', 'ritual', 'dream'].forEach(function (k) { if (scores[k] > bv) { bv = scores[k]; best = k; } });
  return { key: best, hi: ratio > 0.06, shares: shares, ratio: ratio };
}
function recommend(profileKey, balance, unlocked) {
  var P = PROFILES[profileKey];
  var lo = balance * P.pct[0], hi = balance * P.pct[1], mid = (lo + hi) / 2;
  var bestRoom = 0, bestD = Infinity;
  for (var i = 0; i <= unlocked; i++) {
    var T = TIERS[i], d;
    if (mid >= T.min && mid <= T.max) d = 0;
    else d = Math.min(Math.abs(Math.log(mid / T.min)), Math.abs(Math.log(mid / T.max)));
    if (d < bestD) { bestD = d; bestRoom = i; }
  }
  var T2 = TIERS[bestRoom];
  var betLo = Math.min(T2.max, Math.max(T2.min, lo)), betHi = Math.min(T2.max, Math.max(T2.min, hi));
  return { room: bestRoom, betLo: Math.round(betLo), betHi: Math.round(betHi), game: P.game };
}

return {
  setRng: setRng, rand: rand, randInt: randInt, shuffle: shuffle,
  TIERS: TIERS, tierFor: tierFor, BET_LADDER: BET_LADDER, CHIP_VALUES: CHIP_VALUES,
  SYM: SYM, SLOT_LINES: SLOT_LINES, SLOT_PAY: SLOT_PAY, SCATTER_PAY: SCATTER_PAY, FREE_SPINS: FREE_SPINS, FREE_MULT: FREE_MULT,
  SLOT_COUNTS: SLOT_COUNTS, SLOT_STRIPS: SLOT_STRIPS, buildStrip: buildStrip, lineWin: lineWin,
  slotResolve: slotResolve, slotPlay: slotPlay,
  R_REDS: R_REDS, R_ORDER: R_ORDER, rColor: rColor, rWins: rWins, rPay: rPay, rResolve: rResolve, rSpin: rSpin, rNeighbors: rNeighbors,
  RANKS: RANKS, SUITS: SUITS, newShoe: newShoe, shoeNeedsShuffle: shoeNeedsShuffle, draw: draw, cardVal: cardVal, handValue: handValue,
  bjDeal: bjDeal, bjInsurance: bjInsurance, bjCan: bjCan, bjHit: bjHit, bjStand: bjStand, bjDouble: bjDouble, bjSplit: bjSplit,
  bjSurrender: bjSurrender, bjAdvice: bjAdvice,
  crashPoint: crashPoint, crashMult: crashMult, crashTime: crashTime,
  PROFILES: PROFILES, profileOf: profileOf, recommend: recommend
};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
