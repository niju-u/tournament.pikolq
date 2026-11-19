/* Tournament page: header + tabs (Bracket / Participants / Settings). */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const S = PSB.store;
  const C = PSB.components;
  const esc = U.esc;
  const V = (PSB.views = PSB.views || {});

  const TABS = ['bracket', 'participants', 'settings'];

  V.tournament = (root, { id, tab }) => {
    const t0 = S.get(id);
    if (!t0) {
      root.innerHTML = `<div class="page"><div class="card">${C.empty({
        icon: 'search',
        title: 'Tournament not found',
        action: `<a class="btn btn-primary" href="#/tournaments">${PSB.icon('list')}All tournaments</a>`,
      })}</div></div>`;
      return null;
    }
    if (!TABS.includes(tab)) tab = t0.bracket ? 'bracket' : 'participants';

    root.innerHTML = `
      <div class="page-full">
        <section class="page-hero t-hero">
          <span class="orb orb-1" aria-hidden="true"></span><span class="orb orb-2" aria-hidden="true"></span>
          <div class="container">
            <a class="back-link" href="#/tournaments">${PSB.icon('arrowLeft', 'icon-sm')}Tournaments</a>
            <div data-head></div>
          </div>
        </section>
        <div class="container lift t-tabs-wrap" data-tabs></div>
        <div class="page t-page ${tab === 'bracket' ? 'page-wide' : ''}">
          <div data-panel class="tab-panel"></div>
        </div>
      </div>`;

    const hero = root.querySelector('.t-hero');
    const head = root.querySelector('[data-head]');
    const tabsEl = root.querySelector('[data-tabs]');
    const panel = root.querySelector('[data-panel]');
    let first = true;

    const ctx = {
      refreshHeader() {
        const t = S.get(id);
        if (!t) return;
        const info = M.typeInfo(t);
        const status = M.status(t);
        // Entrance animation only on first paint; later refreshes (after scoring) stay still.
        hero.classList.toggle('is-static', !first);
        first = false;
        const tabLink = (key, icon, label, count) => `
          <a class="tab ${tab === key ? 'is-active' : ''}" href="#/t/${encodeURIComponent(id)}/${key}" ${tab === key ? 'aria-current="page"' : ''}>
            ${PSB.icon(icon)}<span class="tab-label">${label}</span>${count !== undefined ? `<span class="tab-count">${count}</span>` : ''}
          </a>`;
        head.innerHTML = `
          <span class="eyebrow">${esc(M.formatLabel(t))}</span>
          <h1>${esc(t.name)}</h1>
          <div class="t-meta">
            <span>${PSB.icon('calendar', 'icon-sm')}${esc(U.formatDate(t.date))}</span>
            <span>${PSB.icon(info.icon, 'icon-sm')}${esc(C.countLabel(t))}</span>
            ${C.typeBadge(t)}
            ${C.statusBadge(status)}
          </div>`;
        tabsEl.innerHTML = `
          <nav class="tabs" aria-label="Tournament sections">
            ${tabLink('bracket', 'bracket', 'Bracket')}
            ${tabLink('participants', info.icon, info.Units, t.participants.length)}
            ${tabLink('settings', 'settings', 'Settings')}
          </nav>`;
        document.title = `${t.name} · Pickleball Tournaments`;
      },
      go(next) {
        location.hash = `#/t/${encodeURIComponent(id)}/${next}`;
      },
    };

    ctx.refreshHeader();
    const renderers = { bracket: V.bracketTab, participants: V.participantsTab, settings: V.settingsTab };
    return renderers[tab](panel, id, ctx) || null;
  };
})(window.PSB);
