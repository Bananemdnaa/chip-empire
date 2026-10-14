/* Chip Empire – Admin-Panel: Spieler suchen, Chips setzen, Spielstände löschen, aus Ranglisten nehmen, Wertung zurücksetzen.
   Nur Oberfläche: Jede Aktion prüft der Server (public.admins), ohne Admin-Eintrag lehnt die Datenbank ab. */
var Admin = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var MODES = { career: 'Karriere', empire: 'Imperium', sandbox: 'Sandbox' };
var ACTIONS = { chips: 'Chips gesetzt', delete_save: 'Spielstand gelöscht', hide: 'Aus Ranglisten genommen', show: 'Wieder in Ranglisten', reset_rating: 'Wertung zurückgesetzt' };
var is = false, checkedFor = null, listeners = [];
var view = 'players', q = '', players = null, log = null, err = '', busy = false, timer = 0, seq = 0, confirm = null, rerender = null;

Icons.admin = Icons.admin || '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 2.8l7.5 3v5.6c0 4.6-3.2 8.4-7.5 9.8-4.3-1.4-7.5-5.2-7.5-9.8V5.8z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>';

function account() { return Store.isAccount() ? Cloud.current() : null; }
function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* */ } }); }
function when(t) { var d = new Date(t); return isNaN(d) ? '–' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
function tierName(u) { return E.TIERS[Math.max(0, Math.min(5, u || 0))].name; }
function redraw() { var a = document.activeElement; if (a && a.closest && a.closest('.ad-search')) return; if (rerender) rerender(); }

/* Fragt einmal pro Konto nach, ob es Admin ist */
async function check() {
  var a = account();
  if (!a) { if (is) { is = false; emit(); } checkedFor = null; return false; }
  if (checkedFor === a.id) return is;
  checkedFor = a.id;
  var r = false;
  try { r = !!(await Cloud.rpc('am_admin')); } catch (e) { r = false; }
  if (r !== is) { is = r; emit(); }
  return is;
}

/* ---------- Daten ---------- */
async function loadPlayers() {
  var s = ++seq;
  try { var r = await Cloud.rpc('admin_players', { q: q, lim: 30 }); if (s === seq) { players = r || []; err = ''; } }
  catch (e) { if (s === seq) err = e.message || String(e); }
  if (s === seq) redraw();
}
async function loadLog() {
  try { log = (await Cloud.rpc('admin_log_list', { lim: 60 })) || []; err = ''; }
  catch (e) { err = e.message || String(e); }
  redraw();
}
/* Aktion ausführen, Rückmeldung zeigen, Liste neu laden */
async function act(fn, ok) {
  if (busy) return;
  busy = true; confirm = null; redraw();
  try { await fn(); V.toast(ok, 'good'); }
  catch (e) { V.toast(e.message || String(e), 'bad'); }
  busy = false;
  log = null;
  await loadPlayers();
}

/* ---------- Ansicht ---------- */
function render(host, refresh) {
  rerender = refresh;
  if (!is) { host.appendChild(el('p', { class: 'fine', text: 'Keine Admin-Rechte.' })); return; }
  var seg = el('div', { class: 'qseg', role: 'tablist' });
  [['players', 'Spieler'], ['log', 'Protokoll']].forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(view === x[0]), text: x[1],
      onclick: function () { view = x[0]; V.Snd.click(); if (view === 'log') loadLog(); redraw(); } }));
  });
  host.appendChild(seg);
  if (view === 'log') { renderLog(host); return; }
  host.appendChild(searchBox());
  if (err) host.appendChild(el('p', { class: 'menu-status err', text: '⚠ ' + err }));
  if (!players) { host.appendChild(el('p', { class: 'fine', text: 'Lade Spieler …' })); if (!err) loadPlayers(); return; }
  if (!players.length) { host.appendChild(el('p', { class: 'fine', text: q ? 'Niemand gefunden, dessen Name mit „' + q + '“ beginnt.' : 'Noch keine Spieler.' })); return; }
  host.appendChild(el('p', { class: 'fine ad-count', text: players.length + (q ? ' Treffer' : ' zuletzt aktive Spieler') }));
  players.forEach(function (p) { host.appendChild(playerCard(p)); });
}

function searchBox() {
  var input = el('input', { class: 'name-in sm', type: 'search', placeholder: 'Spieler suchen (Namensanfang) …', 'aria-label': 'Spieler suchen', value: q, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  input.addEventListener('input', function () {
    q = input.value.trim().toLowerCase();
    clearTimeout(timer);
    timer = setTimeout(function () { players = null; loadPlayers(); }, 300);
  });
  return el('div', { class: 'ad-search' }, input,
    el('button', { class: 'btn ghost sm', type: 'button', text: '↻ Neu laden', onclick: function () { players = null; loadPlayers(); redraw(); } }));
}

/* Zweistufiger Knopf für Aktionen, die man nicht aus Versehen auslösen soll */
function sure(key, label, sureLabel, run) {
  var armed = confirm === key;
  return el('button', { class: 'btn sm ' + (armed ? 'crimson' : 'ghost'), type: 'button', disabled: busy, text: armed ? sureLabel : label,
    onclick: function () { if (armed) run(); else { confirm = key; redraw(); } } });
}

function playerCard(p) {
  var name = p.username;
  var head = el('div', { class: 'ad-head' },
    el('span', { class: 'avatar', text: name.charAt(0) }),
    el('div', { class: 'dr-info' },
      el('b', {}, el('button', { class: 'linkbtn', type: 'button', text: name, onclick: function () { Social.profile(name); } }),
        p.admin ? el('span', { class: 'tag gold', text: 'Admin' }) : null,
        p.hidden ? el('span', { class: 'tag warn', text: 'Ausgeblendet' }) : null),
      el('span', { class: 'fine', text: 'Dabei seit ' + when(p.joined) + ' · zuletzt aktiv ' + (p.last ? when(p.last) : '–') + ' · Wertung ' + fmt(p.rating) + ' (' + p.wins + ' S / ' + p.losses + ' N)' })));
  var acts = el('div', { class: 'rrow ad-acts' },
    el('button', { class: 'btn ghost sm', type: 'button', disabled: busy, text: p.hidden ? 'Wieder in Ranglisten' : 'Aus Ranglisten nehmen',
      onclick: function () { act(function () { return Cloud.rpc('admin_set_hidden', { name: name, hide: !p.hidden }); }, p.hidden ? name + ' steht wieder in den Ranglisten.' : name + ' ist aus den Ranglisten genommen.'); } }),
    p.wins + p.losses + p.draws > 0 || p.rating !== 1000
      ? sure('rating:' + name, 'Wertung zurücksetzen', 'Wirklich auf 1.000?', function () { act(function () { return Cloud.rpc('admin_reset_rating', { name: name }); }, 'Wertung von ' + name + ' zurückgesetzt.'); })
      : null);
  var saves = el('div', { class: 'ad-saves' });
  if (!p.saves.length) saves.appendChild(el('p', { class: 'fine', text: 'Keine Online-Spielstände.' }));
  p.saves.forEach(function (s) { saves.appendChild(saveRow(p, s)); });
  return el('article', { class: 'ad-card' + (p.hidden ? ' hidden-p' : '') }, head, acts, saves);
}

function saveRow(p, s) {
  var input = el('input', { class: 'name-in sm ad-amt', type: 'number', min: '0', step: '1', inputmode: 'numeric', value: String(Math.round(s.chips || 0)), 'aria-label': 'Neue Chips für ' + s.name });
  function setTo(v) {
    v = Math.round(Number(v));
    if (!isFinite(v) || v < 0) { V.toast('Bitte eine Zahl ab 0 eingeben.', 'bad'); return; }
    act(function () { return Cloud.rpc('admin_set_chips', { sid: s.id, amount: v }); }, s.name + ' von ' + p.username + ': jetzt ' + fmt(v) + ' Chips.');
  }
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') setTo(input.value); });
  var meta = [MODES[s.mode] || s.mode, s.mode === 'sandbox' ? '' : tierName(s.unlocked), s.level ? 'Level ' + s.level : '', 'Umsatz ' + V.short(s.wagered || 0), '⏱ ' + V.clock(s.play_ms || 0), 'gespeichert ' + when(s.updated_at)].filter(Boolean).join(' · ');
  return el('div', { class: 'ad-save' },
    el('div', { class: 'dr-info' }, el('b', {}, s.name + ' ', el('span', { class: 'num ad-chips', text: fmt(s.chips || 0) + ' Chips' })), el('span', { class: 'fine', text: meta })),
    el('div', { class: 'ad-set' },
      input,
      el('button', { class: 'btn gold sm', type: 'button', disabled: busy, text: 'Setzen', onclick: function () { setTo(input.value); } }),
      sure('del:' + s.id, 'Löschen', 'Wirklich löschen?', function () { act(function () { return Cloud.rpc('admin_delete_save', { sid: s.id }); }, 'Spielstand „' + s.name + '“ von ' + p.username + ' gelöscht.'); })));
}

function renderLog(host) {
  if (err) host.appendChild(el('p', { class: 'menu-status err', text: '⚠ ' + err }));
  if (!log) { host.appendChild(el('p', { class: 'fine', text: 'Lade Protokoll …' })); if (!err) loadLog(); return; }
  if (!log.length) { host.appendChild(el('p', { class: 'fine', text: 'Noch keine Admin-Aktionen.' })); return; }
  var tb = el('tbody');
  log.forEach(function (l) {
    tb.appendChild(el('tr', {}, el('td', { class: 'num', text: when(l.created_at) }), el('td', { text: l.admin_name || '–' }),
      el('td', { text: ACTIONS[l.action] || l.action }), el('td', { text: l.target || '' }), el('td', { class: 'fine', text: l.detail || '' })));
  });
  host.appendChild(el('div', { class: 'tscroll' }, el('table', { class: 'stbl ad-log' },
    el('thead', {}, el('tr', {}, el('th', { text: 'Zeit' }), el('th', { text: 'Admin' }), el('th', { text: 'Aktion' }), el('th', { text: 'Spieler' }), el('th', { text: 'Details' }))), tb)));
}

return { check: check, is: function () { return is; }, render: render, onChange: function (fn) { listeners.push(fn); } };
})();
