/* Chip Empire – Meisterschaft pro Spiel: Ränge nach gespielten Runden, mit neuen Spielvarianten.
   Die Runden zählt settle() in S.gst[spiel].r, sie bleiben auch beim Legende-Werden erhalten. */
(function () {
'use strict';
var el = V.el, fmt = V.fmt;

var RANKS = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', at: 50 },
  { id: 'silver', name: 'Silber', icon: '🥈', at: 200 },
  { id: 'gold', name: 'Gold', icon: '🥇', at: 600 },
  { id: 'plat', name: 'Platin', icon: '💠', at: 1500 },
  { id: 'dia', name: 'Diamant', icon: '💎', at: 4000 }
];
/* Freischaltungen je Spiel: Rang (1 = Bronze … 5 = Diamant), Schlüssel für das Spiel, Text.
   Jede Variante hält ihre Auszahlungsquote unter 100 %, auch mit den passenden Talenten (siehe README). */
var UNLOCKS = {
  tower: [{ rank: 2, key: 'floors12', text: 'Himmelsturm: 12 Etagen statt 9' }],
  vault: [{ rank: 2, key: 'grid6', text: 'Großer Tresor: 6×6 Fächer' }, { rank: 4, key: 'grid7', text: 'Bankgewölbe: 7×7 Fächer' }],
  hilo: [{ rank: 2, key: 'color', text: 'Farbe raten: Rot oder Schwarz, 1,96×' }, { rank: 3, key: 'same', text: 'Gleicher Rang: 12,73×' }],
  plinko: [{ rank: 3, key: 'extreme', text: 'Risiko Extrem: Randfächer mit 500×' }]
};
/* Titel für den Diamant-Rang, damit jedes Spiel ein eigenes Ziel hat */
var TITLES = {
  slots: 'Walzenkönig', wheel: 'Herr des Rades', dice: 'Würfelmagier', roulette: 'Croupier-Schreck', ducks: 'Entenflüsterer',
  plinko: 'Nagelbrett-Profi', crash: 'Raketenpilot', tower: 'Drachenbändiger', bj: 'Kartenhai', hilo: 'Leiterläufer', vault: 'Meisterdieb',
  limbo: 'Limbo-König', keno: 'Zahlenseher', scratch: 'Rubbelkönig', bacc: 'Punto Banco', fruit: 'Obstbaron'
};

function rounds(g) { var x = V.S.gst[g]; return x ? x.r : 0; }
function rankOf(n) { var r = 0; RANKS.forEach(function (R, i) { if (n >= R.at) r = i + 1; }); return r; }
function rank(g) { return rankOf(rounds(g)); }
function unlocks(g) { return UNLOCKS[g] || []; }
function find(g, key) { var u = unlocks(g); for (var i = 0; i < u.length; i++) if (u[i].key === key) return u[i]; return null; }
/* Im Sandbox-Modus ist alles offen, wie die Räume auch */
function has(g, key) { var u = find(g, key); return !!u && (!V.isCareer() || rank(g) >= u.rank || V.devTools.all()); }
function need(g, key) { var u = find(g, key); return u ? Math.max(0, RANKS[u.rank - 1].at - rounds(g)) : 0; }
function lockText(g, key) {
  var u = find(g, key); if (!u) return '';
  return 'Ab Meisterschaft ' + RANKS[u.rank - 1].name + ' · noch ' + fmt(need(g, key)) + ' Runden ' + V.GAME_NAME[g];
}
/* Gesperrte Variante angetippt: Hinweis statt Wechsel */
function locked(g, key) { if (has(g, key)) return false; V.toast('🔒 ' + lockText(g, key), 'warn'); return true; }

/* Nach jeder gezählten Runde: Rang-Aufstieg genau dann, wenn die Runde eine Schwelle trifft */
function check(g, n) {
  if (V.S.game === g) renderHead();
  for (var i = 0; i < RANKS.length; i++) {
    if (RANKS[i].at !== n) continue;
    var R = RANKS[i], news = unlocks(g).filter(function (u) { return u.rank === i + 1; }).map(function (u) { return u.text; });
    if (i === RANKS.length - 1) news.push('Titel „' + TITLES[g] + '“');
    V.meta.notify({ kind: 'mile', icon: R.icon, text: V.GAME_NAME[g] + ': Meisterschaft ' + R.name + (news.length ? ' · Neu: ' + news.join(', ') : '') });
    if (V.S.game === g) {
      var b = V.$('#mastery'); if (b) { b.classList.remove('up'); void b.offsetWidth; b.classList.add('up'); }
      V.games.forEach(function (x) { if (x.id === g && x.onMastery) x.onMastery(); });
    }
  }
}

/* Fortschritt zum nächsten Rang als Anteil */
function prog(g) {
  var n = rounds(g), r = rankOf(n), lo = r ? RANKS[r - 1].at : 0, hi = RANKS[r] ? RANKS[r].at : 0;
  return hi ? (n - lo) / (hi - lo) : 1;
}

/* Abzeichen in der Kopfzeile des Spiels */
function renderHead() {
  var b = V.$('#mastery'); if (!b) return;
  var g = V.S.game, n = rounds(g), r = rankOf(n), R = RANKS[r - 1], nx = RANKS[r];
  b.setAttribute('data-rank', R ? R.id : 'none');
  b.innerHTML = '';
  b.appendChild(el('span', { class: 'ms-ico', text: R ? R.icon : '◇' }));
  b.appendChild(el('span', { class: 'ms-name', text: R ? R.name : 'Neuling' }));
  var bar = el('i'); bar.style.width = (prog(g) * 100).toFixed(1) + '%';
  b.appendChild(el('span', { class: 'ms-bar' }, bar));
  b.title = 'Meisterschaft ' + V.GAME_NAME[g] + ': ' + fmt(n) + ' Runden' + (nx ? ' · ' + nx.name + ' ab ' + fmt(nx.at) : ' · höchster Rang');
  b.setAttribute('aria-label', b.title);
}

/* Übersicht im Seitenfenster */
function tab(body) {
  body.appendChild(el('p', { class: 'side-intro', text: 'Jedes Spiel hat eigene Ränge. Sie steigen mit den Runden, die du darin spielst, und schalten neue Varianten frei. Die Meisterschaft bleibt dir auch als Legende.' }));
  var ladder = el('div', { class: 'ms-ranks' });
  RANKS.forEach(function (R) { ladder.appendChild(el('span', { class: 'ms-rk', 'data-rank': R.id }, el('b', { text: R.icon }), R.name, el('small', { text: fmt(R.at) }))); });
  body.appendChild(ladder);
  var list = el('div', { class: 'ms-list' });
  V.GAME_LIST.forEach(function (G) {
    var g = G.id, n = rounds(g), r = rankOf(n), R = RANKS[r - 1], nx = RANKS[r], open = V.gameOpen(g);
    var card = el('div', { class: 'ms-card' + (open ? '' : ' locked'), 'data-rank': R ? R.id : 'none' });
    var bar = el('i'); bar.style.width = (prog(g) * 100).toFixed(1) + '%';
    card.appendChild(el('div', { class: 'ms-h' },
      el('span', { class: 'ms-ico', text: R ? R.icon : '◇' }),
      el('div', {}, el('b', { text: G.name }), el('small', { text: (R ? R.name : 'Noch kein Rang') + (r === RANKS.length ? ' · ' + TITLES[g] : '') })),
      el('span', { class: 'num', text: fmt(n) + (nx ? ' / ' + fmt(nx.at) : '') })));
    card.appendChild(el('div', { class: 'mbar' }, bar));
    var items = unlocks(g).slice();
    items.push({ rank: RANKS.length, text: 'Titel „' + TITLES[g] + '“' });
    var ul = el('ul', { class: 'ms-un' });
    items.forEach(function (u) {
      var ok = r >= u.rank || (!V.isCareer() && u.key);
      ul.appendChild(el('li', { class: ok ? 'ok' : '' }, el('span', { text: ok ? '✓' : RANKS[u.rank - 1].icon }), u.text));
    });
    card.appendChild(ul);
    if (open && g !== V.S.game) card.appendChild(el('button', { class: 'btn ghost sm', type: 'button', text: 'Spielen', onclick: function () { V.closeSide(); V.showGame(g); } }));
    list.appendChild(card);
  });
  body.appendChild(list);
  if (!V.isCareer()) body.appendChild(el('p', { class: 'fine', text: 'Sandbox: Alle Varianten sind sofort spielbar. Die Ränge zählen trotzdem mit.' }));
}

V.mastery = { RANKS: RANKS, rank: rank, has: has, need: need, lockText: lockText, locked: locked, check: check, renderHead: renderHead, tab: tab };
})();
