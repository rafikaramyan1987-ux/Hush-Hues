/** Inline SVG icons (drawn for this game). */
const wrap = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  undo: wrap('<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-3"/>'),
  restart: wrap('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/>'),
  home: wrap('<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/>'),
  back: wrap('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  soundOn: wrap('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: wrap('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z"/><path d="m16 9.5 5 5m0-5-5 5"/>'),
  gear: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>'),
  tube: wrap('<path d="M8.5 3.5h7M9.5 3.5v13a2.5 2.5 0 0 0 5 0v-13"/><path d="M19 7v6M16 10h6"/>'),
  levels: wrap('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/></svg>',
  ad: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3.5" fill="currentColor"/><path d="M10 9v6l5-3Z" fill="#fff"/></svg>',
  lock: wrap('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 3.2 4.8 5.4 4.8 10.2A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.2-3.6 2.3-4.6.1 1.6.8 2.7 1.8 3.2C11 9.4 11.3 6 12 3Z" fill="currentColor"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4C9 4 5 9 5 14.5c0 1.5.4 2.8 1 3.9C8 13 11.5 10.5 15 9c-3.2 2-6 5.3-7.3 10A6.8 6.8 0 0 0 11 20c6 0 8-6.5 8-16Z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.2 6L12 16.9 6.5 19.8l1.2-6-4.5-4.2 6.1-.8Z" fill="currentColor"/></svg>',
} as const;

/** Title logo: three soft pebbles resting in a glass, drawn in code. */
export const LOGO = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <radialGradient id="lg-a" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffd0c8"/><stop offset=".5" stop-color="#f2685e"/><stop offset="1" stop-color="#c94a43"/></radialGradient>
    <radialGradient id="lg-b" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#d4ebff"/><stop offset=".5" stop-color="#4ea3f2"/><stop offset="1" stop-color="#2f78c0"/></radialGradient>
    <radialGradient id="lg-c" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff1c4"/><stop offset=".5" stop-color="#f6c445"/><stop offset="1" stop-color="#cf9a1f"/></radialGradient>
  </defs>
  <rect x="38" y="10" width="44" height="100" rx="22" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.7)" stroke-width="3"/>
  <circle cx="60" cy="88" r="16" fill="url(#lg-a)"/>
  <circle cx="60" cy="56" r="16" fill="url(#lg-b)"/>
  <circle cx="60" cy="24" r="12" fill="url(#lg-c)" opacity=".9"/>
  <path d="M46 30v58" stroke="rgba(255,255,255,.45)" stroke-width="3" stroke-linecap="round"/>
</svg>`;

/** Padlock drawn on locked tubes (the keyhole dot shows the colour that opens it). */
export const LOCK_SVG =
  '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
