/* Chip Empire – Einführung für neue Spielstände: hebt nacheinander die wichtigsten Stellen hervor.
   Wird beim Anlegen gewählt (Schalter im Formular) und lässt sich in den Einstellungen erneut starten. */
(function () {
'use strict';
var el = V.el, $ = V.$;
var FLAG = 'chip-empire-tutorial-';

/* Ziel: mehrere Selektoren, der erste sichtbare gewinnt. Ohne sichtbares Ziel erscheint der Schritt in der Mitte. */
function steps() {
  var career = V.isCareer(), next = V.E.TIERS[1];
  var list = [
    { title: 'Willkommen im Chip Empire!', text: 'Eine kurze Tour durch das Wichtigste. Du kannst sie jederzeit überspringen und später in den Einstellungen erneut starten.' },
    { sel: ['#balBtn'], title: 'Deine Chips', text: 'Das ist dein Kontostand. Darunter siehst du, wie viel du in dieser Sitzung gewonnen oder verloren hast. Antippen zeigt die genaue Bilanz.' },
    { sel: ['#gameTabs'], title: 'Die Spiele', text: career
      ? 'Hier wählst du ein Spiel. Zum Start sind Slots, Glücksrad, Würfel und Plinko offen. Weitere Spiele schaltest du mit den Räumen frei.'
      : 'Hier wählst du ein Spiel. In der Sandbox ist alles offen.' },
    { sel: ['#g-' + V.S.game + ' .betctl:has(button.betval)', '#g-' + V.S.game + ' .betctl'], title: 'Dein Einsatz', text: 'Mit + und − änderst du den Einsatz. Tipp auf den Betrag, um eine eigene Summe einzutippen (auch „10k“). All-in setzt alles, was du hast.' },
    { sel: ['#g-' + V.S.game + ' .spin-btn', '#g-' + V.S.game + ' .btn.gold.big'], title: 'Los geht’s', text: 'Mit diesem Knopf (oder der Leertaste am Computer) startest du eine Runde.' },
    career ? { sel: ['.hud-player'], title: 'Aufsteigen', text: 'Jeder Einsatz zählt als Umsatz. Bei ' + V.fmt(next.wager) + ' Umsatz steigst du in die ' + next.name + ' auf: höhere Einsätze, ein Aufstiegsbonus und neue Spiele wie Roulette und Dragon Tower.' } : null,
    { sel: ['#sessBar'], title: 'Kleine Belohnungen', text: 'Nach 10, 25 und 50 Runden wartet eine Truhe, und alle 10 Minuten Spielzeit gibt es einen Gratis-Dreh.' },
    { sel: ['#sideNav [data-side="quests"]', '#gameTabs .rail-more'], title: 'Quests und Talente', text: 'Tägliche und wöchentliche Quests bringen Chips und Erfahrung. Mit jedem Level bekommst du einen Talentpunkt für den Talentbaum.' },
    career ? { sel: ['#reload'], title: 'Tagesbonus und Notgroschen', text: 'Einmal am Tag holst du hier deinen Tagesbonus ab. Bist du pleite, gibt es hier alle 10 Minuten einen Notgroschen.' } : null,
    { title: 'Viel Glück!', text: 'Das war’s. Es ist alles Spielgeld, also probier ruhig alles aus.' }
  ];
  return list.filter(Boolean);
}
function visible(n) { if (!n) return false; var r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden'; }
function find(sel) {
  if (!sel) return null;
  for (var i = 0; i < sel.length; i++) {
    var n = null;
    try { n = document.querySelector(sel[i]); } catch (e) { n = null; }
    if (visible(n)) return n;
  }
  return null;
}

var ov = null, list = [], idx = 0;
function place() {
  if (!ov) return;
  var st = list[idx], target = find(st.sel), hole = ov.querySelector('.tut-hole'), tip = ov.querySelector('.tut-tip');
  if (target) {
    var r = target.getBoundingClientRect(), pad = 6;
    hole.style.display = 'block';
    hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px';
    hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
    /* Hinweiskarte unter das Ziel, sonst darüber; seitlich im Fenster halten */
    var tw = Math.min(340, window.innerWidth - 24), th = tip.offsetHeight || 160;
    var top = r.bottom + 14 + th < window.innerHeight ? r.bottom + 14 : Math.max(12, r.top - 14 - th);
    var left = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 12);
    tip.style.width = tw + 'px'; tip.style.left = left + 'px'; tip.style.top = top + 'px'; tip.classList.remove('center');
  } else {
    hole.style.display = 'none';
    tip.style.width = ''; tip.style.left = ''; tip.style.top = ''; tip.classList.add('center');
  }
}
function show() {
  var st = list[idx], tip = ov.querySelector('.tut-tip'), target = find(st.sel);
  if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
  tip.innerHTML = '';
  tip.appendChild(el('span', { class: 'tut-step', text: (idx + 1) + ' / ' + list.length }));
  tip.appendChild(el('b', { text: st.title }));
  tip.appendChild(el('p', { text: st.text }));
  var last = idx === list.length - 1;
  tip.appendChild(el('div', { class: 'tut-acts' },
    last ? null : el('button', { class: 'btn ghost sm', type: 'button', text: 'Überspringen', onclick: end }),
    idx > 0 ? el('button', { class: 'btn ghost sm', type: 'button', text: 'Zurück', onclick: function () { go(-1); } }) : null,
    el('button', { class: 'btn gold sm', type: 'button', text: last ? 'Spielen' : 'Weiter', onclick: function () { go(1); } })));
  /* nach dem Scrollen messen */
  place(); setTimeout(place, 60);
  var b = tip.querySelector('.btn.gold'); if (b) b.focus();
}
function go(d) {
  V.Snd.click();
  idx += d;
  if (idx >= list.length) { end(); return; }
  if (idx < 0) idx = 0;
  show();
}
function onKey(e) {
  if (!ov) return;
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); end(); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); go(1); }
  else if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); go(-1); }
  else { e.stopPropagation(); }
}
function start() {
  if (ov) return;
  var b = $('#banner'); if (b) b.hidden = true;
  if (V.closeSide) V.closeSide();
  list = steps(); idx = 0;
  ov = el('div', { class: 'tut', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Einführung' }, el('div', { class: 'tut-hole' }), el('div', { class: 'tut-tip' }));
  document.body.appendChild(ov);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  show();
}
function end() {
  if (!ov) return;
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', place);
  if (ov.parentNode) ov.parentNode.removeChild(ov);
  ov = null;
}

/* Beim Anlegen gewählt: einmal beim ersten Start des Spielstands */
function want(id) { try { localStorage.setItem(FLAG + id, '1'); } catch (e) { /* ohne Speicher keine Tour */ } }
function maybeStart(id) {
  var on = false;
  try { on = localStorage.getItem(FLAG + id) === '1'; localStorage.removeItem(FLAG + id); } catch (e) { on = false; }
  if (on) setTimeout(start, 1200);
}

V.tutorial = { start: start, want: want, maybeStart: maybeStart };
})();
