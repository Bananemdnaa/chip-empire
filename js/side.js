/* Chip Empire – Seitenpanel: Stufen, Zockerprofil, Statistik, Haus */
(function () {
'use strict';
var E = V.E, A = V.A, el = V.el, fmt = V.fmt, short = V.short;

var tabsEl, body, confirmReset = false;
var GNAME = V.GAME_NAME;
function edge(g) { return V.GAME_BY[g] ? V.GAME_BY[g].edge : 0; }
function catOf(g) { return V.GAME_BY[g] ? V.GAME_BY[g].cat : ''; }
var TABS_ALL = [{ id: 'imperium', label: 'Imperium', empire: true }, { id: 'quests', label: 'Quests' }, { id: 'talente', label: 'Talente' }, { id: 'stufen', label: 'Stufen' }, { id: 'stats', label: 'Statistik' }, { id: 'profil', label: 'Zockerprofil' }, { id: 'haus', label: 'Hinter den Kulissen' }];

function build() {
  var host = V.$('#side');
  tabsEl = el('div', { class: 'tabs', role: 'tablist' });
  body = el('div', { class: 'side-body', role: 'tabpanel' });
  host.appendChild(tabsEl); host.appendChild(body);
  refresh();
}

function refresh() {
  if (!body) return;
  var S = V.S;
  var TABS = TABS_ALL.filter(function (t) { return !t.empire || S.mode === 'empire'; });
  if (S.sideTab === 'imperium' && S.mode !== 'empire') S.sideTab = 'quests';
  V.tabs(tabsEl, TABS, S.sideTab, function (id) { S.sideTab = id; confirmReset = false; V.Snd.click(); V.save(); refresh(); });
  body.innerHTML = '';
  if (V.meta.tabs[S.sideTab]) V.meta.tabs[S.sideTab](body);
  else if (S.sideTab === 'stufen') stufen();
  else if (S.sideTab === 'profil') profil();
  else if (S.sideTab === 'stats') stats();
  else haus();
}

function stufen() {
  var S = V.S, list = el('div', { class: 'tiers' });
  E.TIERS.forEach(function (T, i) {
    var h = A.HOSTESSES[i], locked = i > S.unlocked, here = i === S.room;
    var card = el('div', { class: 'tier' + (locked ? ' locked' : '') + (here ? ' here' : '') });
    var pic = el('div', { class: 'tier-pic', html: A.portrait(i, 't') });
    var info = el('div', { class: 'tier-info' },
      el('div', { class: 'tier-h' }, el('b', { text: T.name }), el('span', { class: 'tag', text: here ? 'Du bist hier' : locked ? 'Gesperrt' : 'Offen' })),
      el('div', { class: 'tier-l', text: h.name + ' · ' + h.role }),
      el('div', { class: 'tier-k' },
        el('span', { text: 'Einsatz ' + short(T.min) + ' bis ' + short(T.max) }),
        el('span', { text: 'Comps ' + (T.comp * 100).toFixed(1).replace('.', ',') + ' %' }),
        el('span', { text: i === 0 ? 'Startraum' : 'ab ' + short(T.wager) + ' Umsatz' }),
        T.bonus ? el('span', { text: 'Aufstiegsbonus ' + short(T.bonus) }) : null,
        V.isCareer() && V.gamesAt(i).length ? el('span', { class: 'unlock', text: 'Schaltet frei: ' + V.gamesAt(i).map(function (g) { return GNAME[g]; }).join(', ') }) : null,
        el('span', { text: 'Beziehung: ' + V.affTitle(S.aff[i]) })));
    var btn = el('button', { class: 'btn ' + (here ? 'ghost' : 'gold') + ' sm', type: 'button', text: here ? 'Aktueller Raum' : locked ? 'Noch ' + short(Math.max(0, T.wager - S.wagered)) + ' Umsatz' : 'Betreten',
      disabled: here || locked, onclick: function () { V.enterRoom(i); refresh(); } });
    info.appendChild(btn);
    card.appendChild(pic); card.appendChild(info);
    list.appendChild(card);
  });
  body.appendChild(el('p', { class: 'side-intro', text: V.isCareer()
    ? 'Jeder Chip, den du setzt, zählt als Umsatz und bringt dich näher an die nächste Stufe. Jede Stufe bringt höhere Limits, mehr Comps, eine eigene Gastgeberin und neue Spiele.'
    : 'Sandbox: Alle Räume und Spiele sind offen. Umsatz zählt trotzdem für deine Statistik.' }));
  body.appendChild(list);
}

function profil() {
  var S = V.S, p = E.profileOf(S.hist, catOf), P = E.PROFILES[p.key];
  var rec = E.recommend(p.key, S.balance, S.unlocked);
  var head = el('div', { class: 'prof-h' }, el('div', { class: 'prof-type', text: P.name }), p.hi ? el('span', { class: 'tag warn', text: 'Hohe Einsätze' }) : null);
  body.appendChild(head);
  body.appendChild(el('p', { text: P.desc }));
  var bars = el('div', { class: 'shares' });
  Object.keys(p.shares).sort(function (a, b) { return p.shares[b] - p.shares[a]; }).forEach(function (g) {
    var v = p.shares[g] || 0;
    var bar = el('i'); bar.style.width = (v * 100).toFixed(1) + '%';
    bars.appendChild(el('div', { class: 'share' }, el('span', { text: GNAME[g] }), el('div', { class: 'sbar' }, bar), el('span', { class: 'num', text: Math.round(v * 100) + ' %' })));
  });
  body.appendChild(el('h4', { text: 'Deine letzten ' + S.hist.length + ' Runden' }));
  body.appendChild(bars);
  body.appendChild(el('div', { class: 'kv' },
    el('span', { text: 'Ø Einsatz vom Guthaben' }), el('b', { class: 'num', text: (p.ratio * 100).toFixed(1).replace('.', ',') + ' %' })));
  body.appendChild(el('h4', { text: 'Dein Dopamin-Kick' }));
  body.appendChild(el('p', { text: P.kick }));
  var T = E.TIERS[rec.room];
  var box = el('div', { class: 'recbox' },
    el('div', { class: 'rec-h', text: 'Empfehlung des Hauses' }),
    el('div', { class: 'kv' }, el('span', { text: 'Spiel' }), el('b', { text: GNAME[rec.game] })),
    el('div', { class: 'kv' }, el('span', { text: 'Raum' }), el('b', { text: T.name })),
    el('div', { class: 'kv' }, el('span', { text: 'Einsatz' }), el('b', { class: 'num', text: fmt(rec.betLo) + ' bis ' + fmt(rec.betHi) })),
    el('button', { class: 'btn gold sm', type: 'button', text: 'Empfehlung übernehmen', onclick: function () { apply(rec); } }),
    el('p', { class: 'fine', text: 'So arbeiten echte Casinos: Sie messen dein Verhalten und schneiden Spiel und Einsatz auf den Moment zu, in dem du am längsten bleibst. Das hält dich am Tisch, macht dich aber nicht reicher.' }));
  body.appendChild(box);
}

function apply(rec) {
  var S = V.S;
  if (V.isBusy()) { V.toast('Beende erst die laufende Runde.', 'bad'); return; }
  if (!V.gameOpen(rec.game)) { V.toast(GNAME[rec.game] + ' ist noch nicht freigeschaltet.', 'bad'); return; }
  if (rec.room !== S.room) V.enterRoom(rec.room);
  var target = Math.sqrt(rec.betLo * rec.betHi);
  var l = V.ladder(), best = l[0];
  l.forEach(function (x) { if (Math.abs(Math.log(x / target)) < Math.abs(Math.log(best / target))) best = x; });
  if (rec.game === 'roulette') {
    var c = V.chipList(), bc = c[0];
    c.forEach(function (x) { if (Math.abs(Math.log(x / target)) < Math.abs(Math.log(bc / target))) bc = x; });
    S.rchip = bc;
  } else S.bets[rec.game] = best;
  V.showGame(rec.game);
  V.games.forEach(function (g) { if (g.onRoom) g.onRoom(); });
  V.toast('Empfehlung übernommen.', 'good');
  V.save(); refresh();
}

function spark(series) {
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 90'); svg.setAttribute('class', 'spark'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Verlauf deines Guthabens');
  var s = series.length > 1 ? series : [series[0] || 0, series[0] || 0];
  var mn = Math.min.apply(null, s), mx = Math.max.apply(null, s);
  if (mx === mn) { mx += 1; mn -= 1; }
  var pts = s.map(function (v, i) { return [(i / (s.length - 1) * 292 + 4), (82 - (v - mn) / (mx - mn) * 72)]; });
  var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  var area = document.createElementNS(NS, 'path');
  area.setAttribute('d', d + ' L296 86 L4 86 Z'); area.setAttribute('class', 'sp-area');
  var line = document.createElementNS(NS, 'path');
  line.setAttribute('d', d); line.setAttribute('class', 'sp-line');
  var last = pts[pts.length - 1], dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', last[0]); dot.setAttribute('cy', last[1]); dot.setAttribute('r', '3.5'); dot.setAttribute('class', 'sp-dot');
  svg.appendChild(area); svg.appendChild(line); svg.appendChild(dot);
  return svg;
}

function stats() {
  var S = V.S, net = S.returned - S.wagered;
  body.appendChild(el('div', { class: 'big-kv' },
    el('div', {}, el('span', { text: 'Bilanz an den Tischen' }), el('b', { class: 'num ' + (net >= 0 ? 'pos' : 'neg'), text: (net >= 0 ? '+' : '−') + fmt(Math.abs(net)) })),
    el('div', {}, el('span', { text: 'Umsatz' }), el('b', { class: 'num', text: fmt(S.wagered) })),
    el('div', {}, el('span', { text: 'Runden' }), el('b', { class: 'num', text: fmt(S.rounds) }))));
  body.appendChild(el('h4', { text: 'Guthaben, letzte ' + S.series.length + ' Stände' }));
  body.appendChild(spark(S.series));
  var tbl = el('table', { class: 'stbl' },
    el('thead', {}, el('tr', {}, el('th', { text: 'Spiel' }), el('th', { text: 'Runden' }), el('th', { text: 'Umsatz' }), el('th', { text: 'Deine Quote' }), el('th', { text: 'Theorie' }))));
  var tb = el('tbody');
  V.GAME_LIST.forEach(function (gg) {
    var g = gg.id, x = S.gst[g] || { r: 0, w: 0, ret: 0 };
    if (V.isCareer() && !V.gameOpen(g) && !x.r) return;
    var q = x.w > 0 ? (x.ret / x.w * 100).toFixed(1).replace('.', ',') + ' %' : '–';
    tb.appendChild(el('tr', {}, el('td', { text: GNAME[g] }), el('td', { class: 'num', text: fmt(x.r) }), el('td', { class: 'num', text: short(x.w) }),
      el('td', { class: 'num', text: q }), el('td', { class: 'num', text: ((1 - edge(g)) * 100).toFixed(1).replace('.', ',') + ' %' })));
  });
  tbl.appendChild(tb);
  body.appendChild(el('div', { class: 'tscroll' }, tbl));
  body.appendChild(el('div', { class: 'kvs' },
    el('div', { class: 'kv' }, el('span', { text: 'Größter Gewinn' }), el('b', { class: 'num', text: fmt(S.biggest) })),
    el('div', { class: 'kv' }, el('span', { text: 'Bester Crash-Cashout' }), el('b', { class: 'num', text: S.bestMult ? V.fmtX(S.bestMult) : '–' })),
    V.isCareer()
      ? el('div', { class: 'kv' }, el('span', { text: 'Notgroschen geholt' }), el('b', { class: 'num', text: S.bailouts + '× · ' + fmt(S.bailedOut) }))
      : el('div', { class: 'kv' }, el('span', { text: 'Nachschub geholt' }), el('b', { class: 'num', text: S.reloads + '× · ' + fmt(S.reloaded) })),
    V.isCareer() ? el('div', { class: 'kv' }, el('span', { text: 'Tagesbonus' }), el('b', { class: 'num', text: 'Serie ' + S.dailyStreak + ' · ' + fmt(S.dailyTotal) })) : null,
    el('div', { class: 'kv' }, el('span', { text: 'Comps eingelöst' }), el('b', { class: 'num', text: fmt(S.compsClaimed) })),
    el('div', { class: 'kv' }, el('span', { text: 'Trinkgeld gegeben' }), el('b', { class: 'num', text: S.tips + '×' })),
    el('div', { class: 'kv' }, el('span', { text: 'Spielzeit' }), el('b', { class: 'num', text: V.clock(S.playMs) }))));
  body.appendChild(el('p', { class: 'fine', text: 'Kurzfristig schwankt deine Quote stark. Je mehr du spielst, desto näher rückt sie an den theoretischen Wert.' }));
}

function haus() {
  var S = V.S, exp = 0;
  V.GAME_LIST.forEach(function (g) { exp += (S.gst[g.id] ? S.gst[g.id].w : 0) * g.edge; });
  body.appendChild(el('p', { class: 'side-intro', text: 'Was ein echtes Casino nie anzeigen würde.' }));
  body.appendChild(el('div', { class: 'kvs' },
    el('div', { class: 'kv' }, el('span', { text: 'Erwarteter Verlust bisher' }), el('b', { class: 'num neg', text: '−' + fmt(exp) })),
    el('div', { class: 'kv' }, el('span', { text: 'Tatsächlich' }), el('b', { class: 'num ' + (S.returned - S.wagered >= 0 ? 'pos' : 'neg'), text: (S.returned - S.wagered >= 0 ? '+' : '−') + fmt(Math.abs(S.returned - S.wagered)) })),
    el('div', { class: 'kv' }, el('span', { text: 'Comps verdient' }), el('b', { class: 'num', text: fmt(S.comps + S.compsClaimed) }))));
  var tricks = [
    ['Keine Uhren, keine Fenster', 'Die Zeit verschwimmt. Deshalb meldet sich hier alle 30 Minuten ein Realitätscheck.'],
    ['Chips statt Geld', 'Ein Stapel Plastik fühlt sich nicht wie Miete an. Große Zahlen verlieren ihre Schwere.'],
    ['Verluste als Gewinn verkleidet', 'Bei Slots blinkt und klingelt es auch, wenn du weniger zurückbekommst als eingesetzt.'],
    ['Fast-Treffer', 'Zwei Bonus-Symbole fühlen sich an wie „beinahe“. Für die Walzen ist es einfach ein Verlust.'],
    ['Stufen und Comps', 'Aufstieg belohnt Umsatz, nicht Gewinn. Comps sind ein kleiner Teil deines erwarteten Verlusts.'],
    ['Persönliche Ansprache', 'Eine Gastgeberin, die dich kennt, macht das Gehen schwerer. Die Beziehung wächst mit jedem Einsatz.']
  ];
  var ul = el('div', { class: 'tricks' });
  tricks.forEach(function (t) { ul.appendChild(el('div', { class: 'trick' }, el('b', { text: t[0] }), el('span', { text: t[1] }))); });
  body.appendChild(el('h4', { text: 'Die Tricks des Hauses' }));
  body.appendChild(ul);
  body.appendChild(el('h4', { text: 'Einstellungen' }));
  var snd = el('button', { class: 'btn ghost sm', type: 'button', 'aria-pressed': String(S.sound), text: S.sound ? 'Ton an' : 'Ton aus', onclick: function () { S.sound = !S.sound; V.save(); refresh(); V.syncSound(); } });
  var reset;
  if (!confirmReset) reset = el('button', { class: 'btn ghost sm', type: 'button', text: 'Diesen Spielstand zurücksetzen', onclick: function () { confirmReset = true; refresh(); } });
  else reset = el('span', { class: 'confirm' }, el('span', { text: 'Wirklich von vorn beginnen?' }),
    el('button', { class: 'btn crimson sm', type: 'button', text: 'Ja, zurücksetzen', onclick: function () { V.hardReset(); } }),
    el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmReset = false; refresh(); } }));
  body.appendChild(el('div', { class: 'rrow' }, snd, reset));
  body.appendChild(el('p', { class: 'fine', text: 'Alles hier ist Spielgeld ohne Wert. Wenn echtes Glücksspiel für dich oder jemanden in deiner Nähe zum Problem wird: Die Telefonberatung zur Glücksspielsucht des BIÖG (früher BZgA) ist kostenlos und anonym: 0800 1 37 27 00.' }));
}

V.side = { build: build, refresh: refresh };
})();
