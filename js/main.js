/* Chip Empire – Start, Navigation, Spielzeit */
(function () {
'use strict';
var $ = V.$, $$ = V.$$;
var GAMES = [{ id: 'slots', label: 'Slots' }, { id: 'roulette', label: 'Roulette' }, { id: 'bj', label: 'Blackjack' }, { id: 'crash', label: 'Crash' }];

function lockedMsg(id) {
  return V.GAME_NAME[id] + ' wird in der ' + V.E.TIERS[V.GAME_TIER[id]].name + ' freigeschaltet.';
}
function showGame(id) {
  var S = V.S;
  if (!V.gameOpen(id)) { V.toast(lockedMsg(id), 'bad'); renderNav(); return; }
  if (id !== S.game && V.isBusy()) {
    V.toast('Beende erst die laufende Runde oder nimm deine Chips vom Tisch.', 'bad'); renderNav(); return;
  }
  S.game = id;
  GAMES.forEach(function (g2) { $('#g-' + g2.id).hidden = g2.id !== id; });
  renderNav();
  V.games.forEach(function (g3) { if (g3.id === id && g3.onShow) g3.onShow(); });
  V.save();
}
function renderNav() {
  var btns = V.tabs($('#gameTabs'), GAMES, V.S.game, function (id) { V.Snd.click(); showGame(id); });
  btns.forEach(function (b, i) {
    var id = GAMES[i].id;
    if (V.gameOpen(id)) return;
    b.classList.add('locked');
    b.textContent = '🔒 ' + GAMES[i].label;
    b.title = lockedMsg(id);
  });
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
function toMenu() {
  if (V.isBusy()) { V.toast('Beende erst die laufende Runde oder nimm deine Chips vom Tisch.', 'bad'); return; }
  V.save();
  Store.setActive(null);
  location.reload();
}
V.showGame = showGame; V.renderNav = renderNav; V.syncSound = syncSound; V.hardReset = hardReset;

function startGame(id) {
  if (!V.load(id)) { Store.setActive(null); Menu.show(startGame); return; }
  Store.setActive(id);
  Menu.hide();
  $('#app').hidden = false;
  document.title = V.slotName + ' · Chip Empire';
  if (!V.gameOpen(V.S.game)) V.S.game = 'slots';
  V.clampBets();
  V.games.forEach(function (g) { g.init(); });
  V.side.build();
  $('#reload').addEventListener('click', V.walletAction);
  $('#claimComp').addEventListener('click', V.claimComps);
  $('#tipBtn').addEventListener('click', V.tip);
  $('#chatBtn').addEventListener('click', function () { V.say('chat', true); });
  $('#menuBtn').addEventListener('click', toMenu);
  $('#roomSel').addEventListener('change', function (e) { if (!V.enterRoom(Number(e.target.value))) V.renderTier(); });
  $('#sndBtn').addEventListener('click', function () { V.S.sound = !V.S.sound; syncSound(); V.save(); if (V.S.sound) V.Snd.click(); });
  V.renderHost(); V.hud(); V.renderDopa(); syncSound();
  showGame(V.S.game);
  V.say('greet', true);
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
    if (!document.hidden && dt < 5000) {
      V.S.playMs += dt;
      V.S.dopa = Math.max(0, V.S.dopa - 0.15);
      V.renderDopa();
      if (Math.floor(V.S.playMs / 1000) % 15 === 0) { V.save(); V.maybeReality(); }
    }
  }, 1000);
  setInterval(function () { if (!V.isBusy() && Math.random() < 0.35) V.say('chat'); }, 45000);
  window.addEventListener('pagehide', V.save);
}

function init() {
  var id = Store.active();
  if (id && Store.get(id)) startGame(id);
  else Menu.show(startGame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
