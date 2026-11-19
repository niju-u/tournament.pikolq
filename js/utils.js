/* Small shared helpers. Everything hangs off one global namespace (PSB)
   so the site runs from plain <script> tags with no build step. */
window.PSB = window.PSB || {};

(function (PSB) {
  'use strict';

  const U = (PSB.util = {});

  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.uid = (prefix = 'id') =>
    prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);

  /** Trim and collapse inner whitespace. */
  U.clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();

  U.clone = (obj) => JSON.parse(JSON.stringify(obj));

  U.todayISO = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  U.isValidISODate = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  };

  U.formatDate = (iso, opts) => {
    if (!U.isValidISODate(iso)) return 'No date set';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, opts || {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  U.plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  U.reducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Read/write small per-browser UI preferences without ever throwing. */
  U.pref = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('psb-pref:' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('psb-pref:' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  /**
   * FLIP helper: call before a DOM update to remember positions, then call the
   * returned function after the update to animate elements from old to new spots.
   */
  U.flip = (container, selector, keyAttr) => {
    if (!container || U.reducedMotion()) return () => {};
    const before = new Map();
    U.$$(selector, container).forEach((el) => before.set(el.getAttribute(keyAttr), el.getBoundingClientRect()));
    return () => {
      U.$$(selector, container).forEach((el) => {
        const prev = before.get(el.getAttribute(keyAttr));
        if (!prev) return;
        const now = el.getBoundingClientRect();
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (!dx && !dy) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
      });
    };
  };

  U.download = (filename, text, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})(window.PSB);
