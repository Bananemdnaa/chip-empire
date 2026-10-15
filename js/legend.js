/* Chip Empire – Langzeitziele: Legende werden (Prestige) und die Wochen-Saison mit eigener Bestenliste */
(function () {
'use strict';
var E = V.E, el = V.el, fmt = V.fmt, short = V.short;

/* ================= Legende ================= */
/* Nur Karriere: im Black Room ab 25 Mio. Chips, jeder weitere Stern verlangt 25 Mio. mehr */
var STEP = 25000000;
function stars() { return V.S.stars || 0; }
function need() { return STEP * (stars() + 1); }
function eligible() { return V.S.mode === 'career'; }
function ready() { return eligible() && V.S.unlocked >= 5 && V.S.balance >= need(); }
/* Talentpunkte für den n-ten Stern: spätere Sterne bringen mehr (2, 2, 3, 3, 4, 4, dann 5), dazu Talent Vermächtnis */
function tpFor(n) { return 2 + Math.min(3, Math.floor((n - 1) / 2)) + V.meta.perk('legTp'); }

/* ---------- Legenden-Ränge: mehr Sterne, mehr Ansehen und dauerhafte Vorteile ----------
   Die Vorteile gelten außerhalb der Spiele (Aufstieg, Truhen, Startgeld, Tagesbonus), die Auszahlungsquoten bleiben gleich. */
var RANKS = [
  { at: 1, id: 'leg', name: 'Legende', icon: '★', perks: {} },
  { at: 2, id: 'gm', name: 'Großmeister', icon: '✦', perks: { rush: 0.1, chest: 0.1 } },
  { at: 3, id: 'elite', name: 'Elite', icon: '❖', perks: { rush: 0.2, chest: 0.2, start: 10000 } },
  { at: 5, id: 'myth', name: 'Mythos', icon: '✶', perks: { rush: 0.35, chest: 0.35, start: 50000, daily: 0.25 } },
  { at: 8, id: 'imm', name: 'Unsterblich', icon: '☀', perks: { rush: 0.5, chest: 0.5, start: 250000, daily: 0.5 } },
  { at: 12, id: 'eter', name: 'Ewig', icon: '♛', perks: { rush: 0.75, chest: 0.75, start: 1000000, daily: 1 } }
];
var PERK_TEXT = {
  rush: function (v) { return 'Umsatz zählt für den Aufstieg +' + Math.round(v * 100) + ' %'; },
  chest: function (v) { return 'Sitzungs-Truhen +' + Math.round(v * 100) + ' % Chips'; },
  start: function (v) { return '+' + short(v) + ' Startchips nach jedem Stern'; },
  daily: function (v) { return 'Tagesbonus +' + Math.round(v * 100) + ' %'; }
};
function rankOf(n) { var r = null; RANKS.forEach(function (R) { if (n >= R.at) r = R; }); return r; }
function nextRank(n) { for (var i = 0; i < RANKS.length; i++) if (RANKS[i].at > n) return RANKS[i]; return null; }
function rankPerk(k) { var r = V.S.mode === 'career' ? rankOf(stars()) : null; return (r && r.perks[k]) || 0; }
/* Kurzform für Ranglisten und Profile: Rang-Symbol und Sterne, z. B. „❖3“ */
function tag(n) { var r = rankOf(n || 0); return r ? r.icon + (n > 1 ? n : '') : ''; }
function startChips() { return V.CAREER.start + V.meta.perk('legStart') + rankPerk('start'); }

var confirmOpen = false;
function ascend() {
  var S = V.S;
  if (!ready()) return;
  if (V.isBusy()) { V.toast('Beende erst die laufende Runde.', 'bad'); return; }
  var before = rankOf(stars());
  S.stars = stars() + 1;
  var tp = tpFor(S.stars), now = rankOf(S.stars), newRank = now && now !== before;
  S.bonusTp += tp;
  /* Zurück auf Anfang: Chips, Räume, Umsatz, Comps. Level, Talente, Quests und Statistik bleiben. */
  S.balance = startChips(); S.escrow = 0; S.returned -= S.wagered; S.wagered = 0; S.wagerBonus = 0; S.unlocked = 0; S.room = 0; S.comps = 0;
  S.free = { n: 0, bet: 0, won: 0 }; S.bailoutAt = 0; S.winStreak = 0; S.lossStreak = 0;
  S.series = [S.balance];
  V.clampBets();
  confirmOpen = false;
  V.closeSide();
  V.renderHost(); V.renderTier(); V.renderNav();
  if (!V.gameOpen(S.game)) V.showGame('slots');
  V.games.forEach(function (g) { if (g.onRoom) g.onRoom(); });
  V.Snd.unlock(); setTimeout(V.Snd.big, 600);
  V.burst(V.$('#app'), 80);
  V.banner(newRank ? now.icon + ' Neuer Rang: ' + now.name + ' ' + now.icon : '★ Legende ' + S.stars + ' ★',
    'Stern ' + S.stars + ' · Neustart in der Lobby mit ' + fmt(S.balance) + ' Chips · +' + tp + ' Talentpunkte' + (newRank && now.at > 1 ? ' · neue Rang-Vorteile unter „Stufen“' : ' · dauerhaft mehr XP und Comps'), { kind: 'level', ms: 8000 });
  V.say('greet', true);
  V.hud(); V.side.refresh(); renderStars(); V.save();
}

function renderStars() {
  var x = V.$('#stars'); if (!x) return;
  var n = stars();
  var r = rankOf(n);
  x.hidden = !n;
  x.textContent = tag(n);
  x.setAttribute('data-rank', r ? r.id : '');
  x.title = (r ? r.name + ' · ' : '') + n + ' Stern' + (n > 1 ? 'e' : '') + ': +' + Math.min(20, n) * 10 + ' % XP, +' + Math.min(5, n) * 5 + ' % Comps';
}
/* Rangleiter mit Vorteilen, aktueller Rang hervorgehoben */
function hall() {
  var n = stars(), cur = rankOf(n), nx = nextRank(n);
  var box = el('div', { class: 'lg-hall' });
  RANKS.forEach(function (R) {
    var got = n >= R.at, perks = Object.keys(R.perks).map(function (k) { return PERK_TEXT[k](R.perks[k]); });
    if (R.at === 1) perks = ['Pro Stern +10 % XP (bis 20 Sterne) und +5 % Comps (bis 5 Sterne)', 'Legenden-Ast im Talentbaum'];
    box.appendChild(el('div', { class: 'lg-rank' + (got ? ' got' : '') + (R === cur ? ' cur' : ''), 'data-rank': R.id },
      el('span', { class: 'lg-ri', text: R.icon }),
      el('div', {}, el('b', { text: R.name }), el('small', { text: 'ab ' + R.at + ' Stern' + (R.at > 1 ? 'en' : '') }),
        el('ul', {}, perks.map(function (p) { return el('li', { text: p }); })))));
  });
  if (nx) box.appendChild(el('p', { class: 'fine', text: 'Nächster Rang: ' + nx.name + ' bei ' + nx.at + ' Sternen (noch ' + (nx.at - n) + ').' }));
  return box;
}

/* Kasten oben im Reiter „Stufen“ */
function box() {
  var S = V.S, n = stars(), nd = need(), inBR = S.unlocked >= 5, p = inBR ? Math.min(1, S.balance / nd) : V.climbed() / E.TIERS[5].wager;
  var b = el('section', { class: 'legend-box' + (ready() ? ' ready' : '') });
  b.appendChild(el('div', { class: 'lg-h' },
    el('span', { class: 'lg-stars', 'data-rank': n ? rankOf(n).id : '', text: n ? rankOf(n).icon + ' ' + n : '☆' }),
    el('div', {}, el('b', { text: n ? rankOf(n).name + ' · ' + n + ' Stern' + (n > 1 ? 'e' : '') : 'Werde zur Legende' }),
      el('small', { text: inBR ? 'Nächster Stern bei ' + short(nd) + ' Chips im Black Room' : 'Erst den Black Room erreichen, dann ' + short(nd) + ' Chips sammeln' }))));
  var i = el('i'); i.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%';
  b.appendChild(el('div', { class: 'mbar' }, i));
  b.appendChild(el('p', { class: 'fine', text: inBR ? fmt(S.balance) + ' / ' + fmt(nd) + ' Chips' : short(Math.floor(V.climbed())) + ' / ' + short(E.TIERS[5].wager) + ' Umsatz bis zum Black Room' }));
  b.appendChild(el('ul', { class: 'lg-list' },
    el('li', { text: 'Du startest neu in der Lobby mit ' + fmt(startChips()) + ' Chips. Räume, Umsatz und Comps gehen zurück auf null.' }),
    el('li', { text: 'Level, Talente, Quests, Meilensteine und Statistik bleiben.' }),
    el('li', { text: 'Der nächste Stern bringt ' + tpFor(n + 1) + ' Talentpunkte, +10 % XP und +5 % Comps für immer. Spätere Sterne bringen mehr Talentpunkte.' }),
    el('li', { text: 'Mit mehr Sternen steigst du im Legenden-Rang: schnellerer Aufstieg, größere Truhen, mehr Startchips und Tagesbonus (siehe unten).' }),
    el('li', { text: 'In der Karriere-Bestenliste zählen zuerst die Sterne, dann die Chips.' })));
  b.appendChild(el('details', { class: 'lg-more' }, el('summary', { text: 'Legenden-Ränge und ihre Vorteile' }), hall()));
  if (!ready()) b.appendChild(el('button', { class: 'btn ghost', type: 'button', disabled: true, text: '★ Legende werden' }));
  else if (!confirmOpen) b.appendChild(el('button', { class: 'btn gold pulse', type: 'button', text: '★ Legende werden', onclick: function () { confirmOpen = true; V.Snd.click(); V.side.refresh(); } }));
  else b.appendChild(el('span', { class: 'confirm' }, el('span', { text: 'Wirklich? Deine ' + fmt(S.balance) + ' Chips sind danach weg.' }),
    el('button', { class: 'btn gold sm', type: 'button', text: 'Ja, Legende werden', onclick: ascend }),
    el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmOpen = false; V.side.refresh(); } })));
  return b;
}

/* Einmaliger Hinweis, sobald der nächste Stern möglich ist */
var hinted = false;
function maybeHint() {
  if (hinted || !ready()) return;
  hinted = true;
  V.banner('★ Du kannst Legende werden', 'Unter „Stufen“: Neustart mit Stern, Bonus-Talentpunkten und Platz ganz oben in der Bestenliste.', { kind: 'level', ms: 9000,
    actions: [{ label: 'Ansehen', gold: true, fn: function () { V.openSide('stufen'); } }, { label: 'Später', fn: function () {} }] });
}

/* ================= Wochen-Saison ================= */
/* Woche beginnt am Montag (Ortszeit). Gewertet wird der Gewinn aus allen Runden seit Montag. */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function mondayKey(offsetWeeks) {
  var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * (offsetWeeks || 0));
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function blankSeason(key) { return { key: key, net: 0, best: 0, rounds: 0 }; }
function season() {
  var S = V.S, k = mondayKey();
  if (!S.season || S.season.key !== k) {
    if (S.season && S.season.key) S.seasonPrev = S.season;
    S.season = blankSeason(k);
  }
  return S.season;
}
function round(staked, ret) {
  if (staked <= 0 && ret <= 0) return;
  var s = season(), d = ret - staked;
  s.net += d; if (staked > 0) s.rounds++;
  s.best = Math.max(s.best, d);
}
function untilReset() {
  var d = new Date(), m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7) + 7);
  var h = Math.max(0, Math.round((m - d) / 3600000));
  return h >= 24 ? Math.floor(h / 24) + ' T. ' + (h % 24) + ' Std.' : h + ' Std.';
}

/* Belohnung für die Vorwoche: einmal pro Woche beim Spielstart nachfragen.
   Der Server zahlt pro Konto nur einmal aus, auch bei mehreren Karriere-Spielständen. */
var REWARD = [[1, 5, 'Wochensieger'], [2, 3, 'Zweiter der Woche'], [3, 2, 'Dritter der Woche'], [10, 1, 'Top 10 der Woche']];
function claimLastWeek() {
  var S = V.S, wk = mondayKey(1);
  if (S.mode !== 'career' || !Store.isAccount() || S.seasonClaimed === wk) return;
  Cloud.rpc('season_claim', { wk: wk }).then(function (rank) {
    S.seasonClaimed = wk;
    var r = null;
    REWARD.forEach(function (x) { if (!r && rank && rank <= x[0]) r = x; });
    if (r) {
      S.bonusTp += r[1];
      S.trophies = (S.trophies || 0) + (rank === 1 ? 1 : 0);
      setTimeout(function () {
        V.Snd.big(); V.burst(V.$('#app'), 50);
        V.banner('🏆 ' + r[2], 'Platz ' + rank + ' in der Wochenwertung · +' + r[1] + ' Talentpunkt' + (r[1] > 1 ? 'e' : ''), { kind: 'win', ms: 8000 });
      }, 2000);
      V.renderBadges();
    }
    V.save();
  }).catch(function () { /* ohne Datenbank-Update oder offline: beim nächsten Start */ });
}

function init() {
  season(); renderStars(); claimLastWeek();
  setInterval(maybeHint, 5000);
}

V.legend = { RANKS: RANKS, rankOf: rankOf, rankPerk: rankPerk, tag: tag, hall: hall, tpFor: tpFor, init: init, box: box, round: round, ascend: ascend, stars: stars, ready: ready, season: season, mondayKey: mondayKey, untilReset: untilReset, renderStars: renderStars };
})();
