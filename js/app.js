/* Hash router and app bootstrap. Routes:
   #/                      Dashboard
   #/tournaments           Tournament list
   #/create                Create tournament
   #/t/:id/:tab            Tournament (bracket | participants | settings) */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const V = PSB.views;
  const main = document.getElementById('main');
  let cleanup = null;
  let lastKey = null;

  function parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return { name: 'dashboard' };
    if (parts[0] === 'tournaments') return { name: 'tournaments' };
    if (parts[0] === 'create') return { name: 'create' };
    if (parts[0] === 't' && parts[1]) return { name: 'tournament', id: parts[1], tab: parts[2] };
    return { name: 'notfound' };
  }

  function setActiveNav(name) {
    U.$$('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === name || (name === 'tournament' && a.dataset.nav === 'tournaments');
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------- Mobile menu (hamburger) ---------- */
  const header = document.querySelector('.app-header');
  const nav = document.getElementById('main-nav');
  const toggle = document.querySelector('.nav-toggle');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !e.target.closest('.app-header')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); });
  window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });

  function route() {
    const r = parse();
    setMenu(false);
    PSB.ui.closeAll();
    PSB.champion.close();
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;

    setActiveNav(r.name);
    document.title = 'Pickleball Tournaments';
    // Pixel wipe only when the page itself changes; tab switches inside a
    // tournament and re-renders after an external change just cross-fade.
    const key = r.name === 'tournament' ? `t:${r.id}` : r.name;
    const wipe = lastKey !== null && key !== lastKey;
    lastKey = key;
    PSB.motion.transition(() => render(r), { wipe });
  }

  function render(r) {
    switch (r.name) {
      case 'dashboard': V.dashboard(main); break;
      case 'tournaments': V.tournaments(main); document.title = 'All Tournaments · Pickleball Tournaments'; break;
      case 'create': V.create(main); document.title = 'Create Tournament · Pickleball Tournaments'; break;
      case 'tournament': cleanup = V.tournament(main, r); break;
      default:
        main.innerHTML = `<div class="page"><div class="card">${PSB.components.empty({
          icon: 'search', title: 'Page not found', text: 'That page does not exist.',
          action: `<a class="btn btn-primary" href="#/">${PSB.icon('home')}Back to dashboard</a>`,
        })}</div></div>`;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    PSB.motion.refresh(main);
  }

  /* ---------- Light / dark theme ----------
     The <head> script sets data-theme before first paint; this keeps the toggle,
     the browser chrome colour and the saved choice in step. */
  const THEME_KEY = 'psb-theme';
  const html = document.documentElement;
  const themeBtn = document.querySelector('[data-theme-toggle]');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyTheme(theme) {
    const dark = theme === 'dark';
    html.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#1E1626' : '#F7F4FA');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(dark));
      themeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }
  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode: lasts this visit */ }
    });
  }

  // Footer: current year and back-to-top.
  U.$$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  const topBtn = document.querySelector('[data-back-to-top]');
  if (topBtn) {
    topBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
      main.focus({ preventScroll: true });
    });
  }

  // Inject nav icons once.
  U.$$('[data-icon]').forEach((el) => { el.innerHTML = PSB.icon(el.dataset.icon); });

  window.addEventListener('hashchange', route);
  PSB.store.onExternalChange(() => {
    // Another tab changed data: re-render unless the user is mid-dialog.
    if (!document.querySelector('.modal-backdrop, .champ-overlay')) route();
  });

  if (!PSB.store.isAvailable()) {
    PSB.ui.toast('Browser storage is unavailable — changes will not be saved after you close this page.', 'error', 7000);
  }
  route();
})(window.PSB);
