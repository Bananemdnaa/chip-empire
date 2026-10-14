/* Chip Empire – Gründe für „noch eine Runde“: Heißer Tisch (Combo), Sitzungs-Truhen und Gratis-Dreh nach Spielzeit.
   Alles gilt pro Sitzung (dieser Tab) und ändert keine Gewinnchancen. */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, short = V.short;

/* ---------- Zustand der Sitzung ---------- */
var CHESTS = [10, 25, 50, 100];          /* danach alle 75 Runden */
var SPIN_EVERY = 10 * 60 * 1000, SPIN_MAX = 6;
var COMBO_GAP = 60 * 1000, COMBO_STEP = 0.05, COMBO_MAX = 2;
var X = null, combo = { n: 0, last: 0 }, bar, comboEl, chestEl, spinEl, dlg = null;

function key() { return 'ce-sx-' + (V.slotId || ''); }
function blank() { return { ms: 0, rounds: 0, chest: 0, spins: 0, ready: false }; }
function load() {
  try { var d = JSON.parse(sessionStorage.getItem(key())); if (d && typeof d.ms === 'number') X = Object.assign(blank(), d); } catch (e) { /* neue Sitzung */ }
  if (!X) X = blank();
}
function store() { try { sessionStorage.setItem(key(), JSON.stringify(X)); } catch (e) { /* */ } }
function base() { return E.TIERS[V.isCareer() ? V.S.unlocked : V.S.room].min; }
function chestAt(i) { return i < CHESTS.length ? CHESTS[i] : CHESTS[CHESTS.length - 1] + 75 * (i - CHESTS.length + 1); }
function pickW(list) { var t = 0; list.forEach(function (x) { t += x[1]; }); var r = Math.random() * t; for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r < 0) return list[i][0]; } return list[0][0]; }

/* ---------- Heißer Tisch ---------- */
/* Jede Runde innerhalb von 60 Sekunden nach der letzten heizt den Tisch auf: bis zu doppelte Erfahrung */
function xpMult() { return combo.n > 1 && Date.now() - combo.last < COMBO_GAP ? Math.min(COMBO_MAX, 1 + (combo.n - 1) * COMBO_STEP) : 1; }
function fmtMult(m) { return '×' + m.toFixed(2).replace('.', ',').replace(/0$/, ''); }

/* ---------- Eine Runde (aus V.settle) ---------- */
function round(staked) {
  if (staked <= 0) return;
  var now = Date.now();
  combo.n = now - combo.last < COMBO_GAP ? combo.n + 1 : 1;
  combo.last = now;
  if (combo.n > 1 && (combo.n - 1) % 5 === 0 && xpMult() < COMBO_MAX + 0.001) V.Snd.step(Math.min(12, combo.n / 2));
  X.rounds++;
  if (X.rounds >= chestAt(X.chest)) openChest();
  store(); render();
}

/* ---------- Sitzungs-Truhen ---------- */
function openChest() {
  var i = X.chest, S = V.S, b = base();
  X.chest++;
  var chips = Math.round(b * pickW([[20, 30], [30, 25], [50, 20], [80, 12], [150, 8], [300, 4], [600, 1]]) * (1 + 0.25 * Math.min(i, 6)));
  var xp = 40 + 30 * Math.min(i, 8);
  var tp = Math.random() < Math.min(0.15, 0.04 + 0.02 * i) ? 1 : 0;
  S.balance += chips; S.bonusTp += tp;
  V.meta.addXp(xp);
  V.Snd.big(); V.burst(V.$('#sessBar') || V.$('#app'), 40);
  V.banner('🎁 Truhe nach ' + chestAt(i) + ' Runden', '+' + fmt(chips) + ' Chips · +' + xp + ' XP' + (tp ? ' · +1 Talentpunkt!' : ''), { kind: 'win', ms: 3200 });
  V.hud(); V.renderBadges(); V.save();
}

/* ---------- Gratis-Dreh nach Spielzeit ---------- */
function tick(dt) {
  if (!X) return;
  X.ms += dt;
  if (!X.ready && X.spins < SPIN_MAX && X.ms >= SPIN_EVERY * (X.spins + 1)) {
    X.ready = true; V.Snd.unlock();
    V.toast('🎡 Dein Gratis-Dreh ist bereit!', 'good');
  }
  /* Abgekühlter Tisch: Anzeige zurücksetzen */
  if (combo.n > 1 && Date.now() - combo.last >= COMBO_GAP) combo.n = 0;
  if (Math.floor(X.ms / 1000) % 5 === 0) store();
  render();
}
var PRIZES = [[10, 26], [15, 20], [20, 16], [30, 12], [50, 10], [75, 7], [100, 5], [200, 2.5], [500, 1.2], [1000, 0.3]];
function openSpin() {
  if (!X.ready || dlg) return;
  var b = base(), win = pickW(PRIZES), N = 46, target = 38;
  var track = el('div', { class: 'fs-track' });
  for (var i = 0; i < N; i++) {
    var v = i === target ? win : pickW(PRIZES);
    track.appendChild(el('div', { class: 'fs-cell' + (v >= 200 ? ' hot' : v >= 50 ? ' warm' : ''), text: '+' + short(v * b) }));
  }
  var btn = el('button', { class: 'btn gold big', type: 'button', text: 'Drehen!' });
  var sub = el('p', { class: 'fs-sub', text: 'Ein Dreh pro 10 Minuten Spielzeit. Der Gewinn landet sofort auf deinem Konto.' });
  dlg = el('div', { class: 'fs-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Gratis-Dreh' },
    el('div', { class: 'fs-panel' }, el('h2', { text: '🎡 Gratis-Dreh' }), el('div', { class: 'fs-reel' }, track, el('i', { class: 'fs-pin' })), sub, btn));
  document.body.appendChild(dlg);
  btn.addEventListener('click', function () {
    if (btn.dataset.state === 'done') { close(); return; }
    if (btn.dataset.state) return;
    btn.dataset.state = 'spin'; btn.disabled = true;
    X.ready = false; X.spins++; store(); render();
    var cw = track.firstChild.getBoundingClientRect().width + 8, reelW = track.parentNode.getBoundingClientRect().width;
    var jitter = (Math.random() - 0.5) * cw * 0.6;
    track.style.transform = 'translateX(' + (reelW / 2 - (target + 0.5) * cw + jitter).toFixed(1) + 'px)';
    /* Klackern, das langsamer wird */
    var t = 0, gaps = [];
    for (var k = 0; k < 26; k++) { t += 60 + k * k * 1.6; gaps.push(t); }
    gaps.forEach(function (ms) { setTimeout(V.Snd.tick, ms); });
    setTimeout(function () {
      var amt = win * b;
      V.S.balance += amt;
      track.children[target].classList.add('won');
      V.Snd.big(); V.burst(dlg.querySelector('.fs-reel'), win >= 100 ? 70 : 36);
      sub.textContent = win >= 200 ? 'Riesig! +' + fmt(amt) + ' Chips' : '+' + fmt(amt) + ' Chips gutgeschrieben.';
      sub.className = 'fs-sub win';
      btn.dataset.state = 'done'; btn.disabled = false; btn.textContent = 'Einsammeln';
      V.hud(); V.save();
    }, 4300);
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg && btn.dataset.state !== 'spin') close(); });
  btn.focus();
}
function close() { if (dlg && dlg.parentNode) dlg.parentNode.removeChild(dlg); dlg = null; }

/* ---------- Leiste unter dem Spieltitel ---------- */
function render() {
  if (!bar || !X) return;
  var m = xpMult(), hot = m > 1;
  comboEl.className = 'sx-chip combo' + (hot ? ' on' : '') + (m >= COMBO_MAX ? ' max' : '');
  comboEl.querySelector('b').textContent = hot ? 'Heißer Tisch ' + fmtMult(m) + ' XP' : 'Tisch kalt';
  comboEl.title = 'Spiel innerhalb von 60 Sekunden weiter, dann steigt deine Erfahrung pro Runde bis auf das Doppelte.';
  var fill = comboEl.querySelector('i');
  var left = hot ? Math.max(0, 1 - (Date.now() - combo.last) / COMBO_GAP) : 0;
  fill.style.width = (left * 100).toFixed(1) + '%';
  var need = chestAt(X.chest), prev = X.chest ? chestAt(X.chest - 1) : 0;
  chestEl.querySelector('b').textContent = 'Truhe ' + X.rounds + ' / ' + need;
  chestEl.querySelector('i').style.width = Math.min(100, (X.rounds - prev) / (need - prev) * 100).toFixed(1) + '%';
  chestEl.classList.toggle('near', need - X.rounds <= 3);
  var sb = spinEl.querySelector('b');
  if (X.ready) { sb.textContent = 'Gratis-Dreh!'; spinEl.className = 'sx-chip spin ready'; spinEl.disabled = false; }
  else if (X.spins >= SPIN_MAX) { sb.textContent = 'Alle Gratis-Drehs genutzt'; spinEl.className = 'sx-chip spin'; spinEl.disabled = true; }
  else { sb.textContent = 'Gratis-Dreh in ' + V.clock(Math.max(0, SPIN_EVERY * (X.spins + 1) - X.ms)); spinEl.className = 'sx-chip spin'; spinEl.disabled = true; }
}

function init() {
  X = null; load();
  bar = V.$('#sessBar');
  comboEl = el('span', { class: 'sx-chip combo' }, el('span', { class: 'sx-ico', text: '🔥' }), el('b'), el('span', { class: 'sx-bar' }, el('i')));
  chestEl = el('span', { class: 'sx-chip chest', title: 'Nach 10, 25, 50 und 100 Runden in dieser Sitzung wartet eine Truhe, danach alle 75 Runden.' },
    el('span', { class: 'sx-ico', text: '🎁' }), el('b'), el('span', { class: 'sx-bar' }, el('i')));
  spinEl = el('button', { class: 'sx-chip spin', type: 'button', onclick: openSpin }, el('span', { class: 'sx-ico', text: '🎡' }), el('b'));
  bar.innerHTML = ''; bar.appendChild(comboEl); bar.appendChild(chestEl); bar.appendChild(spinEl);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dlg && !dlg.querySelector('[data-state="spin"]')) close(); });
  render();
}

V.session = { init: init, round: round, tick: tick, xpMult: xpMult };
})();
