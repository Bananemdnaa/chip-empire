/* Chip Empire – Imperium-Modus: Geschäfte in mehreren Städten, Betrieb (Zustand, Renovieren, Manager, Versicherung),
   Ereignisse mit Entscheidungen und Luxus-Käufe mit Prestige-Titeln.
   Verluste sind bewusst mild: Kein Geschäft geht verloren, ein Ereignis kostet höchstens 5 % des Imperiumswerts,
   ein heruntergekommenes Geschäft bringt immer noch 40 % seiner Einnahmen. */
(function () {
'use strict';
var el = V.el, fmt = V.fmt, short = V.short, E = V.E;
var H = 36e5;

/* ================= Städte und Geschäfte ================= */
/* Heimatstadt: die bisherigen Geschäfte, freigeschaltet über die Räume. Ihre Stufen liegen weiter in S.biz. */
var HOME = [
  { key: 'kiosk', name: 'Zeitungskiosk', icon: '📰', cost: 1500, inc: 150, tier: 0, desc: 'Klein, aber verlässlich. Dein erstes Geschäft.' },
  { key: 'cigar', name: 'Zigarrenbar', icon: '🥃', cost: 15000, inc: 1200, tier: 1, desc: 'Ledersessel, Whisky und gute Gespräche.' },
  { key: 'lounge', name: 'Cocktail-Lounge', icon: '🍸', cost: 120000, inc: 9000, tier: 2, desc: 'Hier wird bis zum Morgen getanzt.' },
  { key: 'hotel', name: 'Boutique-Hotel', icon: '🏨', cost: 900000, inc: 60000, tier: 3, desc: 'Zimmer mit Blick auf die Skyline.' },
  { key: 'yacht', name: 'Casino-Yacht', icon: '🛥️', cost: 7500000, inc: 450000, tier: 4, desc: 'Spieltische auf hoher See.' },
  { key: 'casino', name: 'Eigenes Casino', icon: '🎰', cost: 60000000, inc: 3000000, tier: 5, desc: 'Jetzt gehört das Haus dir.' }
];
/* Neue Städte: jede mit vier eigenen Geschäften. m = Maßstab für Preise und Einnahmen. */
var CITY_BIZ = [
  { key: 'hotel', icon: '🏨', cost: 2e8, inc: 1.2e7 },
  { key: 'club', icon: '🪩', cost: 6e8, inc: 3.3e7 },
  { key: 'show', icon: '🎭', cost: 1.5e9, inc: 7.5e7 },
  { key: 'resort', icon: '🏝️', cost: 5e9, inc: 2.2e8 }
];
var CITIES = [
  { id: 'home', name: 'Heimatstadt', icon: '🏙️', m: 1, desc: 'Hier hat alles angefangen.' },
  { id: 'vegas', name: 'Las Vegas', icon: '🎲', m: 1, price: 1e9, names: ['Neon-Hotel', 'Strip-Club „Jackpot“', 'Magier-Show', 'Wüsten-Resort'], desc: 'Die Stadt, die niemals schläft.' },
  { id: 'monaco', name: 'Monaco', icon: '⛵', m: 8, price: 3e10, names: ['Grand Hôtel', 'Yacht-Club', 'Grand-Prix-Loge', 'Riviera-Casino'], desc: 'Formel 1, Jachten und alter Adel.' },
  { id: 'macau', name: 'Macau', icon: '🐉', m: 60, price: 3e11, names: ['Lotus-Tower', 'Drachen-Lounge', 'Wasser-Spektakel', 'Jade-Palast'], desc: 'Das größte Glücksspiel-Paradies der Welt.' },
  { id: 'dubai', name: 'Dubai', icon: '🕌', m: 400, price: 3e12, names: ['Wolkenkratzer-Hotel', 'Sky-Lounge', 'Wüsten-Gala', 'Palmen-Insel-Resort'], desc: 'Gold, Wolkenkratzer und keine Grenzen.' }
];
var MAX_LV = 10;
function cityOf(id) { for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i]; return CITIES[0]; }
function bizList(city) {
  var C = cityOf(city);
  if (city === 'home') return HOME.map(function (b) { return Object.assign({ city: 'home', id: 'home.' + b.key }, b); });
  return CITY_BIZ.map(function (b, i) { return { city: city, id: city + '.' + b.key, key: b.key, icon: b.icon, name: C.names[i], cost: b.cost * C.m, inc: b.inc * C.m }; });
}
function allBiz() { var out = []; CITIES.forEach(function (C) { if (cityOwned(C.id)) out = out.concat(bizList(C.id)); }); return out; }

/* ---------- Zustand im Spielstand ---------- */
function isEmpire() { return V.S.mode === 'empire'; }
function st() {
  var S = V.S;
  if (!S.emp || typeof S.emp !== 'object') S.emp = {};
  var e = S.emp;
  ['cities', 'cbiz', 'cond', 'mgr', 'lux'].forEach(function (k) { if (!e[k] || typeof e[k] !== 'object') e[k] = {}; });
  if (!Array.isArray(e.mods)) e.mods = [];
  if (!e.condAt) e.condAt = Date.now();
  if (!e.nextEvt) e.nextEvt = Date.now() + 45 * 60 * 1000;
  return e;
}
function cityOwned(id) { return id === 'home' || !!st().cities[id]; }
function lvOf(b) { return b.city === 'home' ? (V.S.biz[b.key] || 0) : (st().cbiz[b.id] || 0); }
function setLv(b, lv) { if (b.city === 'home') V.S.biz[b.key] = lv; else st().cbiz[b.id] = lv; }
function bizOpen(b) { return b.city !== 'home' || V.S.unlocked >= b.tier; }
function baseInc(b, lv) { return lv ? b.inc * Math.pow(1.6, lv - 1) : 0; }
function upCost(b, lv) { return Math.round(b.cost * Math.pow(1.75, lv)); }
function perk(id) { return V.meta.perk(id); }

/* ================= Luxus und Prestige ================= */
var LUX = [
  { id: 'watch', name: 'Goldene Uhr', icon: '⌚', cost: 1e7, pts: 1, perk: 'Zeigt allen, dass du es geschafft hast.' },
  { id: 'cars', name: 'Sportwagen-Sammlung', icon: '🏎️', cost: 1e8, pts: 2, perk: 'Geschäfte verfallen 15 % langsamer.' },
  { id: 'villa', name: 'Villa am Meer', icon: '🏖️', cost: 1e9, pts: 4, perk: 'Tresor fasst 2 Stunden mehr.' },
  { id: 'yacht', name: 'Superjacht', icon: '🛥️', cost: 1e10, pts: 8, perk: 'Gute Ereignisse kommen doppelt so oft.' },
  { id: 'jet', name: 'Privatjet', icon: '✈️', cost: 1e11, pts: 15, perk: 'Alle Städte außer der Heimat bringen 5 % mehr.' },
  { id: 'island', name: 'Privatinsel', icon: '🏝️', cost: 1e12, pts: 30, perk: 'Alle Einnahmen +10 %.' },
  { id: 'art', name: 'Kunstsammlung', icon: '🖼️', cost: 5e8, pts: 3, levels: 6, step: 8, perk: 'Pro Gemälde +2 % Einnahmen.' }
];
var TITLES = [[0, 'Geschäftsmann'], [3, 'Millionär'], [10, 'Jetsetter'], [25, 'Tycoon'], [45, 'Magnat'], [70, 'Imperator']];
function luxLv(id) { return st().lux[id] || 0; }
function luxCost(L) { return L.levels ? Math.round(L.cost * Math.pow(L.step, luxLv(L.id))) : L.cost; }
function prestige() { var p = 0; LUX.forEach(function (L) { p += L.pts * luxLv(L.id); }); return p; }
function title() { var t = TITLES[0][1], p = prestige(); TITLES.forEach(function (x) { if (p >= x[0]) t = x[1]; }); return t; }
function nextTitle() { var p = prestige(); for (var i = 0; i < TITLES.length; i++) if (TITLES[i][0] > p) return TITLES[i]; return null; }

/* ================= Einnahmen ================= */
/* Zustand: 100 % neu, verfällt mit 2 % pro Stunde (auch offline). Unter 100 % sinken die Einnahmen, bis auf 40 %. */
var DECAY = 2;
function decay() {
  var e = st(), now = Date.now(), h = Math.max(0, (now - e.condAt) / H);
  e.condAt = now;
  if (!h) return;
  var d = h * DECAY * (luxLv('cars') ? 0.85 : 1);
  allBiz().forEach(function (b) {
    if (!lvOf(b)) return;
    if (e.mgr[b.city]) { e.cond[b.id] = 100; return; }
    e.cond[b.id] = Math.max(0, cond(b) - d);
  });
}
function cond(b) { var c = st().cond[b.id]; return typeof c === 'number' ? c : 100; }
function condFactor(b) { return 0.4 + 0.6 * cond(b) / 100; }
/* Zeitlich begrenzte Effekte aus Ereignissen (Streik, Konkurrenz, Promi-Besuch) */
function mods() { var now = Date.now(), e = st(); e.mods = e.mods.filter(function (m) { return m.until > now; }); return e.mods; }
function modFactor(b) {
  var f = 1;
  mods().forEach(function (m) { if (m.biz === b.id || m.city === b.city || m.all) f *= m.mult; });
  return f;
}
function globalMult() { return (1 + perk('empire')) * (1 + 0.02 * luxLv('art') + (luxLv('island') ? 0.1 : 0)); }
function bizIncome(b) {
  var lv = lvOf(b); if (!lv) return 0;
  return baseInc(b, lv) * condFactor(b) * modFactor(b) * globalMult() * (b.city !== 'home' && luxLv('jet') ? 1.05 : 1);
}
function cityGross(city) { var s = 0; bizList(city).forEach(function (b) { s += bizIncome(b); }); return s; }
/* Laufende Kosten: Manager 6 % der Stadt-Einnahmen, Versicherung 4 % aller Einnahmen */
function costs() {
  var e = st(), gross = 0, mgr = 0;
  CITIES.forEach(function (C) { if (!cityOwned(C.id)) return; var g = cityGross(C.id); gross += g; if (e.mgr[C.id]) mgr += g * 0.06; });
  return { gross: gross, mgr: mgr, ins: e.ins ? gross * 0.04 : 0 };
}
function perHour() { if (!isEmpire()) return 0; var c = costs(); return Math.max(0, c.gross - c.mgr - c.ins); }
/* Geld in „Stunden Einnahmen“, mindestens ein kleiner Betrag, damit Ereignisse am Anfang nicht 0 kosten */
function hours(n, base) { return Math.round(Math.max(base == null ? perHour() : base, 1000) * n); }

function vaultHours() { return 8 + perk('vault') + (luxLv('villa') ? 2 : 0); }
function vaultCap() { return Math.floor(perHour() * vaultHours()); }
function vault() {
  var S = V.S;
  if (!S.bizAt || !isEmpire()) return 0;
  var h = Math.min(Math.max(0, Date.now() - S.bizAt) / H, vaultHours());
  return Math.floor(perHour() * h);
}
function collect(quiet) {
  var S = V.S;
  decay();
  var v = vault();
  S.bizAt = Date.now();
  if (v <= 0) return 0;
  S.balance += v; S.bizEarned += v;
  if (!quiet) { V.Snd.cash(); V.toast('Tresor geleert: +' + fmt(v) + ' Chips', 'good'); }
  V.hud(); V.save();
  return v;
}
/* Imperiumswert: Chips plus alles, was in Geschäfte, Städte und Luxus gesteckt wurde */
function worth() { return Math.round(V.S.balance + V.S.bizSpent); }
function spend(c) { var S = V.S; if (S.balance < c) { V.toast('Dafür fehlen dir ' + fmt(c - S.balance) + ' Chips.', 'bad'); return false; } S.balance -= c; return true; }

/* ================= Kaufen, Ausbauen, Renovieren ================= */
function buy(id) {
  var b = null; allBiz().forEach(function (x) { if (x.id === id) b = x; });
  if (!b || !isEmpire() || !bizOpen(b)) return;
  var lv = lvOf(b);
  if (lv >= MAX_LV) return;
  var c = upCost(b, lv);
  collect(true);
  if (!spend(c)) return;
  setLv(b, lv + 1); V.S.bizSpent += c;
  st().cond[b.id] = 100;
  if (!V.S.bizAt) V.S.bizAt = Date.now();
  V.Snd.unlock();
  if (lv === 0) V.banner(b.icon + ' ' + b.name, 'Gehört jetzt dir · +' + fmt(bizIncome(b)) + ' Chips pro Stunde', { kind: 'win', ms: 2600 });
  else V.toast(b.name + ' auf Stufe ' + (lv + 1) + ' ausgebaut.', 'good');
  done();
}
/* Renovieren: kostet (fehlender Zustand) × 2 Stunden der vollen Einnahmen dieses Geschäfts */
function repairCost(b) { var lv = lvOf(b); return lv ? Math.round((100 - cond(b)) / 100 * 2 * baseInc(b, lv) * globalMult()) : 0; }
function repair(id) {
  decay();
  var b = null; allBiz().forEach(function (x) { if (x.id === id) b = x; });
  if (!b) return;
  var c = repairCost(b);
  if (c <= 0) return;
  collect(true);
  if (!spend(c)) return;
  st().cond[b.id] = 100;
  V.Snd.cash(); V.toast('🛠 ' + b.name + ' renoviert.', 'good');
  done();
}
function repairAllCost() { var s = 0; allBiz().forEach(function (b) { s += repairCost(b); }); return s; }
function repairAll() {
  decay();
  var c = repairAllCost();
  if (c <= 0) return;
  collect(true);
  if (!spend(c)) return;
  allBiz().forEach(function (b) { if (lvOf(b)) st().cond[b.id] = 100; });
  V.Snd.cash(); V.toast('🛠 Alles renoviert für ' + fmt(c) + ' Chips.', 'good');
  done();
}
function buyCity(id) {
  var C = cityOf(id), i = CITIES.indexOf(C);
  if (!isEmpire() || cityOwned(id) || !canExpand(C)) return;
  collect(true);
  if (!spend(C.price)) return;
  st().cities[id] = 1; V.S.bizSpent += C.price;
  V.Snd.big(); V.burst(V.$('#drawer .drawer-panel'), 60);
  V.banner(C.icon + ' ' + C.name, 'Willkommen in deiner ' + (i + 1) + '. Stadt. Vier neue Geschäfte warten.', { kind: 'win', ms: 3500 });
  view.city = id;
  done();
}
/* Nächste Stadt erst, wenn in der vorigen das größte Geschäft steht */
function canExpand(C) {
  var i = CITIES.indexOf(C), prev = CITIES[i - 1];
  if (!prev || !cityOwned(prev.id)) return false;
  var list = bizList(prev.id), top = list[list.length - 1];
  return lvOf(top) > 0;
}
function buyLux(id) {
  var L = null; LUX.forEach(function (x) { if (x.id === id) L = x; });
  if (!L || !isEmpire()) return;
  var lv = luxLv(id);
  if (lv >= (L.levels || 1)) return;
  var c = luxCost(L), before = title();
  collect(true);
  if (!spend(c)) return;
  st().lux[id] = lv + 1; V.S.bizSpent += c;
  V.Snd.unlock();
  var now = title();
  if (now !== before) { V.burst(V.$('#drawer .drawer-panel'), 50); V.banner('👑 ' + now, 'Neuer Titel im Imperium · ' + prestige() + ' Prestige', { kind: 'level', ms: 4000 }); }
  else V.toast(L.icon + ' ' + L.name + (L.levels ? ' · Gemälde ' + (lv + 1) : '') + ' gekauft.', 'good');
  done();
}
function setManager(city, on) { decay(); collect(true); st().mgr[city] = on ? 1 : 0; if (on) bizList(city).forEach(function (b) { if (lvOf(b)) st().cond[b.id] = 100; }); V.Snd.click(); done(); }
function setInsurance(on) { collect(true); st().ins = !!on; V.Snd.click(); done(); }
function done() { V.hud(); V.side.refresh(); V.renderBadges(); V.save(); }

/* ================= Ereignisse ================= */
/* Alle 2 bis 4 Stunden (auch offline) ein Ereignis. Es wartet, bis du entscheidest; nach 24 Stunden gilt die zweite Wahl. */
function pickBiz(min) { var l = allBiz().filter(function (b) { return lvOf(b) > 0 && (!min || lvOf(b) >= min); }); return l.length ? l[Math.floor(Math.random() * l.length)] : null; }
function pickCity() { var l = CITIES.filter(function (C) { return cityOwned(C.id) && cityGross(C.id) > 0; }); return l.length ? l[Math.floor(Math.random() * l.length)] : CITIES[0]; }
/* Milde Verluste: höchstens 5 % des Imperiumswerts, nie mehr als die vorhandenen Chips */
function lose(n) { var S = V.S, c = Math.min(Math.round(n), Math.round(worth() * 0.05), Math.max(0, Math.round(S.balance))); S.balance -= c; return c; }
function gain(n) { n = Math.round(n); V.S.balance += n; V.S.bizEarned += n; return n; }
function addMod(m, hoursLong) { m.until = Date.now() + hoursLong * H; st().mods.push(m); }

var EVENTS = [
  { id: 'tax', w: 3, icon: '🧾', make: function () {
    var a = hours(2), law = hours(0.5), fine = hours(4);
    return { title: 'Steuerprüfung', text: 'Das Finanzamt nimmt deine Bücher unter die Lupe und will eine Nachzahlung.', opts: [
      { label: 'Nachzahlen', sub: '−' + short(a), run: function () { return 'Bezahlt: −' + fmt(lose(a)) + ' Chips. Das Finanzamt ist zufrieden.'; } },
      { label: 'Anwalt einschalten', sub: '−' + short(law) + ', dann 70 %: nichts · 30 %: −' + short(fine), run: function () {
        var c = lose(law); if (Math.random() < 0.7) return 'Dein Anwalt hat gewonnen. Nur sein Honorar: −' + fmt(c) + '.';
        return 'Verloren! Honorar und Strafe: −' + fmt(c + lose(fine)) + '.'; } }] };
  } },
  { id: 'fire', w: 2, needBiz: true, icon: '🔥', make: function () {
    var b = pickBiz(), e = st(), call = hours(1, baseInc(b, lvOf(b)) * 3);
    if (e.ins) return { title: 'Feuer im ' + b.name, text: 'In der Küche hat es gebrannt. Zum Glück bist du versichert.', opts: [
      { label: 'Versicherung regelt das', sub: 'Zustand −10 %', run: function () { e.cond[b.id] = Math.max(0, cond(b) - 10); return 'Die Versicherung zahlt den Schaden. ' + b.name + ' ist kaum betroffen.'; } }] };
    return { title: 'Feuer im ' + b.name, text: 'In der Küche brennt es. Schnell handeln oder den Schaden in Kauf nehmen?', opts: [
      { label: 'Feuerwehr rufen', sub: '−' + short(call) + ' · Zustand −15 %', run: function () { var c = lose(call); e.cond[b.id] = Math.max(0, cond(b) - 15); return 'Gelöscht. Einsatz kostet ' + fmt(c) + ' Chips, kleiner Schaden.'; } },
      { label: 'Selbst löschen', sub: 'kostenlos · Zustand −50 %', run: function () { e.cond[b.id] = Math.max(0, cond(b) - 50); return 'Irgendwie gelöscht, aber ' + b.name + ' sieht übel aus. Renovieren lohnt sich.'; } }] };
  } },
  { id: 'strike', w: 2, needBiz: true, icon: '✊', make: function () {
    var b = pickBiz(), raise = Math.round(baseInc(b, lvOf(b)) * globalMult() * 3);
    return { title: 'Streik im ' + b.name, text: 'Das Personal legt die Arbeit nieder und will mehr Lohn.', opts: [
      { label: 'Lohnerhöhung', sub: '−' + short(raise), run: function () { return 'Einigung erzielt: −' + fmt(lose(raise)) + '. Alle arbeiten weiter.'; } },
      { label: 'Aussitzen', sub: b.name + ' bringt 6 Std. nichts', run: function () { addMod({ biz: b.id, mult: 0, label: 'Streik im ' + b.name }, 6); return 'Der Streik läuft 6 Stunden. ' + b.name + ' ist so lange zu.'; } }] };
  } },
  { id: 'vip', w: 2, good: true, icon: '🤵', make: function () {
    var cost = hours(1), win = hours(4);
    return { title: 'Highroller im Anflug', text: 'Ein Ölscheich möchte in deinem Haus spielen. Er erwartet einen großen Empfang.', opts: [
      { label: 'Empfang ausrichten', sub: '−' + short(cost) + ' · 60 %: +' + short(win), run: function () {
        var c = lose(cost); if (Math.random() < 0.6) return 'Er war begeistert und hat kräftig verloren: +' + fmt(gain(win)) + ' (Empfang ' + fmt(c) + ').';
        return 'Er hat gewonnen und ist abgereist. Der Empfang hat ' + fmt(c) + ' gekostet.'; } },
      { label: 'Ablehnen', sub: 'nichts passiert', run: function () { return 'Er spielt woanders.'; } }] };
  } },
  { id: 'rival', w: 2, icon: '🏗️', make: function () {
    var C = pickCity(), ad = hours(2, cityGross(C.id));
    return { title: 'Konkurrenz in ' + C.name, text: 'Direkt gegenüber hat ein neues Casino eröffnet und lockt deine Gäste weg.', opts: [
      { label: 'Werbekampagne', sub: '−' + short(ad), run: function () { return 'Die Kampagne wirkt, deine Gäste bleiben: −' + fmt(lose(ad)) + '.'; } },
      { label: 'Ignorieren', sub: C.name + ': 12 Std. −20 % Einnahmen', run: function () { addMod({ city: C.id, mult: 0.8, label: 'Konkurrenz in ' + C.name }, 12); return 'Für 12 Stunden bringt ' + C.name + ' 20 % weniger.'; } }] };
  } },
  { id: 'celeb', w: 2, good: true, icon: '🌟', make: function () {
    var bonus = hours(2);
    return { title: 'Promi-Party', text: 'Ein Filmstar feiert bei dir seinen Geburtstag. Die Presse ist begeistert.', opts: [
      { label: 'Mitfeiern', sub: '+' + short(bonus) + ' · 6 Std. +25 % Einnahmen', run: function () { addMod({ all: true, mult: 1.25, label: 'Promi-Effekt' }, 6); return 'Was für eine Nacht! +' + fmt(gain(bonus)) + ' und 6 Stunden lang 25 % mehr Einnahmen.'; } }] };
  } },
  { id: 'pipe', w: 2, needBiz: true, icon: '🚰', make: function () {
    var b = pickBiz(), fix = Math.round(baseInc(b, lvOf(b)) * globalMult()), e = st();
    return { title: 'Rohrbruch im ' + b.name, text: 'Wasser läuft durch die Decke. Sofort reparieren oder später?', opts: [
      { label: 'Sofort reparieren', sub: '−' + short(fix), run: function () { return 'Repariert für ' + fmt(lose(fix)) + ' Chips.'; } },
      { label: 'Später', sub: 'Zustand −25 %', run: function () { e.cond[b.id] = Math.max(0, cond(b) - 25); return b.name + ' hat einen Wasserschaden. Renovieren hilft.'; } }] };
  } },
  { id: 'startup', w: 1, icon: '💡', make: function () {
    var bet = hours(3), back = hours(7);
    return { title: 'Start-up sucht Geld', text: 'Zwei junge Gründer wollen eine Casino-App bauen und suchen Investoren.', opts: [
      { label: 'Investieren', sub: '−' + short(bet) + ' · 50 %: +' + short(back), run: function () {
        var c = lose(bet); if (Math.random() < 0.5) return 'Die App ist ein Hit! +' + fmt(gain(back)) + ' (eingesetzt ' + fmt(c) + ').';
        return 'Die App ist gefloppt. ' + fmt(c) + ' Chips sind weg.'; } },
      { label: 'Ablehnen', sub: 'nichts passiert', run: function () { return 'Vielleicht beim nächsten Mal.'; } }] };
  } },
  { id: 'inspector', w: 1, icon: '⭐', make: function () {
    var C = pickCity(), prep = hours(1, cityGross(C.id));
    return { title: 'Restaurantkritiker in ' + C.name, text: 'Ein berühmter Kritiker hat sich angekündigt. Eine gute Kritik zieht Gäste an.', opts: [
      { label: 'Alles vorbereiten', sub: '−' + short(prep) + ' · 24 Std. +15 % in ' + C.name, run: function () { var c = lose(prep); addMod({ city: C.id, mult: 1.15, label: 'Gute Kritik in ' + C.name }, 24); return 'Fünf Sterne! 24 Stunden lang 15 % mehr in ' + C.name + ' (Vorbereitung ' + fmt(c) + ').'; } },
      { label: 'Normal weitermachen', sub: '50 %: 12 Std. −10 %', run: function () { if (Math.random() < 0.5) { addMod({ city: C.id, mult: 0.9, label: 'Schlechte Kritik in ' + C.name }, 12); return 'Eine mittelmäßige Kritik: 12 Stunden 10 % weniger in ' + C.name + '.'; } return 'Die Kritik war freundlich. Glück gehabt.'; } }] };
  } }
];
function rollEvent() {
  var anyBiz = allBiz().some(function (b) { return lvOf(b) > 0; });
  var pool = EVENTS.filter(function (x) { return !x.needBiz || anyBiz; });
  var t = 0, ws = pool.map(function (x) { var w = x.w * (x.good && luxLv('yacht') ? 2 : 1); t += w; return w; });
  var r = Math.random() * t;
  for (var i = 0; i < pool.length; i++) { r -= ws[i]; if (r < 0) return pool[i]; }
  return pool[0];
}
/* Ein Ereignis entsteht beim Öffnen oder alle paar Sekunden im Hintergrund, sobald es fällig ist */
var live = null;
function checkEvent() {
  if (!isEmpire() || perHour() <= 0) return;
  var e = st(), now = Date.now();
  if (e.evt) {
    if (now - e.evt.at > 24 * H) resolve(e.evt.opts.length - 1, true);
    return;
  }
  if (now < e.nextEvt) return;
  var T = rollEvent();
  e.evt = { id: T.id, at: now };
  e.nextEvt = now + (2 + Math.random() * 2) * H;
  live = T.make(); live.icon = T.icon; e.evt.title = live.title; e.evt.opts = live.opts.map(function (o) { return o.label; });
  V.save();
  V.renderBadges();
  V.toast(T.icon + ' Imperium: ' + live.title + '. Entscheide im Reiter „Imperium“.', 'warn');
  if (V.S.sideTab === 'imperium') V.side.refresh();
}
/* Die Wahlmöglichkeiten hängen von Zufall ab (welches Geschäft brennt). Nach einem Neuladen wird das Ereignis neu gewürfelt, Titel und Typ bleiben. */
function current() {
  var e = st();
  if (!e.evt) return null;
  if (!live || live.title !== e.evt.title) {
    var T = null; EVENTS.forEach(function (x) { if (x.id === e.evt.id) T = x; });
    if (!T) { e.evt = null; return null; }
    live = T.make(); live.icon = T.icon; e.evt.title = live.title; e.evt.opts = live.opts.map(function (o) { return o.label; });
  }
  return live;
}
function resolve(i, auto) {
  var ev = current(); if (!ev) return;
  decay(); collect(true);
  var o = ev.opts[Math.min(i, ev.opts.length - 1)], msg = o.run();
  var e = st();
  e.evt = null; live = null;
  e.log = (e.log || []).concat([{ t: Date.now(), icon: ev.icon, title: ev.title, msg: (auto ? 'Automatisch: ' : '') + msg }]).slice(-8);
  if (!auto) { V.Snd.click(); V.banner(ev.icon + ' ' + ev.title, msg, { kind: 'level', ms: 5000 }); }
  done();
}

/* ================= Ansicht ================= */
var view = { tab: 'biz', city: 'home' };
function bar(p, cls) { var i = el('i'); i.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%'; return el('div', { class: 'mbar ' + (cls || '') }, i); }
function condCls(c) { return c >= 70 ? 'ok' : c >= 35 ? 'mid' : 'bad'; }

function render(body) {
  var S = V.S;
  decay(); checkEvent();
  var ph = perHour(), cap = vaultCap(), v = vault(), nt = nextTitle();
  body.appendChild(el('div', { class: 'emp-head' },
    el('div', { class: 'emp-kpi' }, el('span', { class: 'lbl', text: 'Einnahmen / Std.' }), el('b', { class: 'num', text: short(Math.round(ph)) })),
    el('div', { class: 'emp-kpi' }, el('span', { class: 'lbl', text: 'Imperiumswert' }), el('b', { class: 'num', text: short(worth()) })),
    el('div', { class: 'emp-kpi emp-title' }, el('span', { class: 'lbl', text: 'Titel' }), el('b', { text: '👑 ' + title() }),
      el('small', { text: prestige() + ' Prestige' + (nt ? ' · ' + nt[1] + ' ab ' + nt[0] : '') })),
    el('div', { class: 'vault' + (cap && v >= cap ? ' full' : '') },
      el('div', { class: 'vault-h' }, el('span', { class: 'lbl', text: 'Tresor (füllt sich auch offline, ' + vaultHours() + ' Std.)' }), el('b', { id: 'vaultAmt', class: 'num', text: short(v) + ' / ' + short(cap) })),
      el('div', { id: 'vaultBar' }, bar(cap ? v / cap : 0)),
      el('button', { id: 'vaultBtn', class: 'btn gold sm', type: 'button', disabled: v <= 0, text: 'Tresor leeren', onclick: function () { collect(); V.side.refresh(); } }))));

  var ev = current();
  if (ev) body.appendChild(el('section', { class: 'emp-evt', role: 'alert' },
    el('div', { class: 'ee-h' }, el('span', { class: 'ee-ico', text: ev.icon }), el('div', {}, el('span', { class: 'gc-kick', text: 'Ereignis' }), el('b', { text: ev.title }))),
    el('p', { text: ev.text }),
    el('div', { class: 'ee-opts' }, ev.opts.map(function (o, i) {
      return el('button', { class: 'btn ' + (i ? 'ghost' : 'gold') + ' ee-opt', type: 'button', onclick: function () { resolve(i); } }, el('b', { text: o.label }), el('small', { text: o.sub }));
    }))));

  var seg = el('div', { class: 'qseg', role: 'tablist' });
  [['biz', 'Geschäfte'], ['ops', 'Betrieb'], ['lux', 'Luxus']].forEach(function (x) {
    var dot = x[0] === 'ops' && repairAllCost() > 0 && avgCond() < 60;
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(view.tab === x[0]), onclick: function () { view.tab = x[0]; V.Snd.click(); V.side.refresh(); } },
      x[1], dot ? el('span', { class: 'qcount', text: '!' }) : null));
  });
  body.appendChild(seg);
  if (view.tab === 'ops') renderOps(body);
  else if (view.tab === 'lux') renderLux(body);
  else renderBiz(body);
}

function renderBiz(body) {
  var S = V.S;
  /* Gewählt werden darf jede eigene Stadt und die nächste zum Kaufen */
  var vi = CITIES.indexOf(cityOf(view.city));
  if (!cityOwned(view.city) && !(vi > 0 && cityOwned(CITIES[vi - 1].id))) view.city = 'home';
  /* Städte als Leiste: eigene, dazu die nächste zum Kaufen */
  var row = el('div', { class: 'emp-cities' });
  CITIES.forEach(function (C, i) {
    var own = cityOwned(C.id), prev = CITIES[i - 1];
    if (!own && prev && !cityOwned(prev.id)) return;
    row.appendChild(el('button', { class: 'emp-city' + (own ? '' : ' buy') + (view.city === C.id ? ' on' : ''), type: 'button',
      onclick: function () { view.city = C.id; V.Snd.click(); V.side.refresh(); } },
      el('span', { text: C.icon }), el('b', { text: C.name }), own ? null : el('small', { text: short(C.price) })));
  });
  body.appendChild(row);
  var C = cityOf(view.city);
  if (!cityOwned(C.id)) {
    var ok = canExpand(C), prev = CITIES[CITIES.indexOf(C) - 1], top = bizList(prev.id).slice(-1)[0];
    body.appendChild(el('section', { class: 'emp-expand' },
      el('div', { class: 'ex-ico', text: C.icon }),
      el('b', { text: 'Expandieren nach ' + C.name }),
      el('p', { class: 'fine', text: C.desc + ' Vier neue Geschäfte, ' + (C.m > 1 ? C.m + '-mal so groß wie in Las Vegas.' : 'deutlich größer als alles in der Heimat.') }),
      ok ? null : el('p', { class: 'fine warn-t', text: 'Erst in ' + prev.name + ' das ' + top.name + ' kaufen.' }),
      el('button', { class: 'btn ' + (ok && S.balance >= C.price ? 'gold' : 'ghost'), type: 'button', disabled: !ok || S.balance < C.price,
        text: 'Expandieren · ' + short(C.price), onclick: function () { buyCity(C.id); } })));
    return;
  }
  if (!perHour() && C.id === 'home') body.appendChild(el('p', { class: 'side-intro', text: 'Kauf dein erstes Geschäft. Es verdient Chips pro Stunde, auch wenn du nicht spielst. Hol sie aus dem Tresor, bevor er voll ist. Geschäfte nutzen sich ab: Renovier sie unter „Betrieb“ oder stell einen Manager ein.' }));
  var list = el('div', { class: 'biz-list' });
  bizList(C.id).forEach(function (b) {
    var lv = lvOf(b), open = bizOpen(b), c = upCost(b, lv), cur = bizIncome(b);
    var next = lv < MAX_LV ? baseInc(b, lv + 1) * condFactor(b) * modFactor(b) * globalMult() : 0;
    var btn;
    if (!open) btn = el('button', { class: 'btn ghost sm', type: 'button', disabled: true, text: 'Ab ' + E.TIERS[b.tier].name });
    else if (lv >= MAX_LV) btn = el('button', { class: 'btn ghost sm', type: 'button', disabled: true, text: 'Voll ausgebaut' });
    else btn = el('button', { class: 'btn ' + (S.balance >= c ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: S.balance < c,
      text: (lv ? 'Ausbauen' : 'Kaufen') + ' · ' + short(c), onclick: function () { buy(b.id); } });
    var pips = el('span', { class: 'pips' });
    for (var k = 0; k < MAX_LV; k++) pips.appendChild(el('i', { class: k < lv ? 'on' : '' }));
    var cd = cond(b);
    list.appendChild(el('article', { class: 'biz' + (lv ? ' owned' : '') + (open ? '' : ' locked') },
      el('div', { class: 'biz-ico', text: b.icon }),
      el('div', { class: 'biz-info' },
        el('div', { class: 'biz-h' }, el('b', { text: b.name }), pips),
        b.desc ? el('div', { class: 'fine', text: b.desc }) : null,
        el('div', { class: 'biz-k' }, lv ? el('span', { text: 'Stufe ' + lv + ' · ' + short(Math.round(cur)) + '/Std.' }) : null,
          lv < MAX_LV ? el('span', { class: 'up', text: (lv ? 'danach ' : 'bringt ') + short(Math.round(next)) + '/Std.' }) : null),
        lv ? el('div', { class: 'biz-cond ' + condCls(cd) }, el('span', { text: 'Zustand ' + Math.round(cd) + ' %' }), bar(cd / 100),
          cd < 95 ? el('button', { class: 'btn ghost xs', type: 'button', disabled: S.balance < repairCost(b), text: '🛠 ' + short(repairCost(b)), title: 'Renovieren', onclick: function () { repair(b.id); } }) : null) : null),
      btn));
  });
  body.appendChild(list);
}
function avgCond() { var n = 0, s = 0; allBiz().forEach(function (b) { if (lvOf(b)) { n++; s += cond(b); } }); return n ? s / n : 100; }
function renderOps(body) {
  var S = V.S, e = st(), c = costs(), rc = repairAllCost(), ac = avgCond();
  body.appendChild(el('p', { class: 'side-intro', text: 'Geschäfte nutzen sich ab (2 % pro Stunde, auch offline). Je schlechter der Zustand, desto weniger bringen sie, bis auf 40 %. Renovieren macht sie wieder wie neu.' }));
  body.appendChild(el('section', { class: 'emp-ops' },
    el('div', { class: 'eo-row' }, el('div', {}, el('b', { text: 'Ø Zustand ' + Math.round(ac) + ' %' }), bar(ac / 100, condCls(ac))),
      el('button', { class: 'btn ' + (rc > 0 && S.balance >= rc ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: rc <= 0 || S.balance < rc, text: rc > 0 ? '🛠 Alles renovieren · ' + short(rc) : 'Alles wie neu', onclick: repairAll }))));
  /* Manager je Stadt */
  var mg = el('section', { class: 'emp-ops' }, el('h4', { text: 'Manager' }), el('p', { class: 'fine', text: 'Ein Manager hält alle Geschäfte seiner Stadt wie neu. Er bekommt 6 % der Einnahmen dieser Stadt.' }));
  CITIES.forEach(function (C) {
    if (!cityOwned(C.id) || !cityGross(C.id)) return;
    var on = !!e.mgr[C.id];
    mg.appendChild(el('button', { class: 'tut-toggle', type: 'button', role: 'switch', 'aria-checked': String(on), onclick: function () { setManager(C.id, !on); } },
      el('span', { class: 'sw' }), el('span', {}, el('b', { text: C.icon + ' ' + C.name }), el('small', { text: (on ? 'Lohn ' : 'würde kosten ') + short(Math.round(cityGross(C.id) * 0.06)) + ' / Std.' }))));
  });
  body.appendChild(mg);
  body.appendChild(el('section', { class: 'emp-ops' }, el('h4', { text: 'Versicherung' }),
    el('button', { class: 'tut-toggle', type: 'button', role: 'switch', 'aria-checked': String(!!e.ins), onclick: function () { setInsurance(!e.ins); } },
      el('span', { class: 'sw' }), el('span', {}, el('b', { text: 'Gebäudeversicherung' }), el('small', { text: 'Bei Feuer zahlt die Versicherung, das Geschäft bleibt fast heil. Kostet 4 % der Einnahmen (' + short(Math.round(c.gross * 0.04)) + ' / Std.).' })))));
  /* Laufende Effekte und letzte Ereignisse */
  var ms = mods();
  if (ms.length) body.appendChild(el('section', { class: 'emp-ops' }, el('h4', { text: 'Gerade aktiv' }), ms.map(function (m) {
    return el('div', { class: 'eo-mod ' + (m.mult >= 1 ? 'pos' : 'neg') }, el('span', { text: m.label + (m.mult === 0 ? ' (geschlossen)' : ' (' + (m.mult > 1 ? '+' : '') + Math.round((m.mult - 1) * 100) + ' %)') }), el('small', { text: 'noch ' + V.clock(m.until - Date.now()) }));
  })));
  var log = (e.log || []).slice().reverse();
  body.appendChild(el('section', { class: 'emp-ops' }, el('h4', { text: 'Letzte Ereignisse' }),
    log.length ? log.map(function (l) { return el('div', { class: 'eo-log' }, el('span', { text: l.icon }), el('div', {}, el('b', { text: l.title }), el('small', { text: l.msg }))); })
      : el('p', { class: 'fine', text: 'Noch nichts passiert. Etwa alle 2 bis 4 Stunden passiert in deinem Imperium etwas, bei dem du entscheiden musst.' }),
    e.evt ? null : el('p', { class: 'fine', text: 'Nächstes Ereignis in etwa ' + V.clock(Math.max(0, e.nextEvt - Date.now())) + '.' })));
  body.appendChild(el('div', { class: 'kv' }, el('span', { text: 'Einnahmen brutto / Manager / Versicherung' }),
    el('b', { class: 'num', text: short(Math.round(c.gross)) + ' / −' + short(Math.round(c.mgr)) + ' / −' + short(Math.round(c.ins)) })));
}
function renderLux(body) {
  var S = V.S, nt = nextTitle();
  body.appendChild(el('p', { class: 'side-intro', text: 'Was man mit unendlich viel Geld so macht. Luxus zählt zum Imperiumswert, bringt Prestige für deinen Titel und kleine Vorteile.' }));
  body.appendChild(el('div', { class: 'emp-titles' }, TITLES.map(function (t) {
    return el('span', { class: 'et' + (prestige() >= t[0] ? ' on' : '') + (title() === t[1] ? ' cur' : ''), text: t[1] + ' · ' + t[0] });
  })));
  var list = el('div', { class: 'biz-list' });
  LUX.forEach(function (L) {
    var lv = luxLv(L.id), max = L.levels || 1, full = lv >= max, c = luxCost(L);
    list.appendChild(el('article', { class: 'biz lux' + (lv ? ' owned' : '') },
      el('div', { class: 'biz-ico', text: L.icon }),
      el('div', { class: 'biz-info' },
        el('div', { class: 'biz-h' }, el('b', { text: L.name }), L.levels ? el('span', { class: 'tag', text: lv + ' / ' + max }) : lv ? el('span', { class: 'tag gold', text: 'Gehört dir' }) : null),
        el('div', { class: 'fine', text: L.perk }),
        el('div', { class: 'biz-k' }, el('span', { text: '+' + L.pts + ' Prestige' + (L.levels ? ' pro Stück' : '') }))),
      full ? el('button', { class: 'btn ghost sm', type: 'button', disabled: true, text: L.levels ? 'Sammlung komplett' : 'Gekauft' })
        : el('button', { class: 'btn ' + (S.balance >= c ? 'gold' : 'ghost') + ' sm', type: 'button', disabled: S.balance < c, text: 'Kaufen · ' + short(c), onclick: function () { buyLux(L.id); } })));
  });
  body.appendChild(list);
  if (nt) body.appendChild(el('p', { class: 'fine', text: 'Nächster Titel: ' + nt[1] + ' ab ' + nt[0] + ' Prestige.' }));
}

/* Jede Sekunde: Tresor-Anzeige auffrischen, fällige Ereignisse auslösen */
var evtCheck = 0;
function tick() {
  if (!isEmpire()) return;
  var a = document.getElementById('vaultAmt');
  if (a) {
    var cap = vaultCap(), v = vault();
    a.textContent = short(v) + ' / ' + short(cap);
    var i = document.querySelector('#vaultBar i'); if (i) i.style.width = (cap ? Math.min(1, v / cap) * 100 : 0).toFixed(1) + '%';
    var btn = document.getElementById('vaultBtn'); if (btn) btn.disabled = v <= 0;
  }
  if (Date.now() - evtCheck > 15000) { evtCheck = Date.now(); decay(); checkEvent(); }
}
function badge() { if (!isEmpire()) return false; var cap = vaultCap(); return !!st().evt || (cap > 0 && vault() >= cap * 0.5) || avgCond() < 50; }

V.empire = { render: render, tick: tick, perHour: perHour, vault: vault, vaultCap: vaultCap, collect: collect, worth: worth, badge: badge,
  title: title, prestige: prestige, CITIES: CITIES };
})();
