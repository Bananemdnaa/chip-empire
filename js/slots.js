/* Chip Empire – Slot-Automat "Golden Velvet": Gehäuse, rollende Walzen, Hebel, LED-Anzeigen */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, sleep = V.sleep;
var SYM = E.SYM;
var NS = 'http://www.w3.org/2000/svg';

var NAMES = ['10', 'J', 'Q', 'K', 'A', 'Diamant', 'BAR', 'Sieben', 'Wild', 'Bonus'];
/* Jede Gewinnlinie hat ihre eigene Farbe, wie auf echten Automaten */
var LINE_COLORS = ['#F2D68E', '#FF6A88', '#6FD3A2', '#7FB8FF', '#C59BFF', '#FFA24A', '#5FE0E0', '#FF7AD9', '#B8E05F', '#FFFFFF'];

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
function cellEl(id) { return el('div', { class: 'cell', 'data-sym': String(id), html: symHTML(id) }); }

var root, machine, reels = [], strips = [], cells = [], linesSvg, msg, spinBtn, bet, freeBanner, turboBtn, resumeNote, lever;
var ledBet, ledWin, ledLines, ledLinesLbl, markers = [];
var spinning = false, turbo = false, freeRunning = false, grid = null, autoBtn, autoLeft = 0;
var AUTO_SPINS = 25;

/* ---------- Aufbau ---------- */
function lineMarkers(side) {
  /* Liniennummern stehen auf der Höhe, auf der die Linie am Rand beginnt bzw. endet */
  var col = side === 'l' ? 0 : 4;
  var box = el('div', { class: 'markers ' + side, 'aria-hidden': 'true' });
  [0, 1, 2].forEach(function (row) {
    var g = el('div', { class: 'mk-row' });
    E.SLOT_LINES.forEach(function (ln, i) {
      if (ln[col] !== row) return;
      var m = el('span', { class: 'mk', text: String(i + 1) });
      m.style.setProperty('--lc', LINE_COLORS[i]);
      m.addEventListener('mouseenter', function () { if (!spinning) previewLine(i); });
      m.addEventListener('mouseleave', function () { if (!spinning) clearPreview(); });
      (markers[i] = markers[i] || []).push(m);
      g.appendChild(m);
    });
    box.appendChild(g);
  });
  return box;
}
function led(label, valEl) { return el('div', { class: 'led' }, el('span', { class: 'led-l', text: label }), valEl); }

function build() {
  root = V.$('#g-slots');
  root.classList.add('slots-game');

  /* Leuchtschild mit Lichterkette */
  var bulbs = el('div', { class: 'bulbs', 'aria-hidden': 'true' });
  for (var b = 0; b < 22; b++) bulbs.appendChild(el('i', { style: 'animation-delay:' + (-(b % 2) * 0.8).toFixed(2) + 's' }));
  var marquee = el('div', { class: 'marquee' }, bulbs,
    el('div', { class: 'mq-title' }, el('span', { class: 'mq-small', text: 'Chip Empire präsentiert' }), el('span', { class: 'mq-name', text: 'Golden Velvet' })),
    el('div', { class: 'mq-top', 'aria-hidden': 'true' }, el('span', { text: '7 7 7' }), el('b', { text: 'Top-Gewinn 1.700× Linieneinsatz' })));

  /* Walzenfenster */
  var rl = el('div', { class: 'reels' });
  for (var r = 0; r < 5; r++) {
    var strip = el('div', { class: 'strip' });
    var cs = [];
    for (var row = 0; row < 3; row++) { var c = cellEl(E.SLOT_STRIPS[r][row]); strip.appendChild(c); cs.push(c); }
    var reel = el('div', { class: 'reel' }, strip);
    reels.push(reel); strips.push(strip); cells.push(cs); rl.appendChild(reel);
  }
  linesSvg = document.createElementNS(NS, 'svg');
  linesSvg.setAttribute('class', 'lines');
  linesSvg.setAttribute('viewBox', '0 0 100 100');
  linesSvg.setAttribute('preserveAspectRatio', 'none');
  linesSvg.setAttribute('aria-hidden', 'true');
  var glass = el('div', { class: 'reels-wrap' }, rl, linesSvg, el('div', { class: 'glass', 'aria-hidden': 'true' }));
  freeBanner = el('div', { class: 'free-banner', hidden: true });
  var windowRow = el('div', { class: 'window-row' }, lineMarkers('l'), glass, lineMarkers('r'));

  /* LED-Anzeigen */
  ledLines = el('b', { class: 'led-v', text: '10' });
  ledLinesLbl = el('span', { class: 'led-l', text: 'Linien' });
  ledBet = el('b', { class: 'led-v' });
  ledWin = el('b', { class: 'led-v win', text: '0' });
  var leds = el('div', { class: 'leds' }, el('div', { class: 'led' }, ledLinesLbl, ledLines), led('Einsatz', ledBet), led('Gewinn', ledWin));

  msg = el('div', { class: 'slot-msg', 'aria-live': 'polite', text: 'Drei Gleiche von links gewinnen · Wild ersetzt · 3 Bonus-Chips = Freispiele' });

  /* Bedienpult */
  bet = V.betControl('slots', function () { updateSpin(); });
  spinBtn = el('button', { class: 'spin-btn', type: 'button', 'aria-label': 'Drehen', onclick: function () { onSpin(); } },
    el('span', { class: 'spin-face' }, el('b', { text: 'Drehen' }), el('small')), el('kbd', { class: 'kb', text: 'Leertaste' }));
  turbo = !!V.S.turbo;
  turboBtn = el('button', { class: 'toggle', type: 'button', 'aria-pressed': String(turbo), onclick: toggleTurbo },
    el('span', { class: 'sw' }), el('span', { text: 'Turbo' }), el('kbd', { class: 'kb', text: 'T' }));
  autoBtn = el('button', { class: 'toggle auto', type: 'button', 'aria-pressed': 'false', title: AUTO_SPINS + ' Drehungen automatisch. Stoppt bei Freispielen, großen Gewinnen oder wenn die Chips knapp werden.', onclick: toggleAuto },
    el('span', { class: 'sw' }), el('span', { class: 'auto-l', text: 'Auto ' + AUTO_SPINS }), el('kbd', { class: 'kb', text: 'A' }));
  var deck = el('div', { class: 'deck' }, bet.el, el('div', { class: 'deck-mid' }, spinBtn), el('div', { class: 'deck-side' }, turboBtn, autoBtn));

  /* Hebel: anklicken oder nach unten ziehen */
  lever = el('button', { class: 'lever', type: 'button', 'aria-label': 'Hebel ziehen (dreht die Walzen)', title: 'Hebel ziehen' },
    el('span', { class: 'lv-base' }), el('span', { class: 'lv-arm' }, el('span', { class: 'lv-knob' })));
  bindLever();

  resumeNote = el('div', { class: 'note', hidden: true });
  machine = el('div', { class: 'machine' },
    marquee,
    el('div', { class: 'cabinet' }, freeBanner, windowRow, leds, msg, resumeNote, deck),
    lever);

  /* Gewinnplan */
  var pt = el('details', { class: 'paytable' }, el('summary', { text: 'Gewinnplan (Vielfaches des Linieneinsatzes)' }));
  var tb = el('div', { class: 'pt-grid' });
  [7, 6, 5, 4, 3, 2, 1, 0, 8].forEach(function (id) {
    var p = E.SLOT_PAY[id], txt = [];
    [2, 3, 4, 5].forEach(function (k) { if (p[k]) txt.push(k + '× ' + p[k]); });
    tb.appendChild(el('div', { class: 'pt-row' }, el('span', { class: 'pt-sym cell', html: symHTML(id) }), el('span', { class: 'pt-txt', text: txt.join(' · ') })));
  });
  tb.appendChild(el('div', { class: 'pt-row wide' }, el('span', { class: 'pt-sym cell', html: symHTML(9) }),
    el('span', { class: 'pt-txt', text: '3× = 2× Gesamteinsatz + 8 Freispiele · 4× = 10× + 12 · 5× = 50× + 20. Im Bonus zählt jeder Gewinn doppelt.' })));
  pt.appendChild(tb);
  pt.appendChild(el('p', { class: 'fine', text: '10 Gewinnlinien, 5 Walzen. Fahr mit der Maus über eine Liniennummer, um die Linie zu sehen. Auszahlungsquote etwa 96 %: Von 100 Chips Einsatz kommen langfristig im Schnitt rund 96 zurück.' }));

  root.appendChild(machine); root.appendChild(pt);
  V.busyFns.push(function () { return spinning || freeRunning || autoLeft > 0 || V.S.free.n > 0; });
  updateSpin();
}

function bindLever() {
  var startY = null, pulled = false;
  function pull() {
    if (spinning || freeRunning) return;
    lever.classList.remove('pull'); void lever.offsetWidth; lever.classList.add('pull');
    V.Snd.click();
    onSpin();
  }
  lever.addEventListener('click', function () { if (!pulled) pull(); pulled = false; });
  lever.addEventListener('pointerdown', function (e) { startY = e.clientY; pulled = false; });
  window.addEventListener('pointermove', function (e) {
    if (startY === null) return;
    if (e.clientY - startY > 36 && !pulled) { pulled = true; startY = null; pull(); }
  });
  window.addEventListener('pointerup', function () { startY = null; });
}
function toggleTurbo() {
  turbo = !turbo;
  V.S.turbo = turbo; V.save();
  turboBtn.setAttribute('aria-pressed', String(turbo));
  V.Snd.click();
}
/* Auto-Spin: dreht von selbst, bis die Runden aufgebraucht sind oder etwas Besonderes passiert */
function renderAuto() {
  autoBtn.setAttribute('aria-pressed', String(autoLeft > 0));
  autoBtn.querySelector('.auto-l').textContent = autoLeft > 0 ? 'Auto · noch ' + autoLeft : 'Auto ' + AUTO_SPINS;
}
function toggleAuto() {
  V.Snd.click();
  if (autoLeft > 0) { autoLeft = 0; renderAuto(); return; }
  autoLeft = AUTO_SPINS; renderAuto();
  loopAuto();
}
async function loopAuto() {
  while (autoLeft > 0 && V.S.game === 'slots') {
    if (spinning || freeRunning) { await sleep(150); continue; }
    if (V.S.free.n <= 0 && V.S.balance < V.S.bets.slots) { V.needChips(); break; }
    autoLeft--; renderAuto();
    var res = await onSpin();
    if (res && (res.free || res.total >= 20 * V.S.bets.slots)) { if (autoLeft > 0) V.toast('Auto-Spin pausiert: ' + (res.free ? 'Freispiele' : 'großer Gewinn') + '!', 'good'); break; }
    await sleep(turbo ? 150 : 450);
  }
  autoLeft = 0; renderAuto();
}

function updateSpin() {
  var S = V.S;
  var off = spinning || freeRunning;
  var label = spinBtn.querySelector('b'), sub = spinBtn.querySelector('small');
  spinBtn.disabled = off;
  bet.disable(off || S.free.n > 0);
  ledBet.textContent = fmt(S.free.n > 0 ? S.free.bet : S.bets.slots);
  if (S.free.n > 0) { ledLinesLbl.textContent = 'Freispiele'; ledLines.textContent = String(S.free.n); }
  else { ledLinesLbl.textContent = 'Linien'; ledLines.textContent = '10'; }
  if (S.free.n > 0 && !off) { label.textContent = 'Weiter'; sub.textContent = S.free.n + ' Freispiele'; spinBtn.disabled = false; }
  else if (S.free.n > 0 || freeRunning) { label.textContent = 'Bonus'; sub.textContent = 'läuft …'; }
  else if (off) { label.textContent = 'Dreht'; sub.textContent = '…'; }
  else { label.textContent = 'Drehen'; sub.textContent = fmt(S.bets.slots); }
  lever.disabled = spinBtn.disabled;
}

/* ---------- Gewinnlinien ---------- */
function linePoints(i, upTo) {
  var ln = E.SLOT_LINES[i], pts = [];
  for (var c = 0; c < (upTo || 5); c++) pts.push(((c + 0.5) / 5 * 100).toFixed(2) + ',' + ((ln[c] + 0.5) / 3 * 100).toFixed(2));
  return pts.join(' ');
}
function drawLine(i, upTo, cls) {
  var pl = document.createElementNS(NS, 'polyline');
  pl.setAttribute('points', linePoints(i, upTo)); pl.setAttribute('class', 'wl ' + (cls || ''));
  pl.setAttribute('vector-effect', 'non-scaling-stroke');
  pl.style.stroke = LINE_COLORS[i];
  linesSvg.appendChild(pl);
}
function previewLine(i) { clearPreview(); drawLine(i, 5, 'preview'); (markers[i] || []).forEach(function (m) { m.classList.add('on'); }); }
function clearPreview() {
  Array.prototype.slice.call(linesSvg.querySelectorAll('.preview')).forEach(function (n) { n.remove(); });
  markers.forEach(function (ms) { ms.forEach(function (m) { if (!m.classList.contains('hit')) m.classList.remove('on'); }); });
}
function clearWins() {
  cells.forEach(function (cs) { cs.forEach(function (c) { c.classList.remove('win', 'dim'); }); });
  while (linesSvg.firstChild) linesSvg.removeChild(linesSvg.firstChild);
  markers.forEach(function (ms) { ms.forEach(function (m) { m.classList.remove('on', 'hit'); }); });
  machine.classList.remove('celebrate', 'mega');
}
function showWins(res) {
  clearWins();
  var hit = {};
  res.wins.forEach(function (w) { w.cells.forEach(function (c) { hit[c[0] + ',' + c[1]] = 1; }); });
  res.scatCells.forEach(function (c) { if (res.scat >= 3) hit[c[0] + ',' + c[1]] = 1; });
  var any = Object.keys(hit).length > 0;
  for (var r = 0; r < 5; r++) for (var row = 0; row < 3; row++) {
    if (any) cells[r][row].classList.add(hit[r + ',' + row] ? 'win' : 'dim');
  }
  res.wins.forEach(function (w) {
    drawLine(w.line, 5);
    (markers[w.line] || []).forEach(function (m) { m.classList.add('on', 'hit'); });
  });
}

/* ---------- Walzen rollen ---------- */
function randSym() { return Math.floor(Math.random() * 10); }
function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

/* Jede Walze bekommt einen langen Streifen: oben das Ergebnis, darunter Zufallssymbole, unten der alte Stand.
   Der Streifen rollt nach unten, bis das Ergebnis im Fenster steht, mit kleinem Nachfedern. */
async function animate(g) {
  var base = turbo ? 380 : 900, step = turbo ? 110 : 260;
  var h = reels[0].clientHeight / 3;
  var jobs = [];
  var tick = setInterval(function () { V.Snd.tick(); }, turbo ? 70 : 95);
  for (var r = 0; r < 5; r++) {
    var dur = reduced() ? 200 : base + r * step;
    var count = Math.max(6, Math.round(dur / (turbo ? 28 : 40)));
    var strip = strips[r], old = cells[r].map(function (c) { return Number(c.getAttribute('data-sym')); });
    strip.innerHTML = '';
    var fresh = g[r].map(cellEl);
    fresh.forEach(function (c) { strip.appendChild(c); });
    for (var k = 0; k < count; k++) strip.appendChild(cellEl(randSym()));
    old.forEach(function (id) { strip.appendChild(cellEl(id)); });
    cells[r] = fresh;
    var dist = (count + 3) * h;
    reels[r].classList.add('spinning');
    var anim = strip.animate([
      { transform: 'translateY(' + (-dist) + 'px)', filter: 'blur(0)' },
      { transform: 'translateY(' + (-dist * 0.75) + 'px)', filter: 'blur(1.6px)', offset: 0.18 },
      { transform: 'translateY(' + (h * 0.16) + 'px)', filter: 'blur(0)', offset: 0.9 },
      { transform: 'translateY(0)', filter: 'blur(0)' }
    ], { duration: dur, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
    jobs.push(anim.finished.then((function (rr, a) {
      return function () {
        /* Streifen auf die drei sichtbaren Symbole kürzen */
        var s = strips[rr];
        while (s.children.length > 3) s.removeChild(s.lastChild);
        a.cancel();
        reels[rr].classList.remove('spinning');
        reels[rr].classList.add('land');
        setTimeout(function () { reels[rr].classList.remove('land'); }, 300);
        V.Snd.card();
      };
    })(r, anim)));
  }
  await Promise.all(jobs);
  clearInterval(tick);
}

/* Gewinn in der LED-Anzeige hochzählen */
var winAnim = 0;
function countWin(to) {
  cancelAnimationFrame(winAnim);
  if (!to) { ledWin.textContent = '0'; return; }
  var t0 = performance.now(), dur = Math.min(1600, 400 + to / 50);
  (function step(t) {
    var k = Math.min(1, (t - t0) / dur);
    ledWin.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) winAnim = requestAnimationFrame(step);
  })(t0);
}

function winText(res) {
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
  spinning = true; updateSpin(); clearWins(); countWin(0);
  machine.classList.add('running');
  msg.className = 'slot-msg'; msg.textContent = isFree ? 'Freispiel …' : 'Viel Glück!';
  var res = E.slotPlay(bet0 / 10, isFree ? E.FREE_MULT : 1);
  /* Goldener Dreh: etwa jeder 50. bezahlte Dreh verdoppelt alle Gewinne */
  var golden = !isFree && E.rand() < 0.02;
  if (golden) { machine.classList.add('golden'); msg.textContent = '✨ Goldener Dreh: Alle Gewinne zählen doppelt!'; await V.event('gold', '✨ GOLDENER DREH ✨', 'Alle Gewinne zählen doppelt'); }
  /* Talente: Glückssträhne erhöht Gewinne, Bonusjäger gibt mehr Freispiele */
  var luck = V.meta.perk('slotLuck');
  if (luck && res.total > 0) res.total = Math.round(res.total * (1 + luck));
  if (res.free) res.free += V.meta.perk('slotFree');
  if (golden && res.total > 0) res.total *= 2;
  try {
    await animate(res.grid);
  } finally { spinning = false; machine.classList.remove('running'); setTimeout(function () { machine.classList.remove('golden'); }, 1800); }
  grid = res.grid;
  showWins(res);
  var total = res.total, ratio = total / bet0;
  V.settle('slots', isFree ? 0 : bet0, total, { near: res.nearMiss && !res.free, refBet: bet0, freeTrig: res.free > 0, lines: res.wins.length,
    sevens: res.wins.some(function (w) { return w.sym === SYM.SEVEN; }),
    wildHelp: res.wins.some(function (w) { return w.cells.some(function (c) { return res.grid[c[0]][c[1]] === SYM.WILD; }); }) });
  if (isFree) { V.S.free.won += total; }
  countWin(total);
  if (total > 0) {
    msg.className = 'slot-msg win';
    msg.textContent = (isFree ? 'Freispiel: ' : '') + '+' + fmt(total) + ' Chips (' + winText(res) + ')' + (total < bet0 && !isFree ? ' · weniger als dein Einsatz' : '');
    machine.classList.add('celebrate');
    if (ratio >= 20) { machine.classList.add('mega'); V.Snd.big(); V.banner(ratio >= 100 ? 'MEGA WIN' : 'BIG WIN', '+' + fmt(total) + ' Chips', { kind: 'win', ms: 2400 }); V.burst(V.$('#g-slots .reels-wrap'), 36); }
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
  machine.classList.add('bonus');
  try {
    while (V.S.free.n > 0) {
      var f = V.S.free;
      freeBanner.hidden = false;
      freeBanner.textContent = 'Freispiele: ' + f.n + ' übrig · Gewinne ×' + E.FREE_MULT + ' · bisher +' + fmt(f.won);
      await sleep(turbo ? 350 : 900);
      f.n--; V.save(); updateSpin();
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
  } finally { freeRunning = false; machine.classList.remove('bonus'); resumeNote.hidden = true; updateSpin(); }
}

async function onSpin() {
  var S = V.S;
  if (spinning || freeRunning) return null;
  V.Snd.ensure();
  if (S.free.n > 0) { await runFree(); return null; }
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
  return res;
}

/* ---------- Tastatur ---------- */
function onKey(e) {
  var k = e.key;
  if (k === ' ' || k === 'Enter') { onSpin(); return true; }
  if (k === 'ArrowUp' || k === '+') { if (!bet.isOff()) bet.step(1); return true; }
  if (k === 'ArrowDown' || k === '-') { if (!bet.isOff()) bet.step(-1); return true; }
  if (k === 't' || k === 'T') { toggleTurbo(); return true; }
  if (k === 'a' || k === 'A') { toggleAuto(); return true; }
  return false;
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
  onKey: onKey,
  keys: [['Leertaste', 'Drehen'], ['↑ / ↓', 'Einsatz ändern'], ['T', 'Turbo an/aus'], ['A', 'Auto-Spin (' + AUTO_SPINS + ') starten/stoppen']],
  onRoom: function () { bet.render(); updateSpin(); },
  refresh: function () { bet.render(); updateSpin(); }
});
})();
