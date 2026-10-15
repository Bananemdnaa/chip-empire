/* Chip Empire – Online-Konten über Supabase: Login, Spielstände in der Cloud, Bestenliste */
var Cloud = (function () {
'use strict';

var URL = 'https://cpctbxsuzhsrgcvdjqhu.supabase.co';
var KEY = 'sb_publishable_8dTEYoycag2nuR2H5K24zg_cW6fQdEu';
/* Login läuft über Benutzername + Passwort; intern braucht Supabase eine E-Mail-Adresse.
   Die Domain gehört zur eigenen GitHub-Pages-Seite, es werden keine Mails verschickt. */
var MAIL_DOMAIN = 'bananemdnaa.github.io';
var NAME_RE = /^[a-z0-9_-]{3,16}$/;
var PUSH_DELAY = 2500;

var sb = null, user = null, token = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'chip-empire-auth' } });
    sb.auth.onAuthStateChange(function (ev, session) { token = session ? session.access_token : null; });
  }
} catch (e) { sb = null; }

function available() { return !!sb; }
function current() { return user ? { id: user.id, username: (user.user_metadata && user.user_metadata.username) || '' } : null; }

async function init() {
  if (!sb) return null;
  try {
    var r = await sb.auth.getSession();
    var s = r.data && r.data.session;
    user = s ? s.user : null; token = s ? s.access_token : null;
  } catch (e) { user = null; }
  return current();
}

function cleanName(u) { return String(u || '').trim().toLowerCase(); }
function errText(err) {
  var m = (err && (err.message || err.msg)) || String(err);
  if (/already registered|already exists|duplicate|unique/i.test(m)) return 'Diesen Benutzernamen gibt es schon.';
  if (/invalid login credentials/i.test(m)) return 'Benutzername oder Passwort falsch.';
  if (/password should be at least|weak/i.test(m)) return 'Das Passwort ist zu kurz (mindestens 6 Zeichen).';
  if (/email logins are disabled|signups not allowed|provider is not enabled/i.test(m)) return 'Registrierung ist in Supabase noch nicht freigeschaltet (E-Mail-Login aus).';
  if (/email not confirmed/i.test(m)) return 'In Supabase ist „Confirm email“ noch an. Bitte ausschalten.';
  if (/maximal \d/i.test(m)) return 'Du hast schon ' + Store.MAX_SLOTS + ' Spielstände in deinem Konto.';
  if (/database error saving new user/i.test(m)) return 'Dieser Benutzername ist nicht erlaubt.';
  if (/user is banned|banned/i.test(m)) return 'Dieses Konto ist gesperrt.';
  if (/saves_mode_check|violates check constraint/i.test(m)) return 'Für den Imperium-Modus fehlt noch das Datenbank-Update (SQL in Supabase ausführen).';
  if (/failed to fetch|network/i.test(m)) return 'Keine Verbindung zum Server.';
  if (/could not find the (function|table)|schema cache|does not exist/i.test(m)) return 'Die Datenbank ist noch nicht eingerichtet.';
  return m;
}
function check(r) { if (r.error) throw new Error(errText(r.error)); return r.data; }

async function signUp(name, pw) {
  var u = cleanName(name);
  if (!NAME_RE.test(u)) throw new Error('Benutzername: 3 bis 16 Zeichen, nur a–z, 0–9, _ und -.');
  if (Store.badName(u)) throw new Error('Dieser Benutzername ist nicht erlaubt.');
  if (String(pw).length < 6) throw new Error('Das Passwort ist zu kurz (mindestens 6 Zeichen).');
  var data = check(await sb.auth.signUp({ email: u + '@' + MAIL_DOMAIN, password: pw, options: { data: { username: u } } }));
  if (!data.session) throw new Error('Konto angelegt, aber in Supabase ist „Confirm email“ noch an. Bitte ausschalten, dann einloggen.');
  user = data.user; token = data.session.access_token;
  return current();
}
async function signIn(name, pw) {
  var u = cleanName(name);
  var data = check(await sb.auth.signInWithPassword({ email: u + '@' + MAIL_DOMAIN, password: pw }));
  user = data.user; token = data.session.access_token;
  return current();
}
/* Konto endgültig löschen. Zur Sicherheit muss das Passwort stimmen (erneutes Einloggen). */
async function deleteAccount(pw) {
  var a = current();
  if (!a) throw new Error('Nicht eingeloggt.');
  check(await sb.auth.signInWithPassword({ email: a.username + '@' + MAIL_DOMAIN, password: pw }));
  clearTimeout(timer);
  check(await sb.rpc('delete_account'));
  try { await sb.auth.signOut(); } catch (e) { /* das Konto gibt es nicht mehr */ }
  Store.dropAccount(a.id);
  try { localStorage.removeItem('chip-empire-friends-' + a.id); localStorage.removeItem('chip-empire-duel'); } catch (e) { /* */ }
  user = null; token = null;
}
/* Benutzername ändern: Der Server ändert Profil und Login-Adresse, danach die Sitzung auffrischen,
   damit der neue Name auch hier ankommt */
async function changeName(name) {
  var u = cleanName(name);
  if (!NAME_RE.test(u)) throw new Error('Benutzername: 3 bis 16 Zeichen, nur a–z, 0–9, _ und -.');
  if (Store.badName(u)) throw new Error('Dieser Benutzername ist nicht erlaubt.');
  await rpc('change_username', { new_name: u });
  try {
    var r = await sb.auth.refreshSession();
    if (r.data && r.data.session) { user = r.data.session.user; token = r.data.session.access_token; }
  } catch (e) { /* beim nächsten Login ist der neue Name sowieso da */ }
  if (user) user.user_metadata = Object.assign({}, user.user_metadata, { username: u });
  return u;
}
async function signOut() {
  await flush();
  try { await sb.auth.signOut(); } catch (e) { /* trotzdem lokal abmelden */ }
  user = null; token = null;
}

/* ---------- Spielstände ---------- */
function columns(state) {
  var s = Store.summary(state), empire = state && state.mode === 'empire', hard = state && state.mode === 'hardcore';
  /* Im Imperium-Modus zählt der Imperiumswert für die Bestenliste */
  /* Hardcore: Rangliste nach dem höchsten je erreichten Kontostand */
  return { balance: empire ? s.worth : hard ? Math.max(s.balance, Math.round((state && state.peak) || 0)) : s.balance, unlocked: s.unlocked, wagered: s.wagered, play_ms: Math.round(s.playMs) };
}
function rowToSlot(r) {
  var t = Date.parse(r.updated_at) || Date.now();
  return { id: r.id, name: r.name, mode: r.mode, created: Date.parse(r.created_at) || t, updated: t, rev: 1,
    state: r.state || null, sum: Store.summary(r.state), cloud: true, cloudRev: r.rev, dirty: false };
}

/* Gleicht den lokalen Zwischenspeicher mit der Cloud ab. Ungespeicherte lokale Fortschritte werden
   hochgeladen, solange niemand anders den Stand inzwischen verändert hat; sonst gewinnt die Cloud. */
async function syncAll() {
  var rows = check(await sb.from('saves').select('id,name,mode,state,rev,created_at,updated_at').order('updated_at', { ascending: false }));
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], local = Store.get(r.id);
    seen[r.id] = 1;
    if (local && local.dirty && local.cloudRev === r.rev) await push(local.id);
    else Store.upsert(rowToSlot(r));
  }
  Store.list().forEach(function (s) { if (s.cloud && !seen[s.id]) Store.remove(s.id); });
}
async function createSave(name, mode, state) {
  if (Store.badName(name)) { if (!state) throw new Error('Dieser Name ist nicht erlaubt.'); name = 'Spielstand'; }
  var row = { name: name, mode: mode, state: state || null };
  if (state) Object.assign(row, columns(state));
  var r = check(await sb.from('saves').insert(row).select('id,name,mode,state,rev,created_at,updated_at').single());
  var slot = rowToSlot(r);
  Store.upsert(slot);
  return slot;
}
async function deleteSave(id) {
  check(await sb.from('saves').delete().eq('id', id));
  Store.remove(id);
}

/* Hochladen mit Versionsprüfung: Nur wenn die Cloud noch auf unserem Stand ist, sonst Konflikt */
var timer = 0, inflight = null, conflictCb = null, failed = false, leaveBase = null;
function body(slot) {
  return Object.assign({ state: slot.state, name: slot.name, rev: slot.cloudRev + 1 }, columns(slot.state));
}
async function push(id) {
  var slot = Store.get(id);
  if (!slot || !slot.cloud || !slot.dirty || !user) return true;
  var sentRev = slot.rev;
  var r = await sb.from('saves').update(body(slot)).eq('id', id).eq('rev', slot.cloudRev).select('rev');
  if (r.error) { failed = true; return false; }
  failed = false;
  if (!r.data || !r.data.length) {
    /* Hat unser eigener Upload beim Verlassen des Tabs die Revision schon erhöht, ist das kein Konflikt */
    if (leaveBase && leaveBase.id === id && leaveBase.rev === slot.cloudRev) {
      leaveBase = null;
      var cur = check(await sb.from('saves').select('rev').eq('id', id).single());
      if (cur.rev === slot.cloudRev + 1) { Store.patch(id, { cloudRev: cur.rev }); return push(id); }
    }
    if (conflictCb) conflictCb();
    return false;
  }
  var now = Store.get(id);
  Store.patch(id, { cloudRev: r.data[0].rev, dirty: !!now && now.rev !== sentRev });
  return true;
}
function schedule(slot) {
  clearTimeout(timer);
  timer = setTimeout(function () { flush(); }, PUSH_DELAY);
}
async function flush() {
  clearTimeout(timer);
  if (inflight) await inflight;
  var id = Store.active();
  if (!id || !user) return true;
  inflight = push(id).catch(function () { failed = true; return false; });
  var ok = await inflight;
  inflight = null;
  return ok;
}
/* Beim Schließen des Tabs: letzter Stand per keepalive, damit nichts verloren geht */
function flushOnLeave() {
  var id = Store.active(), slot = id && Store.get(id);
  if (!slot || !slot.cloud || !slot.dirty || !token) return;
  var base = slot.cloudRev, sentRev = slot.rev;
  leaveBase = { id: id, rev: base };
  try {
    fetch(URL + '/rest/v1/saves?id=eq.' + encodeURIComponent(id) + '&rev=eq.' + base + '&select=rev', {
      method: 'PATCH', keepalive: true,
      headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body(slot))
    }).then(function (res) { return res.json(); }).then(function (rows) {
      /* Lebt der Tab noch (nur in den Hintergrund gewechselt), Revision übernehmen */
      var cur = Store.get(id);
      if (Array.isArray(rows) && rows.length && cur && cur.cloudRev === base) {
        Store.patch(id, { cloudRev: rows[0].rev, dirty: cur.rev !== sentRev });
        leaveBase = null;
      }
    }).catch(function () { /* der nächste Abgleich klärt es über die Revision */ });
  } catch (e) { /* */ }
}
Store.hooks.put = schedule;

/* ---------- Bestenliste ---------- */
async function leaderboard(n, mode) {
  if (!sb) return [];
  var r = await sb.rpc('leaderboard', { lim: n || 20, md: mode || 'career' });
  /* Alte Datenbank ohne Modus-Parameter: Karriere geht trotzdem */
  if (r.error && (mode || 'career') === 'career') r = await sb.rpc('leaderboard', { lim: n || 20 });
  return check(r) || [];
}

/* Wochenwertung: Gewinn seit Montag, nur Karriere */
async function seasonBoard(n, wk) {
  if (!sb) return [];
  return check(await sb.rpc('season_board', { lim: n || 20, wk: wk })) || [];
}

/* ---------- Nachricht an alle (vom Admin-Panel) ---------- */
var ANN_SEEN = 'chip-empire-ann-seen';
async function announcement() {
  if (!sb) return null;
  try { var r = await sb.rpc('announcement_current'); return (!r.error && r.data && r.data[0]) || null; } catch (e) { return null; }
}
function annSeen(id) { try { return String(localStorage.getItem(ANN_SEEN)) === String(id); } catch (e) { return false; } }
function annMarkSeen(id) { try { localStorage.setItem(ANN_SEEN, String(id)); } catch (e) { /* */ } }

/* ---------- Freunde, Profile, Duelle (Funktionen in der Datenbank) ---------- */
async function rpc(name, args) {
  if (!sb) throw new Error('Keine Verbindung zum Server.');
  return check(await sb.rpc(name, args || {}));
}

return {
  rpc: rpc, announcement: announcement, annSeen: annSeen, annMarkSeen: annMarkSeen,
  available: available, init: init, current: current, signUp: signUp, signIn: signIn, signOut: signOut, changeName: changeName, deleteAccount: deleteAccount,
  syncAll: syncAll, createSave: createSave, deleteSave: deleteSave, flush: flush, flushOnLeave: flushOnLeave, leaderboard: leaderboard, seasonBoard: seasonBoard,
  onConflict: function (cb) { conflictCb = cb; }, hasFailed: function () { return failed; }, NAME_RE: NAME_RE
};
})();
