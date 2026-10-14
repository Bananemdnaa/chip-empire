/* Chip Empire – Event-Animationen: seltene Sonderrunden (Blitz-Runde, Goldener Dreh, Doppel-Rakete, Goldkugel)
   bekommen einen großen Auftritt. Läuft rein über CSS-Animationen, also auch ohne Bildwiederholung per Skript. */
(function () {
'use strict';
var el = V.el;
var NS = 'http://www.w3.org/2000/svg';
var THEME = {
  blitz: { ms: 1900 },
  gold: { ms: 1800 },
  rocket: { ms: 1700 }
};

/* Zickzack-Blitz von oben nach unten als SVG-Pfad (Koordinaten 0–100) */
function zigzag(x0, x1) {
  var pts = [[x0, -5]], n = 7;
  for (var i = 1; i < n; i++) {
    var t = i / n, x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 14;
    pts.push([x, t * 105]);
  }
  pts.push([x1, 105]);
  return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
}
function boltsSvg(count) {
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'ev-bolts');
  for (var i = 0; i < count; i++) {
    var x0 = 10 + Math.random() * 80, x1 = x0 + (Math.random() - 0.5) * 40, d = zigzag(x0, x1);
    ['glow', 'core'].forEach(function (cls) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('class', 'ev-bolt ' + cls);
      p.style.animationDelay = (i * 0.16) + 's';
      svg.appendChild(p);
    });
  }
  return svg;
}
function particles(kind, n) {
  var box = el('div', { class: 'ev-parts' });
  for (var i = 0; i < n; i++) {
    var s = el('i');
    s.style.left = (Math.random() * 100).toFixed(1) + '%';
    s.style.animationDelay = (Math.random() * 0.7).toFixed(2) + 's';
    s.style.animationDuration = (0.9 + Math.random() * 0.9).toFixed(2) + 's';
    s.style.setProperty('--dx', ((Math.random() - 0.5) * 160).toFixed(0) + 'px');
    s.style.setProperty('--sz', (6 + Math.random() * 10).toFixed(0) + 'px');
    box.appendChild(s);
  }
  return box;
}
function sound(kind) {
  var S = V.Snd;
  if (kind === 'blitz') { S.zap(); setTimeout(S.crash, 120); setTimeout(S.zap, 420); setTimeout(S.zap, 760); }
  else if (kind === 'gold') { S.zap(); setTimeout(S.big, 250); }
  else if (kind === 'rocket') { S.crash(); setTimeout(S.zap, 200); setTimeout(S.unlock, 500); }
  else { S.big(); }
}

/* ---------- Reihenfolge: immer nur ein großer Effekt auf einmal ---------- */
var active = false, queue = Promise.resolve(), later = [];
/* Läuft gerade der All-in-Schriftzug, warten wir kurz, statt darüber zu malen */
function allinShowing() { var a = document.getElementById('allinFx'); return !!(a && /\b(show|win|lose)\b/.test(a.className)); }
function waitFree(maxMs) {
  return new Promise(function (ok) {
    var t0 = Date.now();
    (function check() { if (!allinShowing() || Date.now() - t0 > maxMs) ok(); else setTimeout(check, 120); })();
  });
}
/* Was während eines Events gemeldet wird (Banner, All-in-Ergebnis), kommt direkt danach */
function flushLater() { var l = later; later = []; l.forEach(function (fn, i) { setTimeout(fn, i * 150); }); }
function deferWhileActive(name) {
  var orig = V[name];
  V[name] = function () { var args = arguments; if (active) { later.push(function () { orig.apply(V, args); }); return; } return orig.apply(V, args); };
}
deferWhileActive('banner');
deferWhileActive('fx');
/* Konfetti begrenzen: zu viele Teilchen gleichzeitig ruckeln, vor allem am Handy */
(function () {
  var orig = V.burst;
  V.burst = function (host, n, colors) {
    var live = document.querySelectorAll('.conf').length, cap = window.innerWidth < 720 ? 70 : 140;
    n = Math.min(n, Math.max(0, cap - live));
    if (window.innerWidth < 720) n = Math.ceil(n * 0.6);
    if (n > 0) orig(host, n, colors);
  };
})();

/* Großer Auftritt. Gibt ein Versprechen zurück, das nach der Animation erfüllt ist.
   Mehrere Events hintereinander werden in eine Warteschlange gestellt. */
function show(kind, title, sub) {
  var p = queue.then(function () { return waitFree(2200); }).then(function () { return play(kind, title, sub); });
  queue = p.catch(function () {});
  return p;
}
function play(kind, title, sub) {
  var T = THEME[kind] || THEME.blitz;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ms = reduce ? 900 : T.ms;
  var fx = el('div', { class: 'ev-fx ev-' + kind, role: 'status', 'aria-live': 'assertive' },
    el('div', { class: 'ev-flash' }),
    kind === 'blitz' ? boltsSvg(window.innerWidth < 720 ? 2 : 3) : null,
    el('div', { class: 'ev-ring' }), el('div', { class: 'ev-ring r2' }),
    kind === 'gold' ? particles(kind, window.innerWidth < 720 ? 14 : 24) : null,
    kind === 'rocket' ? el('div', { class: 'ev-streak' }) : null,
    el('div', { class: 'ev-text' }, el('b', { class: 'ev-title', text: title }), sub ? el('span', { class: 'ev-sub', text: sub }) : null));
  fx.style.setProperty('--ms', ms + 'ms');
  active = true;
  document.body.appendChild(fx);
  var stage = V.$('.stage');
  if (stage && !reduce) { stage.classList.remove('evshake'); void stage.offsetWidth; stage.classList.add('evshake'); }
  sound(kind);
  return new Promise(function (done) {
    setTimeout(function () {
      fx.classList.add('out');
      setTimeout(function () { if (fx.parentNode) fx.parentNode.removeChild(fx); }, 320);
      if (stage) stage.classList.remove('evshake');
      active = false;
      flushLater();
      done();
    }, ms);
  });
}

/* Ein Blitz schlägt in ein Element ein (z. B. ein Roulette-Feld): Strahl von oben, Lichtblitz, Glühen */
function strike(target) {
  if (!target) return;
  var r = target.getBoundingClientRect(), h = Math.max(120, r.top + r.height / 2);
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'ev-strike');
  svg.style.left = (r.left + r.width / 2 - 30) + 'px'; svg.style.top = (r.top + r.height / 2 - h) + 'px'; svg.style.height = h + 'px';
  var d = zigzag(50, 50);
  ['glow', 'core'].forEach(function (cls) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'ev-bolt ' + cls); svg.appendChild(p); });
  document.body.appendChild(svg);
  setTimeout(function () { if (svg.parentNode) svg.parentNode.removeChild(svg); }, 700);
  target.classList.remove('struck'); void target.offsetWidth; target.classList.add('struck');
  V.Snd.zap();
}

V.event = show;
V.strike = strike;
V.eventActive = function () { return active; };
})();
