/* Chip Empire – Icons als Inline-SVG (Linienstil, Farbe über currentColor) */
var Icons = (function () {
'use strict';
function svg(body) {
  return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
}
return {
  slots: svg('<rect x="3" y="5" width="15" height="15" rx="2.5"/><path d="M6 9h9M6 16h9"/><path d="M7.5 11.2h1.8l-1.3 2.6M11.5 11.2h1.8l-1.3 2.6"/><path d="M18 9h1.5a1 1 0 0 1 1 1v3"/><circle cx="20.5" cy="5.5" r="1.5"/><path d="M20.5 7v3"/>'),
  roulette: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.2"/><path d="M12 3v3.8M12 17.2V21M3 12h3.8M17.2 12H21M5.6 5.6l2.7 2.7M15.7 15.7l2.7 2.7M18.4 5.6l-2.7 2.7M8.3 15.7l-2.7 2.7"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>'),
  bj: svg('<rect x="3" y="6" width="11" height="15" rx="1.8" transform="rotate(-8 8.5 13.5)"/><rect x="10" y="3.5" width="11" height="15" rx="1.8" transform="rotate(8 15.5 11)"/><path d="M15.6 8.4l1.6 2.2-1.6 2.2-1.6-2.2z" fill="currentColor"/>'),
  crash: svg('<path d="M3 20c5 0 9-3 12-10"/><path d="M3 20h18M3 20V4"/><path d="M13.5 6.5l4-2 .5 4.4"/><path d="M17.5 4.5c-1 3-1.5 4.5-3 6"/>'),
  wheel: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/><path d="M12 1.5l1.6 2.6h-3.2z" fill="currentColor"/>'),
  dice: svg('<rect x="3" y="7" width="11" height="11" rx="2.2"/><path d="M10.5 4.2l6.6-1.2a2 2 0 0 1 2.3 1.6l1.2 6.6a2 2 0 0 1-1.6 2.3L14 14.3"/><circle cx="6.2" cy="10.2" r=".9" fill="currentColor"/><circle cx="10.8" cy="14.8" r=".9" fill="currentColor"/><circle cx="8.5" cy="12.5" r=".9" fill="currentColor"/><circle cx="16.6" cy="6.4" r=".9" fill="currentColor"/>'),
  ducks: svg('<path d="M4 15c0 3 3 5 8 5s8-2 8-5c0-1.5-1-2.5-2.5-2.5H11"/><path d="M11 12.5c-2 0-3.5-1.6-3.5-3.5S9 5.5 11 5.5s3.5 1.6 3.5 3.5"/><path d="M14.5 8.5l3.5.6-3 1.6"/><circle cx="11.6" cy="8.4" r=".8" fill="currentColor"/>'),
  plinko: svg('<circle cx="12" cy="4" r="1.2" fill="currentColor"/><circle cx="9" cy="8" r="1.2" fill="currentColor"/><circle cx="15" cy="8" r="1.2" fill="currentColor"/><circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/><path d="M3 16h18M3 16v5h18v-5M7.5 16v5M12 16v5M16.5 16v5"/>'),
  tower: svg('<path d="M6 21V8l-1-3h3l1 2h2l1-2h2l1 2h2l1-2h3l-1 3v13z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4M9 11h.01M15 11h.01"/>'),
  poker: svg('<rect x="2.5" y="6" width="7" height="11" rx="1.4"/><rect x="8.5" y="4.5" width="7" height="11" rx="1.4"/><rect x="14.5" y="6" width="7" height="11" rx="1.4"/><path d="M12 8.2l1.3 1.8-1.3 1.8-1.3-1.8z" fill="currentColor"/>'),
  stufen: svg('<path d="M4 18l2-10 4 4 2-6 2 6 4-4 2 10z"/><path d="M4 21h16"/>'),
  profil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.3-6.5 8-6.5s6.8 2.3 8 6.5"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  haus: svg('<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  imperium: svg('<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6M9 11h.01M15 11h.01"/>'),
  talente: svg('<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'),
  quests: svg('<rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5h6v3H9zM8.5 11l1.5 1.5 3-3M8.5 16.5h7"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.3-6.5 8-6.5s6.8 2.3 8 6.5"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  arena: svg('<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>'),
  friends: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.6 6.5-5.6s5.7 2 6.5 5.6"/><path d="M15.5 4.8a3.3 3.3 0 0 1 0 6.4M17.5 14.6c2.1.6 3.5 2.4 4 5.4"/>'),
  ranks: svg('<path d="M8.5 21v-8h7v8M2 21v-5h6.5M15.5 21v-6.5H22V21M1 21h22"/><path d="M12 3l1.1 2.2 2.4.4-1.7 1.7.4 2.4L12 8.6l-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z"/>'),
  crown: svg('<path d="M3 18l2-11 5 5 2-7 2 7 5-5 2 11z" fill="currentColor" stroke="none"/>')
};
})();
