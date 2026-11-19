/* Bracket tab: connected horizontal bracket (desktop) or round-by-round list (mobile).
   Works for every format through the shared engine interface; double elimination
   adds a Losers bracket under the Winners bracket and a Grand Final column. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const S = PSB.store;
  const C = PSB.components;
  const esc = U.esc;
  const V = (PSB.views = PSB.views || {});

  V.bracketTab = (el, tid, ctx) => {
    const narrow = () => window.matchMedia('(max-width: 760px)').matches;
    const state = {
      mode: U.pref.get('bracket-mode', null) || (narrow() ? 'rounds' : 'bracket'),
      round: null,
      entering: true,
      zoom: null,      // full-screen zoom factor; null = fit the whole bracket on screen
      fsPrevMode: null, // layout to restore after leaving full screen
    };
    let cleanupScroll = null;
    let poolObserver = null; // round robin: watches the pools' width to re-balance match columns

    /* ---------- Full screen ---------- */
    // The whole page goes full screen (so the score modal, toasts and champion overlay
    // still show) and the bracket card is pinned over everything with a CSS class.
    const root = document.documentElement;
    const canNative = !!(root.requestFullscreen || root.webkitRequestFullscreen);
    const nativeEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    const isFs = () => root.classList.contains('is-bracket-fs');
    function setFs(on) {
      if (on === isFs()) return;
      root.classList.toggle('is-bracket-fs', on);
      // Full screen is for seeing the whole bracket: open in the connected view,
      // fitted to the screen, and put the previous layout back on exit.
      const cur = S.get(tid);
      const isRR = !!(cur && cur.bracket && cur.bracket.format === 'round-robin');
      if (on) {
        state.zoom = null;
        if (state.mode !== 'bracket') { state.fsPrevMode = state.mode; state.mode = 'bracket'; render(); }
        else if (isRR) render(); // pool round-columns are sized to the screen
      } else if (state.fsPrevMode) {
        state.mode = state.fsPrevMode; state.fsPrevMode = null; render();
      } else if (isRR) {
        render();
      }
      // Browsers only allow full screen from a real click/tap; asking at any other
      // time just logs a warning. Without a fresh tap, the pinned full-page view
      // (the class above) is used on its own. Browsers that can't report activation
      // (navigator.userActivation missing) still try, as before.
      const activation = navigator.userActivation;
      const canAsk = !activation || activation.isActive;
      if (on && canNative && canAsk && !nativeEl()) {
        const req = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen();
        if (req && req.catch) req.catch(() => {});
      } else if (!on && nativeEl()) {
        const ex = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
        if (ex && ex.catch) ex.catch(() => {});
      }
      const btn = el.querySelector('[data-action="fullscreen"]');
      if (btn) {
        btn.innerHTML = fsButtonInner();
        btn.setAttribute('aria-pressed', String(on));
      }
      window.dispatchEvent(new Event('resize'));
      // Native full screen resizes the viewport a frame later; fit after it settles.
      requestAnimationFrame(() => requestAnimationFrame(() => applyZoom(state.zoom, 'keep')));
    }

    /* ---------- Full-screen zoom ---------- */
    const ZOOM_MIN = 0.2;
    const ZOOM_MAX = 2;
    const zoomParts = () => {
      const sc = el.querySelector('.bracket-scroller');
      return { sc, tgt: sc && sc.firstElementChild };
    };
    const currentZoom = (tgt) => Number(tgt && tgt.style.zoom) || 1;

    /** Fit factor: largest zoom (≤ 100%) at which the whole bracket fits the scroller. */
    function fitZoom(sc, tgt) {
      const prev = tgt.style.zoom;
      tgt.style.zoom = 1;
      const w = tgt.offsetWidth;
      const h = tgt.offsetHeight;
      tgt.style.zoom = prev;
      const pad = 24;
      return Math.max(ZOOM_MIN, Math.min(1, (sc.clientWidth - pad) / w, (sc.clientHeight - pad) / h));
    }

    /**
     * Set the full-screen zoom. `z` null = fit. `anchor` is a point inside the
     * scroller ({x, y}) that stays put while zooming, or 'keep' to leave scroll alone.
     */
    function applyZoom(z, anchor) {
      const { sc, tgt } = zoomParts();
      if (!tgt) return;
      if (!isFs() || state.mode !== 'bracket') { tgt.style.zoom = ''; return; }
      const cur = currentZoom(tgt);
      const next = z === null ? fitZoom(sc, tgt) : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
      state.zoom = z === null ? null : next;
      if (anchor === 'keep') {
        tgt.style.zoom = next;
      } else {
        const ax = anchor ? anchor.x : sc.clientWidth / 2;
        const ay = anchor ? anchor.y : sc.clientHeight / 2;
        const cx = (sc.scrollLeft + ax) / cur;
        const cy = (sc.scrollTop + ay) / cur;
        tgt.style.zoom = next;
        sc.scrollLeft = cx * next - ax;
        sc.scrollTop = cy * next - ay;
      }
      const label = el.querySelector('[data-zoom-label]');
      if (label) label.textContent = `${Math.round(next * 100)}%`;
      const fitBtn = el.querySelector('[data-zoom="fit"]');
      if (fitBtn) fitBtn.setAttribute('aria-pressed', String(state.zoom === null));
    }
    const zoomBy = (factor, anchor) => {
      const { tgt } = zoomParts();
      if (tgt) applyZoom(currentZoom(tgt) * factor, anchor);
    };
    const zoomControls = () => `
      <div class="zoom-ctl" role="group" aria-label="Zoom">
        <button type="button" class="zoom-btn" data-zoom="out" title="Zoom out (−)" aria-label="Zoom out">${PSB.icon('minus', 'icon-sm')}</button>
        <span class="zoom-level" data-zoom-label aria-live="polite">100%</span>
        <button type="button" class="zoom-btn" data-zoom="in" title="Zoom in (+)" aria-label="Zoom in">${PSB.icon('plus', 'icon-sm')}</button>
        <button type="button" class="zoom-btn zoom-fit" data-zoom="fit" aria-pressed="${state.zoom === null}" title="Fit whole bracket (0)">${PSB.icon('fit', 'icon-sm')}<span>Fit</span></button>
      </div>`;

    // Ctrl + wheel (also what a trackpad pinch sends) zooms around the pointer.
    const onWheel = (e) => {
      if (!e.ctrlKey || !isFs() || state.mode !== 'bracket') return;
      const { sc } = zoomParts();
      if (!sc || !sc.contains(e.target)) return;
      e.preventDefault();
      const r = sc.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0025), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    // Two-finger pinch on touch screens.
    let pinch = null;
    const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => {
      if (e.touches.length !== 2 || !isFs() || state.mode !== 'bracket') return;
      const { tgt } = zoomParts();
      if (tgt) pinch = { d: touchDist(e.touches), z: currentZoom(tgt) };
    };
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const { sc } = zoomParts();
      const r = sc.getBoundingClientRect();
      const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top };
      applyZoom(pinch.z * (touchDist(e.touches) / pinch.d), mid);
    };
    const onTouchEnd = (e) => { if (e.touches.length < 2) pinch = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    /**
     * Round robin (window view): spread each pool's match cards evenly over the
     * width it has. Find how many cards fit, then how many rows that needs, then
     * share the cards equally between those rows — 6 matches give one row of 6
     * or two rows of 3, never 5 + 1. Every round in a pool uses the same count
     * so the cards line up from round to round.
     */
    function fitPoolMatches() {
      if (isFs()) return; // full screen lays rounds out as columns instead
      const MIN = 210;
      const GAP = 10;
      U.$$('.rr-pool', el).forEach((pool) => {
        const boxes = U.$$('.rr-matches', pool);
        if (!boxes.length) return;
        const most = Math.max(1, ...boxes.map((x) => x.children.length));
        const width = boxes[0].clientWidth;
        if (!width) return;
        const fit = Math.max(1, Math.floor((width + GAP) / (MIN + GAP)));
        const rows = Math.ceil(most / fit);
        pool.style.setProperty('--rr-mcols', String(Math.ceil(most / rows)));
      });
    }

    const onResize = () => {
      if (isFs() && state.zoom === null) applyZoom(null, 'keep');
      fitPoolMatches();
    };
    window.addEventListener('resize', onResize);
    const fsButtonInner = () => isFs()
      ? `${PSB.icon('shrink', 'icon-sm')}<span>Exit full screen</span>`
      : `${PSB.icon('expand', 'icon-sm')}<span>Full screen</span>`;
    // Browser exited full screen (Esc / F11 / swipe): drop the pinned layout too.
    const onNativeChange = () => { if (!nativeEl() && isFs()) setFs(false); };
    // Without the Fullscreen API (iPhone Safari) Esc still closes the pinned view.
    const onKey = (e) => {
      if (!isFs() || document.querySelector('.modal-backdrop, .champ-overlay')) return;
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      // Zoom keys: + / = in, - out, 0 fit.
      if (state.mode === 'bracket' && !e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.25); return; }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(1 / 1.25); return; }
        if (e.key === '0') { e.preventDefault(); applyZoom(null); return; }
      }
      if (e.key !== 'Escape' || nativeEl()) return;
      setFs(false);
    };
    document.addEventListener('fullscreenchange', onNativeChange);
    document.addEventListener('webkitfullscreenchange', onNativeChange);
    document.addEventListener('keydown', onKey);

    function defaultStage(E, b) {
      const stages = E.stages(b);
      if (E.champion(b)) return stages.length;
      const r = stages.findIndex((st) => st.matches.some((m) => E.status(m) === 'ready'));
      return r < 0 ? 0 : r;
    }

    /* ---------- Column markup (shared by all formats) ---------- */
    function stageMeta(E, stage, isFinalStage) {
      if (isFinalStage) return 'Championship';
      const real = stage.matches.filter((m) => !['bye', 'void'].includes(E.status(m))).length;
      const byes = stage.matches.length - real;
      return `${U.plural(real, 'match', 'matches')}${byes ? ` · ${U.plural(byes, 'BYE')}` : ''}`;
    }

    /**
     * One round column. `nextCount` is how many matches the following column has:
     * half as many → pair connectors, the same → straight lines, 0 → a short stub.
     */
    function columnHtml(t, b, E, stage, r, nextCount, { isFinal = false, meta } = {}) {
      const count = stage.matches.length;
      const slots = stage.matches.map((m, i) => {
        const pos = !nextCount || nextCount === count ? 'is-single' : i % 2 === 0 ? 'is-top' : 'is-bottom';
        const st = E.status(m);
        const decided = m.winner !== null && st !== 'void' ? 'is-decided' : '';
        const feeds = r > 0 && (m.slots[0] || m.slots[1]) ? 'feeds-in' : '';
        return `<div class="m-slot ${pos} ${decided} ${feeds}" data-slot="${m.id}" style="--i:${i}">${C.matchCard(t, b, m, { i })}</div>`;
      }).join('');
      return `
        <div class="round ${isFinal ? 'is-final' : ''}" style="--r:${r}" role="group" aria-label="${esc(stage.name)}">
          <div class="round-head"><span class="round-name">${esc(stage.name)}</span><span class="round-meta">${meta || stageMeta(E, stage, isFinal)}</span></div>
          <div class="round-body">${slots}</div>
        </div>`;
    }

    function champColumn(t, b, E, r, inline) {
      const champ = E.champion(b);
      return `
        <div class="round round-champion" style="--r:${r}" role="group" aria-label="Champion">
          <div class="round-head"><span class="round-name">Champion</span><span class="round-meta">${champ ? 'Decided' : 'Awaiting final'}</span></div>
          <div class="round-body ${inline ? '' : 'is-auto'}">${inline
            ? `<div class="m-slot is-single ${champ ? 'feeds-in' : ''}" style="--i:0">${C.champCard(t, b)}</div>`
            : `<div class="f-slot" data-slot="champion">${C.champCard(t, b)}</div>`}</div>
        </div>`;
    }

    const legend = (de) => `
      <div class="bracket-legend" aria-hidden="true">
        <span><i class="legend-swatch is-win"></i>Winner</span>
        <span><i class="legend-swatch is-ready"></i>Ready to score</span>
        <span><i class="legend-line"></i>Winning path</span>
        ${de ? '<span><span class="bracket-tag tag-w">W</span>Winners · <span class="bracket-tag tag-l">L</span>Losers bracket</span>' : ''}
      </div>`;

    function singleElimHtml(t, b, E) {
      const stages = E.stages(b);
      const cols = stages.map((st, r) => columnHtml(t, b, E, st, r, r + 1 < stages.length ? stages[r + 1].matches.length : 0, { isFinal: r === stages.length - 1 })).join('');
      return `
        <div class="bracket ${t.type === 'doubles' ? 'is-doubles' : ''} ${state.entering && !U.reducedMotion() ? 'is-entering' : ''}" style="--base:${b.rounds[0].length}">
          ${cols}${champColumn(t, b, E, stages.length, true)}
        </div>`;
    }

    function doubleElimHtml(t, b, E) {
      const entering = state.entering && !U.reducedMotion() ? 'is-entering' : '';
      const dbl = t.type === 'doubles' ? 'is-doubles' : '';
      const stages = E.stages(b);
      const wStages = stages.filter((s) => s.group === 'Winners');
      const lStages = stages.filter((s) => s.group === 'Losers');
      const gStage = stages.find((s) => s.group === 'Final');
      const section = (list, tag, title, base) => `
        <section class="de-section" aria-label="${title}">
          <h3 class="de-title"><span class="bracket-tag tag-${tag.toLowerCase()}">${tag}</span>${title}</h3>
          <div class="bracket ${dbl} ${entering}" style="--base:${base}">
            ${list.map((st, r) => columnHtml(t, b, E, st, r, r + 1 < list.length ? list[r + 1].matches.length : 0)).join('')}
          </div>
        </section>`;
      const [gf1, gf2] = b.finals;
      const resetNote = gf2
        ? `<p class="gf-note">${gf2.void ? 'Reset not needed' : gf1.winner === 1 ? 'Winner takes the title' : 'If needed'}</p>`
        : '';
      const finals = `
        <div class="de-finals ${dbl} ${entering}">
          <div class="round is-final" style="--r:${wStages.length}" role="group" aria-label="Grand Final">
            <div class="round-head"><span class="round-name">Grand Final</span><span class="round-meta">${gf2 ? 'With bracket reset' : 'Single match'}</span></div>
            <div class="round-body is-auto">
              <div class="f-slot" data-slot="gf1">${C.matchCard(t, b, gf1, { i: 0 })}</div>
              ${gf2 ? `<div class="f-slot" data-slot="gf2">${C.matchCard(t, b, gf2, { i: 1 })}</div>${resetNote}` : ''}
            </div>
          </div>
          ${champColumn(t, b, E, wStages.length + 1, false)}
        </div>`;
      return `
        <div class="de-layout">
          <div class="de-main">
            ${section(wStages, 'W', 'Winners Bracket', b.rounds[0].length)}
            ${section(lStages, 'L', 'Losers Bracket', b.losers[0].length)}
          </div>
          ${finals}
          <svg class="de-links ${entering}" aria-hidden="true" focusable="false"></svg>
        </div>
        <span class="sr-only">${esc(gStage.name)} follows the Winners and Losers finals.</span>`;
    }

    /* ---------- Round robin: pools (standings + matches), then playoffs ---------- */
    const signed = (n) => (n > 0 ? `+${n}` : String(n));

    function standingsTable(t, b, E, p, { compact = false } = {}) {
      const rows = E.standings(b, p);
      const pool = b.pools[p];
      const done = pool.rounds.flat().every((m) => m.winner !== null);
      const champ = E.champion(b);
      const adv = b.advance;
      const rowHtml = (r) => {
        const q = adv && r.rank <= adv;
        const cls = [q ? (done ? 'is-q' : 'is-proj') : '', champ === r.id ? 'is-champ' : ''].join(' ');
        const tag = q ? `<span class="rr-q" title="${done ? 'Advances to the playoffs' : 'On track to advance'}">${done ? 'Q' : 'q'}</span>` : '';
        return `<tr class="${cls}" data-pid="${esc(r.id)}">
          <td class="rr-rank">${r.rank}</td>
          <td class="rr-name"><span>${esc(M.nameById(t, r.id))}</span>${tag}</td>
          <td>${r.won}</td><td>${r.lost}</td>
          <td class="rr-diff ${r.diff > 0 ? 'is-pos' : r.diff < 0 ? 'is-neg' : ''}">${signed(r.diff)}</td>
          ${compact ? '' : `<td>${r.pf}</td>`}
        </tr>`;
      };
      const head = `<thead><tr><th scope="col" title="Rank">#</th><th scope="col">${esc(M.typeInfo(t).Unit || 'Player')}</th><th scope="col" title="Wins">W</th><th scope="col" title="Losses">L</th><th scope="col" title="Point difference">+/−</th>${compact ? '' : '<th scope="col" title="Points scored">PF</th>'}</tr></thead>`;
      // Big pools: split the ranking into side-by-side columns (up to 6 rows each,
      // at most 4 columns) so the table doesn't stretch into one long thin list.
      const cols = compact ? 1 : Math.min(4, Math.ceil(rows.length / 6));
      const per = Math.ceil(rows.length / cols);
      const chunks = Array.from({ length: cols }, (_, c) => rows.slice(c * per, (c + 1) * per));
      const tables = chunks.map((chunk, c) => `
        <table class="rr-table ${compact ? 'is-compact' : ''}">
          <caption class="${compact ? '' : 'sr-only'}">${esc(E.poolName(b, p))} standings${cols > 1 ? `, places ${chunk[0].rank}–${chunk[chunk.length - 1].rank}` : ''}</caption>
          ${head}
          <tbody>${chunk.map(rowHtml).join('')}</tbody>
        </table>`).join('');
      return cols > 1 ? `<div class="rr-table-cols" style="--rr-tcols:${cols}">${tables}</div>` : tables;
    }

    /**
     * Full screen: each pool round becomes a column of match cards. Pick how many
     * round-columns sit side by side so the whole pool's shape is close to the
     * screen's shape (share of it, when several pools sit side by side), which keeps
     * the zoom-to-fit readable instead of shrinking one tall strip.
     */
    function fsRoundColumns(b, p) {
      const pool = b.pools[p];
      const R = pool.rounds.length;
      const perRound = Math.max(1, ...pool.rounds.map((ms) => ms.length));
      const COL_W = 244;                       // card column + gap
      const roundH = perRound * 96 + 34;       // stacked cards + round label
      const tcols = Math.min(4, Math.ceil(pool.ids.length / 6));
      const tableH = (Math.ceil(pool.ids.length / tcols) + 1) * 38 + 50;
      const poolCols = Math.min(b.pools.length, 3);
      const poolRows = Math.ceil(b.pools.length / poolCols);
      const target = (window.innerWidth / Math.max(320, window.innerHeight - 140)) * poolRows / poolCols;
      let best = 1;
      let bestErr = Infinity;
      for (let c = 1; c <= R; c++) {
        const w = Math.max(c * COL_W, tcols * 322);
        const h = Math.ceil(R / c) * roundH + tableH;
        const err = Math.abs(Math.log((w / h) / target));
        if (err < bestErr) { bestErr = err; best = c; }
      }
      return best;
    }

    function poolHtml(t, b, E, p) {
      const pool = b.pools[p];
      const all = pool.rounds.flat();
      const played = all.filter((m) => m.winner !== null).length;
      const rounds = pool.rounds.map((ms, r) => {
        const playing = new Set(ms.flatMap((m) => m.slots));
        const out = pool.ids.filter((id) => !playing.has(id));
        return `
          <div class="rr-round">
            <span class="rr-round-name">Round ${r + 1}${out.length ? `<small>${esc(out.map((id) => M.nameById(t, id)).join(', '))} sits out</small>` : ''}</span>
            <div class="rr-matches">${ms.map((m, i) => C.matchCard(t, b, m, { i })).join('')}</div>
          </div>`;
      }).join('');
      return `
        <section class="rr-pool" style="--i:${p};--rr-rcols:${fsRoundColumns(b, p)}" aria-label="${esc(E.poolName(b, p))}">
          <header class="rr-pool-head">
            <h3>${esc(E.poolName(b, p))}</h3>
            <span class="rr-pool-meta">${played}/${all.length} played${b.advance ? ` · top ${b.advance} advance` : ''}</span>
          </header>
          ${standingsTable(t, b, E, p)}
          <div class="rr-rounds">${rounds}</div>
        </section>`;
    }

    /** Before pool play ends: who is on track to make the playoffs, in projected seed order. */
    function projectedHtml(t, b, E) {
      const list = E.qualifiers(b);
      const remaining = E.all(b).filter((m) => m.stage === 'pool' && m.winner === null).length;
      return `
        <div class="rr-waiting">
          <p class="rr-waiting-note">${PSB.icon('clock')}The playoff bracket is drawn when every pool match has a result — ${U.plural(remaining, 'match', 'matches')} to go.</p>
          <ol class="rr-proj">${list.map((r) => `<li><span class="rr-proj-seed">${list.indexOf(r) + 1}</span>${esc(M.nameById(t, r.id))}<small>${esc(E.poolName(b, r.pool))} · #${r.rank}</small></li>`).join('')}</ol>
          <p class="summary-note">Projected seeds from the current standings.</p>
        </div>`;
    }

    function roundRobinHtml(t, b, E) {
      const pb = b.playoff;
      const PE = pb && PSB.engines[pb.format];
      const pools = b.pools.map((_, p) => poolHtml(t, b, E, p)).join('');
      const fmtLabel = b.playoffFormat === 'double-elim' ? 'Double elimination' : 'Single elimination';
      const tail = E.hasPlayoff(b)
        ? `<section class="rr-stage rr-playoff">
            <h3 class="rr-stage-title">${PSB.icon('trophy')}Playoffs<small>Top ${b.advance}${b.pools.length > 1 ? ' per pool' : ''} · ${fmtLabel}</small></h3>
            ${pb ? (pb.format === 'double-elim' ? doubleElimHtml(t, pb, PE) : singleElimHtml(t, pb, PE)) : projectedHtml(t, b, E)}
          </section>`
        : `<section class="rr-stage rr-final">
            <h3 class="rr-stage-title">${PSB.icon('trophy')}Champion<small>Best record after pool play</small></h3>
            <div class="rr-champ">${C.champCard(t, b)}</div>
          </section>`;
      return `
        ${legend(pb && pb.format === 'double-elim')}
        <div class="bracket-frame">
          <div class="bracket-scroller" tabindex="0" aria-label="Pools and playoffs">
            <div class="rr-layout ${state.entering && !U.reducedMotion() ? 'is-entering' : ''}" style="--rr-cols:${Math.min(b.pools.length, 3)}">
              <section class="rr-stage">
                <h3 class="rr-stage-title">${PSB.icon('users')}Pool play<small>${b.pools.length === 1 ? 'Everyone plays everyone' : `${b.pools.length} pools`}</small></h3>
                <div class="rr-pools">${pools}</div>
              </section>
              ${tail}
            </div>
          </div>
        </div>`;
    }

    function bracketHtml(t, b, E) {
      if (b.format === 'round-robin') return roundRobinHtml(t, b, E);
      const de = b.format === 'double-elim';
      return `
        ${legend(de)}
        <div class="bracket-frame">
          <div class="bracket-scroller" tabindex="0" aria-label="Tournament bracket, scroll horizontally to see all rounds">
            ${de ? doubleElimHtml(t, b, E) : singleElimHtml(t, b, E)}
          </div>
        </div>`;
    }

    /* ---------- Lines into and out of the Grand Final (double elimination) ---------- */
    function posIn(node, root) {
      let x = 0;
      let y = 0;
      let n = node;
      while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y, w: node.offsetWidth, h: node.offsetHeight };
    }

    function drawLinks(b) {
      const layout = el.querySelector('.de-layout');
      const svg = layout && layout.querySelector('.de-links');
      if (!svg) return;
      const card = (id) => layout.querySelector(`.match[data-mid="${id}"], [data-slot="${id}"] > .champ-card`);
      const gap = parseFloat(getComputedStyle(layout).getPropertyValue('--col-gap')) || 60;
      const k = b.rounds.length;
      const [gf1, gf2] = b.finals;
      const wFinal = b.rounds[k - 1][0];
      const lFinal = b.losers[b.losers.length - 1][0];
      const resetLive = gf2 && gf1.winner === 1;
      const links = [
        [wFinal.id, 'gf1', wFinal.winner !== null, 'side'],
        [lFinal.id, 'gf1', lFinal.winner !== null, 'side'],
      ];
      if (resetLive) {
        links.push(['gf1', 'gf2', true, 'down']);
        links.push(['gf2', 'champion', gf2.winner !== null, 'side']);
      } else {
        links.push(['gf1', 'champion', gf1.winner !== null, 'side']);
      }
      const paths = links.map(([from, to, on, kind]) => {
        const a = card(from);
        const z = to === 'champion' ? layout.querySelector('[data-slot="champion"] .champ-card') : card(to);
        if (!a || !z) return '';
        const p = posIn(a, layout);
        const q = posIn(z, layout);
        let d;
        if (kind === 'down') {
          const x = p.x + p.w / 2;
          d = `M ${x} ${p.y + p.h} V ${q.y}`;
        } else {
          const x1 = p.x + p.w;
          const y1 = p.y + p.h / 2;
          const x2 = q.x;
          const y2 = q.y + q.h / 2;
          const mx = Math.max(x1 + 8, x2 - gap / 2);
          const r = Math.min(12, Math.abs(y2 - y1) / 2, (mx - x1) / 2);
          const dir = y2 > y1 ? 1 : -1;
          d = Math.abs(y2 - y1) < 1
            ? `M ${x1} ${y1} H ${x2}`
            : `M ${x1} ${y1} H ${mx - r} Q ${mx} ${y1} ${mx} ${y1 + dir * r} V ${y2 - dir * r} Q ${mx} ${y2} ${mx + r} ${y2} H ${x2}`;
        }
        return `<path d="${d}" class="${on ? 'is-on' : ''}" />`;
      }).join('');
      svg.setAttribute('width', layout.scrollWidth);
      svg.setAttribute('height', layout.scrollHeight);
      svg.innerHTML = paths;
    }

    /* ---------- Round-by-round view ---------- */
    function roundsHtml(t, b, E) {
      const stages = E.stages(b);
      const total = stages.length;
      if (state.round === null || state.round > total) state.round = defaultStage(E, b);
      const champ = E.champion(b);
      let lastGroup = null;
      const tabs = stages.map((st, r) => {
        const real = st.matches.filter((m) => !['bye', 'void'].includes(E.status(m)));
        const played = real.filter((m) => m.winner !== null).length;
        const done = real.length && played === real.length;
        const sep = st.group && st.group !== lastGroup && lastGroup !== null ? '<span class="round-tab-sep" aria-hidden="true"></span>' : '';
        lastGroup = st.group;
        return `${sep}<button type="button" role="tab" class="round-tab ${done ? 'is-done' : ''}" data-round="${r}" aria-selected="${state.round === r}" title="${esc(st.name)}">
          ${esc(st.tab)}<small>${st.placeholder ? 'After pools' : `${played}/${real.length} played`}</small></button>`;
      }).join('') + `<button type="button" role="tab" class="round-tab ${champ ? 'is-champ' : ''}" data-round="${total}" aria-selected="${state.round === total}">Champion<small>${champ ? 'Decided' : 'TBD'}</small></button>`;

      let body;
      let label = 'Champion';
      if (state.round === total) {
        body = C.champCard(t, b);
      } else if (stages[state.round].placeholder) {
        label = 'Playoffs';
        body = `<h3 class="round-list-title">Playoffs</h3>${projectedHtml(t, b, E)}`;
      } else {
        const st = stages[state.round];
        label = st.name;
        const rank = (m) => ({ ready: 0, completed: 1, pending: 2, bye: 3, void: 4 }[E.status(m)]);
        const ms = st.matches.filter((m) => !m.dead).slice().sort((x, y) => rank(x) - rank(y) || x.index - y.index || x.round - y.round);
        const tables = st.pools ? `<div class="rr-standings-strip">${b.pools.map((_, p) => standingsTable(t, b, E, p, { compact: true })).join('')}</div>` : '';
        body = tables + `<h3 class="round-list-title">${esc(st.name)}</h3>` + (ms.length
          ? ms.map((m, i) => C.matchCard(t, b, m, { i, showNext: true })).join('')
          : '<p class="summary-note">No matches in this round — every slot is a BYE.</p>');
      }
      return `
        <div class="round-nav">
          <button type="button" class="icon-btn round-nav-arrow" data-round-step="-1" ${state.round === 0 ? 'disabled' : ''} aria-label="Previous round">${PSB.icon('left')}</button>
          <div class="round-tabs" role="tablist" aria-label="Rounds">${tabs}</div>
          <button type="button" class="icon-btn round-nav-arrow" data-round-step="1" ${state.round === total ? 'disabled' : ''} aria-label="Next round">${PSB.icon('right')}</button>
        </div>
        <div class="round-list ${t.type === 'doubles' ? 'is-doubles' : ''}" role="tabpanel" aria-label="${esc(label)}">${body}</div>`;
    }

    /* ---------- Render ---------- */
    function render(fx = {}) {
      const t = S.get(tid);
      if (!t) return;
      const E = PSB.engineFor(t);
      if (cleanupScroll) { cleanupScroll(); cleanupScroll = null; }

      if (!t.bracket) {
        const info = M.typeInfo(t);
        el.innerHTML = `<div class="card">${C.empty({
          icon: 'bracket',
          title: 'No bracket yet',
          action: `<a class="btn btn-primary" href="#/t/${encodeURIComponent(t.id)}/participants">${PSB.icon(info.icon)}${t.participants.length >= E.MIN_ENTRANTS ? 'Review & generate' : `Add ${info.units}`}</a>`,
        })}</div>`;
        return;
      }

      const b = t.bracket;
      const prevScroller = el.querySelector('.bracket-scroller');
      const keepLeft = prevScroller ? prevScroller.scrollLeft : 0;
      const keepTop = prevScroller ? prevScroller.scrollTop : 0;
      const prog = E.progress(b);
      const pct = prog.total ? Math.round((prog.played / prog.total) * 100) : 0;
      const champ = E.champion(b);

      el.innerHTML = `
        <section class="card bracket-card">
          <div class="bracket-toolbar">
            <div class="bracket-progress">
              <span class="bracket-progress-label"><strong>${prog.played}</strong> of ${prog.total} matches played</span>
              <div class="progress" role="progressbar" aria-label="Matches played" aria-valuemin="0" aria-valuemax="${prog.total}" aria-valuenow="${prog.played}"><span style="width:${pct}%"></span></div>
            </div>
            <h2 class="fs-title">${esc(t.name)}</h2>
            <div class="bracket-actions">
              <span class="badge badge-type">${PSB.icon(M.FORMATS[b.format] ? M.FORMATS[b.format].icon : 'bracket')}${esc(M.formatLabel(t))}</span>
              ${champ ? `<button type="button" class="btn btn-soft btn-sm" data-action="champion">${PSB.icon('trophy')}Champion</button>` : ''}
              <div class="segmented" role="group" aria-label="Bracket layout">
                <button type="button" data-mode="bracket" aria-pressed="${state.mode === 'bracket'}">${PSB.icon('columns', 'icon-sm')}Bracket</button>
                <button type="button" data-mode="rounds" aria-pressed="${state.mode === 'rounds'}">${PSB.icon('rows', 'icon-sm')}Rounds</button>
              </div>
              ${state.mode === 'bracket' ? zoomControls() : ''}
              <button type="button" class="btn btn-soft btn-sm fs-btn" data-action="fullscreen" aria-pressed="${isFs()}" title="Full screen">${fsButtonInner()}</button>
            </div>
          </div>
          ${state.mode === 'bracket' ? bracketHtml(t, b, E) : roundsHtml(t, b, E)}
        </section>`;
      state.entering = false;

      const scroller = el.querySelector('.bracket-scroller');
      if (scroller) {
        scroller.style.scrollBehavior = 'auto';
        // Re-rendering replaces the bracket, so re-apply the full-screen zoom first.
        if (isFs()) applyZoom(state.zoom, 'keep');
        scroller.scrollLeft = keepLeft;
        scroller.scrollTop = keepTop;
        scroller.style.scrollBehavior = '';
        cleanupScroll = wireScroller(scroller, b.format === 'round-robin' ? b.playoff || b : b);
        fitPoolMatches();
        // Re-balance whenever the pools' box changes size (window resize, phone
        // rotation, fonts loading, leaving full screen) — not only on window resize.
        if (poolObserver) poolObserver.disconnect();
        const pools = el.querySelector('.rr-pools');
        if (pools && 'ResizeObserver' in window) {
          let queued = false;
          poolObserver = new ResizeObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; fitPoolMatches(); });
          });
          poolObserver.observe(pools);
        }
      }
      const activeTab = el.querySelector('.round-tab[aria-selected="true"]');
      if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });

      if (fx.kind === 'result') playAdvance(t, b, E, fx);
    }

    /* ---------- Scroller: edge fades, drag-to-pan, link drawing ---------- */
    function wireScroller(scroller, b) {
      const frame = scroller.parentElement;
      const update = () => {
        frame.classList.toggle('can-left', scroller.scrollLeft > 4);
        frame.classList.toggle('can-right', scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
      };
      const redraw = () => { update(); if (b.format === 'double-elim') drawLinks(b); };
      redraw();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
      scroller.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', redraw);

      // Drag to pan, both directions. A drag may start on a match card: once the
      // pointer moves past a few pixels it pans, and the click that follows is
      // swallowed so the score dialog doesn't open. Touch uses native scrolling.
      let pan = null;
      const down = (e) => {
        if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest('a, input, textarea, select')) return;
        pan = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false };
      };
      const move = (e) => {
        if (!pan) return;
        const dx = e.clientX - pan.x;
        const dy = e.clientY - pan.y;
        if (!pan.moved && Math.hypot(dx, dy) < 5) return;
        pan.moved = true;
        scroller.classList.add('is-panning');
        scroller.scrollLeft = pan.left - dx;
        scroller.scrollTop = pan.top - dy;
        e.preventDefault();
      };
      const swallowClick = (e) => { e.stopPropagation(); e.preventDefault(); };
      const up = () => {
        if (pan && pan.moved) {
          scroller.addEventListener('click', swallowClick, { capture: true, once: true });
          // If no click follows (pointer released outside), drop the guard.
          setTimeout(() => scroller.removeEventListener('click', swallowClick, { capture: true }), 0);
        }
        pan = null;
        scroller.classList.remove('is-panning');
      };
      scroller.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return () => {
        window.removeEventListener('resize', redraw);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
    }

    /* ---------- Winner advancement animation ---------- */
    function playAdvance(t, b, E, fx) {
      const m = E.find(b, fx.matchId);
      if (!m) return;
      const card = el.querySelector(`.match[data-mid="${m.id}"]`);
      if (card) card.classList.add('just-completed');
      const slot = el.querySelector(`.m-slot[data-slot="${m.id}"]`);
      if (slot) slot.classList.add('just-decided');

      const dest = E.destinations(b, m);
      // The loser dropping to the Losers bracket gets a gentle highlight, no flight.
      if (dest.loser && fx.loserPid) {
        const drop = el.querySelector(`.match[data-mid="${dest.loser.id}"] .team[data-pid="${CSS.escape(fx.loserPid)}"]`);
        if (drop) drop.classList.add('is-arriving');
      }
      if (!dest.winner) {
        const champCard = el.querySelector('.champ-card');
        if (champCard && fx.champion) champCard.classList.add('just-crowned');
        return;
      }
      const target = el.querySelector(`.match[data-mid="${dest.winner.id}"] .team[data-pid="${CSS.escape(fx.winnerPid)}"]`);
      const nextSlot = el.querySelector(`.m-slot[data-slot="${dest.winner.id}"]`);
      if (nextSlot) nextSlot.classList.add('just-fed');
      if (!target) return;

      const sr = fx.sourceRect;
      const tr = target.getBoundingClientRect();
      const scroller = el.querySelector('.bracket-scroller');
      const visible = scroller && (() => {
        const r = scroller.getBoundingClientRect();
        return tr.left >= r.left - 2 && tr.right <= r.right + 2 && tr.top >= 0 && tr.bottom <= window.innerHeight;
      })();

      if (!sr || !visible || U.reducedMotion()) {
        target.classList.add('is-arriving');
        if (scroller && !visible) target.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
        return;
      }

      const ghost = document.createElement('div');
      ghost.className = 'advance-ghost';
      ghost.textContent = M.nameById(t, fx.winnerPid);
      Object.assign(ghost.style, { left: `${sr.left}px`, top: `${sr.top}px`, width: `${sr.width}px`, height: `${sr.height}px` });
      document.body.appendChild(ghost);
      target.classList.add('is-arriving', 'after-flight');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ghost.style.transform = `translate(${tr.left - sr.left}px, ${tr.top - sr.top}px)`;
      }));
      setTimeout(() => { ghost.style.opacity = '0'; }, 560);
      setTimeout(() => ghost.remove(), 850);
    }

    /* ---------- Events ---------- */
    function resultToast(fresh, info) {
      const E = PSB.engineFor(fresh);
      const b = fresh.bracket;
      const m = E.find(b, info.matchId);
      const name = M.nameById(fresh, info.winnerPid);
      const plural = fresh.type === 'doubles' && !(M.entrant(fresh, info.winnerPid) || {}).team;
      if (info.champion && info.champion !== info.prevChampion) {
        PSB.ui.toast(`${M.nameById(fresh, info.champion)} ${plural ? 'are' : 'is'} the champion!`, 'info');
        setTimeout(() => PSB.champion.show(S.get(tid)), U.reducedMotion() ? 0 : 750);
        return;
      }
      const dest = E.destinations(b, m);
      if (m.id === 'gf1' && dest.winner) {
        PSB.ui.toast(`${name} win${plural ? '' : 's'} the Grand Final — a deciding reset match will be played.`, 'info', 4500);
        return;
      }
      let msg = dest.winner ? `${name} advance${plural ? '' : 's'} to ${E.stageName(b, dest.winner)}.` : `${name} win${plural ? '' : 's'}.`;
      if (dest.loser && info.loserPid) msg += ` ${M.nameById(fresh, info.loserPid)} drop${plural ? '' : 's'} to ${E.stageName(b, dest.loser)}.`;
      PSB.ui.toast(msg, 'success', 4000);
    }

    function openMatch(mid) {
      PSB.matchModal.open(tid, mid, {
        onChange(info) {
          let sourceRect = null;
          if (info.kind === 'result' && info.winnerPid) {
            const src = el.querySelector(`.match[data-mid="${mid}"] .team[data-pid="${CSS.escape(info.winnerPid)}"]`);
            if (src) sourceRect = src.getBoundingClientRect();
          }
          render({ ...info, sourceRect });
          ctx.refreshHeader();
          if (info.kind === 'result') resultToast(S.get(tid), info);
          else if (info.kind === 'reset') {
            PSB.ui.toast(info.cleared.length ? `Result reset — ${U.plural(info.cleared.length, 'later match', 'later matches')} cleared too.` : 'Result reset.');
          }
        },
      });
    }

    el.addEventListener('click', (e) => {
      const mode = e.target.closest('[data-mode]');
      if (mode) {
        state.mode = mode.dataset.mode;
        U.pref.set('bracket-mode', state.mode);
        render();
        return;
      }
      const tab = e.target.closest('[data-round]');
      if (tab) { state.round = Number(tab.dataset.round); render(); return; }
      const step = e.target.closest('[data-round-step]');
      if (step) { state.round += Number(step.dataset.roundStep); render(); return; }
      if (e.target.closest('[data-action="fullscreen"]')) { setFs(!isFs()); return; }
      const zb = e.target.closest('[data-zoom]');
      if (zb) {
        if (zb.dataset.zoom === 'fit') applyZoom(null);
        else zoomBy(zb.dataset.zoom === 'in' ? 1.25 : 1 / 1.25);
        return;
      }
      if (e.target.closest('[data-action="champion"]')) { PSB.champion.show(S.get(tid)); return; }
      const card = e.target.closest('button.match[data-mid]');
      if (card) openMatch(card.dataset.mid);
    });

    // Trace a player's path through the bracket on hover.
    el.addEventListener('mouseover', (e) => {
      // Match-card rows and round-robin standings rows both carry data-pid.
      const team = e.target.closest('.team[data-pid], .rr-table tr[data-pid]');
      if (!team) return;
      const pid = CSS.escape(team.dataset.pid);
      U.$$(`.team[data-pid="${pid}"], .rr-table tr[data-pid="${pid}"]`, el).forEach((x) => x.classList.add('is-traced'));
    });
    el.addEventListener('mouseout', (e) => {
      const team = e.target.closest('.team[data-pid], .rr-table tr[data-pid]');
      if (!team || (e.relatedTarget && team.contains(e.relatedTarget))) return;
      U.$$('.is-traced', el).forEach((x) => x.classList.remove('is-traced'));
    });

    render();
    return () => {
      if (cleanupScroll) cleanupScroll();
      setFs(false);
      document.removeEventListener('fullscreenchange', onNativeChange);
      document.removeEventListener('webkitfullscreenchange', onNativeChange);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      if (poolObserver) poolObserver.disconnect();
    };
  };
})(window.PSB);
