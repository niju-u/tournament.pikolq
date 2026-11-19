/* Tournaments list: search, status filters, backup import/export. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const C = PSB.components;
  const S = PSB.store;
  const UI = PSB.ui;
  const V = (PSB.views = PSB.views || {});

  const FILTERS = ['all', 'draft', 'upcoming', 'ongoing', 'completed'];

  V.tournaments = (root) => {
    const state = { q: '', filter: U.pref.get('list-filter', 'all') };
    if (!FILTERS.includes(state.filter)) state.filter = 'all';

    root.innerHTML = `
      <div class="page-full">
      ${C.pageHero({
        eyebrow: 'Manage',
        title: 'All <mark class="hl accent">Tournaments</mark>',
        actions: `<a class="btn btn-accent" href="#/create">${PSB.icon('plus')}Create Tournament</a>`,
      })}
      <div class="page lift">
        <div class="card toolbar">
          <label class="search">
            <span class="sr-only">Search tournaments</span>
            ${PSB.icon('search')}
            <input class="input" type="search" placeholder="Search by tournament or player…" data-search />
          </label>
          <div class="chips" role="group" aria-label="Filter by status" data-filters></div>
          <div class="toolbar-end">
            <button type="button" class="btn btn-ghost btn-sm" data-export>${PSB.icon('download')}Export backup</button>
            <button type="button" class="btn btn-ghost btn-sm" data-import>${PSB.icon('upload')}Import</button>
            <input type="file" accept="application/json,.json" hidden data-file />
          </div>
        </div>
        <div data-results></div>
      </div>
      </div>`;

    const results = root.querySelector('[data-results]');
    const filtersEl = root.querySelector('[data-filters]');

    const matches = (t, q) => {
      if (!q) return true;
      if (t.name.toLowerCase().includes(q)) return true;
      return t.participants.some((p) => (p.team || '').toLowerCase().includes(q) || p.players.some((n) => n.toLowerCase().includes(q)));
    };

    function render() {
      const all = S.all().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt - a.updatedAt);
      const counts = { all: all.length, draft: 0, upcoming: 0, ongoing: 0, completed: 0 };
      all.forEach((t) => counts[M.status(t)]++);

      filtersEl.innerHTML = FILTERS.map((f) => `
        <button type="button" class="chip ${state.filter === f ? 'is-active' : ''}" data-filter="${f}" aria-pressed="${state.filter === f}">
          ${f === 'all' ? 'All' : M.STATUS[f].label}<span class="chip-count">${counts[f]}</span>
        </button>`).join('');

      const q = state.q.trim().toLowerCase();
      const shown = all.filter((t) => (state.filter === 'all' || M.status(t) === state.filter) && matches(t, q));

      if (!all.length) {
        results.innerHTML = `<div class="card">${C.empty({
          icon: 'trophy',
          title: 'No tournaments yet',
          action: `<a class="btn btn-primary" href="#/create">${PSB.icon('plus')}Create Tournament</a>`,
        })}</div>`;
      } else if (!shown.length) {
        results.innerHTML = `<div class="card">${C.empty({
          icon: 'search',
          title: 'No matching tournaments',
          action: `<button type="button" class="btn btn-ghost" data-clear>Clear filters</button>`,
        })}</div>`;
      } else {
        results.innerHTML = `<div class="t-grid">${shown.map((t, i) => C.tournamentCard(t, i)).join('')}</div>`;
      }
    }

    root.querySelector('[data-search]').addEventListener('input', (e) => { state.q = e.target.value; render(); });

    root.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-filter]');
      if (f) {
        state.filter = f.dataset.filter;
        U.pref.set('list-filter', state.filter);
        render();
        return;
      }
      if (e.target.closest('[data-clear]')) {
        state.q = '';
        state.filter = 'all';
        root.querySelector('[data-search]').value = '';
        render();
        return;
      }
      const del = e.target.closest('[data-action="delete"]');
      if (del) {
        const t = S.get(del.dataset.id);
        if (t && (await C.deleteTournament(t))) render();
        return;
      }
      if (e.target.closest('[data-export]')) {
        if (!S.all().length) { UI.toast('There are no tournaments to export yet.', 'info'); return; }
        U.download(`pickleball-tournaments-${U.todayISO()}.json`, S.exportJSON());
        UI.toast('Backup downloaded.');
        return;
      }
      if (e.target.closest('[data-import]')) root.querySelector('[data-file]').click();
    });

    root.querySelector('[data-file]').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      let list;
      try {
        list = S.parseBackup(await file.text());
      } catch (err) {
        UI.toast(err.message, 'error');
        return;
      }
      const existing = new Set(S.all().map((t) => t.id));
      const replacing = list.filter((t) => existing.has(t.id)).length;
      const ok = await UI.confirm({
        title: 'Import tournaments?',
        message: `<p>Import <strong>${U.plural(list.length, 'tournament')}</strong> from <strong>${U.esc(file.name)}</strong>.</p>
          ${replacing ? `<p>${U.plural(replacing, 'tournament')} already exist here and will be replaced by the imported copy.</p>` : ''}`,
        confirmLabel: 'Import',
        icon: 'upload',
      });
      if (!ok) return;
      S.importMany(list);
      UI.toast(`Imported ${U.plural(list.length, 'tournament')}.`);
      render();
    });

    render();
  };
})(window.PSB);
