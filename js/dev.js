/* Chip Empire – Dev-Konten: nur zum Testen. Der Owner markiert ein Konto im Admin-Panel als Dev-Konto.
   Es ist überall ausgeblendet (Ranglisten, Suche, Statistik) und hat im Spiel alles offen: alle Spiele,
   Varianten und Funktionen, dazu der Reiter „🛠 Dev“ mit Werkzeugen. Die Werkzeuge ändern nur den eigenen Spielstand. */
(function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var on = false;

function cacheKey() { var a = Cloud.current(); return a ? 'chip-empire-dev-' + a.id : null; }
/* Alles offen: Dev-Konto und der Schalter im Dev-Reiter steht auf an */
function all() { return on && V.S.devAll !== false; }

/* Beim Spielstart: zuerst der gemerkte Wert (damit sofort alles offen ist), dann beim Server nachfragen */
function init() {
  var k = cacheKey();
  on = false;
  if (!k || !Store.isAccount()) return;
  try { on = localStorage.getItem(k) === '1'; } catch (e) { on = false; }
  Cloud.rpc('am_dev').then(function (v) {
    v = !!v;
    try { if (v) localStorage.setItem(k, '1'); else localStorage.removeItem(k); } catch (e) { /* */ }
    if (v !== on) { on = v; refresh(); }
  }).catch(function () { /* ohne Datenbank-Update: kein Dev-Modus */ });
}
/* Alles neu zeichnen, was davon abhängt, ob Spiele und Funktionen offen sind */
function refresh() {
  var app = V.$('#app'); if (app) app.classList.toggle('is-dev', on);
  if (V.guide) V.guide.apply();
  if (V.renderNav) V.renderNav();
  if (V.renderSideNav) V.renderSideNav();
  if (V.mastery) V.mastery.renderHead();
  V.games.forEach(function (g) { if (g.onMastery) g.onMastery(); if (g.onRoom) g.onRoom(); });
  V.hud(); V.side.refresh();
}
function changed(msg) { V.hud(); V.renderTier(); V.renderHost(); V.legend.renderStars(); refresh(); V.save(); if (msg) V.toast('🛠 ' + msg, 'good'); }

/* ---------- Reiter „🛠 Dev“ ---------- */
function num(v, label) { return el('input', { class: 'name-in sm', type: 'number', step: '1', inputmode: 'numeric', value: String(v), 'aria-label': label }); }
function row(label, input, btnText, fn) {
  input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') fn(Number(input.value)); });
  return el('div', { class: 'dev-row' }, el('span', { text: label }), input,
    el('button', { class: 'btn gold sm', type: 'button', text: btnText, onclick: function () { fn(Number(input.value)); } }));
}
function btn(text, fn, ghost) { return el('button', { class: 'btn ' + (ghost ? 'ghost' : 'gold') + ' sm', type: 'button', text: text, onclick: fn }); }
function box(title, kids) { return el('section', { class: 'set-box dev-box' }, el('h4', { text: title }), kids); }

function tab(body) {
  var S = V.S;
  body.appendChild(el('p', { class: 'side-intro', text: 'Dev-Konto: überall ausgeblendet (Ranglisten, Suche, Saison, Admin-Statistik). Die Werkzeuge ändern nur diesen Spielstand.' }));
  body.appendChild(box('Ansicht', [
    el('button', { class: 'tut-toggle', type: 'button', role: 'switch', 'aria-checked': String(S.devAll !== false), onclick: function () { S.devAll = S.devAll === false; changed(S.devAll ? 'Alles offen' : 'Normale Ansicht wie ein Spieler'); } },
      el('span', { class: 'sw' }), el('span', {}, el('b', { text: 'Alles offen' }), el('small', { text: 'Alle Spiele, Varianten, Reiter und Funktionen. Aus: so wie ein normaler Spieler mit diesem Spielstand.' }))),
    el('div', { class: 'rrow' },
      btn('Neuer-Spieler-Ablauf testen', function () { S.onb = 1; S.feats = {}; S.devAll = false; changed('Freischaltungen zurückgesetzt, „Alles offen“ ist aus'); }, true),
      btn('Einführung zeigen', function () { V.closeSide(); V.tutorial.start(); }, true))
  ]));
  body.appendChild(box('Chips und Fortschritt', [
    row('Chips', num(Math.round(S.balance), 'Chips'), 'Setzen', function (v) { if (v >= 0) { S.balance = Math.round(v); changed('Chips gesetzt'); } }),
    el('div', { class: 'rrow' }, btn('+100k', function () { S.balance += 1e5; changed(); }, true), btn('+10 Mio', function () { S.balance += 1e7; changed(); }, true), btn('+100 Mio', function () { S.balance += 1e8; changed(); }, true)),
    row('Level', num(S.level, 'Level'), 'Setzen', function (v) { if (v >= 1) { S.level = Math.round(v); S.xp = 0; changed('Level ' + S.level); } }),
    row('Bonus-TP', num(S.bonusTp, 'Bonus-Talentpunkte'), 'Setzen', function (v) { if (v >= 0) { S.bonusTp = Math.round(v); changed('Bonus-Talentpunkte gesetzt'); } }),
    S.mode === 'career' ? row('★ Sterne', num(S.stars || 0, 'Legenden-Sterne'), 'Setzen', function (v) { if (v >= 0) { S.stars = Math.round(v); changed(S.stars + ' Sterne'); } }) : null,
    el('div', { class: 'rrow' },
      btn('Alle Räume offen', function () { S.unlocked = 5; S.wagered = Math.max(S.wagered, E.TIERS[5].wager); changed('Alle Räume offen'); }, true),
      btn('Zurück in die Lobby', function () { if (V.isBusy()) return; S.unlocked = 0; S.room = 0; S.wagered = 0; S.wagerBonus = 0; V.clampBets(); changed('Stufe Lobby'); }, true),
      S.mode === 'career' ? btn('Bereit für Legende', function () { S.unlocked = 5; S.room = 5; S.wagered = Math.max(S.wagered, E.TIERS[5].wager); S.balance = Math.max(S.balance, 25000000 * ((S.stars || 0) + 1)); V.clampBets(); changed('Legende ist jetzt möglich (Reiter „Stufen“)'); }, true) : null)
  ]));
  body.appendChild(box('Meisterschaft, Quests, Boni', [
    el('div', { class: 'rrow' },
      btn('Alle Spiele Diamant', function () { V.GAME_LIST.forEach(function (g) { S.gst[g.id].r = Math.max(S.gst[g.id].r, 4000); }); changed('Meisterschaft Diamant'); }, true),
      btn('Meisterschaft auf 0', function () { V.GAME_LIST.forEach(function (g) { S.gst[g.id].r = 0; }); changed('Meisterschaft zurückgesetzt'); }, true)),
    el('div', { class: 'rrow' },
      btn('Alle Quests fertig', function () { V.meta.ensureQuests(); ['daily', 'weekly'].forEach(function (k) { S.quests[k].list.forEach(function (q) { q.p = q.n; q.done = true; }); }); changed('Quests fertig, jetzt abholen'); }, true),
      btn('Neue Quests würfeln', function () { S.quests.daily.key = ''; S.quests.weekly.key = ''; V.meta.ensureQuests(); changed('Neue Quests'); }, true),
      btn('Tagesbonus wieder offen', function () { S.dailyLast = ''; changed('Tagesbonus kann wieder abgeholt werden'); }, true),
      btn('Notgroschen sofort', function () { S.bailoutAt = 0; changed('Notgroschen ohne Wartezeit'); }, true))
  ]));
  body.appendChild(box('Effekte ansehen', el('div', { class: 'rrow' },
    btn('Goldkugel', function () { V.closeSide(); V.event('gold', '✨ GOLDKUGEL ✨', 'Diese Kugel zahlt doppelt'); }, true),
    btn('Blitz-Runde', function () { V.closeSide(); V.event('blitz', '⚡ BLITZ-RUNDE ⚡', 'Zahlen werden aufgeladen'); }, true),
    btn('Doppel-Rakete', function () { V.closeSide(); V.event('rocket', '🚀🚀 DOPPEL-RAKETE', 'Zahlt doppelt'); }, true),
    btn('Konfetti', function () { V.closeSide(); V.burst(V.$('#app'), 80); V.Snd.big(); }, true))));
}

V.devTools = { init: init, tab: tab, all: all, get on() { return on; } };
})();
