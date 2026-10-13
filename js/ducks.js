/* Chip Empire – Entenrennen: fünf Enten, Quoten vom Favoriten bis zum Außenseiter */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;

var DUCKS = [
  { name: 'Quaki', color: '#F2C94C' }, { name: 'Watschel', color: '#6FD3A2' }, { name: 'Flitzer', color: '#7FB8FF' },
  { name: 'Gummi-Gustav', color: '#FF8A9C' }, { name: 'Sir Schnatter', color: '#C59BFF' }
];
/* Gesamtrückgabe pro Ente; Gewinnwahrscheinlichkeit = (1/Quote) / Summe aller (1/Quote) → ca. 96,6 % */
var ODDS = [2.6, 3.6, 5.2, 8.5, 16];
var INV = ODDS.reduce(function (s, o) { return s + 1 / o; }, 0);

var root, table, lanes = [], tiles = [], raceBtn, msgEl, histEl, odds = [], racing = false, hist = [];

function newOdds() {
  odds = E.shuffle(ODDS.slice());
  renderOdds();
}
/* Quoten-Anzeige (berücksichtigt Talente) */
function renderOdds() {
  DUCKS.forEach(function (d, i) {
    var t = tiles[i]; if (!t) return;
    t.querySelector('.q').textContent = String(payOdds(odds[i])).replace('.', ',') + '×';
    t.querySelector('.p').textContent = Math.round(100 / odds[i] / INV) + ' % Chance';
    t.classList.toggle('fav', odds[i] === ODDS[0]);
    t.classList.toggle('dog', odds[i] === ODDS[ODDS.length - 1]);
  });
}

function build() {
  root = V.$('#g-ducks');
  table = V.chipBets({ onRender: renderTiles });
  var track = el('div', { class: 'track' }, el('div', { class: 'finish', 'aria-hidden': 'true' }));
  DUCKS.forEach(function (d, i) {
    var duck = el('span', { class: 'duck', text: '🦆' });
    var lane = el('div', { class: 'lane' }, el('span', { class: 'lane-no', text: String(i + 1) }), duck, el('span', { class: 'place' }));
    lane.style.setProperty('--dc', d.color);
    lanes.push({ lane: lane, duck: duck, place: lane.querySelector('.place') });
    track.appendChild(lane);
  });
  var grid = el('div', { class: 'duck-bets' });
  DUCKS.forEach(function (d, i) {
    var t = el('button', { class: 'duck-bet', type: 'button', onclick: function () { table.place('d' + i); } },
      el('span', { class: 'dot' }), el('b', { text: d.name }), el('span', { class: 'q' }), el('small', { class: 'p' }), el('span', { class: 'rchip', hidden: true }));
    t.style.setProperty('--dc', d.color);
    tiles.push(t); grid.appendChild(t);
  });
  histEl = el('div', { class: 'fw-hist', 'aria-label': 'Letzte Sieger' });
  raceBtn = el('button', { class: 'btn gold big', type: 'button', onclick: race }, 'Rennen starten', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Setz auf eine oder mehrere Enten. Je höher die Quote, desto seltener gewinnt die Ente.' });
  root.appendChild(track);
  root.appendChild(histEl);
  root.appendChild(el('div', { class: 'duck-ctl' }, grid, table.controls(), raceBtn, msgEl));
  root.appendChild(el('p', { class: 'fine', text: 'Vor jedem Rennen werden die Quoten neu verteilt. Die Chance einer Ente passt immer zu ihrer Quote, Auszahlungsquote etwa 97 %.' }));
  V.busyFns.push(function () { return racing || table.total() > 0; });
  newOdds();
  renderTiles(table.bets(), false);
}

function renderTiles(bets, locked) {
  tiles.forEach(function (t, i) {
    var amt = bets['d' + i] || 0, ch = t.querySelector('.rchip');
    ch.hidden = amt <= 0; ch.textContent = amt > 0 ? V.short(amt) : '';
    t.classList.toggle('has', amt > 0);
    t.disabled = locked;
  });
  if (raceBtn) raceBtn.disabled = locked || table.total() <= 0;
}
function renderHist() {
  histEl.innerHTML = '';
  hist.slice(-10).reverse().forEach(function (h) { var s = el('span', { text: DUCKS[h.i].name + ' ' + String(h.o).replace('.', ',') + '×' }); s.style.background = DUCKS[h.i].color; histEl.appendChild(s); });
}

/* Talent Wettprofi: Außenseiter ab 8× zahlen etwas mehr */
function payOdds(o) { return o >= 8 ? Math.round(o * (1 + V.meta.perk('duckPro')) * 100) / 100 : o; }
function pickWinner() {
  var r = E.rand() * INV, acc = 0;
  for (var i = 0; i < odds.length; i++) { acc += 1 / odds[i]; if (r < acc) return i; }
  return odds.length - 1;
}

/* Rennen: Sieger steht vorher fest; jede Ente bekommt eine Zielzeit, der Sieger die kürzeste */
function run(winner) {
  return new Promise(function (resolve) {
    var T = 4200, fin = DUCKS.map(function (d, i) { return i === winner ? T : T * (1.03 + E.rand() * 0.22); });
    var phase = DUCKS.map(function () { return E.rand() * 6; }), surge = DUCKS.map(function () { return 0.6 + E.rand() * 0.8; });
    var order = fin.map(function (f, i) { return i; }).sort(function (a, b) { return fin[a] - fin[b]; });
    var t0 = performance.now(), lastTick = 0;
    (function step(now) {
      var t = now - t0, done = true;
      lanes.forEach(function (L, i) {
        var k = Math.min(1, t / fin[i]);
        /* leichtes Hin und Her im Rennen, das zum Ziel hin ausläuft */
        var x = k + Math.sin(t / 420 * surge[i] + phase[i]) * 0.035 * (1 - k) * Math.min(1, k * 6);
        L.duck.style.left = 'calc((100% - 78px) * ' + Math.max(0, Math.min(1, x)).toFixed(4) + ' + 30px)';
        L.duck.classList.toggle('paddle', k < 1);
        if (k < 1) done = false;
      });
      if (now - lastTick > 160) { V.Snd.tick(); lastTick = now; }
      if (!done) V.frame(step); else resolve(order);
    })(t0);
  });
}

async function race() {
  if (racing) return;
  var bets = table.commit();
  if (!bets) return;
  V.Snd.ensure();
  racing = true;
  lanes.forEach(function (L) { L.place.textContent = ''; L.lane.classList.remove('win'); L.duck.style.left = '30px'; });
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Und los!';
  var winner = pickWinner();
  var order = await run(winner);
  order.forEach(function (i, p) { lanes[i].place.textContent = (p + 1) + '.'; });
  lanes[winner].lane.classList.add('win');
  var o = odds[winner], stake = 0, ret = 0;
  for (var k in bets) { stake += bets[k]; if (k === 'd' + winner) ret += V.payout(bets[k], payOdds(o)); }
  hist.push({ i: winner, o: o }); renderHist();
  V.settle('ducks', stake, ret, { duckOdds: ret > 0 ? o : 0 });
  var net = ret - stake;
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = DUCKS[winner].name + ' gewinnt (Quote ' + String(o).replace('.', ',') + '×). ' + (ret > 0 ? 'Zurück: ' + fmt(ret) + ' Chips (' + (net >= 0 ? '+' : '') + fmt(net) + ')' : 'Deine Ente war nicht schnell genug, ' + fmt(stake) + ' Chips gehen ans Haus.');
  if (ret > 0 && o >= 8) { V.Snd.big(); V.burst(V.$('#g-ducks .track'), 30); V.banner('Außenseiter-Sieg!', '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2400 }); }
  else if (net > 0) V.Snd.win(); else V.Snd.lose();
  await sleep(1600);
  racing = false;
  table.reset();
  newOdds();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { race(); return true; }
  return racing ? false : table.onKey(k);
}

V.games.push({
  id: 'ducks', init: build, onKey: onKey, onShow: function () { if (!racing) renderOdds(); },
  keys: [['Leertaste', 'Rennen starten'], ['Maus', 'Auf Enten setzen'], ['← / →', 'Chipwert wählen'], ['⌫ / L / W / D', 'Zurück, Leeren, Wiederholen, Verdoppeln']],
  onRoom: function () { table.render(); }, refresh: function () { table.render(); }
});
})();
