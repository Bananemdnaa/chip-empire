/* Chip Empire – Spielstände (mehrere Slots in localStorage, später austauschbar gegen Cloud-Speicher) */
var Store = (function () {
'use strict';

var KEY = 'chip-empire-saves-v1';
var LEGACY = 'velvet-room-v1';
var ACTIVE = 'chip-empire-active';
var MAX_SLOTS = 3;
var MODES = {
  career: { name: 'Karriere', desc: 'Start mit 1.000 Chips, kein Gratis-Nachschub. Spiele und Räume schaltest du dir nach und nach frei.' },
  sandbox: { name: 'Sandbox', desc: 'Alles offen, unbegrenzt Nachschub. Zum Ausprobieren ohne Druck.' }
};
var broken = false;

function now() { return Date.now(); }
function uid() { return 's' + now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

/* Liest immer frisch aus dem Speicher, damit parallele Tabs sich nicht gegenseitig fremde Slots überschreiben */
function readAll() {
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return { slots: [] }; }
  if (!raw) return migrate();
  try {
    var d = JSON.parse(raw);
    if (!d || !Array.isArray(d.slots)) throw new Error('Format');
    return d;
  } catch (e) {
    /* Kaputte Daten nie stillschweigend überschreiben: sichern und Schreiben sperren */
    broken = true;
    try { localStorage.setItem(KEY + '-backup-' + now(), raw); } catch (e2) { /* */ }
    return { slots: [] };
  }
}
function writeAll(d) {
  if (broken) return false;
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
}
function migrate() {
  var d = { slots: [] };
  try {
    var old = localStorage.getItem(LEGACY);
    if (old) {
      var st = JSON.parse(old);
      d.slots.push(makeSlot('Alter Spielstand', 'sandbox', st));
      writeAll(d);
    }
  } catch (e) { /* kein alter Stand */ }
  return d;
}

function summary(st) {
  st = st || {};
  return {
    balance: Math.round(st.balance || 0), room: st.room || 0, unlocked: st.unlocked || 0,
    playMs: st.playMs || 0, wagered: Math.round(st.wagered || 0)
  };
}
function makeSlot(name, mode, state) {
  var t = now();
  return { id: uid(), name: name, mode: mode, created: t, updated: t, rev: 1, state: state || null, sum: summary(state) };
}

function list() {
  return readAll().slots.slice().sort(function (a, b) { return b.updated - a.updated; });
}
function get(id) {
  var s = readAll().slots.filter(function (x) { return x.id === id; });
  return s[0] || null;
}
function create(name, mode) {
  var d = readAll();
  if (d.slots.length >= MAX_SLOTS) return null;
  var s = makeSlot(name, MODES[mode] ? mode : 'career', null);
  d.slots.push(s);
  return writeAll(d) ? s : null;
}
/* Gibt die neue Revision zurück, oder 0, wenn der Slot fehlt oder nicht geschrieben werden konnte */
function put(id, state) {
  var d = readAll(), s = null;
  d.slots.forEach(function (x) { if (x.id === id) s = x; });
  if (!s) return 0;
  s.state = state; s.sum = summary(state); s.updated = now(); s.rev = (s.rev || 0) + 1;
  return writeAll(d) ? s.rev : 0;
}
function remove(id) {
  var d = readAll();
  d.slots = d.slots.filter(function (x) { return x.id !== id; });
  writeAll(d);
}
function rename(id, name) {
  var d = readAll();
  d.slots.forEach(function (x) { if (x.id === id) x.name = name; });
  writeAll(d);
}

/* Aktiver Slot gilt pro Tab */
function active() { try { return sessionStorage.getItem(ACTIVE); } catch (e) { return null; } }
function setActive(id) {
  try { if (id) sessionStorage.setItem(ACTIVE, id); else sessionStorage.removeItem(ACTIVE); } catch (e) { /* */ }
}

return {
  KEY: KEY, MAX_SLOTS: MAX_SLOTS, MODES: MODES,
  list: list, get: get, create: create, put: put, remove: remove, rename: rename,
  active: active, setActive: setActive, isBroken: function () { return broken; }
};
})();
