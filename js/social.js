/* Chip Empire – Mitspieler: Arena mit Duellen, Freunden und Duell-Rangliste, dazu Spielerprofile */
var Social = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var view = 'duels', D = { me: null, list: null, lobby: null, board: null }, err = '', loading = false, stamp = 0;
var openDetail = null, busy = false, rerender = null;

function account() { return Store.isAccount() ? Cloud.current() : null; }
function ago(t) {
  var s = (Date.now() - Date.parse(t)) / 1000;
  if (!isFinite(s)) return '';
  if (s < 90) return 'gerade eben';
  if (s < 3600) return 'vor ' + Math.round(s / 60) + ' Min.';
  if (s < 86400) return 'vor ' + Math.round(s / 3600) + ' Std.';
  return 'vor ' + Math.round(s / 86400) + ' Tagen';
}
function tierName(u) { return E.TIERS[Math.max(0, Math.min(5, u || 0))].name; }
/* Nicht neu zeichnen, solange jemand in der Spielersuche tippt; das holt der nächste Anlass nach */
function redraw() {
  var a = document.activeElement;
  if (a && a.tagName === 'INPUT' && a.closest && a.closest('.fr-search')) return;
  if (rerender) rerender();
}
Friends.onChange(function () { redraw(); if (V.renderBadges) V.renderBadges(); listeners.forEach(function (fn) { fn(); }); });
var listeners = [];

/* ---------- Daten ---------- */
async function load(force) {
  var a = account();
  if (!a || loading || (!force && Date.now() - stamp < 20000)) return;
  loading = true;
  try {
    var r = await Promise.all([
      Cloud.rpc('player_profile', { name: a.username }), Cloud.rpc('duel_list'), Cloud.rpc('duel_lobby'),
      Cloud.rpc('duel_board', { lim: 20 }), Friends.load(force)]);
    D.me = r[0]; D.list = r[1] || []; D.lobby = r[2] || []; D.board = r[3] || []; err = '';
  } catch (e) {
    err = /noch nicht eingerichtet/.test(e.message || '') ? 'Für die Arena fehlt noch das Datenbank-Update (SQL in Supabase ausführen).' : 'Arena gerade nicht erreichbar: ' + (e.message || e);
  }
  stamp = Date.now(); loading = false;
  if (V.renderBadges) V.renderBadges();
  redraw();
  listeners.forEach(function (fn) { fn(); });
}
/* Einladungen, Freundschaftsanfragen und neue Ergebnisse */
function seenIds() { try { return JSON.parse(localStorage.getItem('chip-empire-seen-duels') || '[]'); } catch (e) { return []; } }
function markSeen() {
  if (!D.list) return;
  var ids = D.list.filter(function (r) { return r.status === 'done'; }).map(function (r) { return r.id; });
  try { localStorage.setItem('chip-empire-seen-duels', JSON.stringify(ids.slice(0, 60))); } catch (e) { /* */ }
}
function unseenResults() { var s = seenIds(); return (D.list || []).filter(function (r) { return r.status === 'done' && s.indexOf(r.id) < 0; }).length; }
function invites() { return (D.list || []).filter(function (r) { return r.role === 'b' && r.status === 'open'; }); }
/* Anzahl offener Dinge: laufendes Duell, Einladungen, neue Ergebnisse, Freundschaftsanfragen */
function count() {
  if (!account()) return 0;
  return (Duel.pending() ? 1 : 0) + invites().length + unseenResults() + Friends.incoming().length;
}
function badge() { return count() > 0; }

/* Server-Aktion mit Sperre und Fehlermeldung */
async function act(fn, ok) {
  if (busy) return;
  busy = true;
  try { var r = await fn(); if (ok) V.toast(typeof ok === 'function' ? ok(r) : ok, 'good'); }
  catch (e) { V.toast(e.message || String(e), 'bad'); }
  busy = false;
  await load(true);
}

/* ---------- Duelle starten ---------- */
function canDuel() {
  if (Duel.isOpen()) return false;
  if (Duel.pending()) { V.toast('Spiel erst dein laufendes Duell zu Ende.', 'bad'); return false; }
  if (V.isBusy && V.isBusy()) { V.toast('Beende erst die laufende Runde.', 'bad'); return false; }
  return true;
}
var GAME_KEY = 'chip-empire-duel-game';
var newGame = (function () { try { return localStorage.getItem(GAME_KEY) || 'crash'; } catch (e) { return 'crash'; } })();
function setGame(g) { newGame = g; try { localStorage.setItem(GAME_KEY, g); } catch (e) { /* */ } }
function gameInfo(g) { return Duel.GAMES[g] || Duel.GAMES.crash; }
/* Ohne Spielangabe (z. B. aus Profil oder Freundesliste) erst das Spiel wählen lassen */
function challenge(name, game) {
  if (!account() || !canDuel()) return;
  if (!game) { pickGame(name); return; }
  setGame(game);
  act(async function () {
    var rows = await Cloud.rpc('duel_create', { opp: name || null, gm: game });
    var r = rows && rows[0];
    if (!r) throw new Error('Duell konnte nicht angelegt werden.');
    closeProfile();
    Duel.start({ id: r.id, opp: name || '', role: 'a', game: game, points: r.points, setup: r.setup }, function () { load(true); });
  });
}
function accept(id, opp) {
  if (!canDuel()) return;
  act(async function () {
    var r = await Cloud.rpc('duel_join', { did: id });
    Duel.start({ id: id, opp: opp, role: 'b', game: r.game, points: r.points, setup: r.setup }, function () { load(true); });
  });
}
function $$(sel, r) { return Array.prototype.slice.call(r.querySelectorAll(sel)); }
/* Auswahl der drei Duell-Spiele als Kacheln */
function gamePicker() {
  var box = el('div', { class: 'dg-pick', role: 'radiogroup', 'aria-label': 'Spiel für das Duell' });
  Object.keys(Duel.GAMES).forEach(function (g) {
    var G = Duel.GAMES[g];
    box.appendChild(el('button', { class: 'dg-tile', type: 'button', role: 'radio', 'aria-checked': String(newGame === g),
      onclick: function () { setGame(g); V.Snd.click(); $$('.dg-tile', box).forEach(function (b) { b.setAttribute('aria-checked', String(b === this)); }, this); } },
      el('span', { class: 'dg-ico', text: G.icon }), el('b', { text: G.name }), el('span', { class: 'dg-tag', text: G.tag }), el('span', { class: 'dg-desc', text: G.desc })));
  });
  return box;
}
function pickGame(name) {
  closeProfile();
  var p = panel('Duell gegen ' + name, closeProfile);
  profDlg = p.dlg;
  p.body.appendChild(el('p', { class: 'fine dg-intro', text: 'Wähle das Spiel. ' + name + ' spielt danach genau dieselben Runden.' }));
  p.body.appendChild(gamePicker());
  p.body.appendChild(el('div', { class: 'rrow dg-go' }, el('button', { class: 'btn gold big', type: 'button', text: '⚔ Duell starten', onclick: function () { challenge(name, newGame); } })));
  p.dlg.querySelector('.dg-tile[aria-checked="true"]').focus();
}
function gameChip(g) { var G = gameInfo(g); return el('span', { class: 'tag dg-chip', title: G.name, text: G.icon + ' ' + G.name }); }

/* ---------- Arena ---------- */
/* only = 'duels': nur die Duelle ohne Reiter (das Hauptmenü hat Freunde und Ranglisten als eigene Bereiche) */
function render(host, refresh, only) {
  rerender = refresh;
  if (only) view = only;
  var a = account();
  if (!a) {
    host.appendChild(el('p', { class: 'side-intro', text: 'In der Arena trittst du gegen andere Spieler an: Duelle in Crash, Dragon Tower oder Blackjack mit gleichen Chancen für beide, Freunde und eine eigene Rangliste.' }));
    host.appendChild(el('p', { class: 'fine', text: Cloud.available() ? 'Dafür brauchst du ein Konto. Geh ins Hauptmenü und logg dich ein, deine Gast-Spielstände kannst du mitnehmen.' : 'Gerade keine Verbindung zum Server.' }));
    return;
  }
  load();
  var cnt = { duels: invites().length + unseenResults() + (Duel.pending() ? 1 : 0), friends: Friends.incoming().length, board: 0 };
  var seg = el('div', { class: 'qseg', role: 'tablist' });
  [['duels', 'Duelle'], ['friends', 'Freunde'], ['board', 'Rangliste']].forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === x[0]), onclick: function () { view = x[0]; V.Snd.click(); redraw(); } },
      x[1], cnt[x[0]] ? el('span', { class: 'qcount', text: String(cnt[x[0]]) }) : null));
  });
  if (!only) host.appendChild(seg);
  if (err) { host.appendChild(el('p', { class: 'fine', text: err })); return; }
  if (!D.list) { host.appendChild(el('p', { class: 'fine', text: 'Lade die Arena …' })); return; }
  if (view === 'friends') Friends.render(host);
  else if (view === 'board') board(host);
  else duels(host);
}

function meCard() {
  var m = D.me || {};
  return el('div', { class: 'arena-me' },
    el('div', { class: 'ar-rating' }, el('span', { text: 'Deine Wertung' }), el('b', { class: 'num', text: fmt(m.rating || 1000) })),
    el('div', { class: 'ar-rec' },
      el('span', { class: 'w', text: (m.wins || 0) + ' S' }), el('span', { class: 'l', text: (m.losses || 0) + ' N' }), el('span', { text: (m.draws || 0) + ' U' })));
}
function nameBtn(name) { return el('button', { class: 'linkbtn', type: 'button', text: name, onclick: function () { profile(name); } }); }

function duels(host) {
  host.appendChild(meCard());
  var p = Duel.pending();
  if (p) {
    host.appendChild(el('div', { class: 'duel-row hot' },
      el('div', { class: 'dr-ico', text: '⏸' }),
      el('div', { class: 'dr-info' }, el('b', { text: 'Laufendes Duell' + (p.opp ? ' gegen ' + p.opp : '') }),
        el('span', { class: 'fine', text: gameInfo(p.game).name + ' · Runde ' + Math.min(Duel.rounds(p), p.log.length + (p.log.length && !p.log[p.log.length - 1].f ? 0 : 1)) + ' von ' + Duel.rounds(p) + '. Nach 30 Minuten zählt es mit 0 Chips.' })),
      el('button', { class: 'btn gold sm', type: 'button', text: 'Weiterspielen', onclick: function () { Duel.resume(function () { load(true); }); } })));
  }
  /* Neues Duell: erst das Spiel, dann der Gegner */
  var input = el('input', { class: 'name-in sm', type: 'text', maxlength: '16', placeholder: 'Benutzername', 'aria-label': 'Gegner', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && input.value.trim()) challenge(input.value.trim(), newGame); });
  var fr = Friends.friends();
  host.appendChild(el('div', { class: 'duel-new' },
    el('h4', { text: 'Neues Duell' }),
    el('p', { class: 'fine', text: 'Beide spielen dieselben Runden mit demselben Zufall und starten mit 1.000 Duell-Chips. Dein Kontostand ist egal.' }),
    el('div', { class: 'dn-step', text: '1. Spiel wählen' }),
    gamePicker(),
    el('div', { class: 'dn-step', text: '2. Gegner wählen' }),
    el('div', { class: 'dn-row' },
      el('button', { class: 'btn gold', type: 'button', text: '⚔ Offen für alle', title: 'Jeder kann die Herausforderung annehmen', onclick: function () { challenge(null, newGame); } }),
      el('span', { class: 'dn-or', text: 'oder' }), input,
      el('button', { class: 'btn ghost', type: 'button', text: 'Herausfordern', onclick: function () { if (input.value.trim()) challenge(input.value.trim(), newGame); else input.focus(); } })),
    fr.length ? el('div', { class: 'dn-friends' }, el('span', { class: 'fine', text: 'Freunde:' }),
      fr.slice(0, 8).map(function (f) { return el('button', { class: 'chipbtn' + (Friends.online(f) ? ' online' : ''), type: 'button', text: '⚔ ' + f.username, title: Friends.online(f) ? 'Spielt gerade' : '', onclick: function () { challenge(f.username, newGame); } }); })) : null));

  var inv = invites();
  if (inv.length) {
    host.appendChild(el('h4', { text: 'Einladungen' }));
    inv.forEach(function (r) {
      host.appendChild(el('div', { class: 'duel-row hot' },
        el('div', { class: 'dr-ico', text: gameInfo(r.game).icon }),
        el('div', { class: 'dr-info' }, el('b', {}, nameBtn(r.opponent), ' fordert dich heraus'), el('span', { class: 'fine' }, gameChip(r.game), ' ' + ago(r.created_at) + ' · hat schon gespielt')),
        el('div', { class: 'dr-act' },
          el('button', { class: 'btn gold sm', type: 'button', text: 'Annehmen', onclick: function () { accept(r.id, r.opponent); } }),
          el('button', { class: 'btn ghost sm', type: 'button', text: 'Ablehnen', onclick: function () { act(function () { return Cloud.rpc('duel_decline', { did: r.id }); }); } }))));
    });
  }
  if (D.lobby.length) {
    host.appendChild(el('h4', { text: 'Offene Herausforderungen' }));
    D.lobby.forEach(function (r) {
      host.appendChild(el('div', { class: 'duel-row' },
        el('div', { class: 'dr-ico', text: gameInfo(r.game).icon }),
        el('div', { class: 'dr-info' }, el('b', {}, nameBtn(r.challenger)), el('span', { class: 'fine' }, gameChip(r.game), ' Wertung ' + fmt(r.rating) + ' · ' + ago(r.created_at))),
        el('button', { class: 'btn gold sm', type: 'button', text: 'Annehmen', onclick: function () { accept(r.id, r.challenger); } })));
    });
  }
  var waiting = D.list.filter(function (r) { return (r.role === 'a' && r.status === 'open') || r.status === 'a_playing' || r.status === 'b_playing'; });
  if (waiting.length) {
    host.appendChild(el('h4', { text: 'Warten auf Gegner' }));
    waiting.forEach(function (r) {
      var txt = r.status === 'open' ? (r.opponent ? r.opponent + ' ist dran' : 'Offen für alle') : r.status === 'b_playing' && r.role === 'a' ? (r.opponent || 'Gegner') + ' spielt gerade' : 'Läuft noch';
      host.appendChild(el('div', { class: 'duel-row' },
        el('div', { class: 'dr-ico', text: gameInfo(r.game).icon }),
        el('div', { class: 'dr-info' }, el('b', { text: txt }), el('span', { class: 'fine' }, gameChip(r.game), ' ' + (r.my_score != null ? 'Dein Ergebnis: ' + fmt(r.my_score) + ' · ' : '') + ago(r.created_at)))));
    });
  }
  var done = D.list.filter(function (r) { return r.status === 'done' || r.status === 'declined' || r.status === 'expired' || r.status === 'void'; });
  if (done.length) {
    var seen = seenIds();
    host.appendChild(el('h4', { text: 'Ergebnisse' }));
    done.forEach(function (r) { host.appendChild(resultRow(r, seen.indexOf(r.id) < 0)); });
    markSeen();
    setTimeout(function () { if (V.renderBadges) V.renderBadges(); }, 0);
  }
  if (!inv.length && !D.lobby.length && !waiting.length && !done.length && !p) {
    host.appendChild(el('p', { class: 'fine', text: 'Noch keine Duelle. Stell eine offene Herausforderung ein oder fordere einen Freund heraus.' }));
  }
}

function resultRow(r, fresh) {
  if (r.status !== 'done') {
    return el('div', { class: 'duel-row dim' }, el('div', { class: 'dr-ico', text: '–' }),
      el('div', { class: 'dr-info' }, el('b', { text: (r.opponent || 'Offene Herausforderung') + ': ' + (r.status === 'declined' ? 'abgelehnt' : r.status === 'void' ? 'vom Team annulliert' : 'verfallen') }),
        el('span', { class: 'fine', text: ago(r.finished_at || r.created_at) })));
  }
  var mine = Number(r.my_score), theirs = Number(r.their_score), d = r.my_delta || 0;
  var kind = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'draw';
  var row = el('div', { class: 'duel-row res ' + kind + (fresh ? ' fresh' : '') },
    el('div', { class: 'dr-ico', text: kind === 'win' ? '🏆' : kind === 'loss' ? '💥' : '🤝' }),
    el('div', { class: 'dr-info' },
      el('b', {}, (kind === 'win' ? 'Sieg gegen ' : kind === 'loss' ? 'Niederlage gegen ' : 'Unentschieden gegen '), nameBtn(r.opponent || '?')),
      el('span', { class: 'fine' }, gameChip(r.game), ' ' + fmt(mine) + ' zu ' + fmt(theirs) + ' · ' + ago(r.finished_at))),
    el('div', { class: 'dr-act' },
      el('span', { class: 'delta num ' + (d >= 0 ? 'pos' : 'neg'), text: (d >= 0 ? '+' : '−') + Math.abs(d) }),
      el('button', { class: 'btn ghost xs', type: 'button', text: openDetail === r.id ? 'Zu' : 'Runden', 'aria-expanded': String(openDetail === r.id),
        onclick: function () { openDetail = openDetail === r.id ? null : r.id; redraw(); } })));
  if (openDetail !== r.id) return row;
  /* Runde für Runde: Gewinn oder Verlust beider Spieler, bei Crash mit Absturzpunkt und Ausstieg */
  var game = r.game || 'crash', crash = game === 'crash', pts = (r.points || []).map(Number);
  var mine = Duel.nets(game, pts, r.setup, r.my_log), theirs = Duel.nets(game, pts, r.setup, r.their_log);
  var n = Math.max(mine.length, theirs.length), tb = el('tbody');
  for (var i = 0; i < n; i++) {
    tb.appendChild(el('tr', {}, el('td', { class: 'num', text: String(i + 1) }),
      crash ? el('td', { class: 'num', text: pts[i] ? V.fmtX(pts[i]) : '–' }) : null,
      cell(mine[i], crash && (r.my_log || [])[i]), cell(theirs[i], crash && (r.their_log || [])[i])));
  }
  return el('div', {}, row, el('div', { class: 'tscroll duel-detail' }, el('table', { class: 'stbl' },
    el('thead', {}, el('tr', {}, el('th', { text: game === 'bj' ? 'Hand' : '#' }), crash ? el('th', { text: 'Absturz' }) : null, el('th', { text: 'Du' }), el('th', { text: r.opponent || 'Gegner' }))), tb)));
}
function cell(net, e) {
  if (net == null) return el('td', { class: 'fine', text: '–' });
  var at = e && e.c && net > 0 ? ' @ ' + V.fmtX(Number(e.c)) : '';
  return el('td', { class: 'num ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : ''), text: (net > 0 ? '+' : net < 0 ? '−' : '±') + fmt(Math.abs(net)) + at });
}

function board(host) {
  var B = D.board, myName = (account() || {}).username;
  if (!B.length) { host.appendChild(el('p', { class: 'fine', text: 'Noch niemand hat ein Duell beendet. Sei der Erste.' })); return; }
  var ol = el('ol', { class: 'blist' });
  B.forEach(function (r, k) {
    ol.appendChild(el('li', { class: r.username === myName ? 'me' : '' },
      el('span', { class: 'rk', text: String(k + 1) }),
      el('span', { class: 'nm' }, nameBtn(r.username), el('small', { text: ' · ' + r.wins + ' S / ' + r.losses + ' N' + (r.draws ? ' / ' + r.draws + ' U' : '') })),
      el('span', { class: 'am', text: fmt(r.rating) })));
  });
  host.appendChild(ol);
  host.appendChild(el('p', { class: 'fine', text: 'Elo-Wertung: Jeder startet bei 1.000. Wer einen stärkeren Gegner schlägt, bekommt mehr Punkte.' }));
}

/* ---------- Profil-Fenster ---------- */
var profDlg = null;
function closeProfile() { if (profDlg) { profDlg.remove(); profDlg = null; } }
function panel(title, onClose) {
  var body = el('section', { class: 'side' });
  var d = el('div', { class: 'drawer prof-dlg', onclick: function (e) { if (e.target === e.currentTarget) onClose(); } },
    el('div', { class: 'drawer-panel prof-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('header', { class: 'drawer-h' }, el('h2', { text: title }), el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', text: '✕', onclick: onClose })),
      body));
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } });
  document.body.appendChild(d);
  return { dlg: d, body: body };
}
async function profile(name) {
  closeProfile();
  var p = panel('Spielerprofil', closeProfile);
  profDlg = p.dlg;
  p.dlg.querySelector('.icon-btn').focus();
  profileInto(p.body, name, function () { return profDlg === p.dlg; });
}
/* Profil in einen beliebigen Bereich laden; alive() sagt, ob der Bereich noch angezeigt wird */
async function profileInto(body, name, alive) {
  body.appendChild(el('p', { class: 'fine', text: 'Lade Profil …' }));
  var P;
  try { P = await Cloud.rpc('player_profile', { name: name }); }
  catch (e) { if (alive()) { body.innerHTML = ''; body.appendChild(el('p', { class: 'fine', text: e.message || String(e) })); } return; }
  if (alive()) fillProfile(body, P);
}
function fillProfile(body, P) {
  body.innerHTML = '';
  var a = account(), best = null;
  (P.saves || []).forEach(function (s) { if (s.mode !== 'sandbox' && (!best || (s.level || 0) > (best.level || 0))) best = s; });
  body.appendChild(el('div', { class: 'prof-head' },
    el('span', { class: 'avatar big', text: P.username.charAt(0) }),
    el('div', {}, el('b', { class: 'prof-name', text: P.username }),
      el('div', { class: 'fine', text: 'Dabei seit ' + new Date(P.joined).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) + (best && best.level ? ' · Level ' + best.level + ' · ' + tierName(best.unlocked) : '') }))));
  body.appendChild(el('div', { class: 'big-kv' },
    el('div', {}, el('span', { text: 'Duell-Wertung' }), el('b', { class: 'num', text: fmt(P.rating) })),
    el('div', {}, el('span', { text: 'Siege / Niederlagen' }), el('b', { class: 'num', text: P.wins + ' / ' + P.losses + (P.draws ? ' / ' + P.draws : '') })),
    !P.me && a && P.vs ? el('div', {}, el('span', { text: 'Deine Bilanz' }), el('b', { class: 'num', text: P.vs.wins + ' : ' + P.vs.losses })) : null));
  if (a && !P.me) {
    var row = el('div', { class: 'rrow' }, el('button', { class: 'btn gold', type: 'button', text: '⚔ Herausfordern', onclick: function () { challenge(P.username); } }));
    /* Nach der Aktion das Profil neu laden, damit der Knopf zum neuen Stand passt */
    var fAct = function (fn) { return function () { this.disabled = true; fn(P.username).then(function () { if (profDlg) profile(P.username); else { body.innerHTML = ''; profileInto(body, P.username, function () { return body.isConnected; }); } }); }; };
    if (!P.friend) row.appendChild(el('button', { class: 'btn ghost', type: 'button', text: '+ Freund hinzufügen', onclick: fAct(Friends.send) }));
    else if (P.friend === 'incoming') {
      row.appendChild(el('button', { class: 'btn ghost', type: 'button', text: 'Freundschaft annehmen', onclick: fAct(Friends.accept) }));
      row.appendChild(el('button', { class: 'btn ghost', type: 'button', text: 'Ablehnen', onclick: fAct(Friends.decline) }));
    } else if (P.friend === 'outgoing') {
      row.appendChild(el('span', { class: 'tag', text: 'Angefragt' }));
      row.appendChild(el('button', { class: 'btn ghost', type: 'button', text: 'Anfrage zurückziehen', onclick: fAct(Friends.withdraw) }));
    } else {
      row.appendChild(el('span', { class: 'tag good', text: 'Freund' }));
      row.appendChild(el('button', { class: 'btn ghost', type: 'button', text: 'Freund entfernen', onclick: function () {
        if (this.dataset.sure) { fAct(Friends.remove).call(this); return; }
        this.dataset.sure = '1'; this.textContent = 'Wirklich entfernen?'; this.classList.add('crimson');
      } }));
    }
    body.appendChild(row);
  }
  if ((P.saves || []).length) {
    body.appendChild(el('h4', { text: 'Spielstände' }));
    var MODES = { career: 'Karriere', empire: 'Imperium', sandbox: 'Sandbox' };
    P.saves.forEach(function (s) {
      body.appendChild(el('div', { class: 'duel-row' },
        el('span', { class: 'rank-em', text: V.RANK[s.mode === 'sandbox' ? 5 : Math.min(5, s.unlocked || 0)] }),
        el('div', { class: 'dr-info' }, el('b', {}, s.name + ' ', el('span', { class: 'tag', text: MODES[s.mode] || s.mode })),
          el('span', { class: 'fine', text: [s.mode === 'sandbox' ? '' : tierName(s.unlocked), s.level ? 'Level ' + s.level : '', s.biggest ? 'größter Gewinn ' + V.short(s.biggest) : '', '⏱ ' + V.clock(s.play_ms || 0)].filter(Boolean).join(' · ') })),
        el('b', { class: 'num prof-bal', text: V.short(s.balance) })));
    });
  }
}

/* Im Hintergrund nachsehen, ob jemand herausgefordert hat */
function poll() { if (account() && !document.hidden) load(true); }

return { render: render, profile: profile, profileInto: profileInto, badge: badge, count: count, invites: function () { return invites().length + unseenResults() + (Duel.pending() ? 1 : 0); },
  poll: poll, challenge: challenge,
  onChange: function (fn) { listeners.push(fn); } };
})();
V.social = Social;
