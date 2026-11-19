/* Dashboard (pixel style): hero with a pixel-art rally → scoreboard stats → tournament list. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const C = PSB.components;
  const S = PSB.store;
  const V = (PSB.views = PSB.views || {});

  const ORDER = { ongoing: 0, upcoming: 1, draft: 2, completed: 3 };

  /** Pixel-art rally: two paddles trade a ball over the net under a bobbing trophy.
      Drawn on a 96×64 grid with crisp edges; every move is stepped. */
  function pixelCourt() {
    const px = (x, y, w, h, cls) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" />`;
    const LINE = 'pc-line';
    return `
      <svg class="px-court" viewBox="0 0 96 64" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
        ${px(10, 50, 80, 3, 'pc-drop')}
        ${px(8, 14, 80, 36, 'pc-floor')}
        ${px(35, 14, 26, 36, 'pc-kitchen')}
        ${px(8, 14, 80, 1, LINE)}${px(8, 49, 80, 1, LINE)}${px(8, 14, 1, 36, LINE)}${px(87, 14, 1, 36, LINE)}
        ${px(35, 14, 1, 36, LINE)}${px(60, 14, 1, 36, LINE)}
        ${px(8, 31, 27, 1, LINE)}${px(61, 31, 27, 1, LINE)}
        ${px(47, 11, 2, 41, 'pc-net')}${px(47, 10, 2, 2, 'pc-post')}${px(47, 51, 2, 2, 'pc-post')}
        <g class="pc-trophy">
          ${px(43, 1, 10, 1, 'pc-gold')}${px(44, 2, 8, 3, 'pc-gold')}${px(45, 5, 6, 1, 'pc-gold')}${px(46, 6, 4, 1, 'pc-gold-d')}
          ${px(41, 2, 2, 1, 'pc-gold')}${px(41, 3, 1, 1, 'pc-gold')}${px(53, 2, 2, 1, 'pc-gold')}${px(54, 3, 1, 1, 'pc-gold')}
          ${px(47, 7, 2, 1, 'pc-gold-d')}${px(45, 8, 6, 1, 'pc-gold-d')}${px(45, 2, 1, 2, 'pc-shine')}
        </g>
        <g class="pc-shadow">${px(17, 34, 3, 1, 'pc-drop')}</g>
        <g class="pc-paddle pc-left">${px(12, 26, 4, 5, 'pc-paddle-a')}${px(13, 31, 2, 3, 'pc-handle')}</g>
        <g class="pc-paddle pc-right">${px(80, 26, 4, 5, 'pc-paddle-b')}${px(81, 31, 2, 3, 'pc-handle')}</g>
        <g class="pc-spark pc-spark-l">${px(17, 24, 1, 1, 'pc-shine')}${px(19, 26, 1, 1, 'pc-shine')}${px(17, 32, 1, 1, 'pc-shine')}${px(19, 30, 1, 1, 'pc-shine')}</g>
        <g class="pc-spark pc-spark-r">${px(78, 28, 1, 1, 'pc-shine')}${px(76, 30, 1, 1, 'pc-shine')}${px(78, 36, 1, 1, 'pc-shine')}${px(76, 34, 1, 1, 'pc-shine')}</g>
        <g class="pc-ball">${px(17, 28, 3, 3, 'pc-gold')}${px(17, 28, 1, 1, 'pc-shine')}</g>
      </svg>`;
  }

  /** Fixed sprinkle of twinkling pixel stars for the hero background. */
  const STARS = [[6, 18], [14, 72], [22, 40], [9, 90], [30, 8], [38, 62], [55, 28], [64, 84], [72, 14], [80, 52], [86, 36], [18, 56], [46, 94], [68, 4]];
  const stars = () => STARS.map(([top, left], i) =>
    `<span class="px-star" style="top:${top}%;left:${left}%;--s:${i % 3};animation-delay:${(i * 0.37).toFixed(2)}s"></span>`).join('');

  V.dashboard = (root) => {
    const list = S.all();
    const counts = { upcoming: 0, ongoing: 0, completed: 0, draft: 0 };
    list.forEach((t) => { counts[M.status(t)]++; });

    const featured = list
      .slice()
      .sort((a, b) => ORDER[M.status(a)] - ORDER[M.status(b)] || (a.date || '').localeCompare(b.date || '') || b.updatedAt - a.updatedAt)
      .slice(0, 6);

    const stat = (cls, icon, value, label, i) => `
      <div class="stat stat-${cls} reveal" style="--d:${i}">
        <div class="stat-icon">${PSB.icon(icon)}</div>
        <div><div class="stat-value" data-count="${value}">${value}</div><div class="stat-label">${label}</div></div>
      </div>`;

    root.innerHTML = `
      <div class="page-full home-px">
        <section class="hero-band px-hero">
          <div class="px-stars" aria-hidden="true">${stars()}</div>
          <div class="container hero-grid">
            <div class="hero-content">
              <span class="px-eyebrow"><span class="px-blink" aria-hidden="true"></span>Compete · Advance · Win</span>
              <h1 data-split>From first serve to <span class="accent">champion.</span></h1>
              <div class="hero-buttons">
                <a class="btn btn-accent btn-lg" href="#/create">${PSB.icon('plus')}Create Tournament</a>
                ${list.length ? `<a class="btn btn-outline-light btn-lg" href="#/tournaments">Tournaments${PSB.icon('arrowRight', 'arrow')}</a>` : ''}
              </div>
            </div>
            <div class="hero-visual">${pixelCourt()}</div>
          </div>
        </section>

        <div class="container lift">
          <section class="stats px-scoreboard" aria-label="Tournament statistics">
            ${stat('total', 'trophy', list.length, 'Total', 0)}
            ${stat('upcoming', 'calendar', counts.upcoming + counts.draft, 'Upcoming', 1)}
            ${stat('ongoing', 'play', counts.ongoing, 'Ongoing', 2)}
            ${stat('completed', 'check', counts.completed, 'Completed', 3)}
          </section>
        </div>

        <section class="block block-tight">
          <div class="container">
            <div class="list-head reveal">
              <h2><mark class="hl">Tournaments</mark></h2>
              ${list.length > featured.length ? `<a class="btn btn-ghost btn-sm" href="#/tournaments">View all ${list.length}${PSB.icon('arrowRight', 'arrow')}</a>` : ''}
            </div>
            ${featured.length
              ? `<div class="t-rows">${featured.map((t, i) => C.tournamentRow(t, i)).join('')}</div>`
              : `<div class="card reveal">${C.empty({
                  icon: 'trophy',
                  title: 'No tournaments yet',
                  action: `<a class="btn btn-primary btn-lg" href="#/create">${PSB.icon('plus')}Create Tournament</a>`,
                })}</div>`}
          </div>
        </section>
      </div>`;
  };
})(window.PSB);
