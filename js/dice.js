/* Chip Empire – Würfel: zwei Würfel, Wetten auf Unter/Über 7, Pasch oder eine genaue Summe */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;

/* Auszahlung als Gesamtrückgabe (Einsatz eingeschlossen); Quote je Feld 92–96 % */
var WAYS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
/* Genaue Summen zahlen etwas weniger, dafür lädt vor jedem Wurf ein Blitz eine Summe mit ×2, ×3 oder ×5 auf */
var SUM_PAY = { 2: 29.6, 3: 14.8, 4: 9.6, 5: 7.4, 6: 5.9, 7: 4.9, 8: 5.9, 9: 7.4, 10: 9.6, 11: 14.8, 12: 29.6 };
var BOOST = [[2, 60], [3, 30], [5, 10]], boost = { sum: 0, m: 1 };
var MAIN = [
  { key: 'under', label: 'Unter 7', sub: 'Summe 2 bis 6', pay: 2.3 },
  { key: 'double', label: 'Pasch', sub: 'Zwei gleiche', pay: 5.7 },
  { key: 'over', label: 'Über 7', sub: 'Summe 8 bis 12', pay: 2.3 }
];
function payFor(key) {
  if (key.charAt(0) === 's') { var n = Number(key.slice(1)); return Math.round(SUM_PAY[n] * (boost.sum === n ? boost.m : 1) * 10) / 10; }
  /* Talent Glückswürfel: Pasch zahlt mehr */
  if (key === 'double') return 5.7 + V.meta.perk('diceDouble');
  for (var i = 0; i < MAIN.length; i++) if (MAIN[i].key === key) return MAIN[i].pay;
  return 0;
}
function wins(key, a, b) {
  var s = a + b;
  if (key === 'under') return s < 7;
  if (key === 'over') return s > 7;
  if (key === 'double') return a === b;
  return Number(key.slice(1)) === s;
}

var root, table, cells = {}, dieEls = [], rollBtn, msgEl, histEl, sumEl;
var rolling = false, hist = [];

/* Würfelseite als 3×3-Raster mit Augen */
var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function face(die, n) {
  die.innerHTML = '';
  for (var i = 0; i < 9; i++) die.appendChild(el('i', { class: PIPS[n].indexOf(i) >= 0 ? 'on' : '' }));
  die.setAttribute('aria-label', 'Würfel zeigt ' + n);
}

function build() {
  root = V.$('#g-dice');
  table = V.chipBets({ onRender: renderCells });
  dieEls = [el('div', { class: 'die', role: 'img' }), el('div', { class: 'die', role: 'img' })];
  face(dieEls[0], 3); face(dieEls[1], 4);
  sumEl = el('div', { class: 'dice-sum', text: 'Summe ?' });
  histEl = el('div', { class: 'fw-hist', 'aria-label': 'Letzte Würfe' });
  var tray = el('div', { class: 'dice-tray' }, el('div', { class: 'dice-pair' }, dieEls[0], dieEls[1]), sumEl, histEl);

  var main = el('div', { class: 'dice-main' });
  MAIN.forEach(function (m) {
    var c = el('button', { class: 'dcell big', type: 'button', onclick: function () { table.place(m.key); } },
      el('b', { text: m.label }), el('small', { text: m.sub }), el('span', { class: 'pay', text: 'zahlt ' + String(m.pay).replace('.', ',') + '×' }), el('span', { class: 'rchip', hidden: true }));
    cells[m.key] = c; main.appendChild(c);
  });
  var sums = el('div', { class: 'dice-sums' });
  for (var s = 2; s <= 12; s++) (function (s) {
    var c = el('button', { class: 'dcell', type: 'button', 'data-sum': String(s), onclick: function () { table.place('s' + s); } },
      el('b', { text: String(s) }), el('span', { class: 'pay', text: String(SUM_PAY[s]).replace('.', ',') + '×' }), el('span', { class: 'rchip', hidden: true }));
    cells['s' + s] = c; sums.appendChild(c);
  })(s);
  var felt = el('div', { class: 'dice-felt' }, main, el('div', { class: 'lbl dice-lbl', text: 'Genaue Summe' }), sums);

  rollBtn = el('button', { class: 'btn gold big', type: 'button', onclick: roll }, 'Würfeln', V.kbd('Leertaste'));
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Setz Chips auf Unter 7, Pasch, Über 7 oder eine genaue Summe. Mehrere Felder gleichzeitig gehen auch.' });
  root.appendChild(el('div', { class: 'dice-layout' }, tray, el('div', { class: 'dice-right' }, felt, table.controls(), rollBtn, msgEl)));
  root.appendChild(el('p', { class: 'fine', text: 'Zwei faire Würfel. Eine 7 ist am häufigsten (6 von 36 Würfen), 2 und 12 am seltensten (je 1 von 36). Vor jedem Wurf lädt ein Blitz eine genaue Summe mit ×2, ×3 oder ×5 auf. Auszahlungsquote je Feld 92 bis 96 %.' }));
  V.busyFns.push(function () { return rolling || table.total() > 0; });
  renderCells(table.bets(), false);
}

function renderCells(bets, locked) {
  for (var k in cells) {
    var c = cells[k], amt = bets[k] || 0, ch = c.querySelector('.rchip');
    if (k === 'double') c.querySelector('.pay').textContent = 'zahlt ' + String(payFor('double')).replace('.', ',') + '×';
    ch.hidden = amt <= 0; ch.textContent = amt > 0 ? V.short(amt) : '';
    c.classList.toggle('has', amt > 0);
    c.disabled = locked;
  }
  if (rollBtn) rollBtn.disabled = locked || table.total() <= 0;
}
function renderHist() {
  histEl.innerHTML = '';
  hist.slice(-12).reverse().forEach(function (h) { histEl.appendChild(el('span', { class: h[0] === h[1] ? 'dbl' : '', text: String(h[0] + h[1]) })); });
}

async function roll() {
  if (rolling) return;
  var bets = table.commit();
  if (!bets) return;
  V.Snd.ensure();
  rolling = true;
  var a = E.randInt(6) + 1, b = E.randInt(6) + 1;
  /* Blitz-Summe vor dem Wurf */
  boost = { sum: 2 + E.randInt(11), m: V.pickW(BOOST) };
  var bc = cells['s' + boost.sum];
  bc.classList.add('bolt'); bc.querySelector('.pay').textContent = payFor('s' + boost.sum).toString().replace('.', ',') + '×';
  bc.appendChild(el('span', { class: 'bolt-x', text: '×' + boost.m }));
  V.Snd.zap();
  msgEl.className = 'slot-msg'; msgEl.textContent = '⚡ Blitz auf Summe ' + boost.sum + ': zahlt jetzt ' + payFor('s' + boost.sum).toString().replace('.', ',') + '×';
  await sleep(700);
  msgEl.className = 'slot-msg'; msgEl.textContent = 'Die Würfel rollen …';
  dieEls.forEach(function (d) { d.classList.remove('land'); d.classList.add('rolling'); });
  for (var i = 0; i < 12; i++) {
    face(dieEls[0], E.randInt(6) + 1); face(dieEls[1], E.randInt(6) + 1);
    V.Snd.tick();
    await sleep(60 + i * 9);
  }
  face(dieEls[0], a); face(dieEls[1], b);
  dieEls.forEach(function (d) { d.classList.remove('rolling'); d.classList.add('land'); });
  V.Snd.card();
  var s = a + b, stake = 0, ret = 0, won = [];
  for (var k in bets) { stake += bets[k]; if (wins(k, a, b)) { ret += V.payout(bets[k], payFor(k)); won.push(k); } }
  sumEl.textContent = 'Summe ' + s + (a === b ? ' · Pasch!' : '');
  hist.push([a, b]); renderHist();
  won.forEach(function (k) { cells[k].classList.add('won'); });
  var boltWin = won.indexOf('s' + boost.sum) >= 0;
  V.settle('dice', stake, ret, { diceSum: s, doubles: a === b, doubleWin: won.indexOf('double') >= 0, exactWin: won.some(function (k) { return k.charAt(0) === 's'; }) });
  var net = ret - stake;
  msgEl.className = 'slot-msg ' + (net > 0 ? 'win' : '');
  msgEl.textContent = 'Gewürfelt: ' + a + ' + ' + b + ' = ' + s + '. ' + (ret > 0 ? 'Zurück: ' + fmt(ret) + ' Chips (' + (net >= 0 ? '+' : '') + fmt(net) + ')' : 'Kein Treffer, ' + fmt(stake) + ' Chips gehen ans Haus.');
  if (boltWin) { V.Snd.zap(); V.fx('bolt', '⚡ BLITZ-TREFFER ⚡', 'Summe ' + s + ' ×' + boost.m + ' · +' + fmt(net) + ' Chips', 2800); V.burst(V.$('#g-dice .dice-tray'), 50, ['#FFF', '#9AD8FF', '#F2D68E']); }
  else if (ret >= stake * 8 && ret > 0) { V.Snd.big(); V.burst(V.$('#g-dice .dice-tray'), 26); V.banner('Volltreffer!', '+' + fmt(net) + ' Chips', { kind: 'win', ms: 2200 }); }
  else if (net > 0) V.Snd.win(); else V.Snd.lose();
  await sleep(1300);
  won.forEach(function (k) { cells[k].classList.remove('won'); });
  var oc = cells['s' + boost.sum]; oc.classList.remove('bolt'); var ox = oc.querySelector('.bolt-x'); if (ox) oc.removeChild(ox);
  boost = { sum: 0, m: 1 }; oc.querySelector('.pay').textContent = String(SUM_PAY[Number(oc.dataset.sum)]).replace('.', ',') + '×';
  rolling = false;
  table.reset();
}

function onKey(e) {
  var k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { roll(); return true; }
  return rolling ? false : table.onKey(k);
}

V.games.push({
  id: 'dice', init: build, onKey: onKey, onShow: function () { table.render(); },
  keys: [['Leertaste', 'Würfeln'], ['Maus', 'Chips auf Felder setzen'], ['← / →', 'Chipwert wählen'], ['⌫ / L / W / D', 'Zurück, Leeren, Wiederholen, Verdoppeln']],
  onRoom: function () { table.render(); }, refresh: function () { table.render(); }
});
})();
