/* Chip Empire – UI-Kern: Zustand, Speichern, Ton, HUD, Hostess, Bet-Steuerung */
var V = (function () {
'use strict';
var E = Engine, A = Art;

/* ---------- Helfer ---------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function append(n, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { append(n, x); }); return; }
  n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
}
function el(tag, props) {
  var n = document.createElement(tag);
  if (props) for (var k in props) {
    var v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
  return n;
}
function fmt(n) { return Math.round(n).toLocaleString('de-DE'); }
function fmtX(m) { return m.toFixed(2).replace('.', ',') + '×'; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
/* Animationsschritt, der auch in einem Hintergrund-Tab weiterläuft (dort per Timer statt Frame) */
function frame(cb) { if (document.hidden) setTimeout(function () { cb(performance.now()); }, 50); else requestAnimationFrame(cb); }
/* Auszahlung Einsatz × Faktor, abgerundet, ohne Kommazahl-Fehler (100 × 2,3 = 230, nicht 229) */
function payout(bet, mult) { return Math.floor(bet * mult + 1e-6); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
/* Gewichtete Auswahl aus [[Wert, Gewicht], …] mit dem Spiel-Zufall */
function pickW(list) { var t = 0; list.forEach(function (x) { t += x[1]; }); var r = E.rand() * t; for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r < 0) return list[i][0]; } return list[list.length - 1][0]; }
function short(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(n % 1e12 ? 1 : 0).replace('.', ',') + ' Bio';
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 ? 1 : 0).replace('.', ',') + ' Mrd';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', ',') + ' Mio';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace('.', ',') + 'k';
  return String(n);
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function clock(ms) {
  var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s % 60);
}

/* ---------- Zustand ---------- */
/* Karriere: wenig Startgeld, kein Gratis-Nachschub, Spiele werden mit den Stufen freigeschaltet */
var CAREER = { start: 1000, bailoutCooldown: 10 * 60 * 1000, bailoutMult: 50, dailyMult: 50 };
/* Alle Spiele an einer Stelle: Reihenfolge der Navigation, Freischalt-Stufe in der Karriere,
   Hausvorteil (für Statistik) und Spielertyp (für das Zockerprofil) */
var GAME_LIST = [
  { id: 'slots', name: 'Slots', tier: 0, edge: 0.021, cat: 'dream' },
  { id: 'wheel', name: 'Glücksrad', tier: 0, edge: 0.05, cat: 'ritual' },
  { id: 'dice', name: 'Würfel', tier: 0, edge: 0.04, cat: 'ritual' },
  /* pace: Anteil einer Runde für Erfahrung und Sitzungs-Truhen (Plinko-Kugeln fallen viel schneller als andere Runden) */
  { id: 'plinko', name: 'Plinko', tier: 0, edge: 0.01, cat: 'thrill', pace: 1 / 3 },
  { id: 'roulette', name: 'Roulette', tier: 1, edge: 1 / 37, cat: 'ritual' },
  { id: 'ducks', name: 'Entenrennen', short: 'Enten', tier: 1, edge: 0.034, cat: 'ritual' },
  { id: 'tower', name: 'Dragon Tower', short: 'Tower', tier: 1, edge: 0.03, cat: 'thrill' },
  { id: 'crash', name: 'Crash', tier: 2, edge: 0.011, cat: 'thrill' },
  { id: 'hilo', name: 'Hi-Lo-Leiter', short: 'Hi-Lo', tier: 2, edge: 0.04, cat: 'thrill' },
  { id: 'bj', name: 'Blackjack', tier: 3, edge: 0.005, cat: 'strat' },
  { id: 'vault', name: 'Tresorknacker', short: 'Tresor', tier: 4, edge: 0.03, cat: 'thrill' }
];
var GAME_TIER = {}, GAME_NAME = {}, GAME_BY = {};
GAME_LIST.forEach(function (g) { GAME_TIER[g.id] = g.tier; GAME_NAME[g.id] = g.name; GAME_BY[g.id] = g; });
var RANK = ['L', 'B', 'S', 'G', 'P', '★'];
function emptyG() { return { r: 0, w: 0, ret: 0 }; }
function allGames(fn) { var o = {}; GAME_LIST.forEach(function (g) { o[g.id] = fn(g.id); }); return o; }
function fresh(mode) {
  var career = mode !== 'sandbox', start = career ? CAREER.start : 10000;
  return {
    mode: mode === 'empire' ? 'empire' : career ? 'career' : 'sandbox',
    balance: start, escrow: 0, wagered: 0, wagerBonus: 0, returned: 0, rounds: 0, reloads: 0, reloaded: 0,
    comps: 0, compsClaimed: 0, room: 0, unlocked: career ? 0 : 5, aff: [0, 0, 0, 0, 0, 0], tips: 0,
    hist: [], series: [start], gst: allGames(emptyG), sound: true, hint: true, game: 'slots', bets: allGames(function () { return 100; }), rchip: 100,
    rhist: [], chist: [], biggest: 0, bestMult: 0, free: { n: 0, bet: 0, won: 0 },
    playMs: 0, dopa: 0, winStreak: 0, lossStreak: 0, realityShown: 0, sideTab: 'quests',
    bailoutAt: 0, bailouts: 0, bailedOut: 0, dailyLast: '', dailyStreak: 0, dailyTotal: 0,
    xp: 0, level: 1, bonusTp: 0, talents: {}, biz: {}, bizAt: 0, bizSpent: 0, bizEarned: 0, emp: {},
    quests: { daily: { key: '', list: [], chest: false }, weekly: { key: '', list: [], chest: false } },
    qstats: { rounds: 0, wins: 0, naturals: 0, straights: 0, frees: 0, crash10: 0, dailies: 0, wheelHits: 0, diceHits: 0, duckWins: 0, plinkoBalls: 0, towerTops: 0, vaultBig: 0, hiloBest: 0, miles: {}, init: 0 },
    turbo: false, crashAuto: '2.00', crashAutoOn: false, metaInit: 0, metaVer: 0, plinkoRisk: 'mid', towerDiff: 'mid', vaultMines: 3, towerFloors: 9, vaultSize: 5,
    fxLow: false, hostTalk: true, tipsOn: true, onb: 0, feats: {}, devAll: true,
    stars: 0, season: { key: '', net: 0, best: 0, rounds: 0 }, seasonPrev: { key: '', net: 0, best: 0, rounds: 0 }, seasonClaimed: '', trophies: 0
  };
}
var S = fresh('career');
var slotId = null, slotName = '', slotRev = 0, saveBlocked = false;
function isNum(x) { return typeof x === 'number' && isFinite(x); }
function load(id) {
  var slot = Store.get(id);
  if (!slot) return false;
  slotId = id; slotName = slot.name; slotRev = slot.rev;
  var f = fresh(slot.mode), d = slot.state;
  if (d && typeof d === 'object') {
    Object.keys(f).forEach(function (k) {
      if (!(k in d)) return;
      var a = f[k], b = d[k];
      if (isNum(a)) { if (isNum(b)) f[k] = b; }
      else if (typeof a === 'boolean' || typeof a === 'string') { if (typeof b === typeof a) f[k] = b; }
      else if (Array.isArray(a)) { if (Array.isArray(b)) f[k] = b; }
      else if (a && typeof a === 'object') { if (b && typeof b === 'object') f[k] = Object.assign({}, a, b); }
    });
  }
  f.mode = slot.mode === 'sandbox' || slot.mode === 'empire' ? slot.mode : 'career';
  f.escrow = 0;
  if (f.aff.length !== 6) f.aff = [0, 0, 0, 0, 0, 0];
  f.aff = f.aff.map(function (x) { return isNum(x) ? clamp(x, 0, 100) : 0; });
  f.hist = f.hist.filter(function (h) { return h && isNum(h.bet) && isNum(h.bal) && f.gst[h.g]; }).slice(-80);
  f.series = f.series.filter(isNum).slice(-400); if (!f.series.length) f.series = [f.balance];
  f.rhist = f.rhist.filter(function (n) { return isNum(n) && n >= 0 && n <= 36; }).slice(-120);
  f.chist = f.chist.filter(isNum).slice(-30);
  f.unlocked = f.mode === 'sandbox' ? 5 : clamp(Math.max(f.unlocked, E.tierFor(f.wagered + f.wagerBonus)), 0, 5);
  f.room = clamp(f.room, 0, f.unlocked);
  if (!f.free || !isNum(f.free.n) || f.free.n < 0) f.free = { n: 0, bet: 0, won: 0 };
  if (!GAME_TIER.hasOwnProperty(f.game)) f.game = 'slots';
  if (['imperium', 'talente', 'quests', 'arena', 'stufen', 'meister', 'profil', 'stats', 'haus', 'hilfe', 'dev'].indexOf(f.sideTab) < 0 || (f.sideTab === 'imperium' && f.mode !== 'empire')) f.sideTab = 'quests';
  /* Ganz neue Karriere oder Imperium: Funktionen kommen nach und nach dazu (siehe guide.js).
     Ältere Spielstände haben onb = 0 und sehen alles wie bisher. */
  if (!d && f.mode !== 'sandbox') { f.onb = 1; f.feats = {}; }
  S = f;
  if (!d) save();
  return true;
}
/* Spielstand umbenennen (auch mit Konto: der Name geht beim nächsten Hochladen mit) */
function renameSlot(name) {
  var n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (!n || !slotId) return false;
  if (Store.badName(n)) { toast('Dieser Name ist nicht erlaubt.', 'bad'); return false; }
  Store.patch(slotId, { name: n });
  slotName = n;
  save();
  return true;
}
/* Einsätze laufender Runden sind gebunden: Wer mitten in der Runde neu lädt, bekommt sie nicht zurück.
   Nur Chips, die noch ungespielt auf dem Tisch liegen (Roulette vor dem Drehen), fließen beim Speichern zurück. */
var locked = 0;
function save() {
  if (!slotId || saveBlocked) return;
  var d = Object.assign({}, S);
  d.balance = S.balance + S.escrow - Math.min(locked, S.escrow); d.escrow = 0;
  var rev = Store.put(slotId, d);
  if (rev) slotRev = rev;
}
/* Läuft derselbe Spielstand in einem zweiten Tab oder auf einem anderen Gerät weiter,
   darf dieser Tab ihn nicht mehr überschreiben */
function blockSaving(msg) {
  if (saveBlocked) return;
  saveBlocked = true;
  banner('Spielstand woanders geändert', msg, {
    kind: 'level', ms: 86400000, actions: [{ label: 'Neu laden', gold: true, fn: function () { location.reload(); } }]
  });
}
window.addEventListener('storage', function (e) {
  if (!slotId || saveBlocked || e.key !== Store.key()) return;
  var slot = Store.get(slotId);
  if (slot && slot.rev === slotRev) return;
  blockSaving(slot ? 'Dieser Spielstand wurde in einem anderen Tab weitergespielt. Lade neu, um nichts zu überschreiben.' : 'Dieser Spielstand wurde gelöscht.');
});
Cloud.onConflict(function () {
  blockSaving('Dieser Spielstand wurde auf einem anderen Gerät weitergespielt. Lade neu, um den aktuellen Stand zu holen.');
});
function room() { return E.TIERS[S.room]; }
/* Umsatz für den Aufstieg: echter Umsatz plus Bonus aus Talenten */
function climbed() { return S.wagered + (S.wagerBonus || 0); }
function debit(n, commit) { S.balance -= n; S.escrow += n; if (commit) lock(n); allinCheck(n); }
function lock(n) { locked += n; save(); }
function refund(n) { S.balance += n; S.escrow -= n; if (S.balance >= room().min) allinRound = false; }

/* ---------- Karriere: Freischaltungen, Notgroschen, Tagesbonus ---------- */
/* Karriere-Regeln gelten auch im Imperium-Modus */
function isCareer() { return S.mode !== 'sandbox'; }
/* Dev-Konten (siehe dev.js) haben alle Spiele offen */
function gameOpen(id) { return GAME_TIER.hasOwnProperty(id) && (!isCareer() || S.unlocked >= GAME_TIER[id] || !!(V.devTools && V.devTools.all())); }
function gamesAt(t) { return Object.keys(GAME_TIER).filter(function (g) { return GAME_TIER[g] === t; }); }
function isBroke() { return S.balance + S.escrow < E.TIERS[0].min; }
function bailoutAmt() { return E.TIERS[S.unlocked].min * CAREER.bailoutMult * (1 + perk('legBail')); }
function perk(id) { return V.meta ? V.meta.perk(id) : 0; }
function cooldown() { return CAREER.bailoutCooldown - perk('rescue'); }
function bailoutWait() { return Math.max(0, S.bailoutAt + cooldown() - Date.now()); }
function bailout() {
  if (!isCareer() || !isBroke() || bailoutWait() > 0) return;
  var amt = bailoutAmt();
  S.balance += amt; S.bailouts++; S.bailedOut += amt; S.bailoutAt = Date.now();
  Snd.cash(); toast('Notgroschen: +' + fmt(amt) + ' Chips. Der nächste erst in ' + Math.round(cooldown() / 60000) + ' Minuten.', 'good');
  hud(); if (V.side) V.side.refresh(); save();
}
function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dailyAvailable() { return isCareer() && S.dailyLast !== dayKey(Date.now()); }
function dailyStreakNext() { return S.dailyLast === dayKey(Date.now() - 864e5) ? S.dailyStreak + 1 : 1; }
function dailyAmt(streak) { return Math.round(E.TIERS[S.unlocked].min * CAREER.dailyMult * (1 + 0.25 * (Math.min(streak, 7) - 1)) * (1 + perk('daily') + perk('legDaily') + perk('bCap') + (V.legend ? V.legend.rankPerk('daily') : 0))); }
function claimDaily() {
  if (!dailyAvailable()) return;
  var streak = dailyStreakNext(), amt = dailyAmt(streak);
  S.dailyStreak = streak; S.dailyLast = dayKey(Date.now()); S.dailyTotal += amt; S.balance += amt;
  Snd.unlock();
  banner('Tagesbonus +' + fmt(amt), 'Tag ' + streak + ' in Folge' + (streak < 7 ? ' · morgen gibt es mehr' : ' · maximale Serie'), { kind: 'win', ms: 3000 });
  hud(); if (V.side) V.side.refresh(); save();
}
/* Der goldene Knopf oben: Sandbox = Nachschub, Karriere = Tagesbonus oder Notgroschen */
function renderWalletBtn() {
  var b = $('#reload'); if (!b) return;
  var pulse = false;
  b.disabled = false;
  if (!isCareer()) {
    b.innerHTML = '+ <span class="hide-sm">Nachschub </span>' + short(E.TIERS[S.unlocked].reload);
    b.title = 'Gratis-Chips nachholen';
    pulse = S.balance < room().min;
  } else if (dailyAvailable()) {
    b.innerHTML = '🎁 <span class="hide-sm">Tagesbonus </span>' + short(dailyAmt(dailyStreakNext()));
    b.title = 'Einmal pro Tag abholen';
    pulse = true;
  } else {
    var w = bailoutWait();
    b.title = 'Notgroschen: nur wenn du pleite bist, höchstens alle ' + Math.round(cooldown() / 60000) + ' Minuten';
    if (!isBroke()) { b.innerHTML = '🛟 <span class="hide-sm">Notgroschen </span>' + short(bailoutAmt()); b.disabled = true; }
    else if (w > 0) { b.textContent = '⏳ ' + clock(w); b.disabled = true; }
    else { b.innerHTML = '🛟 <span class="hide-sm">Notgroschen </span>+' + short(bailoutAmt()); pulse = true; }
  }
  b.classList.toggle('pulse', pulse);
}
function walletAction() {
  if (!isCareer()) reload();
  else if (dailyAvailable()) claimDaily();
  else bailout();
}

/* ---------- Ton ---------- */
var Snd = (function () {
  var ctx = null;
  function ensure() {
    if (!ctx) { try { var AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume().catch(function () {}); } catch (e) { /* */ } }
    return ctx;
  }
  function tone(f, d, type, vol, delay) {
    if (!S.sound) return;
    var c = ensure(); if (!c) return;
    try {
      var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.03);
    } catch (e) { /* */ }
  }
  return {
    chip: function () { tone(1500, 0.05, 'square', 0.025); tone(1100, 0.06, 'square', 0.02, 0.03); },
    tick: function () { tone(820, 0.03, 'sine', 0.02); },
    card: function () { tone(260, 0.06, 'triangle', 0.05); },
    click: function () { tone(640, 0.04, 'sine', 0.03); },
    win: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.05, i * 0.08); }); },
    big: function () { [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.06, i * 0.07); }); },
    lose: function () { tone(196, 0.22, 'sawtooth', 0.03); tone(147, 0.3, 'sawtooth', 0.03, 0.12); },
    crash: function () { tone(150, 0.4, 'sawtooth', 0.07); tone(90, 0.5, 'square', 0.05, 0.05); },
    cash: function () { tone(880, 0.12, 'triangle', 0.06); tone(1175, 0.2, 'triangle', 0.06, 0.09); },
    /* Jede weitere Stufe einen Halbton höher: die Spannung steigt hörbar */
    step: function (k) { var f = 392 * Math.pow(2, Math.min(k, 30) / 12); tone(f, 0.14, 'triangle', 0.05); tone(f * 1.5, 0.12, 'sine', 0.025, 0.05); },
    unlock: function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.06, i * 0.1); }); },
    /* All-in: tiefer Herzschlag und ein Anschwellen */
    /* Blitz: knisterndes Aufsteigen */
    zap: function () { [880, 1320, 1760, 2640].forEach(function (f, i) { tone(f, 0.08, 'sawtooth', 0.025, i * 0.04); }); tone(110, 0.35, 'square', 0.04, 0.16); },
    heart: function () { tone(70, 0.18, 'sine', 0.12); tone(62, 0.22, 'sine', 0.1, 0.22); tone(220, 0.6, 'sawtooth', 0.02, 0.1); },
    allin: function () { [196, 247, 294, 392].forEach(function (f, i) { tone(f, 0.12, 'square', 0.03, i * 0.05); }); },
    ensure: ensure
  };
})();

/* ---------- Toast, Banner, Konfetti ---------- */
function toast(msg, kind) {
  var host = $('#toasts'); if (!host) return;
  var t = el('div', { class: 'toast ' + (kind || ''), role: 'status', text: msg });
  host.appendChild(t);
  while (host.children.length > 3) host.removeChild(host.firstChild);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
}
var bannerTimer = null;
function banner(title, sub, opts) {
  opts = opts || {};
  var b = $('#banner'); if (!b) return;
  b.className = 'banner ' + (opts.kind || '');
  b.innerHTML = '';
  b.appendChild(el('div', { class: 'bn-title', text: title }));
  if (sub) b.appendChild(el('div', { class: 'bn-sub', text: sub }));
  if (opts.actions) {
    var row = el('div', { class: 'bn-actions' });
    opts.actions.forEach(function (a) {
      row.appendChild(el('button', { class: 'btn ' + (a.gold ? 'gold' : 'ghost'), type: 'button', text: a.label, onclick: function () { hideBanner(); a.fn(); } }));
    });
    b.appendChild(row);
  }
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(hideBanner, opts.ms || 2600);
}
function hideBanner() { var b = $('#banner'); if (b) b.hidden = true; }
function burst(host, n, colors) {
  if (!host || S.fxLow) return;
  colors = colors || ['#F2D68E', '#D4AB52', '#C4203F', '#F4EBDB'];
  for (var i = 0; i < n; i++) {
    var s = el('span', { class: 'conf' });
    var ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 220;
    s.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
    s.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - 60) + 'px');
    s.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
    host.appendChild(s);
    (function (n2) { setTimeout(function () { if (n2.parentNode) n2.parentNode.removeChild(n2); }, 1600); })(s);
  }
}

/* ---------- Gastgeberin ---------- */
var LINES = {
  greet: [
    'Willkommen im Chip Empire! Ich bin Mira. Such dir einen Tisch aus. Ich bringe dir Glück, oder zumindest gute Laune.',
    'Na, wer wagt sich denn in die Bronze Lounge? Ich bin Sofia. Dein Drink geht aufs Haus, dein Einsatz nicht.',
    'Silver Salon. Hier wird nicht gekleckert, sondern geklotzt. Ich bin Lena und behalte den Überblick.',
    'Gold Suite, Darling. Ich bin Isabella. Hier setzen nur Leute, die wissen, was sie wollen.',
    'Penthouse. Die Aussicht ist atemberaubend, die Einsätze auch. Anastasia, freut mich.',
    'Willkommen im Black Room. Keine Fenster, keine Uhren. Ich bin Celeste. Bleib, so lange du magst.'
  ],
  smallwin: ['Netter Treffer!', 'Das läuft doch.', 'Ein kleiner Gewinn, aber ein Gewinn.', 'Das Glück flirtet mit dir.', 'Gut gemacht, weiter so.'],
  win: ['Sauber gespielt!', 'Du hast heute einen Lauf.', 'Das gefällt mir. Mehr davon!', 'Na, wer sagt’s denn.', 'Der Tisch liebt dich gerade.'],
  bigwin: ['Wow! Das war richtig groß!', 'Alle schauen zu dir rüber.', 'Champagner! … Okay, ich hole erstmal Luft.', 'Das war kein Zufall, das war Schicksal.', 'Mir fehlen die Worte. Na gut, nicht ganz.'],
  jackpot: ['Das erzählt man sich noch in zehn Jahren!', 'Mir zittern die Knie. Das war gigantisch!', 'Jackpot-Stimmung im ganzen Haus!'],
  loss: ['Nicht dein Spiel. Aber die nächste Runde gehört dir.', 'So knapp. Nochmal?', 'Das Glück braucht manchmal einen zweiten Anlauf.', 'Kopf hoch, der Tisch dreht sich weiter.', 'Das war nicht fair von der Kugel.'],
  lossStreak: ['Zäh heute. Aber das Blatt wendet sich bestimmt bald.', 'Noch eine Runde? Ich glaube an dich.', 'Pechsträhnen enden. Irgendwann. Ich bleibe hier.', 'Ich habe dir ein paar Comps gutgeschrieben. Nur zur Aufmunterung.'],
  near: ['Sooo knapp! Fast wäre es passiert.', 'Zwei Scatter! Beim nächsten Mal klappt’s.', 'Ach, das tut weh. Aber so nah dran!'],
  bust: ['Bust. Passiert den Besten.', 'Zu gierig, Liebling.', 'Eine Karte zu viel. Das kennt jeder.'],
  tip: ['Danke, das ist lieb von dir.', 'Du weißt, wie man eine Dame behandelt.', 'Charmant und großzügig. Gefährliche Mischung.'],
  reload: ['Nachschub kommt sofort.', 'Neue Chips, frisches Glück.', 'Die Bank hat immer Nachschub für gute Gäste.'],
  levelup: ['Neue Stufe, neue Regeln. Ich zeige dir das Haus.', 'Du bist aufgestiegen. Die Limits steigen mit.'],
  chat: [
    'Weißt du, warum es hier keine Uhren gibt? Damit du die Zeit vergisst. Ich habe nichts gesagt.',
    'Roulette hat 2,7 % Hausvorteil. Klingt wenig. Aber das Haus muss nur oft genug zusehen.',
    'Blackjack ist am fairsten, wenn du die Basisstrategie kennst. Ich habe einen Spickzettel für dich.',
    'Die Lichter und Töne bei einem Gewinn gibt es auch, wenn du weniger zurückbekommst als eingesetzt.',
    'Beim Crash-Spiel ist der Hausvorteil nur 1 %. Aber du spielst eben viel schneller.',
    'Mein Lieblingsgetränk? Mineralwasser mit Zitrone. Ich muss hier ja den klaren Kopf behalten.',
    'Zahlen haben kein Gedächtnis. Die Kugel weiß nicht, was sie zuletzt gemacht hat.',
    'Comps sind keine Geschenke. Das Casino rechnet sie dir aus deinem erwarteten Verlust zurück.'
  ]
};
var affTitles = [[0, 'Fremde'], [20, 'Bekannte'], [40, 'Stammgast'], [65, 'Favorit'], [90, 'Vertraute']];
function affTitle(v) { var t = affTitles[0][1]; affTitles.forEach(function (a) { if (v >= a[0]) t = a[1]; }); return t; }
function compMult() { return 1 + 0.25 * (S.aff[S.room] / 100); }
function tipCost() { return Math.round(room().min * 10 * (1 - perk('tipCharm'))); }
var lastSay = 0;
function say(kind, force) {
  var now = Date.now();
  /* Einstellung „Gastgeberin redet“ aus: nur noch Begrüßung und Plaudern auf Knopfdruck */
  if (!S.hostTalk && kind !== 'greet' && !(kind === 'chat' && force)) return;
  if (!force && now - lastSay < 2200) return;
  lastSay = now;
  var txt;
  if (kind === 'greet') txt = LINES.greet[S.room];
  else txt = pick(LINES[kind] || LINES.chat);
  var b = $('#hostSay'); if (!b) return;
  clearTimeout(sayTimer);
  b.classList.remove('pop'); b.classList.add('typing'); b.textContent = '';
  sayTimer = setTimeout(function () {
    b.classList.remove('typing'); b.textContent = txt;
    void b.offsetWidth; b.classList.add('pop');
  }, kind === 'greet' ? 250 : 550);
}
var sayTimer = 0;
function renderHost() {
  var h = A.HOSTESSES[S.room];
  $('#hostPortrait').innerHTML = A.portrait(S.room);
  $('#hostName').textContent = h.name;
  $('#hostRole').textContent = h.role + ' · ' + h.trait;
  renderAff();
  $('#tipCost').textContent = fmt(tipCost()) + ' Chips · sie mag dich mehr';
}
/* Beziehung: vier Herzen nach „Fremde“, Balken bis zur nächsten Stufe */
function renderAff() {
  var v = S.aff[S.room], lvl = 0;
  affTitles.forEach(function (a, i) { if (v >= a[0]) lvl = i; });
  var cur = affTitles[lvl][0], nxt = affTitles[lvl + 1];
  var p = nxt ? (v - cur) / (nxt[0] - cur) : 1;
  $('#affTitle').textContent = affTitles[lvl][1];
  $('#affBar').style.width = (clamp(p, 0, 1) * 100).toFixed(1) + '%';
  $('#affHearts').innerHTML = [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= lvl ? 'on' : '') + '">♥</i>'; }).join('');
  $('#affPerk').textContent = '+' + Math.round(25 * v / 100) + ' % Comps';
  $('#affNext').textContent = nxt ? 'Noch ' + Math.max(1, Math.ceil((1 - p) * 100)) + ' % bis „' + nxt[1] + '“. Steigt mit jedem Einsatz und mit Trinkgeld.' : 'Höchste Stufe erreicht. Mehr Comps gibt es nicht.';
}
function addAff(v) { S.aff[S.room] = clamp(S.aff[S.room] + v * (1 - S.aff[S.room] / 140), 0, 100); }
function tip() {
  var c = tipCost();
  if (S.balance < c) { toast('Zu wenig Chips für Trinkgeld.', 'bad'); return; }
  S.balance -= c; S.tips++; addAff(7 * (1 + perk('tipCharm')));
  Snd.chip(); say('tip', true); renderAff(); hud();
  if (V.meta) { V.meta.event({ tip: true }); if (V.side) V.side.refresh(); }
  save();
}

/* ---------- Dopamin-Pegel ---------- */
var dopaStages = [[0, 'Ruhig'], [15, 'Kribbeln'], [35, 'Flow'], [60, 'Rausch'], [85, 'Tunnelblick']];
function dopaLabel(v) { var t = dopaStages[0][1]; dopaStages.forEach(function (a) { if (v >= a[0]) t = a[1]; }); return t; }
function renderDopa() {
  $('#dopaBar').style.width = S.dopa.toFixed(1) + '%';
  $('#dopaLbl').textContent = dopaLabel(S.dopa);
}

/* ---------- Abrechnung ---------- */
var busyFns = [];
function isBusy() { return busyFns.some(function (f) { return f(); }); }
function settle(game, staked, ret, opt) {
  opt = opt || {};
  var net = ret - staked, before = Math.max(1, S.balance + S.escrow - net), prevLoss = S.lossStreak;
  S.balance += ret; S.escrow -= staked;
  if (S.escrow < 0) S.escrow = 0;
  locked = Math.max(0, Math.min(locked - staked, S.escrow));
  S.returned += ret;
  if (staked > 0) {
    S.wagered += staked; S.rounds++;
    /* Talente und Legenden-Rang: Umsatz zählt für den Aufstieg mehr (als Bonus, die echte Bilanz bleibt) */
    if (V.meta) S.wagerBonus += staked * (V.meta.wagerMult() - 1);
    var g = S.gst[game]; g.r++; g.w += staked; g.ret += ret;
    if (V.mastery) V.mastery.check(game, g.r);
    /* Jeder Legenden-Stern: +5 % Comps (bis 5 Sterne) */
    S.comps += staked * GAME_BY[game].edge * room().comp * compMult() * (1 + perk('comps') + perk('tCap') + 0.05 * Math.min(5, S.stars));
    S.hist.push({ g: game, bet: staked, ret: ret, bal: before }); if (S.hist.length > 80) S.hist.shift();
    S.series.push(Math.round(S.balance + S.escrow)); if (S.series.length > 400) S.series.shift();
    addAff(0.2);
  } else if (ret > 0) {
    S.gst[game].ret += ret;
  }
  if (net > 0) { S.winStreak++; S.lossStreak = 0; } else if (net < 0) { S.lossStreak++; S.winStreak = 0; }
  S.biggest = Math.max(S.biggest, net);
  var d;
  if (net > 0) { var x = ret / Math.max(1, staked || (opt.refBet || 1)); d = x >= 10 ? 32 : x >= 5 ? 24 : x >= 2 ? 13 : 6; }
  else d = -2;
  if (opt.near) d += 9;
  S.dopa = clamp(S.dopa * 0.94 + d, 0, 100);
  var t = E.tierFor(climbed());
  if (t > S.unlocked) levelUp(t);
  else {
    var ratio = ret / Math.max(1, staked || (opt.refBet || 1));
    if (opt.near && net <= 0) say('near');
    else if (net > 0 && ratio >= 15) say('jackpot', true);
    else if (net > 0 && ratio >= 5) say('bigwin', true);
    else if (net > 0 && ratio >= 2) say('win');
    else if (net > 0) say('smallwin');
    else if (S.lossStreak >= 5 && Math.random() < 0.6) say('lossStreak');
    else if (net < 0 && Math.random() < 0.5) say('loss');
  }
  if (V.meta) V.meta.onRound({ game: game, staked: staked, ret: ret, net: net, opt: opt, prevLoss: prevLoss, atMax: staked > 0 && staked >= room().max });
  if (V.track) V.track.round(game, staked, ret);
  if (V.legend) V.legend.round(staked, ret);
  if (staked > 0) allinResult(net);
  if (V.session) V.session.round(staked, GAME_BY[game].pace || 1);
  if (V.guide) V.guide.check();
  hud(); renderAff(); renderDopa(); if (V.side) V.side.refresh(); save();
  maybeReality();
}
function levelUp(t) {
  S.unlocked = t;
  var T = E.TIERS[t];
  /* Talent Ehrgeiz: höherer Aufstiegsbonus */
  var bonus = Math.round(T.bonus * (1 + perk('climb')));
  S.balance += bonus;
  Snd.unlock();
  var hn = A.HOSTESSES[t].name;
  var newGames = isCareer() ? gamesAt(t).map(function (g) { return GAME_NAME[g]; }) : [];
  banner('Neue Stufe: ' + T.name, 'Bonus +' + fmt(bonus) + ' Chips · ' + (newGames.length ? 'Neu freigeschaltet: ' + newGames.join(', ') + ' · ' : '') + 'Gastgeberin ' + hn + ' erwartet dich', {
    kind: 'level', ms: 9000, actions: [{ label: 'Raum betreten', gold: true, fn: function () { enterRoom(t, true); } }, { label: 'Später', fn: function () {} }]
  });
  burst($('#app'), 40);
  hud(); renderTier(); if (V.renderNav) V.renderNav(); if (V.side) V.side.refresh(); save();
}
var realityT = 0;
function maybeReality() {
  var mins = S.playMs / 60000;
  var due = Math.floor(mins / 30);
  if (due > S.realityShown) {
    S.realityShown = due;
    var net = Math.round(S.returned - S.wagered);
    toast('Realitätscheck: ' + Math.round(mins) + ' Minuten gespielt, Bilanz ' + (net >= 0 ? '+' : '') + fmt(net) + ' Chips. Zeit für eine Pause?', 'warn');
  }
}

/* ---------- HUD ---------- */
var shownBal = null, balAnim = 0;
function hud() {
  var total = S.balance;
  var b = $('#bal'); if (!b) return;
  if (shownBal === null) { shownBal = total; b.textContent = fmt(total); }
  else {
    var from = shownBal, to = total, t0 = performance.now();
    if (to > from) { var bx = b.closest('.bal-box'); bx.classList.remove('bump'); void bx.offsetWidth; bx.classList.add('bump'); }
    cancelAnimationFrame(balAnim);
    var step = function (t) {
      var k = clamp((t - t0) / 450, 0, 1), e = 1 - Math.pow(1 - k, 3);
      shownBal = from + (to - from) * e;
      b.textContent = fmt(shownBal);
      if (k < 1) balAnim = requestAnimationFrame(step); else { shownBal = to; b.textContent = fmt(to); }
    };
    if (from !== to) balAnim = requestAnimationFrame(step);
  }
  $('#comp').textContent = fmt(Math.floor(S.comps));
  $('#claimComp').disabled = S.comps < 1;
  renderWalletBtn();
  renderTier();
  var lv = $('#lvl');
  if (lv && V.meta) { lv.textContent = 'Lv ' + S.level; lv.title = S.xp + ' / ' + V.meta.xpFor(S.level) + ' XP bis Level ' + (S.level + 1); }
  if (V.renderBadges) V.renderBadges();
}
function renderTier() {
  var T = room(), U = E.TIERS[S.unlocked];
  $('#app').setAttribute('data-tier', String(S.room));
  $('#tierName').textContent = T.name;
  $('#tierLimits').textContent = 'Einsatz ' + fmt(T.min) + ' bis ' + fmt(T.max) + ' · Comps ' + Math.round(T.comp * 100) + ' % des Hausvorteils';
  var badge = $('#tierBadge');
  if (badge) { badge.setAttribute('data-tier', String(S.unlocked)); badge.textContent = RANK[S.unlocked]; badge.title = 'Deine Stufe: ' + U.name; }
  if ($('#roomName')) $('#roomName').textContent = T.name;
  var sel = $('#roomSel');
  if (sel && sel.options.length === 0) {
    E.TIERS.forEach(function (t) { sel.appendChild(el('option', { value: t.id, text: t.name })); });
  }
  if (sel) {
    $$('option', sel).forEach(function (o) {
      var id = Number(o.value), t = E.TIERS[id];
      o.disabled = id > S.unlocked;
      o.textContent = id > S.unlocked ? t.name + ' (ab ' + short(t.wager) + ' Umsatz)' : t.name;
    });
    sel.value = String(S.room);
  }
  var nxt = E.TIERS[S.unlocked + 1];
  if (nxt) {
    var base = U.wager, p = clamp((climbed() - base) / (nxt.wager - base), 0, 1);
    $('#progBar').style.width = (p * 100).toFixed(1) + '%';
    $('#progTxt').textContent = short(Math.floor(climbed())) + ' / ' + short(nxt.wager) + ' Umsatz → ' + nxt.name;
  } else {
    $('#progBar').style.width = '100%';
    $('#progTxt').textContent = isCareer() ? 'Höchste Stufe erreicht' : 'Sandbox · alle Räume offen';
  }
}
function enterRoom(id, force) {
  if (id > S.unlocked) { toast('Dieser Raum ist noch gesperrt.', 'bad'); return false; }
  if (id === S.room) return true;
  if (!force && isBusy()) { toast('Beende erst die laufende Runde.', 'bad'); renderTier(); return false; }
  if (force && isBusy()) { toast('Beende erst die laufende Runde, dann kannst du den Raum wechseln.', 'warn'); return false; }
  S.room = id;
  clampBets();
  renderHost(); say('greet', true); hud();
  V.games.forEach(function (g) { if (g.onRoom) g.onRoom(); });
  if (V.side) V.side.refresh();
  save();
  return true;
}
function reload() {
  if (isCareer()) return;
  var amt = E.TIERS[S.unlocked].reload;
  S.balance += amt; S.reloads++; S.reloaded += amt;
  Snd.cash(); say('reload', true); toast('+' + fmt(amt) + ' Chips Nachschub', 'good');
  hud(); if (V.side) V.side.refresh(); save();
}
function claimComps() {
  var c = Math.floor(S.comps);
  if (c < 1) return;
  S.comps -= c; S.compsClaimed += c; S.balance += c;
  if (V.meta) V.meta.event({ comps: true });
  Snd.cash(); toast('Comps eingelöst: +' + fmt(c) + ' Chips', 'good');
  hud(); if (V.side) V.side.refresh(); save();
}
function needChips() {
  toast(isCareer() ? 'Zu wenig Chips. Senk den Einsatz oder wechsle in einen kleineren Raum.' : 'Zu wenig Chips. Hol dir Nachschub oder senke den Einsatz.', 'bad');
  var r = $('#reload'); if (r) { r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); }
}

/* ---------- Einsatz-Steuerung ---------- */
function ladder() {
  var r = room();
  return E.BET_LADDER.filter(function (v) { return v >= r.min && v <= r.max; });
}
/* Einsätze sind frei wählbar, aber immer ein Vielfaches des Mindesteinsatzes und innerhalb der Raumlimits */
function snapBet(v) { var r = room(); return clamp(Math.round(v / r.min) * r.min, r.min, r.max); }
function clampBets() {
  Object.keys(S.bets).forEach(function (k) { S.bets[k] = snapBet(isNum(S.bets[k]) ? S.bets[k] : room().min); });
  var chips = chipList();
  if (chips.indexOf(S.rchip) < 0) S.rchip = chips[0];
}
function chipList() {
  var r = room();
  var c = E.CHIP_VALUES.filter(function (v) { return v >= r.min && v <= r.max; });
  return c.length ? c : [r.min];
}
/* Eingetippte Beträge verstehen: 2500, 2.500, 10k, 1,5 Mio, 2m */
function parseAmount(txt) {
  var t = String(txt || '').toLowerCase().replace(/\s+/g, '').replace(/chips?/g, '');
  var m = /^([0-9.,]+)(k|tsd|mio|m)?$/.exec(t);
  if (!m) return NaN;
  var num = m[1];
  /* Punkt als Tausendertrenner, Komma als Dezimalzeichen */
  if (/^\d{1,3}(\.\d{3})+$/.test(num)) num = num.replace(/\./g, '');
  num = parseFloat(num.replace(',', '.'));
  var f = m[2] === 'k' || m[2] === 'tsd' ? 1e3 : m[2] === 'mio' || m[2] === 'm' ? 1e6 : 1;
  return num * f;
}
function betControl(key, onChange) {
  var out = el('button', { class: 'betval', type: 'button', title: 'Antippen und eigenen Betrag eingeben', 'aria-label': 'Einsatz eingeben' });
  var minus = el('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Einsatz senken', text: '−' });
  var plus = el('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Einsatz erhöhen', text: '+' });
  var presets = [
    ['Min', function () { return room().min; }],
    ['½', function (v) { return v / 2; }],
    ['2×', function (v) { return v * 2; }],
    ['Max', function () { return room().max; }]
  ];
  var wrap = el('div', { class: 'betctl' }, el('span', { class: 'lbl', text: 'Einsatz' }), el('div', { class: 'betrow' }, minus, out, plus));
  var pr = el('div', { class: 'presets' });
  var pbtns = presets.map(function (p) {
    var b = el('button', { class: 'chipbtn', type: 'button', text: p[0], onclick: function () { set(p[1](S.bets[key])); } });
    pr.appendChild(b); return b;
  });
  /* All-in: alles, was du hast (höchstens das Tischlimit) */
  var allin = el('button', { class: 'chipbtn allin', type: 'button', text: 'All-in', title: 'Setzt deine ganzen Chips (höchstens das Tischlimit)',
    onclick: function () { if (S.balance < room().min) { needChips(); return; } set(Math.min(S.balance, room().max), true); Snd.allin(); } });
  pr.appendChild(allin); pbtns.push(allin);
  wrap.appendChild(pr);
  function set(v, exact) {
    var r = room();
    S.bets[key] = exact ? clamp(Math.floor(v), r.min, r.max) : snapBet(v);
    Snd.click(); render(); if (onChange) onChange(S.bets[key]); save();
  }
  /* Plus und Minus springen auf der gewohnten Leiter, auch von einem eigenen Betrag aus */
  function step(dir) {
    var l = ladder(), v = S.bets[key], next = v;
    if (dir > 0) { for (var i = 0; i < l.length; i++) if (l[i] > v) { next = l[i]; break; } }
    else { for (var j = l.length - 1; j >= 0; j--) if (l[j] < v) { next = l[j]; break; } }
    set(next);
  }
  minus.addEventListener('click', function () { step(-1); });
  plus.addEventListener('click', function () { step(1); });
  /* Betrag antippen: wird zum Eingabefeld */
  out.addEventListener('click', function () {
    if (wrap.dataset.off === '1') return;
    var inp = el('input', { class: 'betval betin', type: 'text', inputmode: 'decimal', value: String(S.bets[key]), 'aria-label': 'Einsatz in Chips' });
    var done = false;
    function finish(ok) {
      if (done) return; done = true;
      if (ok) { var v = parseAmount(inp.value); if (isFinite(v) && v > 0) set(v); else toast('Das ist kein gültiger Betrag.', 'bad'); }
      if (inp.parentNode) inp.parentNode.replaceChild(out, inp);
      render();
    }
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function () { finish(true); });
    out.parentNode.replaceChild(inp, out);
    inp.focus(); inp.select();
  });
  function render() {
    var v = S.bets[key], r = room(), off = wrap.dataset.off === '1';
    out.textContent = fmt(v);
    out.disabled = off;
    minus.disabled = off || v <= r.min;
    plus.disabled = off || v >= r.max;
    pbtns.forEach(function (b) { b.disabled = off; });
    /* leuchtet, solange der Einsatz wirklich alles ist, was du hast */
    allin.classList.toggle('on', !off && v >= S.balance && S.balance >= r.min);
  }
  render();
  return {
    el: wrap, render: render, step: step,
    isOff: function () { return wrap.dataset.off === '1'; },
    disable: function (off) { wrap.dataset.off = off ? '1' : '0'; render(); }
  };
}

/* ---------- All-in ---------- */
/* Erkannt beim Abbuchen: Bleibt danach weniger als ein Mindesteinsatz übrig, ist es ein echtes All-in */
var allinRound = false, allinTimer = 0;
function allinFx(cls, title, sub, ms) { fx(cls, title, sub, ms); }
/* Vollbild-Schriftzug (All-in, ON FIRE, Blitz) */
function fx(cls, title, sub, ms) {
  var fx = $('#allinFx'); if (!fx) return;
  clearTimeout(allinTimer);
  fx.className = 'allin-fx'; fx.innerHTML = '';
  fx.appendChild(el('b', { text: title })); fx.appendChild(el('span', { text: sub }));
  void fx.offsetWidth; fx.className = 'allin-fx ' + cls;
  allinTimer = setTimeout(function () { fx.className = 'allin-fx'; }, ms);
}
function allinCheck(n) {
  if (n < room().min || S.balance >= room().min) return;
  allinRound = true;
  allinFx('show', 'ALL IN', fmt(n) + ' Chips stehen auf dem Spiel', 1700);
  var app = $('#app'); app.classList.remove('quake'); void app.offsetWidth; app.classList.add('quake');
  Snd.heart();
}
function allinResult(net) {
  if (!allinRound) return;
  allinRound = false;
  if (net > 0) {
    Snd.big(); burst($('#app'), 90, ['#FFF3C9', '#F2D68E', '#D4AB52', '#6FD3A2', '#FFFFFF']);
    allinFx('win', 'ALL IN GEWONNEN', '+' + fmt(net) + ' Chips', 3200);
  } else if (net < 0) allinFx('lose', 'ALLES WEG', 'Das war der letzte Chip.', 2600);
}

/* ---------- Tabs ---------- */
/* Kleine Plakette mit dem Tastenkürzel auf einem Knopf (nur mit Maus/Tastatur sichtbar) */
function kbd(key) { return el('kbd', { class: 'kb', text: key }); }
function tabs(container, items, current, onPick) {
  container.innerHTML = '';
  var btns = items.map(function (it) {
    var b = el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(it.id === current), text: it.label,
      onclick: function () { onPick(it.id); } });
    container.appendChild(b); return b;
  });
  return btns;
}

return {
  E: E, A: A, $: $, $$: $$, el: el, fmt: fmt, fmtX: fmtX, clamp: clamp, sleep: sleep, frame: frame, payout: payout, pick: pick, pickW: pickW, short: short, clock: clock,
  get S() { return S; }, climbed: climbed, load: load, save: save, room: room, debit: debit, lock: lock, refund: refund, Snd: Snd,
  toast: toast, banner: banner, burst: burst, say: say, renderHost: renderHost, renderAff: renderAff, tip: tip, addAff: addAff,
  renderDopa: renderDopa, settle: settle, hud: hud, renderTier: renderTier, enterRoom: enterRoom, reload: reload, claimComps: claimComps,
  needChips: needChips, fx: fx, parseAmount: parseAmount, snapBet: snapBet, kbd: kbd, ladder: ladder, chipList: chipList, clampBets: clampBets, betControl: betControl, tabs: tabs,
  busyFns: busyFns, isBusy: isBusy, games: [], side: null, LINES: LINES, affTitle: affTitle, compMult: compMult, maybeReality: maybeReality,
  resetState: function () { S = fresh(S.mode); if (S.mode !== 'sandbox') { S.onb = 1; S.feats = {}; } locked = 0; save(); },
  get slotId() { return slotId; }, get slotName() { return slotName; }, renameSlot: renameSlot,
  GAME_LIST: GAME_LIST, GAME_BY: GAME_BY, RANK: RANK, isCareer: isCareer, gameOpen: gameOpen, gamesAt: gamesAt, GAME_TIER: GAME_TIER, GAME_NAME: GAME_NAME, CAREER: CAREER,
  bailout: bailout, bailoutAmt: bailoutAmt, claimDaily: claimDaily, dailyAvailable: dailyAvailable,
  renderWalletBtn: renderWalletBtn, walletAction: walletAction
};
})();
