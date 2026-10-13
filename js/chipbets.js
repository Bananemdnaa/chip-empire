/* Chip Empire – Gemeinsamer Chip-Tisch für Spiele mit mehreren Wettfeldern (Glücksrad, Würfel, Entenrennen).
   Setzen bucht die Chips sofort ab (rückerstattbar), erst beim Start der Runde werden sie gebunden. */
V.chipBets = function (opts) {
  'use strict';
  var el = V.el, fmt = V.fmt;
  var bets = {}, stack = [], last = {}, locked = false;
  var chipsRow, totalEl, btns = {};

  function sum(o) { var t = 0; for (var k in o) t += o[k]; return t; }
  function total() { return sum(bets); }

  function place(key, amt) {
    var S = V.S, r = V.room();
    amt = amt || S.rchip;
    if (locked) return false;
    if (S.balance < amt) { V.needChips(); return false; }
    if ((bets[key] || 0) + amt > r.max) { V.toast('Tischlimit pro Feld: ' + fmt(r.max), 'bad'); return false; }
    V.debit(amt);
    bets[key] = (bets[key] || 0) + amt;
    stack.push([{ key: key, amount: amt }]);
    V.Snd.chip(); V.hud(); render();
    return true;
  }
  function undo() {
    if (locked || !stack.length) return;
    var back = 0;
    stack.pop().forEach(function (x) { bets[x.key] -= x.amount; back += x.amount; if (bets[x.key] <= 0) delete bets[x.key]; });
    V.refund(back); V.Snd.click(); V.hud(); render();
  }
  function clear() {
    if (locked) return;
    var t = total();
    if (t > 0) V.refund(t);
    bets = {}; stack = [];
    V.hud(); render();
  }
  function rebet() {
    if (locked || total() > 0 || sum(last) <= 0) return;
    var r = V.room(), t = sum(last);
    for (var k in last) if (last[k] > r.max) { V.toast('Die letzte Wette passt nicht zu den Limits dieses Raums.', 'bad'); return; }
    if (V.S.balance < t) { V.needChips(); return; }
    V.debit(t);
    bets = Object.assign({}, last);
    stack = [Object.keys(last).map(function (k) { return { key: k, amount: last[k] }; })];
    V.Snd.chip(); V.hud(); render();
  }
  function dbl() {
    if (locked) return;
    var t = total(), r = V.room();
    if (t <= 0) return;
    for (var k in bets) if (bets[k] * 2 > r.max) { V.toast('Tischlimit pro Feld: ' + fmt(r.max), 'bad'); return; }
    if (V.S.balance < t) { V.needChips(); return; }
    V.debit(t);
    var g = [];
    for (var k2 in bets) { g.push({ key: k2, amount: bets[k2] }); bets[k2] *= 2; }
    stack.push(g);
    V.Snd.chip(); V.hud(); render();
  }
  /* Runde starten: Einsatz binden und merken; gibt die Wetten zurück */
  function commit() {
    var t = total();
    if (t <= 0) { V.toast('Setz zuerst Chips.', 'bad'); return null; }
    if (t < V.room().min) { V.toast('Mindesteinsatz in diesem Raum: ' + fmt(V.room().min), 'bad'); return null; }
    locked = true; last = Object.assign({}, bets);
    V.lock(t); render();
    return Object.assign({}, bets);
  }
  /* Nach der Abrechnung: Tisch leeren */
  function reset() { bets = {}; stack = []; locked = false; render(); }

  function renderChips() {
    var S = V.S, list = V.chipList();
    if (list.indexOf(S.rchip) < 0) S.rchip = list[0];
    chipsRow.innerHTML = '';
    list.forEach(function (v) {
      chipsRow.appendChild(el('button', { class: 'chip c' + String(v).length, type: 'button', 'aria-pressed': String(v === S.rchip), text: V.short(v), 'aria-label': 'Chip ' + fmt(v),
        disabled: locked, onclick: function () { S.rchip = v; V.Snd.click(); renderChips(); V.save(); } }));
    });
  }
  function stepChip(dir) {
    if (locked) return;
    var S = V.S, list = V.chipList(), i = list.indexOf(S.rchip);
    S.rchip = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i) + dir))];
    V.Snd.click(); renderChips(); V.save();
  }
  function render() {
    if (!totalEl) return;
    var t = total();
    totalEl.textContent = 'Auf dem Tisch: ' + fmt(t);
    btns.undo.disabled = locked || !stack.length;
    btns.clear.disabled = locked || t <= 0;
    btns.rebet.disabled = locked || t > 0 || sum(last) <= 0;
    btns.dbl.disabled = locked || t <= 0;
    renderChips();
    if (opts && opts.onRender) opts.onRender(bets, locked);
  }
  /* Bedienleiste: Chipwahl und Tisch-Knöpfe */
  function controls() {
    chipsRow = el('div', { class: 'chips', role: 'group', 'aria-label': 'Chipwert' });
    btns.undo = el('button', { class: 'btn ghost sm', type: 'button', onclick: undo }, 'Zurück', V.kbd('⌫'));
    btns.clear = el('button', { class: 'btn ghost sm', type: 'button', onclick: clear }, 'Leeren', V.kbd('L'));
    btns.rebet = el('button', { class: 'btn ghost sm', type: 'button', onclick: rebet }, 'Wiederholen', V.kbd('W'));
    btns.dbl = el('button', { class: 'btn ghost sm', type: 'button', onclick: dbl }, 'Verdoppeln', V.kbd('D'));
    totalEl = el('span', { class: 'rtotal' });
    var box = el('div', { class: 'cb-ctl' },
      el('div', { class: 'rrow' }, el('span', { class: 'lbl', text: 'Chip' }), chipsRow),
      el('div', { class: 'rrow' }, btns.undo, btns.clear, btns.rebet, btns.dbl, totalEl));
    render();
    return box;
  }
  /* Gemeinsame Tasten; true = verarbeitet */
  function onKey(k) {
    if (k === 'backspace') { undo(); return true; }
    if (k === 'l') { clear(); return true; }
    if (k === 'w') { rebet(); return true; }
    if (k === 'd') { dbl(); return true; }
    if (k === 'arrowleft' || k === 'arrowright') { stepChip(k === 'arrowright' ? 1 : -1); return true; }
    return false;
  }
  var KEYS = [['← / →', 'Chipwert wählen'], ['⌫', 'Letzten Einsatz zurück'], ['L', 'Tisch leeren'], ['W', 'Letzte Wette wiederholen'], ['D', 'Einsätze verdoppeln']];

  return {
    place: place, undo: undo, clear: clear, rebet: rebet, dbl: dbl, commit: commit, reset: reset,
    total: total, bets: function () { return bets; }, isLocked: function () { return locked; },
    controls: controls, render: render, onKey: onKey, KEYS: KEYS
  };
};
