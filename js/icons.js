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
  stufen: svg('<path d="M4 18l2-10 4 4 2-6 2 6 4-4 2 10z"/><path d="M4 21h16"/>'),
  profil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.3-6.5 8-6.5s6.8 2.3 8 6.5"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  haus: svg('<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.3-6.5 8-6.5s6.8 2.3 8 6.5"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  crown: svg('<path d="M3 18l2-11 5 5 2-7 2 7 5-5 2 11z" fill="currentColor" stroke="none"/>')
};
})();
