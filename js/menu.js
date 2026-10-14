/* Chip Empire – Hauptmenü: Navigation mit Bereichen (Spielen, Arena, Freunde, Ranglisten, Profil) */
var Menu = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var root, inner, body, navEl, onStart, view = 'slots', confirmDel = null, newMode = 'career';
var status = '', busy = false, board = null, boardErr = '', boardMode = 'career', pollTimer = 0;
var CHIP_COLORS = ['#8E0E2B', '#1E5E8E', '#1A1418', '#5B2A8E', '#C79A3A', '#0F6A4A'];
var SECTION_KEY = 'chip-empire-menu-section';
/* Bereiche der Navigation; online: nur mit Server, cnt: Zähler für offene Dinge */
var SECTIONS = [
  { id: 'play', label: 'Spielen', icon: 'slots' },
  { id: 'arena', label: 'Arena', icon: 'arena', online: true, cnt: function () { return Social.invites(); } },
  { id: 'friends', label: 'Freunde', icon: 'friends', online: true, cnt: function () { return Friends.incoming().length; } },
  { id: 'ranks', label: 'Ranglisten', icon: 'ranks', online: true },
  { id: 'profile', label: 'Profil', icon: 'user', online: true },
  { id: 'admin', label: 'Admin', icon: 'admin', online: true, admin: true }
];
var section = (function () { try { return localStorage.getItem(SECTION_KEY) || 'play'; } catch (e) { return 'play'; } })();

function when(t) {
  var d = new Date(t), today = new Date();
  var hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return 'heute ' + hm;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + hm;
}
function $$(s, r) { return Array.prototype.slice.call(r.querySelectorAll(s)); }
function account() { return Store.isAccount() ? Cloud.current() : null; }
function chipImg(cls) { return el('img', { class: cls || '', src: 'favicon.svg', alt: '' }); }
function sections() { return SECTIONS.filter(function (s) { return (!s.online || Cloud.available()) && (!s.admin || Admin.is()); }); }

/* Führt eine Server-Aktion aus, sperrt solange das Menü und zeigt Fehler an */
async function run(label, fn) {
  if (busy) return;
  busy = true; status = label; render();
  try { await fn(); status = ''; }
  catch (e) { status = '⚠ ' + (e && e.message ? e.message : e); }
  busy = false; render();
}

/* ---------- Hintergrund: Scheinwerfer und schwebende Chips ---------- */
function background() {
  var bg = el('div', { class: 'menu-bg', 'aria-hidden': 'true' });
  for (var i = 0; i < 16; i++) {
    var size = 26 + Math.round(Math.random() * 46);
    var c = el('span', { class: 'fchip' });
    c.style.width = c.style.height = size + 'px';
    c.style.left = Math.round(Math.random() * 100) + '%';
    c.style.setProperty('--c', CHIP_COLORS[i % CHIP_COLORS.length]);
    c.style.setProperty('--o', (0.18 + Math.random() * 0.35).toFixed(2));
    c.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
    c.style.animationDuration = (14 + Math.random() * 16).toFixed(1) + 's';
    c.style.animationDelay = (-Math.random() * 30).toFixed(1) + 's';
    c.style.filter = 'blur(' + (size < 40 ? 1.5 : 0) + 'px)';
    bg.appendChild(c);
  }
  return bg;
}

/* ---------- Navigation ---------- */
function go(id) {
  if (section === id && view === 'slots') return;
  section = id; view = 'slots'; status = ''; deleteOpen = false;
  try { localStorage.setItem(SECTION_KEY, id); } catch (e) { /* */ }
  V.Snd.click();
  render();
  if (id === 'ranks') loadBoard();
  window.scrollTo(0, 0);
}
function topBar() {
  var a = account();
  navEl = el('nav', { class: 'mnav', 'aria-label': 'Hauptmenü' });
  sections().forEach(function (s) {
    var label = s.id === 'profile' && !a ? 'Konto' : s.label;
    navEl.appendChild(el('button', { class: 'mnav-btn', type: 'button', 'data-sec': s.id, 'aria-current': section === s.id ? 'page' : null, onclick: function () { go(s.id); } },
      el('span', { class: 'mnav-ic', html: Icons[s.icon] }), el('span', { class: 'mnav-lb', text: label })));
  });
  syncNav();
  var acct;
  if (!Cloud.available()) acct = el('div', { class: 'acct-pill' }, el('span', { class: 'avatar guest-av', html: Icons.user }), el('span', { class: 'lbl', text: 'Offline · Gast' }));
  else if (a) acct = el('button', { class: 'acct-pill', type: 'button', title: 'Dein Profil', onclick: function () { go('profile'); } },
    el('span', { class: 'avatar', text: a.username.charAt(0) }), el('b', { text: a.username }));
  else acct = el('div', { class: 'acct-pill' }, el('span', { class: 'avatar guest-av', html: Icons.user }), el('span', { class: 'lbl', text: 'Gast' }),
    el('button', { class: 'btn gold sm', type: 'button', text: 'Einloggen', onclick: function () { go('profile'); } }));
  return el('header', { class: 'mtop' },
    el('button', { class: 'mtop-logo', type: 'button', 'aria-label': 'Chip Empire, zu den Spielständen', onclick: function () { go('play'); } }, chipImg(), el('span', { text: 'Chip Empire' })),
    navEl, acct);
}
/* Zähler an den Bereichen auffrischen, ohne das Menü neu aufzubauen */
function syncNav() {
  if (!navEl) return;
  SECTIONS.forEach(function (s) {
    var b = navEl.querySelector('[data-sec="' + s.id + '"]');
    if (!b) return;
    var old = b.querySelector('.qcount'); if (old) old.remove();
    var n = s.cnt && account() ? s.cnt() : 0;
    if (n) b.appendChild(el('span', { class: 'qcount', text: String(n) }));
  });
}
function head(title, sub) {
  return el('div', { class: 'msec-h' }, el('h2', { class: 'menu-h', text: title }), sub ? el('p', { class: 'fine', text: sub }) : null);
}
/* Bereiche, die ein Konto brauchen */
function needAccount(what) {
  return el('section', { class: 'panel need-acct' },
    el('h2', { text: 'Mit Konto geht mehr' }),
    el('p', { class: 'fine', text: what + ' Ein Konto ist kostenlos und braucht keine E-Mail. Deine Gast-Spielstände kannst du danach mitnehmen.' }),
    el('div', { class: 'slot-act' }, el('button', { class: 'btn gold', type: 'button', text: 'Einloggen oder Konto erstellen', onclick: function () { go('profile'); } })));
}

/* ---------- Konto ---------- */
function loginForm() {
  var name = el('input', { class: 'name-in', type: 'text', maxlength: '16', placeholder: 'Benutzername', 'aria-label': 'Benutzername', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
  var pw = el('input', { class: 'name-in', type: 'password', placeholder: 'Passwort (mind. 6 Zeichen)', 'aria-label': 'Passwort', autocomplete: 'current-password' });
  function submit(kind) {
    run(kind === 'up' ? 'Lege Konto an …' : 'Logge ein …', async function () {
      var u = kind === 'up' ? await Cloud.signUp(name.value, pw.value) : await Cloud.signIn(name.value, pw.value);
      Store.useAccount(u.id);
      await Cloud.syncAll();
      section = 'play';
      board = null; loadBoard();
      Social.poll();
      Admin.check();
    });
  }
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit('in'); });
  setTimeout(function () { name.focus(); }, 0);
  return el('section', { class: 'panel' },
    el('h2', { text: 'Dein Konto' }),
    el('p', { class: 'fine', text: 'Mit Konto liegen deine Spielstände online, laufen auf jedem Gerät und du kommst in die Bestenlisten, kannst Freunde hinzufügen und Duelle spielen. Keine E-Mail nötig. Merk dir dein Passwort gut, zurücksetzen geht nicht.' }),
    name, pw,
    el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold', type: 'button', text: 'Einloggen', disabled: busy, onclick: function () { submit('in'); } }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Neues Konto erstellen', disabled: busy, onclick: function () { submit('up'); } })),
    el('p', { class: 'fine', text: 'Benutzername: 3 bis 16 Zeichen, nur a–z, 0–9, _ und -.' }));
}
function profileSection() {
  var a = account();
  if (!a) { body.appendChild(loginForm()); return; }
  body.appendChild(head('Dein Profil', 'So sehen dich andere Spieler, wenn sie auf deinen Namen klicken.'));
  var box = el('section', { class: 'panel wide own-prof' });
  body.appendChild(box);
  Social.profileInto(box, a.username, function () { return box.isConnected; });
  body.appendChild(el('section', { class: 'panel wide' },
    el('h2', { text: 'Konto' }),
    el('p', { class: 'fine', text: 'Angemeldet als ' + a.username + '. Deine Spielstände liegen online und funktionieren auf jedem Gerät.' }),
    el('div', { class: 'slot-act' }, el('button', { class: 'btn ghost', type: 'button', text: 'Abmelden', disabled: busy, onclick: function () {
      run('Melde ab …', async function () { await Cloud.signOut(); Store.useAccount(null); section = 'play'; board = null; loadBoard(); Admin.check(); });
    } }))));
  body.appendChild(deleteBox(a));
}
/* Konto löschen: Benutzername abtippen und Passwort eingeben, erst dann wird der Knopf scharf */
var deleteOpen = false;
function deleteBox(a) {
  var box = el('section', { class: 'panel wide danger' }, el('h2', { text: 'Konto löschen' }));
  if (!deleteOpen) {
    box.appendChild(el('p', { class: 'fine', text: 'Löscht dein Konto mit allen Online-Spielständen, Freunden, Duellen und deiner Wertung. Das lässt sich nicht rückgängig machen.' }));
    box.appendChild(el('div', { class: 'slot-act' }, el('button', { class: 'btn ghost', type: 'button', text: 'Konto löschen …', onclick: function () { deleteOpen = true; renderBody(); } })));
    return box;
  }
  var name = el('input', { class: 'name-in', type: 'text', maxlength: '16', placeholder: a.username, 'aria-label': 'Benutzername zur Bestätigung', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  var pw = el('input', { class: 'name-in', type: 'password', placeholder: 'Dein Passwort', 'aria-label': 'Passwort', autocomplete: 'current-password' });
  var btn = el('button', { class: 'btn crimson', type: 'button', text: 'Konto endgültig löschen', disabled: true, onclick: function () {
    if (name.value.trim().toLowerCase() !== a.username || !pw.value) return;
    run('Lösche dein Konto …', async function () {
      await Cloud.deleteAccount(pw.value);
      Store.useAccount(null);
      deleteOpen = false; section = 'play'; board = null; loadBoard(); Admin.check();
      V.toast('Dein Konto wurde gelöscht.', 'good');
    });
  } });
  function check() { btn.disabled = busy || name.value.trim().toLowerCase() !== a.username || !pw.value; }
  name.addEventListener('input', check); pw.addEventListener('input', check);
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !btn.disabled) btn.click(); });
  setTimeout(function () { name.focus(); }, 0);
  box.appendChild(el('p', { class: 'fine', text: 'Alle Online-Spielstände, Freundschaften, Duelle und deine Wertung werden gelöscht. Gast-Spielstände auf diesem Gerät bleiben. Tippe zur Bestätigung deinen Benutzernamen „' + a.username + '“ und dein Passwort ein.' }));
  box.appendChild(name); box.appendChild(pw);
  box.appendChild(el('div', { class: 'slot-act' }, btn,
    el('button', { class: 'btn ghost', type: 'button', text: 'Abbrechen', onclick: function () { deleteOpen = false; renderBody(); } })));
  return box;
}

/* ---------- Spielstände als VIP-Karten ---------- */
function vipCard(s) {
  var m = Store.MODES[s.mode] || Store.MODES.career, sum = s.sum || {};
  var t = Math.min(5, sum.unlocked || 0), T = E.TIERS[t], next = E.TIERS[t + 1];
  var career = s.mode !== 'sandbox';
  var tierBox;
  if (career && next) {
    var p = Math.max(0, Math.min(1, ((sum.wagered || 0) - T.wager) / (next.wager - T.wager)));
    tierBox = el('div', { class: 'vip-tier' },
      el('div', { class: 'row' }, el('b', { text: T.name }), el('span', { text: 'nächste: ' + next.name })),
      el('div', { class: 'vip-bar' }, el('i', { style: 'width:' + (p * 100).toFixed(1) + '%' })));
  } else {
    tierBox = el('div', { class: 'vip-tier' }, el('div', { class: 'row' }, el('b', { text: career ? T.name : 'Alle Räume offen' }), el('span', { text: career ? 'höchste Stufe' : '' })));
  }
  var actions;
  if (confirmDel === s.id) {
    actions = el('div', { class: 'vip-confirm' },
      el('span', { text: '„' + s.name + '“ wirklich löschen? Das lässt sich nicht rückgängig machen.' }),
      el('div', { class: 'row' },
        el('button', { class: 'btn crimson sm', type: 'button', text: 'Ja, löschen', disabled: busy, onclick: function () {
          confirmDel = null;
          if (s.cloud) run('Lösche …', function () { return Cloud.deleteSave(s.id); });
          else { Store.remove(s.id); render(); }
        } }),
        el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmDel = null; render(); } })));
  } else {
    actions = el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold', type: 'button', disabled: busy, onclick: function () { V.Snd.click(); onStart(s.id); } },
        el('span', { html: Icons.play }), s.state ? 'Weiterspielen' : 'Starten'));
  }
  return el('article', { class: 'vip', 'data-tier': String(career ? t : 5) },
    el('div', { class: 'vip-top' },
      el('span', { class: 'vip-emblem', text: V.RANK[career ? t : 5] }),
      el('span', { class: 'tags' },
        s.dirty ? el('span', { class: 'tag warn', title: 'Noch nicht online gespeichert', text: 'nicht synchron' }) : null,
        el('span', { class: 'tag', text: m.name })),
      el('button', { class: 'vip-del', type: 'button', html: Icons.trash, 'aria-label': 'Spielstand ' + s.name + ' löschen', title: 'Löschen', disabled: busy,
        onclick: function () { confirmDel = s.id; render(); } })),
    el('div', { class: 'vip-name', text: s.name }),
    el('div', { class: 'vip-bal' }, chipImg(), fmt(sum.balance || 0)),
    tierBox,
    el('div', { class: 'vip-meta' }, s.mode === 'empire' ? el('span', { text: '🏛️ Wert ' + V.short(sum.worth || sum.balance || 0) }) : null, el('span', { text: '⏱ ' + V.clock(sum.playMs || 0) }), el('span', { text: 'Zuletzt ' + when(s.updated) })),
    actions);
}

function newForm() {
  var input = el('input', { class: 'name-in', type: 'text', maxlength: '20', placeholder: 'z.B. Mein Imperium', 'aria-label': 'Name des Spielstands', autocomplete: 'off' });
  var modes = el('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Spielmodus' });
  var ICON = { career: 'stufen', empire: 'imperium', sandbox: 'slots' };
  Object.keys(Store.MODES).forEach(function (k) {
    var M = Store.MODES[k];
    modes.appendChild(el('button', { class: 'mode', type: 'button', role: 'radio', 'aria-checked': String(newMode === k),
      onclick: function () { newMode = k; V.Snd.click(); $$('.mode', modes).forEach(function (b) { b.setAttribute('aria-checked', String(b === this)); }, this); } },
      el('span', { html: Icons[ICON[k]] }), el('b', { text: M.name }), el('span', { text: M.desc })));
  });
  function create() {
    var name = input.value.trim().replace(/\s+/g, ' ').slice(0, 20) || 'Spielstand ' + (Store.list().length + 1);
    if (Store.badName(name)) { V.toast('Dieser Name ist nicht erlaubt. Bitte wähl einen anderen.', 'bad'); input.focus(); return; }
    if (account()) {
      run('Lege Spielstand an …', async function () { var s = await Cloud.createSave(name, newMode); view = 'slots'; onStart(s.id); });
      return;
    }
    var s = Store.create(name, newMode);
    if (!s) { V.toast('Spielstand konnte nicht angelegt werden.', 'bad'); return; }
    view = 'slots';
    onStart(s.id);
  }
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') create(); });
  setTimeout(function () { input.focus(); }, 0);
  return el('section', { class: 'panel' },
    el('h2', { text: 'Neues Spiel' }),
    el('label', { class: 'lbl', text: 'Name deines Imperiums' }), input,
    el('div', { class: 'lbl', text: 'Modus' }), modes,
    el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold big', type: 'button', text: 'Los geht’s', disabled: busy, onclick: create }),
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

function playSection() {
  if (view === 'new') { body.appendChild(newForm()); return; }
  var slots = Store.list(), a = account();
  var last = slots.slice().sort(function (x, y) { return (y.updated || 0) - (x.updated || 0); })[0];
  body.appendChild(el('header', { class: 'menu-hero' },
    el('img', { class: 'hero-chip', src: 'favicon.svg', alt: '' }),
    el('h1', { class: 'menu-logo', 'data-text': 'Chip Empire', text: 'Chip Empire' }),
    el('p', { class: 'menu-sub', text: a ? 'Willkommen zurück, ' + a.username : 'Vom Lobby-Gast zur Legende im Black Room' }),
    last && last.state && !busy ? el('button', { class: 'btn gold big hero-go', type: 'button', onclick: function () { V.Snd.click(); onStart(last.id); } },
      el('span', { html: Icons.play }), 'Weiterspielen: ' + last.name) : null));
  if (Store.isBroken()) {
    body.appendChild(el('p', { class: 'menu-warn', text: 'Deine Spielstände konnten nicht gelesen werden. Eine Sicherung liegt im Browser-Speicher, es wird nichts überschrieben.' }));
  }
  var grid = el('div', { class: 'slots' });
  slots.forEach(function (s) { grid.appendChild(vipCard(s)); });
  if (slots.length < Store.MAX_SLOTS && !Store.isBroken()) {
    grid.appendChild(el('button', { class: 'slot-new', type: 'button', disabled: busy, onclick: function () { view = 'new'; newMode = 'career'; V.Snd.click(); render(); } },
      el('span', { class: 'plus', text: '+' }), el('b', { text: 'Neues Spiel' }), el('span', { text: 'Platz ' + (slots.length + 1) + ' von ' + Store.MAX_SLOTS })));
  }
  body.appendChild(el('section', { 'aria-label': 'Spielstände' }, el('h2', { class: 'menu-h', text: a ? 'Deine Spielstände' : 'Spielstände auf diesem Gerät' }), grid));
  if (a) { var gi = guestImport(slots.length >= Store.MAX_SLOTS); if (gi) body.appendChild(gi); }
  body.appendChild(el('p', { class: 'fine menu-note', text: a
    ? 'Deine Spielstände liegen online in deinem Konto und funktionieren auf jedem Gerät.'
    : 'Gast-Spielstände liegen nur in diesem Browser. Mit Konto spielst du auf jedem Gerät weiter.' }));
}

/* ---------- Ranglisten mit Treppchen ---------- */
var BOARD_TEXT = {
  career: 'Karriere-Spielstände nach Chips.',
  empire: 'Imperium-Spielstände nach Imperiumswert (Chips plus Geschäfte).',
  duel: 'Elo-Wertung aus allen Duellen. Der Kontostand spielt keine Rolle.'
};
function boardBox() {
  var box = el('section', { class: 'board', 'aria-label': 'Bestenliste' });
  var seg = el('div', { class: 'qseg board-seg', role: 'tablist' });
  [['career', 'Karriere'], ['empire', 'Imperium'], ['duel', 'Duelle']].forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(boardMode === x[0]), text: x[1],
      onclick: function () { if (boardMode === x[0]) return; boardMode = x[0]; board = null; boardErr = ''; V.Snd.click(); render(); loadBoard(); } }));
  });
  box.appendChild(seg);
  if (boardErr) { box.appendChild(el('p', { class: 'fine', text: boardErr })); return box; }
  if (!board) { box.appendChild(el('p', { class: 'fine', text: 'Lade …' })); return box; }
  if (!board.length) { box.appendChild(el('p', { class: 'fine', text: boardMode === 'duel' ? 'Noch niemand hat ein Duell beendet. Fordere jemanden in der Arena heraus.' : 'Noch niemand hier. Leg einen ' + (boardMode === 'empire' ? 'Imperium' : 'Karriere') + '-Spielstand mit Konto an und sei die Nummer 1.' })); return box; }
  var me = account(), myName = me ? me.username : null;
  var pod = el('div', { class: 'podium' });
  [1, 0, 2].forEach(function (i) {
    var r = board[i];
    if (!r) { pod.appendChild(el('div')); return; }
    pod.appendChild(el('div', { class: 'pod p' + (i + 1) + (r.username === myName ? ' me' : '') },
      i === 0 ? el('span', { class: 'crown', html: Icons.crown }) : null,
      el('span', { class: 'medal', text: String(i + 1) }),
      el('button', { class: 'who linkbtn', type: 'button', text: r.username, title: 'Profil ansehen', onclick: function () { Social.profile(r.username); } }),
      el('span', { class: 'amt', text: fmt(r.balance) }),
      el('span', { class: 'step' })));
  });
  box.appendChild(pod);
  if (board.length > 3) {
    var ol = el('ol', { class: 'blist' });
    board.slice(3).forEach(function (r, k) {
      ol.appendChild(el('li', { class: r.username === myName ? 'me' : '' },
        el('span', { class: 'rk', text: String(k + 4) }),
        el('span', { class: 'nm' }, el('button', { class: 'linkbtn', type: 'button', text: r.username, title: 'Profil ansehen', onclick: function () { Social.profile(r.username); } }),
          el('small', { text: boardMode === 'duel' ? ' · ' + r.wins + ' S / ' + r.losses + ' N' : ' · ' + E.TIERS[Math.min(5, r.unlocked || 0)].name })),
        el('span', { class: 'am', text: fmt(r.balance) })));
    });
    box.appendChild(ol);
  }
  box.appendChild(el('p', { class: 'fine', text: BOARD_TEXT[boardMode] }));
  return box;
}
function loadBoard() {
  if (!Cloud.available()) return;
  var mode = boardMode;
  var req = mode === 'duel'
    ? Cloud.rpc('duel_board', { lim: 20 }).then(function (rows) { return (rows || []).map(function (r) { return Object.assign({ balance: r.rating }, r); }); })
    : Cloud.leaderboard(20, mode);
  req.then(function (rows) { if (mode !== boardMode) return; board = rows; boardErr = ''; if (section === 'ranks') renderBody(); })
    .catch(function (e) { if (mode !== boardMode) return; boardErr = mode !== 'career' ? 'Diese Bestenliste braucht noch das Datenbank-Update.' : 'Bestenliste nicht verfügbar: ' + (e.message || e); if (section === 'ranks') renderBody(); });
}

/* ---------- Aufbau ---------- */
/* Während jemand in der Spielersuche tippt, nicht neu zeichnen */
function typing() { var a = document.activeElement; return !!(a && a.tagName === 'INPUT' && a.closest && a.closest('.fr-search')); }
function renderBody() {
  if (!body) return;
  body.innerHTML = '';
  body.setAttribute('data-sec', section);
  var a = account();
  if (section === 'arena') {
    body.appendChild(head('Arena', 'Duelle gegen andere Spieler in Crash, Dragon Tower oder Blackjack: derselbe Zufall und dieselben Startchips für beide.'));
    if (!a) { body.appendChild(needAccount('In der Arena forderst du andere Spieler zu Duellen in Crash, Dragon Tower oder Blackjack heraus und sammelst Wertungspunkte.')); return; }
    var box = el('div', { class: 'msec-box' });
    body.appendChild(box);
    Social.render(box, function () { if (section === 'arena' && !typing()) renderBody(); }, 'duels');
  } else if (section === 'friends') {
    body.appendChild(head('Freunde', 'Such Spieler, schick Anfragen und fordere Freunde direkt heraus.'));
    if (!a) { body.appendChild(needAccount('Mit Freunden siehst du, wer gerade spielt, und kannst sie direkt zum Duell herausfordern.')); return; }
    var fbox = el('div', { class: 'msec-box' });
    body.appendChild(fbox);
    Friends.render(fbox);
  } else if (section === 'ranks') {
    body.appendChild(head('Ranglisten', 'Klick auf einen Namen, um das Profil zu sehen.'));
    body.appendChild(boardBox());
  } else if (section === 'profile') {
    profileSection();
  } else if (section === 'admin') {
    body.appendChild(head('Admin', 'Spieler verwalten. Jede Aktion wird auf dem Server geprüft und im Protokoll festgehalten.'));
    var abox = el('div', { class: 'msec-box' });
    body.appendChild(abox);
    Admin.render(abox, function () { if (section === 'admin') renderBody(); });
  } else playSection();
}
function render() {
  if (!inner) return;
  if (!sections().some(function (s) { return s.id === section; })) section = 'play';
  inner.innerHTML = '';
  inner.appendChild(topBar());
  if (status) inner.appendChild(el('p', { class: 'menu-status' + (status.charAt(0) === '⚠' ? ' err' : ''), role: 'status', text: status }));
  body = el('main', { class: 'msec' });
  inner.appendChild(body);
  renderBody();
  inner.appendChild(el('p', { class: 'foot', text: 'Chip Empire · Spielgeld ohne Wert, kein echtes Glücksspiel · Alle Figuren sind frei erfunden' }));
}

/* Neue Anfragen, Einladungen oder Ergebnisse: Zähler und den offenen Bereich auffrischen */
Social.onChange(syncNav);
Admin.onChange(function () { if (root && !root.hidden) render(); });
Friends.onChange(function () { syncNav(); if (section === 'friends' && root && !root.hidden && !typing()) renderBody(); });

function show(cb) {
  onStart = cb;
  root = document.getElementById('menu');
  document.getElementById('app').hidden = true;
  document.body.classList.remove('in-game');
  root.hidden = false;
  root.classList.remove('leaving');
  root.innerHTML = '';
  root.appendChild(background());
  inner = el('div', { class: 'menu-inner' });
  root.appendChild(inner);
  view = Store.list().length === 0 && !Store.isBroken() && !Cloud.available() ? 'new' : 'slots';
  render();
  if (Store.isAccount()) run('Gleiche mit der Cloud ab …', function () { return Cloud.syncAll(); });
  loadBoard();
  Social.poll();
  Admin.check();
  clearInterval(pollTimer);
  pollTimer = setInterval(function () { if (!root.hidden) Social.poll(); }, 45000);
}
/* Blendet das Menü aus; wartet die Animation ab, wenn es sichtbar war */
function leave() {
  root = root || document.getElementById('menu');
  clearInterval(pollTimer);
  if (root.hidden) return Promise.resolve();
  root.classList.add('leaving');
  return V.sleep(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300).then(function () { root.hidden = true; root.innerHTML = ''; });
}

return { show: show, leave: leave };
})();
