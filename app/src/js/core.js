var API = 'http://127.0.0.1:8765',
  CACHE_KEY = 'cytv.cache.v4',
  VERSION = '1.5.1';
var DEFAULTS = {
  dock: ['netflix', 'youtube.leanback.v4', 'amazon', 'com.disney.disneyplus-prod'],
  topbar: [
    { label: 'Inputs', icon: 'inputs', action: 'inputs' },
    { label: 'Live TV', icon: 'tv', action: 'live' },
    { label: 'Settings', icon: 'settings', app: 'com.palm.app.settings' },
  ],
};
/* streaming apps by their title, in the order they fill the dock before you change it (Live TV and other apps go to the grid) */
var STREAMING = [
  /^netflix/i,
  /^youtube(?!.*(kids|music))/i,
  /disney/i,
  /^(hbo\s*)?max$|hbo/i,
  /prime video|^amazon/i,
  /skyshowtime/i,
  /apple\s*tv/i,
  /pickbox/i,
  /^hrti/i,
  /rtl\s*(play|\+)/i,
  /maxtv/i,
  /voyo/i,
  /^plex/i,
];
/* the themes the Theme button offers on this TV (the others stay in the manager app); LG's own Home is always the last choice */
var MENU_THEMES = ['sidebar'];
var PRESETS = [
  { label: 'Inputs', icon: 'inputs', action: 'inputs' },
  { label: 'Settings', icon: 'settings', app: 'com.palm.app.settings' },
  { label: 'Live TV', icon: 'tv', action: 'live' },
];
var ICONS = {
  inputs: '<path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  hdmi: '<path d="M4 8h16v7l-3 3H7l-3-3z"/><path d="M9 11v3M12 11v3M15 11v3"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  radio:
    '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M7 5l11 4"/><circle cx="15.5" cy="15" r="2.6"/><path d="M6.5 13h4M6.5 17h4"/>',
  mode: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5z"/>',
  antenna:
    '<circle cx="12" cy="9" r="1.6"/><path d="M12 11v10M8 21h8"/><path d="M8.6 5.6a4.8 4.8 0 0 0 0 6.8M15.4 5.6a4.8 4.8 0 0 1 0 6.8"/><path d="M5.7 2.7a8.9 8.9 0 0 0 0 12.6M18.3 2.7a8.9 8.9 0 0 1 0 12.6"/>',
  theme:
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.1.2-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
};
function svg(name) {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    (ICONS[name] || ICONS.grid) +
    '</svg>'
  );
}
