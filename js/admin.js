/* Chip Empire – Admin-Panel (wird nur für Admins nachgeladen, siehe menu.js)
   Übersicht, Spieler verwalten, Nachricht an alle, Protokoll.
   Nur Oberfläche: Jede Aktion prüft der Server (public.admins), ohne Admin-Eintrag lehnt die Datenbank ab. */
var Admin = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var MODES = { career: 'Karriere', empire: 'Imperium', sandbox: 'Sandbox' };
var GAMES = { crash: '🚀 Crash', tower: '🐉 Dragon Tower', bj: '🂡 Blackjack' };
var ACTIONS = { chips: 'Chips gesetzt', rename_save: 'Spielstand umbenannt', delete_save: 'Spielstand gelöscht', hide: 'Aus Ranglisten genommen',
  show: 'Wieder in Ranglisten', reset_rating: 'Wertung zurückgesetzt', ban: 'Gesperrt', unban: 'Entsperrt', tp: 'Talentpunkte',
  admin_on: 'Admin-Rechte gegeben', admin_off: 'Admin-Rechte entzogen', announce: 'Nachricht an alle', announce_clear: 'Nachricht entfernt' };
var view = 'overview', q = '', players = null, stats = null, log = null, ann = undefined, err = '', busy = false;
var timer = 0, seq = 0, confirm = null, rerender = null, renaming = null, banFor = null;

function when(t) { var d = new Date(t); return isNaN(d) ? '–' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function tierName(u) { return E.TIERS[Math.max(0, Math.min(5, u || 0))].name; }
/* Nicht neu zeichnen, solange in Suche oder Umbenennen getippt wird */
function redraw() { var a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest && a.closest('.ad-search, .ad-rename, .ad-ann')) return; if (rerender) rerender(); }

/* ---------- Daten ---------- */
async function load(what) {
  var s = ++seq;
  try {
    if (what === 'players') { var r = await Cloud.rpc('admin_players', { q: q, lim: 30 }); if (s === seq) players = r || []; }
    else if (what === 'overview') stats = await Cloud.rpc('admin_stats');
    else if (what === 'log') log = (await Cloud.rpc('admin_log_list', { lim: 80 })) || [];
    else if (what === 'announce') ann = ((await Cloud.rpc('announcement_current')) || [])[0] || null;
    err = '';
  } catch (e) { err = e.message || String(e); }
  redraw();
}
/* Aktion ausführen, Rückmeldung zeigen, betroffene Ansicht neu laden */
async function act(fn, ok) {
  if (busy) return;
  busy = true; confirm = null; banFor = null; redraw();
  try { await fn(); V.toast(ok, 'good'); }
  catch (e) { V.toast(e.message || String(e), 'bad'); }
  busy = false;
  log = null; stats = null;
  await load(view === 'announce' ? 'announce' : 'players');
}

/* ---------- Gerüst ---------- */
var TABS = [['overview', 'Übersicht'], ['players', 'Spieler'], ['announce', 'Nachricht'], ['log', 'Protokoll']];
function render(host, refresh) {
  rerender = refresh;
  var seg = el('div', { class: 'qseg', role: 'tablist' });
  TABS.forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === x[0]), text: x[1],
      onclick: function () { if (view === x[0]) return; view = x[0]; err = ''; V.Snd.click(); redraw(); } }));
  });
  host.appendChild(seg);
  if (err) host.appendChild(el('p', { class: 'menu-status err', text: '⚠ ' + err }));
  if (view === 'overview') overview(host);
  else if (view === 'announce') announce(host);
  else if (view === 'log') renderLog(host);
  else playerList(host);
}
function loading(host, what, have) {
  if (have) return false;
  host.appendChild(el('p', { class: 'fine', text: 'Lade …' }));
  if (!err) load(what);
  return true;
}

/* ---------- Übersicht ---------- */
function overview(host) {
  if (loading(host, 'overview', stats)) return;
  var S = stats, modes = S.modes || {};
  function tile(label, val, sub) { return el('div', { class: 'ad-tile' }, el('span', { text: label }), el('b', { class: 'num', text: val }), sub ? el('small', { text: sub }) : null); }
  host.appendChild(el('div', { class: 'ad-tiles' },
    tile('Spieler', fmt(S.players), '+' + fmt(S.new7) + ' in 7 Tagen'),
    tile('Gerade online', fmt(S.online), 'in den letzten 3 Minuten'),
    tile('Aktiv', fmt(S.active1) + ' / ' + fmt(S.active7), 'heute / 7 Tage'),
    tile('Spielstände', fmt(S.saves), [modes.career ? fmt(modes.career) + ' Karriere' : '', modes.empire ? fmt(modes.empire) + ' Imperium' : '', modes.sandbox ? fmt(modes.sandbox) + ' Sandbox' : ''].filter(Boolean).join(' · ')),
    tile('Chips im Umlauf', V.short(Number(S.chips) || 0), 'Karriere und Imperium'),
    tile('Duelle', fmt(S.duels), fmt(S.duels1) + ' heute · ' + fmt(S.open_duels) + ' offen'),
    tile('Freundschaften', fmt(S.friendships)),
    tile('Gesperrt / ausgeblendet', fmt(S.banned) + ' / ' + fmt(S.hidden), fmt(S.admins) + ' Admin' + (S.admins === 1 ? '' : 's'))));
  var two = el('div', { class: 'ad-two' });
  var duels = el('section', { class: 'ad-box' }, el('h4', { text: 'Letzte Duelle' }));
  if (!S.recent_duels.length) duels.appendChild(el('p', { class: 'fine', text: 'Noch keine.' }));
  S.recent_duels.forEach(function (d) {
    var aw = Number(d.as) > Number(d.bs), bw = Number(d.bs) > Number(d.as);
    duels.appendChild(el('div', { class: 'ad-line' },
      el('span', { class: 'fine', text: GAMES[d.game] || d.game }),
      el('span', {}, el('b', { class: aw ? 'pos' : '', text: d.a || '?' }), ' ' + fmt(d.as) + ' : ' + fmt(d.bs) + ' ', el('b', { class: bw ? 'pos' : '', text: d.b || '?' })),
      el('span', { class: 'fine', text: when(d.t) })));
  });
  var fresh = el('section', { class: 'ad-box' }, el('h4', { text: 'Neueste Spieler' }));
  S.recent_players.forEach(function (p) {
    fresh.appendChild(el('div', { class: 'ad-line' },
      el('button', { class: 'linkbtn', type: 'button', text: p.username, onclick: function () { q = p.username; players = null; view = 'players'; redraw(); } }),
      el('span', { class: 'fine', text: when(p.joined) })));
  });
  two.appendChild(duels); two.appendChild(fresh);
  host.appendChild(two);
  host.appendChild(el('div', { class: 'rrow' }, el('button', { class: 'btn ghost sm', type: 'button', text: '↻ Neu laden', onclick: function () { stats = null; redraw(); } })));
}

/* ---------- Spieler ---------- */
function playerList(host) {
  host.appendChild(searchBox());
  if (loading(host, 'players', players)) return;
  if (!players.length) { host.appendChild(el('p', { class: 'fine', text: q ? 'Niemand gefunden, dessen Name mit „' + q + '“ beginnt.' : 'Noch keine Spieler.' })); return; }
  host.appendChild(el('p', { class: 'fine ad-count', text: players.length + (q ? ' Treffer' : ' zuletzt aktive Spieler') }));
  players.forEach(function (p) { host.appendChild(playerCard(p)); });
}
function searchBox() {
  var input = el('input', { class: 'name-in sm', type: 'search', placeholder: 'Spieler suchen (Namensanfang) …', 'aria-label': 'Spieler suchen', value: q, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  input.addEventListener('input', function () {
    q = input.value.trim().toLowerCase();
    clearTimeout(timer);
    timer = setTimeout(function () { players = null; load('players'); }, 300);
  });
  return el('div', { class: 'ad-search' }, input,
    el('button', { class: 'btn ghost sm', type: 'button', text: '↻ Neu laden', onclick: function () { players = null; redraw(); } }));
}
/* Zweistufiger Knopf für Aktionen, die man nicht aus Versehen auslösen soll */
function sure(key, label, sureLabel, run) {
  var armed = confirm === key;
  return el('button', { class: 'btn sm ' + (armed ? 'crimson' : 'ghost'), type: 'button', disabled: busy, text: armed ? sureLabel : label,
    onclick: function () { if (armed) run(); else { confirm = key; redraw(); } } });
}
function rpcAct(name, args, ok) { act(function () { return Cloud.rpc(name, args); }, ok); }

function playerCard(p) {
  var name = p.username, banned = !!p.banned_until;
  var head = el('div', { class: 'ad-head' },
    el('span', { class: 'avatar', text: name.charAt(0) }),
    el('div', { class: 'dr-info' },
      el('b', {}, el('button', { class: 'linkbtn', type: 'button', text: name, onclick: function () { Social.profile(name); } }),
        p.me ? el('span', { class: 'tag', text: 'Du' }) : null,
        p.admin ? el('span', { class: 'tag gold', text: 'Admin' }) : null,
        banned ? el('span', { class: 'tag bad', text: 'Gesperrt bis ' + when(p.banned_until) }) : null,
        p.hidden ? el('span', { class: 'tag warn', text: 'Ausgeblendet' }) : null,
        Store.badName(name) ? el('span', { class: 'tag bad', text: 'Name unzulässig' }) : null),
      el('span', { class: 'fine', text: 'Dabei seit ' + when(p.joined) + ' · zuletzt aktiv ' + (p.last ? when(p.last) : '–') + ' · Wertung ' + fmt(p.rating) + ' (' + p.wins + ' S / ' + p.losses + ' N) · ' + p.friends + ' Freunde' })));
  var acts = el('div', { class: 'rrow ad-acts' },
    el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: p.hidden ? 'Wieder in Ranglisten' : 'Aus Ranglisten nehmen',
      onclick: function () { rpcAct('admin_set_hidden', { name: name, hide: !p.hidden }, p.hidden ? name + ' steht wieder in den Ranglisten.' : name + ' ist aus den Ranglisten genommen.'); } }),
    p.wins + p.losses + p.draws > 0 || p.rating !== 1000
      ? sure('rating:' + name, 'Wertung zurücksetzen', 'Wirklich auf 1.000?', function () { rpcAct('admin_reset_rating', { name: name }, 'Wertung von ' + name + ' zurückgesetzt.'); })
      : null,
    p.me ? null : banned
      ? el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Entsperren', onclick: function () { rpcAct('admin_unban', { name: name }, name + ' ist entsperrt.'); } })
      : el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Sperren …', 'aria-expanded': String(banFor === name), onclick: function () { banFor = banFor === name ? null : name; confirm = null; redraw(); } }),
    p.me ? null : p.admin
      ? sure('admin:' + name, 'Admin entziehen', 'Wirklich entziehen?', function () { rpcAct('admin_set_admin', { name: name, make: false }, name + ' ist kein Admin mehr.'); })
      : sure('admin:' + name, 'Zum Admin machen', 'Wirklich Admin-Rechte geben?', function () { rpcAct('admin_set_admin', { name: name, make: true }, name + ' ist jetzt Admin.'); }));
  var card = el('article', { class: 'ad-card' + (p.hidden ? ' hidden-p' : '') + (banned ? ' banned-p' : '') }, head, acts);
  if (banFor === name) {
    var ban = function (days, label) { rpcAct('admin_ban', { name: name, days: days }, name + ' ist ' + label + ' gesperrt.'); };
    card.appendChild(el('div', { class: 'ad-ban' },
      el('span', { class: 'fine', text: 'Gesperrte Spieler können sich nicht mehr einloggen und verschwinden aus den Ranglisten. Wer gerade spielt, fliegt spätestens nach einer Stunde raus.' }),
      el('div', { class: 'rrow' },
        el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: '1 Tag', onclick: function () { ban(1, 'für 1 Tag'); } }),
        el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: '7 Tage', onclick: function () { ban(7, 'für 7 Tage'); } }),
        el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: '30 Tage', onclick: function () { ban(30, 'für 30 Tage'); } }),
        el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: 'Dauerhaft', onclick: function () { ban(null, 'dauerhaft'); } }),
        el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { banFor = null; redraw(); } }))));
  }
  var saves = el('div', { class: 'ad-saves' });
  if (!p.saves.length) saves.appendChild(el('p', { class: 'fine', text: 'Keine Online-Spielstände.' }));
  p.saves.forEach(function (s) { saves.appendChild(saveRow(p, s)); });
  card.appendChild(saves);
  return card;
}

function saveRow(p, s) {
  /* Umbenennen: Feld statt Name, Enter speichert, Esc bricht ab */
  if (renaming === s.id) {
    var nameIn = el('input', { class: 'name-in sm', type: 'text', maxlength: '20', value: s.name, 'aria-label': 'Neuer Name für ' + s.name, autocomplete: 'off' });
    var save = function () {
      var nn = nameIn.value.trim().replace(/\s+/g, ' ');
      if (!nn) { nameIn.focus(); return; }
      if (Store.badName(nn)) { V.toast('Dieser Name ist nicht erlaubt.', 'bad'); nameIn.focus(); return; }
      renaming = null; nameIn.blur();
      rpcAct('admin_rename_save', { sid: s.id, new_name: nn }, '„' + s.name + '“ heißt jetzt „' + nn + '“.');
    };
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); renaming = null; nameIn.blur(); redraw(); } });
    setTimeout(function () { nameIn.focus(); nameIn.select(); }, 0);
    return el('div', { class: 'ad-save' },
      el('div', { class: 'ad-rename' }, nameIn),
      el('div', { class: 'ad-set' },
        el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Speichern', onclick: save }),
        el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { renaming = null; redraw(); } })));
  }
  var input = el('input', { class: 'name-in sm ad-amt', type: 'number', min: '0', step: '1', inputmode: 'numeric', value: String(Math.round(s.chips || 0)), 'aria-label': 'Neue Chips für ' + s.name });
  function setTo(v) {
    v = Math.round(Number(v));
    if (!isFinite(v) || v < 0) { V.toast('Bitte eine Zahl ab 0 eingeben.', 'bad'); return; }
    rpcAct('admin_set_chips', { sid: s.id, amount: v }, s.name + ' von ' + p.username + ': jetzt ' + fmt(v) + ' Chips.');
  }
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') setTo(input.value); });
  function tp(n) { rpcAct('admin_add_tp', { sid: s.id, n: n }, s.name + ': ' + (n > 0 ? '+' : '') + n + ' Talentpunkt' + (Math.abs(n) === 1 ? '' : 'e') + '.'); }
  var meta = [MODES[s.mode] || s.mode, s.mode === 'sandbox' ? '' : tierName(s.unlocked), s.level ? 'Level ' + s.level : '', s.tp ? s.tp + ' Bonus-Talentpunkte' : '',
    'Umsatz ' + V.short(s.wagered || 0), '⏱ ' + V.clock(s.play_ms || 0), 'gespeichert ' + when(s.updated_at)].filter(Boolean).join(' · ');
  return el('div', { class: 'ad-save' },
    el('div', { class: 'dr-info' }, el('b', {}, s.name + ' ', Store.badName(s.name) ? el('span', { class: 'tag bad', text: 'Name unzulässig' }) : null,
      el('span', { class: 'num ad-chips', text: fmt(s.chips || 0) + ' Chips' })), el('span', { class: 'fine', text: meta })),
    el('div', { class: 'ad-set' },
      input,
      el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Setzen', onclick: function () { setTo(input.value); } }),
      el('span', { class: 'ad-tp', title: 'Bonus-Talentpunkte' },
        el('button', { class: 'btn ghost sm', type: 'button', disabled: busy || !s.tp, text: '−', 'aria-label': 'Einen Talentpunkt abziehen', onclick: function () { tp(-1); } }),
        el('span', { class: 'fine', text: 'TP' }),
        el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: '+', 'aria-label': 'Einen Talentpunkt schenken', onclick: function () { tp(1); } })),
      el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Umbenennen', onclick: function () { renaming = s.id; confirm = null; redraw(); } }),
      sure('del:' + s.id, 'Löschen', 'Wirklich löschen?', function () { rpcAct('admin_delete_save', { sid: s.id }, 'Spielstand „' + s.name + '“ von ' + p.username + ' gelöscht.'); })));
}

/* ---------- Nachricht an alle ---------- */
function announce(host) {
  if (ann === undefined) { host.appendChild(el('p', { class: 'fine', text: 'Lade …' })); if (!err) load('announce'); return; }
  var box = el('section', { class: 'ad-box ad-ann' }, el('h4', { text: 'Nachricht an alle Spieler' }),
    el('p', { class: 'fine', text: 'Erscheint oben im Hauptmenü und einmal beim Spielstart. Eine neue Nachricht ersetzt die alte. Bis zu 300 Zeichen.' }));
  var ta = el('textarea', { class: 'name-in ad-ta', maxlength: '300', rows: '3', placeholder: 'z. B. Neues Spiel: Würfel-Duelle sind da!', 'aria-label': 'Nachricht' });
  var cnt = el('span', { class: 'fine', text: '0 / 300' });
  ta.addEventListener('input', function () { cnt.textContent = ta.value.length + ' / 300'; });
  box.appendChild(ta);
  box.appendChild(el('div', { class: 'rrow' }, cnt,
    el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Veröffentlichen', onclick: function () {
      var m = ta.value.trim(); if (!m) { ta.focus(); return; }
      ta.blur(); ann = undefined;
      act(function () { return Cloud.rpc('admin_announce', { msg: m }); }, 'Nachricht veröffentlicht.');
    } })));
  host.appendChild(box);
  var cur = el('section', { class: 'ad-box' }, el('h4', { text: 'Aktuell sichtbar' }));
  if (!ann) cur.appendChild(el('p', { class: 'fine', text: 'Keine Nachricht aktiv.' }));
  else {
    cur.appendChild(el('div', { class: 'announce' }, el('span', { class: 'an-ico', text: '📣' }), el('span', { text: ann.text })));
    cur.appendChild(el('div', { class: 'rrow' }, el('span', { class: 'fine', text: 'Seit ' + when(ann.created_at) }),
      sure('ann-clear', 'Entfernen', 'Wirklich entfernen?', function () { ann = undefined; act(function () { return Cloud.rpc('admin_clear_announcement'); }, 'Nachricht entfernt.'); })));
  }
  host.appendChild(cur);
}

/* ---------- Protokoll ---------- */
function renderLog(host) {
  if (loading(host, 'log', log)) return;
  if (!log.length) { host.appendChild(el('p', { class: 'fine', text: 'Noch keine Admin-Aktionen.' })); return; }
  var tb = el('tbody');
  log.forEach(function (l) {
    tb.appendChild(el('tr', {}, el('td', { class: 'num', text: when(l.created_at) }), el('td', { text: l.admin_name || '–' }),
      el('td', { text: ACTIONS[l.action] || l.action }), el('td', { text: l.target || '' }), el('td', { class: 'fine', text: l.detail || '' })));
  });
  host.appendChild(el('div', { class: 'tscroll' }, el('table', { class: 'stbl ad-log' },
    el('thead', {}, el('tr', {}, el('th', { text: 'Zeit' }), el('th', { text: 'Admin' }), el('th', { text: 'Aktion' }), el('th', { text: 'Spieler' }), el('th', { text: 'Details' }))), tb)));
}

return { render: render };
})();
