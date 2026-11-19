/* Participants tab: add / edit / remove / reorder (seed) entrants and generate the bracket. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const engine = (t) => PSB.engineFor(t);
  const S = PSB.store;
  const UI = PSB.ui;
  const C = PSB.components;
  const esc = U.esc;
  const V = (PSB.views = PSB.views || {});

  V.participantsTab = (el, tid, ctx) => {
    const get = () => S.get(tid);
    let dragId = null;

    function rowHtml(t, p, i, locked) {
      const d = t.type === 'doubles';
      const label = M.name(t, p);
      const input = (field, value, placeholder, aria) =>
        `<input class="inline-input" data-field="${field}" value="${esc(value)}" placeholder="${placeholder}" maxlength="${M.NAME_MAX}" aria-label="${esc(aria)}" autocomplete="off" spellcheck="false" />`;
      const fields = d
        ? input('team', p.team, 'Team name (optional)', `Team name for seed ${i + 1}`) +
          input('p0', p.players[0], 'Player 1', `Player 1 of ${label}`) +
          input('p1', p.players[1], 'Player 2', `Player 2 of ${label}`)
        : input('p0', p.players[0], 'Player name', `Name of seed ${i + 1}`);
      const count = t.participants.length;
      return `
        <li class="entrant ${locked ? 'is-locked' : ''}" data-id="${esc(p.id)}">
          <span class="grip" title="Drag to reorder" aria-hidden="true">${PSB.icon('grip')}</span>
          <span class="seed-badge" title="Seed ${i + 1}">${i + 1}</span>
          <div class="entrant-fields ${d ? 'is-doubles' : ''}">${fields}</div>
          <div class="entrant-actions">
            ${locked ? '' : `
              <button type="button" class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(label)} up">${PSB.icon('up')}</button>
              <button type="button" class="icon-btn" data-move="1" ${i === count - 1 ? 'disabled' : ''} aria-label="Move ${esc(label)} down">${PSB.icon('down')}</button>
              <button type="button" class="icon-btn is-danger" data-remove aria-label="Remove ${esc(label)}">${PSB.icon('trash')}</button>`}
          </div>
        </li>`;
    }

    function summaryHtml(t, locked) {
      const info = M.typeInfo(t);
      const n = t.participants.length;
      const E = engine(t);
      const plan = E.plan(n, t.options);
      const genLabel = t.format === 'round-robin' ? 'Generate Schedule' : 'Generate Bracket';
      const rows = `<div class="summary-row"><span>Format</span><strong>${esc(M.formatLabel(t))}</strong></div>` +
        E.planRows(n, t.options).map(([label, value]) => `<div class="summary-row"><span>${label}</span><strong>${value}</strong></div>`).join('');
      let action;
      if (locked) {
        action = `
          <a class="btn btn-primary btn-block" href="#/t/${encodeURIComponent(t.id)}/bracket">${PSB.icon('bracket')}Open bracket</a>
          <p class="summary-note">Names stay editable. <a href="#/t/${encodeURIComponent(t.id)}/settings">Reset bracket</a> to add or remove.</p>`;
      } else if (n < E.MIN_ENTRANTS || (plan && plan.error)) {
        action = `
          <button type="button" class="btn btn-primary btn-block" disabled>${PSB.icon('bracket')}${genLabel}</button>
          <p class="summary-note">${plan && plan.error ? `${esc(plan.error)} <a href="#/t/${encodeURIComponent(t.id)}/settings">Change pools</a>` : `Minimum ${E.MIN_ENTRANTS} ${info.units}.`}</p>`;
      } else {
        action = `
          <button type="button" class="btn btn-primary btn-lg btn-block" data-generate>${PSB.icon('bracket')}${genLabel}</button>
          <p class="summary-note">${t.format === 'round-robin' ? 'List order = seeding — pools are balanced by seed.' : 'List order = seeding.'}</p>`;
      }
      return `
        <div class="card-body">
          <div class="summary-big"><strong>${n}</strong><span>${n === 1 ? info.unit : info.units}</span></div>
          <div class="summary-list">${rows}</div>
          ${action}
        </div>`;
    }

    function addFormHtml(t) {
      const d = t.type === 'doubles';
      if (d) {
        return `
          <form class="add-form is-doubles" novalidate data-add>
            <input class="input add-team" name="team" placeholder="Team name (optional)" maxlength="${M.NAME_MAX}" autocomplete="off" aria-label="Team name (optional)" />
            <input class="input" name="p0" placeholder="Player 1" maxlength="${M.NAME_MAX}" autocomplete="off" aria-label="Player 1" />
            <input class="input" name="p1" placeholder="Player 2" maxlength="${M.NAME_MAX}" autocomplete="off" aria-label="Player 2" />
            <button type="submit" class="btn btn-primary">${PSB.icon('plus')}Add team</button>
            <span class="field-error" data-add-error role="alert"></span>
          </form>`;
      }
      return `
        <form class="add-form" novalidate data-add>
          <input class="input" name="p0" placeholder="Player name" maxlength="${M.NAME_MAX}" autocomplete="off" aria-label="Player name" />
          <button type="submit" class="btn btn-primary">${PSB.icon('plus')}Add player</button>
          <span class="field-error" data-add-error role="alert"></span>
        </form>`;
    }

    function bulkHtml(t) {
      const d = t.type === 'doubles';
      return `
        <details class="bulk">
          <summary>${PSB.icon('right', 'icon-sm')}Add several at once</summary>
          <div class="bulk-body">
            <textarea class="textarea" data-bulk rows="5" placeholder="${d ? 'One team per line, e.g.\nAna Cruz / Ben Reyes\nDink Dynasty: Carla Santos / Dan Lim' : 'One player per line, e.g.\nAna Cruz\nBen Reyes'}"></textarea>
            <div class="bulk-actions">
              <span class="field-hint">${d ? 'Format: Team: Player 1 / Player 2' : 'One per line'}</span>
              <button type="button" class="btn btn-soft btn-sm" data-bulk-add>${PSB.icon('plus')}Add all</button>
            </div>
          </div>
        </details>`;
    }

    function render(opts = {}) {
      const t = get();
      if (!t) return;
      const locked = !!t.bracket;
      const info = M.typeInfo(t);
      const n = t.participants.length;
      const bulkOpen = el.querySelector('.bulk') && el.querySelector('.bulk').open;
      const flip = opts.flip ? U.flip(el.querySelector('.entrant-list'), '.entrant', 'data-id') : null;

      el.innerHTML = `
        <div class="pt-layout">
          <section class="card">
            <header class="card-head">
              <h2>${PSB.icon(info.icon)}${info.Units} <span class="tab-count">${n}</span></h2>
              ${locked ? '' : `
                <div class="bracket-actions">
                  <button type="button" class="btn btn-ghost btn-sm" data-shuffle ${n < 2 ? 'disabled' : ''}>${PSB.icon('shuffle')}Randomize</button>
                  <button type="button" class="btn btn-danger-ghost btn-sm" data-clear ${n ? '' : 'disabled'}>${PSB.icon('trash')}Clear all</button>
                </div>`}
            </header>
            ${locked
              ? `<div class="card-body" style="padding-bottom:0"><div class="notice">${PSB.icon('info')}<div><strong>Bracket generated</strong>Names are editable. Seeding is locked.</div></div></div>`
              : addFormHtml(t) + bulkHtml(t)}
            ${n
              ? `<ol class="entrant-list" data-list>${t.participants.map((p, i) => rowHtml(t, p, i, locked)).join('')}</ol>`
              : C.empty({ icon: info.icon, title: `No ${info.units} yet` })}
          </section>
          <aside class="card pt-summary">${summaryHtml(t, locked)}</aside>
        </div>`;

      if (bulkOpen && el.querySelector('.bulk')) el.querySelector('.bulk').open = true;
      if (flip) flip();
      if (opts.newIds) {
        opts.newIds.forEach((id) => {
          const li = el.querySelector(`.entrant[data-id="${CSS.escape(id)}"]`);
          if (li) li.classList.add('is-new');
        });
      }
      if (opts.focusAdd) {
        const first = el.querySelector('[data-add] input');
        if (first) first.focus();
      }
      if (opts.focusRow) {
        const btn = el.querySelector(`.entrant[data-id="${CSS.escape(opts.focusRow.id)}"] [data-move="${opts.focusRow.dir}"]`);
        if (btn && !btn.disabled) btn.focus();
      }
    }

    /* ---------- Mutations ---------- */
    function move(id, delta) {
      S.update(tid, (t) => {
        const i = t.participants.findIndex((p) => p.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= t.participants.length) return;
        [t.participants[i], t.participants[j]] = [t.participants[j], t.participants[i]];
      });
      render({ flip: true, focusRow: { id, dir: delta } });
    }

    function reorder(id, targetId, after) {
      if (id === targetId) return;
      S.update(tid, (t) => {
        const from = t.participants.findIndex((p) => p.id === id);
        const [item] = t.participants.splice(from, 1);
        let to = t.participants.findIndex((p) => p.id === targetId);
        if (after) to += 1;
        t.participants.splice(to, 0, item);
      });
      render({ flip: true });
    }

    function addFromForm(form) {
      const t = get();
      const errEl = form.querySelector('[data-add-error]');
      if (t.participants.length >= engine(t).MAX_ENTRANTS) {
        errEl.textContent = `A bracket can have up to ${engine(t).MAX_ENTRANTS} ${M.typeInfo(t).units}.`;
        return;
      }
      const input = { team: form.elements.team ? form.elements.team.value : '', players: [form.elements.p0.value, form.elements.p1 ? form.elements.p1.value : ''] };
      const res = M.validateEntrant(t, input);
      U.$$('input', form).forEach((i) => i.classList.remove('is-invalid'));
      if (!res.ok) {
        errEl.textContent = res.error;
        const bad = form.elements[res.field];
        if (bad) { bad.classList.add('is-invalid'); bad.focus(); }
        return;
      }
      const entrant = M.makeEntrant(res.value);
      S.update(tid, (tt) => { tt.participants.push(entrant); });
      ctx.refreshHeader();
      render({ newIds: [entrant.id], focusAdd: true });
      const list = el.querySelector('[data-list]');
      if (list) {
        const li = list.querySelector(`[data-id="${CSS.escape(entrant.id)}"]`);
        if (li) li.scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
      }
    }

    function bulkAdd() {
      const ta = el.querySelector('[data-bulk]');
      const t = get();
      const d = t.type === 'doubles';
      const lines = ta.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) { UI.toast('Type at least one name first.', 'error'); ta.focus(); return; }

      const skipped = [];
      const added = [];
      const { tournament } = S.update(tid, (tt) => {
        lines.forEach((line, idx) => {
          if (tt.participants.length >= engine(tt).MAX_ENTRANTS) { skipped.push(`Line ${idx + 1}: bracket is full`); return; }
          let input;
          if (d) {
            let team = '';
            let rest = line;
            const colon = line.indexOf(':');
            if (colon > -1) { team = line.slice(0, colon); rest = line.slice(colon + 1); }
            const parts = rest.split(/\s*(?:\/|&|\+|,)\s*/).filter(Boolean);
            if (parts.length !== 2) { skipped.push(`Line ${idx + 1}: needs exactly two players`); return; }
            input = { team, players: parts };
          } else {
            input = { players: [line] };
          }
          const res = M.validateEntrant(tt, input);
          if (!res.ok) { skipped.push(`Line ${idx + 1}: ${res.error}`); return; }
          const e = M.makeEntrant(res.value);
          tt.participants.push(e);
          added.push(e.id);
        });
      });
      if (added.length) {
        ctx.refreshHeader();
        render({ newIds: added });
        const nta = el.querySelector('[data-bulk]');
        if (skipped.length && nta) nta.value = lines.filter((_, i) => skipped.some((s) => s.startsWith(`Line ${i + 1}:`))).join('\n');
      }
      const unit = M.typeInfo(tournament);
      if (skipped.length) {
        UI.toast(`Added ${added.length}. Skipped ${skipped.length} — ${skipped[0]}${skipped.length > 1 ? '…' : ''}`, added.length ? 'info' : 'error', 5200);
      } else {
        UI.toast(`Added ${U.plural(added.length, unit.unit, unit.units)}.`);
      }
    }

    function saveInline(inp) {
      const li = inp.closest('.entrant');
      const id = li.dataset.id;
      const t = get();
      const p = M.entrant(t, id);
      if (!p) return;
      const field = inp.dataset.field;
      const original = field === 'team' ? p.team : p.players[Number(field.slice(1))];
      const input = { team: p.team, players: p.players.slice() };
      if (field === 'team') input.team = inp.value;
      else input.players[Number(field.slice(1))] = inp.value;

      const res = M.validateEntrant(t, input, id);
      if (!res.ok) {
        UI.toast(res.error, 'error');
        inp.value = original;
        inp.classList.remove('is-invalid');
        void inp.offsetWidth;
        inp.classList.add('is-invalid');
        setTimeout(() => inp.classList.remove('is-invalid'), 1200);
        return;
      }
      const cleaned = field === 'team' ? res.value.team : res.value.players[Number(field.slice(1))];
      inp.value = cleaned;
      if (cleaned === original) return;
      S.update(tid, (tt) => {
        const e = tt.participants.find((x) => x.id === id);
        e.team = res.value.team;
        e.players = res.value.players;
      });
      inp.classList.remove('is-saved');
      void inp.offsetWidth;
      inp.classList.add('is-saved');
      ctx.refreshHeader();
    }

    async function generate() {
      const t = get();
      for (const p of t.participants) {
        const res = M.validateEntrant(t, p, p.id);
        if (!res.ok) { UI.toast(`Fix ${M.name(t, p)} first: ${res.error}`, 'error'); return; }
      }
      try {
        S.update(tid, (tt) => {
          tt.bracket = engine(tt).generate(tt.participants.map((p) => p.id), { ...tt.options, reset: tt.options.gfReset !== false });
        });
      } catch (err) {
        UI.toast(err.message, 'error');
        return;
      }
      const plan = engine(t).plan(t.participants.length, t.options);
      UI.toast(plan.toast || `Bracket generated — ${plan.size}-slot draw${plan.byes ? ` with ${U.plural(plan.byes, 'BYE')}` : ''}.`);
      ctx.go('bracket');
    }

    /* ---------- Events ---------- */
    el.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-add]');
      if (!form) return;
      e.preventDefault();
      addFromForm(form);
    });

    el.addEventListener('input', (e) => {
      if (e.target.closest('[data-add]')) {
        e.target.classList.remove('is-invalid');
        const err = el.querySelector('[data-add-error]');
        if (err) err.textContent = '';
      }
    });

    el.addEventListener('change', (e) => {
      const inp = e.target.closest('.inline-input');
      if (inp) saveInline(inp);
    });

    el.addEventListener('keydown', (e) => {
      const inp = e.target.closest('.inline-input');
      if (!inp) return;
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') {
        const t = get();
        const p = M.entrant(t, inp.closest('.entrant').dataset.id);
        if (p) inp.value = inp.dataset.field === 'team' ? p.team : p.players[Number(inp.dataset.field.slice(1))];
        e.stopPropagation();
        inp.blur();
      }
    });

    el.addEventListener('click', async (e) => {
      const mv = e.target.closest('[data-move]');
      if (mv) { move(mv.closest('.entrant').dataset.id, Number(mv.dataset.move)); return; }

      const rm = e.target.closest('[data-remove]');
      if (rm) {
        const id = rm.closest('.entrant').dataset.id;
        const t = get();
        const p = M.entrant(t, id);
        const ok = await UI.confirm({
          title: `Remove ${M.typeInfo(t).unit}?`,
          message: `<p><strong>${esc(M.name(t, p))}</strong>${M.sub(t, p) ? ` (${esc(M.sub(t, p))})` : ''} will be removed from this tournament.</p>`,
          confirmLabel: 'Remove',
          danger: true,
          icon: 'trash',
        });
        if (!ok) return;
        S.update(tid, (tt) => { tt.participants = tt.participants.filter((x) => x.id !== id); });
        ctx.refreshHeader();
        render({ flip: true });
        UI.toast(`Removed ${M.name(t, p)}.`);
        return;
      }

      if (e.target.closest('[data-shuffle]')) {
        const before = get().participants.map((p) => p.id).join();
        S.update(tid, (tt) => {
          let next = U.shuffle(tt.participants);
          // Make sure the order visibly changes when it can.
          for (let i = 0; i < 5 && next.map((p) => p.id).join() === before; i++) next = U.shuffle(tt.participants);
          tt.participants = next;
        });
        render({ flip: true });
        UI.toast('Order shuffled — seeds updated.', 'info');
        return;
      }

      if (e.target.closest('[data-clear]')) {
        const t = get();
        const info = M.typeInfo(t);
        const ok = await UI.confirm({
          title: `Remove all ${info.units}?`,
          message: `<p>All ${U.plural(t.participants.length, info.unit, info.units)} will be removed from <strong>${esc(t.name)}</strong>.</p>`,
          confirmLabel: 'Remove all',
          danger: true,
          icon: 'trash',
        });
        if (!ok) return;
        S.update(tid, (tt) => { tt.participants = []; });
        ctx.refreshHeader();
        render({ focusAdd: true });
        return;
      }

      if (e.target.closest('[data-bulk-add]')) { bulkAdd(); return; }
      if (e.target.closest('[data-generate]')) generate();
    });

    /* Drag-and-drop reordering (desktop). Dragging starts only from the grip so
       text inside the name fields can still be selected normally. */
    el.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.grip');
      if (!grip) return;
      const li = grip.closest('.entrant');
      if (li && !li.classList.contains('is-locked')) li.draggable = true;
    });
    el.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.entrant');
      if (!li || !li.draggable) return;
      dragId = li.dataset.id;
      li.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    const clearMarks = () => U.$$('.drop-before, .drop-after', el).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    el.addEventListener('dragover', (e) => {
      if (!dragId) return;
      const li = e.target.closest('.entrant');
      if (!li) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = li.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      clearMarks();
      if (li.dataset.id !== dragId) li.classList.add(after ? 'drop-after' : 'drop-before');
    });
    el.addEventListener('drop', (e) => {
      if (!dragId) return;
      const li = e.target.closest('.entrant');
      e.preventDefault();
      const after = li && li.classList.contains('drop-after');
      const id = dragId;
      dragId = null;
      clearMarks();
      if (li && li.dataset.id !== id) reorder(id, li.dataset.id, after);
    });
    el.addEventListener('dragend', () => {
      dragId = null;
      clearMarks();
      U.$$('.entrant', el).forEach((x) => { x.classList.remove('is-dragging'); x.draggable = false; });
    });

    render();
  };
})(window.PSB);
