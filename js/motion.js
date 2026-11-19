/* Modern motion helpers:
   - scroll reveal (fade + rise + de-blur)
   - stepped count-up numbers
   - word-by-word headline reveal ([data-split])
   - highlighter sweep on <mark class="hl">
   - pixel-wipe transition between pages
   - cursor spotlight on cards
   - cross-fade page transitions (View Transitions API, when supported)
   Everything falls back to the final state for reduced motion. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const Motion = (PSB.motion = {});
  let observer = null;

  /* Stepped count-up: the number ticks in fixed steps like a scoreboard
     instead of gliding, and the stat card flickers while it counts. */
  const COUNT_STEPS = 14;
  const COUNT_TICK = 60; // ms per step
  function countUp(el) {
    const target = Number(el.dataset.count) || 0;
    if (U.reducedMotion() || target === 0) { el.textContent = String(target); return; }
    const host = el.closest('.stat') || el;
    let step = 0;
    host.classList.add('is-counting');
    el.textContent = '0';
    const tick = () => {
      step++;
      el.textContent = String(Math.round((target * step) / COUNT_STEPS));
      if (step < COUNT_STEPS) setTimeout(tick, COUNT_TICK);
      else host.classList.remove('is-counting');
    };
    setTimeout(tick, COUNT_TICK);
  }

  /* Highlighter sweep: <mark class="hl"> backgrounds draw in left → right
     once their line scrolls into view, staggered within one heading. */
  // One long-lived observer: refresh() is also called on sub-trees, so the
  // observer must not be reset each time. Blocks that leave the DOM are dropped.
  let markObserver = null;
  const markBlocks = new Set();
  function sweepMarks(root) {
    const marks = U.$$('mark.hl:not(.is-in)', root);
    if (!marks.length) return;
    if (U.reducedMotion() || !('IntersectionObserver' in window)) {
      marks.forEach((m) => m.classList.add('is-in'));
      return;
    }
    if (!markObserver) {
      markObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const block = entry.target;
          // Split headlines rise word by word first; let the words land before sweeping.
          const base = block.matches('[data-split]') ? 0.55 : 0.15;
          U.$$('mark.hl', block).forEach((m, i) => {
            m.style.setProperty('--sweep-delay', `${base + i * 0.35}s`);
            m.classList.add('is-in');
          });
          markObserver.unobserve(block);
          markBlocks.delete(block);
        });
      }, { rootMargin: '0px 0px -15% 0px' });
    }
    markBlocks.forEach((b) => { if (!b.isConnected) { markObserver.unobserve(b); markBlocks.delete(b); } });
    marks.forEach((m) => {
      const block = m.closest('h1, h2, h3, p, li') || m.parentElement;
      if (markBlocks.has(block)) return;
      markBlocks.add(block);
      markObserver.observe(block);
    });
  }

  /* Pixel wipe: a grid of court-coloured squares pops in at random, the
     view swaps underneath, then the squares pop back out. */
  const WIPE_IN = 400;  // ms until the screen is fully covered
  const WIPE_OUT = 420; // ms until the overlay is gone again
  let wipeEl = null;
  let wipeBusy = false;
  let wipeNext = null;

  function wipeCells() {
    if (!wipeEl) {
      wipeEl = document.createElement('div');
      wipeEl.className = 'px-wipe';
      wipeEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(wipeEl);
    }
    const w = window.innerWidth;
    const size = w < 640 ? 40 : w < 1024 ? 56 : 72;
    const cols = Math.ceil(w / size);
    const rows = Math.ceil(window.innerHeight / size);
    wipeEl.style.setProperty('--px', `${size}px`);
    wipeEl.style.setProperty('--cols', cols);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < cols * rows; i++) {
      const cell = document.createElement('span');
      const roll = Math.random();
      cell.className = roll > 0.95 ? 'px-cell is-gold' : roll > 0.78 ? 'px-cell is-lav' : 'px-cell';
      cell.style.setProperty('--px-d', `${Math.round(Math.random() * 240)}ms`);
      frag.appendChild(cell);
    }
    wipeEl.replaceChildren(frag);
  }

  function pixelWipe(update) {
    if (wipeBusy) { wipeNext = update; return; } // a newer route wins; it swaps in at cover time
    wipeBusy = true;
    wipeNext = update;
    wipeCells();
    wipeEl.hidden = false;
    void wipeEl.offsetWidth; // commit the hidden state so the cells transition in
    wipeEl.classList.add('is-covered');
    setTimeout(() => {
      const run = wipeNext;
      wipeNext = null;
      run();
      // Fresh random order for the way out.
      U.$$('.px-cell', wipeEl).forEach((c) => c.style.setProperty('--px-d', `${Math.round(Math.random() * 240)}ms`));
      wipeEl.classList.remove('is-covered');
      setTimeout(() => {
        wipeBusy = false;
        if (wipeNext) { const again = wipeNext; wipeNext = null; pixelWipe(again); return; }
        wipeEl.hidden = true;
        wipeEl.replaceChildren();
      }, WIPE_OUT);
    }, WIPE_IN);
  }

  function show(el) {
    el.classList.add('is-visible');
    U.$$('[data-count]', el).forEach(countUp);
    if (el.hasAttribute('data-count')) countUp(el);
  }

  /** Wrap every word of an element (keeping nested markup) in an animated span. */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const span = document.createElement('span');
            span.className = 'w';
            span.style.setProperty('--w', i++);
            span.textContent = part;
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
  }

  /** Reveal `.reveal` elements, start counters and split headlines inside `root`. */
  Motion.refresh = (root = document) => {
    if (observer) observer.disconnect();
    U.$$('[data-split]', root).forEach(splitWords);
    sweepMarks(root);
    const items = U.$$('.reveal', root);
    const counters = U.$$('[data-count]', root).filter((el) => !el.closest('.reveal'));
    if (U.reducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      U.$$('[data-count]', root).forEach((el) => { el.textContent = el.dataset.count; });
      return;
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        show(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    items.forEach((el) => observer.observe(el));
    counters.forEach((el) => observer.observe(el));
  };

  /**
   * Run a DOM update as a page transition: a pixel wipe when moving to a
   * different page (`wipe: true`), otherwise a cross-fade where supported.
   */
  Motion.transition = (update, { wipe = false } = {}) => {
    if (wipe && Motion.ready && !U.reducedMotion()) {
      pixelWipe(update);
      return;
    }
    if (document.startViewTransition && !U.reducedMotion() && Motion.ready) {
      // A skipped transition (e.g. the tab is hidden) rejects its promises; the update still runs.
      const vt = document.startViewTransition(update);
      vt.ready.catch(() => {});
      vt.finished.catch(() => {});
    } else {
      update();
    }
    Motion.ready = true;
  };

  /* Cursor spotlight: cards light up where the pointer is. */
  const SPOT = '.t-card, .t-row, .stat, .choice-card, .champ-card';
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest(SPOT);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
})(window.PSB);
