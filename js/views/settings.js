/* Settings tab: edit details, restart, reset bracket, delete. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const S = PSB.store;
  const UI = PSB.ui;
  const C = PSB.components;
  const esc = U.esc;
  const V = (PSB.views = PSB.views || {});

  V.settingsTab = (el, tid, ctx) => {
    function render() {
      const t = S.get(tid);
      if (!t) return;
      const info = M.typeInfo(t);
      const E = PSB.engineFor(t);
      const hasBracket = !!t.bracket;
      const hasResults = hasBracket && E.hasResults(t.bracket);
      const typeHint = hasBracket
        ? 'Locked — reset the bracket to change.'
        : t.participants.length
          ? `Switching removes ${U.plural(t.participants.length, info.unit, info.units)}.`
          : '';

      el.innerHTML = `
        <div class="settings-grid">
          <form class="card" novalidate data-details>
            <div class="card-head"><h2>${PSB.icon('edit')}Tournament details</h2></div>
            <div class="card-body">
              ${PSB.views.form.fields(t, { typeLocked: hasBracket, typeHint })}
              <div class="form-actions">
                <button type="reset" class="btn btn-ghost">Discard changes</button>
                <button type="submit" class="btn btn-primary">${PSB.icon('check')}Save changes</button>
              </div>
            </div>
          </form>
          <section class="card danger-zone">
            <div class="card-head"><h3>${PSB.icon('alert')}Bracket & data</h3></div>
            <div class="danger-item">
              <strong>Restart tournament</strong>
              <p>Clear all scores, keep the draw.</p>
              <button type="button" class="btn btn-danger-ghost" data-restart ${hasResults ? '' : 'disabled'}>${PSB.icon('refresh')}Restart tournament</button>
            </div>
            <div class="danger-item">
              <strong>Reset bracket</strong>
              <p>Delete the bracket and results. ${info.Units} are kept.</p>
              <button type="button" class="btn btn-danger-ghost" data-reset ${hasBracket ? '' : 'disabled'}>${PSB.icon('bracket')}Reset bracket</button>
            </div>
            <div class="danger-item">
              <strong>Delete tournament</strong>
              <button type="button" class="btn btn-danger" data-delete>${PSB.icon('trash')}Delete tournament</button>
            </div>
          </section>
        </div>`;
      PSB.views.form.wire(el.querySelector('[data-details]'));
    }

    el.addEventListener('reset', (e) => {
      if (!e.target.matches('[data-details]')) return;
      e.preventDefault();
      render();
    });

    el.addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-details]');
      if (!form) return;
      e.preventDefault();
      const t = S.get(tid);
      const raw = PSB.views.form.read(form);
      if (t.bracket) {
        raw.type = t.type;
        raw.format = t.format;
        raw.options = t.options;
      }
      const res = M.validateDetails(raw);
      PSB.views.form.showErrors(form, res.errors);
      if (!res.ok) return;

      const typeChanged = res.value.type !== t.type;
      if (typeChanged && t.participants.length) {
        const info = M.typeInfo(t);
        const ok = await UI.confirm({
          title: `Switch to ${M.TYPES[res.value.type].label}?`,
          message: `<p>The ${U.plural(t.participants.length, info.unit, info.units)} in <strong>${esc(t.name)}</strong> will be removed, because ${info.label.toLowerCase()} entries can't be converted automatically.</p>`,
          confirmLabel: `Switch & remove ${info.units}`,
          danger: true,
        });
        if (!ok) return;
      }
      S.update(tid, (tt) => {
        tt.name = res.value.name;
        tt.date = res.value.date;
        tt.format = res.value.format;
        tt.options = res.value.options;
        if (typeChanged) {
          tt.type = res.value.type;
          tt.participants = [];
        }
      });
      UI.toast('Tournament details saved.');
      ctx.refreshHeader();
      render();
    });

    el.addEventListener('click', async (e) => {
      const t = S.get(tid);
      const E = PSB.engineFor(t);
      if (e.target.closest('[data-restart]')) {
        const prog = E.progress(t.bracket);
        const ok = await UI.confirm({
          title: 'Restart tournament?',
          message: `<p>All <strong>${U.plural(prog.played, 'recorded result')}</strong> will be cleared. The draw, seeding and BYEs stay the same.</p><p>This can't be undone.</p>`,
          confirmLabel: 'Clear all results',
          danger: true,
          icon: 'refresh',
        });
        if (!ok) return;
        S.update(tid, (tt) => E.restart(tt.bracket));
        UI.toast('Tournament restarted — all scores cleared.');
        ctx.refreshHeader();
        render();
        return;
      }
      if (e.target.closest('[data-reset]')) {
        const prog = E.progress(t.bracket);
        const ok = await UI.confirm({
          title: 'Reset the bracket?',
          message: `<p>The bracket${prog.played ? ` and <strong>${U.plural(prog.played, 'recorded result')}</strong>` : ''} will be deleted. Your ${M.typeInfo(t).units} are kept so you can edit them and generate a new bracket.</p>`,
          confirmLabel: 'Reset bracket',
          danger: true,
          icon: 'bracket',
        });
        if (!ok) return;
        S.update(tid, (tt) => { tt.bracket = null; });
        UI.toast('Bracket reset. You can now edit entrants and generate again.');
        ctx.go('participants');
        return;
      }
      if (e.target.closest('[data-delete]')) {
        if (await C.deleteTournament(t)) location.hash = '#/tournaments';
      }
    });

    render();
  };
})(window.PSB);
