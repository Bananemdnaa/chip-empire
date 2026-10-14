/* Chip Empire – Hauptmenü (Titelbildschirm): Konto, Spielstände, Bestenliste */
var Menu = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var root, inner, onStart, view = 'slots', confirmDel = null, newMode = 'career';
var status = '', busy = false, board = null, boardErr = '', boardMode = 'career';
var CHIP_COLORS = ['#8E0E2B', '#1E5E8E', '#1A1418', '#5B2A8E', '#C79A3A', '#0F6A4A'];

function when(t) {
  var d = new Date(t), today = new Date();
  var hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return 'heute ' + hm;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + hm;
}
function $$(s, r) { return Array.prototype.slice.call(r.querySelectorAll(s)); }
function account() { return Store.isAccount() ? Cloud.current() : null; }
function icon(name) { return el('span', { class: 'ic', html: Icons[name] }); }
function chipImg(cls) { return el('img', { class: cls || '', src: 'favicon.svg', alt: '' }); }

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

/* ---------- Konto ---------- */
function accountPill() {
  var a = account();
  if (!Cloud.available()) return el('div', { class: 'acct-pill' }, el('span', { class: 'avatar guest-av', html: Icons.user }), el('span', { class: 'lbl', text: 'Offline · Gast' }));
  if (a) {
    return el('div', { class: 'acct-pill' },
      el('span', { class: 'avatar', text: a.username.charAt(0) }), el('b', { text: a.username }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abmelden', disabled: busy, onclick: function () {
        run('Melde ab …', async function () { await Cloud.signOut(); Store.useAccount(null); view = 'slots'; loadBoard(); });
      } }));
  }
  return el('div', { class: 'acct-pill' },
    el('span', { class: 'avatar guest-av', html: Icons.user }), el('span', { class: 'lbl', text: 'Gast' }),
    view === 'login' ? null : el('button', { class: 'btn gold sm', type: 'button', text: 'Einloggen', onclick: function () { view = 'login'; status = ''; V.Snd.click(); render(); } }));
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
      loadBoard();
    });
  }
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go('in'); });
  setTimeout(function () { name.focus(); }, 0);
  return el('section', { class: 'panel' },
    el('h2', { text: 'Dein Konto' }),
    el('p', { class: 'fine', text: 'Mit Konto liegen deine Spielstände online, laufen auf jedem Gerät und du kommst in die Bestenliste. Keine E-Mail nötig. Merk dir dein Passwort gut, zurücksetzen geht nicht.' }),
    name, pw,
    el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold', type: 'button', text: 'Einloggen', disabled: busy, onclick: function () { go('in'); } }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Neues Konto erstellen', disabled: busy, onclick: function () { go('up'); } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Zurück', onclick: function () { view = 'slots'; status = ''; render(); } })),
    el('p', { class: 'fine', text: 'Benutzername: 3 bis 16 Zeichen, nur a–z, 0–9, _ und -.' }));
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
  return el('section', { class: 'panel' },
    el('h2', { text: 'Neues Spiel' }),
    el('label', { class: 'lbl', text: 'Name deines Imperiums' }), input,
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

/* ---------- Bestenliste mit Treppchen ---------- */
function boardBox() {
  if (!Cloud.available()) return null;
  var box = el('section', { class: 'board', 'aria-label': 'Bestenliste' }, el('h3', { class: 'menu-h', text: 'Bestenliste' }));
  var seg = el('div', { class: 'qseg board-seg', role: 'tablist' });
  [['career', 'Karriere'], ['empire', 'Imperium'], ['duel', 'Duelle']].forEach(function (x) {
    seg.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(boardMode === x[0]), text: x[1],
      onclick: function () { if (boardMode === x[0]) return; boardMode = x[0]; board = null; boardErr = ''; V.Snd.click(); render(); loadBoard(); } }));
  });
  box.appendChild(seg);
  if (boardErr) { box.appendChild(el('p', { class: 'fine', text: boardErr })); return arenaBtn(box); }
  if (!board) { box.appendChild(el('p', { class: 'fine', text: 'Lade …' })); return box; }
  if (!board.length) { box.appendChild(el('p', { class: 'fine', text: boardMode === 'duel' ? 'Noch niemand hat ein Duell beendet. Fordere jemanden in der Arena heraus.' : 'Noch niemand hier. Leg einen ' + (boardMode === 'empire' ? 'Imperium' : 'Karriere') + '-Spielstand mit Konto an und sei die Nummer 1.' })); return arenaBtn(box); }
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
  box.appendChild(el('p', { class: 'fine', text: boardMode === 'duel' ? 'Elo-Wertung aus Crash-Duellen. Der Kontostand spielt keine Rolle.' : boardMode === 'empire' ? 'Imperium-Spielstände nach Imperiumswert (Chips plus Geschäfte).' : 'Karriere-Spielstände nach Chips.' }));
  return arenaBtn(box);
}
/* Mit Konto: Arena mit Duellen und Freunden direkt aus dem Menü */
function arenaBtn(box) {
  if (account()) box.appendChild(el('button', { class: 'btn gold arena-btn', type: 'button', onclick: function () { V.Snd.click(); Social.open(); } },
    el('span', { class: 'ic', html: Icons.arena }), 'Arena: Duelle und Freunde'));
  return box;
}
function loadBoard() {
  if (!Cloud.available()) return;
  var mode = boardMode;
  var req = mode === 'duel'
    ? Cloud.rpc('duel_board', { lim: 20 }).then(function (rows) { return (rows || []).map(function (r) { return Object.assign({ balance: r.rating }, r); }); })
    : Cloud.leaderboard(20, mode);
  req.then(function (rows) { if (mode !== boardMode) return; board = rows; boardErr = ''; render(); })
    .catch(function (e) { if (mode !== boardMode) return; boardErr = mode !== 'career' ? 'Diese Bestenliste braucht noch das Datenbank-Update.' : 'Bestenliste nicht verfügbar: ' + (e.message || e); render(); });
}

/* ---------- Aufbau ---------- */
function render() {
  if (!inner) return;
  inner.innerHTML = '';
  inner.appendChild(el('div', { class: 'menu-bar' }, accountPill()));
  inner.appendChild(el('header', { class: 'menu-hero' },
    el('img', { class: 'hero-chip', src: 'favicon.svg', alt: '' }),
    el('h1', { class: 'menu-logo', 'data-text': 'Chip Empire', text: 'Chip Empire' }),
    el('p', { class: 'menu-sub', text: 'Vom Lobby-Gast zur Legende im Black Room' })));
  if (status) inner.appendChild(el('p', { class: 'menu-status' + (status.charAt(0) === '⚠' ? ' err' : ''), role: 'status', text: status }));
  if (Store.isBroken()) {
    inner.appendChild(el('p', { class: 'menu-warn', text: 'Deine Spielstände konnten nicht gelesen werden. Eine Sicherung liegt im Browser-Speicher, es wird nichts überschrieben.' }));
  }
  if (view === 'login') { inner.appendChild(loginForm()); return; }
  if (view === 'new') { inner.appendChild(newForm()); return; }

  var slots = Store.list();
  var grid = el('div', { class: 'slots' });
  slots.forEach(function (s) { grid.appendChild(vipCard(s)); });
  if (slots.length < Store.MAX_SLOTS && !Store.isBroken()) {
    grid.appendChild(el('button', { class: 'slot-new', type: 'button', disabled: busy, onclick: function () { view = 'new'; newMode = 'career'; V.Snd.click(); render(); } },
      el('span', { class: 'plus', text: '+' }), el('b', { text: 'Neues Spiel' }), el('span', { text: 'Platz ' + (slots.length + 1) + ' von ' + Store.MAX_SLOTS })));
  }
  var left = el('section', { 'aria-label': 'Spielstände' }, el('h2', { class: 'menu-h', text: account() ? 'Deine Spielstände' : 'Spielstände auf diesem Gerät' }), grid);
  if (account()) { var gi = guestImport(slots.length >= Store.MAX_SLOTS); if (gi) left.appendChild(gi); }
  var bb = boardBox();
  inner.appendChild(el('div', { class: 'menu-grid' }, left, bb || el('div')));
  inner.appendChild(el('p', { class: 'fine menu-note', text: account()
    ? 'Deine Spielstände liegen online in deinem Konto und funktionieren auf jedem Gerät.'
    : 'Gast-Spielstände liegen nur in diesem Browser. Mit Konto spielst du auf jedem Gerät weiter.' }));
  inner.appendChild(el('p', { class: 'foot', text: 'Chip Empire · Spielgeld ohne Wert, kein echtes Glücksspiel · Alle Figuren sind frei erfunden' }));
}

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
}
/* Blendet das Menü aus; wartet die Animation ab, wenn es sichtbar war */
function leave() {
  root = root || document.getElementById('menu');
  if (root.hidden) return Promise.resolve();
  root.classList.add('leaving');
  return V.sleep(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300).then(function () { root.hidden = true; root.innerHTML = ''; });
}

return { show: show, leave: leave };
})();
