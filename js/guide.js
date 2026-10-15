/* Chip Empire – Für neue Spieler: Funktionen kommen nach und nach dazu, jede mit einer kurzen Erklärung.
   Gilt nur für neu angelegte Karriere- und Imperium-Spielstände (S.onb = 1). Ältere Spielstände, Sandbox
   und Legenden (die ja schon alles kennen) sehen alles wie bisher. Dazu die Spielanleitung im Reiter „Hilfe“. */
(function () {
'use strict';
var el = V.el, fmt = V.fmt, short = V.short;

/* Reihenfolge = Reihenfolge, in der neue Spieler die Dinge kennenlernen */
var FEATS = [
  { id: 'sess', icon: '🎁', title: 'Sitzungs-Belohnungen', sel: '#sessBar',
    when: function (S) { return S.rounds >= 3; },
    text: 'Die Leiste unter dem Spieltitel zählt deine Runden. Nach 10, 25, 50 und 100 Runden öffnet sich eine Truhe, und alle 10 Minuten Spielzeit gibt es einen Gratis-Dreh.' },
  { id: 'host', icon: '💃', title: 'Deine Gastgeberin', sel: '.host',
    when: function (S) { return S.rounds >= 6; },
    text: 'Mira kümmert sich um dich. Je besser eure Beziehung, desto mehr Comps bekommst du. Sie wächst mit jedem Einsatz und mit Trinkgeld. Jeder Raum hat eine eigene Gastgeberin.' },
  { id: 'quests', icon: '📜', title: 'Quests', side: 'quests',
    when: function (S) { return S.rounds >= 10; },
    text: 'Jeden Tag gibt es drei Daily Quests, jede Woche drei Weekly Quests. Sie bringen Chips und Erfahrung, die Weekly-Truhe sogar einen Talentpunkt. Eine Quest kannst du tauschen, wenn sie dir nicht gefällt.' },
  { id: 'comps', icon: '🎟️', title: 'Comps', sel: '.comp-box',
    when: function (S) { return S.rounds >= 15; },
    text: 'Bei jedem Einsatz schreibt dir das Casino Comps gut. Oben siehst du, wie viele es sind. Tipp auf „Einlösen“, dann werden sie zu Chips.' },
  { id: 'talente', icon: '🌳', title: 'Talentbaum', side: 'talente',
    when: function (S) { return S.level >= 2; },
    text: 'Du bist ein Level aufgestiegen und hast deinen ersten Talentpunkt. Im Talentbaum machst du damit Spiele und Belohnungen besser. Je mehr Punkte in einem Ast stecken, desto stärkere Talente kannst du lernen.' },
  { id: 'meister', icon: '🥉', title: 'Meisterschaft', sel: '#mastery', side: 'meister',
    when: function (S) { return S.rounds >= 30; },
    text: 'Jedes Spiel hat eigene Ränge von Bronze bis Diamant. Sie steigen mit den Runden in diesem Spiel und schalten neue Varianten frei, zum Beispiel Plinko „Extrem“ oder größere Tresore.' },
  { id: 'stats', icon: '📊', title: 'Statistik und Zockerprofil', side: 'stats',
    when: function (S) { return S.rounds >= 40; },
    text: 'Unter „Mehr“ findest du jetzt deine Statistik (wie viel du wo gesetzt und zurückbekommen hast) und dein Zockerprofil mit einer Empfehlung des Hauses.' },
  { id: 'arena', icon: '⚔️', title: 'Arena', side: 'arena',
    when: function (S) { return S.unlocked >= 1; },
    text: 'Mit Konto forderst du in der Arena andere Spieler zu Duellen heraus: Crash, Dragon Tower oder Blackjack mit denselben Karten und Zahlen für beide. Dein Kontostand spielt keine Rolle.' },
  { id: 'legend', icon: '★', title: 'Das große Ziel: Legende', side: 'stufen', info: true,
    when: function (S) { return S.mode === 'career' && S.unlocked >= 3; },
    text: 'Erreiche den Black Room und sammle 25 Mio. Chips. Dann kannst du Legende werden: Neustart mit Stern, Bonus-Talentpunkten und dauerhaften Vorteilen. Mit mehr Sternen steigst du im Legenden-Rang.' }
];
/* Reiter im Fenster, die erst mit einer Funktion erscheinen */
var TAB_FEAT = { quests: 'quests', talente: 'talente', meister: 'meister', arena: 'arena', stats: 'stats', profil: 'stats' };

function S() { return V.S; }
function has(id) { var s = S(); return !s.onb || !!(s.feats && s.feats[id]); }
function tabOpen(tab) { return !TAB_FEAT[tab] || has(TAB_FEAT[tab]); }

/* Was noch fehlt, im Spiel ausblenden */
function apply() {
  var app = V.$('#app'); if (!app) return;
  ['sess', 'host', 'comps', 'meister'].forEach(function (id) { app.classList.toggle('no-' + id, !has(id)); });
}

/* Nach jeder Runde und jedem Level: neu freigeschaltete Funktionen melden */
var queue = [], card = null;
function check() {
  var s = S();
  if (!s.onb) return;
  var news = [];
  FEATS.forEach(function (f) { if (!s.feats[f.id] && f.when(s)) { s.feats[f.id] = 1; news.push(f); } });
  if (!news.length) return;
  apply();
  if (V.renderSideNav) V.renderSideNav();
  if (V.side) V.side.refresh();
  if (s.tipsOn) { news.forEach(function (f) { queue.push(f); }); setTimeout(next, 900); }
  V.save();
}
function next() {
  if (card || !queue.length) return;
  var f = queue.shift();
  var acts = el('div', { class: 'gc-acts' });
  if (f.sel || f.side) acts.appendChild(el('button', { class: 'btn gold sm', type: 'button', text: f.side ? 'Ansehen' : 'Zeig mal', onclick: function () { close(); show(f); } }));
  acts.appendChild(el('button', { class: 'btn ghost sm', type: 'button', text: 'Alles klar', onclick: close }));
  card = el('div', { class: 'gcard', role: 'status', 'aria-live': 'polite' },
    el('span', { class: 'gc-kick', text: f.info ? 'Gut zu wissen' : 'Neu freigeschaltet' }),
    el('div', { class: 'gc-h' }, el('span', { class: 'gc-ico', text: f.icon }), el('b', { text: f.title })),
    el('p', { text: f.text }), acts);
  document.body.appendChild(card);
  V.Snd.unlock();
  /* Verschwindet von selbst, damit sie am Handy nicht dauerhaft über dem Spielknopf liegt (nachlesen geht unter „Hilfe“) */
  clearTimeout(cardTimer); cardTimer = setTimeout(close, 20000);
}
var cardTimer = 0;
function close() {
  clearTimeout(cardTimer);
  if (!card) return;
  var c = card; card = null;
  c.classList.add('out');
  setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); next(); }, 260);
}
/* Stelle zeigen: Reiter öffnen oder die Stelle im Spiel hervorheben */
function show(f) {
  if (f.side) { V.openSide(f.side); return; }
  V.tutorial.spot(f.sel, f.icon + ' ' + f.title, f.text);
}

/* ================= Spielanleitung (Reiter „Hilfe“) ================= */
var RULES = {
  slots: '5 Walzen und 10 Gewinnlinien. Drei oder mehr gleiche Symbole von links auf einer Linie gewinnen. Das Wild ersetzt andere Symbole, 3 Bonus-Chips starten Freispiele. Selten kommt ein Goldener Dreh, bei dem alle Gewinne doppelt zählen.',
  wheel: 'Setz Chips auf ein oder mehrere Felder des Glücksrads. Bleibt der Zeiger auf deinem Feld stehen, zahlt es seinen Multiplikator. Seltene Felder zahlen mehr.',
  dice: 'Zwei Würfel. Setz auf Unter 7, Über 7, Pasch oder eine genaue Summe. Die 7 kommt am häufigsten. Bei einem Blitz-Wurf zahlt eine Summe das 2- bis 5-Fache.',
  plinko: 'Die Kugel springt durch 12 Reihen Nägel und landet in einem Fach mit Multiplikator. Außen ist selten, zahlt aber am meisten. Höheres Risiko heißt größere Ränder und mehr Fächer unter 1×. Du kannst mehrere Kugeln nacheinander fallen lassen.',
  roulette: 'Europäisches Roulette mit einer Null. Setz Chips auf Zahlen, Farben oder Bereiche, dann dreht das Rad. Eine Einzelzahl zahlt 35:1, in einer Blitz-Runde bis 500:1.',
  ducks: 'Setz auf eine oder mehrere Enten. Jede hat eine Quote: Je höher, desto seltener gewinnt sie, desto mehr zahlt sie.',
  tower: 'Wähle in jeder Etage ein Feld. Ist es sicher, steigst du auf und der Multiplikator wächst. Ein Drache kostet den Einsatz. Du kannst jederzeit auszahlen. Goldfelder verdoppeln den Gewinn.',
  crash: 'Die Rakete steigt und der Multiplikator mit ihr, bis sie an einem zufälligen Punkt abstürzt. Zahl vorher aus, dann bekommst du Einsatz mal Multiplikator. Mit Auto-Auszahlung passiert das automatisch.',
  hilo: 'Rate, ob die nächste Karte höher oder tiefer ist. Jede richtige Antwort erhöht den Gewinn, eine falsche kostet den Einsatz. Unwahrscheinliche Tipps zahlen mehr. Überspringen kostet nichts.',
  bj: 'Komm näher an 21 als der Dealer, ohne drüber zu gehen. Bildkarten zählen 10, Asse 1 oder 11. Ziehen, Halten, Verdoppeln, Teilen und Aufgeben. Ein Blackjack zahlt 3:2.',
  vault: 'Öffne Fächer im Tresor. Hinter manchen sitzt ein Alarm. Jedes sichere Fach erhöht den Multiplikator, ein Alarm kostet den Einsatz. Nach jedem Fach kannst du auszahlen.'
};
function topics() {
  var s = S(), career = V.isCareer(), T1 = V.E.TIERS[1];
  var list = [
    { id: 'start', icon: '🎰', title: 'Erste Schritte', text: [
      'Alles ist Spielgeld ohne echten Wert. Du startest mit ' + fmt(career ? V.CAREER.start : 10000) + ' Chips.',
      'Unten (am Handy) bzw. links wählst du ein Spiel. Mit + und − änderst du den Einsatz, tipp auf den Betrag, um eine eigene Summe einzugeben (auch „10k“). All-in setzt alles.',
      'Der große goldene Knopf startet die Runde. Oben siehst du deine Chips und darunter, wie viel du in dieser Sitzung gewonnen oder verloren hast.'] },
    career ? { id: 'rooms', icon: '🏛️', title: 'Räume und Aufstieg', text: [
      'Jeder gesetzte Chip zählt als Umsatz. Bei ' + short(T1.wager) + ' Umsatz steigst du in die ' + T1.name + ' auf, danach Silver, Gold, Penthouse und Black Room.',
      'Jede Stufe bringt einen Aufstiegsbonus, höhere Einsätze, mehr Comps, eine neue Gastgeberin und neue Spiele. Im Reiter „Stufen“ wechselst du den Raum.'] } : null,
    career ? { id: 'daily', icon: '☀️', title: 'Tagesbonus und Notgroschen', text: [
      'Der goldene Knopf oben gibt dir einmal am Tag den Tagesbonus. Kommst du jeden Tag, wächst er bis zum 7. Tag.',
      'Bist du pleite, gibt es dort alle 10 Minuten einen Notgroschen, damit du weiterspielen kannst.'] } : null,
    { id: 'comps', icon: '🎟️', feat: 'comps', title: 'Comps und Gastgeberin', text: [
      'Bei jedem Einsatz bekommst du Comps gutgeschrieben, einen kleinen Teil des Hausvorteils. „Einlösen“ macht Chips daraus.',
      'Deine Gastgeberin mag dich mehr, je mehr du spielst und je öfter du Trinkgeld gibst. Eine gute Beziehung bringt bis zu 25 % mehr Comps.'] },
    { id: 'sess', icon: '🎁', feat: 'sess', title: 'Truhen und Gratis-Dreh', text: [
      'Nach 10, 25, 50 und 100 Runden in einer Sitzung öffnet sich eine Truhe mit Chips, Erfahrung und manchmal einem Talentpunkt, danach alle 75 Runden.',
      'Alle 10 Minuten Spielzeit gibt es einen Gratis-Dreh (bis zu 6 pro Sitzung). Eine Plinko-Kugel zählt nur ein Drittel Runde, weil sie so schnell fällt.'] },
    { id: 'quests', icon: '📜', feat: 'quests', title: 'Quests und Meilensteine', text: [
      'Daily Quests wechseln jeden Tag, Weekly Quests jeden Montag. Sind alle drei abgeholt, öffnet sich eine Truhe.',
      'Meilensteine sind dauerhafte Ziele in Stufen, zum Beispiel 1.000 gespielte Runden. „Alles abholen“ sammelt alles auf einmal ein.'] },
    { id: 'talente', icon: '🌳', feat: 'talente', title: 'Level und Talentbaum', text: [
      'Jede Runde gibt Erfahrung, jedes Level einen Talentpunkt. Weitere Punkte gibt es aus Truhen, der Wochen-Saison und als Legende.',
      'Der Baum hat Äste für Automaten (Glück), Tische (Taktik), Nervenkitzel (Risiko) und Boni (Business). Jedes Talent braucht das vorige im Ast, stärkere Talente zusätzlich eine Zahl an Punkten im Ast.',
      'Am Ende jedes Asts wartet ein Meister-Talent mit 10 Stufen. Neu verteilen kostet Chips, du bekommst dabei alle Punkte zurück.'] },
    { id: 'meister', icon: '🥉', feat: 'meister', title: 'Meisterschaft', text: [
      'Jedes Spiel hat Ränge nach gespielten Runden: Bronze 50, Silber 200, Gold 600, Platin 1.500, Diamant 4.000.',
      'Ränge schalten Varianten frei (Himmelsturm, große Tresore, neue Hi-Lo-Tipps, Plinko Extrem) und Diamant bringt einen Titel. Das Abzeichen steht neben dem Spielnamen.'] },
    s.mode === 'career' ? { id: 'legend', icon: '★', title: 'Legende und Legenden-Ränge', text: [
      'Im Black Room mit 25 Mio. Chips kannst du Legende werden (jeder weitere Stern verlangt 25 Mio. mehr). Chips, Räume und Umsatz starten neu, Level, Talente, Meisterschaft und Quests bleiben.',
      'Jeder Stern bringt Talentpunkte (spätere Sterne mehr), +10 % Erfahrung und +5 % Comps. Mit mehr Sternen steigst du im Rang: ' + V.legend.RANKS.map(function (R) { return R.icon + ' ' + R.name + ' (' + R.at + ')'; }).join(', ') + '.',
      'Höhere Ränge bringen schnelleren Aufstieg, größere Truhen, Startchips und mehr Tagesbonus. In der Bestenliste zählen zuerst die Sterne.'], hall: true } : null,
    s.mode === 'career' ? { id: 'season', icon: '🏆', title: 'Wochen-Saison', text: [
      'Jede Woche ab Montag zählt der Gewinn aus allen Karriere-Runden. Die Top 10 bekommen in der Woche darauf Talentpunkte, Platz 1 bekommt 5.'] } : null,
    { id: 'arena', icon: '⚔️', feat: 'arena', title: 'Arena und Freunde', text: [
      'Mit einem kostenlosen Konto spielst du Duelle gegen andere: beide mit 1.000 Duell-Chips und demselben Zufall. Siege bringen Wertungspunkte.',
      'Im Hauptmenü unter „Freunde“ suchst du Spieler und schickst Anfragen.'] },
    s.mode === 'empire' ? { id: 'empire', icon: '🏢', title: 'Imperium', text: [
      'Kauf Geschäfte vom Kiosk bis zum eigenen Casino. Sie verdienen Chips pro Stunde, auch offline, gesammelt im Tresor. Leere ihn, bevor er voll ist.'] } : null
  ];
  return list.filter(Boolean);
}
var openTopic = null;
function tab(body) {
  var s = S();
  body.appendChild(el('p', { class: 'side-intro', text: 'Hier steht kurz, wie alles funktioniert. Tipp auf ein Thema.' }));
  var wrap = el('div', { class: 'guide' });
  topics().forEach(function (t) {
    var locked = t.feat && !has(t.feat);
    var d = el('details', { class: 'gd' + (locked ? ' later' : ''), open: openTopic === t.id },
      el('summary', {}, el('span', { class: 'gd-ico', text: t.icon }), el('b', { text: t.title }), locked ? el('span', { class: 'tag', text: 'kommt bald' }) : null),
      el('div', { class: 'gd-body' }, t.text.map(function (p) { return el('p', { text: p }); }), t.hall ? V.legend.hall() : null));
    d.addEventListener('toggle', function () { if (d.open) openTopic = t.id; });
    wrap.appendChild(d);
  });
  /* Die Spiele */
  var games = el('details', { class: 'gd', open: openTopic === 'games' },
    el('summary', {}, el('span', { class: 'gd-ico', text: '🎲' }), el('b', { text: 'Die Spiele' })));
  games.addEventListener('toggle', function () { if (games.open) openTopic = 'games'; });
  var gl = el('div', { class: 'gd-body gd-games' });
  V.GAME_LIST.forEach(function (g) {
    var open = V.gameOpen(g.id);
    gl.appendChild(el('div', { class: 'gd-game' + (g.id === s.game ? ' cur' : '') + (open ? '' : ' later') },
      el('b', {}, g.name, open ? null : el('span', { class: 'tag', text: 'ab ' + V.E.TIERS[g.tier].name })),
      el('p', { text: RULES[g.id] })));
  });
  games.appendChild(gl);
  wrap.appendChild(games);
  body.appendChild(wrap);
  body.appendChild(el('div', { class: 'rrow' },
    el('button', { class: 'btn ghost sm', type: 'button', text: 'Einführung erneut zeigen', onclick: function () { V.tutorial.start(); } })));
}
/* Regeln eines Spiels direkt öffnen (Knopf „?“ neben dem Spielnamen) */
function gameHelp() { openTopic = 'games'; V.openSide('hilfe'); }

function init() {
  apply();
  queue = [];
  /* Spielstände, die schon weiter sind (z. B. nach einem Update angelegt), ohne Kartenflut nachziehen */
  var s = S();
  if (s.onb) FEATS.forEach(function (f) { if (!s.feats[f.id] && f.when(s) && s.rounds > 60) s.feats[f.id] = 1; });
  check();
}

V.guide = { init: init, check: check, has: has, tabOpen: tabOpen, apply: apply, tab: tab, gameHelp: gameHelp, RULES: RULES };
})();
