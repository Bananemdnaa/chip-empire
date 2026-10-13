/* Velvet Room – Hostessen (fiktive Figuren, als SVG gezeichnet) */
var Art = (function () {
'use strict';

var HOSTESSES = [
  { name: 'Mira', role: 'Empfangsdame', trait: 'herzlich, neugierig',
    skin: '#F0C7A4', shade: '#DDA982', hair: '#2B1912', hairHi: '#5A3A2A', style: 'bob',
    eye: '#5A3A22', lip: '#B5173D', dress: '#0F6E56', dressHi: '#1E9577', jewel: '#E8C77A', bgA: '#3C1822', bgB: '#150810', neck: 'v' },
  { name: 'Sofia', role: 'Cocktail-Hostess', trait: 'verspielt, schlagfertig',
    skin: '#F6D6BC', shade: '#E4B796', hair: '#D7A64A', hairHi: '#F2D283', style: 'wave',
    eye: '#3F7F9F', lip: '#D24A5E', dress: '#B58A3E', dressHi: '#E3C16F', jewel: '#FFF1C8', bgA: '#3A2018', bgB: '#150A08', neck: 'scoop' },
  { name: 'Lena', role: 'Pit-Hostess', trait: 'ruhig, aufmerksam',
    skin: '#EBC09C', shade: '#D49C76', hair: '#8E3A1E', hairHi: '#C2662F', style: 'long',
    eye: '#3D6B4A', lip: '#A31E34', dress: '#17141A', dressHi: '#3A3440', jewel: '#C0C6D0', bgA: '#2C1A28', bgB: '#110810', neck: 'sweet' },
  { name: 'Isabella', role: 'VIP-Hostess', trait: 'elegant, selbstsicher',
    skin: '#C98E66', shade: '#AE7149', hair: '#120C0C', hairHi: '#3A2A2A', style: 'sleek',
    eye: '#2A1A12', lip: '#C0243F', dress: '#C79A3A', dressHi: '#F0D37E', jewel: '#FFF1C8', bgA: '#3A1A1A', bgB: '#150808', neck: 'v' },
  { name: 'Anastasia', role: 'Penthouse-Concierge', trait: 'kühl, charmant',
    skin: '#F8E0CB', shade: '#E8C2A4', hair: '#E4DAC6', hairHi: '#FFFFFF', style: 'updo',
    eye: '#5F86A8', lip: '#A91F3C', dress: '#8E9AAA', dressHi: '#D7DEE8', jewel: '#EAF4FF', bgA: '#1E2230', bgB: '#0B0D14', neck: 'scoop' },
  { name: 'Valentina', role: 'Black-Room-Dame', trait: 'geheimnisvoll, direkt',
    skin: '#E8B995', shade: '#CE946C', hair: '#0C0709', hairHi: '#2E1A22', style: 'curl',
    eye: '#2E1B14', lip: '#D0173F', dress: '#8E0E2B', dressHi: '#D0284A', jewel: '#FFD7DE', bgA: '#3A0B18', bgB: '#10040A', neck: 'sweet' }
];

function esc(s) { return String(s).replace(/[^#a-zA-Z0-9(),. %-]/g, ''); }

function hairBack(h) {
  var c = h.hair, hi = h.hairHi;
  switch (h.style) {
    case 'bob':
      return '<path d="M74 118 C70 70 94 50 122 50 C150 50 172 72 168 118 C168 152 166 176 158 190 L82 190 C74 176 74 150 74 118 Z" fill="' + c + '"/>';
    case 'wave':
      return '<path d="M70 120 C64 66 94 46 122 46 C152 46 178 68 172 122 C172 168 190 196 184 236 C170 246 156 232 152 214 L88 214 C84 232 70 246 56 236 C50 196 70 168 70 120 Z" fill="' + c + '"/>' +
             '<path d="M66 150 C60 190 74 214 70 238" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>' +
             '<path d="M176 150 C182 190 168 214 172 238" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>';
    case 'long':
      return '<path d="M72 120 C66 66 94 48 122 48 C150 48 176 68 170 122 C172 172 184 214 176 250 L64 250 C56 214 70 172 72 120 Z" fill="' + c + '"/>' +
             '<path d="M70 160 C64 200 72 226 68 246" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>';
    case 'sleek':
      return '<path d="M72 118 C68 66 94 48 122 48 C150 48 174 66 170 118 C172 176 180 214 172 256 L68 256 C60 214 70 176 72 118 Z" fill="' + c + '"/>' +
             '<path d="M72 150 C68 200 74 230 70 250" stroke="' + hi + '" stroke-width="2.5" fill="none" opacity=".5" stroke-linecap="round"/>';
    case 'updo':
      return '<ellipse cx="122" cy="42" rx="26" ry="20" fill="' + c + '"/>' +
             '<path d="M118 28 C124 24 132 26 136 32" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>' +
             '<path d="M74 116 C70 70 94 52 122 52 C150 52 172 70 168 116 C168 130 164 138 160 142 L84 142 C78 138 74 130 74 116 Z" fill="' + c + '"/>';
    case 'curl':
      return '<path d="M64 124 C52 84 68 46 100 40 C112 34 134 34 146 40 C178 46 192 84 180 124 C190 156 180 198 160 208 L84 208 C62 198 54 156 64 124 Z" fill="' + c + '"/>' +
             '<circle cx="64" cy="170" r="14" fill="' + c + '"/><circle cx="180" cy="170" r="14" fill="' + c + '"/>' +
             '<circle cx="70" cy="196" r="12" fill="' + c + '"/><circle cx="174" cy="196" r="12" fill="' + c + '"/>' +
             '<path d="M66 130 C60 160 66 184 70 200" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>';
  }
  return '';
}

function hairFront(h) {
  var c = h.hair, hi = h.hairHi;
  switch (h.style) {
    case 'bob':
      return '<path d="M78 116 C74 74 98 56 124 56 C150 58 166 78 162 114 C158 92 146 80 128 76 C110 78 94 92 88 124 C84 128 80 124 78 116 Z" fill="' + c + '"/>' +
             '<path d="M96 70 C110 62 130 62 146 72" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>';
    case 'wave':
      return '<path d="M80 114 C76 72 100 54 124 54 C150 56 166 76 162 112 C160 92 148 76 126 74 C106 74 92 86 86 112 C86 124 82 124 80 114 Z" fill="' + c + '"/>' +
             '<path d="M98 66 C112 60 132 60 148 68" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>';
    case 'long':
      return '<path d="M80 116 C76 70 100 54 124 54 C152 56 168 78 162 116 C158 94 146 80 124 78 C102 80 90 98 90 130 C84 130 80 124 80 116 Z" fill="' + c + '"/>' +
             '<path d="M100 66 C114 60 134 60 150 70" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>';
    case 'sleek':
      return '<path d="M80 118 C76 72 100 54 122 54 C148 54 168 74 164 118 C162 96 144 80 122 78 C100 80 82 98 80 118 Z" fill="' + c + '"/>' +
             '<path d="M122 56 L122 78" stroke="' + hi + '" stroke-width="2" opacity=".5"/>' +
             '<path d="M92 72 C106 62 138 62 152 72" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>';
    case 'updo':
      return '<path d="M80 114 C78 76 100 58 124 58 C148 58 166 76 162 112 C158 92 146 82 126 82 C108 82 92 94 86 116 C84 120 80 120 80 114 Z" fill="' + c + '"/>';
    case 'curl':
      return '<path d="M78 114 C72 70 98 48 124 48 C152 48 172 72 164 114 C162 92 150 76 130 72 C112 70 96 84 90 110 C88 118 80 122 78 114 Z" fill="' + c + '"/>' +
             '<circle cx="98" cy="62" r="11" fill="' + c + '"/><circle cx="124" cy="52" r="12" fill="' + c + '"/><circle cx="150" cy="62" r="11" fill="' + c + '"/>' +
             '<path d="M100 56 C112 48 136 48 148 56" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>';
  }
  return '';
}

function portrait(i, uid) {
  var h = HOSTESSES[i % HOSTESSES.length];
  var id = 'h' + i + (uid || '');
  var skin = esc(h.skin), shade = esc(h.shade), dress = esc(h.dress), dressHi = esc(h.dressHi), jewel = esc(h.jewel);
  var nl = { v: 'C96 242 110 258 120 270 C130 258 144 242 152 228',
             scoop: 'C90 246 106 258 120 258 C134 258 150 246 152 228',
             sweet: 'C92 240 108 242 120 256 C132 242 148 240 152 228' }[h.neck];
  var silhouette = 'M10 300 L10 272 C14 240 50 228 84 221 L156 221 C190 228 226 240 230 272 L230 300 Z';
  var dressBody = 'M10 300 L10 272 C14 247 40 239 62 237 L88 228 ' + nl + ' L178 237 C200 239 226 247 230 272 L230 300 Z';
  var svg = '';
  svg += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300" role="img" aria-label="' + esc(h.name) + ', ' + esc(h.role) + '">';
  svg += '<defs>';
  svg += '<radialGradient id="bg' + id + '" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="' + esc(h.bgA) + '"/><stop offset="1" stop-color="' + esc(h.bgB) + '"/></radialGradient>';
  svg += '<linearGradient id="dr' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + dressHi + '"/><stop offset=".55" stop-color="' + dress + '"/><stop offset="1" stop-color="' + dress + '" stop-opacity=".82"/></linearGradient>';
  svg += '<linearGradient id="sk' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + skin + '"/><stop offset="1" stop-color="' + shade + '"/></linearGradient>';
  svg += '</defs>';
  svg += '<rect width="240" height="300" fill="url(#bg' + id + ')"/>';
  // Art-Deco-Faecher im Hintergrund
  svg += '<g fill="none" stroke="' + jewel + '" stroke-opacity=".14" stroke-width="1.2">';
  svg += '<path d="M120 300 L10 120 M120 300 L50 60 M120 300 L120 30 M120 300 L190 60 M120 300 L230 120"/>';
  svg += '<circle cx="120" cy="150" r="104"/><circle cx="120" cy="150" r="124"/>';
  svg += '</g>';
  svg += hairBack(h);
  // Haut: Koerper, Hals
  svg += '<path d="' + silhouette + '" fill="url(#sk' + id + ')"/>';
  svg += '<path d="M102 160 L102 214 C102 226 138 226 138 214 L138 160 Z" fill="url(#sk' + id + ')"/>';
  svg += '<path d="M103 196 C112 208 128 208 137 196 L137 216 C128 224 112 224 103 216 Z" fill="' + shade + '" opacity=".4"/>';
  // Kleid
  svg += '<path d="' + dressBody + '" fill="url(#dr' + id + ')"/>';
  svg += '<path d="M88 228 ' + nl + '" fill="none" stroke="' + dressHi + '" stroke-width="2.2" stroke-opacity=".85" stroke-linecap="round"/>';
  svg += '<path d="M10 272 C14 247 40 239 62 237" stroke="' + dressHi + '" stroke-opacity=".5" stroke-width="2" fill="none"/>';
  svg += '<path d="M230 272 C226 247 200 239 178 237" stroke="' + dressHi + '" stroke-opacity=".3" stroke-width="2" fill="none"/>';
  // Kette
  svg += '<path d="M99 212 C106 238 134 238 141 212" fill="none" stroke="' + jewel + '" stroke-width="1.6" stroke-opacity=".9"/>';
  svg += '<path d="M120 232 L115 240 L120 248 L125 240 Z" fill="' + jewel + '"/><path d="M120 232 L115 240 L125 240 Z" fill="#fff" opacity=".45"/>';
  // Ohren
  svg += '<ellipse cx="82" cy="122" rx="5" ry="9" fill="' + skin + '"/><ellipse cx="158" cy="122" rx="5" ry="9" fill="' + skin + '"/>';
  // Gesicht
  svg += '<path d="M82 112 C82 80 98 64 120 64 C142 64 158 80 158 112 C158 144 142 172 120 174 C98 172 82 144 82 112 Z" fill="url(#sk' + id + ')"/>';
  svg += '<path d="M90 150 C98 168 110 174 120 174 C130 174 142 168 150 150 C144 164 132 172 120 172 C108 172 96 164 90 150 Z" fill="' + shade + '" opacity=".35"/>';
  // Augenpartie
  svg += '<ellipse cx="104" cy="111" rx="12" ry="7" fill="' + shade + '" opacity=".28"/><ellipse cx="136" cy="111" rx="12" ry="7" fill="' + shade + '" opacity=".28"/>';
  svg += '<path d="M93 112 Q104 103 115 112 Q104 119 93 112 Z" fill="#fff"/><path d="M125 112 Q136 103 147 112 Q136 119 125 112 Z" fill="#fff"/>';
  svg += '<circle cx="104" cy="111.5" r="5" fill="' + esc(h.eye) + '"/><circle cx="136" cy="111.5" r="5" fill="' + esc(h.eye) + '"/>';
  svg += '<circle cx="104" cy="111.5" r="2.3" fill="#0a0506"/><circle cx="136" cy="111.5" r="2.3" fill="#0a0506"/>';
  svg += '<circle cx="106" cy="109.6" r="1.4" fill="#fff"/><circle cx="138" cy="109.6" r="1.4" fill="#fff"/>';
  svg += '<path d="M92 112.5 Q104 102 116 112.5" fill="none" stroke="#120A0A" stroke-width="2.4" stroke-linecap="round"/>';
  svg += '<path d="M124 112.5 Q136 102 148 112.5" fill="none" stroke="#120A0A" stroke-width="2.4" stroke-linecap="round"/>';
  svg += '<path d="M92 112.5 L88 109.5 M148 112.5 L152 109.5" stroke="#120A0A" stroke-width="2" stroke-linecap="round"/>';
  svg += '<path d="M95 119 Q104 123 113 119 M127 119 Q136 123 145 119" fill="none" stroke="' + shade + '" stroke-width="1.1" opacity=".7"/>';
  // Brauen
  svg += '<path d="M92 99 Q104 91 117 97" fill="none" stroke="' + esc(h.hair) + '" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>';
  svg += '<path d="M123 97 Q136 91 148 99" fill="none" stroke="' + esc(h.hair) + '" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>';
  // Nase
  svg += '<path d="M120 112 C118 124 116 130 114 134 C117 138 123 138 126 134" fill="none" stroke="' + shade + '" stroke-width="1.5" stroke-linecap="round"/>';
  svg += '<ellipse cx="120" cy="127" rx="3" ry="6" fill="#fff" opacity=".12"/>';
  // Wangen
  svg += '<ellipse cx="97" cy="136" rx="10" ry="6" fill="#E9707F" opacity=".22"/><ellipse cx="143" cy="136" rx="10" ry="6" fill="#E9707F" opacity=".22"/>';
  // Lippen
  svg += '<path d="M105 149 Q112 142 120 145.5 Q128 142 135 149 Q120 153.5 105 149 Z" fill="' + esc(h.lip) + '"/>';
  svg += '<path d="M105 149 Q120 163 135 149 Q120 153 105 149 Z" fill="' + esc(h.lip) + '"/>';
  svg += '<path d="M110 154 Q120 159 130 154" fill="none" stroke="#fff" stroke-width="1.6" opacity=".28" stroke-linecap="round"/>';
  svg += '<path d="M105 149 Q120 153.5 135 149" fill="none" stroke="#000" stroke-width="1" opacity=".3"/>';
  svg += hairFront(h);
  // Ohrringe
  svg += '<circle cx="82" cy="134" r="3.6" fill="' + jewel + '"/><path d="M82 137 L82 146" stroke="' + jewel + '" stroke-width="1.4"/><circle cx="82" cy="149" r="3.2" fill="' + jewel + '"/>';
  svg += '<circle cx="158" cy="134" r="3.6" fill="' + jewel + '"/><path d="M158 137 L158 146" stroke="' + jewel + '" stroke-width="1.4"/><circle cx="158" cy="149" r="3.2" fill="' + jewel + '"/>';
  svg += '</svg>';
  return svg;
}

return { HOSTESSES: HOSTESSES, portrait: portrait };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Art;
