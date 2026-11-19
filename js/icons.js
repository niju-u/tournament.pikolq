/* Inline SVG icon set (stroke icons, 24px grid). */
(function (PSB) {
  'use strict';

  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="8" y="8" width="8" height="8"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    bracket: '<path d="M3 5h5v6H3M3 13h5v6H3"/><path d="M8 8h4v8H8"/><path d="M12 12h5"/><circle cx="19.5" cy="12" r="2.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z"/>',
    flag: '<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    columns: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/>',
    expand: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>',
    rows: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/>',
    paddle: '<rect x="5" y="2.5" width="11" height="13" rx="5" transform="rotate(30 10.5 9)"/><path d="m13 15 4.5 6"/><circle cx="19" cy="6" r="2"/>',
  };

  /** Return an inline SVG string. */
  PSB.icon = function (name, cls = '') {
    const body = P[name] || P.info;
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  };

  /** Branded trophy illustration (gold cup on a plum base). */
  PSB.trophySVG = function (cls = '') {
    return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tg-cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FBE59A"/><stop offset="0.5" stop-color="#F2C94C"/><stop offset="1" stop-color="#D9A93A"/>
        </linearGradient>
        <linearGradient id="tg-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8F72A5"/><stop offset="1" stop-color="#5C4369"/>
        </linearGradient>
      </defs>
      <path d="M34 26H18v8c0 12 9 20 20 21" fill="none" stroke="#D9A93A" stroke-width="6" stroke-linecap="round"/>
      <path d="M86 26h16v8c0 12-9 20-20 21" fill="none" stroke="#D9A93A" stroke-width="6" stroke-linecap="round"/>
      <path d="M32 16h56v26c0 17-12.5 30-28 30S32 59 32 42Z" fill="url(#tg-cup)"/>
      <path d="M41 22v18c0 9 5 16 12 19" fill="none" stroke="#FFF6D6" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
      <rect x="54" y="71" width="12" height="14" rx="2" fill="#D9A93A"/>
      <path d="M44 85h32l4 10H40Z" fill="#E7BB4E"/>
      <rect x="34" y="94" width="52" height="14" rx="4" fill="url(#tg-base)"/>
      <rect x="48" y="98" width="24" height="6" rx="2" fill="#E5D8ED" opacity="0.9"/>
      <circle cx="60" cy="38" r="9" fill="#FFF6D6" opacity="0.9"/>
      <circle cx="57" cy="35" r="1.4" fill="#D9A93A"/><circle cx="63" cy="35" r="1.4" fill="#D9A93A"/>
      <circle cx="60" cy="40" r="1.4" fill="#D9A93A"/><circle cx="56" cy="41" r="1.2" fill="#D9A93A"/><circle cx="64" cy="41" r="1.2" fill="#D9A93A"/>
    </svg>`;
  };
})(window.PSB);
