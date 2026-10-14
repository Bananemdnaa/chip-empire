/* Chip Empire – Spielstände (Slots in localStorage)
   Gast: Spielstände nur in diesem Browser. Mit Konto: derselbe Speicher dient als Zwischenspeicher,
   cloud.js gleicht ihn mit Supabase ab. */
var Store = (function () {
'use strict';

var GUEST = 'chip-empire-saves-v1';
var LEGACY = 'velvet-room-v1';
var ACTIVE = 'chip-empire-active';
var MAX_SLOTS = 3;
var MODES = {
  career: { name: 'Karriere', desc: 'Start mit 1.000 Chips, kein Gratis-Nachschub. Spiele und Räume schaltest du dir nach und nach frei.' },
  empire: { name: 'Imperium', desc: 'Karriere plus Geschäfte: Kauf Läden bis zum eigenen Casino. Sie verdienen auch offline.' },
  sandbox: { name: 'Sandbox', desc: 'Alles offen, unbegrenzt Nachschub. Zum Ausprobieren ohne Druck.' }
};
var ns = GUEST, broken = false;
var hooks = { put: null };

function now() { return Date.now(); }
function uid() { return 's' + now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

/* Liest immer frisch aus dem Speicher, damit parallele Tabs sich nicht gegenseitig fremde Slots überschreiben */
function readNs(key) {
  var raw = null;
  try { raw = localStorage.getItem(key); } catch (e) { return { slots: [] }; }
  if (!raw) return key === GUEST ? migrate() : { slots: [] };
  try {
    var d = JSON.parse(raw);
    if (!d || !Array.isArray(d.slots)) throw new Error('Format');
    return d;
  } catch (e) {
    /* Kaputte Daten nie stillschweigend überschreiben: sichern und Schreiben sperren */
    if (key === ns) broken = true;
    try { localStorage.setItem(key + '-backup-' + now(), raw); } catch (e2) { /* */ }
    return { slots: [] };
  }
}
function readAll() { return readNs(ns); }
function writeAll(d) {
  if (broken) return false;
  try { localStorage.setItem(ns, JSON.stringify(d)); return true; } catch (e) { return false; }
}
function migrate() {
  var d = { slots: [] };
  try {
    var old = localStorage.getItem(LEGACY);
    if (old) {
      var st = JSON.parse(old);
      d.slots.push(makeSlot('Alter Spielstand', 'sandbox', st));
      localStorage.setItem(GUEST, JSON.stringify(d));
    }
  } catch (e) { /* kein alter Stand */ }
  return d;
}

function summary(st) {
  st = st || {};
  return {
    balance: Math.round((st.balance || 0) + (st.escrow || 0)), room: st.room || 0, unlocked: st.unlocked || 0,
    playMs: st.playMs || 0, wagered: Math.round(st.wagered || 0),
    worth: Math.round((st.balance || 0) + (st.escrow || 0) + (st.bizSpent || 0))
  };
}
function makeSlot(name, mode, state) {
  var t = now();
  return { id: uid(), name: name, mode: mode, created: t, updated: t, rev: 1, state: state || null, sum: summary(state) };
}
function find(d, id) { var s = null; d.slots.forEach(function (x) { if (x.id === id) s = x; }); return s; }

function list() {
  return readAll().slots.slice().sort(function (a, b) { return b.updated - a.updated; });
}
function guestList() {
  return readNs(GUEST).slots.slice().sort(function (a, b) { return b.updated - a.updated; });
}
function get(id) { return find(readAll(), id); }
function create(name, mode) {
  var d = readAll();
  if (d.slots.length >= MAX_SLOTS) return null;
  var s = makeSlot(name, MODES[mode] ? mode : 'career', null);
  d.slots.push(s);
  return writeAll(d) ? s : null;
}
/* Speichert den Zustand; gibt die neue lokale Revision zurück, oder 0 bei Fehler */
function put(id, state) {
  var d = readAll(), s = find(d, id);
  if (!s) return 0;
  s.state = state; s.sum = summary(state); s.updated = now(); s.rev = (s.rev || 0) + 1;
  if (s.cloud) s.dirty = true;
  if (!writeAll(d)) return 0;
  if (s.cloud && hooks.put) hooks.put(s);
  return s.rev;
}
/* Für den Cloud-Abgleich: einen Slot komplett ersetzen bzw. Felder setzen */
function upsert(slot) {
  var d = readAll(), i = -1;
  d.slots.forEach(function (x, k) { if (x.id === slot.id) i = k; });
  if (i >= 0) d.slots[i] = slot; else d.slots.push(slot);
  writeAll(d);
}
function patch(id, fields) {
  var d = readAll(), s = find(d, id);
  if (!s) return;
  Object.keys(fields).forEach(function (k) { s[k] = fields[k]; });
  writeAll(d);
}
function remove(id) {
  var d = readAll();
  d.slots = d.slots.filter(function (x) { return x.id !== id; });
  writeAll(d);
}
function removeGuest(id) {
  var d = readNs(GUEST);
  d.slots = d.slots.filter(function (x) { return x.id !== id; });
  try { localStorage.setItem(GUEST, JSON.stringify(d)); } catch (e) { /* */ }
}

/* Welcher Speicher gilt: Gast oder Zwischenspeicher eines Kontos */
function useAccount(userId) { ns = userId ? 'chip-empire-cloud-v1-' + userId : GUEST; broken = false; readAll(); }
/* Zwischenspeicher eines gelöschten Kontos verwerfen */
function dropAccount(userId) { try { localStorage.removeItem('chip-empire-cloud-v1-' + userId); } catch (e) { /* */ } }
function key() { return ns; }
function isAccount() { return ns !== GUEST; }

/* Aktiver Slot gilt pro Tab */
function active() { try { return sessionStorage.getItem(ACTIVE); } catch (e) { return null; } }
function setActive(id) {
  try { if (id) sessionStorage.setItem(ACTIVE, id); else sessionStorage.removeItem(ACTIVE); } catch (e) { /* */ }
}

return {
  MAX_SLOTS: MAX_SLOTS, MODES: MODES, summary: summary, hooks: hooks,
  list: list, guestList: guestList, get: get, create: create, put: put, upsert: upsert, patch: patch,
  remove: remove, removeGuest: removeGuest,
  useAccount: useAccount, dropAccount: dropAccount, key: key, isAccount: isAccount,
  active: active, setActive: setActive, isBroken: function () { return broken; }
};
})();
