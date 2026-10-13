/* Chip Empire – Start, Navigation, Spielzeit */
(function () {
'use strict';
var $ = V.$, $$ = V.$$;
var GAMES = [{ id: 'slots', label: 'Slots' }, { id: 'roulette', label: 'Roulette' }, { id: 'bj', label: 'Blackjack' }, { id: 'crash', label: 'Crash' }];

function showGame(id) {
  var S = V.S;
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
  V.tabs($('#gameTabs'), GAMES, V.S.game, function (id) { V.Snd.click(); showGame(id); });
}
function syncSound() {
  var b = $('#sndBtn');
  b.setAttribute('aria-pressed', String(V.S.sound));
  b.textContent = V.S.sound ? '🔊' : '🔇';
}
function hardReset() {
  try { localStorage.removeItem('velvet-room-v1'); } catch (e) { /* */ }
  location.reload();
}
V.showGame = showGame; V.syncSound = syncSound; V.hardReset = hardReset;

function init() {
  V.load();
  V.clampBets();
  V.games.forEach(function (g) { g.init(); });
  V.side.build();
  $('#reload').addEventListener('click', V.reload);
  $('#claimComp').addEventListener('click', V.claimComps);
  $('#tipBtn').addEventListener('click', V.tip);
  $('#chatBtn').addEventListener('click', function () { V.say('chat', true); });
  $('#roomSel').addEventListener('change', function (e) { if (!V.enterRoom(Number(e.target.value))) V.renderTier(); });
  $('#sndBtn').addEventListener('click', function () { V.S.sound = !V.S.sound; syncSound(); V.save(); if (V.S.sound) V.Snd.click(); });
  V.renderHost(); V.hud(); V.renderDopa(); syncSound();
  showGame(V.S.game);
  V.say('greet', true);
  var last = Date.now();
  setInterval(function () {
    var now = Date.now(), dt = now - last; last = now;
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
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
