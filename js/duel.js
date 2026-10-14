/* Chip Empire – Crash-Duell: beide Spieler fliegen dieselben 10 Runden, wer am Ende mehr Duell-Chips hat, gewinnt.
   Der Kontostand spielt keine Rolle, jeder startet mit 1.000. Der Server rechnet das Ergebnis aus dem Protokoll nach. */
var Duel = (function () {
'use strict';
var el = V.el, fmt = V.fmt, fmtX = V.fmtX, E = V.E;
var ROUNDS = 10, START = 1000, MIN_BET = 50, BETS = [50, 100, 250, 500];
var KEY = 'chip-empire-duel', LIMIT_MS = 30 * 60 * 1000;

/* cur: { id, opp, role, points, log: [{ b, c }], user, started } */
var cur = null, onDone = null, bet = 100;
var dlg, cv, ctx, stageEl, multEl, subEl, roundEl, stackEl, histEl, betsEl, goBtn, msgEl;
var running = false, cashed = false, t0 = 0, raf = 0, curM = 1, curT = 0, crashedAt = 0, cashAt = 0, lastTick = 0, phase = 'bet', lockUntil = 0;
var colors = {};

/* ---------- Zustand, auch über ein Neuladen hinweg ---------- */
function persist() { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* */ } }
function forget() { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }
function pending() {
  var a = Cloud.current();
  if (!a) return null;
  try {
    var d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!d || d.user !== a.id) return null;
    if (Date.now() - d.started > LIMIT_MS) { forget(); return null; }
    return d;
  } catch (e) { return null; }
}
/* Ganzzahlig rechnen wie der Server: floor(Einsatz × Auszahlung) */
function payout(b, c) { return Math.floor(b * Math.round(c * 100) / 100); }
function stackOf(d) {
  var s = START;
  d.log.forEach(function (e, i) { s -= e.b; if (e.c && e.c <= d.points[i]) s += payout(e.b, e.c); });
  return s;
}
function finished(d) { return d.log.length >= ROUNDS || stackOf(d) <= 0; }
function minBet(s) { return Math.min(MIN_BET, s); }

/* ---------- Fenster ---------- */
function build() {
  cv = el('canvas', { class: 'crash-cv', 'aria-hidden': 'true' });
  multEl = el('div', { class: 'crash-mult', text: '1,00×' });
  subEl = el('div', { class: 'crash-sub', 'aria-live': 'polite' });
  stageEl = el('div', { class: 'crash-stage duel-stage' }, cv, el('div', { class: 'crash-over' }, multEl, subEl));
  roundEl = el('b', { class: 'num' }); stackEl = el('b', { class: 'num' });
  histEl = el('div', { class: 'duel-hist', 'aria-label': 'Bisherige Runden' });
  betsEl = el('div', { class: 'duel-bets', role: 'group', 'aria-label': 'Einsatz' });
  goBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onGo });
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite' });
  var title = el('h2', { id: 'duelTitle' });
  dlg = el('div', { class: 'drawer duel-dlg', hidden: true },
    el('div', { class: 'drawer-panel duel-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'duelTitle' },
      el('header', { class: 'drawer-h' }, title,
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', text: '✕', onclick: tryClose })),
      el('section', { class: 'side duel-body' },
        el('div', { class: 'duel-top' },
          el('div', {}, el('span', { text: 'Runde ' }), roundEl),
          el('div', {}, el('span', { text: 'Duell-Chips ' }), stackEl)),
        stageEl, histEl, msgEl,
        el('div', { class: 'duel-ctl' }, betsEl, goBtn),
        el('p', { class: 'fine', text: 'Beide Spieler fliegen dieselben 10 Runden mit denselben Absturzpunkten. Jeder startet mit 1.000 Duell-Chips, Mindesteinsatz 50. Wer am Ende mehr hat, gewinnt. Dein echter Kontostand bleibt unberührt.' }))));
  document.body.appendChild(dlg);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', function () { if (!dlg.hidden) { size(); draw(); } });
}
function isOpen() { return !!dlg && !dlg.hidden; }

function open(d, done) {
  if (!dlg) build();
  cur = d; onDone = done || null;
  persist();
  dlg.querySelector('#duelTitle').textContent = d.opp ? 'Duell gegen ' + d.opp : 'Offene Herausforderung';
  dlg.hidden = false;
  readColors();
  running = false; cashed = false; curM = 1; curT = 0; crashedAt = 0;
  multEl.textContent = '1,00×'; multEl.className = 'crash-mult';
  subEl.textContent = 'Wähle deinen Einsatz und steig ein.';
  msgEl.textContent = ''; msgEl.className = 'slot-msg';
  phase = finished(cur) ? 'submit' : 'bet';
  bet = Math.min(bet, stackOf(cur)) || MIN_BET;
  render();
  requestAnimationFrame(function () { size(); draw(); goBtn.focus(); });
  if (phase === 'submit') submit();
}

/* Neues Duell oder angenommenes Duell starten */
function start(info, done) {
  var a = Cloud.current();
  if (!a) return;
  open({ id: info.id, opp: info.opp || '', role: info.role, points: info.points.map(Number), log: [], user: a.id, started: Date.now() }, done);
}
function resume(done) { var d = pending(); if (d) open(d, done); }

function render() {
  var s = stackOf(cur), n = cur.log.length;
  roundEl.textContent = Math.min(ROUNDS, n + (phase === 'bet' ? 1 : 0)) + ' / ' + ROUNDS;
  stackEl.textContent = fmt(s);
  histEl.innerHTML = '';
  cur.log.forEach(function (e, i) {
    if (i === n - 1 && running) return;
    var p = cur.points[i], won = e.c && e.c <= p;
    histEl.appendChild(el('span', { class: 'cp ' + (won ? 'hi' : 'lo'), title: 'Absturz bei ' + fmtX(p),
      text: (i + 1) + ': ' + (won ? '+' + fmt(payout(e.b, e.c) - e.b) : '−' + fmt(e.b)) }));
  });
  betsEl.innerHTML = '';
  var mn = minBet(s);
  BETS.concat(['all']).forEach(function (v) {
    var val = v === 'all' ? s : v, ok = val >= mn && val <= s;
    betsEl.appendChild(el('button', { class: 'chipbtn' + (bet === val ? ' on' : ''), type: 'button', disabled: phase !== 'bet' || !ok,
      'aria-pressed': String(bet === val), text: v === 'all' ? 'Alles' : fmt(v),
      onclick: function () { bet = val; V.Snd.chip(); render(); } }));
  });
  if (bet > s || bet < mn) bet = Math.max(mn, Math.min(bet, s));
  goBtn.classList.remove('cash');
  goBtn.disabled = false;
  if (phase === 'bet') goBtn.textContent = 'Einsteigen · ' + fmt(bet);
  else if (phase === 'fly' && !cashed) { goBtn.textContent = 'Auszahlen · ' + fmt(payout(bet, Math.floor(curM * 100) / 100)); goBtn.classList.add('cash'); }
  else if (phase === 'fly') goBtn.textContent = 'Überspringen';
  else if (phase === 'submit') { goBtn.textContent = 'Wird gewertet …'; goBtn.disabled = true; }
  else if (phase === 'retry') goBtn.textContent = 'Ergebnis erneut senden';
  else goBtn.textContent = 'Fertig';
}

/* ---------- Kurve ---------- */
function readColors() {
  var cs = getComputedStyle(document.documentElement);
  ['--gold-hi', '--crimson', '--muted', '--line', '--good'].forEach(function (k) { colors[k] = cs.getPropertyValue(k).trim() || '#ccc'; });
}
function size() {
  var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  var w = Math.max(10, Math.round(r.width * d)), h = Math.max(10, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  ctx = cv.getContext('2d');
}
function draw() {
  if (!ctx) return;
  var w = cv.width, h = cv.height, d = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, w, h);
  if (curT <= 0) return;
  var pad = 16 * d, tMax = Math.max(8, curT * 1.12), mMax = Math.max(2, 1 + (curM - 1) * 1.15);
  function X(t) { return pad + (t / tMax) * (w - 2 * pad); }
  function Y(m) { return h - pad - ((m - 1) / (mMax - 1)) * (h - 2 * pad); }
  var col = crashedAt ? colors['--crimson'] : colors['--gold-hi'];
  ctx.beginPath(); ctx.moveTo(X(0), Y(1));
  for (var i = 1; i <= 60; i++) { var t = curT * i / 60; ctx.lineTo(X(t), Y(Math.min(E.crashMult(t), curM))); }
  ctx.strokeStyle = col; ctx.lineWidth = 3 * d; ctx.lineJoin = 'round'; ctx.stroke();
  if (cashed && cashAt <= curM) {
    ctx.setLineDash([4 * d, 4 * d]); ctx.strokeStyle = colors['--good']; ctx.lineWidth = 1.5 * d;
    ctx.beginPath(); ctx.moveTo(pad, Y(cashAt)); ctx.lineTo(w - pad, Y(cashAt)); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.save(); ctx.translate(X(curT), Y(curM)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = (crashedAt ? 34 : 26) * d + 'px serif';
  ctx.fillText(crashedAt ? '💥' : '🚀', 0, 0);
  ctx.restore();
}

/* ---------- Ablauf einer Runde ---------- */
function onGo() {
  V.Snd.ensure();
  /* Kurz nach dem Absturz startet ein schneller Doppeldruck nicht gleich die nächste Runde */
  if (phase === 'bet') { if (performance.now() >= lockUntil) fly(); }
  else if (phase === 'fly' && !cashed) cashout(Math.floor(curM * 100) / 100);
  else if (phase === 'fly') { curM = cur.points[cur.log.length - 1]; curT = E.crashTime(curM); crash(); }
  else if (phase === 'retry') submit();
  else if (phase === 'done') close();
}
function fly() {
  var s = stackOf(cur);
  bet = Math.max(minBet(s), Math.min(bet, s));
  /* Erst eintragen, dann starten: Wer mitten im Flug neu lädt, hat die Runde verloren */
  cur.log.push({ b: bet, c: 0 });
  persist();
  phase = 'fly'; running = true; cashed = false; cashAt = 0; curM = 1; curT = 0; crashedAt = 0;
  stageEl.classList.add('flying');
  multEl.className = 'crash-mult live'; subEl.textContent = 'Läuft …'; msgEl.textContent = ''; msgEl.className = 'slot-msg';
  size(); render();
  t0 = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}
function loop(now) {
  if (!running) return;
  var cp = cur.points[cur.log.length - 1];
  curT = (now - t0) / 1000;
  curM = E.crashMult(curT);
  if (curM >= cp) { curM = cp; curT = E.crashTime(cp); crash(); return; }
  multEl.textContent = fmtX(Math.floor(curM * 100) / 100);
  if (!cashed) goBtn.textContent = 'Auszahlen · ' + fmt(payout(bet, Math.floor(curM * 100) / 100));
  if (now - lastTick > Math.max(70, 260 - curM * 20)) { V.Snd.tick(); lastTick = now; }
  draw();
  raf = requestAnimationFrame(loop);
}
function cashout(at) {
  var e = cur.log[cur.log.length - 1];
  if (!running || cashed || at < 1.01 || at > cur.points[cur.log.length - 1]) return;
  cashed = true; cashAt = at; e.c = at;
  persist();
  V.Snd.cash();
  subEl.textContent = 'Ausgezahlt bei ' + fmtX(at) + ': +' + fmt(payout(e.b, at) - e.b);
  render();
}
function crash() {
  var cp = cur.points[cur.log.length - 1];
  running = false; crashedAt = cp;
  cancelAnimationFrame(raf);
  stageEl.classList.remove('flying');
  multEl.textContent = fmtX(cp); multEl.className = 'crash-mult dead';
  if (!cashed) { V.Snd.crash(); subEl.textContent = 'Abgestürzt bei ' + fmtX(cp) + '. Einsatz verloren.'; }
  else subEl.textContent = 'Abgestürzt bei ' + fmtX(cp) + ' · du warst bei ' + fmtX(cashAt) + ' raus.';
  draw();
  phase = finished(cur) ? 'submit' : 'bet';
  lockUntil = performance.now() + 900;
  render();
  if (phase === 'submit') setTimeout(submit, 900);
}

/* ---------- Ergebnis ---------- */
async function submit(quit) {
  phase = 'submit'; render();
  try {
    var score = await Cloud.rpc('duel_submit', { did: cur.id, lg: quit ? [] : cur.log, quit: !!quit });
    forget();
    await showResult(Number(score), quit);
  } catch (e) {
    /* Ist das Duell auf dem Server schon gewertet (z. B. abgelaufen), gibt es nichts mehr zu senden */
    if (/kein Ergebnis abgeben|nicht gefunden/.test(e.message || '')) { forget(); phase = 'done'; msgEl.className = 'slot-msg'; msgEl.textContent = e.message; render(); return; }
    phase = 'retry'; msgEl.className = 'slot-msg'; msgEl.textContent = 'Senden fehlgeschlagen: ' + (e.message || e) + ' Dein Ergebnis bleibt gespeichert.';
    render();
  }
}
async function showResult(score, quit) {
  phase = 'done';
  multEl.className = 'crash-mult'; multEl.textContent = fmt(score);
  if (cur.role === 'a') {
    subEl.textContent = quit ? 'Aufgegeben.' : 'Duell-Chips am Ende';
    msgEl.className = 'slot-msg win';
    msgEl.textContent = (quit ? 'Das Duell zählt mit 0 Chips. ' : '') + (cur.opp ? cur.opp + ' ist jetzt dran.' : 'Deine Herausforderung ist offen, jeder kann sie annehmen.') + ' Das Ergebnis siehst du in der Arena.';
  } else {
    var row = null;
    try { (await Cloud.rpc('duel_list')).forEach(function (r) { if (r.id === cur.id) row = r; }); } catch (e) { /* */ }
    if (row && row.their_score != null) {
      var mine = Number(row.my_score), theirs = Number(row.their_score), d = row.my_delta || 0;
      var res = mine > theirs ? 'Gewonnen!' : mine < theirs ? 'Verloren' : 'Unentschieden';
      subEl.textContent = res + ' ' + fmt(mine) + ' zu ' + fmt(theirs) + ' gegen ' + (row.opponent || cur.opp);
      msgEl.className = 'slot-msg' + (mine > theirs ? ' win' : '');
      msgEl.textContent = 'Wertung ' + (d >= 0 ? '+' : '−') + Math.abs(d) + ' Punkte.';
      if (mine > theirs) { V.Snd.big(); V.burst(stageEl, 30); } else if (mine < theirs) V.Snd.lose();
    } else { subEl.textContent = 'Duell-Chips am Ende'; msgEl.textContent = 'Das Ergebnis siehst du in der Arena.'; }
  }
  render();
}

function close() {
  running = false; cancelAnimationFrame(raf);
  dlg.hidden = true;
  var cb = onDone; onDone = null;
  if (phase === 'done') cur = null;
  if (cb) cb();
}
/* Zwischen den Runden darf man pausieren; mitten im Flug oder auf Wunsch aufgeben */
function tryClose() {
  if (phase === 'done' || phase === 'retry') { close(); return; }
  if (phase === 'submit') return;
  if (phase === 'bet') {
    V.banner('Duell pausieren?', 'Du kannst innerhalb von 30 Minuten in der Arena weiterspielen. Danach zählt das Duell mit 0 Chips.', {
      kind: 'level', ms: 15000, actions: [{ label: 'Pausieren', gold: true, fn: close }, { label: 'Aufgeben', fn: function () { submit(true); } }, { label: 'Weiterspielen', fn: function () {} }] });
    return;
  }
  V.toast('Warte, bis die Runde vorbei ist.', 'bad');
}
function onKey(e) {
  if (!isOpen()) return;
  var tag = (e.target && e.target.tagName) || '';
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tryClose(); return; }
  if ((e.key === ' ' || (e.key === 'Enter' && tag !== 'BUTTON')) && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); e.stopPropagation(); if (!goBtn.disabled) onGo();
    return;
  }
  /* Andere Tasten sollen nicht im Spiel dahinter landen */
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) e.stopPropagation();
}

return { start: start, resume: resume, pending: pending, isOpen: isOpen, ROUNDS: ROUNDS, START: START, payout: payout };
})();
