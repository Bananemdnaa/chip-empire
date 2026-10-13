/* Chip Empire – Hauptmenü: Konto, Spielstände wählen/anlegen/löschen, Bestenliste */
var Menu = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var root, onStart, view = 'slots', confirmDel = null, newMode = 'career';
var status = '', busy = false, board = null, boardErr = '';

function when(t) {
  var d = new Date(t), today = new Date();
  var hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return 'heute ' + hm;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + hm;
}
function $$(s, r) { return Array.prototype.slice.call(r.querySelectorAll(s)); }
function account() { return Store.isAccount() ? Cloud.current() : null; }

/* Führt eine Server-Aktion aus, sperrt solange das Menü und zeigt Fehler an */
async function run(label, fn) {
  if (busy) return;
  busy = true; status = label; render();
  try { await fn(); status = ''; }
  catch (e) { status = '⚠ ' + (e && e.message ? e.message : e); }
  busy = false; render();
}

/* ---------- Konto ---------- */
function accountBar() {
  var a = account();
  if (!Cloud.available()) return el('div', { class: 'acct' }, el('span', { text: 'Online-Konten gerade nicht erreichbar. Du spielst als Gast.' }));
  if (a) {
    return el('div', { class: 'acct' },
      el('span', {}, 'Eingeloggt als ', el('b', { text: a.username })),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abmelden', disabled: busy, onclick: function () {
        run('Melde ab …', async function () { await Cloud.signOut(); Store.useAccount(null); view = 'slots'; });
      } }));
  }
  return el('div', { class: 'acct' },
    el('span', { text: 'Du spielst als Gast. Mit Konto liegen deine Spielstände online und du kommst in die Bestenliste.' }),
    view === 'login' ? null : el('button', { class: 'btn gold sm', type: 'button', text: 'Einloggen / Registrieren', onclick: function () { view = 'login'; status = ''; render(); } }));
}

function loginForm() {
  var name = el('input', { class: 'name-in', type: 'text', maxlength: '16', placeholder: 'Benutzername', 'aria-label': 'Benutzername', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
  var pw = el('input', { class: 'name-in', type: 'password', placeholder: 'Passwort (mind. 6 Zeichen)', 'aria-label': 'Passwort', autocomplete: 'current-password' });
  function go(kind) {
    run(kind === 'up' ? 'Lege Konto an …' : 'Logge ein …', async function () {
      var u = kind === 'up' ? await Cloud.signUp(name.value, pw.value) : await Cloud.signIn(name.value, pw.value);
      Store.useAccount(u.id);
      await Cloud.syncAll();
      view = 'slots';
    });
  }
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go('in'); });
  setTimeout(function () { name.focus(); }, 0);
  return el('section', { class: 'newgame' },
    el('h2', { text: 'Konto' }),
    el('p', { class: 'fine', text: 'Benutzername: 3 bis 16 Zeichen (a–z, 0–9, _ und -). Keine E-Mail nötig. Merk dir dein Passwort gut, zurücksetzen geht nicht.' }),
    name, pw,
    el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold', type: 'button', text: 'Einloggen', disabled: busy, onclick: function () { go('in'); } }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Neues Konto erstellen', disabled: busy, onclick: function () { go('up'); } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Zurück', onclick: function () { view = 'slots'; status = ''; render(); } })));
}

/* ---------- Spielstände ---------- */
function slotCard(s) {
  var m = Store.MODES[s.mode] || Store.MODES.career, sum = s.sum || {};
  var tier = E.TIERS[Math.min(5, sum.unlocked || 0)];
  var actions;
  if (confirmDel === s.id) {
    actions = el('div', { class: 'slot-act' },
      el('span', { class: 'confirm-txt', text: 'Wirklich löschen?' }),
      el('button', { class: 'btn crimson sm', type: 'button', text: 'Ja, löschen', disabled: busy, onclick: function () {
        confirmDel = null;
        if (s.cloud) run('Lösche …', function () { return Cloud.deleteSave(s.id); });
        else { Store.remove(s.id); render(); }
      } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmDel = null; render(); } }));
  } else {
    actions = el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold', type: 'button', text: s.state ? 'Weiterspielen' : 'Starten', disabled: busy, onclick: function () { V.Snd.click(); onStart(s.id); } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Löschen', 'aria-label': 'Spielstand ' + s.name + ' löschen', disabled: busy, onclick: function () { confirmDel = s.id; render(); } }));
  }
  return el('article', { class: 'slot' },
    el('div', { class: 'slot-h' }, el('b', { class: 'slot-name', text: s.name }),
      el('span', { class: 'tags' }, s.dirty ? el('span', { class: 'tag warn', title: 'Noch nicht online gespeichert', text: 'nicht synchron' }) : null,
        el('span', { class: 'tag' + (s.mode === 'career' ? ' gold' : ''), text: m.name }))),
    el('div', { class: 'slot-bal num', text: fmt(sum.balance || 0) + ' Chips' }),
    el('div', { class: 'slot-k' },
      el('span', { text: s.mode === 'career' ? 'Stufe: ' + tier.name : 'Alle Räume offen' }),
      el('span', { text: 'Spielzeit ' + V.clock(sum.playMs || 0) }),
      el('span', { text: 'Zuletzt ' + when(s.updated) })),
    actions);
}

function newForm() {
  var input = el('input', { class: 'name-in', type: 'text', maxlength: '20', placeholder: 'z.B. Mein Imperium', 'aria-label': 'Name des Spielstands', autocomplete: 'off' });
  var modes = el('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Spielmodus' });
  Object.keys(Store.MODES).forEach(function (k) {
    var M = Store.MODES[k];
    modes.appendChild(el('button', { class: 'mode', type: 'button', role: 'radio', 'aria-checked': String(newMode === k),
      onclick: function () { newMode = k; V.Snd.click(); $$('.mode', modes).forEach(function (b) { b.setAttribute('aria-checked', String(b === this)); }, this); } },
      el('b', { text: M.name }), el('span', { text: M.desc })));
  });
  function go() {
    var name = input.value.trim().replace(/\s+/g, ' ').slice(0, 20) || 'Spielstand ' + (Store.list().length + 1);
    if (account()) {
      run('Lege Spielstand an …', async function () { var s = await Cloud.createSave(name, newMode); view = 'slots'; onStart(s.id); });
      return;
    }
    var s = Store.create(name, newMode);
    if (!s) { V.toast('Spielstand konnte nicht angelegt werden.', 'bad'); return; }
    view = 'slots';
    onStart(s.id);
  }
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  setTimeout(function () { input.focus(); }, 0);
  return el('section', { class: 'newgame' },
    el('h2', { text: 'Neues Spiel' }),
    el('label', { class: 'lbl', text: 'Name' }), input,
    el('div', { class: 'lbl', text: 'Modus' }), modes,
    el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold big', type: 'button', text: 'Los geht’s', disabled: busy, onclick: go }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Abbrechen', onclick: function () { view = 'slots'; render(); } })));
}

/* Gast-Spielstände, die auf diesem Gerät liegen, ins Konto übernehmen */
function guestImport(full) {
  var g = Store.guestList();
  if (!g.length) return null;
  var box = el('section', { class: 'guest' }, el('h3', { class: 'menu-h', text: 'Gast-Spielstände auf diesem Gerät' }));
  g.forEach(function (s) {
    var sum = s.sum || {};
    box.appendChild(el('div', { class: 'guest-row' },
      el('span', {}, el('b', { text: s.name }), ' · ' + (Store.MODES[s.mode] || Store.MODES.career).name + ' · ' + fmt(sum.balance || 0) + ' Chips'),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Ins Konto übernehmen', disabled: busy || full || !s.state,
        title: full ? 'Dein Konto hat schon 3 Spielstände' : '', onclick: function () {
          run('Übernehme …', async function () { await Cloud.createSave(s.name, s.mode, s.state); Store.removeGuest(s.id); });
        } })));
  });
  return box;
}

/* ---------- Bestenliste ---------- */
function boardBox() {
  if (!Cloud.available()) return null;
  var box = el('section', { class: 'board' }, el('h3', { class: 'menu-h', text: 'Bestenliste · Karriere' }));
  if (boardErr) { box.appendChild(el('p', { class: 'fine', text: boardErr })); return box; }
  if (!board) { box.appendChild(el('p', { class: 'fine', text: 'Lade …' })); return box; }
  if (!board.length) { box.appendChild(el('p', { class: 'fine', text: 'Noch niemand in der Liste. Leg einen Karriere-Spielstand mit Konto an und sei die Nummer 1.' })); return box; }
  var me = account();
  var tb = el('tbody');
  board.forEach(function (r, i) {
    tb.appendChild(el('tr', { class: me && r.username === me.username ? 'me' : '' },
      el('td', { class: 'num', text: String(i + 1) }),
      el('td', {}, el('b', { text: r.username }), el('span', { class: 'bsave', text: ' · ' + r.save_name })),
      el('td', { class: 'num', text: fmt(r.balance) }),
      el('td', { class: 'btier', text: E.TIERS[Math.min(5, r.unlocked || 0)].name })));
  });
  box.appendChild(el('div', { class: 'tscroll' }, el('table', { class: 'stbl' },
    el('thead', {}, el('tr', {}, el('th', { text: '#' }), el('th', { text: 'Spieler' }), el('th', { text: 'Chips' }), el('th', { text: 'Stufe' }))), tb)));
  return box;
}
function loadBoard() {
  if (!Cloud.available()) return;
  Cloud.leaderboard(20).then(function (rows) { board = rows; boardErr = ''; render(); })
    .catch(function (e) { boardErr = 'Bestenliste nicht verfügbar: ' + (e.message || e); render(); });
}

/* ---------- Aufbau ---------- */
function render() {
  if (!root) return;
  root.innerHTML = '';
  root.appendChild(el('header', { class: 'menu-top' },
    el('h1', { class: 'menu-logo', text: 'Chip Empire' }),
    el('p', { class: 'menu-sub', text: 'Vom Lobby-Gast zur Legende im Black Room.' })));
  root.appendChild(accountBar());
  if (status) root.appendChild(el('p', { class: 'menu-status' + (status.charAt(0) === '⚠' ? ' err' : ''), role: 'status', text: status }));
  if (Store.isBroken()) {
    root.appendChild(el('p', { class: 'menu-warn', text: 'Deine Spielstände konnten nicht gelesen werden. Eine Sicherung liegt im Browser-Speicher, es wird nichts überschrieben.' }));
  }
  if (view === 'login') { root.appendChild(loginForm()); return; }
  if (view === 'new') { root.appendChild(newForm()); return; }
  var slots = Store.list();
  var grid = el('section', { class: 'slots', 'aria-label': 'Spielstände' });
  slots.forEach(function (s) { grid.appendChild(slotCard(s)); });
  if (slots.length < Store.MAX_SLOTS && !Store.isBroken()) {
    grid.appendChild(el('button', { class: 'slot empty', type: 'button', disabled: busy, onclick: function () { view = 'new'; newMode = 'career'; V.Snd.click(); render(); } },
      el('span', { class: 'plus', text: '+' }), el('b', { text: 'Neues Spiel' }), el('span', { text: 'Freier Platz ' + (slots.length + 1) + ' von ' + Store.MAX_SLOTS })));
  }
  root.appendChild(grid);
  if (account()) { var gi = guestImport(slots.length >= Store.MAX_SLOTS); if (gi) root.appendChild(gi); }
  var bb = boardBox(); if (bb) root.appendChild(bb);
  root.appendChild(el('p', { class: 'fine menu-note', text: account()
    ? 'Deine Spielstände liegen online in deinem Konto und funktionieren auf jedem Gerät.'
    : 'Gast-Spielstände liegen nur in diesem Browser. Ein anderes Gerät, ein anderer Browser oder der private Modus sehen sie nicht.' }));
  root.appendChild(el('footer', { class: 'foot', text: 'Chip Empire · Spielgeld ohne Wert, kein echtes Glücksspiel · Alle Figuren sind frei erfunden' }));
}

function show(cb) {
  onStart = cb;
  root = document.getElementById('menu');
  document.getElementById('app').hidden = true;
  root.hidden = false;
  view = Store.list().length === 0 && !Store.isBroken() && !Cloud.available() ? 'new' : 'slots';
  render();
  if (Store.isAccount()) run('Gleiche mit der Cloud ab …', function () { return Cloud.syncAll(); });
  loadBoard();
}
function hide() { (root || document.getElementById('menu')).hidden = true; }

return { show: show, hide: hide };
})();
