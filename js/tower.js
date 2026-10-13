/* Chip Empire – Dragon Tower: Etage für Etage ein Feld wählen, unter manchen schläft ein Drache */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var FLOORS = 9, RTP = 0.97;
var DIFF = {
  easy: { name: 'Leicht', tiles: 4, dragons: 1 },
  mid: { name: 'Mittel', tiles: 3, dragons: 1 },
  hard: { name: 'Schwer', tiles: 2, dragons: 1 },
  expert: { name: 'Extrem', tiles: 3, dragons: 2 }
};
var KEYS = ['a', 's', 'd', 'f'];
/* Multiplikator nach k geschafften Etagen: fair geteilt durch die Überlebenschance, mal 97 % */
/* Talent Drachenschuppen erhöht die Quote leicht */
function multAt(diff, k) { var D = DIFF[diff], p = (D.tiles - D.dragons) / D.tiles; return k ? Math.floor((RTP + V.meta.perk('towerScale')) / Math.pow(p, k) * 100) / 100 : 0; }

var root, towerEl, floorEls = [], bet, goBtn, diffBtns = {}, msgEl;
var run = null; /* { diff, bet, floor, dragons: [[...]], picks: [] } */

function build() {
  root = V.$('#g-tower');
  towerEl = el('div', { class: 'tower' });
  bet = V.betControl('tower');
  var dsel = el('div', { class: 'qseg', role: 'radiogroup', 'aria-label': 'Schwierigkeit' });
  Object.keys(DIFF).forEach(function (k) {
    diffBtns[k] = el('button', { type: 'button', role: 'radio', onclick: function () { setDiff(k); } }, DIFF[k].name);
    dsel.appendChild(diffBtns[k]);
  });
  goBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onGo }, el('span'), V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite' });
  root.appendChild(el('div', { class: 'tw-layout' }, towerEl,
    el('div', { class: 'tw-side' }, el('span', { class: 'lbl', text: 'Schwierigkeit' }), dsel, bet.el, goBtn, msgEl,
      el('p', { class: 'fine', text: 'Wähle pro Etage ein Feld. Ist es sicher, steigst du auf und der Multiplikator wächst. Erwischst du einen Drachen, ist der Einsatz weg. Auszahlen kannst du jederzeit. Auszahlungsquote 97 %.' }))));
  V.busyFns.push(function () { return !!run; });
  setDiff(V.S.towerDiff || 'mid', true);
}

function setDiff(k, quiet) {
  if (run) return;
  V.S.towerDiff = k;
  Object.keys(diffBtns).forEach(function (x) { diffBtns[x].setAttribute('aria-selected', String(x === k)); diffBtns[x].setAttribute('aria-checked', String(x === k)); });
  renderTower();
  if (!quiet) { V.Snd.click(); V.save(); }
}

function renderTower(reveal) {
  var diff = run ? run.diff : (V.S.towerDiff || 'mid'), D = DIFF[diff];
  towerEl.innerHTML = ''; floorEls = [];
  towerEl.style.setProperty('--tiles', D.tiles);
  for (var f = FLOORS - 1; f >= 0; f--) (function (f) {
    var cur = run && run.floor === f && !run.over, done = run && f < run.floor;
    var row = el('div', { class: 'tw-floor' + (cur ? ' cur' : '') + (done ? ' done' : '') });
    var tiles = el('div', { class: 'tw-tiles' });
    for (var t = 0; t < D.tiles; t++) (function (t) {
      var picked = run && run.picks[f] === t, dragon = run && run.dragons[f].indexOf(t) >= 0;
      var show = run && (f < run.floor || (reveal && f === run.floor) || (run.over && f <= run.floor));
      var cls = 'tw-tile' + (picked ? ' picked' : '') + (show ? (dragon ? ' dragon' : ' safe') : '');
      var b = el('button', { class: cls, type: 'button', disabled: !cur, 'aria-label': 'Etage ' + (f + 1) + ', Feld ' + (t + 1),
        onclick: function () { pick(t); } }, show ? (dragon ? '🐉' : '💎') : (cur ? V.kbd(KEYS[t].toUpperCase()) : ''));
      tiles.appendChild(b);
    })(t);
    row.appendChild(el('span', { class: 'tw-no', text: String(f + 1) }));
    row.appendChild(tiles);
    row.appendChild(el('span', { class: 'tw-mult', text: V.fmtX(multAt(diff, f + 1)) }));
    floorEls[f] = row;
    towerEl.appendChild(row);
  })(f);
  renderBtn();
}

function renderBtn() {
  var lb = goBtn.firstChild;
  if (!run) {
    lb.textContent = 'Turm betreten · ' + fmt(V.S.bets.tower); goBtn.classList.remove('cash'); goBtn.disabled = false;
    msgEl.textContent = msgEl.textContent || 'Wähle Schwierigkeit und Einsatz.';
  } else if (run.floor === 0) {
    lb.textContent = 'Wähle ein Feld in Etage 1'; goBtn.disabled = true; goBtn.classList.remove('cash');
  } else {
    lb.textContent = 'Auszahlen · ' + fmt(V.payout(run.bet, multAt(run.diff, run.floor))); goBtn.disabled = false; goBtn.classList.add('cash');
  }
  bet.disable(!!run);
  Object.keys(diffBtns).forEach(function (k) { diffBtns[k].disabled = !!run; });
}

function start() {
  var S = V.S, b0 = S.bets.tower, diff = S.towerDiff || 'mid', D = DIFF[diff];
  if (S.balance < b0) { V.needChips(); return; }
  V.Snd.ensure();
  V.debit(b0, true); V.hud();
  var dragons = [];
  for (var f = 0; f < FLOORS; f++) dragons.push(E.shuffle(Array.apply(null, { length: D.tiles }).map(function (x, i) { return i; })).slice(0, D.dragons));
  run = { diff: diff, bet: b0, floor: 0, dragons: dragons, picks: [], over: false };
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Etage 1: Welches Feld ist sicher?';
  V.Snd.click();
  renderTower();
}

async function pick(t) {
  if (!run || run.over) return;
  var f = run.floor;
  run.picks[f] = t;
  if (run.dragons[f].indexOf(t) >= 0) {
    run.over = true;
    V.Snd.crash();
    renderTower(true);
    floorEls[f].classList.add('burn');
    V.settle('tower', run.bet, 0, { towerFloors: f });
    msgEl.className = 'slot-msg'; msgEl.textContent = 'Ein Drache! In Etage ' + (f + 1) + ' war Schluss, ' + fmt(run.bet) + ' Chips gehen ans Haus.';
    await sleep(1600);
    run = null; renderTower();
    return;
  }
  run.floor++;
  V.Snd.card();
  if (run.floor >= FLOORS) { await cashout(true); return; }
  msgEl.className = 'slot-msg win';
  msgEl.textContent = 'Sicher! Etage ' + run.floor + ' geschafft: ' + V.fmtX(multAt(run.diff, run.floor)) + '. Weiter oder auszahlen?';
  renderTower();
}

async function cashout(top) {
  if (!run || run.floor === 0 || run.over) return;
  var m = multAt(run.diff, run.floor), ret = V.payout(run.bet, m), net = ret - run.bet, floors = run.floor;
  run.over = true;
  renderTower(true);
  V.settle('tower', run.bet, ret, { towerFloors: floors });
  msgEl.className = 'slot-msg win';
  msgEl.textContent = (top ? 'Ganz oben! Der Turm ist bezwungen. ' : 'Ausgezahlt nach Etage ' + floors + '. ') + V.fmtX(m) + ': +' + fmt(net) + ' Chips';
  if (top || m >= 10) { V.Snd.big(); V.burst(V.$('#g-tower .tower'), 36); V.banner(top ? 'Turm bezwungen!' : V.fmtX(m), '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2600 }); }
  else V.Snd.cash();
  await sleep(1400);
  run = null; renderTower();
}

function onGo() { if (!run) start(); else cashout(false); }

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { onGo(); return true; }
  var i = KEYS.indexOf(k);
  if (i >= 0 && run && !run.over && i < DIFF[run.diff].tiles) { pick(i); return true; }
  if ((k === 'arrowup' || k === '+') && !run) { bet.step(1); return true; }
  if ((k === 'arrowdown' || k === '-') && !run) { bet.step(-1); return true; }
  return false;
}

V.games.push({
  id: 'tower', init: build, onKey: onKey,
  keys: [['Leertaste', 'Turm betreten / Auszahlen'], ['A S D F', 'Feld 1 bis 4 wählen'], ['↑ / ↓', 'Einsatz ändern']],
  onRoom: function () { bet.render(); renderBtn(); }, refresh: function () { if (!run) { bet.render(); renderBtn(); } }
});
})();
