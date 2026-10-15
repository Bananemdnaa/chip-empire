/* Chip Empire – Duelle: beide Spieler spielen denselben Zufall (Absturzpunkte, Türme, Kartenschuh) mit 1.000 Duell-Chips.
   Wer am Ende mehr hat, gewinnt. Der Kontostand spielt keine Rolle. Der Server rechnet jedes Ergebnis aus dem Protokoll nach,
   die Regeln hier und in der Datenbank müssen deshalb genau gleich sein. */
var Duel = (function () {
'use strict';
var el = V.el, fmt = V.fmt, fmtX = V.fmtX, E = V.E;
var START = 1000, MIN_BET = 50, BETS = [50, 100, 250, 500];
var KEY = 'chip-empire-duel', LIMIT_MS = 30 * 60 * 1000;

/* Ganzzahlig rechnen wie der Server: floor(Einsatz × Faktor) */
function payout(b, m) { return Math.floor(b * Math.round(m * 100) / 100); }

/* ================= Spiele ================= */
/* rounds(d): Anzahl Runden; results(d): pro Protokolleintrag { stake, ret, done } in Duell-Chips */
var TOWER_MULTS = [1.45, 2.18, 3.27, 4.91, 7.36, 11.04, 16.57, 24.86, 37.29];
var SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
function card(s) { return { r: s.slice(0, -1), s: SUIT[s.slice(-1)] }; }
function bjTotal(cards) { return E.handValue(cards).total; }

/* Blackjack nachspielen: Karten werden über alle Hände hinweg nacheinander aus dem Schuh gezogen */
function bjReplay(d) {
  var shoe = d.setup || [], pos = 0, out = [];
  function draw() { return card(shoe[pos++]); }
  d.log.forEach(function (e) {
    var p = [draw()], dl = [draw()];
    p.push(draw()); dl.push(draw());
    var acts = e.a || '', stake = e.b, ret = 0, done = false, nat = false;
    var pbj = bjTotal(p) === 21, dbj = bjTotal(dl) === 21;
    if (pbj || dbj) { done = true; nat = true; ret = pbj && dbj ? e.b : pbj ? Math.floor(e.b * 2.5) : 0; }
    else {
      for (var k = 0; k < acts.length && !done; k++) {
        var ch = acts.charAt(k);
        if (ch === 'H') { p.push(draw()); if (bjTotal(p) >= 21) done = true; }
        else if (ch === 'S') done = true;
        else if (ch === 'D') { stake = e.b * 2; p.push(draw()); done = true; }
      }
      if (done) {
        var pv = bjTotal(p);
        if (pv <= 21) {
          while (bjTotal(dl) < 17) dl.push(draw());
          var dv = bjTotal(dl);
          ret = dv > 21 || pv > dv ? stake * 2 : pv === dv ? stake : 0;
        }
      }
    }
    out.push({ stake: stake, ret: done ? ret : 0, done: done, p: p, d: dl, nat: nat });
  });
  return out;
}

var GAMES = {
  crash: {
    name: 'Crash', icon: '🚀', tag: 'Timing', desc: 'Steig aus, bevor die Rakete explodiert. Dieselben Absturzpunkte für beide.',
    rounds: function (d) { return (d.points || []).length || 10; },
    results: function (d) {
      return d.log.map(function (e, i) { var won = e.c && e.c <= d.points[i]; return { stake: e.b, ret: won ? payout(e.b, e.c) : 0, done: true }; });
    }
  },
  tower: {
    name: 'Dragon Tower', icon: '🐉', tag: 'Mut', desc: 'Klettere durch dieselben Türme. Jede Etage zahlt mehr, ein Drache nimmt alles.',
    rounds: function (d) { return (d.setup || []).length || 10; },
    results: function (d) {
      return d.log.map(function (e, i) {
        var picks = e.p || [], lost = picks.length === 0;
        picks.forEach(function (t, k) { if (t === d.setup[i][k]) lost = true; });
        return { stake: e.b, ret: lost ? 0 : payout(e.b, TOWER_MULTS[picks.length - 1]), done: !!e.f || lost };
      });
    }
  },
  bj: {
    name: 'Blackjack', icon: '🂡', tag: 'Strategie', desc: 'Derselbe Kartenschuh für beide. Ziehen, halten oder verdoppeln entscheidet.',
    rounds: function () { return 8; },
    results: bjReplay
  }
};
function gameOf(d) { return GAMES[d.game] || GAMES.crash; }
function stackOf(d) {
  var s = START;
  /* Gewinne zählen erst, wenn die Runde vorbei ist (z. B. Turm noch nicht ausgezahlt) */
  gameOf(d).results(d).forEach(function (r) { s += (r.done ? r.ret : 0) - r.stake; });
  return s;
}
function finished(d) {
  var r = gameOf(d).results(d), last = r[r.length - 1];
  if (last && !last.done) return false;
  return d.log.length >= gameOf(d).rounds(d) || stackOf(d) <= 0;
}
function minBet(s) { return Math.min(MIN_BET, s); }
/* Netto pro Runde für den Rundenvergleich nach dem Duell */
function nets(game, points, setup, log) {
  var d = { game: game, points: (points || []).map(Number), setup: setup, log: log || [] };
  return gameOf(d).results(d).map(function (r) { return r.ret - r.stake; });
}

/* ================= Zustand, auch über ein Neuladen hinweg ================= */
/* cur: { id, opp, role, game, points, setup, log, user, started, live }
   live = gleichzeitig gespielt (neu); ohne live läuft ein älteres Duell zum Nacheinander-Spielen zu Ende. */
var cur = null, onDone = null, bet = 100, phase = 'bet', lockUntil = 0;
/* L: letzter Live-Stand vom Server (Gegner, Status, Ergebnis) */
var L = null, liveTimer = 0, ticking = false, countTimer = 0, waitSince = 0;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* */ } }
function forget() { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }
function pending() {
  var a = Cloud.current();
  if (!a) return null;
  try {
    var d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!d || d.user !== a.id) return null;
    if (Date.now() - d.started > LIMIT_MS) { forget(); return null; }
    d.game = d.game || 'crash';
    return d;
  } catch (e) { return null; }
}

/* ================= Fenster ================= */
var dlg, titleEl, vsEl, leadEl, dotsEl, roundEl, stackEl, areaEl, betsEl, actsEl, mainBtn, msgEl, resultEl, countEl;
function build() {
  titleEl = el('h2', { id: 'duelTitle' });
  vsEl = el('div', { class: 'dv-vs' });
  leadEl = el('div', { class: 'dv-lead', 'aria-live': 'polite', hidden: true });
  dotsEl = el('div', { class: 'dv-dots', 'aria-label': 'Runden' });
  roundEl = el('b', { class: 'num' }); stackEl = el('b', { class: 'num dv-stack' });
  areaEl = el('div', { class: 'dv-area' });
  betsEl = el('div', { class: 'duel-bets', role: 'group', 'aria-label': 'Einsatz' });
  actsEl = el('div', { class: 'dv-acts' });
  mainBtn = el('button', { class: 'btn gold big', type: 'button', onclick: onMain });
  msgEl = el('div', { class: 'slot-msg', 'aria-live': 'polite' });
  resultEl = el('div', { class: 'dv-result', hidden: true });
  countEl = el('div', { class: 'dv-count', hidden: true, 'aria-live': 'assertive' });
  dlg = el('div', { class: 'drawer duel-dlg', hidden: true },
    el('div', { class: 'drawer-panel duel-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'duelTitle' },
      el('header', { class: 'drawer-h' }, titleEl,
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', text: '✕', onclick: tryClose })),
      el('section', { class: 'side duel-body' },
        vsEl, leadEl,
        el('div', { class: 'dv-top' },
          el('div', { class: 'dv-round' }, el('span', { text: 'Runde' }), roundEl),
          dotsEl,
          el('div', { class: 'dv-chips' }, el('span', { text: 'Duell-Chips' }), stackEl)),
        areaEl, resultEl, msgEl,
        el('div', { class: 'duel-ctl' }, betsEl, actsEl, mainBtn)),
      countEl));
  document.body.appendChild(dlg);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', function () { if (isOpen() && play.onResize) play.onResize(); });
}
function isOpen() { return !!dlg && !dlg.hidden; }

function avatar(name, me) { return el('span', { class: 'avatar' + (me ? ' me' : ''), text: name ? name.charAt(0) : '?' }); }
/* Chips nach jeder fertigen Runde */
function myProg() {
  var s = START, out = [];
  gameOf(cur).results(cur).forEach(function (r) { if (!r.done) return; s += r.ret - r.stake; out.push(s); });
  return out;
}
/* Stand des Gegners. Fair: seine Chips nur bis zu der Runde, die du selbst schon gespielt hast,
   sonst könnte man z. B. aus seinem Crash-Gewinn den Absturzpunkt ablesen. Seine Rundenzahl siehst du immer. */
function oppView() {
  if (!L) return null;
  var op = (L.opp_prog || []).map(Number), mine = myProg().length;
  var all = phase === 'waitOpp' || phase === 'done' || phase === 'submit';
  var k = all ? op.length : Math.min(op.length, mine);
  return { played: op.length, k: k, stack: k ? op[k - 1] : START, done: !!L.opp_done, away: Number(L.opp_away) || 0 };
}
function renderVs() {
  var me = Cloud.current(), G = gameOf(cur), n = G.rounds(cur), mp = myProg();
  vsEl.innerHTML = '';
  vsEl.classList.toggle('live', !!cur.live);
  var mySub = cur.live ? (phase === 'waitOpp' || phase === 'done' ? 'fertig ✓' : 'R' + Math.min(n, mp.length + 1) + '/' + n) : '';
  vsEl.appendChild(el('div', { class: 'dv-side' }, avatar(me && me.username, true), el('b', { text: 'Du' }),
    cur.live ? el('small', {}, el('span', { class: 'num dv-mini', text: fmt(mp.length ? mp[mp.length - 1] : START) }), ' · ' + mySub) : null));
  vsEl.appendChild(el('div', { class: 'dv-mid' }, el('span', { class: 'dv-game', text: G.icon + ' ' + G.name }), el('span', { class: 'dv-tag', text: 'VS' }),
    cur.live && phase !== 'wait' && phase !== 'done' ? el('span', { class: 'dv-livetag', text: '● LIVE' }) : null));
  var right;
  if (!cur.live) right = el('small', { text: cur.role === 'b' ? 'hat schon gespielt' : cur.opp ? 'spielt danach' : 'jeder kann annehmen' });
  else if (phase === 'wait' || !L || !cur.opp) right = el('small', { text: cur.opp ? 'eingeladen …' : 'noch niemand' });
  else {
    var o = oppView(), txt = o.done ? 'fertig ✓' : o.away > 15 ? '⚠ weg (' + Math.round(o.away) + ' s)' : 'R' + Math.min(n, o.played + 1) + '/' + n;
    right = el('small', {}, el('span', { class: 'num dv-mini', text: fmt(o.stack) }), ' · ' + txt);
  }
  vsEl.appendChild(el('div', { class: 'dv-side r' }, avatar(cur.opp), el('b', { text: cur.opp || 'Offen für alle' }), right));
  /* Wer liegt vorn? Verglichen wird nach derselben Runde */
  var show = cur.live && L && cur.opp && phase !== 'wait' && phase !== 'count' && phase !== 'done';
  leadEl.hidden = !show;
  if (show) {
    var ov = oppView(), k = ov.k, a = k ? mp[k - 1] : START, d = a - ov.stack;
    leadEl.className = 'dv-lead ' + (d > 0 ? 'up' : d < 0 ? 'down' : '');
    leadEl.textContent = !k ? 'Noch alles offen: beide 1.000' : 'Nach Runde ' + k + ': ' + (d > 0 ? 'Du führst mit +' + fmt(d) : d < 0 ? 'Du liegst ' + fmt(-d) + ' zurück' : 'Gleichstand');
  }
}
function canRematch() { return !!(cur.live && cur.opp && L && L.status === 'done'); }
function render() {
  var G = gameOf(cur), n = G.rounds(cur), res = G.results(cur), s = stackOf(cur);
  var curIdx = phase === 'bet' ? cur.log.length : cur.log.length - 1;
  roundEl.textContent = Math.min(n, Math.max(1, curIdx + 1)) + ' / ' + n;
  stackEl.textContent = fmt(s);
  dotsEl.innerHTML = '';
  for (var i = 0; i < n; i++) {
    var r = res[i], cls = 'dv-dot';
    if (r && r.done) cls += r.ret > r.stake ? ' win' : r.ret === r.stake ? ' push' : ' loss';
    else if (i === curIdx && (phase === 'bet' || phase === 'play')) cls += ' cur';
    dotsEl.appendChild(el('i', { class: cls, title: r && r.done ? 'Runde ' + (i + 1) + ': ' + (r.ret - r.stake >= 0 ? '+' : '−') + fmt(Math.abs(r.ret - r.stake)) : 'Runde ' + (i + 1) }));
  }
  betsEl.innerHTML = '';
  betsEl.hidden = phase !== 'bet';
  var mn = minBet(s);
  if (bet > s || bet < mn) bet = Math.max(mn, Math.min(bet, s));
  BETS.concat(['all']).forEach(function (v) {
    var val = v === 'all' ? s : v, ok = val >= mn && val <= s;
    betsEl.appendChild(el('button', { class: 'chipbtn' + (bet === val ? ' on' : ''), type: 'button', disabled: !ok,
      'aria-pressed': String(bet === val), text: v === 'all' ? 'Alles' : fmt(v),
      onclick: function () { bet = val; V.Snd.chip(); render(); } }));
  });
  /* Hauptknopf: im Einsatz-Schritt Start, sonst bestimmt das Spiel */
  var m = phase === 'bet' ? { label: play.startLabel + ' · ' + fmt(bet) }
    : phase === 'play' ? play.main()
    : phase === 'submit' ? { label: 'Wird gewertet …', disabled: true }
    : phase === 'retry' ? { label: 'Ergebnis erneut senden' }
    : phase === 'wait' ? { label: 'Einladung zurückziehen' }
    : phase === 'count' || phase === 'sync' || phase === 'waitOpp' ? null
    : { label: canRematch() ? '⚔ Revanche' : 'Zur Arena' };
  mainBtn.hidden = !m;
  if (m) { mainBtn.textContent = m.label; mainBtn.disabled = !!m.disabled; mainBtn.classList.toggle('cash', !!m.cash); mainBtn.classList.toggle('ghost', phase === 'wait'); mainBtn.classList.toggle('gold', phase !== 'wait'); }
  actsEl.innerHTML = '';
  if (phase === 'play' && play.acts) play.acts(actsEl);
  if (phase === 'done' && canRematch()) actsEl.appendChild(el('button', { class: 'btn ghost', type: 'button', text: 'Schließen', onclick: close }));
  if (cur.live) renderVs();
}

/* ================= Ablauf ================= */
var play = null;
var api = {
  /* Spiel meldet Fortschritt (z. B. Feld gewählt) */
  save: function () { persist(); render(); },
  /* Spiel meldet: Runde vorbei */
  over: function () {
    var e = cur.log[cur.log.length - 1];
    e.f = 1;
    persist();
    phase = finished(cur) ? 'submit' : 'bet';
    lockUntil = performance.now() + 900;
    render();
    if (cur.live) tick();
    if (phase === 'submit') setTimeout(submit, 1100);
  },
  msg: function (t, cls) { msgEl.className = 'slot-msg' + (cls ? ' ' + cls : ''); msgEl.textContent = t || ''; },
  entry: function () { return cur.log[cur.log.length - 1]; },
  index: function () { return cur.log.length - 1; },
  get cur() { return cur; }
};

function open(d, done) {
  if (!dlg) build();
  cur = d; onDone = done || null; L = null;
  persist();
  play = PLAY[cur.game] || PLAY.crash;
  titleEl.textContent = (cur.live ? 'Live-' : '') + gameOf(cur).name + '-Duell';
  dlg.hidden = false;
  resultEl.hidden = true; areaEl.hidden = false; countEl.hidden = true;
  areaEl.innerHTML = '';
  play.build(areaEl);
  api.msg('');
  renderVs();
  bet = Math.min(bet, stackOf(cur)) || MIN_BET;
  if (cur.live) {
    /* Erst beim Server nachsehen, wo das Duell steht (Warteraum, Countdown, läuft, fertig) */
    phase = 'sync'; play.idle(); render();
    clearInterval(liveTimer); liveTimer = setInterval(tick, 2000);
    tick(true);
  } else resumePlay();
  requestAnimationFrame(function () { if (play.onResize) play.onResize(); if (!mainBtn.hidden) mainBtn.focus(); });
}
/* Weiterspielen: Crash-Runden in der Luft sind nach einem Neuladen verloren, Turm und Blackjack gehen weiter */
function resumePlay() {
  var last = cur.log[cur.log.length - 1];
  if (last && !last.f && play.resume && play.resume(last)) phase = 'play';
  else { if (last) last.f = 1; phase = finished(cur) ? 'submit' : 'bet'; play.idle(); }
  render();
  if (phase === 'submit') submit();
}
function newState(info) {
  var a = Cloud.current();
  return { id: info.id, opp: info.opp || '', role: info.role, game: info.game || 'crash', points: (info.points || []).map(Number), setup: info.setup || null,
    log: [], user: a.id, started: Date.now(), live: !!info.live };
}
function start(info, done) { if (Cloud.current()) open(newState(info), done); }
function resume(done) { var d = pending(); if (d) open(d, done); }
/* Live-Duell anlegen: du wartest im Warteraum, bis jemand annimmt */
async function invite(opp, game, done) {
  var r = await Cloud.rpc('duel_invite', { opp: opp || null, gm: game });
  open(newState({ id: r.id, opp: opp || '', role: 'a', game: r.game || game, points: r.points, setup: r.setup, live: true }), done);
}
/* Einladung annehmen: Live startet nach einem kurzen Countdown, ältere Duelle wie bisher */
async function join(id, opp, done) {
  var r = await Cloud.rpc('duel_join', { did: id });
  open(newState({ id: id, opp: r.opponent || opp, role: 'b', game: r.game, points: r.points, setup: r.setup, live: r.mode === 'live' }), done);
}

/* ---------- Live: Stand senden und abholen ---------- */
async function tick(first) {
  if (!cur || !cur.live || ticking || !isOpen() || phase === 'done') return;
  ticking = true;
  try { L = await Cloud.rpc('duel_live', { did: cur.id, prog: phase === 'wait' ? null : myProg() }); }
  catch (e) {
    ticking = false;
    if (/nicht gefunden/.test(e.message || '')) ended('Dieses Duell gibt es nicht mehr.');
    return;
  }
  ticking = false;
  if (!cur) return;
  if (L.opponent && cur.opp !== L.opponent) { cur.opp = L.opponent; persist(); }
  if (phase === 'sync') decide();
  else if (phase === 'wait') {
    if (L.status === 'live') beginCount(Number(L.start_in) || 0);
    else if (L.status !== 'invited') ended(L.status === 'declined' ? (cur.opp || 'Der Gegner') + ' hat abgelehnt.' : 'Die Einladung ist abgelaufen.');
    else renderWait();
  } else if (L.status === 'done') { if (phase !== 'submit') liveResult(); }
  else if (L.status === 'void') ended('Dieses Duell wurde vom Team annulliert.');
  else if (L.status === 'expired') ended('Die Einladung ist abgelaufen.');
  else if (phase === 'waitOpp') renderWaitOpp();
  render();
}
function decide() {
  if (L.status === 'invited') { if (cur.role === 'a') { phase = 'wait'; waitSince = Date.now(); renderWait(); } else ended('Die Einladung ist noch nicht angenommen.'); }
  else if (L.status === 'live') {
    if (L.my_score != null) { phase = 'waitOpp'; renderWaitOpp(); }
    else if (Number(L.start_in) > 0.3) beginCount(Number(L.start_in));
    else { resultEl.hidden = true; areaEl.hidden = false; resumePlay(); }
  } else if (L.status === 'done') liveResult();
  else ended(L.status === 'declined' ? 'Die Einladung wurde abgelehnt.' : L.status === 'void' ? 'Dieses Duell wurde vom Team annulliert.' : 'Die Einladung ist abgelaufen.');
}
/* Warteraum für den Einladenden */
function renderWait() {
  phase = 'wait'; api.msg('');
  areaEl.hidden = true; resultEl.hidden = false; resultEl.className = 'dv-result dv-wait'; resultEl.innerHTML = '';
  var secs = Math.round((Date.now() - (waitSince || Date.now())) / 1000);
  resultEl.appendChild(el('div', { class: 'dv-res-h dv-spin', text: '⏳' }));
  resultEl.appendChild(el('div', { class: 'dv-res-big dv-wait-t', text: cur.opp ? 'Warte auf ' + cur.opp : 'Warte auf einen Gegner' }));
  resultEl.appendChild(el('p', { class: 'fine', text: cur.opp
    ? cur.opp + ' bekommt deine Einladung jetzt angezeigt. Sobald angenommen ist, startet ihr beide gleichzeitig.'
    : 'Deine Herausforderung steht in der Arena unter „Offene Herausforderungen“. Wer zuerst annimmt, spielt live gegen dich.' }));
  resultEl.appendChild(el('p', { class: 'fine', text: 'Die Einladung gilt, solange dieses Fenster offen ist · ' + V.clock(secs * 1000) }));
}
/* 3, 2, 1, los: beide starten zur selben Zeit (der Server gibt den Startzeitpunkt vor) */
function beginCount(secs) {
  phase = 'count';
  resultEl.hidden = true; areaEl.hidden = false; play.idle();
  var end = performance.now() + Math.max(0, secs) * 1000;
  V.Snd.unlock();
  clearInterval(countTimer);
  function step() {
    var left = Math.ceil((end - performance.now()) / 1000);
    countEl.hidden = false;
    if (left > 0) { if (countEl.dataset.n !== String(left)) { countEl.dataset.n = String(left); countEl.innerHTML = ''; countEl.appendChild(el('b', { text: String(left) })); countEl.appendChild(el('span', { text: 'gegen ' + (cur.opp || '?') })); V.Snd.tick(); } return; }
    clearInterval(countTimer);
    countEl.innerHTML = ''; countEl.appendChild(el('b', { class: 'go', text: 'Los!' }));
    V.Snd.big();
    setTimeout(function () { countEl.hidden = true; countEl.dataset.n = ''; }, 700);
    phase = 'bet'; api.msg('Ihr spielt gleichzeitig. Oben siehst du, wie ' + (cur.opp || 'dein Gegner') + ' steht.');
    render(); mainBtn.focus();
  }
  countTimer = setInterval(step, 100); step();
  render();
}
/* Du bist fertig, der Gegner spielt noch */
function renderWaitOpp() {
  phase = 'waitOpp';
  var o = oppView(), n = gameOf(cur).rounds(cur), mine = L && L.my_score != null ? Number(L.my_score) : stackOf(cur);
  areaEl.hidden = true; resultEl.hidden = false; resultEl.className = 'dv-result dv-wait'; resultEl.innerHTML = '';
  resultEl.appendChild(el('div', { class: 'dv-res-h dv-spin', text: '⏳' }));
  resultEl.appendChild(el('div', { class: 'dv-res-big', text: fmt(mine) }));
  resultEl.appendChild(el('p', { class: 'fine', text: 'Du bist fertig. ' + (cur.opp || 'Dein Gegner') + (o && o.done ? ' ist auch fertig, gleich steht das Ergebnis fest.' : ' spielt noch Runde ' + Math.min(n, (o ? o.played : 0) + 1) + ' von ' + n + ' und hat gerade ' + fmt(o ? o.stack : START) + ' Chips.') }));
  resultEl.appendChild(el('p', { class: 'fine', text: 'Du kannst das Fenster schließen, das Ergebnis kommt dann in der Arena.' }));
}
function ended(msg) {
  clearInterval(liveTimer); clearInterval(countTimer); countEl.hidden = true;
  forget();
  phase = 'done';
  areaEl.hidden = true; resultEl.hidden = false; resultEl.className = 'dv-result'; resultEl.innerHTML = '';
  resultEl.appendChild(el('div', { class: 'dv-res-h', text: '🕊️' }));
  resultEl.appendChild(el('p', { text: msg }));
  render();
}

function onMain() {
  V.Snd.ensure();
  if (phase === 'bet') {
    if (performance.now() < lockUntil) return;
    var s = stackOf(cur);
    bet = Math.max(minBet(s), Math.min(bet, s));
    cur.log.push({ b: bet });
    persist();
    phase = 'play';
    api.msg('');
    play.begin(cur.log[cur.log.length - 1]);
    render();
  } else if (phase === 'play') { var m = play.main(); if (m && m.fn && !m.disabled) m.fn(); }
  else if (phase === 'retry') submit();
  else if (phase === 'wait') cancelInvite();
  else if (phase === 'done') {
    if (canRematch()) rematch();
    else close();
  }
}
function cancelInvite() {
  Cloud.rpc('duel_cancel', { did: cur.id }).catch(function () { /* verfällt sowieso nach 30 Sekunden */ });
  forget(); phase = 'done'; close();
}
/* Revanche: dasselbe Spiel gegen denselben Gegner, er bekommt sofort eine Einladung */
function rematch() {
  var opp = cur.opp, game = cur.game, cb = onDone;
  close(true);
  invite(opp, game, cb).catch(function (e) { V.toast(e.message || String(e), 'bad'); if (cb) cb(); });
}

/* ---------- Ergebnis ---------- */
async function submit(quit) {
  phase = 'submit'; render();
  try {
    var log = cur.log.map(function (e) { var c = Object.assign({}, e); delete c.f; return c; });
    var score = await Cloud.rpc('duel_submit', { did: cur.id, lg: quit ? [] : log, quit: !!quit });
    if (cur.live) {
      if (quit) { forget(); ended('Du hast aufgegeben. Das Duell zählt mit 0 Chips.'); return; }
      phase = 'waitOpp'; L = L || {}; L.my_score = score; renderWaitOpp(); render();
      ticking = false; tick();
      return;
    }
    forget();
    await showResult(Number(score), quit);
  } catch (e) {
    /* Ist das Duell auf dem Server schon gewertet (z. B. abgelaufen), gibt es nichts mehr zu senden */
    if (/kein Ergebnis abgeben|nicht gefunden/.test(e.message || '')) {
      if (cur.live) { phase = 'sync'; ticking = false; tick(); return; }
      forget(); phase = 'done'; api.msg(e.message); render(); return;
    }
    phase = 'retry'; api.msg('Senden fehlgeschlagen: ' + (e.message || e) + ' Dein Ergebnis bleibt gespeichert.');
    render();
  }
}
/* Live-Ergebnis: beide sehen es im selben Moment */
function liveResult() {
  clearInterval(liveTimer); clearInterval(countTimer); countEl.hidden = true;
  forget();
  phase = 'done';
  var mine = Number(L.my_score), theirs = Number(L.their_score), d = Number(L.my_delta) || 0;
  var cls = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
  areaEl.hidden = true; resultEl.hidden = false; resultEl.innerHTML = ''; api.msg('');
  resultEl.className = 'dv-result ' + cls;
  resultEl.appendChild(el('div', { class: 'dv-res-h', text: cls === 'win' ? '🏆' : cls === 'loss' ? '💥' : '🤝' }));
  resultEl.appendChild(el('div', { class: 'dv-res-big', text: cls === 'win' ? 'Sieg!' : cls === 'loss' ? 'Niederlage' : 'Unentschieden' }));
  resultEl.appendChild(el('div', { class: 'dv-score' },
    el('div', {}, el('span', { text: 'Du' }), el('b', { class: 'num', text: fmt(mine) })),
    el('span', { class: 'dv-colon', text: ':' }),
    el('div', {}, el('span', { text: cur.opp || L.opponent || 'Gegner' }), el('b', { class: 'num', text: fmt(theirs) }))));
  var forfeit = (L.their_log && !L.their_log.length && theirs === 0) ? (cur.opp || 'Dein Gegner') + ' hat aufgegeben oder die Verbindung verloren. ' : '';
  resultEl.appendChild(el('p', { class: 'fine', text: forfeit + 'Wertung ' + (d >= 0 ? '+' : '−') + Math.abs(d) + ' Punkte.' }));
  if (cls === 'win') { V.Snd.big(); V.burst(resultEl, 40); } else if (cls === 'loss') V.Snd.lose(); else V.Snd.win();
  render();
}
async function showResult(score, quit) {
  phase = 'done';
  areaEl.hidden = true; resultEl.hidden = false; resultEl.innerHTML = ''; api.msg('');
  var big, sub, cls = '';
  if (cur.role === 'a') {
    big = quit ? 'Aufgegeben' : fmt(score);
    sub = quit ? 'Das Duell zählt mit 0 Duell-Chips.' : 'Duell-Chips am Ende. ' + (cur.opp ? cur.opp + ' ist jetzt dran, das Ergebnis siehst du in der Arena.' : 'Deine Herausforderung ist offen, jeder kann sie annehmen.');
    resultEl.appendChild(el('div', { class: 'dv-res-h', text: quit ? '🏳️' : '📨' }));
  } else {
    var row = null;
    try { (await Cloud.rpc('duel_list')).forEach(function (r) { if (r.id === cur.id) row = r; }); } catch (e) { /* */ }
    if (row && row.their_score != null) {
      var mine = Number(row.my_score), theirs = Number(row.their_score), d = row.my_delta || 0;
      cls = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
      big = cls === 'win' ? 'Sieg!' : cls === 'loss' ? 'Niederlage' : 'Unentschieden';
      resultEl.appendChild(el('div', { class: 'dv-res-h', text: cls === 'win' ? '🏆' : cls === 'loss' ? '💥' : '🤝' }));
      resultEl.appendChild(el('div', { class: 'dv-score' },
        el('div', {}, el('span', { text: 'Du' }), el('b', { class: 'num', text: fmt(mine) })),
        el('span', { class: 'dv-colon', text: ':' }),
        el('div', {}, el('span', { text: row.opponent || cur.opp }), el('b', { class: 'num', text: fmt(theirs) }))));
      sub = 'Wertung ' + (d >= 0 ? '+' : '−') + Math.abs(d) + ' Punkte.';
      if (cls === 'win') { V.Snd.big(); V.burst(resultEl, 30); } else if (cls === 'loss') V.Snd.lose();
    } else { big = fmt(score); sub = 'Duell-Chips am Ende. Das Ergebnis siehst du in der Arena.'; }
  }
  resultEl.className = 'dv-result ' + cls;
  resultEl.insertBefore(el('div', { class: 'dv-res-big', text: big }), resultEl.children[1] || null);
  resultEl.appendChild(el('p', { class: 'fine', text: sub }));
  render();
}

function close(silent) {
  if (play && play.stop) play.stop();
  clearInterval(liveTimer); clearInterval(countTimer);
  if (countEl) countEl.hidden = true;
  dlg.hidden = true;
  var cb = onDone; onDone = null;
  if (phase === 'done') cur = null;
  if (cb && silent !== true) cb();
}
/* Live: Mitten im Duell gibt es nur Aufgeben. Ältere Duelle: zwischen den Runden pausieren. */
function tryClose() {
  if (phase === 'done' || phase === 'retry') { close(); return; }
  if (phase === 'submit') return;
  if (phase === 'wait') { cancelInvite(); return; }
  if (phase === 'waitOpp' || phase === 'sync') { close(); return; }
  if (cur.live) {
    V.banner('Duell aufgeben?', 'Im Live-Duell gibt es keine Pause. Gibst du auf, zählt es für dich mit 0 Chips. Kurz die App wechseln ist okay, nach 2 Minuten ohne dich ist das Duell verloren.', {
      kind: 'level', ms: 15000, actions: [{ label: 'Weiterspielen', gold: true, fn: function () {} }, { label: 'Aufgeben', fn: function () { if (play.stop) play.stop(); submit(true); } }] });
    return;
  }
  if (phase === 'play' && !play.pausable) { V.toast('Warte, bis die Runde vorbei ist.', 'bad'); return; }
  V.banner('Duell pausieren?', 'Du kannst innerhalb von 30 Minuten in der Arena weiterspielen. Danach zählt das Duell mit 0 Chips.', {
    kind: 'level', ms: 15000, actions: [{ label: 'Pausieren', gold: true, fn: close }, { label: 'Aufgeben', fn: function () { if (play.stop) play.stop(); submit(true); } }, { label: 'Weiterspielen', fn: function () {} }] });
}
function onKey(e) {
  if (!isOpen()) return;
  var tag = (e.target && e.target.tagName) || '';
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tryClose(); return; }
  if (phase === 'play' && play.key && play.key(e.key.toLowerCase())) { e.preventDefault(); e.stopPropagation(); return; }
  if (e.key === ' ' || (e.key === 'Enter' && tag !== 'BUTTON')) {
    e.preventDefault(); e.stopPropagation(); if (!mainBtn.disabled && !mainBtn.hidden) onMain();
    return;
  }
  /* Andere Tasten sollen nicht im Spiel dahinter landen */
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) e.stopPropagation();
}

/* ================= Spielansichten ================= */
var PLAY = {};

/* ---------- Crash ---------- */
PLAY.crash = (function () {
  var cv, ctx, stage, multEl, subEl, running = false, cashed = false, t0 = 0, raf = 0, curM = 1, curT = 0, crashedAt = 0, cashAt = 0, lastTick = 0, colors = {};
  function cp() { return cur.points[api.index()]; }
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ['--gold-hi', '--crimson', '--good'].forEach(function (k) { colors[k] = cs.getPropertyValue(k).trim() || '#ccc'; });
  }
  function size() {
    if (!cv) return;
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
    ctx.beginPath(); ctx.moveTo(X(0), Y(1));
    for (var i = 1; i <= 60; i++) { var t = curT * i / 60; ctx.lineTo(X(t), Y(Math.min(E.crashMult(t), curM))); }
    ctx.strokeStyle = crashedAt ? colors['--crimson'] : colors['--gold-hi']; ctx.lineWidth = 3 * d; ctx.lineJoin = 'round'; ctx.stroke();
    if (cashed && cashAt <= curM) {
      ctx.setLineDash([4 * d, 4 * d]); ctx.strokeStyle = colors['--good']; ctx.lineWidth = 1.5 * d;
      ctx.beginPath(); ctx.moveTo(pad, Y(cashAt)); ctx.lineTo(w - pad, Y(cashAt)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.save(); ctx.translate(X(curT), Y(curM)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = (crashedAt ? 34 : 26) * d + 'px serif';
    ctx.fillText(crashedAt ? '💥' : '🚀', 0, 0);
    ctx.restore();
  }
  function loop(now) {
    if (!running) return;
    curT = (now - t0) / 1000;
    curM = E.crashMult(curT);
    if (curM >= cp()) { curM = cp(); curT = E.crashTime(curM); crash(); return; }
    multEl.textContent = fmtX(Math.floor(curM * 100) / 100);
    if (!cashed) render();
    if (now - lastTick > Math.max(70, 260 - curM * 20)) { V.Snd.tick(); lastTick = now; }
    draw();
    raf = requestAnimationFrame(loop);
  }
  function cashout() {
    var at = Math.floor(curM * 100) / 100, e = api.entry();
    if (!running || cashed || at < 1.01 || at > cp()) return;
    cashed = true; cashAt = at; e.c = at;
    persist();
    V.Snd.cash();
    subEl.textContent = 'Ausgezahlt bei ' + fmtX(at) + ': +' + fmt(payout(e.b, at) - e.b);
    render();
  }
  function crash() {
    running = false; crashedAt = cp();
    cancelAnimationFrame(raf);
    stage.classList.remove('flying');
    multEl.textContent = fmtX(crashedAt); multEl.className = 'crash-mult dead';
    if (!cashed) { V.Snd.crash(); subEl.textContent = 'Abgestürzt bei ' + fmtX(crashedAt) + '. Einsatz verloren.'; }
    else subEl.textContent = 'Abgestürzt bei ' + fmtX(crashedAt) + ' · du warst bei ' + fmtX(cashAt) + ' raus.';
    draw();
    api.over();
  }
  return {
    startLabel: 'Einsteigen',
    pausable: false,
    build: function (area) {
      cv = el('canvas', { class: 'crash-cv', 'aria-hidden': 'true' });
      multEl = el('div', { class: 'crash-mult', text: '1,00×' });
      subEl = el('div', { class: 'crash-sub', 'aria-live': 'polite' });
      stage = el('div', { class: 'crash-stage duel-stage' }, cv, el('div', { class: 'crash-over' }, multEl, subEl));
      area.appendChild(stage);
      readColors();
    },
    idle: function () { running = false; multEl.className = 'crash-mult'; if (!cur.log.length) { multEl.textContent = '1,00×'; subEl.textContent = 'Wähle deinen Einsatz und steig ein.'; } },
    begin: function () {
      running = true; cashed = false; cashAt = 0; curM = 1; curT = 0; crashedAt = 0;
      api.entry().c = 0; persist();
      stage.classList.add('flying');
      multEl.className = 'crash-mult live'; subEl.textContent = 'Läuft …';
      size();
      t0 = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    main: function () {
      if (!cashed) return { label: 'Auszahlen · ' + fmt(payout(api.entry().b, Math.max(1, Math.floor(curM * 100) / 100))), cash: true, fn: cashout };
      return { label: 'Überspringen', fn: function () { curM = cp(); curT = E.crashTime(curM); crash(); } };
    },
    stop: function () { running = false; cancelAnimationFrame(raf); },
    onResize: function () { size(); draw(); }
  };
})();

/* ---------- Dragon Tower: 9 Etagen, 3 Felder, 1 Drache ---------- */
PLAY.tower = (function () {
  var towerEl, KEYS = ['a', 's', 'd'];
  function layout() { return cur.setup[api.index()]; }
  function draw(reveal) {
    var e = api.entry(), picks = (e && e.p) || [], lay = e ? layout() : null;
    var lost = e && picks.some(function (t, k) { return t === lay[k]; });
    var floor = picks.length, live = e && !e.f && !lost;
    towerEl.innerHTML = '';
    for (var f = 8; f >= 0; f--) (function (f) {
      var curF = live && f === floor, done = e && f < floor;
      var row = el('div', { class: 'tw-floor' + (curF ? ' cur' : '') + (done ? ' done' : '') });
      var tiles = el('div', { class: 'tw-tiles' });
      for (var t = 0; t < 3; t++) (function (t) {
        var picked = picks[f] === t, dragon = lay && lay[f] === t;
        var show = e && (f < floor || reveal);
        var cls = 'tw-tile' + (picked ? ' picked' : '') + (show ? (dragon ? ' dragon' : ' safe') : '');
        tiles.appendChild(el('button', { class: cls, type: 'button', disabled: !curF, 'aria-label': 'Etage ' + (f + 1) + ', Feld ' + (t + 1),
          onclick: function () { pick(t); } }, show ? (dragon ? '🐉' : '💎') : (curF ? V.kbd(KEYS[t].toUpperCase()) : '')));
      })(t);
      row.appendChild(el('span', { class: 'tw-no', text: String(f + 1) }));
      row.appendChild(tiles);
      row.appendChild(el('span', { class: 'tw-mult', text: fmtX(TOWER_MULTS[f]) }));
      towerEl.appendChild(row);
    })(f);
  }
  function pick(t) {
    var e = api.entry();
    if (!e || e.f) return;
    e.p = (e.p || []).concat([t]);
    var f = e.p.length - 1;
    if (layout()[f] === t) {
      V.Snd.crash();
      api.msg('Ein Drache in Etage ' + (f + 1) + '! Einsatz verloren.');
      draw(true); api.over(); return;
    }
    V.Snd.chip();
    if (e.p.length >= 9) { V.Snd.big(); api.msg('Ganz oben! ' + fmtX(TOWER_MULTS[8]) + ' für dich.', 'win'); draw(true); api.over(); return; }
    api.msg('Sicher! Weiter nach oben oder auszahlen.');
    draw(); api.save();
  }
  function cash() {
    var e = api.entry();
    if (!e || !(e.p || []).length) return;
    V.Snd.cash();
    api.msg('Ausgezahlt bei ' + fmtX(TOWER_MULTS[e.p.length - 1]) + ': +' + fmt(payout(e.b, TOWER_MULTS[e.p.length - 1]) - e.b), 'win');
    draw(true); api.over();
  }
  return {
    startLabel: 'Turm betreten',
    pausable: true,
    build: function (area) { towerEl = el('div', { class: 'tower dv-tower' }); towerEl.style.setProperty('--tiles', 3); area.appendChild(towerEl); },
    idle: function () { towerEl.innerHTML = ''; draw(false); if (!cur.log.length) api.msg('Jede Runde ein neuer Turm. Wähle pro Etage ein Feld, unter einem schläft ein Drache.'); },
    begin: function () { api.entry().p = []; persist(); draw(); api.msg('Etage 1: Welches Feld ist sicher?'); },
    resume: function () { draw(); api.msg('Weiter geht’s in Etage ' + ((api.entry().p || []).length + 1) + '.'); return true; },
    main: function () {
      var e = api.entry(), n = (e.p || []).length;
      if (!n) return { label: 'Wähle ein Feld in Etage 1', disabled: true };
      return { label: 'Auszahlen · ' + fmt(payout(e.b, TOWER_MULTS[n - 1])), cash: true, fn: cash };
    },
    key: function (k) { var i = KEYS.indexOf(k); if (i < 0) return false; pick(i); return true; }
  };
})();

/* ---------- Blackjack: Ziehen, Halten, Verdoppeln ---------- */
PLAY.bj = (function () {
  var dealerEl, playerEl, dvEl, pvEl;
  function isRed(c) { return c.s === '♥' || c.s === '♦'; }
  function cardEl(c, down) {
    if (down) return el('div', { class: 'pcard back', 'aria-label': 'Verdeckte Karte' });
    return el('div', { class: 'pcard ' + (isRed(c) ? 'red' : 'blk'), 'aria-label': c.r + ' ' + c.s },
      el('span', { class: 'cr', text: c.r }), el('span', { class: 'cs', text: c.s }), el('span', { class: 'cmid', text: c.s }),
      el('span', { class: 'cbr' }, el('b', { text: c.r }), el('i', { text: c.s })));
  }
  function valText(cards) { var v = E.handValue(cards); return v.soft && v.total < 21 ? (v.total - 10) + ' / ' + v.total : String(v.total); }
  function state() { var r = bjReplay(cur); return r[r.length - 1]; }
  function draw() {
    var h = state();
    dealerEl.innerHTML = ''; playerEl.innerHTML = '';
    if (!h) { dvEl.textContent = ''; pvEl.textContent = ''; return; }
    h.d.forEach(function (c, i) { dealerEl.appendChild(cardEl(c, !h.done && i === 1)); });
    h.p.forEach(function (c) { playerEl.appendChild(cardEl(c)); });
    dvEl.textContent = h.done ? valText(h.d) : valText([h.d[0]]);
    pvEl.textContent = valText(h.p);
  }
  function act(ch) {
    var e = api.entry(), h = state();
    if (!e || h.done) return;
    if (ch === 'D' && !canDouble()) return;
    e.a = (e.a || '') + ch;
    V.Snd.card();
    persist();
    draw();
    if (state().done) finish(); else api.save();
  }
  function canDouble() { var e = api.entry(); return !(e.a || '') && stackOf(cur) >= e.b; }
  function finish() {
    var h = state(), net = h.ret - h.stake, pv = bjTotal(h.p), dv = bjTotal(h.d);
    var t = h.nat ? (bjTotal(h.p) === 21 && bjTotal(h.d) === 21 ? 'Beide Blackjack: unentschieden.' : bjTotal(h.p) === 21 ? 'Blackjack! 3 zu 2.' : 'Der Dealer hat Blackjack.')
      : pv > 21 ? 'Überkauft mit ' + pv + '.' : dv > 21 ? 'Der Dealer ist mit ' + dv + ' überkauft.' : pv > dv ? pv + ' gegen ' + dv + ': gewonnen.' : pv === dv ? 'Gleichstand bei ' + pv + '.' : pv + ' gegen ' + dv + ': verloren.';
    api.msg(t + (net ? ' ' + (net > 0 ? '+' : '−') + fmt(Math.abs(net)) : ''), net > 0 ? 'win' : '');
    if (net > 0) V.Snd.win(); else if (net < 0) V.Snd.lose();
    api.over();
  }
  return {
    startLabel: 'Austeilen',
    pausable: true,
    build: function (area) {
      dealerEl = el('div', { class: 'dv-cards' }); playerEl = el('div', { class: 'dv-cards' });
      dvEl = el('b', { class: 'dv-val' }); pvEl = el('b', { class: 'dv-val' });
      area.appendChild(el('div', { class: 'dv-bj' },
        el('div', { class: 'dv-hand' }, el('span', { class: 'lbl', text: 'Dealer' }), dvEl, dealerEl),
        el('div', { class: 'dv-hand' }, el('span', { class: 'lbl', text: 'Du' }), pvEl, playerEl),
        el('p', { class: 'fine', text: 'Dealer steht auf soft 17 · Blackjack zahlt 3 zu 2 · kein Teilen, keine Versicherung' })));
    },
    idle: function () { draw(); if (!cur.log.length) api.msg('8 Hände aus demselben Kartenschuh wie dein Gegner.'); },
    begin: function () { api.entry().a = ''; persist(); draw(); V.Snd.card(); if (state().done) finish(); },
    resume: function () { draw(); return !state().done; },
    main: function () { return null; },
    acts: function (box) {
      var h = state();
      if (!h || h.done) return;
      box.appendChild(el('button', { class: 'btn gold', type: 'button', onclick: function () { act('H'); } }, 'Karte ', V.kbd('K')));
      box.appendChild(el('button', { class: 'btn gold', type: 'button', onclick: function () { act('S'); } }, 'Halten ', V.kbd('H')));
      box.appendChild(el('button', { class: 'btn ghost', type: 'button', disabled: !canDouble(), title: 'Einsatz verdoppeln, genau eine Karte', onclick: function () { act('D'); } }, 'Verdoppeln ', V.kbd('V')));
    },
    key: function (k) { var m = { k: 'H', h: 'S', v: 'D' }[k]; if (!m) return false; act(m); return true; }
  };
})();

return { start: start, invite: invite, join: join, resume: resume, pending: pending, isOpen: isOpen, GAMES: GAMES, nets: nets, START: START, payout: payout,
  rounds: function (d) { return gameOf(d).rounds(d); } };
})();
