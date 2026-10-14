/* Chip Empire – Freundesystem: Liste, Anfragen senden und beantworten, Spielersuche, Benachrichtigungen.
   Eigenständig, damit Arena, Profile und Hauptmenü dieselben Daten und Aktionen nutzen. */
var Friends = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var ONLINE_MS = 3 * 60 * 1000;
var list = null, err = '', loading = false, stamp = 0, busy = {}, listeners = [];
var searchQ = '', results = null, searchTimer = 0, searchSeq = 0, confirmRemove = null;

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
/* Wer in den letzten Minuten gespeichert hat, sitzt gerade am Tisch */
function online(f) { return !!f.last_active && Date.now() - Date.parse(f.last_active) < ONLINE_MS; }
function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* */ } }); }

/* ---------- Daten ---------- */
function snapKey(a) { return 'chip-empire-friends-' + a.id; }
async function load(force) {
  var a = account();
  if (!a || loading || (!force && Date.now() - stamp < 15000)) return;
  loading = true;
  try { list = (await Cloud.rpc('friend_list')) || []; err = ''; notify(a); }
  catch (e) { err = /noch nicht eingerichtet/.test(e.message || '') ? 'Für Freunde fehlt noch das Datenbank-Update.' : 'Freunde gerade nicht erreichbar: ' + (e.message || e); }
  stamp = Date.now(); loading = false;
  emit();
}
/* Neue Anfragen und angenommene Anfragen melden; Vergleich mit dem letzten bekannten Stand */
function notify(a) {
  var prev = null, now = {};
  try { prev = JSON.parse(localStorage.getItem(snapKey(a)) || 'null'); } catch (e) { prev = null; }
  list.forEach(function (f) { now[f.username] = f.state; });
  try { localStorage.setItem(snapKey(a), JSON.stringify(now)); } catch (e) { /* */ }
  if (!prev) return;
  var fresh = list.filter(function (f) { return f.state === 'incoming' && prev[f.username] !== 'incoming'; });
  list.forEach(function (f) { if (f.state === 'friend' && prev[f.username] === 'outgoing') V.toast(f.username + ' hat deine Freundschaftsanfrage angenommen.', 'good'); });
  if (fresh.length === 1) {
    var n = fresh[0].username;
    V.banner('Freundschaftsanfrage', n + ' möchte dein Freund sein.', { kind: 'level', ms: 15000, actions: [
      { label: 'Annehmen', gold: true, fn: function () { accept(n); } }, { label: 'Später', fn: function () {} }] });
  } else if (fresh.length > 1) V.toast(fresh.length + ' neue Freundschaftsanfragen in der Arena.', 'good');
}
function poll() { if (account() && !document.hidden) load(true); }
function all() { return list || []; }
function byState(s) { return all().filter(function (f) { return f.state === s; }); }
function friends() {
  return byState('friend').slice().sort(function (a, b) { return (online(b) - online(a)) || a.username.localeCompare(b.username); });
}
function incoming() { return byState('incoming'); }
function stateOf(name) { var f = null; all().forEach(function (x) { if (x.username === name) f = x; }); return f ? f.state : null; }

/* ---------- Aktionen ---------- */
/* Pro Name nur eine Aktion gleichzeitig; danach Liste und Suche frisch laden */
async function run(name, fn) {
  if (busy[name]) return null;
  busy[name] = true; emit();
  var r = null;
  try { r = await fn(); }
  catch (e) { V.toast(e.message || String(e), 'bad'); }
  delete busy[name];
  await load(true);
  if (searchQ.length >= 2) doSearch();
  return r;
}
var SENT = { sent: ['Anfrage an %s gesendet.', 'good'], accepted: ['%s hatte dich schon angefragt. Ihr seid jetzt Freunde.', 'good'],
  friends: ['Du bist schon mit %s befreundet.', ''], pending: ['Du hast %s schon angefragt.', ''] };
function send(name) {
  name = String(name || '').trim().toLowerCase();
  if (!name) return Promise.resolve(null);
  if (!Cloud.NAME_RE.test(name)) { V.toast('Benutzernamen haben 3 bis 16 Zeichen: a–z, 0–9, _ und -.', 'bad'); return Promise.resolve(null); }
  return run(name, async function () {
    var r = await Cloud.rpc('friend_request', { name: name });
    var m = SENT[r] || SENT.sent;
    V.toast(m[0].replace('%s', name), m[1]);
    return r;
  });
}
function accept(name) {
  return run(name, async function () {
    var ok = await Cloud.rpc('friend_respond', { name: name, ok: true });
    V.toast(ok === false ? name + ' hat die Anfrage inzwischen zurückgezogen.' : 'Du bist jetzt mit ' + name + ' befreundet.', ok === false ? 'bad' : 'good');
  });
}
function decline(name) { return run(name, function () { return Cloud.rpc('friend_respond', { name: name, ok: false }); }); }
function remove(name) {
  confirmRemove = null;
  return run(name, async function () { await Cloud.rpc('friend_remove', { name: name }); V.toast(name + ' ist nicht mehr in deiner Freundesliste.', ''); });
}
function withdraw(name) { return run(name, async function () { await Cloud.rpc('friend_remove', { name: name }); V.toast('Anfrage an ' + name + ' zurückgezogen.', ''); }); }

async function doSearch() {
  var q = searchQ, seq = ++searchSeq;
  if (q.length < 2) { results = null; emit(); return; }
  try { var r = await Cloud.rpc('player_search', { q: q }); if (seq === searchSeq) results = r || []; }
  catch (e) { if (seq === searchSeq) results = []; }
  if (seq === searchSeq) drawResults();
}

/* ---------- Ansicht ---------- */
/* Knopf passend zur Beziehung: senden, annehmen, angefragt, befreundet */
function stateBtn(name, state, sm) {
  var cls = 'btn ' + (sm ? 'sm ' : '');
  var dis = !!busy[name];
  if (state === 'friend') return el('span', { class: 'tag good', text: 'Freund' });
  if (state === 'incoming') return el('button', { class: cls + 'gold', type: 'button', disabled: dis, text: 'Annehmen', onclick: function () { accept(name); } });
  if (state === 'outgoing') return el('span', { class: 'tag', text: 'Angefragt' });
  return el('button', { class: cls + 'gold', type: 'button', disabled: dis, text: '+ Anfrage senden', onclick: function () { send(name); } });
}
function avatar(f) {
  return el('span', { class: 'avatar' + (online(f) ? ' on' : ''), title: online(f) ? 'Spielt gerade' : '', text: f.username.charAt(0) });
}
function meta(f) {
  return [online(f) ? 'spielt gerade' : f.last_active ? 'aktiv ' + ago(f.last_active) : '', f.level ? 'Level ' + f.level : '',
    f.unlocked != null ? tierName(f.unlocked) : '', 'Wertung ' + fmt(f.rating)].filter(Boolean).join(' · ');
}

var resBox = null;
function drawResults() {
  if (!resBox) return;
  resBox.innerHTML = '';
  if (searchQ.length < 2) return;
  if (!results) { resBox.appendChild(el('p', { class: 'fine', text: 'Suche …' })); return; }
  if (!results.length) {
    resBox.appendChild(el('p', { class: 'fine', text: 'Niemand gefunden, dessen Name mit „' + searchQ + '“ beginnt.' }));
    return;
  }
  results.forEach(function (r) {
    resBox.appendChild(el('div', { class: 'fr-hit' },
      el('span', { class: 'avatar', text: r.username.charAt(0) }),
      el('div', { class: 'dr-info' }, el('button', { class: 'linkbtn', type: 'button', text: r.username, onclick: function () { Social.profile(r.username); } }),
        el('span', { class: 'fine', text: [r.level ? 'Level ' + r.level : '', r.unlocked != null ? tierName(r.unlocked) : '', 'Wertung ' + fmt(r.rating)].filter(Boolean).join(' · ') })),
      stateBtn(r.username, r.state, true)));
  });
}
function searchBox() {
  var input = el('input', { class: 'name-in sm', type: 'search', maxlength: '16', placeholder: 'Spieler suchen …', 'aria-label': 'Spieler suchen', value: searchQ,
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  input.addEventListener('input', function () {
    searchQ = input.value.trim().toLowerCase();
    results = null;
    clearTimeout(searchTimer);
    drawResults();
    searchTimer = setTimeout(doSearch, 250);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (results && results.length === 1) send(results[0].username); else if (searchQ) send(searchQ); }
    if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; searchQ = ''; results = null; drawResults(); }
  });
  resBox = el('div', { class: 'fr-results', 'aria-live': 'polite' });
  drawResults();
  return el('div', { class: 'fr-search' }, input, resBox);
}

function render(host) {
  if (!account()) { host.appendChild(el('p', { class: 'fine', text: 'Für Freunde brauchst du ein Konto.' })); return; }
  load();
  host.appendChild(searchBox());
  if (err) { host.appendChild(el('p', { class: 'fine', text: err })); return; }
  if (!list) { host.appendChild(el('p', { class: 'fine', text: 'Lade Freunde …' })); return; }

  var inc = incoming();
  if (inc.length) {
    host.appendChild(el('h4', { text: 'Anfragen an dich (' + inc.length + ')' }));
    inc.forEach(function (f) {
      host.appendChild(el('div', { class: 'duel-row hot' }, avatar(f),
        el('div', { class: 'dr-info' }, el('b', {}, el('button', { class: 'linkbtn', type: 'button', text: f.username, onclick: function () { Social.profile(f.username); } }), ' möchte dein Freund sein'),
          el('span', { class: 'fine', text: meta(f) })),
        el('div', { class: 'dr-act' },
          el('button', { class: 'btn gold sm', type: 'button', disabled: !!busy[f.username], text: 'Annehmen', onclick: function () { accept(f.username); } }),
          el('button', { class: 'btn ghost sm', type: 'button', disabled: !!busy[f.username], text: 'Ablehnen', onclick: function () { decline(f.username); } }))));
    });
  }

  var fr = friends(), on = fr.filter(online).length;
  host.appendChild(el('h4', { text: 'Freunde (' + fr.length + ')' + (on ? ' · ' + on + (on === 1 ? ' spielt' : ' spielen') + ' gerade' : '') }));
  if (!fr.length) host.appendChild(el('p', { class: 'fine', text: 'Noch keine Freunde. Such oben nach einem Namen oder klick in einer Bestenliste auf einen Spieler.' }));
  fr.forEach(function (f) {
    var acts = confirmRemove === f.username
      ? [el('span', { class: 'fine', text: 'Entfernen?' }),
        el('button', { class: 'btn crimson sm', type: 'button', disabled: !!busy[f.username], text: 'Ja', onclick: function () { remove(f.username); } }),
        el('button', { class: 'btn ghost sm', type: 'button', text: 'Nein', onclick: function () { confirmRemove = null; emit(); } })]
      : [el('button', { class: 'btn gold sm', type: 'button', text: '⚔ Duell', onclick: function () { Social.challenge(f.username); } }),
        el('button', { class: 'btn ghost sm icon-only', type: 'button', title: 'Aus der Freundesliste entfernen', 'aria-label': f.username + ' entfernen', text: '✕',
          onclick: function () { confirmRemove = f.username; emit(); } })];
    host.appendChild(el('div', { class: 'duel-row' + (online(f) ? ' online' : '') }, avatar(f),
      el('div', { class: 'dr-info' }, el('b', {}, el('button', { class: 'linkbtn', type: 'button', text: f.username, onclick: function () { Social.profile(f.username); } })),
        el('span', { class: 'fine', text: meta(f) })),
      el('div', { class: 'dr-act' }, acts)));
  });

  var out = byState('outgoing');
  if (out.length) {
    host.appendChild(el('h4', { text: 'Gesendete Anfragen (' + out.length + ')' }));
    out.forEach(function (f) {
      host.appendChild(el('div', { class: 'duel-row dim-soft' }, avatar(f),
        el('div', { class: 'dr-info' }, el('b', {}, el('button', { class: 'linkbtn', type: 'button', text: f.username, onclick: function () { Social.profile(f.username); } })),
          el('span', { class: 'fine', text: 'Wartet auf Antwort' })),
        el('button', { class: 'btn ghost sm', type: 'button', disabled: !!busy[f.username], text: 'Zurückziehen', onclick: function () { withdraw(f.username); } })));
    });
  }
}

return {
  load: load, poll: poll, list: all, friends: friends, incoming: incoming, stateOf: stateOf, online: online,
  send: send, accept: accept, decline: decline, remove: remove, withdraw: withdraw, render: render,
  onChange: function (fn) { listeners.push(fn); }
};
})();
V.friends = Friends;
