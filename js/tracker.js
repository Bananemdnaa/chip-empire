/* Chip Empire – Gewinn und Verlust sichtbar machen:
   Sitzungsbilanz am Kontostand, fliegender Betrag nach jeder Runde, letzte Runden pro Spiel */
(function () {
'use strict';
var $ = V.$, el = V.el, fmt = V.fmt;
var NS = 'http://www.w3.org/2000/svg';

/* Sitzung = seit dem Öffnen des Spielstands in diesem Tab (übersteht Neuladen, nicht das Schließen) */
var T = null, pop = null;
function blank() { return { t0: Date.now(), n: 0, wins: 0, staked: 0, ret: 0, best: 0, worst: 0, games: {}, curve: [0] }; }
function key() { return 'ce-sess-' + (V.slotId || ''); }
function load() {
  try {
    var d = JSON.parse(sessionStorage.getItem(key()));
    if (d && typeof d.t0 === 'number' && d.games && Array.isArray(d.curve)) T = Object.assign(blank(), d);
  } catch (e) { /* ohne Speicher: neue Sitzung */ }
  if (!T) T = blank();
}
function store() { try { sessionStorage.setItem(key(), JSON.stringify(T)); } catch (e) { /* */ } }
function sess() { if (!T) load(); return T; }
function net() { var s = sess(); return s.ret - s.staked; }
function signed(n) { n = Math.round(n); return (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n)); }
function tone(n) { return n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero'; }

/* ---------- Eine Runde verbuchen (aus V.settle) ---------- */
function round(game, staked, ret) {
  if (staked <= 0 && ret <= 0) return;
  var s = sess(), d = ret - staked;
  s.staked += staked; s.ret += ret;
  if (staked > 0) { s.n++; if (d > 0) s.wins++; }
  s.best = Math.max(s.best, d); s.worst = Math.min(s.worst, d);
  var g = s.games[game] || (s.games[game] = { n: 0, net: 0 });
  if (staked > 0) g.n++;
  g.net += d;
  s.curve.push(Math.round(s.ret - s.staked));
  if (s.curve.length > 240) s.curve.splice(1, 1);
  store();
  fly(d);
  renderHud(); strip();
  if (pop && !pop.hidden) renderPop();
}

/* Betrag fliegt unter dem Kontostand heraus, der Kasten blitzt grün oder rot */
function fly(d) {
  var box = $('#balBtn'); if (!box) return;
  var f = el('span', { class: 'bal-fly ' + tone(d), 'aria-hidden': 'true', text: signed(d) });
  box.appendChild(f);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1700);
  box.classList.remove('flash-pos', 'flash-neg');
  if (d !== 0) { void box.offsetWidth; box.classList.add(d > 0 ? 'flash-pos' : 'flash-neg'); }
}

function renderHud() {
  var n = net(), x = $('#sessNet'); if (!x) return;
  x.className = 'sess ' + tone(n);
  x.textContent = 'Sitzung ' + signed(n);
}

/* ---------- Letzte Runden im aktuellen Spiel ---------- */
function strip() {
  var box = $('#lastRounds'); if (!box) return;
  var S = V.S, list = S.hist.filter(function (h) { return h.g === S.game; }).slice(-8).reverse();
  box.hidden = !list.length;
  box.innerHTML = '';
  if (!list.length) return;
  box.appendChild(el('span', { class: 'lbl', text: 'Letzte Runden' }));
  var row = el('div', { class: 'lr-row' });
  list.forEach(function (h, i) {
    var d = h.ret - h.bet;
    row.appendChild(el('span', { class: 'lr ' + tone(d) + (i === 0 ? ' new' : ''), title: 'Einsatz ' + fmt(h.bet) + ' · zurück ' + fmt(h.ret), text: signed(d) }));
  });
  box.appendChild(row);
}

/* ---------- Bilanz-Fenster ---------- */
function spark(curve) {
  var w = 300, h = 74, pad = 4, lo = Math.min(0, Math.min.apply(null, curve)), hi = Math.max(0, Math.max.apply(null, curve));
  if (hi === lo) hi = lo + 1;
  function X(i) { return curve.length < 2 ? w / 2 : pad + i * (w - 2 * pad) / (curve.length - 1); }
  function Y(v) { return pad + (hi - v) * (h - 2 * pad) / (hi - lo); }
  var pts = curve.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'sp-chart ' + tone(curve[curve.length - 1])); svg.setAttribute('aria-hidden', 'true');
  var y0 = Y(0).toFixed(1);
  svg.innerHTML = '<path class="c-area" d="M' + X(0).toFixed(1) + ',' + y0 + ' L' + pts.join(' L') + ' L' + X(curve.length - 1).toFixed(1) + ',' + y0 + ' Z"/>' +
    '<line class="c-zero" x1="0" x2="' + w + '" y1="' + y0 + '" y2="' + y0 + '"/>' +
    '<polyline class="c-line" points="' + pts.join(' ') + '"/>';
  return svg;
}
function kv(label, value, cls) { return el('div', { class: 'kv' }, el('span', { text: label }), el('b', { class: 'num ' + (cls || ''), text: value })); }
function renderPop() {
  var s = sess(), n = s.ret - s.staked, S = V.S;
  var since = new Date(s.t0), hhmm = since.getHours() + ':' + (since.getMinutes() < 10 ? '0' : '') + since.getMinutes();
  pop.innerHTML = '';
  pop.appendChild(el('div', { class: 'sp-h' }, el('span', { class: 'lbl', text: 'Bilanz dieser Sitzung' }),
    el('button', { class: 'icon-btn sp-x', type: 'button', 'aria-label': 'Schließen', text: '✕', onclick: close })));
  pop.appendChild(el('div', { class: 'sp-net num ' + tone(n), text: signed(n) }));
  pop.appendChild(el('div', { class: 'sp-sub', text: 'seit ' + hhmm + ' Uhr · ' + s.n + ' Runde' + (s.n === 1 ? '' : 'n') +
    (s.n ? ' · ' + s.wins + ' gewonnen (' + Math.round(100 * s.wins / s.n) + ' %)' : '') }));
  if (s.curve.length > 1) pop.appendChild(spark(s.curve));
  else pop.appendChild(el('p', { class: 'sp-empty', text: 'Noch keine Runde gespielt. Hier siehst du gleich, wie es läuft.' }));
  pop.appendChild(el('div', { class: 'kvs' },
    kv('Eingesetzt', fmt(s.staked)), kv('Ausgezahlt', fmt(s.ret)),
    kv('Bester Treffer', s.best > 0 ? signed(s.best) : '–', s.best > 0 ? 'pos' : ''),
    kv('Größter Verlust', s.worst < 0 ? signed(s.worst) : '–', s.worst < 0 ? 'neg' : '')));
  var ids = Object.keys(s.games).sort(function (a, b) { return Math.abs(s.games[b].net) - Math.abs(s.games[a].net); });
  if (ids.length) {
    var list = el('div', { class: 'sp-games' });
    var max = Math.max.apply(null, ids.map(function (id) { return Math.abs(s.games[id].net); })) || 1;
    ids.forEach(function (id) {
      var g = s.games[id];
      list.appendChild(el('div', { class: 'sp-g' },
        el('span', { class: 'sp-gn', text: V.GAME_NAME[id] || id }),
        el('span', { class: 'sp-gbar ' + tone(g.net) }, el('i', { style: 'width:' + Math.max(3, 100 * Math.abs(g.net) / max).toFixed(0) + '%' })),
        el('b', { class: 'num ' + tone(g.net), text: signed(g.net) })));
    });
    pop.appendChild(el('h4', { text: 'Nach Spiel' }));
    pop.appendChild(list);
  }
  if (V.legend) {
    var wk = V.legend.season();
    pop.appendChild(el('div', { class: 'kv sp-week' }, el('span', { text: 'Diese Woche (Saison, noch ' + V.legend.untilReset() + ')' }),
      el('b', { class: 'num ' + tone(wk.net), text: signed(wk.net) })));
  }
  var all = Math.round(S.returned - S.wagered);
  pop.appendChild(el('div', { class: 'sp-foot' },
    el('span', {}, 'Seit Spielstart: ', el('b', { class: 'num ' + tone(all), text: signed(all) })),
    el('button', { class: 'btn ghost xs', type: 'button', text: 'Neu beginnen', title: 'Sitzungsbilanz auf null setzen',
      onclick: function () { T = blank(); store(); renderHud(); renderPop(); V.Snd.click(); } })));
}
function place() {
  var hud = $('.hud'), r = hud ? hud.getBoundingClientRect() : { bottom: 60 };
  pop.style.top = Math.max(8, Math.round(r.bottom + 8)) + 'px';
}
function open() {
  if (!pop) {
    pop = el('div', { id: 'sessPop', class: 'sess-pop', role: 'dialog', 'aria-label': 'Bilanz dieser Sitzung', hidden: true });
    $('#app').appendChild(pop);
  }
  renderPop(); place();
  pop.hidden = false;
  $('#balBtn').setAttribute('aria-expanded', 'true');
}
function close() {
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  $('#balBtn').setAttribute('aria-expanded', 'false');
}
function toggle() { V.Snd.click(); if (pop && !pop.hidden) close(); else open(); }

function init() {
  T = null; load();
  $('#balBtn').addEventListener('click', toggle);
  document.addEventListener('click', function (e) {
    /* Knöpfe im Fenster bauen es neu, ihr Ziel hängt dann nicht mehr im Dokument */
    if (pop && !pop.hidden && e.target.isConnected && !pop.contains(e.target) && !e.target.closest('#balBtn')) close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', function () { if (pop && !pop.hidden) place(); });
  renderHud(); strip();
}

V.track = { init: init, round: round, strip: strip, close: close, signed: signed };
})();
