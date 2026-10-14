/* Chip Empire – Fortschritt: Level & Talentbaum, Quests (Daily, Weekly, Meilensteine), Imperium (nur im Imperium-Modus) */
var Meta = (function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt;
var GN = V.GAME_NAME;
function pct(v) { return (Math.round(v * 1000) / 10).toString().replace('.', ',') + ' %'; }
function isEmpire() { return V.S.mode === 'empire'; }
/* Maßstab für Chip-Belohnungen: Karriere und Imperium nach höchster Stufe, Sandbox nach aktuellem Raum */
function tierMin() { return E.TIERS[V.isCareer() ? V.S.unlocked : V.S.room].min; }

/* ================= Level ================= */
/* XP, um von Level L auf L+1 zu kommen (Version 2: deutlich steiler) */
function xpFor(level) { return Math.round(100 * Math.pow(level, 1.6)); }
function xpForOld(level) { return Math.round(60 * Math.pow(level, 1.4)); }
function addXp(n) {
  var S = V.S;
  /* Jeder Legenden-Stern: +10 % Erfahrung (bis 10 Sterne) */
  n = Math.round(n * (1 + perk('xp') + perk('legXp') + 0.1 * Math.min(10, stars())));
  if (n <= 0) return;
  S.xp += n;
  var ups = 0;
  while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; ups++; }
  if (ups) {
    progress({ levelUp: ups }, ['weekly']);
    V.Snd.unlock();
    notify({ kind: 'level', icon: '⭐', text: 'Level ' + S.level + ' erreicht · +' + ups + ' Talentpunkt' + (ups > 1 ? 'e' : '') });
  }
}
/* Pro Runde: mehr XP in höheren Räumen, Gewinne zählen 50 % mehr */
/* Heißer Tisch: zügig weiterspielen bringt bis zu doppelte Erfahrung */
function roundXp(net) { return 6 * (1 + 0.4 * V.S.room) * (net > 0 ? 1.3 : 1) * (V.session ? V.session.xpMult() : 1); }

/* ================= Talentbaum ================= */
/* Jeder Ast ist eine Kette: Ein Talent braucht mindestens eine Stufe im Talent darüber. */
var BRANCHES = [
  { id: 'gl', name: 'Glück', icon: '🍀', color: '#6FD3A2', desc: 'Automaten: Slots, Glücksrad, Plinko.' },
  { id: 'ta', name: 'Taktik', icon: '🎯', color: '#FF6A88', desc: 'Tische: Würfel, Roulette, Karten.' },
  { id: 'ri', name: 'Risiko', icon: '🔥', color: '#FF9A3C', desc: 'Nervenkitzel: Enten, Crash, Tower.' },
  { id: 'bu', name: 'Business', icon: '💼', color: '#D4AB52', desc: 'Boni, Rettung, Erfahrung.' },
  { id: 'le', name: 'Legende', icon: '★', color: '#B98AFF', desc: 'Nur mit Legenden-Sternen.' }
];
/* Reihenfolge im Ast = Lernreihenfolge; früh freigeschaltete Spiele zuerst.
   Alle Boni sind so bemessen, dass jedes Spiel unter 100 % Auszahlung bleibt. */
var TALENTS = [
  { id: 'slotLuck', br: 'gl', icon: '🍒', name: 'Glückssträhne', game: 'slots', vals: [0.005, 0.01, 0.015], txt: function (v) { return 'Slot-Gewinne +' + pct(v); } },
  { id: 'wheelLuck', br: 'gl', icon: '🎡', name: 'Glücksfee', game: 'wheel', vals: [0.05], txt: function () { return 'Glücksrad: Das 2×-Feld zahlt 2,05×'; } },
  { id: 'slotFree', br: 'gl', icon: '🎁', name: 'Bonusjäger', game: 'slots', vals: [1, 2], txt: function (v) { return '+' + v + ' Freispiel' + (v > 1 ? 'e' : '') + ' pro Slot-Bonus'; } },
  { id: 'plinkoSmooth', br: 'gl', icon: '🔻', name: 'Glatte Nägel', game: 'plinko', vals: [0.01], txt: function () { return 'Plinko: Fächer ab 2× zahlen 1 % mehr'; } },
  { id: 'diceDouble', br: 'ta', icon: '🎲', name: 'Glückswürfel', game: 'dice', vals: [0.2], txt: function () { return 'Würfel: Pasch zahlt 5,9× statt 5,7×'; } },
  { id: 'partage', br: 'ta', icon: '🎯', name: 'La Partage', game: 'roulette', vals: [1], txt: function () { return 'Roulette: Bei Zero bekommst du die Hälfte deiner einfachen Chancen zurück'; } },
  { id: 'comps', br: 'ta', icon: '🥂', name: 'Stammkunde', vals: [0.1, 0.2, 0.3], txt: function (v) { return 'Comps +' + pct(v); } },
  { id: 'bjPay', br: 'ta', icon: '🂡', name: 'Naturtalent', game: 'bj', vals: [0.1], txt: function () { return 'Blackjack zahlt 1,6-fach statt 1,5-fach'; } },
  { id: 'hiloRead', br: 'ta', icon: '🂠', name: 'Kartenzähler', game: 'hilo', vals: [0.005, 0.01], txt: function (v) { return 'Hi-Lo-Leiter: jede Sprosse zahlt +' + pct(v); } },
  { id: 'duckPro', br: 'ri', icon: '🦆', name: 'Wettprofi', game: 'ducks', vals: [0.03], txt: function () { return 'Entenrennen: Enten ab Quote 8× zahlen 3 % mehr'; } },
  { id: 'crashSafe', br: 'ri', icon: '🪂', name: 'Fallschirm', game: 'crash', vals: [0.5], txt: function () { return 'Crash: Bei einem Sofort-Crash (1,00×) bekommst du die Hälfte deines Einsatzes zurück'; } },
  { id: 'towerScale', br: 'ri', icon: '🐉', name: 'Drachenschuppen', game: 'tower', vals: [0.005, 0.01], txt: function (v) { return 'Dragon Tower: Multiplikatoren +' + pct(v); } },
  { id: 'vaultLuck', br: 'ri', icon: '🔓', name: 'Meisterdieb', game: 'vault', vals: [0.005, 0.01], txt: function (v) { return 'Tresorknacker: Multiplikatoren +' + pct(v); } },
  { id: 'daily', br: 'bu', icon: '☀️', name: 'Frühaufsteher', vals: [0.25, 0.5], txt: function (v) { return 'Tagesbonus +' + pct(v); } },
  { id: 'rescue', br: 'bu', icon: '🛟', name: 'Rettungsring', vals: [180000, 300000], txt: function (v) { return 'Notgroschen schon nach ' + Math.round((V.CAREER.bailoutCooldown - v) / 60000) + ' Minuten'; } },
  { id: 'quest', br: 'bu', icon: '📜', name: 'Quest-Profi', vals: [0.1, 0.2], txt: function (v) { return 'Quest-Belohnungen +' + pct(v); } },
  { id: 'xp', br: 'bu', icon: '📚', name: 'Schnelllerner', vals: [0.15, 0.3], txt: function (v) { return 'Erfahrung +' + pct(v); } },
  { id: 'empire', br: 'bu', icon: '🏛️', name: 'Investor', empire: true, vals: [0.1, 0.2, 0.35], txt: function (v) { return 'Imperium-Einnahmen +' + pct(v); } },
  { id: 'vault', br: 'bu', icon: '🔐', name: 'Großer Tresor', empire: true, vals: [4, 8], txt: function (v) { return 'Tresor fasst ' + (8 + v) + ' statt 8 Stunden'; } },
  /* Legenden-Ast: nur Karriere, jedes Talent braucht eine Mindestzahl an Sternen */
  { id: 'legStart', br: 'le', icon: '👑', name: 'Erbe', legend: 1, vals: [9000, 49000, 199000], txt: function (v) { return 'Als neue Legende startest du mit ' + fmt(1000 + v) + ' statt 1.000 Chips'; } },
  { id: 'legDaily', br: 'le', icon: '🌅', name: 'Goldene Tage', legend: 1, vals: [0.5, 1], txt: function (v) { return 'Tagesbonus +' + pct(v); } },
  { id: 'legXp', br: 'le', icon: '🧠', name: 'Ewiges Gedächtnis', legend: 2, vals: [0.25, 0.5], txt: function (v) { return 'Erfahrung +' + pct(v); } },
  { id: 'legBail', br: 'le', icon: '🪂', name: 'Rettungsschirm', legend: 3, vals: [1, 2], txt: function (v) { return 'Notgroschen ' + (v + 1) + '-mal so groß'; } }
];
var T_BY = {}; TALENTS.forEach(function (t) { T_BY[t.id] = t; });
function activeTalents(br) { return TALENTS.filter(function (t) { return t.br === br && (!t.empire || isEmpire()) && (!t.legend || V.isCareer()); }); }
function stars() { return V.S.stars || 0; }
function tl(id) { return (V.S.talents && V.S.talents[id]) || 0; }
function perk(id) { var t = T_BY[id], l = tl(id); return t && l ? t.vals[l - 1] : 0; }
function pointsTotal() { return V.S.level - 1 + V.S.bonusTp; }
function pointsSpent() { var n = 0; TALENTS.forEach(function (t) { n += tl(t.id); }); return n; }
function pointsFree() { return Math.max(0, pointsTotal() - pointsSpent()); }
function respecCost() { return tierMin() * 200; }
/* Vorgänger im Ast: muss mindestens Stufe 1 haben */
function parentOf(t) { var list = activeTalents(t.br), i = list.indexOf(t); return i > 0 ? list[i - 1] : null; }
function unlockedNode(t) { var p = parentOf(t); return (!t.legend || stars() >= t.legend) && (!p || tl(p.id) > 0); }
function learn(id) {
  var S = V.S, t = T_BY[id], l = tl(id);
  if (!t || l >= t.vals.length || pointsFree() < 1 || !unlockedNode(t)) return;
  S.talents[id] = l + 1;
  V.Snd.unlock(); V.toast(t.icon + ' ' + t.name + ' Stufe ' + (l + 1) + ': ' + t.txt(t.vals[l]), 'good');
  V.hud(); V.side.refresh(); V.save();
}
var confirmRespec = false, selTalent = null;
function respec() {
  var S = V.S, c = respecCost();
  if (S.balance < c) { V.toast('Neu verteilen kostet ' + fmt(c) + ' Chips.', 'bad'); return; }
  S.balance -= c; S.talents = {}; confirmRespec = false;
  V.Snd.cash(); V.toast('Talente zurückgesetzt. Du hast ' + pointsFree() + ' Punkte zum Verteilen.', 'good');
  V.hud(); V.side.refresh(); V.save();
}

/* ================= Imperium (nur im Imperium-Modus) ================= */
var BIZ = [
  { id: 'kiosk', name: 'Zeitungskiosk', icon: '📰', cost: 1500, inc: 150, tier: 0, desc: 'Klein, aber verlässlich. Dein erstes Geschäft.' },
  { id: 'cigar', name: 'Zigarrenbar', icon: '🥃', cost: 15000, inc: 1200, tier: 1, desc: 'Ledersessel, Whisky und gute Gespräche.' },
  { id: 'lounge', name: 'Cocktail-Lounge', icon: '🍸', cost: 120000, inc: 9000, tier: 2, desc: 'Hier wird bis zum Morgen getanzt.' },
  { id: 'hotel', name: 'Boutique-Hotel', icon: '🏨', cost: 900000, inc: 60000, tier: 3, desc: 'Zimmer mit Blick auf die Skyline.' },
  { id: 'yacht', name: 'Casino-Yacht', icon: '🛥️', cost: 7500000, inc: 450000, tier: 4, desc: 'Spieltische auf hoher See.' },
  { id: 'casino', name: 'Eigenes Casino', icon: '🎰', cost: 60000000, inc: 3000000, tier: 5, desc: 'Das Ziel: Jetzt gehört das Haus dir.' }
];
var MAX_BIZ = 10;
function bizLv(id) { return (V.S.biz && V.S.biz[id]) || 0; }
function bizIncome(b, lv) { return lv ? b.inc * Math.pow(1.6, lv - 1) : 0; }
function upCost(b, lv) { return Math.round(b.cost * Math.pow(1.75, lv)); }
function bizOpen(b) { return V.S.unlocked >= b.tier; }
function perHour() {
  if (!isEmpire()) return 0;
  var s = 0; BIZ.forEach(function (b) { s += bizIncome(b, bizLv(b.id)); });
  return s * (1 + perk('empire'));
}
function vaultHours() { return 8 + perk('vault'); }
function vaultCap() { return Math.floor(perHour() * vaultHours()); }
function vault() {
  var S = V.S;
  if (!S.bizAt || !isEmpire()) return 0;
  var h = Math.min(Math.max(0, Date.now() - S.bizAt) / 36e5, vaultHours());
  return Math.floor(perHour() * h);
}
function collect(quiet) {
  var S = V.S, v = vault();
  S.bizAt = Date.now();
  if (v <= 0) return 0;
  S.balance += v; S.bizEarned += v;
  if (!quiet) { V.Snd.cash(); V.toast('Tresor geleert: +' + fmt(v) + ' Chips', 'good'); }
  V.hud(); V.save();
  return v;
}
function buy(id) {
  var S = V.S, b = null;
  BIZ.forEach(function (x) { if (x.id === id) b = x; });
  var lv = bizLv(id);
  if (!b || !isEmpire() || lv >= MAX_BIZ || !bizOpen(b)) return;
  var c = upCost(b, lv);
  if (S.balance < c) { V.toast('Dafür fehlen dir ' + fmt(c - S.balance) + ' Chips.', 'bad'); return; }
  collect(true);
  S.balance -= c; S.biz[id] = lv + 1; S.bizSpent += c;
  if (!S.bizAt) S.bizAt = Date.now();
  V.Snd.unlock();
  if (lv === 0) V.banner(b.icon + ' ' + b.name, 'Gehört jetzt dir · +' + fmt(bizIncome(b, 1) * (1 + perk('empire'))) + ' Chips pro Stunde', { kind: 'win', ms: 2600 });
  else V.toast(b.name + ' auf Stufe ' + (lv + 1) + ' ausgebaut.', 'good');
  if (id === 'casino' && lv === 0) V.burst(V.$('#app'), 60);
  V.hud(); V.side.refresh(); V.save();
}
function worth() { return Math.round(V.S.balance + V.S.bizSpent); }

/* ================= Quests ================= */
function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
/* Woche beginnt am Montag */
function weekStart() { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function weekKey() { return 'W' + dayKey(weekStart()); }
function openGames() { return V.GAME_LIST.map(function (g) { return g.id; }).filter(function (g) { return V.gameOpen(g); }); }
function qmult() { return 1 + perk('quest'); }

/* Vorlagen: n = Ziel, diff = Belohnungsfaktor, ev = Fortschritt pro Ereignis, req = nötiges Spiel, cond = weitere Bedingung */
function R(e) { return e.staked > 0; }
function maxRoom() { return V.S.room === V.S.unlocked; }
var DAILY = [
  /* allgemein */
  { id: 'rounds', make: function (r) { var gs = openGames(), g = gs[Math.floor(r() * gs.length)], n = g === 'slots' ? 25 : 12; return { text: 'Spiele ' + n + ' Runden ' + GN[g], n: n, game: g, diff: 1, icon: '🎲' }; },
    ev: function (q, e) { return e.game === q.game && R(e) ? 1 : 0; } },
  { id: 'wins', make: function () { return { text: 'Gewinne 8 Runden', n: 8, diff: 1, icon: '🏆' }; }, ev: function (q, e) { return R(e) && e.net > 0 ? 1 : 0; } },
  { id: 'wager', make: function () { var n = tierMin() * 1000; return { text: 'Setze insgesamt ' + fmt(n) + ' Chips', n: n, diff: 1, icon: '🪙' }; }, ev: function (q, e) { return e.staked; } },
  { id: 'big', make: function () { return { text: 'Gewinne in einer Runde das 10-Fache deines Einsatzes', n: 1, diff: 2, icon: '💥' }; }, ev: evBig },
  { id: 'streak', make: function () { return { text: 'Gewinne 3 Runden hintereinander', n: 1, diff: 1, icon: '🔥' }; }, ev: function (q, e) { return R(e) && V.S.winStreak >= 3 ? 1 : 0; } },
  { id: 'comeback', make: function () { return { text: 'Gewinne direkt nach 3 verlorenen Runden', n: 1, diff: 1, icon: '🦅' }; }, ev: function (q, e) { return R(e) && e.net > 0 && e.prevLoss >= 3 ? 1 : 0; } },
  { id: 'variety', make: function () { var n = openGames().length; return { text: 'Spiele heute jedes deiner ' + n + ' Spiele mindestens einmal', n: n, diff: 1, icon: '🧭' }; },
    cond: function () { return openGames().length >= 2; },
    ev: function (q, e) { if (!R(e) || (q.seen || '').indexOf(e.game) >= 0) return 0; q.seen = (q.seen || '') + e.game + ','; return 1; } },
  { id: 'highroom', make: function () { return { text: 'Spiele 10 Runden in deinem höchsten Raum', n: 10, diff: 1, icon: '🏰' }; }, cond: function () { return V.S.unlocked > 0; },
    ev: function (q, e) { return R(e) && maxRoom() ? 1 : 0; } },
  { id: 'maxbet', make: function () { return { text: 'Setz 3-mal den Höchsteinsatz deines Raums', n: 3, diff: 1, icon: '💎' }; }, ev: function (q, e) { return R(e) && e.atMax ? 1 : 0; } },
  { id: 'tip', make: function () { return { text: 'Gib deiner Gastgeberin Trinkgeld', n: 1, diff: 1, icon: '🥂' }; }, ev: function (q, e) { return e.tip ? 1 : 0; } },
  { id: 'comps', make: function () { return { text: 'Löse deine Comps ein', n: 1, diff: 1, icon: '🎟️' }; }, ev: function (q, e) { return e.comps ? 1 : 0; } },
  /* Slots */
  { id: 'free', req: 'slots', make: function () { return { text: 'Löse Freispiele aus', n: 1, diff: 2, icon: '🎁' }; }, ev: function (q, e) { return e.opt.freeTrig ? 1 : 0; } },
  { id: 'sevens', req: 'slots', make: function () { return { text: 'Gewinne eine Linie mit Siebenen', n: 1, diff: 2, icon: '7️⃣' }; }, ev: function (q, e) { return e.opt.sevens ? 1 : 0; } },
  { id: 'lines3', req: 'slots', make: function () { return { text: 'Gewinne auf 3 Linien gleichzeitig', n: 1, diff: 1, icon: '〰️' }; }, ev: function (q, e) { return e.opt.lines >= 3 ? 1 : 0; } },
  { id: 'wild', req: 'slots', make: function () { return { text: 'Gewinne 3-mal mit Hilfe eines Wilds', n: 3, diff: 1, icon: '🃏' }; }, ev: function (q, e) { return e.opt.wildHelp ? 1 : 0; } },
  /* Roulette */
  { id: 'straight', req: 'roulette', make: function () { return { text: 'Triff eine Einzelzahl im Roulette', n: 1, diff: 2, icon: '🎯' }; }, ev: function (q, e) { return e.opt.straight ? 1 : 0; } },
  { id: 'color', req: 'roulette', make: function () { return { text: 'Gewinne 5-mal auf Rot oder Schwarz', n: 5, diff: 1, icon: '🔴' }; }, ev: function (q, e) { return e.opt.colorWin ? 1 : 0; } },
  { id: 'dozen', req: 'roulette', make: function () { return { text: 'Gewinne 3-mal mit einem Dutzend oder einer Kolonne', n: 3, diff: 1, icon: '🧮' }; }, ev: function (q, e) { return e.opt.dozenWin ? 1 : 0; } },
  { id: 'spread', req: 'roulette', make: function () { return { text: 'Setz in einer Runde auf 8 verschiedene Felder', n: 1, diff: 1, icon: '🕸️' }; }, ev: function (q, e) { return e.opt.fields >= 8 ? 1 : 0; } },
  { id: 'zero', req: 'roulette', make: function () { return { text: 'Erlebe, wie die Kugel auf der Zero landet', n: 1, diff: 2, icon: '🟢' }; }, ev: function (q, e) { return e.opt.number === 0 ? 1 : 0; } },
  /* Blackjack */
  { id: 'natural', req: 'bj', make: function () { return { text: 'Bekomme einen Blackjack', n: 1, diff: 1, icon: '🂡' }; }, ev: function (q, e) { return e.opt.natural ? 1 : 0; } },
  { id: 'double', req: 'bj', make: function () { return { text: 'Gewinne 2 verdoppelte Hände', n: 2, diff: 1, icon: '✌️' }; }, ev: function (q, e) { return e.opt.doubleWins || 0; } },
  { id: 'split', req: 'bj', make: function () { return { text: 'Teile ein Paar und gewinne mindestens eine Hand', n: 1, diff: 2, icon: '✂️' }; }, ev: function (q, e) { return e.opt.splitWin ? 1 : 0; } },
  { id: 'cards', req: 'bj', make: function () { return { text: 'Gewinne eine Hand mit 4 oder mehr Karten', n: 1, diff: 1, icon: '🗂️' }; }, ev: function (q, e) { return e.opt.manyCards ? 1 : 0; } },
  /* neue Spiele */
  { id: 'wheel12', req: 'wheel', make: function () { return { text: 'Triff im Glücksrad ein Feld mit 12× oder mehr', n: 1, diff: 2, icon: '🎡' }; }, ev: function (q, e) { return e.opt.wheelHit && e.opt.wheelMult >= 12 ? 1 : 0; } },
  { id: 'dicePair', req: 'dice', make: function () { return { text: 'Gewinne eine Pasch-Wette beim Würfeln', n: 1, diff: 2, icon: '🎲' }; }, ev: function (q, e) { return e.opt.doubleWin ? 1 : 0; } },
  { id: 'diceExact', req: 'dice', make: function () { return { text: 'Triff beim Würfeln eine genaue Summe', n: 1, diff: 1, icon: '🎯' }; }, ev: function (q, e) { return e.opt.exactWin ? 1 : 0; } },
  { id: 'duckDog', req: 'ducks', make: function () { return { text: 'Gewinne mit einer Ente mit Quote 8× oder mehr', n: 1, diff: 2, icon: '🦆' }; }, ev: function (q, e) { return e.opt.duckOdds >= 8 ? 1 : 0; } },
  { id: 'duckWins', req: 'ducks', make: function () { return { text: 'Gewinne 3 Entenrennen', n: 3, diff: 1, icon: '🏁' }; }, ev: function (q, e) { return e.game === 'ducks' && e.opt.duckOdds > 0 ? 1 : 0; } },
  { id: 'plinko3', req: 'plinko', make: function () { return { text: 'Triff im Plinko ein Fach mit 3× oder mehr', n: 1, diff: 1, icon: '🔻' }; }, ev: function (q, e) { return e.opt.plinkoMult >= 3 ? 1 : 0; } },
  { id: 'plinkoBalls', req: 'plinko', make: function () { return { text: 'Lass 30 Plinko-Kugeln fallen', n: 30, diff: 1, icon: '⚪' }; }, ev: function (q, e) { return e.game === 'plinko' && R(e) ? 1 : 0; } },
  { id: 'vault5', req: 'vault', make: function () { return { text: 'Öffne im Tresorknacker 5 Fächer in einer Runde und zahl aus', n: 1, diff: 1, icon: '🔓' }; }, ev: function (q, e) { return e.opt.vaultPicks >= 5 && e.opt.vaultMult > 0 ? 1 : 0; } },
  { id: 'hilo4', req: 'hilo', make: function () { return { text: 'Schaffe 4 Sprossen auf der Hi-Lo-Leiter', n: 1, diff: 1, icon: '🪜' }; }, ev: function (q, e) { return e.opt.hiloSteps >= 4 ? 1 : 0; } },
  { id: 'tower5', req: 'tower', make: function () { return { text: 'Schaffe im Dragon Tower Etage 5', n: 1, diff: 2, icon: '🐉' }; }, ev: function (q, e) { return e.opt.towerFloors >= 5 ? 1 : 0; } },
  /* Crash */
  { id: 'crash', req: 'crash', make: function () { return { text: 'Zahle im Crash bei mindestens 3,00× aus', n: 1, diff: 1, icon: '🚀' }; }, ev: function (q, e) { return e.game === 'crash' && e.opt.mult >= 3 ? 1 : 0; } },
  { id: 'crash5', req: 'crash', make: function () { return { text: 'Zahle 5-mal im Crash aus', n: 5, diff: 1, icon: '🛰️' }; }, ev: function (q, e) { return e.game === 'crash' && e.opt.mult ? 1 : 0; } },
  { id: 'crashHigh', req: 'crash', make: function () { return { text: 'Zahle im Crash bei mindestens 5,00× aus', n: 1, diff: 2, icon: '🌠' }; }, ev: function (q, e) { return e.game === 'crash' && e.opt.mult >= 5 ? 1 : 0; } }
];
var WEEKLY = [
  { id: 'rounds', make: function () { return { text: 'Spiele 150 Runden', n: 150, diff: 1, icon: '🎲' }; }, ev: function (q, e) { return R(e) ? 1 : 0; } },
  { id: 'wins', make: function () { return { text: 'Gewinne 60 Runden', n: 60, diff: 1, icon: '🏆' }; }, ev: function (q, e) { return R(e) && e.net > 0 ? 1 : 0; } },
  { id: 'wager', make: function () { var n = tierMin() * 15000; return { text: 'Setze insgesamt ' + fmt(n) + ' Chips', n: n, diff: 1, icon: '🪙' }; }, ev: function (q, e) { return e.staked; } },
  { id: 'big', make: function () { return { text: 'Gewinne 5-mal das 10-Fache deines Einsatzes', n: 5, diff: 2, icon: '💥' }; }, ev: evBig },
  { id: 'dailies', make: function () { return { text: 'Schließe 7 Daily Quests ab', n: 7, diff: 2, icon: '📜' }; }, ev: function (q, e) { return e.dailyDone ? 1 : 0; } },
  { id: 'level', make: function () { return { text: 'Steige ein Level auf', n: 1, diff: 1, icon: '⭐' }; }, ev: function (q, e) { return e.levelUp ? 1 : 0; } },
  { id: 'streak5', make: function () { return { text: 'Gewinne 5 Runden hintereinander', n: 1, diff: 2, icon: '🔥' }; }, ev: function (q, e) { return R(e) && V.S.winStreak >= 5 ? 1 : 0; } },
  { id: 'highroom', make: function () { return { text: 'Spiele 60 Runden in deinem höchsten Raum', n: 60, diff: 1, icon: '🏰' }; }, cond: function () { return V.S.unlocked > 0; },
    ev: function (q, e) { return R(e) && maxRoom() ? 1 : 0; } },
  { id: 'tips', make: function () { return { text: 'Gib 5-mal Trinkgeld', n: 5, diff: 1, icon: '🥂' }; }, ev: function (q, e) { return e.tip ? 1 : 0; } },
  { id: 'free', req: 'slots', make: function () { return { text: 'Löse 4-mal Freispiele aus', n: 4, diff: 2, icon: '🎁' }; }, ev: function (q, e) { return e.opt.freeTrig ? 1 : 0; } },
  { id: 'sevens', req: 'slots', make: function () { return { text: 'Gewinne 4 Linien mit Siebenen', n: 4, diff: 2, icon: '7️⃣' }; }, ev: function (q, e) { return e.opt.sevens ? 1 : 0; } },
  { id: 'straight', req: 'roulette', make: function () { return { text: 'Triff 4 Einzelzahlen im Roulette', n: 4, diff: 2, icon: '🎯' }; }, ev: function (q, e) { return e.opt.straight ? 1 : 0; } },
  { id: 'color', req: 'roulette', make: function () { return { text: 'Gewinne 30-mal auf Rot oder Schwarz', n: 30, diff: 1, icon: '🔴' }; }, ev: function (q, e) { return e.opt.colorWin ? 1 : 0; } },
  { id: 'natural', req: 'bj', make: function () { return { text: 'Bekomme 8 Blackjacks', n: 8, diff: 1, icon: '🂡' }; }, ev: function (q, e) { return e.opt.natural ? 1 : 0; } },
  { id: 'double', req: 'bj', make: function () { return { text: 'Gewinne 12 verdoppelte Hände', n: 12, diff: 1, icon: '✌️' }; }, ev: function (q, e) { return e.opt.doubleWins || 0; } },
  { id: 'crash', req: 'crash', make: function () { return { text: 'Zahle 6-mal im Crash bei mindestens 3,00× aus', n: 6, diff: 1, icon: '🚀' }; }, ev: function (q, e) { return e.game === 'crash' && e.opt.mult >= 3 ? 1 : 0; } },
  { id: 'crashHigh', req: 'crash', make: function () { return { text: 'Zahle im Crash bei mindestens 10,00× aus', n: 1, diff: 2, icon: '🌠' }; }, ev: function (q, e) { return e.game === 'crash' && e.opt.mult >= 10 ? 1 : 0; } },
  { id: 'tower9', req: 'tower', make: function () { return { text: 'Bezwinge den Dragon Tower bis ganz oben', n: 1, diff: 2, icon: '🏯' }; }, ev: function (q, e) { return e.opt.towerFloors >= 9 ? 1 : 0; } },
  { id: 'wheelHits', req: 'wheel', make: function () { return { text: 'Triff 25-mal im Glücksrad', n: 25, diff: 1, icon: '🎡' }; }, ev: function (q, e) { return e.opt.wheelHit ? 1 : 0; } },
  { id: 'diceHits', req: 'dice', make: function () { return { text: 'Triff 5-mal Pasch oder eine genaue Summe', n: 5, diff: 2, icon: '🎲' }; }, ev: function (q, e) { return e.opt.doubleWin || e.opt.exactWin ? 1 : 0; } },
  { id: 'plinkoBig', req: 'plinko', make: function () { return { text: 'Triff im Plinko ein Fach mit 10× oder mehr', n: 1, diff: 2, icon: '🔻' }; }, ev: function (q, e) { return e.opt.plinkoMult >= 10 ? 1 : 0; } },
  { id: 'vaultBig', req: 'vault', make: function () { return { text: 'Zahle im Tresorknacker 3-mal mit 10× oder mehr aus', n: 3, diff: 2, icon: '💎' }; }, ev: function (q, e) { return e.opt.vaultMult >= 10 ? 1 : 0; } },
  { id: 'hiloLadder', req: 'hilo', make: function () { return { text: 'Schaffe 8 Sprossen auf der Hi-Lo-Leiter', n: 1, diff: 2, icon: '🪜' }; }, ev: function (q, e) { return e.opt.hiloSteps >= 8 ? 1 : 0; } },
  { id: 'towerCash', req: 'tower', make: function () { return { text: 'Zahle 10-mal im Dragon Tower mit Gewinn aus', n: 10, diff: 1, icon: '🐉' }; }, ev: function (q, e) { return e.game === 'tower' && e.net > 0 ? 1 : 0; } },
  { id: 'duckRaces', req: 'ducks', make: function () { return { text: 'Wette bei 40 Entenrennen mit', n: 40, diff: 1, icon: '🦆' }; }, ev: function (q, e) { return e.game === 'ducks' && R(e) ? 1 : 0; } }
];
function allowed(t) { return (!t.req || V.gameOpen(t.req)) && (!t.cond || t.cond()); }
function makeQuest(t, r, K) {
  var m = t.make(r);
  return { id: t.id, text: m.text, icon: m.icon, n: m.n, game: m.game || '', seen: '', p: 0, done: false, claimed: false,
    chips: Math.round(tierMin() * K.chips * m.diff), xp: K.xp * m.diff };
}
function evBig(q, e) { var ref = e.staked || (e.opt && e.opt.refBet) || 0; return ref > 0 && e.ret >= ref * 10 ? 1 : 0; }
var KIND = {
  daily: { tpl: DAILY, key: dayKey, chips: 20, xp: 60, chest: 50, tp: 0, label: 'Daily' },
  weekly: { tpl: WEEKLY, key: weekKey, chips: 120, xp: 250, chest: 300, tp: 1, label: 'Weekly' }
};
/* Meilensteine: dauerhafte Ziele in Stufen */
var MILES = [
  { id: 'rounds', icon: '🎲', name: 'Stammspieler', unit: 'Runden gespielt', steps: [50, 250, 1000, 5000], val: function () { return V.S.qstats.rounds; } },
  { id: 'wins', icon: '🏆', name: 'Gewinnertyp', unit: 'Runden gewonnen', steps: [25, 150, 600, 2500], val: function () { return V.S.qstats.wins; } },
  { id: 'level', icon: '⭐', name: 'Aufsteiger', unit: 'Level erreicht', steps: [5, 10, 20, 35], val: function () { return V.S.level; } },
  { id: 'biggest', icon: '💰', name: 'Großer Fisch', unit: 'Chips größter Einzelgewinn', steps: [1000, 10000, 100000, 1000000], val: function () { return Math.floor(V.S.biggest); } },
  { id: 'naturals', icon: '🂡', name: 'Kartenkönig', unit: 'Blackjacks', steps: [5, 25, 100], val: function () { return V.S.qstats.naturals; } },
  { id: 'straights', icon: '🎯', name: 'Volltreffer', unit: 'Einzelzahlen getroffen', steps: [3, 15, 60], val: function () { return V.S.qstats.straights; } },
  { id: 'frees', icon: '🎁', name: 'Bonusjäger', unit: 'Mal Freispiele ausgelöst', steps: [3, 15, 60], val: function () { return V.S.qstats.frees; } },
  { id: 'rocket', icon: '🚀', name: 'Raketenpilot', unit: 'Crash-Auszahlungen ab 10×', steps: [1, 5, 20], val: function () { return V.S.qstats.crash10; } },
  { id: 'dailies', icon: '📜', name: 'Pflichtbewusst', unit: 'Daily Quests erledigt', steps: [5, 25, 100], val: function () { return V.S.qstats.dailies; } },
  { id: 'wheel', game: 'wheel', icon: '🎡', name: 'Glücksrad-Profi', unit: 'Treffer im Glücksrad', steps: [10, 50, 200], val: function () { return V.S.qstats.wheelHits; } },
  { id: 'dice', game: 'dice', icon: '🎲', name: 'Würfelglück', unit: 'Pasch- oder Summen-Treffer', steps: [3, 15, 60], val: function () { return V.S.qstats.diceHits; } },
  { id: 'ducks', game: 'ducks', icon: '🦆', name: 'Wettkönig', unit: 'gewonnene Entenrennen', steps: [5, 25, 100], val: function () { return V.S.qstats.duckWins; } },
  { id: 'plinko', game: 'plinko', icon: '🔻', name: 'Kugelblitz', unit: 'Plinko-Kugeln', steps: [100, 500, 2000], val: function () { return V.S.qstats.plinkoBalls; } },
  { id: 'tower', game: 'tower', icon: '🐉', name: 'Drachenbezwinger', unit: 'Türme bis ganz oben', steps: [1, 5, 20], val: function () { return V.S.qstats.towerTops; } },
  { id: 'vault', game: 'vault', icon: '🔓', name: 'Tresorknacker', unit: 'Auszahlungen ab 10×', steps: [1, 10, 40], val: function () { return V.S.qstats.vaultBig; } },
  { id: 'hilo', game: 'hilo', icon: '🪜', name: 'Himmelsleiter', unit: 'Sprossen in einer Runde (Rekord)', steps: [5, 10, 15], val: function () { return V.S.qstats.hiloBest; } }
];

function ensureQuests() {
  var S = V.S;
  ['daily', 'weekly'].forEach(function (kind) {
    var K = KIND[kind], key = K.key(), cur = S.quests[kind];
    if (cur && cur.key === key && cur.list && cur.list.length) { if (cur.swaps === undefined) cur.swaps = 1; nerf(cur, kind); rescale(cur); replaceOrphans(cur, kind); return; }
    var r = rng(hash(kind + key + '|' + (V.slotId || '')));
    var pool = K.tpl.filter(allowed);
    var list = [];
    while (list.length < 3 && pool.length) list.push(makeQuest(pool.splice(Math.floor(r() * pool.length), 1)[0], r, K));
    S.quests[kind] = { key: key, list: list, chest: false, swaps: 1, scale: tierMin(), v: 2 };
  });
}
/* Quests zu entfernten Spielen (z. B. Video-Poker) werden still gegen passende neue getauscht */
function replaceOrphans(st, kind) {
  var K = KIND[kind], ids = {};
  K.tpl.forEach(function (t) { ids[t.id] = t; });
  st.list.forEach(function (q, i) {
    if (q.claimed || (ids[q.id] && allowed(ids[q.id]))) return;
    var used = st.list.map(function (x) { return x.id; });
    var pool = K.tpl.filter(function (t) { return allowed(t) && used.indexOf(t.id) < 0; });
    if (pool.length) st.list[i] = makeQuest(pool[Math.floor(Math.random() * pool.length)], Math.random, K);
  });
}
/* Version 2: niedrigere Quest-Belohnungen, offene Quests aus älteren Spielständen umrechnen */
var OLD_CHIPS = { daily: 120, weekly: 700 };
function nerf(st, kind) {
  if (st.v >= 2) return;
  st.list.forEach(function (q) { if (!q.claimed) q.chips = Math.round(q.chips * KIND[kind].chips / OLD_CHIPS[kind]); });
  st.v = 2;
}
function claimQuest(kind, i, sum) {
  var S = V.S, q = S.quests[kind].list[i];
  if (!q || !q.done || q.claimed) return;
  q.claimed = true;
  var chips = Math.round(q.chips * qmult()), xp = Math.round(q.xp * qmult());
  S.balance += chips;
  if (sum) { sum.n++; sum.chips += chips; sum.xp += xp; }
  else { V.Snd.cash(); V.toast('Quest-Belohnung: +' + fmt(chips) + ' Chips, +' + xp + ' XP', 'good'); }
  addXp(xp);
  if (kind === 'daily') { S.qstats.dailies++; progress({ dailyDone: true }, ['weekly']); }
  V.hud(); V.side.refresh(); V.save();
}
/* Stufe oder (Sandbox) Raum gewechselt: offene Quests auf den neuen Maßstab umrechnen.
   Belohnung und Einsatz-Ziele wachsen mit, der Fortschritt in Prozent bleibt gleich. */
function rescale(st) {
  var now = tierMin();
  /* Ältere Quests wurden nach der höchsten Stufe erzeugt */
  if (!st.scale) st.scale = E.TIERS[V.S.unlocked].min;
  if (st.scale === now) return;
  var k = now / st.scale;
  st.list.forEach(function (q) {
    if (q.claimed) return;
    q.chips = Math.round(q.chips * k);
    if (q.id === 'wager') {
      q.n = Math.round(q.n * k); q.p = Math.min(q.n, Math.round(q.p * k));
      q.text = 'Setze insgesamt ' + fmt(q.n) + ' Chips';
    }
  });
  st.scale = now;
}

/* Eine offene Quest gegen eine andere tauschen (1-mal pro Tag bzw. Woche) */
function swapQuest(kind, i) {
  var S = V.S, K = KIND[kind], st = S.quests[kind], q = st.list[i];
  if (!q || q.done || !(st.swaps > 0)) return;
  var used = st.list.map(function (x) { return x.id; });
  var pool = K.tpl.filter(function (t) { return allowed(t) && used.indexOf(t.id) < 0; });
  if (!pool.length) { V.toast('Gerade gibt es keine andere passende Quest.', 'bad'); return; }
  st.list[i] = makeQuest(pool[Math.floor(Math.random() * pool.length)], Math.random, K);
  st.swaps--;
  V.Snd.click(); V.toast('Neue Quest: ' + st.list[i].text, 'good');
  V.side.refresh(); V.save();
}
function allClaimed(kind) { var l = V.S.quests[kind].list; return l.length > 0 && l.every(function (q) { return q.claimed; }); }
function claimChest(kind, sum) {
  var S = V.S, K = KIND[kind], st = S.quests[kind];
  if (st.chest || !allClaimed(kind)) return;
  var chips = Math.round(tierMin() * K.chest * qmult());
  st.chest = true; S.balance += chips; S.bonusTp += K.tp;
  if (sum) { sum.n++; sum.chips += chips; sum.tp += K.tp; sum.chests++; }
  else {
    V.Snd.big(); V.burst(V.$('#drawer .drawer-panel'), 30);
    V.banner(K.label + '-Truhe', '+' + fmt(chips) + ' Chips' + (K.tp ? ' und +' + K.tp + ' Talentpunkt' : ''), { kind: 'win', ms: 3000 });
  }
  V.hud(); V.side.refresh(); V.save();
}
function mileStep(m) { return (V.S.qstats.miles[m.id] || 0); }
function mileReward(m, k) { return { chips: Math.round(tierMin() * 25 * (k + 1) * qmult()), xp: Math.round(80 * (k + 1) * qmult()) }; }
function claimMile(id, sum) {
  var S = V.S, m = null;
  MILES.forEach(function (x) { if (x.id === id) m = x; });
  var k = mileStep(m);
  if (!m || k >= m.steps.length || m.val() < m.steps[k]) return false;
  var rw = mileReward(m, k);
  S.qstats.miles[id] = k + 1; S.balance += rw.chips;
  if (sum) { sum.n++; sum.chips += rw.chips; sum.xp += rw.xp; }
  else { V.Snd.unlock(); V.toast(m.icon + ' ' + m.name + ' Stufe ' + (k + 1) + ': +' + fmt(rw.chips) + ' Chips, +' + rw.xp + ' XP', 'good'); }
  addXp(rw.xp);
  V.hud(); V.side.refresh(); V.save();
  return true;
}
function mileReady(m) { var k = mileStep(m); return (!m.game || V.gameOpen(m.game)) && k < m.steps.length && m.val() >= m.steps[k]; }

/* Alles auf einmal abholen: Quests, Truhen und Meilensteine, mit einer einzigen Meldung */
function claimAll() {
  var S = V.S, sum = { n: 0, chips: 0, xp: 0, tp: 0, chests: 0 }, tp0 = pointsFree();
  ['daily', 'weekly'].forEach(function (kind) {
    S.quests[kind].list.forEach(function (q, i) { if (q.done && !q.claimed) claimQuest(kind, i, sum); });
    claimChest(kind, sum);
  });
  MILES.forEach(function (m) { while (mileReady(m) && claimMile(m.id, sum)) { /* mehrere Stufen auf einmal */ } });
  if (!sum.n) return;
  var gotTp = pointsFree() - tp0;
  V.Snd.big(); V.burst(V.$('#drawer .drawer-panel'), 40);
  V.banner(sum.n + ' Belohnung' + (sum.n > 1 ? 'en' : '') + ' abgeholt', '+' + fmt(sum.chips) + ' Chips · +' + fmt(sum.xp) + ' XP' + (gotTp > 0 ? ' · ' + gotTp + ' Talentpunkt' + (gotTp > 1 ? 'e' : '') + ' frei' : ''),
    gotTp > 0 ? { kind: 'win', ms: 5000, actions: [{ label: 'Talentbaum', gold: true, fn: function () { V.openSide('talente'); } }, { label: 'Später', fn: function () {} }] } : { kind: 'win', ms: 3200 });
  V.hud(); V.side.refresh(); V.renderBadges(); V.save();
}
function claimableCount() { return questClaimable(); }

/* ================= Gebündelte Meldungen ================= */
/* Alles, was während einer Runde passiert (Quests, Level, Meilensteine), kommt als eine Karte statt vieler Toasts */
var pend = [], noteEl = null, noteTimer = 0, flushTimer = 0, notedMiles = {};
function notify(item) { pend.push(item); clearTimeout(flushTimer); flushTimer = setTimeout(flushNotes, 650); }
function closeNote() { if (noteEl) { noteEl.classList.add('out'); var n = noteEl; noteEl = null; setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 300); } }
function flushNotes() {
  if (!pend.length) return;
  var items = pend; pend = [];
  if (!noteEl) {
    noteEl = el('div', { class: 'notice', role: 'status' }, el('div', { class: 'nt-list' }), el('div', { class: 'nt-acts' }));
    noteEl.addEventListener('mouseenter', function () { clearTimeout(noteTimer); });
    noteEl.addEventListener('mouseleave', function () { clearTimeout(noteTimer); noteTimer = setTimeout(closeNote, 3000); });
    document.body.appendChild(noteEl);
  }
  var list = noteEl.querySelector('.nt-list');
  items.forEach(function (it) { list.appendChild(el('div', { class: 'nt-item ' + it.kind }, el('span', { class: 'nt-ico', text: it.icon }), el('span', { text: it.text }))); });
  while (list.children.length > 5) list.removeChild(list.firstChild);
  /* Knöpfe nach dem, was gerade abzuholen oder zu verteilen ist */
  var acts = noteEl.querySelector('.nt-acts'), claim = questClaimable(), free = pointsFree();
  acts.innerHTML = '';
  if (claim) acts.appendChild(el('button', { class: 'btn gold sm', type: 'button', text: 'Alles abholen (' + claim + ')', onclick: function () { closeNote(); claimAll(); } }));
  if (free) acts.appendChild(el('button', { class: 'btn ghost sm', type: 'button', text: 'Talentbaum (' + free + ')', onclick: function () { closeNote(); V.openSide('talente'); } }));
  acts.appendChild(el('button', { class: 'icon-btn nt-x', type: 'button', 'aria-label': 'Schließen', text: '✕', onclick: closeNote }));
  noteEl.classList.remove('pop'); void noteEl.offsetWidth; noteEl.classList.add('pop');
  V.Snd.win();
  clearTimeout(noteTimer); noteTimer = setTimeout(closeNote, 8000);
  V.renderBadges();
}
/* Neu erreichte Meilenstein-Stufen einmal melden */
function checkMiles() {
  MILES.forEach(function (m) {
    var k = mileStep(m), key = m.id + ':' + k;
    if (mileReady(m) && !notedMiles[key]) { notedMiles[key] = true; notify({ kind: 'mile', icon: m.icon, text: 'Meilenstein ' + m.name + ' Stufe ' + (k + 1) + ' geschafft' }); }
  });
}

/* Fortschritt für Daily und Weekly aus einem Ereignis */
function progress(e, kinds) {
  ensureQuests();
  e.opt = e.opt || {}; e.staked = e.staked || 0; e.ret = e.ret || 0; e.net = e.net || 0;
  (kinds || ['daily', 'weekly']).forEach(function (kind) {
    var tpl = {}; KIND[kind].tpl.forEach(function (t) { tpl[t.id] = t; });
    V.S.quests[kind].list.forEach(function (q) {
      if (q.done) return;
      var t = tpl[q.id]; if (!t) return;
      var add = t.ev(q, e);
      if (!add) return;
      q.p = Math.min(q.n, q.p + add);
      if (q.p >= q.n) { q.done = true; notify({ kind: 'quest', icon: q.icon || '📜', text: q.text }); }
    });
  });
}

/* ================= Rundenauswertung ================= */
function onRound(e) {
  var Q = V.S.qstats, o = e.opt || {};
  if (e.staked > 0) { addXp(roundXp(e.net)); Q.rounds++; }
  if (e.net > 0 && e.staked > 0) Q.wins++;
  if (o.natural) Q.naturals++;
  if (o.straight) Q.straights++;
  if (o.freeTrig) Q.frees++;
  if (o.mult >= 10) Q.crash10++;
  if (o.wheelHit) Q.wheelHits++;
  if (o.doubleWin || o.exactWin) Q.diceHits++;
  if (e.game === 'ducks' && o.duckOdds > 0) Q.duckWins++;
  if (e.game === 'plinko' && e.staked > 0) Q.plinkoBalls++;
  if (o.towerFloors >= 9) Q.towerTops++;
  if (o.vaultMult >= 10) Q.vaultBig++;
  if (o.hiloSteps) Q.hiloBest = Math.max(Q.hiloBest || 0, o.hiloSteps);
  e.opt = o;
  progress(e);
  checkMiles();
}

/* Ältere Spielstände: bisherige Runden einmalig als Erfahrung und Statistik anrechnen (ohne Banner) */
function migrate() {
  var S = V.S;
  if (!S.metaInit) {
    S.metaInit = 1; S.metaVer = 2;
    if (S.rounds > 0) {
      S.xp += Math.round(S.rounds * 7);
      while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; }
    }
  } else if ((S.metaVer || 0) < 2) {
    /* Version 2: gesammelte XP auf die neue, langsamere Kurve umrechnen */
    var total = S.xp;
    for (var L = 1; L < S.level; L++) total += xpForOld(L);
    S.level = 1; S.xp = Math.round(total * 0.55);
    while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; }
    S.metaVer = 2;
    if (pointsSpent() > pointsTotal()) {
      S.talents = {};
      setTimeout(function () { V.toast('Neue Talent-Balance: Deine Talentpunkte wurden zurückgegeben. Verteil sie neu im Talentbaum.', 'warn'); }, 1500);
    }
  }
  if (!S.qstats.init) { S.qstats.init = 1; S.qstats.rounds = Math.max(S.qstats.rounds, S.rounds); }
  /* Talente, deren Vorgänger fehlt (alte Version oder Modus ohne Imperium), werden zurückerstattet */
  var changed = true, refunded = 0;
  while (changed) {
    changed = false;
    Object.keys(S.talents).forEach(function (id) {
      var t = T_BY[id];
      if (!t || (t.empire && !isEmpire()) || !unlockedNode(t)) { refunded += S.talents[id] || 0; delete S.talents[id]; changed = true; }
    });
  }
  if (refunded) setTimeout(function () { V.toast('Der Talentbaum wurde erweitert: ' + refunded + ' Talentpunkt' + (refunded > 1 ? 'e' : '') + ' zurückgegeben. Verteil sie neu.', 'warn'); }, 1600);
  ensureQuests();
  V.save();
}

/* ================= Hinweis-Punkte ================= */
function questClaimable() {
  ensureQuests();
  var n = 0;
  ['daily', 'weekly'].forEach(function (kind) {
    n += V.S.quests[kind].list.filter(function (q) { return q.done && !q.claimed; }).length;
    if (allClaimed(kind) && !V.S.quests[kind].chest) n++;
  });
  MILES.forEach(function (m) { var k = mileStep(m); if ((!m.game || V.gameOpen(m.game)) && k < m.steps.length && m.val() >= m.steps[k]) n++; });
  return n;
}
function badges() {
  var cap = vaultCap();
  return { quests: questClaimable() > 0, talente: pointsFree() > 0, imperium: isEmpire() && cap > 0 && vault() >= cap * 0.5 };
}

/* ================= Ansichten im Fenster ================= */
function bar(p) { var i = el('i'); i.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%'; return el('div', { class: 'mbar' }, i); }
function until(ms) { var m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24); return d >= 1 ? d + ' T. ' + (h % 24) + ' Std.' : h ? h + ' Std. ' + (m % 60) + ' Min.' : m + ' Min.'; }

/* ---- Talentbaum ---- */
function renderTalente(body) {
  var S = V.S, need = xpFor(S.level), free = pointsFree();
  body.appendChild(el('div', { class: 'lvl-head' },
    el('div', { class: 'lvl-badge', text: String(S.level) }),
    el('div', { class: 'lvl-info' },
      el('b', { text: 'Level ' + S.level }),
      bar(S.xp / need),
      el('span', { class: 'fine', text: fmt(S.xp) + ' / ' + fmt(need) + ' XP bis Level ' + (S.level + 1) + ' · XP gibt es für jede Runde und für Quests' })),
    el('div', { class: 'tp-box' + (free ? ' has' : '') }, el('b', { text: String(free) }), el('span', { text: free === 1 ? 'Punkt frei' : 'Punkte frei' }))));

  if (!selTalent || !T_BY[selTalent] || (T_BY[selTalent].empire && !isEmpire())) {
    selTalent = null;
    TALENTS.forEach(function (t) { if (!selTalent && (!t.empire || isEmpire()) && unlockedNode(t) && tl(t.id) < t.vals.length) selTalent = t.id; });
    selTalent = selTalent || 'slotLuck';
  }
  var tree = el('div', { class: 'tree' });
  BRANCHES.forEach(function (br) {
    if (!activeTalents(br.id).length) return;
    var spent = 0; activeTalents(br.id).forEach(function (t) { spent += tl(t.id); });
    var col = el('section', { class: 'tbranch' + (br.id === 'le' ? ' legend' : '') }, el('header', { class: 'tb-h' },
      el('span', { class: 'tb-ico', text: br.icon }), el('div', {}, el('b', { text: br.name }), el('small', { text: br.desc })), el('span', { class: 'tb-pts', text: String(spent) })));
    col.style.setProperty('--bc', br.color);
    var path = el('div', { class: 'tpath' });
    activeTalents(br.id).forEach(function (t, i) {
      var l = tl(t.id), max = t.vals.length, open = unlockedNode(t);
      var state = l >= max ? 'max' : l > 0 ? 'got' : open ? (free ? 'ready' : 'open') : 'locked';
      if (i > 0) path.appendChild(el('span', { class: 'tlink' + (open ? ' lit' : '') }));
      var ring = el('span', { class: 'tpips' });
      for (var k = 0; k < max; k++) ring.appendChild(el('i', { class: k < l ? 'on' : '' }));
      path.appendChild(el('button', { class: 'tnode ' + state + (selTalent === t.id ? ' sel' : ''), type: 'button', 'aria-label': t.name + ', Stufe ' + l + ' von ' + max,
        onclick: function () { selTalent = t.id; V.Snd.click(); V.side.refresh(); var d = document.querySelector('.tdetail'); if (d && window.matchMedia('(max-width: 980px)').matches) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
        el('span', { class: 'tn-ico', text: state === 'locked' ? '🔒' : t.icon }), el('span', { class: 'tn-name', text: t.name }), ring));
    });
    col.appendChild(path);
    tree.appendChild(col);
  });

  /* Detail des gewählten Talents */
  var t = T_BY[selTalent], l = tl(t.id), max = t.vals.length, open = unlockedNode(t), p = parentOf(t);
  var lines = [];
  for (var k = 0; k < max; k++) lines.push(el('li', { class: k < l ? 'on' : k === l ? 'next' : '' }, el('b', { text: 'Stufe ' + (k + 1) }), ' ' + t.txt(t.vals[k])));
  var reason = l >= max ? 'Voll ausgebaut' : t.legend && stars() < t.legend ? 'Ab ★' + t.legend + ': Werde Legende unter „Stufen“' : !open ? 'Erst „' + p.name + '“ lernen' : !free ? 'Kein Talentpunkt frei' : '';
  var detail = el('div', { class: 'tdetail' },
    el('div', { class: 'td-ico', text: t.icon }),
    el('div', { class: 'td-info' },
      el('b', { text: t.name }),
      el('ul', { class: 'td-levels' }, lines),
      t.game && !V.gameOpen(t.game) ? el('p', { class: 'fine', text: 'Wirkt, sobald ' + GN[t.game] + ' freigeschaltet ist.' }) : null),
    el('div', { class: 'td-act' },
      el('button', { class: 'btn gold', type: 'button', disabled: !!reason, text: l ? 'Verbessern · 1 Punkt' : 'Lernen · 1 Punkt', onclick: function () { learn(t.id); } }),
      reason ? el('span', { class: 'fine', text: reason }) : null));
  body.appendChild(el('div', { class: 'talent-wrap' }, tree, detail));

  var c = respecCost(), row;
  if (!confirmRespec) row = el('button', { class: 'btn ghost sm', type: 'button', disabled: pointsSpent() === 0, text: 'Neu verteilen · ' + fmt(c) + ' Chips', onclick: function () { confirmRespec = true; V.side.refresh(); } });
  else row = el('span', { class: 'confirm' }, el('span', { text: 'Alle Talente zurücksetzen für ' + fmt(c) + ' Chips?' }),
    el('button', { class: 'btn crimson sm', type: 'button', text: 'Ja', onclick: respec }),
    el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmRespec = false; V.side.refresh(); } }));
  body.appendChild(el('div', { class: 'rrow respec' }, row, el('span', { class: 'fine', text: 'Probier verschiedene Strategien aus. Beim Neuverteilen bekommst du alle Punkte zurück.' })));
}

/* ---- Imperium ---- */
function renderImperium(body) {
  var S = V.S, ph = perHour(), cap = vaultCap(), v = vault();
  body.appendChild(el('div', { class: 'emp-head' },
    el('div', { class: 'emp-kpi' }, el('span', { class: 'lbl', text: 'Einnahmen' }), el('b', { class: 'num', text: fmt(ph) + ' / Std.' })),
    el('div', { class: 'emp-kpi' }, el('span', { class: 'lbl', text: 'Imperiumswert' }), el('b', { class: 'num', text: fmt(worth()) })),
    el('div', { class: 'vault' + (cap && v >= cap ? ' full' : '') },
      el('div', { class: 'vault-h' }, el('span', { class: 'lbl', text: 'Tresor (füllt sich auch offline)' }), el('b', { id: 'vaultAmt', class: 'num', text: fmt(v) + ' / ' + fmt(cap) })),
      el('div', { id: 'vaultBar' }, bar(cap ? v / cap : 0)),
      el('button', { id: 'vaultBtn', class: 'btn gold sm', type: 'button', disabled: v <= 0, text: 'Tresor leeren', onclick: function () { collect(); V.side.refresh(); } }))));
  if (!ph) body.appendChild(el('p', { class: 'side-intro', text: 'Kauf dein erstes Geschäft. Es verdient Chips pro Stunde, auch wenn du nicht spielst. Hol sie regelmäßig aus dem Tresor, bevor er voll ist (' + vaultHours() + ' Std.). Ziel: das eigene Casino.' }));
  var list = el('div', { class: 'biz-list' });
  BIZ.forEach(function (b) {
    var lv = bizLv(b.id), open = bizOpen(b), c = upCost(b, lv), mult = 1 + perk('empire');
    var cur = bizIncome(b, lv) * mult, nxt = bizIncome(b, lv + 1) * mult;
    var btn;
    if (!open) btn = el('button', { class: 'btn ghost sm', type: 'button', disabled: true, text: 'Ab ' + E.TIERS[b.tier].name });
    else if (lv >= MAX_BIZ) btn = el('button', { class: 'btn ghost sm', type: 'button', disabled: true, text: 'Voll ausgebaut' });
    else btn = el('button', { class: 'btn ' + (S.balance >= c ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: S.balance < c,
      text: (lv ? 'Ausbauen' : 'Kaufen') + ' · ' + V.short(c), onclick: function () { buy(b.id); } });
    var pips = el('span', { class: 'pips' });
    for (var k = 0; k < MAX_BIZ; k++) pips.appendChild(el('i', { class: k < lv ? 'on' : '' }));
    list.appendChild(el('article', { class: 'biz' + (lv ? ' owned' : '') + (open ? '' : ' locked') },
      el('div', { class: 'biz-ico', text: b.icon }),
      el('div', { class: 'biz-info' },
        el('div', { class: 'biz-h' }, el('b', { text: b.name }), pips),
        el('div', { class: 'fine', text: b.desc }),
        el('div', { class: 'biz-k' }, lv ? el('span', { text: 'Stufe ' + lv + ' · ' + fmt(cur) + '/Std.' }) : null,
          lv < MAX_BIZ ? el('span', { class: 'up', text: (lv ? 'danach ' : 'bringt ') + fmt(nxt) + '/Std.' }) : null)),
      btn));
  });
  body.appendChild(list);
  body.appendChild(el('p', { class: 'fine', text: 'Geschäfte kann man nicht verkaufen. Der Imperiumswert zählt deine Chips plus alles, was du investiert hast, und entscheidet über die Imperium-Bestenliste.' }));
}

/* ---- Quests ---- */
var questView = 'daily';
function questCard(kind, q, i, canSwap) {
  var chips = Math.round(q.chips * qmult()), xp = Math.round(q.xp * qmult());
  return el('article', { class: 'quest' + (q.done ? ' done' : '') + (q.claimed ? ' claimed' : '') },
    el('div', { class: 'q-ico', text: q.claimed ? '✓' : q.icon || '★' }),
    el('div', { class: 'q-info' },
      el('b', { text: q.text }),
      el('div', { class: 'q-prog' }, bar(q.p / q.n), el('span', { class: 'num', text: fmt(q.p) + '/' + fmt(q.n) })),
      el('div', { class: 'q-rew' }, el('span', { class: 'rw chips', text: '+' + V.short(chips) }), el('span', { class: 'rw xp', text: '+' + xp + ' XP' }))),
    q.done || q.claimed || !canSwap
      ? el('button', { class: 'btn ' + (q.done && !q.claimed ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: !q.done || q.claimed,
          text: q.claimed ? 'Abgeholt' : q.done ? 'Abholen' : 'Offen', onclick: function () { claimQuest(kind, i); } })
      : el('button', { class: 'btn ghost sm q-swap', type: 'button', title: 'Diese Quest gegen eine andere tauschen', text: '↻ Tauschen',
          onclick: function () { swapQuest(kind, i); } }));
}
function renderQuestList(body, kind) {
  var K = KIND[kind], st = V.S.quests[kind];
  var next = kind === 'daily' ? (function () { var d = new Date(); d.setHours(24, 0, 0, 0); return d - Date.now(); })() : weekStart().getTime() + 7 * 864e5 - Date.now();
  body.appendChild(el('div', { class: 'q-top' },
    el('span', { class: 'fine', text: (kind === 'daily' ? 'Jeden Tag drei neue Quests.' : 'Jede Woche drei große Quests, Reset am Montag.') + (st.swaps > 0 ? ' Du kannst eine offene Quest tauschen.' : '') }),
    el('span', { class: 'q-timer', text: '⏳ Neue in ' + until(next) })));
  var list = el('div', { class: 'quests' });
  st.list.forEach(function (q, i) { list.appendChild(questCard(kind, q, i, st.swaps > 0)); });
  body.appendChild(list);
  var all = allClaimed(kind), chips = Math.round(tierMin() * K.chest * qmult());
  body.appendChild(el('div', { class: 'chest' + (all && !st.chest ? ' ready' : '') + (st.chest ? ' opened' : '') },
    el('div', { class: 'chest-ico', text: st.chest ? '🎉' : kind === 'weekly' ? '💎' : '🧰' }),
    el('div', {}, el('b', { text: K.label + '-Truhe' }),
      el('div', { class: 'fine', text: st.chest ? 'Schon geöffnet. Bald gibt es neue Quests.' : '+' + fmt(chips) + ' Chips' + (K.tp ? ' und +1 Talentpunkt' : '') + ', wenn alle drei abgeholt sind.' })),
    el('button', { class: 'btn ' + (all && !st.chest ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: !all || st.chest, text: st.chest ? 'Geöffnet' : 'Öffnen', onclick: function () { claimChest(kind); } })));
}
function renderMiles(body) {
  body.appendChild(el('p', { class: 'fine q-intro', text: 'Dauerhafte Ziele. Jede Stufe bringt einmalig Chips und Erfahrung.' }));
  var grid = el('div', { class: 'miles' });
  MILES.filter(function (m) { return !m.game || V.gameOpen(m.game); }).forEach(function (m) {
    var k = mileStep(m), maxed = k >= m.steps.length, goal = maxed ? m.steps[m.steps.length - 1] : m.steps[k], v = m.val();
    var ready = !maxed && v >= goal, rw = maxed ? null : mileReward(m, k);
    var stars = el('span', { class: 'm-stars' });
    m.steps.forEach(function (s, j) { stars.appendChild(el('i', { class: j < k ? 'on' : '', text: '★' })); });
    grid.appendChild(el('article', { class: 'mile' + (ready ? ' ready' : '') + (maxed ? ' maxed' : '') },
      el('div', { class: 'm-h' }, el('span', { class: 'm-ico', text: m.icon }), el('b', { text: m.name }), stars),
      el('div', { class: 'fine', text: fmt(Math.min(v, goal)) + ' / ' + fmt(goal) + ' ' + m.unit }),
      bar(v / goal),
      maxed ? el('div', { class: 'fine m-done', text: 'Alle Stufen geschafft' })
        : el('button', { class: 'btn ' + (ready ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: !ready,
          text: ready ? 'Abholen · +' + V.short(rw.chips) : 'Stufe ' + (k + 1) + ': +' + V.short(rw.chips) + ' · ' + rw.xp + ' XP', onclick: function () { claimMile(m.id); } })));
  });
  body.appendChild(grid);
}
function renderQuests(body) {
  ensureQuests();
  var S = V.S, cnt = function (kind) { return S.quests[kind].list.filter(function (q) { return q.done && !q.claimed; }).length + (allClaimed(kind) && !S.quests[kind].chest ? 1 : 0); };
  var mcnt = 0; MILES.forEach(function (m) { var k = mileStep(m); if ((!m.game || V.gameOpen(m.game)) && k < m.steps.length && m.val() >= m.steps[k]) mcnt++; });
  var seg = el('div', { class: 'qseg', role: 'tablist' });
  [['daily', 'Daily', cnt('daily')], ['weekly', 'Weekly', cnt('weekly')], ['miles', 'Meilensteine', mcnt]].forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(questView === x[0]), onclick: function () { questView = x[0]; V.Snd.click(); V.side.refresh(); } },
      x[1], x[2] ? el('span', { class: 'qcount', text: String(x[2]) }) : null));
  });
  var total = questClaimable();
  body.appendChild(el('div', { class: 'q-top' }, seg,
    total ? el('button', { class: 'btn gold sm', type: 'button', text: 'Alles abholen (' + total + ')', onclick: claimAll }) : null));
  if (questView === 'miles') renderMiles(body); else renderQuestList(body, questView);
}

/* Laufende Anzeige im Fenster (Tresor) ohne komplettes Neuzeichnen */
function tick() {
  var a = document.getElementById('vaultAmt');
  if (a) {
    var cap = vaultCap(), v = vault();
    a.textContent = fmt(v) + ' / ' + fmt(cap);
    var i = document.querySelector('#vaultBar i'); if (i) i.style.width = (cap ? Math.min(1, v / cap) * 100 : 0).toFixed(1) + '%';
    var btn = document.getElementById('vaultBtn'); if (btn) btn.disabled = v <= 0;
  }
}

return {
  perk: perk, onRound: onRound, notify: notify, claimAll: claimAll, migrate: migrate, event: function (e) { progress(e); }, addXp: addXp, xpFor: xpFor, badges: badges, tick: tick, ensureQuests: ensureQuests,
  pointsFree: pointsFree, worth: worth, perHour: perHour, isEmpire: isEmpire,
  tabs: { talente: renderTalente, imperium: renderImperium, quests: renderQuests }
};
})();
V.meta = Meta;
