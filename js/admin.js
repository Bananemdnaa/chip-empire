/* Chip Empire – Admin-Panel (wird nur für Admins nachgeladen, siehe menu.js)
   Rollen: Owner darf alles, Admins bearbeiten normale Spieler und sich selbst. Nur der Owner ernennt Admins.
   Nur Oberfläche: Jede Aktion und jede Rolle prüft der Server, ohne Admin-Eintrag lehnt die Datenbank ab. */
var Admin = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var MODES = { career: 'Karriere', empire: 'Imperium', sandbox: 'Sandbox' };
var GAMES = { crash: '🚀 Crash', tower: '🐉 Dragon Tower', bj: '🂡 Blackjack' };
var STATUS = { a_playing: 'läuft', open: 'wartet', b_playing: 'läuft', done: 'fertig', declined: 'abgelehnt', expired: 'verfallen', void: 'annulliert' };
var ROLES = { owner: 'Owner', admin: 'Admin' };
var ACTIONS = { chips: 'Chips gesetzt', rename_save: 'Spielstand umbenannt', delete_save: 'Spielstand gelöscht', hide: 'Aus Ranglisten genommen',
  show: 'Wieder in Ranglisten', reset_rating: 'Wertung zurückgesetzt', ban: 'Gesperrt', unban: 'Entsperrt', tp: 'Talentpunkte',
  admin_on: 'Admin-Rechte gegeben', admin_off: 'Admin-Rechte entzogen', announce: 'Nachricht an alle', announce_clear: 'Nachricht entfernt',
  note: 'Notiz', void_duel: 'Duell annulliert', gift: 'Geschenk erstellt', gift_stop: 'Geschenk beendet',
  rename_user: 'Spieler umbenannt', stars: 'Legenden-Sterne gesetzt', gift_player: 'Geschenk an Spieler' };
var role = null, view = 'overview', q = '', dq = '', players = null, stats = null, online = null, log = null, duels = null, gifts = null, ann = undefined, err = '', busy = false;
var timer = 0, seq = 0, confirm = null, rerender = null, renaming = null, banFor = null, noteFor = null, userRename = null, giftFor = null, liveTimer = 0;

function when(t) { var d = new Date(t); return !t || isNaN(d) ? '–' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function tierName(u) { return E.TIERS[Math.max(0, Math.min(5, u || 0))].name; }
function owner() { return role === 'owner'; }
/* Admins dürfen normale Spieler und sich selbst bearbeiten, der Owner alle (der Server prüft das genauso) */
function canEdit(p) { return owner() || !p.role || p.me; }
/* Nicht neu zeichnen, solange in einem Eingabefeld des Panels getippt wird */
function redraw() { var a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.closest && a.closest('.ad-keep')) return; if (rerender) rerender(); }

/* ---------- Daten ---------- */
async function load(what) {
  var s = ++seq;
  try {
    if (role === null) role = (await Cloud.rpc('my_role')) || 'admin';
    if (what === 'players') { var r = await Cloud.rpc('admin_players', { q: q, lim: 30 }); if (s === seq) players = r || []; }
    else if (what === 'overview') {
      stats = await Cloud.rpc('admin_stats');
      /* Liste der Online-Spieler: ohne Datenbank-Update einfach weglassen */
      try { online = (await Cloud.rpc('admin_online')) || []; } catch (e) { online = null; }
    }
    else if (what === 'log') log = (await Cloud.rpc('admin_log_list', { lim: 80 })) || [];
    else if (what === 'duels') { var d = await Cloud.rpc('admin_duels', { q: dq, lim: 40 }); if (s === seq) duels = d || []; }
    else if (what === 'gifts') gifts = (await Cloud.rpc('admin_gifts')) || [];
    else if (what === 'announce') ann = ((await Cloud.rpc('announcement_current')) || [])[0] || null;
    err = '';
  } catch (e) { err = e.message || String(e); }
  redraw();
}
/* Aktion ausführen, Rückmeldung zeigen, die offene Ansicht neu laden */
async function act(fn, ok) {
  if (busy) return;
  busy = true; confirm = null; banFor = null; noteFor = null; redraw();
  try { await fn(); V.toast(ok, 'good'); }
  catch (e) { V.toast(e.message || String(e), 'bad'); }
  busy = false;
  log = null; stats = null;
  await load(view);
}
function rpcAct(name, args, ok) { act(function () { return Cloud.rpc(name, args); }, ok); }
/* Zweistufiger Knopf für Aktionen, die man nicht aus Versehen auslösen soll */
function sure(key, label, sureLabel, run) {
  var armed = confirm === key;
  return el('button', { class: 'btn sm ' + (armed ? 'crimson' : 'ghost'), type: 'button', disabled: busy, text: armed ? sureLabel : label,
    onclick: function () { if (armed) run(); else { confirm = key; redraw(); } } });
}
function roleTag(r) { return r ? el('span', { class: 'tag ' + (r === 'owner' ? 'owner' : 'gold'), text: ROLES[r] }) : null; }

/* ---------- Gerüst ---------- */
var TABS = [['overview', 'Übersicht'], ['players', 'Spieler'], ['duels', 'Duelle'], ['gifts', 'Geschenke'], ['announce', 'Nachricht'], ['log', 'Protokoll']];
function render(host, refresh) {
  rerender = refresh;
  var seg = el('div', { class: 'qseg', role: 'tablist' });
  TABS.forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === x[0]), text: x[1],
      onclick: function () { if (view === x[0]) return; view = x[0]; err = ''; confirm = null; V.Snd.click(); redraw(); } }));
  });
  host.appendChild(el('div', { class: 'ad-top' }, seg, role ? el('span', { class: 'fine' }, 'Deine Rolle: ', roleTag(role)) : null));
  if (err) host.appendChild(el('p', { class: 'menu-status err', text: '⚠ ' + err }));
  ({ overview: overview, players: playerList, duels: duelList, gifts: giftView, announce: announce, log: renderLog })[view](host);
}
function loading(host, what, have) {
  if (have) return false;
  host.appendChild(el('p', { class: 'fine', text: 'Lade …' }));
  if (!err) load(what);
  return true;
}

/* ---------- Übersicht ---------- */
/* Online-Liste aktualisiert sich alle 30 Sekunden, solange die Übersicht offen ist */
function live() {
  clearInterval(liveTimer);
  liveTimer = setInterval(function () {
    var a = document.querySelector('.ad-online');
    if (!a || !a.isConnected || view !== 'overview') { clearInterval(liveTimer); return; }
    if (document.hidden || busy) return;
    Cloud.rpc('admin_online').then(function (o) { online = o || []; redraw(); }).catch(function () { /* nächster Versuch */ });
  }, 30000);
}
function overview(host) {
  if (loading(host, 'overview', stats)) return;
  live();
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
    tile('Gesperrt / ausgeblendet', fmt(S.banned) + ' / ' + fmt(S.hidden))));
  /* Wer gerade spielt: Name, Spielstand, Spiel, Kontostand */
  if (online) {
    var on = el('section', { class: 'ad-box ad-online' }, el('h4', {}, 'Gerade online (' + online.length + ') ', el('small', { class: 'fine', text: '· aktualisiert sich alle 30 s' })));
    if (!online.length) on.appendChild(el('p', { class: 'fine', text: 'Gerade spielt niemand.' }));
    online.forEach(function (o) {
      var secs = Math.max(0, Math.round((Date.now() - Date.parse(o.seen)) / 1000));
      on.appendChild(el('div', { class: 'ad-line' },
        el('span', {}, el('i', { class: 'ad-dot' }), ' ',
          el('button', { class: 'linkbtn', type: 'button', text: (o.stars > 0 ? V.legend.tag(o.stars) + ' ' : '') + o.username, onclick: function () { q = o.username; players = null; view = 'players'; redraw(); } })),
        el('span', { class: 'fine', text: o.save_name + ' · ' + (MODES[o.mode] || o.mode) + (o.mode === 'sandbox' ? '' : ' · ' + tierName(o.unlocked)) + (o.game && V.GAME_NAME[o.game] ? ' · ' + V.GAME_NAME[o.game] : '') }),
        el('span', { class: 'fine num', text: fmt(o.balance) + ' · vor ' + (secs < 60 ? secs + ' s' : Math.round(secs / 60) + ' min') })));
    });
    host.appendChild(on);
  }
  var two = el('div', { class: 'ad-two' });
  var team = el('section', { class: 'ad-box' }, el('h4', { text: 'Team' }));
  (S.team || []).forEach(function (t) {
    team.appendChild(el('div', { class: 'ad-line' }, el('span', {}, el('b', { text: t.username }), ' ', roleTag(t.role)), el('span', { class: 'fine', text: 'seit ' + when(t.since) })));
  });
  team.appendChild(el('p', { class: 'fine ad-hint', text: owner() ? 'Admins ernennst du im Reiter „Spieler“.' : 'Admins ernennt nur der Owner.' }));
  var fresh = el('section', { class: 'ad-box' }, el('h4', { text: 'Neueste Spieler' }));
  S.recent_players.forEach(function (p) {
    fresh.appendChild(el('div', { class: 'ad-line' },
      el('button', { class: 'linkbtn', type: 'button', text: p.username, onclick: function () { q = p.username; players = null; view = 'players'; redraw(); } }),
      el('span', { class: 'fine', text: when(p.joined) })));
  });
  two.appendChild(team); two.appendChild(fresh);
  host.appendChild(two);
  var rd = el('section', { class: 'ad-box' }, el('h4', { text: 'Letzte Duelle' }));
  if (!S.recent_duels.length) rd.appendChild(el('p', { class: 'fine', text: 'Noch keine.' }));
  S.recent_duels.forEach(function (d) { rd.appendChild(duelLine(d)); });
  host.appendChild(rd);
  host.appendChild(el('div', { class: 'rrow' }, el('button', { class: 'btn ghost sm', type: 'button', text: '↻ Neu laden', onclick: function () { stats = null; online = null; redraw(); } })));
}
function duelLine(d) {
  var aw = Number(d.as) > Number(d.bs), bw = Number(d.bs) > Number(d.as);
  return el('div', { class: 'ad-line' },
    el('span', { class: 'fine', text: GAMES[d.game] || d.game }),
    el('span', {}, el('b', { class: aw ? 'pos' : '', text: d.a || '?' }), ' ' + (d.as == null ? '–' : fmt(d.as)) + ' : ' + (d.bs == null ? '–' : fmt(d.bs)) + ' ', el('b', { class: bw ? 'pos' : '', text: d.b || 'offen' })),
    el('span', { class: 'fine', text: when(d.t || d.finished_at || d.created_at) }));
}

/* ---------- Spieler ---------- */
function playerList(host) {
  host.appendChild(searchBox(q, 'Spieler suchen (Namensanfang) …', function (v) { q = v; players = null; load('players'); }, function () { players = null; redraw(); }));
  if (loading(host, 'players', players)) return;
  if (!players.length) { host.appendChild(el('p', { class: 'fine', text: q ? 'Niemand gefunden, dessen Name mit „' + q + '“ beginnt.' : 'Noch keine Spieler.' })); return; }
  host.appendChild(el('p', { class: 'fine ad-count', text: players.length + (q ? ' Treffer' : ' zuletzt aktive Spieler') }));
  players.forEach(function (p) { host.appendChild(playerCard(p)); });
}
function searchBox(val, ph, onSearch, onReload) {
  var input = el('input', { class: 'name-in sm', type: 'search', placeholder: ph, 'aria-label': ph, value: val, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  input.addEventListener('input', function () {
    var v = input.value.trim().toLowerCase();
    clearTimeout(timer);
    timer = setTimeout(function () { onSearch(v); }, 300);
  });
  return el('div', { class: 'ad-search ad-keep' }, input, el('button', { class: 'btn ghost sm', type: 'button', text: '↻ Neu laden', onclick: onReload }));
}

function playerCard(p) {
  var name = p.username, banned = !!p.banned_until, edit = canEdit(p);
  var head = el('div', { class: 'ad-head' },
    el('span', { class: 'avatar', text: name.charAt(0) }),
    el('div', { class: 'dr-info' },
      el('b', {}, el('button', { class: 'linkbtn', type: 'button', text: name, onclick: function () { Social.profile(name); } }),
        p.me ? el('span', { class: 'tag', text: 'Du' }) : null,
        roleTag(p.role),
        banned ? el('span', { class: 'tag bad', text: 'Gesperrt bis ' + when(p.banned_until) }) : null,
        p.hidden ? el('span', { class: 'tag warn', text: 'Ausgeblendet' }) : null,
        Store.badName(name) ? el('span', { class: 'tag bad', text: 'Name unzulässig' }) : null),
      el('span', { class: 'fine', text: 'Dabei seit ' + when(p.joined) + ' · zuletzt aktiv ' + when(p.last) + ' · Wertung ' + fmt(p.rating) + ' (' + p.wins + ' S / ' + p.losses + ' N) · ' + p.friends + ' Freunde' }),
      banned && p.ban_reason ? el('span', { class: 'fine ad-reason', text: 'Grund: ' + p.ban_reason }) : null));
  var card = el('article', { class: 'ad-card' + (p.hidden ? ' hidden-p' : '') + (banned ? ' banned-p' : '') }, head);
  if (!edit) card.appendChild(el('p', { class: 'fine ad-locked', text: '🔒 ' + (p.role === 'owner' ? 'Den Owner' : 'Admins') + ' kann nur der Owner bearbeiten.' }));
  else {
    card.appendChild(el('div', { class: 'rrow ad-acts' },
      el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: p.hidden ? 'Wieder in Ranglisten' : 'Aus Ranglisten nehmen',
        onclick: function () { rpcAct('admin_set_hidden', { name: name, hide: !p.hidden }, p.hidden ? name + ' steht wieder in den Ranglisten.' : name + ' ist aus den Ranglisten genommen.'); } }),
      p.wins + p.losses + p.draws > 0 || p.rating !== 1000
        ? sure('rating:' + name, 'Wertung zurücksetzen', 'Wirklich auf 1.000?', function () { rpcAct('admin_reset_rating', { name: name }, 'Wertung von ' + name + ' zurückgesetzt.'); })
        : null,
      p.me || p.role === 'owner' ? null : banned
        ? el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Entsperren', onclick: function () { rpcAct('admin_unban', { name: name }, name + ' ist entsperrt.'); } })
        : el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Sperren …', 'aria-expanded': String(banFor === name), onclick: function () { banFor = banFor === name ? null : name; confirm = null; redraw(); } }),
      el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: p.note ? 'Notiz bearbeiten' : 'Notiz', onclick: function () { noteFor = noteFor === name ? null : name; redraw(); } }),
      el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: '🎁 Geschenk', 'aria-expanded': String(giftFor === name), onclick: function () { giftFor = giftFor === name ? null : name; userRename = null; redraw(); } }),
      el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Namen ändern', 'aria-expanded': String(userRename === name), onclick: function () { userRename = userRename === name ? null : name; giftFor = null; redraw(); } }),
      /* Admin-Rechte vergibt und entzieht nur der Owner */
      owner() && !p.me && p.role !== 'owner'
        ? (p.role
          ? sure('admin:' + name, 'Admin entziehen', 'Wirklich entziehen?', function () { rpcAct('admin_set_admin', { name: name, make: false }, name + ' ist kein Admin mehr.'); })
          : sure('admin:' + name, 'Zum Admin machen', 'Wirklich Admin-Rechte geben?', function () { rpcAct('admin_set_admin', { name: name, make: true }, name + ' ist jetzt Admin.'); }))
        : null));
    if (banFor === name) card.appendChild(banBox(name));
    if (giftFor === name) card.appendChild(giftBox(name));
    if (userRename === name) card.appendChild(userRenameBox(p));
  }
  if (noteFor === name) card.appendChild(noteBox(p));
  else if (p.note) card.appendChild(el('div', { class: 'ad-note' }, el('span', { class: 'fine', text: '📝 ' + (p.note_by ? p.note_by + ': ' : '') }), el('span', { text: p.note })));
  var saves = el('div', { class: 'ad-saves' });
  if (!p.saves.length) saves.appendChild(el('p', { class: 'fine', text: 'Keine Online-Spielstände.' }));
  p.saves.forEach(function (s) { saves.appendChild(saveRow(p, s, edit)); });
  card.appendChild(saves);
  return card;
}
function banBox(name) {
  var reason = el('input', { class: 'name-in sm', type: 'text', maxlength: '200', placeholder: 'Grund (optional, nur im Admin-Panel sichtbar)', 'aria-label': 'Grund der Sperre', autocomplete: 'off' });
  function ban(days, label) { var r = reason.value.trim(); rpcAct('admin_ban', { name: name, days: days, reason: r || null }, name + ' ist ' + label + ' gesperrt.'); }
  return el('div', { class: 'ad-ban ad-keep' },
    el('span', { class: 'fine', text: 'Gesperrte Spieler können sich nicht mehr einloggen und verschwinden aus den Ranglisten. Wer gerade spielt, fliegt spätestens nach einer Stunde raus.' }),
    reason,
    el('div', { class: 'rrow' },
      el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: '1 Tag', onclick: function () { ban(1, 'für 1 Tag'); } }),
      el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: '7 Tage', onclick: function () { ban(7, 'für 7 Tage'); } }),
      el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: '30 Tage', onclick: function () { ban(30, 'für 30 Tage'); } }),
      el('button', { class: 'btn crimson sm', type: 'button', disabled: busy, text: 'Dauerhaft', onclick: function () { ban(null, 'dauerhaft'); } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { banFor = null; redraw(); } })));
}
/* Geschenk nur für diesen Spieler: kommt beim nächsten Spielstart an (30 Tage gültig) */
function giftBox(name) {
  var chips = el('input', { class: 'name-in sm', type: 'number', min: '0', step: '1', value: '10000', inputmode: 'numeric', 'aria-label': 'Chips' });
  var tp = el('input', { class: 'name-in sm', type: 'number', min: '0', max: '10', step: '1', value: '0', inputmode: 'numeric', 'aria-label': 'Talentpunkte' });
  var msg = el('input', { class: 'name-in sm', type: 'text', maxlength: '200', placeholder: 'Nachricht (optional)', 'aria-label': 'Nachricht' });
  function send() {
    var c = Math.round(Number(chips.value) || 0), t = Math.round(Number(tp.value) || 0);
    if (c <= 0 && t <= 0) { V.toast('Ein Geschenk braucht Chips oder Talentpunkte.', 'bad'); return; }
    if (document.activeElement) document.activeElement.blur();
    giftFor = null;
    rpcAct('admin_gift_player', { name: name, chips: c, tp: t, msg: msg.value.trim() || null }, 'Geschenk für ' + name + ' liegt bereit. Es kommt beim nächsten Spielstart an.');
  }
  function field(label, input) { return el('label', { class: 'ad-field' }, el('span', { text: label }), input); }
  return el('div', { class: 'ad-ban ad-keep ad-plain' },
    el('span', { class: 'fine', text: 'Nur für ' + name + ': landet im nächsten Karriere- oder Imperium-Spielstand, den ' + name + ' startet (30 Tage gültig).' }),
    el('div', { class: 'ad-form' }, field('Chips', chips), field('Talentpunkte (0–10)', tp), field('Nachricht', msg)),
    el('div', { class: 'rrow' },
      el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: '🎁 Verschicken', onclick: send }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { giftFor = null; redraw(); } })));
}
/* Benutzernamen ändern, z. B. bei einem unpassenden Namen. Der Spieler loggt sich danach mit dem neuen Namen ein. */
function userRenameBox(p) {
  var inp = el('input', { class: 'name-in sm', type: 'text', maxlength: '16', value: p.username, 'aria-label': 'Neuer Benutzername', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  function save() {
    var nn = inp.value.trim().toLowerCase();
    if (!Cloud.NAME_RE.test(nn)) { V.toast('3 bis 16 Zeichen, nur a–z, 0–9, _ und -.', 'bad'); inp.focus(); return; }
    if (nn === p.username) { userRename = null; redraw(); return; }
    inp.blur(); userRename = null;
    if (q === p.username) { q = nn; players = null; }
    rpcAct('admin_rename_user', { name: p.username, new_name: nn }, p.username + ' heißt jetzt ' + nn + '.');
  }
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); userRename = null; inp.blur(); redraw(); } });
  setTimeout(function () { inp.focus(); inp.select(); }, 0);
  return el('div', { class: 'ad-ban ad-keep ad-plain' },
    el('span', { class: 'fine', text: 'Der Spieler loggt sich danach mit dem neuen Namen ein, das Passwort bleibt gleich. Sag am besten Bescheid.' + (p.renamed ? ' Zuletzt geändert: ' + when(p.renamed) + '.' : '') }),
    inp,
    el('div', { class: 'rrow' },
      el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Umbenennen', onclick: save }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { userRename = null; redraw(); } })));
}
function noteBox(p) {
  var ta = el('textarea', { class: 'name-in ad-ta', maxlength: '500', rows: '2', placeholder: 'Private Notiz, nur für Admins sichtbar', 'aria-label': 'Notiz zu ' + p.username });
  ta.value = p.note || '';
  setTimeout(function () { ta.focus(); }, 0);
  function save() { ta.blur(); rpcAct('admin_set_note', { name: p.username, txt: ta.value }, 'Notiz gespeichert.'); }
  ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); if (e.key === 'Escape') { e.stopPropagation(); noteFor = null; ta.blur(); redraw(); } });
  return el('div', { class: 'ad-notebox ad-keep' }, ta,
    el('div', { class: 'rrow' },
      el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Speichern', onclick: save }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { noteFor = null; redraw(); } }),
      el('span', { class: 'fine', text: 'Strg + Enter speichert' })));
}

function saveRow(p, s, edit) {
  var meta = [MODES[s.mode] || s.mode, s.mode === 'sandbox' ? '' : tierName(s.unlocked), s.stars ? V.legend.tag(s.stars) + ' ' + V.legend.rankOf(s.stars).name : '', s.level ? 'Level ' + s.level : '', s.tp ? s.tp + ' Bonus-Talentpunkte' : '',
    'Umsatz ' + V.short(s.wagered || 0), '⏱ ' + V.clock(s.play_ms || 0), 'gespeichert ' + when(s.updated_at)].filter(Boolean).join(' · ');
  var info = el('div', { class: 'dr-info' }, el('b', {}, s.name + ' ', Store.badName(s.name) ? el('span', { class: 'tag bad', text: 'Name unzulässig' }) : null,
    el('span', { class: 'num ad-chips', text: fmt(s.chips || 0) + ' Chips' })), el('span', { class: 'fine', text: meta }));
  if (!edit) return el('div', { class: 'ad-save' }, info);
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
      el('div', { class: 'ad-rename ad-keep' }, nameIn),
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
  function stars(n) { rpcAct('admin_set_stars', { sid: s.id, n: n }, s.name + ': jetzt ' + n + ' Legenden-Stern' + (n === 1 ? '' : 'e') + '.'); }
  function tp(n) { rpcAct('admin_add_tp', { sid: s.id, n: n }, s.name + ': ' + (n > 0 ? '+' : '') + n + ' Talentpunkt' + (Math.abs(n) === 1 ? '' : 'e') + '.'); }
  return el('div', { class: 'ad-save' }, info,
    el('div', { class: 'ad-set' },
      input,
      el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Setzen', onclick: function () { setTo(input.value); } }),
      el('span', { class: 'ad-tp', title: 'Bonus-Talentpunkte' },
        el('button', { class: 'btn ghost sm', type: 'button', disabled: busy || !s.tp, text: '−', 'aria-label': 'Einen Talentpunkt abziehen', onclick: function () { tp(-1); } }),
        el('span', { class: 'fine', text: 'TP' }),
        el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: '+', 'aria-label': 'Einen Talentpunkt schenken', onclick: function () { tp(1); } })),
      s.mode === 'career' ? el('span', { class: 'ad-tp', title: 'Legenden-Sterne' },
        el('button', { class: 'btn ghost sm', type: 'button', disabled: busy || !s.stars, text: '−', 'aria-label': 'Einen Legenden-Stern abziehen', onclick: function () { stars(s.stars - 1); } }),
        el('span', { class: 'fine', text: '★ ' + (s.stars || 0) }),
        el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: '+', 'aria-label': 'Einen Legenden-Stern geben', onclick: function () { stars((s.stars || 0) + 1); } })) : null,
      el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: 'Umbenennen', onclick: function () { renaming = s.id; confirm = null; redraw(); } }),
      sure('del:' + s.id, 'Löschen', 'Wirklich löschen?', function () { rpcAct('admin_delete_save', { sid: s.id }, 'Spielstand „' + s.name + '“ von ' + p.username + ' gelöscht.'); })));
}

/* ---------- Duelle ---------- */
function duelList(host) {
  host.appendChild(searchBox(dq, 'Duelle eines Spielers (genauer Name) …', function (v) { dq = v; duels = null; load('duels'); }, function () { duels = null; redraw(); }));
  host.appendChild(el('p', { class: 'fine ad-hint', text: 'Annullieren nimmt die Wertungsänderung für beide Spieler zurück, zum Beispiel bei Betrug. Laufende Duelle werden einfach beendet.' }));
  if (loading(host, 'duels', duels)) return;
  if (!duels.length) { host.appendChild(el('p', { class: 'fine', text: dq ? 'Keine Duelle von „' + dq + '“.' : 'Noch keine Duelle.' })); return; }
  var tb = el('tbody');
  duels.forEach(function (d) {
    var canVoid = d.status === 'done' || d.status === 'open' || d.status === 'a_playing' || d.status === 'b_playing';
    tb.appendChild(el('tr', { class: d.status === 'void' ? 'ad-void' : '' },
      el('td', { class: 'num', text: when(d.finished_at || d.created_at) }),
      el('td', { text: GAMES[d.game] || d.game }),
      el('td', {}, el('b', { class: Number(d.as) > Number(d.bs) ? 'pos' : '', text: d.a || '?' }), ' gegen ', el('b', { class: Number(d.bs) > Number(d.as) ? 'pos' : '', text: d.b || 'offen' })),
      el('td', { class: 'num', text: (d.as == null ? '–' : fmt(d.as)) + ' : ' + (d.bs == null ? '–' : fmt(d.bs)) }),
      el('td', { class: 'num fine', text: d.ad != null ? (d.ad >= 0 ? '+' : '') + d.ad + ' / ' + (d.bd >= 0 ? '+' : '') + d.bd : '' }),
      el('td', { text: STATUS[d.status] || d.status }),
      el('td', {}, canVoid ? sure('void:' + d.id, 'Annullieren', 'Wirklich?', function () { rpcAct('admin_void_duel', { did: d.id }, 'Duell annulliert.'); }) : null)));
  });
  host.appendChild(el('div', { class: 'tscroll' }, el('table', { class: 'stbl ad-log' },
    el('thead', {}, el('tr', {}, el('th', { text: 'Zeit' }), el('th', { text: 'Spiel' }), el('th', { text: 'Spieler' }), el('th', { text: 'Ergebnis' }),
      el('th', { text: 'Wertung' }), el('th', { text: 'Status' }), el('th'))), tb)));
}

/* ---------- Geschenke an alle ---------- */
function giftView(host) {
  var chips = el('input', { class: 'name-in sm', type: 'number', min: '0', step: '1', value: '5000', inputmode: 'numeric', 'aria-label': 'Chips' });
  var tp = el('input', { class: 'name-in sm', type: 'number', min: '0', max: '10', step: '1', value: '0', inputmode: 'numeric', 'aria-label': 'Talentpunkte' });
  var days = el('input', { class: 'name-in sm', type: 'number', min: '1', max: '60', step: '1', value: '7', inputmode: 'numeric', 'aria-label': 'Gültig in Tagen' });
  var msg = el('input', { class: 'name-in sm', type: 'text', maxlength: '200', placeholder: 'z. B. Danke fürs Testen!', 'aria-label': 'Nachricht' });
  function create() {
    var c = Math.round(Number(chips.value) || 0), t = Math.round(Number(tp.value) || 0), d = Math.round(Number(days.value) || 0);
    if (c <= 0 && t <= 0) { V.toast('Ein Geschenk braucht Chips oder Talentpunkte.', 'bad'); return; }
    document.activeElement && document.activeElement.blur();
    rpcAct('admin_gift_create', { chips: c, tp: t, msg: msg.value.trim() || null, days: d }, 'Geschenk erstellt. Jeder Spieler bekommt es beim nächsten Spielstart.');
  }
  function field(label, input) { return el('label', { class: 'ad-field' }, el('span', { text: label }), input); }
  host.appendChild(el('section', { class: 'ad-box ad-keep' }, el('h4', { text: 'Geschenk an alle Spieler' }),
    el('p', { class: 'fine', text: 'Jeder Spieler mit Konto bekommt es einmal beim nächsten Start eines Karriere- oder Imperium-Spielstands, solange es gültig ist.' }),
    el('div', { class: 'ad-form' }, field('Chips', chips), field('Talentpunkte (0–10)', tp), field('Gültig (Tage)', days), field('Nachricht', msg)),
    el('div', { class: 'rrow' }, el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: '🎁 Geschenk verschicken', onclick: create }))));
  var list = el('section', { class: 'ad-box' }, el('h4', { text: 'Bisherige Geschenke' }));
  host.appendChild(list);
  if (loading(list, 'gifts', gifts)) return;
  if (!gifts.length) { list.appendChild(el('p', { class: 'fine', text: 'Noch keine.' })); return; }
  gifts.forEach(function (g) {
    list.appendChild(el('div', { class: 'ad-line' },
      el('span', {}, el('b', { text: [g.chips ? fmt(g.chips) + ' Chips' : '', g.tp ? g.tp + ' TP' : ''].filter(Boolean).join(' + ') }), g.target ? ' → ' + g.target : ' · an alle', g.message ? ' · ' + g.message : ''),
      el('span', { class: 'fine', text: fmt(g.claims) + '× abgeholt · ' + (g.active ? 'gültig bis ' + when(g.expires_at) : 'beendet') + ' · von ' + (g.created_by || '?') }),
      g.active ? sure('gift:' + g.id, 'Beenden', 'Wirklich beenden?', function () { rpcAct('admin_gift_stop', { gid: g.id }, 'Geschenk beendet.'); }) : null));
  });
}

/* ---------- Nachricht an alle ---------- */
function announce(host) {
  if (ann === undefined) { host.appendChild(el('p', { class: 'fine', text: 'Lade …' })); if (!err) load('announce'); return; }
  var box = el('section', { class: 'ad-box ad-ann ad-keep' }, el('h4', { text: 'Nachricht an alle Spieler' }),
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
