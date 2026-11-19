/* Pixel-style date picker.
   The browser's own date pop-up can't be styled, so the form uses a button that
   opens this calendar instead. The value lives in a hidden <input name="date">
   as YYYY-MM-DD, so reading and validating the form is unchanged.

   Markup (from the tournament form):
     <div data-datepicker>
       <input type="hidden" name="date" value="2026-11-19" />
       <button type="button" class="input date-btn" data-date-btn>…</button>
     </div>

   Keyboard: arrows move a day/week, PageUp/PageDown change month (Shift: year),
   Home/End jump to the start/end of the week, Enter/Space pick, Esc closes. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const esc = U.esc;
  const DP = (PSB.datePicker = {});
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => {
    if (!U.isValidISODate(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  /** Same day in another month, clamped (Jan 31 + 1 month → Feb 28/29). */
  const addMonths = (d, n) => {
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
  };

  const label = (value) => (U.isValidISODate(value)
    ? U.formatDate(value, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Choose a date');

  /** Button contents for a value (also used by the form's initial render). */
  DP.buttonInner = (value) => `
    <span class="date-btn-text" id="date-value">${esc(label(value))}</span>
    <span class="date-btn-icon" aria-hidden="true">${PSB.icon('calendar')}</span>`;

  /** Wire every [data-datepicker] inside root. Safe to call again after a re-render. */
  DP.enhance = (root) => {
    U.$$('[data-datepicker]', root).forEach((wrap) => {
      if (wrap.dataset.dpReady) return;
      wrap.dataset.dpReady = '1';
      setup(wrap);
    });
  };

  function setup(wrap) {
    const input = wrap.querySelector('input[type="hidden"]');
    const btn = wrap.querySelector('[data-date-btn]');
    const popId = U.uid('dp');
    let pop = null;
    let view = null;   // first day of the month on show
    let focus = null;  // day with keyboard focus

    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', popId);

    const setValue = (d) => {
      input.value = iso(d);
      btn.innerHTML = DP.buttonInner(input.value);
      btn.classList.remove('is-invalid');
      // Let the form's own listeners (clearing errors) see the change.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    function grid() {
      const first = new Date(view.getFullYear(), view.getMonth(), 1);
      const start = addDays(first, -first.getDay());
      const selected = parse(input.value);
      const today = new Date();
      let rows = '';
      for (let w = 0; w < 6; w++) {
        let cells = '';
        for (let i = 0; i < 7; i++) {
          const d = addDays(start, w * 7 + i);
          const out = d.getMonth() !== view.getMonth();
          const sel = sameDay(d, selected);
          const cls = ['dp-day', out ? 'is-out' : '', sel ? 'is-selected' : '', sameDay(d, today) ? 'is-today' : ''].join(' ');
          const name = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          cells += `<td role="gridcell" aria-selected="${sel}">
            <button type="button" class="${cls}" data-day="${iso(d)}" tabindex="${sameDay(d, focus) ? 0 : -1}" aria-label="${esc(name)}${sameDay(d, today) ? ', today' : ''}">${d.getDate()}</button></td>`;
        }
        rows += `<tr>${cells}</tr>`;
      }
      return rows;
    }

    function draw(keepFocus) {
      // Month in the pixel font; the year in a plain font (pixel digits blur 0/2/8).
      const title = `${esc(view.toLocaleDateString(undefined, { month: 'long' }))} <span class="dp-year">${view.getFullYear()}</span>`;
      pop.innerHTML = `
        <div class="dp-head">
          <button type="button" class="dp-nav" data-step="-1" aria-label="Previous month">${PSB.icon('left')}</button>
          <span class="dp-title" id="${popId}-title" aria-live="polite">${title}</span>
          <button type="button" class="dp-nav" data-step="1" aria-label="Next month">${PSB.icon('right')}</button>
        </div>
        <table class="dp-grid" role="grid" aria-labelledby="${popId}-title">
          <thead><tr>${DAYS.map((d) => `<th scope="col" abbr="${d}">${d}</th>`).join('')}</tr></thead>
          <tbody>${grid()}</tbody>
        </table>
        <div class="dp-foot">
          <button type="button" class="dp-link" data-today>Today</button>
          <button type="button" class="dp-link" data-close>Close</button>
        </div>`;
      if (keepFocus) {
        const f = pop.querySelector(`[data-day="${iso(focus)}"]`);
        if (f) f.focus();
      }
    }

    const moveFocus = (d) => {
      focus = d;
      const inView = d.getMonth() === view.getMonth() && d.getFullYear() === view.getFullYear();
      if (!inView) view = new Date(d.getFullYear(), d.getMonth(), 1);
      draw(true);
    };

    function open() {
      if (pop) return;
      const selected = parse(input.value) || new Date();
      focus = selected;
      view = new Date(selected.getFullYear(), selected.getMonth(), 1);
      pop = document.createElement('div');
      pop.className = 'dp-pop';
      pop.id = popId;
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-modal', 'false');
      pop.setAttribute('aria-label', 'Choose tournament date');
      btn.parentElement.appendChild(pop); // the .date-anchor right around the button
      btn.setAttribute('aria-expanded', 'true');
      wrap.classList.add('is-open');
      draw(true);
      // Open upwards if there isn't room below.
      const r = pop.getBoundingClientRect();
      wrap.classList.toggle('is-up', r.bottom > window.innerHeight - 8 && r.top - r.height - btn.offsetHeight > 70);
      document.addEventListener('pointerdown', onOutside, true);
    }

    function close(returnFocus) {
      if (!pop) return;
      pop.remove();
      pop = null;
      btn.setAttribute('aria-expanded', 'false');
      wrap.classList.remove('is-open', 'is-up');
      document.removeEventListener('pointerdown', onOutside, true);
      if (returnFocus) btn.focus();
    }

    const onOutside = (e) => { if (!wrap.contains(e.target)) close(false); };

    btn.addEventListener('click', () => (pop ? close(true) : open()));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    });

    wrap.addEventListener('click', (e) => {
      if (!pop || !pop.contains(e.target)) return;
      const day = e.target.closest('[data-day]');
      if (day) { setValue(parse(day.dataset.day)); close(true); return; }
      const step = e.target.closest('[data-step]');
      if (step) {
        const dir = step.dataset.step;
        moveFocus(addMonths(focus, Number(dir)));
        pop.querySelector(`[data-step="${dir}"]`).focus(); // keep focus on the arrow for repeated clicks
        return;
      }
      if (e.target.closest('[data-today]')) { setValue(new Date()); close(true); return; }
      if (e.target.closest('[data-close]')) close(true);
    });

    wrap.addEventListener('keydown', (e) => {
      if (!pop || !pop.contains(e.target)) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
      if (e.key === 'Tab') {
        // Keep focus inside the small dialog.
        const items = U.$$('button:not([tabindex="-1"])', pop);
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
        return;
      }
      if (!e.target.closest('[data-day]')) return;
      const moves = {
        ArrowLeft: () => addDays(focus, -1),
        ArrowRight: () => addDays(focus, 1),
        ArrowUp: () => addDays(focus, -7),
        ArrowDown: () => addDays(focus, 7),
        Home: () => addDays(focus, -focus.getDay()),
        End: () => addDays(focus, 6 - focus.getDay()),
        PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
        PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
      };
      if (moves[e.key]) { e.preventDefault(); moveFocus(moves[e.key]()); }
    });

    // Form "reset" puts the hidden input back; keep the button text in step.
    const form = wrap.closest('form');
    if (form) form.addEventListener('reset', () => setTimeout(() => { btn.innerHTML = DP.buttonInner(input.value); close(false); }, 0));
  }
})(window.PSB);
