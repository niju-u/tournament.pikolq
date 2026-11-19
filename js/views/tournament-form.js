/* Tournament details form (shared by Create and Settings) and the Create page. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const S = PSB.store;
  const UI = PSB.ui;
  const esc = U.esc;
  const V = (PSB.views = PSB.views || {});
  const F = (V.form = {});

  /** Render the fields. opts.typeLocked disables Singles/Doubles with a reason. */
  F.fields = (values, opts = {}) => {
    const v = { name: '', date: U.todayISO(), type: 'singles', format: 'single-elim', options: { gfReset: true }, ...values };
    const o = M.normalizeOptions(v.options);
    const gfReset = o.gfReset;
    const dis = opts.typeLocked ? 'disabled' : '';
    const sel = (cur, val) => (cur === val ? 'selected' : '');
    const rr = v.format === 'round-robin';
    const typeChoice = (key) => {
      const info = M.TYPES[key];
      const desc = key === 'singles' ? '1 player' : '2 players per team';
      return `
        <label class="choice">
          <input type="radio" name="type" value="${key}" ${v.type === key ? 'checked' : ''} ${opts.typeLocked ? 'disabled' : ''} />
          <span class="choice-card">
            <span class="choice-icon">${PSB.icon(info.icon)}</span>
            <span><span class="choice-title">${info.label}</span><span class="choice-desc">${desc}</span></span>
          </span>
        </label>`;
    };
    const formatChoice = (key) => {
      const f = M.FORMATS[key];
      return `
        <label class="choice">
          <input type="radio" name="format" value="${key}" ${v.format === key ? 'checked' : ''} ${opts.typeLocked ? 'disabled' : ''} />
          <span class="choice-card">
            <span class="choice-icon">${PSB.icon(f.icon)}</span>
            <span><span class="choice-title">${f.label}</span><span class="choice-desc">${f.desc}</span></span>
          </span>
        </label>`;
    };

    return `
      <div class="form-grid">
        <label class="field">
          <span class="field-label">Tournament name</span>
          <input class="input" name="name" type="text" maxlength="${M.TITLE_MAX}" value="${esc(v.name)}" placeholder="e.g. Balay Summer Open 2026" autocomplete="off" required />
          <span class="field-error" data-error="name"></span>
        </label>
        <div class="field date-field" data-datepicker>
          <span class="field-label" id="date-label">Tournament date</span>
          <input type="hidden" name="date" value="${esc(v.date)}" />
          <div class="date-anchor">
            <button type="button" class="input date-btn" data-date-btn aria-labelledby="date-label date-value">
              ${PSB.datePicker.buttonInner(v.date)}
            </button>
          </div>
          <span class="field-error" data-error="date"></span>
        </div>
        <fieldset class="field" style="border:0;padding:0;margin:0">
          <legend class="field-label" style="margin-bottom:6px">Tournament type</legend>
          <div class="choice-grid">${typeChoice('singles')}${typeChoice('doubles')}</div>
          ${opts.typeHint ? `<span class="field-hint">${opts.typeHint}</span>` : ''}
          <span class="field-error" data-error="type"></span>
        </fieldset>
        <fieldset class="field" style="border:0;padding:0;margin:0">
          <legend class="field-label" style="margin-bottom:6px">Format</legend>
          <div class="choice-grid">${Object.keys(M.FORMATS).filter((k) => M.FORMATS[k].available).map(formatChoice).join('')}</div>
          ${opts.typeLocked ? '<span class="field-hint">Locked — reset the bracket to change.</span>' : ''}
          <div class="rr-options" data-rr-options ${rr ? '' : 'hidden'}>
            <label class="field">
              <span class="field-label">Pools</span>
              <select class="select" name="rrPools" ${dis}>
                ${Array.from({ length: PSB.roundRobinEngine.MAX_POOLS }, (_, i) => i + 1).map((n) => `<option value="${n}" ${sel(o.pools, n)}>${n === 1 ? '1 pool — everyone plays everyone' : `${n} pools`}</option>`).join('')}
              </select>
            </label>
            <label class="field">
              <span class="field-label">Advance to playoffs</span>
              <select class="select" name="rrAdvance" ${dis}>
                <option value="0" ${sel(o.advance, 0)}>No playoffs — best record wins</option>
                ${[1, 2, 3, 4].map((n) => `<option value="${n}" ${sel(o.advance, n)}>Top ${n} from each pool</option>`).join('')}
              </select>
            </label>
            <label class="field" data-rr-playoff>
              <span class="field-label">Playoff format</span>
              <select class="select" name="rrPlayoff" ${dis}>
                <option value="single-elim" ${sel(o.playoff, 'single-elim')}>Single elimination</option>
                <option value="double-elim" ${sel(o.playoff, 'double-elim')}>Double elimination</option>
              </select>
            </label>
            <span class="field-hint rr-hint">Players are split into balanced pools by seed. Ties are broken by head-to-head, then point difference, then points scored.</span>
          </div>
          <label class="switch-row" data-reset-option ${v.format === 'double-elim' || (rr && o.advance > 0 && o.playoff === 'double-elim') ? '' : 'hidden'}>
            <input type="checkbox" name="gfReset" ${gfReset ? 'checked' : ''} ${opts.typeLocked ? 'disabled' : ''} />
            <span class="switch" aria-hidden="true"></span>
            <span><span class="choice-title">Grand Final reset</span>
            <span class="choice-desc">Play a deciding match if the unbeaten side loses</span></span>
          </label>
          <span class="field-error" data-error="format"></span>
        </fieldset>
      </div>`;
  };

  F.read = (form) => ({
    name: form.elements.name.value,
    date: form.elements.date.value,
    type: (form.querySelector('input[name="type"]:checked') || {}).value,
    format: (form.querySelector('input[name="format"]:checked') || {}).value,
    options: {
      gfReset: !!(form.elements.gfReset && form.elements.gfReset.checked),
      pools: form.elements.rrPools ? Number(form.elements.rrPools.value) : 1,
      advance: form.elements.rrAdvance ? Number(form.elements.rrAdvance.value) : 0,
      playoff: form.elements.rrPlayoff ? form.elements.rrPlayoff.value : 'single-elim',
    },
  });

  /** Show round-robin options and the Grand Final reset only where they apply. */
  F.wire = (form) => {
    const sync = () => {
      const fmt = (form.querySelector('input[name="format"]:checked') || {}).value;
      const rr = fmt === 'round-robin';
      const adv = form.elements.rrAdvance ? Number(form.elements.rrAdvance.value) : 0;
      const pools = form.elements.rrPools ? Number(form.elements.rrPools.value) : 1;
      const playoff = form.elements.rrPlayoff ? form.elements.rrPlayoff.value : 'single-elim';
      const box = form.querySelector('[data-rr-options]');
      if (box) box.hidden = !rr;
      const po = form.querySelector('[data-rr-playoff]');
      if (po) po.hidden = adv === 0 || pools * adv < 2;
      // Several pools always need a playoff to find one champion.
      const none = form.elements.rrAdvance && form.elements.rrAdvance.querySelector('option[value="0"]');
      if (none) {
        none.disabled = pools > 1;
        if (pools > 1 && adv === 0) { form.elements.rrAdvance.value = '1'; return sync(); }
      }
      const opt = form.querySelector('[data-reset-option]');
      if (opt) opt.hidden = !(fmt === 'double-elim' || (rr && adv > 0 && pools * adv >= 4 && playoff === 'double-elim'));
    };
    form.addEventListener('change', (e) => {
      if (['format', 'rrPools', 'rrAdvance', 'rrPlayoff'].includes(e.target.name)) sync();
    });
    form.addEventListener('reset', () => setTimeout(sync, 0));
    sync();
    PSB.datePicker.enhance(form);
  };

  F.showErrors = (form, errors) => {
    U.$$('[data-error]', form).forEach((el) => { el.textContent = errors[el.dataset.error] || ''; });
    // The date is a hidden input behind the picker button: mark and focus the button.
    const control = (n) => (n === 'date' ? form.querySelector('[data-date-btn]') || form.elements.date : form.elements[n]);
    ['name', 'date'].forEach((n) => control(n).classList.toggle('is-invalid', !!errors[n]));
    const first = ['name', 'date'].find((n) => errors[n]);
    if (first) control(first).focus();
  };

  /* ---------- Create page ---------- */
  V.create = (root) => {
    root.innerHTML = `
      <div class="page-full">
      ${PSB.components.pageHero({
        back: `<a class="back-link" href="#/">${PSB.icon('arrowLeft', 'icon-sm')}Dashboard</a>`,
        eyebrow: 'New tournament',
        title: 'Create a <mark class="hl accent">Tournament</mark>',
      })}
      <div class="page lift">
        <div class="create-single">
          <form class="card card-body" novalidate data-create>
            ${F.fields({})}
            <div class="form-actions">
              <a class="btn btn-ghost" href="#/">Cancel</a>
              <button type="submit" class="btn btn-primary">${PSB.icon('arrowRight')}Create & add entrants</button>
            </div>
          </form>
        </div>
      </div>
      </div>`;

    const form = root.querySelector('[data-create]');
    F.wire(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = M.validateDetails(F.read(form));
      F.showErrors(form, res.errors);
      if (!res.ok) return;
      const t = S.create(res.value);
      UI.toast(`“${t.name}” created. Now add your ${M.typeInfo(t).units}.`);
      location.hash = `#/t/${encodeURIComponent(t.id)}/participants`;
    });
    form.addEventListener('input', (e) => {
      if (e.target.name === 'name' || e.target.name === 'date') {
        e.target.classList.remove('is-invalid');
        const err = form.querySelector(`[data-error="${e.target.name}"]`);
        if (err) err.textContent = '';
      }
    });
    requestAnimationFrame(() => form.elements.name.focus());
  };
})(window.PSB);
