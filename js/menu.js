/* Chip Empire – Hauptmenü: Spielstände wählen, anlegen, löschen */
var Menu = (function () {
'use strict';
var el = V.el, fmt = V.fmt, E = V.E;
var root, onStart, creating = false, confirmDel = null, newMode = 'career';

function when(t) {
  var d = new Date(t), today = new Date();
  var hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return 'heute ' + hm;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + hm;
}

function slotCard(s) {
  var m = Store.MODES[s.mode] || Store.MODES.career, sum = s.sum || {};
  var tier = E.TIERS[Math.min(5, sum.unlocked || 0)];
  var actions;
  if (confirmDel === s.id) {
    actions = el('div', { class: 'slot-act' },
      el('span', { class: 'confirm-txt', text: 'Wirklich löschen?' }),
      el('button', { class: 'btn crimson sm', type: 'button', text: 'Ja, löschen', onclick: function () { Store.remove(s.id); confirmDel = null; render(); } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Abbrechen', onclick: function () { confirmDel = null; render(); } }));
  } else {
    actions = el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold', type: 'button', text: s.state ? 'Weiterspielen' : 'Starten', onclick: function () { V.Snd.click(); onStart(s.id); } }),
      el('button', { class: 'btn ghost sm', type: 'button', text: 'Löschen', 'aria-label': 'Spielstand ' + s.name + ' löschen', onclick: function () { confirmDel = s.id; render(); } }));
  }
  return el('article', { class: 'slot' },
    el('div', { class: 'slot-h' }, el('b', { class: 'slot-name', text: s.name }), el('span', { class: 'tag' + (s.mode === 'career' ? ' gold' : ''), text: m.name })),
    el('div', { class: 'slot-bal num', text: fmt(sum.balance || 0) + ' Chips' }),
    el('div', { class: 'slot-k' },
      el('span', { text: s.mode === 'career' ? 'Stufe: ' + tier.name : 'Alle Räume offen' }),
      el('span', { text: 'Spielzeit ' + V.clock(sum.playMs || 0) }),
      el('span', { text: 'Zuletzt ' + when(s.updated) })),
    actions);
}

function newForm() {
  var input = el('input', { class: 'name-in', type: 'text', maxlength: '20', placeholder: 'z.B. Felix', 'aria-label': 'Name des Spielstands', autocomplete: 'off' });
  var modes = el('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Spielmodus' });
  Object.keys(Store.MODES).forEach(function (k) {
    var M = Store.MODES[k];
    modes.appendChild(el('button', { class: 'mode', type: 'button', role: 'radio', 'aria-checked': String(newMode === k),
      onclick: function () { newMode = k; V.Snd.click(); $$('.mode', modes).forEach(function (b) { b.setAttribute('aria-checked', String(b === this)); }, this); } },
      el('b', { text: M.name }), el('span', { text: M.desc })));
  });
  function go() {
    var name = input.value.trim().replace(/\s+/g, ' ').slice(0, 20) || 'Spielstand ' + (Store.list().length + 1);
    var s = Store.create(name, newMode);
    if (!s) { V.toast('Spielstand konnte nicht angelegt werden.', 'bad'); return; }
    creating = false;
    onStart(s.id);
  }
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  var form = el('section', { class: 'newgame' },
    el('h2', { text: 'Neues Spiel' }),
    el('label', { class: 'lbl', text: 'Name' }), input,
    el('div', { class: 'lbl', text: 'Modus' }), modes,
    el('div', { class: 'slot-act' },
      el('button', { class: 'btn gold big', type: 'button', text: 'Los geht’s', onclick: go }),
      el('button', { class: 'btn ghost', type: 'button', text: 'Abbrechen', onclick: function () { creating = false; render(); } })));
  setTimeout(function () { input.focus(); }, 0);
  return form;
}
function $$(s, r) { return Array.prototype.slice.call(r.querySelectorAll(s)); }

function render() {
  root.innerHTML = '';
  var slots = Store.list();
  root.appendChild(el('header', { class: 'menu-top' },
    el('h1', { class: 'menu-logo', text: 'Chip Empire' }),
    el('p', { class: 'menu-sub', text: 'Vom Lobby-Gast zur Legende im Black Room.' })));
  if (Store.isBroken()) {
    root.appendChild(el('p', { class: 'menu-warn', text: 'Deine Spielstände konnten nicht gelesen werden. Eine Sicherung liegt im Browser-Speicher, es wird nichts überschrieben.' }));
  }
  if (creating) { root.appendChild(newForm()); return; }
  var grid = el('section', { class: 'slots', 'aria-label': 'Spielstände' });
  slots.forEach(function (s) { grid.appendChild(slotCard(s)); });
  if (slots.length < Store.MAX_SLOTS && !Store.isBroken()) {
    grid.appendChild(el('button', { class: 'slot empty', type: 'button', onclick: function () { creating = true; newMode = 'career'; V.Snd.click(); render(); } },
      el('span', { class: 'plus', text: '+' }), el('b', { text: 'Neues Spiel' }), el('span', { text: 'Freier Platz ' + (slots.length + 1) + ' von ' + Store.MAX_SLOTS })));
  }
  root.appendChild(grid);
  root.appendChild(el('p', { class: 'fine menu-note', text: 'Spielstände werden in diesem Browser gespeichert. Ein anderes Gerät, ein anderer Browser oder der private Modus sehen sie nicht.' }));
  root.appendChild(el('footer', { class: 'foot', text: 'Chip Empire · Spielgeld ohne Wert, kein echtes Glücksspiel · Alle Figuren sind frei erfunden' }));
}

function show(cb) {
  onStart = cb;
  root = document.getElementById('menu');
  document.getElementById('app').hidden = true;
  root.hidden = false;
  creating = Store.list().length === 0 && !Store.isBroken();
  render();
}
function hide() { if (root) root.hidden = true; else document.getElementById('menu').hidden = true; }

return { show: show, hide: hide };
})();
