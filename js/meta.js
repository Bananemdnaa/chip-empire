/* Chip Empire – Fortschritt: Level & Talente, Imperium (Geschäfte mit Einnahmen), tägliche Aufträge */
var Meta = (function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt;
var GN = { slots: 'Slots', roulette: 'Roulette', bj: 'Blackjack', crash: 'Crash' };
function pct(v) { return (Math.round(v * 1000) / 10).toString().replace('.', ',') + ' %'; }

/* ================= Level ================= */
/* XP, um von Level L auf L+1 zu kommen */
function xpFor(level) { return Math.round(60 * Math.pow(level, 1.4)); }
function addXp(n) {
  var S = V.S;
  n = Math.round(n * (1 + perk('xp')));
  if (n <= 0) return;
  S.xp += n;
  var ups = 0;
  while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; ups++; }
  if (ups) {
    V.Snd.unlock();
    V.banner('Level ' + S.level + '!', '+' + ups + ' Talentpunkt' + (ups > 1 ? 'e' : '') + ' zum Verteilen', { kind: 'level', ms: 5000, actions: [
      { label: 'Talente öffnen', gold: true, fn: function () { V.openSide('talente'); } }, { label: 'Später', fn: function () {} }] });
  }
}
/* Pro Runde: mehr XP in höheren Räumen, Gewinne zählen 50 % mehr */
function roundXp(net) { return 10 * (1 + 0.5 * V.S.room) * (net > 0 ? 1.5 : 1); }

/* ================= Talente ================= */
var BRANCHES = [
  { id: 'gl', name: 'Glück', icon: '🍀', desc: 'Für Slots-Spieler: mehr aus jedem Dreh.' },
  { id: 'ta', name: 'Taktik', icon: '🎯', desc: 'Für die Tische: bessere Regeln bei Roulette, Blackjack und Crash.' },
  { id: 'bu', name: 'Business', icon: '💼', desc: 'Für dein Imperium: mehr Einnahmen, Boni und Erfahrung.' }
];
var TALENTS = [
  { id: 'slotLuck', br: 'gl', name: 'Glückssträhne', vals: [0.005, 0.01, 0.015], txt: function (v) { return 'Slot-Gewinne +' + pct(v); } },
  { id: 'slotFree', br: 'gl', name: 'Bonusjäger', vals: [1, 2], txt: function (v) { return '+' + v + ' Freispiel' + (v > 1 ? 'e' : '') + ' pro Bonus'; } },
  { id: 'partage', br: 'ta', name: 'La Partage', game: 'roulette', vals: [1], txt: function () { return 'Roulette: Bei Zero bekommst du die Hälfte deiner einfachen Chancen zurück'; } },
  { id: 'bjPay', br: 'ta', name: 'Naturtalent', game: 'bj', vals: [0.1], txt: function () { return 'Blackjack zahlt 1,6-fach statt 1,5-fach'; } },
  { id: 'crashSafe', br: 'ta', name: 'Fallschirm', game: 'crash', vals: [1], txt: function () { return 'Crash: Ein Sofort-Crash bei 1,00× kostet dich nichts'; } },
  { id: 'comps', br: 'bu', name: 'Stammkunde', vals: [0.15, 0.3, 0.5], txt: function (v) { return 'Comps +' + pct(v); } },
  { id: 'daily', br: 'bu', name: 'Frühaufsteher', vals: [0.25, 0.5], txt: function (v) { return 'Tagesbonus +' + pct(v); } },
  { id: 'rescue', br: 'bu', name: 'Rettungsring', vals: [180000, 300000], txt: function (v) { return 'Notgroschen schon nach ' + Math.round((V.CAREER.bailoutCooldown - v) / 60000) + ' Minuten'; } },
  { id: 'empire', br: 'bu', name: 'Investor', vals: [0.1, 0.2, 0.35], txt: function (v) { return 'Imperium-Einnahmen +' + pct(v); } },
  { id: 'vault', br: 'bu', name: 'Großer Tresor', vals: [4, 8], txt: function (v) { return 'Tresor fasst ' + (8 + v) + ' statt 8 Stunden'; } },
  { id: 'xp', br: 'bu', name: 'Schnelllerner', vals: [0.15, 0.3], txt: function (v) { return 'Erfahrung +' + pct(v); } }
];
var T_BY = {}; TALENTS.forEach(function (t) { T_BY[t.id] = t; });
function tl(id) { return (V.S.talents && V.S.talents[id]) || 0; }
function perk(id) { var t = T_BY[id], l = tl(id); return t && l ? t.vals[l - 1] : 0; }
function pointsTotal() { return V.S.level - 1 + V.S.bonusTp; }
function pointsSpent() { var n = 0; TALENTS.forEach(function (t) { n += tl(t.id); }); return n; }
function pointsFree() { return Math.max(0, pointsTotal() - pointsSpent()); }
function respecCost() { return E.TIERS[V.S.unlocked].min * 200; }
function learn(id) {
  var S = V.S, t = T_BY[id], l = tl(id);
  if (!t || l >= t.vals.length || pointsFree() < 1) return;
  S.talents[id] = l + 1;
  V.Snd.unlock(); V.toast(t.name + ' Stufe ' + (l + 1) + ': ' + t.txt(t.vals[l]), 'good');
  V.hud(); V.side.refresh(); V.save();
}
var confirmRespec = false;
function respec() {
  var S = V.S, c = respecCost();
  if (S.balance < c) { V.toast('Neu verteilen kostet ' + fmt(c) + ' Chips.', 'bad'); return; }
  S.balance -= c; S.talents = {}; confirmRespec = false;
  V.Snd.cash(); V.toast('Talente zurückgesetzt. Du hast ' + pointsFree() + ' Punkte zum Verteilen.', 'good');
  V.hud(); V.side.refresh(); V.save();
}

/* ================= Imperium ================= */
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
function bizOpen(b) { return !V.isCareer() || V.S.unlocked >= b.tier; }
function perHour() { var s = 0; BIZ.forEach(function (b) { s += bizIncome(b, bizLv(b.id)); }); return s * (1 + perk('empire')); }
function vaultHours() { return 8 + perk('vault'); }
function vaultCap() { return Math.floor(perHour() * vaultHours()); }
function vault() {
  var S = V.S;
  if (!S.bizAt) return 0;
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
  if (!b || lv >= MAX_BIZ || !bizOpen(b)) return;
  var c = upCost(b, lv);
  if (S.balance < c) { V.toast('Dafür fehlen dir ' + fmt(c - S.balance) + ' Chips.', 'bad'); return; }
  collect(true);
  S.balance -= c; S.biz[id] = lv + 1; S.bizSpent += c;
  if (!S.bizAt) S.bizAt = Date.now();
  V.Snd.unlock();
  if (lv === 0) V.banner(b.icon + ' ' + b.name, 'Gehört jetzt dir · +' + fmt(bizIncome(b, 1) * (1 + perk('empire'))) + ' Chips pro Stunde', { kind: 'win', ms: 2600 });
  else V.toast(b.name + ' auf Stufe ' + (lv + 1) + ' ausgebaut.', 'good');
  V.hud(); V.side.refresh(); V.save();
}
function worth() { return Math.round(V.S.balance + V.S.bizSpent); }

/* ================= Tägliche Aufträge ================= */
function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function openGames() { return ['slots', 'roulette', 'bj', 'crash'].filter(function (g) { return V.gameOpen(g); }); }
var TEMPL = [
  { id: 'rounds', make: function (r) { var gs = openGames(), g = gs[Math.floor(r() * gs.length)], n = g === 'slots' ? 25 : 12; return { text: 'Spiele ' + n + ' Runden ' + GN[g], n: n, game: g, diff: 1 }; },
    ev: function (m, e) { return e.game === m.game && e.staked > 0 ? 1 : 0; } },
  { id: 'wins', make: function () { return { text: 'Gewinne 8 Runden', n: 8, diff: 1 }; }, ev: function (m, e) { return e.net > 0 ? 1 : 0; } },
  { id: 'wager', make: function () { var n = E.TIERS[V.S.unlocked].min * 400; return { text: 'Setze insgesamt ' + fmt(n) + ' Chips', n: n, diff: 1 }; }, ev: function (m, e) { return e.staked; } },
  { id: 'big', make: function () { return { text: 'Gewinne in einer Runde das 10-Fache deines Einsatzes', n: 1, diff: 2 }; },
    ev: function (m, e) { var ref = e.staked || (e.opt && e.opt.refBet) || 0; return ref > 0 && e.ret >= ref * 10 ? 1 : 0; } },
  { id: 'streak', make: function () { return { text: 'Gewinne 3 Runden hintereinander', n: 1, diff: 1 }; }, ev: function () { return V.S.winStreak >= 3 ? 1 : 0; } },
  { id: 'crash', req: 'crash', make: function () { return { text: 'Zahle im Crash bei mindestens 3,00× aus', n: 1, diff: 1 }; }, ev: function (m, e) { return e.game === 'crash' && e.opt.mult >= 3 ? 1 : 0; } },
  { id: 'straight', req: 'roulette', make: function () { return { text: 'Triff eine Einzelzahl im Roulette', n: 1, diff: 2 }; }, ev: function (m, e) { return e.opt.straight ? 1 : 0; } },
  { id: 'natural', req: 'bj', make: function () { return { text: 'Bekomme einen Blackjack', n: 1, diff: 1 }; }, ev: function (m, e) { return e.opt.natural ? 1 : 0; } },
  { id: 'free', req: 'slots', make: function () { return { text: 'Löse Freispiele aus', n: 1, diff: 2 }; }, ev: function (m, e) { return e.opt.freeTrig ? 1 : 0; } }
];
var TP_BY = {}; TEMPL.forEach(function (t) { TP_BY[t.id] = t; });
function ensureMissions() {
  var S = V.S, d = today();
  if (S.missions && S.missions.day === d && S.missions.list && S.missions.list.length) return;
  var r = rng(hash(d + '|' + (V.slotId || '')));
  var pool = TEMPL.filter(function (t) { return !t.req || V.gameOpen(t.req); });
  var list = [];
  while (list.length < 3 && pool.length) {
    var t = pool.splice(Math.floor(r() * pool.length), 1)[0], m = t.make(r), min = E.TIERS[S.unlocked].min;
    list.push({ id: t.id, text: m.text, n: m.n, game: m.game || '', p: 0, done: false, claimed: false, chips: min * 120 * m.diff, xp: 100 * m.diff });
  }
  S.missions = { day: d, list: list, bonus: false };
}
function claim(i) {
  var S = V.S, m = S.missions.list[i];
  if (!m || !m.done || m.claimed) return;
  m.claimed = true; S.balance += m.chips;
  V.Snd.cash(); V.toast('Belohnung: +' + fmt(m.chips) + ' Chips, +' + m.xp + ' XP', 'good');
  addXp(m.xp);
  V.hud(); V.side.refresh(); V.save();
}
function allClaimed() { var l = V.S.missions.list; return l.length > 0 && l.every(function (m) { return m.claimed; }); }
function claimBonus() {
  var S = V.S;
  if (S.missions.bonus || !allClaimed()) return;
  var chips = E.TIERS[S.unlocked].min * 300;
  S.missions.bonus = true; S.bonusTp++; S.balance += chips;
  V.Snd.big(); V.burst(V.$('#drawer .drawer-panel'), 30);
  V.banner('Bonus-Truhe', '+' + fmt(chips) + ' Chips und +1 Talentpunkt', { kind: 'win', ms: 3000 });
  V.hud(); V.side.refresh(); V.save();
}

/* ================= Rundenauswertung ================= */
function onRound(e) {
  if (e.staked > 0) addXp(roundXp(e.net));
  ensureMissions();
  V.S.missions.list.forEach(function (m) {
    if (m.done) return;
    var t = TP_BY[m.id]; if (!t) return;
    m.p = Math.min(m.n, m.p + t.ev(m, e));
    if (m.p >= m.n) { m.done = true; V.toast('Auftrag erledigt: ' + m.text + '. Belohnung unter „Aufträge“.', 'good'); }
  });
}

/* Ältere Spielstände: bisherige Runden einmalig als Erfahrung anrechnen (ohne Banner) */
function migrate() {
  var S = V.S;
  if (S.metaInit) return;
  S.metaInit = 1;
  if (S.rounds > 0) {
    S.xp += Math.round(S.rounds * 12);
    while (S.xp >= xpFor(S.level)) { S.xp -= xpFor(S.level); S.level++; }
  }
  V.save();
}

/* ================= Hinweis-Punkte ================= */
function badges() {
  ensureMissions();
  var claimable = V.S.missions.list.filter(function (m) { return m.done && !m.claimed; }).length + (allClaimed() && !V.S.missions.bonus ? 1 : 0);
  var cap = vaultCap();
  return { auftraege: claimable > 0, talente: pointsFree() > 0, imperium: cap > 0 && vault() >= cap * 0.5 };
}

/* ================= Ansichten im Fenster ================= */
function bar(p) { var i = el('i'); i.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%'; return el('div', { class: 'mbar' }, i); }

function renderTalente(body) {
  var S = V.S, need = xpFor(S.level), free = pointsFree();
  body.appendChild(el('div', { class: 'lvl-head' },
    el('div', { class: 'lvl-badge', text: String(S.level) }),
    el('div', { class: 'lvl-info' },
      el('b', { text: 'Level ' + S.level }),
      bar(S.xp / need),
      el('span', { class: 'fine', text: fmt(S.xp) + ' / ' + fmt(need) + ' XP bis Level ' + (S.level + 1) + ' · XP gibt es für jede Runde und für Aufträge' })),
    el('div', { class: 'tp-box' + (free ? ' has' : '') }, el('b', { text: String(free) }), el('span', { text: free === 1 ? 'Punkt frei' : 'Punkte frei' }))));
  var grid = el('div', { class: 'branches' });
  BRANCHES.forEach(function (br) {
    var col = el('section', { class: 'branch br-' + br.id }, el('h3', {}, el('span', { text: br.icon }), ' ' + br.name), el('p', { class: 'fine', text: br.desc }));
    TALENTS.filter(function (t) { return t.br === br.id; }).forEach(function (t) {
      var l = tl(t.id), max = t.vals.length, locked = t.game && !V.gameOpen(t.game);
      var pips = el('span', { class: 'pips' });
      for (var k = 0; k < max; k++) pips.appendChild(el('i', { class: k < l ? 'on' : '' }));
      var now = l ? t.txt(t.vals[l - 1]) : 'Stufe 1: ' + t.txt(t.vals[0]);
      var nxt = l && l < max ? t.txt(t.vals[l]) : '';
      col.appendChild(el('div', { class: 'talent' + (l ? ' got' : '') + (l >= max ? ' maxed' : '') },
        el('div', { class: 'tal-h' }, el('b', { text: t.name }), pips),
        el('div', { class: 'tal-now', text: now }),
        nxt ? el('div', { class: 'tal-next', text: 'Nächste Stufe: ' + nxt }) : null,
        locked ? el('div', { class: 'tal-next', text: 'Wirkt, sobald ' + GN[t.game] + ' freigeschaltet ist.' }) : null,
        el('button', { class: 'btn ' + (free && l < max ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: !free || l >= max,
          text: l >= max ? 'Maximal' : (l ? 'Verbessern' : 'Lernen') + ' · 1 Punkt', onclick: function () { learn(t.id); } })));
    });
    grid.appendChild(col);
  });
  body.appendChild(grid);
  var c = respecCost(), row;
  if (!confirmRespec) row = el('button', { class: 'btn ghost sm', type: 'button', disabled: pointsSpent() === 0, text: 'Talente neu verteilen · ' + fmt(c) + ' Chips', onclick: function () { confirmRespec = true; V.side.refresh(); } });
  else row = el('span', { class: 'confirm' }, el('span', { text: 'Alle Talente zurücksetzen für ' + fmt(c) + ' Chips?' }),
    el('button', { class: 'btn crimson sm', type: 'button', text: 'Ja', onclick: respec }),
    el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmRespec = false; V.side.refresh(); } }));
  body.appendChild(el('div', { class: 'rrow respec' }, row, el('span', { class: 'fine', text: 'Probier verschiedene Strategien aus. Neu verteilen kostet Chips, die Punkte bekommst du alle zurück.' })));
}

function renderImperium(body) {
  var S = V.S, ph = perHour(), cap = vaultCap(), v = vault();
  body.appendChild(el('div', { class: 'emp-head' },
    el('div', { class: 'emp-kpi' }, el('span', { class: 'lbl', text: 'Einnahmen' }), el('b', { class: 'num', text: fmt(ph) + ' / Std.' })),
    el('div', { class: 'emp-kpi' }, el('span', { class: 'lbl', text: 'Imperiumswert' }), el('b', { class: 'num', text: fmt(worth()) })),
    el('div', { class: 'vault' + (cap && v >= cap ? ' full' : '') },
      el('div', { class: 'vault-h' }, el('span', { class: 'lbl', text: 'Tresor (füllt sich auch offline)' }), el('b', { id: 'vaultAmt', class: 'num', text: fmt(v) + ' / ' + fmt(cap) })),
      el('div', { id: 'vaultBar' }, bar(cap ? v / cap : 0)),
      el('button', { id: 'vaultBtn', class: 'btn gold sm', type: 'button', disabled: v <= 0, text: 'Tresor leeren', onclick: function () { collect(); V.side.refresh(); } }))));
  if (!ph) body.appendChild(el('p', { class: 'side-intro', text: 'Kauf dein erstes Geschäft. Es verdient Chips pro Stunde, auch wenn du nicht spielst. Hol sie regelmäßig aus dem Tresor, bevor er voll ist (' + vaultHours() + ' Std.).' }));
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
  body.appendChild(el('p', { class: 'fine', text: 'Gekaufte Geschäfte kann man nicht verkaufen. Der Imperiumswert zählt deine Chips plus alles, was du investiert hast.' }));
}

function renderAuftraege(body) {
  ensureMissions();
  var S = V.S, ms = S.missions;
  body.appendChild(el('p', { class: 'side-intro', text: 'Jeden Tag drei neue Aufträge. Schaffst du alle drei, öffnet sich die Bonus-Truhe mit einem extra Talentpunkt.' }));
  var list = el('div', { class: 'missions' });
  ms.list.forEach(function (m, i) {
    list.appendChild(el('article', { class: 'mission' + (m.done ? ' done' : '') + (m.claimed ? ' claimed' : '') },
      el('div', { class: 'ms-ico', text: m.claimed ? '✓' : m.done ? '★' : String(i + 1) }),
      el('div', { class: 'ms-info' },
        el('b', { text: m.text }),
        bar(m.p / m.n),
        el('span', { class: 'fine', text: (m.n > 1 ? fmt(m.p) + ' / ' + fmt(m.n) + ' · ' : '') + 'Belohnung: ' + fmt(m.chips) + ' Chips + ' + m.xp + ' XP' })),
      el('button', { class: 'btn ' + (m.done && !m.claimed ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: !m.done || m.claimed,
        text: m.claimed ? 'Abgeholt' : m.done ? 'Abholen' : 'Offen', onclick: function () { claim(i); } })));
  });
  body.appendChild(list);
  var all = allClaimed();
  body.appendChild(el('div', { class: 'chest' + (all && !ms.bonus ? ' ready' : '') + (ms.bonus ? ' opened' : '') },
    el('div', { class: 'chest-ico', text: ms.bonus ? '🎉' : '🧰' }),
    el('div', {}, el('b', { text: 'Bonus-Truhe' }), el('div', { class: 'fine', text: ms.bonus ? 'Heute schon geöffnet. Morgen gibt es neue Aufträge.' : '+' + fmt(E.TIERS[S.unlocked].min * 300) + ' Chips und +1 Talentpunkt, wenn alle drei abgeholt sind.' })),
    el('button', { class: 'btn ' + (all && !ms.bonus ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: !all || ms.bonus, text: ms.bonus ? 'Geöffnet' : 'Öffnen', onclick: claimBonus })));
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
  perk: perk, onRound: onRound, migrate: migrate, addXp: addXp, xpFor: xpFor, badges: badges, tick: tick, ensureMissions: ensureMissions,
  pointsFree: pointsFree, worth: worth, perHour: perHour,
  tabs: { talente: renderTalente, imperium: renderImperium, auftraege: renderAuftraege }
};
})();
V.meta = Meta;
