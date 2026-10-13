/* Chip Empire – Slots "Golden Velvet" */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var SYM = E.SYM;

var NAMES = ['10', 'J', 'Q', 'K', 'A', 'Diamant', 'BAR', 'Sieben', 'Wild', 'Bonus'];
function symHTML(id) {
  switch (id) {
    case 0: case 1: case 2: case 3: case 4:
      return '<span class="s s-rank rk' + id + '">' + NAMES[id] + '</span>';
    case 5:
      return '<svg class="s s-gem" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 L34 14 L20 36 L6 14 Z" fill="#4DB6C4" stroke="#E9FFFB" stroke-width="1.2"/><path d="M6 14 L14 14 L20 36 Z M20 4 L26 14 L14 14 Z" fill="#C8F6F2" opacity=".75"/><path d="M6 14 L34 14 M14 14 L20 4 L26 14 M14 14 L20 36 L26 14" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1"/></svg>';
    case 6:
      return '<span class="s s-bar">BAR</span>';
    case 7:
      return '<span class="s s-seven">7</span>';
    case 8:
      return '<span class="s s-wild"><i>WILD</i></span>';
    case 9:
      return '<svg class="s s-scat" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#8E0E2B" stroke="#F2D68E" stroke-width="2.4"/><circle cx="20" cy="20" r="11.5" fill="none" stroke="#F2D68E" stroke-width="1.2" stroke-dasharray="3 3"/><text x="20" y="23.4" text-anchor="middle" font-family="Figtree,sans-serif" font-weight="800" font-size="8.4" fill="#F2D68E">BONUS</text></svg>';
  }
  return '';
}

var root, reels = [], cells = [], linesSvg, msg, spinBtn, bet, freeBanner, turboBtn, resumeNote;
var spinning = false, turbo = false, freeRunning = false, lastResult = null;

function build() {
  root = V.$('#g-slots');
  var wrap = el('div', { class: 'reels-wrap' });
  var rl = el('div', { class: 'reels' });
  for (var r = 0; r < 5; r++) {
    var reel = el('div', { class: 'reel' });
    var cs = [];
    for (var row = 0; row < 3; row++) {
      var c = el('div', { class: 'cell' });
      c.innerHTML = symHTML(E.SLOT_STRIPS[r][row]);
      reel.appendChild(c); cs.push(c);
    }
    reels.push(reel); cells.push(cs); rl.appendChild(reel);
  }
  linesSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  linesSvg.setAttribute('class', 'lines');
  linesSvg.setAttribute('viewBox', '0 0 100 100');
  linesSvg.setAttribute('preserveAspectRatio', 'none');
  linesSvg.setAttribute('aria-hidden', 'true');
  wrap.appendChild(rl); wrap.appendChild(linesSvg);
  freeBanner = el('div', { class: 'free-banner', hidden: true });
  wrap.appendChild(freeBanner);
  msg = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Drei gleiche Symbole von links nach rechts gewinnen. Wild ersetzt, drei Bonus-Chips starten Freispiele.' });

  bet = V.betControl('slots', function () { updateSpin(); });
  spinBtn = el('button', { class: 'btn gold big', type: 'button', onclick: function () { onSpin(); } }, el('span', { text: 'Drehen' }));
  turboBtn = el('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': 'false', text: 'Turbo aus', onclick: function () {
    turbo = !turbo; turboBtn.textContent = turbo ? 'Turbo an' : 'Turbo aus'; turboBtn.setAttribute('aria-pressed', String(turbo)); V.Snd.click();
  } });
  resumeNote = el('div', { class: 'note', hidden: true });
  var controls = el('div', { class: 'controls' }, bet.el, el('div', { class: 'spinbox' }, spinBtn, turboBtn));

  var pt = el('details', { class: 'paytable' }, el('summary', { text: 'Gewinntabelle (Vielfaches des Linieneinsatzes)' }));
  var tb = el('div', { class: 'pt-grid' });
  [7, 6, 5, 4, 3, 2, 1, 0, 8].forEach(function (id) {
    var p = E.SLOT_PAY[id], txt = [];
    [2, 3, 4, 5].forEach(function (k) { if (p[k]) txt.push(k + '× ' + p[k]); });
    tb.appendChild(el('div', { class: 'pt-row' }, el('span', { class: 'pt-sym cell', html: symHTML(id) }), el('span', { class: 'pt-txt', text: txt.join(' · ') })));
  });
  tb.appendChild(el('div', { class: 'pt-row wide' }, el('span', { class: 'pt-sym cell', html: symHTML(9) }),
    el('span', { class: 'pt-txt', text: '3× = 2× Gesamteinsatz + 8 Freispiele · 4× = 10× + 12 · 5× = 50× + 20. Im Bonus zählt jeder Gewinn doppelt.' })));
  pt.appendChild(tb);
  pt.appendChild(el('p', { class: 'fine', text: '10 Gewinnlinien, 5 Walzen. Auszahlungsquote etwa 96 %: Von 100 Chips Einsatz kommen langfristig im Schnitt rund 96 zurück.' }));

  root.appendChild(wrap); root.appendChild(msg); root.appendChild(resumeNote); root.appendChild(controls); root.appendChild(pt);

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && V.S.game === 'slots' && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test((e.target.tagName || ''))) {
      e.preventDefault(); onSpin();
    }
  });
  V.busyFns.push(function () { return spinning || freeRunning || V.S.free.n > 0; });
  updateSpin();
}

function updateSpin() {
  var S = V.S;
  var off = spinning || freeRunning;
  spinBtn.disabled = off;
  bet.disable(off || S.free.n > 0);
  spinBtn.firstChild.textContent = S.free.n > 0 ? 'Freispiele laufen' : (off ? 'Dreht …' : 'Drehen · ' + fmt(S.bets.slots));
  if (S.free.n > 0 && !freeRunning && !spinning) { spinBtn.disabled = false; spinBtn.firstChild.textContent = 'Freispiele fortsetzen (' + S.free.n + ')'; }
}

function randSym() { return Math.floor(Math.random() * 10); }
function setCell(r, row, id) { cells[r][row].innerHTML = symHTML(id); }
function clearWins() {
  cells.forEach(function (cs) { cs.forEach(function (c) { c.classList.remove('win', 'dim'); }); });
  while (linesSvg.firstChild) linesSvg.removeChild(linesSvg.firstChild);
}

async function animate(grid) {
  var stopAt = turbo ? [160, 240, 320, 400, 480] : [700, 1000, 1300, 1600, 1900];
  var running = [true, true, true, true, true];
  reels.forEach(function (rl) { rl.classList.add('spinning'); });
  var iv = setInterval(function () {
    for (var r = 0; r < 5; r++) if (running[r]) for (var row = 0; row < 3; row++) setCell(r, row, randSym());
    V.Snd.tick();
  }, turbo ? 50 : 75);
  var t0 = Date.now();
  for (var r = 0; r < 5; r++) {
    var wait = stopAt[r] - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    running[r] = false;
    for (var row = 0; row < 3; row++) setCell(r, row, grid[r][row]);
    reels[r].classList.remove('spinning');
    reels[r].classList.add('land');
    (function (rr) { setTimeout(function () { reels[rr].classList.remove('land'); }, 320); })(r);
    V.Snd.card();
  }
  clearInterval(iv);
}

function showWins(res, bet0, isFree) {
  clearWins();
  var S = V.S;
  var hit = {};
  res.wins.forEach(function (w) { w.cells.forEach(function (c) { hit[c[0] + ',' + c[1]] = 1; }); });
  res.scatCells.forEach(function (c) { if (res.scat >= 3) hit[c[0] + ',' + c[1]] = 1; });
  var any = Object.keys(hit).length > 0;
  for (var r = 0; r < 5; r++) for (var row = 0; row < 3; row++) {
    if (any) cells[r][row].classList.add(hit[r + ',' + row] ? 'win' : 'dim');
  }
  var NS = 'http://www.w3.org/2000/svg';
  res.wins.forEach(function (w) {
    var pts = w.cells.map(function (c) { return ((c[0] + 0.5) / 5 * 100).toFixed(2) + ',' + ((c[1] + 0.5) / 3 * 100).toFixed(2); }).join(' ');
    var pl = document.createElementNS(NS, 'polyline');
    pl.setAttribute('points', pts); pl.setAttribute('class', 'wl'); pl.setAttribute('vector-effect', 'non-scaling-stroke');
    linesSvg.appendChild(pl);
  });
}

function winText(res, isFree) {
  var parts = [];
  if (res.wins.length) parts.push(res.wins.length + (res.wins.length === 1 ? ' Linie' : ' Linien'));
  if (res.scatterPay) parts.push('Bonus-Symbole +' + fmt(res.scatterPay));
  return parts.join(' · ');
}

async function oneSpin(isFree) {
  var S = V.S;
  var bet0 = isFree ? S.free.bet : S.bets.slots;
  if (!isFree) {
    if (S.balance < bet0) { V.needChips(); return null; }
    V.debit(bet0, true);
  }
  spinning = true; updateSpin(); clearWins();
  var res = E.slotPlay(bet0 / 10, isFree ? E.FREE_MULT : 1);
  try {
    await animate(res.grid);
  } finally { spinning = false; }
  showWins(res, bet0, isFree);
  var total = res.total, ratio = total / bet0;
  V.settle('slots', isFree ? 0 : bet0, total, { near: res.nearMiss && !res.free, refBet: bet0 });
  if (isFree) { V.S.free.won += total; }
  if (total > 0) {
    msg.className = 'slot-msg win';
    msg.textContent = (isFree ? 'Freispiel: ' : '') + '+' + fmt(total) + ' Chips (' + winText(res, isFree) + ')' + (total < bet0 && !isFree ? ' · weniger als dein Einsatz' : '');
    if (ratio >= 20) { V.Snd.big(); V.banner(ratio >= 100 ? 'MEGA WIN' : 'BIG WIN', '+' + fmt(total) + ' Chips', { kind: 'win', ms: 2400 }); V.burst(V.$('#g-slots .reels-wrap'), 36); }
    else if (ratio >= 5) { V.Snd.win(); V.burst(V.$('#g-slots .reels-wrap'), 14); }
    else if (total >= bet0) V.Snd.win();
  } else {
    msg.className = 'slot-msg';
    msg.textContent = res.nearMiss ? 'Zwei Bonus-Chips! So knapp am Freispiel-Bonus.' : 'Kein Gewinn.';
    if (res.nearMiss) cells.forEach(function (cs, r) { cs.forEach(function (c, row) { if (res.grid[r][row] === SYM.SCAT) c.classList.add('win'); }); });
    V.Snd.lose();
  }
  return res;
}

async function runFree() {
  if (freeRunning) return;
  freeRunning = true; updateSpin();
  var S = V.S;
  try {
    while (V.S.free.n > 0) {
      var f = V.S.free;
      freeBanner.hidden = false;
      freeBanner.textContent = 'Freispiele: ' + f.n + ' übrig · Gewinne ×' + E.FREE_MULT + ' · bisher +' + fmt(f.won);
      await sleep(turbo ? 350 : 900);
      f.n--; V.save();
      var res = await oneSpin(true);
      if (res && res.free) { f.n += res.free; msg.textContent += ' · +' + res.free + ' Freispiele!'; }
      V.save();
      await sleep(turbo ? 250 : 650);
    }
    var won = V.S.free.won;
    freeBanner.hidden = true;
    V.banner('Freispiele beendet', 'Gesamt +' + fmt(won) + ' Chips', { kind: 'win', ms: 3200 });
    V.S.free = { n: 0, bet: 0, won: 0 };
    V.save();
  } finally { freeRunning = false; updateSpin(); }
}

async function onSpin() {
  var S = V.S;
  if (spinning || freeRunning) return;
  V.Snd.ensure();
  if (S.free.n > 0) { await runFree(); return; }
  var res = await oneSpin(false);
  if (res && res.free) {
    V.S.free = { n: res.free, bet: V.S.bets.slots, won: 0 };
    V.save();
    V.banner(res.free + ' Freispiele!', 'Alle Gewinne zählen doppelt', { kind: 'win', ms: 2200 });
    V.Snd.big();
    await sleep(1400);
    await runFree();
  }
  updateSpin();
}

V.games.push({
  id: 'slots',
  init: function () {
    build();
    if (V.S.free.n > 0) {
      resumeNote.hidden = false;
      resumeNote.textContent = 'Du hast ' + V.S.free.n + ' offene Freispiele. Drück auf den Knopf, um sie zu spielen.';
    }
  },
  onRoom: function () { bet.render(); updateSpin(); },
  refresh: function () { bet.render(); updateSpin(); }
});
})();
