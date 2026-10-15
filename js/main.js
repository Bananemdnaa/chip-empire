/* Chip Empire – Start, Navigation, Spielzeit */
(function () {
'use strict';
var $ = V.$, $$ = V.$$;
var GAMES = V.GAME_LIST.map(function (g) { return { id: g.id, label: g.name, short: g.short }; });
/* In der Leiste nur das Wichtigste; Statistik, Profil und Einstellungen sind Reiter im selben Fenster */
var SIDE_ALL = [{ id: 'imperium', label: 'Imperium', empire: true }, { id: 'quests', label: 'Quests' }, { id: 'arena', label: 'Arena' }, { id: 'talente', label: 'Talente' }, { id: 'stufen', label: 'Stufen' }];
var SIDE = SIDE_ALL;
function sideItems() { return SIDE_ALL.filter(function (t) { return (!t.empire || V.S.mode === 'empire') && V.guide.tabOpen(t.id); }); }

function lockedMsg(id) {
  if (V.GAME_BY[id].guest) return V.GAME_NAME[id] + ' ist gerade kein Gastspiel. Die Gastspiele wechseln alle 6 Stunden.';
  return V.GAME_NAME[id] + ' wird in der ' + V.E.TIERS[V.GAME_TIER[id]].name + ' freigeschaltet.';
}
function showGame(id) {
  var S = V.S;
  if (!V.gameOpen(id)) { V.toast(lockedMsg(id), 'bad'); renderNav(); return; }
  if (id !== S.game && V.isBusy()) {
    V.toast('Beende erst die laufende Runde oder nimm deine Chips vom Tisch.', 'bad'); renderNav(); return;
  }
  var changed = S.game !== id;
  S.game = id;
  GAMES.forEach(function (g2) { var n = $('#g-' + g2.id); n.hidden = g2.id !== id; if (changed && g2.id === id) { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; } });
  $('#gameTitle').textContent = V.GAME_NAME[id];
  V.mastery.renderHead();
  V.track.strip();
  V.rotation.strip();
  renderNav();
  V.games.forEach(function (g3) { if (g3.id === id && g3.onShow) g3.onShow(); });
  V.save();
}
/* Spiele als Icon-Leiste (am Handy unten), dazu Stufen/Profil/Statistik als Fenster */
function railBtn(item, selected, onclick) {
  return V.el('button', { class: 'rail-btn', type: 'button', role: 'tab', 'aria-selected': String(selected), onclick: onclick },
    V.el('span', { html: Icons[item.id] }),
    /* Am Handy ist die Leiste schmal: dort der kurze Name, falls es einen gibt */
    item.short ? V.el('span', {}, V.el('span', { class: 'rl-long', text: item.label }), V.el('span', { class: 'rl-short', text: item.short })) : V.el('span', { text: item.label }));
}
function renderNav() {
  var box = $('#gameTabs');
  box.innerHTML = '';
  /* Gastspiele vorne und nur, solange sie laufen; das Happy-Hour-Spiel mit Flamme */
  var order = GAMES.filter(function (g) { return V.GAME_BY[g.id].guest && V.gameOpen(g.id); }).concat(GAMES.filter(function (g) { return !V.GAME_BY[g.id].guest; }));
  order.forEach(function (g) {
    var b = railBtn(g, g.id === V.S.game, function () { V.Snd.click(); showGame(g.id); });
    if (V.GAME_BY[g.id].guest) { b.classList.add('guest'); b.title = 'Gastspiel, wechselt alle 6 Stunden'; }
    if (V.rotation.isHappy(g.id)) { b.classList.add('happy'); b.title = 'Happy Hour: +100 % Erfahrung'; }
    if (!V.gameOpen(g.id)) {
      b.classList.add('locked'); b.title = lockedMsg(g.id); b.setAttribute('aria-disabled', 'true');
      b.appendChild(V.el('span', { class: 'lk', html: Icons.lock }));
    }
    box.appendChild(b);
  });
  var more = railBtn({ id: 'more', label: 'Mehr' }, false, function () { V.Snd.click(); openSide(V.guide.tabOpen(V.S.sideTab) ? V.S.sideTab : 'stufen'); });
  more.classList.add('rail-more'); more.removeAttribute('role'); more.removeAttribute('aria-selected');
  box.appendChild(more);
  renderBadges();
  /* Am Handy das aktive Spiel in der wischbaren Leiste sichtbar halten */
  var act = box.querySelector('[aria-selected="true"]');
  if (act && box.scrollWidth > box.clientWidth) box.scrollLeft = Math.max(0, act.offsetLeft - box.clientWidth / 2 + act.offsetWidth / 2);
}
function renderSideNav() {
  SIDE = sideItems();
  var box = $('#sideNav');
  box.innerHTML = '';
  SIDE.forEach(function (t) {
    var b = railBtn(t, false, function () { V.Snd.click(); openSide(t.id); });
    b.removeAttribute('role'); b.removeAttribute('aria-selected');
    b.setAttribute('data-side', t.id);
    box.appendChild(b);
  });
  renderBadges();
}
/* Hinweis-Punkte: Tresor halb voll, Auftrag fertig, Talentpunkt frei */
function renderBadges() {
  if (!V.meta || !$('#sideNav')) return;
  var b = V.meta.badges(), any = false;
  b.arena = V.social.badge();
  SIDE.forEach(function (t) {
    var btn = $('#sideNav [data-side="' + t.id + '"]');
    if (btn) btn.classList.toggle('dot', !!b[t.id]);
    if (b[t.id]) any = true;
  });
  var more = $('#gameTabs .rail-more');
  if (more) more.classList.toggle('dot', any);
}
/* ---------- Tastatur ---------- */
var GLOBAL_KEYS = [['1 – 9, 0', 'Spiel wechseln'], ['Q', 'Quests'], ['P', 'Arena (Duelle und Freunde)'], ['G', 'Talentbaum'], ['I', 'Imperium (nur im Imperium-Modus)'], ['?', 'Diese Hilfe'], ['M', 'Ton an/aus'], ['Esc', 'Fenster schließen']];
function keyList(title, list) {
  var dl = V.el('dl');
  list.forEach(function (k) { dl.appendChild(V.el('dt', {}, V.el('kbd', { text: k[0] }))); dl.appendChild(V.el('dd', { text: k[1] })); });
  return V.el('div', {}, V.el('h3', { text: title }), dl);
}
function openKeys() {
  var body = $('#keysBody');
  body.innerHTML = '';
  body.appendChild(keyList('Überall', GLOBAL_KEYS));
  V.games.forEach(function (g) { if (g.keys) body.appendChild(keyList(V.GAME_NAME[g.id], g.keys)); });
  body.appendChild(V.el('p', { class: 'fine', text: 'Alles geht auch mit Maus oder Finger. Die Kürzel stehen außerdem klein auf den Knöpfen.' }));
  lastFocus = document.activeElement;
  $('#keysDlg').hidden = false;
  $('#keysClose').focus();
}
function closeKeys() { if ($('#keysDlg').hidden) return; $('#keysDlg').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var tag = (e.target && e.target.tagName) || '';
  /* Ein offenes Spielerprofil behandelt seine Tasten selbst */
  if (document.querySelector('.prof-dlg') || document.querySelector('.fs-dlg')) return;
  if (e.key === 'Escape') { closeKeys(); closeSide(); return; }
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
  if (!$('#keysDlg').hidden || !$('#drawer').hidden) { if (e.key === '?') { e.preventDefault(); closeKeys(); } return; }
  /* Enter auf einem fokussierten Knopf bleibt ein normaler Klick; die Leertaste gehört immer dem Spiel */
  if (e.key === 'Enter' && tag === 'BUTTON') return;
  if (e.key === ' ' && tag === 'BUTTON') e.target.blur();
  if (e.key === '?') { e.preventDefault(); openKeys(); return; }
  if (/^[0-9]$/.test(e.key)) { var gi = e.key === '0' ? 9 : Number(e.key) - 1; if (GAMES[gi]) { e.preventDefault(); V.Snd.click(); showGame(GAMES[gi].id); } return; }
  if (e.key === 'm' || e.key === 'M') { $('#sndBtn').click(); return; }
  /* Das Spiel hat Vorrang: Nur Tasten, die es nicht selbst nutzt, öffnen Fenster */
  var g = null;
  V.games.forEach(function (x) { if (x.id === V.S.game) g = x; });
  if (g && g.onKey && g.onKey(e)) { e.preventDefault(); V.Snd.ensure(); return; }
  var SK = { q: 'quests', p: 'arena', g: 'talente' };
  if (V.S.mode === 'empire') SK.i = 'imperium';
  if (SK[e.key.toLowerCase()]) { e.preventDefault(); V.Snd.click(); openSide(SK[e.key.toLowerCase()]); }
}

var lastFocus = null;
function openSide(tab) {
  if (!V.guide.tabOpen(tab)) { V.toast('Das schaltest du bald frei. Spiel einfach weiter!', 'warn'); return; }
  V.S.sideTab = tab;
  V.side.refresh();
  lastFocus = document.activeElement;
  $('#drawer').hidden = false;
  $('#drawerClose').focus();
}
function closeSide() {
  if ($('#drawer').hidden) return;
  $('#drawer').hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  V.save();
}
function syncSound() {
  var b = $('#sndBtn');
  b.setAttribute('aria-pressed', String(V.S.sound));
  b.textContent = V.S.sound ? '🔊' : '🔇';
}
function hardReset() {
  V.resetState();
  location.reload();
}
async function toMenu() {
  if (V.isBusy()) { V.toast('Beende erst die laufende Runde oder nimm deine Chips vom Tisch.', 'bad'); return; }
  V.save();
  if (Store.isAccount()) {
    $('#menuBtn').disabled = true;
    if (!(await Cloud.flush())) V.toast('Konnte nicht mit der Cloud abgleichen, der Stand bleibt auf diesem Gerät gespeichert.', 'warn');
  }
  Store.setActive(null);
  location.reload();
}
/* Einstellungen, die das Aussehen ändern */
function applyPrefs() { document.body.classList.toggle('fx-low', !!V.S.fxLow); }
V.applyPrefs = applyPrefs; V.renderSideNav = renderSideNav;
V.showGame = showGame; V.renderNav = renderNav; V.renderBadges = renderBadges; V.openSide = openSide; V.closeSide = closeSide; V.syncSound = syncSound; V.hardReset = hardReset;

async function startGame(id) {
  /* Mit Konto: vorher den neuesten Stand aus der Cloud holen (offline wird lokal weitergespielt) */
  if (Store.isAccount()) { try { await Cloud.syncAll(); } catch (e) { V.toast('Offline: Du spielst mit dem Stand auf diesem Gerät.', 'warn'); } }
  if (!V.load(id)) { Store.setActive(null); Menu.show(startGame); return; }
  Store.setActive(id);
  await Menu.leave();
  document.body.classList.add('in-game');
  $('#app').hidden = false;
  $('#app').classList.add('entering');
  document.title = V.slotName + ' · Chip Empire';
  $('#playerName').textContent = V.slotName;
  V.devTools.init();
  if (!V.gameOpen(V.S.game)) V.S.game = 'slots';
  V.clampBets();
  V.games.forEach(function (g) { g.init(); });
  V.side.build();
  V.track.init();
  V.legend.init();
  V.session.init();
  renderSideNav();
  $('#drawerClose').addEventListener('click', closeSide);
  $('#drawer').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeSide(); });
  $('#keysBtn').addEventListener('click', openKeys);
  $('#keysClose').addEventListener('click', closeKeys);
  $('#keysDlg').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeKeys(); });
  document.addEventListener('keydown', onKeyDown);
  $('#reload').addEventListener('click', V.walletAction);
  $('#claimComp').addEventListener('click', V.claimComps);
  $('#mastery').addEventListener('click', function () { V.Snd.click(); openSide('meister'); });
  $('#helpBtn').addEventListener('click', function () { V.Snd.click(); V.guide.gameHelp(); });
  $('#tipBtn').addEventListener('click', V.tip);
  $('#chatBtn').addEventListener('click', function () { V.say('chat', true); });
  $('#menuBtn').addEventListener('click', toMenu);
  $('#roomBtn').addEventListener('click', function () { V.Snd.click(); openSide('stufen'); });
  $('#sndBtn').addEventListener('click', function () { V.S.sound = !V.S.sound; syncSound(); V.save(); if (V.S.sound) V.Snd.click(); });
  applyPrefs(); V.guide.apply(); $('#app').classList.toggle('is-dev', V.devTools.on);
  V.renderHost(); V.hud(); V.renderDopa(); syncSound();
  showGame(V.S.game);
  V.tutorial.maybeStart(V.slotId);
  V.say('greet', true);
  V.meta.migrate();
  V.meta.ensureQuests();
  V.guide.init(); renderSideNav();
  V.hud();
  /* Geschenke an alle aus dem Admin-Panel: einmal pro Konto, landen im gerade geöffneten Spielstand */
  if (Store.isAccount() && V.S.mode !== 'sandbox' && !V.isHard()) {
    Cloud.rpc('gift_claim').then(function (gifts) {
      if (!gifts || !gifts.length) return;
      var chips = 0, tp = 0, msg = '';
      gifts.forEach(function (g) { chips += Number(g.chips) || 0; tp += Number(g.tp) || 0; if (g.message) msg = g.message; });
      V.S.balance += chips; V.S.bonusTp += tp;
      V.hud(); V.side.refresh(); V.renderBadges(); V.save();
      setTimeout(function () {
        V.Snd.big();
        V.banner('🎁 Geschenk', [chips ? '+' + V.fmt(chips) + ' Chips' : '', tp ? '+' + tp + ' Talentpunkt' + (tp === 1 ? '' : 'e') : ''].filter(Boolean).join(' und ') + (msg ? '. ' + msg : ''),
          { kind: 'win', ms: 8000 });
      }, 1400);
    }).catch(function () { /* ohne Datenbank-Update oder offline: beim nächsten Start */ });
  }
  /* Nachricht an alle: einmal pro Nachricht beim Spielstart */
  Cloud.announcement().then(function (a) {
    if (!a || Cloud.annSeen(a.id)) return;
    setTimeout(function () { V.banner('📣 Neuigkeiten', a.text, { kind: 'level', ms: 15000, actions: [{ label: 'Alles klar', gold: true, fn: function () { Cloud.annMarkSeen(a.id); } }] }); }, 2600);
  });
  if (V.dailyAvailable()) {
    setTimeout(function () {
      V.banner('Tagesbonus wartet', 'Hol dir deine Chips für heute ab.', { kind: 'level', ms: 12000, actions: [
        { label: 'Abholen', gold: true, fn: V.claimDaily }, { label: 'Später', fn: function () {} }] });
    }, 700);
  }
  var last = Date.now();
  setInterval(function () {
    var now = Date.now(), dt = now - last; last = now;
    V.renderWalletBtn();
    V.meta.tick();
    V.rotation.tick();
    if (now % 5000 < 1000) renderBadges();
    if (!document.hidden && dt < 5000) {
      V.S.playMs += dt;
      V.session.tick(dt);
      V.S.dopa = Math.max(0, V.S.dopa - 0.15);
      V.renderDopa();
      if (Math.floor(V.S.playMs / 1000) % 15 === 0) { V.save(); V.maybeReality(); }
    }
  }, 1000);
  setInterval(function () { if (!V.isBusy() && Math.random() < 0.35) V.say('chat'); }, 45000);
  /* Arena: neue Herausforderungen und Ergebnisse als Hinweis-Punkt */
  V.social.poll(); V.social.startPing();
  setInterval(function () { if (!document.hidden) V.social.poll(); }, 90000);
  /* Freundschaftsanfragen kommen öfter an als Duelle, deshalb eigener, kürzerer Takt */
  setInterval(Friends.poll, 45000);
  /* Erst lokal speichern, dann den Stand noch in die Cloud schicken */
  function leave() { V.save(); Cloud.flushOnLeave(); }
  window.addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
}

/* Neue Version online? Dann eine eigene Leiste oben zeigen, statt Spieler auf altem Code weiterspielen zu lassen.
   Bewusst nicht das normale Banner: Das ersetzt jeder Gewinn nach ein paar Sekunden. Geprüft wird beim Start,
   alle 3 Minuten und jedes Mal, wenn man die App (am Handy) wieder in den Vordergrund holt. */
var updateBar = null, snoozeUntil = 0, lastCheck = 0;
function myVersion() {
  var s = document.querySelector('script[src*="main.js?v="]'), m = s && /v=(\d+)/.exec(s.getAttribute('src'));
  return m ? m[1] : null;
}
function reloadTo(v) {
  if (V.isBusy()) { V.toast('Beende erst die laufende Runde, dann lade neu.', 'bad'); return; }
  V.save();
  /* Neue Adresse statt reload(): sonst kann der Browser die alte index.html aus dem Zwischenspeicher nehmen */
  var go = function () { location.replace(location.pathname + '?v=' + v); };
  Cloud.flush().then(go, go);
}
function showUpdate(v) {
  if (updateBar || Date.now() < snoozeUntil) return;
  updateBar = V.el('div', { class: 'upd-bar', role: 'status' },
    V.el('span', { class: 'upd-ico', text: '✨' }),
    V.el('span', { class: 'upd-txt' }, V.el('b', { text: 'Neue Version da' }), V.el('small', { text: 'Neu laden holt die neuesten Funktionen. Dein Spielstand bleibt.' })),
    V.el('button', { class: 'btn gold sm', type: 'button', text: 'Neu laden', onclick: function () { reloadTo(v); } }),
    V.el('button', { class: 'icon-btn upd-x', type: 'button', 'aria-label': 'Später', title: 'Später', text: '✕', onclick: function () {
      snoozeUntil = Date.now() + 20 * 60 * 1000; if (updateBar) updateBar.remove(); updateBar = null;
    } }));
  document.body.appendChild(updateBar);
}
function checkUpdate() {
  if (document.hidden || updateBar || Date.now() - lastCheck < 30000) return;
  lastCheck = Date.now();
  fetch('index.html?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
    var m = /main\.js\?v=(\d+)/.exec(t), mine = myVersion();
    if (m && mine && Number(m[1]) > Number(mine)) showUpdate(m[1]);
  }).catch(function () { /* offline: beim nächsten Mal */ });
}

async function init() {
  setInterval(checkUpdate, 3 * 60 * 1000);
  setTimeout(checkUpdate, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkUpdate(); });
  window.addEventListener('focus', checkUpdate);
  var u = await Cloud.init();
  Store.useAccount(u ? u.id : null);
  var id = Store.active();
  if (id && Store.get(id)) startGame(id);
  else Menu.show(startGame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
