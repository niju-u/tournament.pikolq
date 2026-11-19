/* Champion presentation overlay with a light confetti burst. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const esc = U.esc;
  const CH = (PSB.champion = {});
  let current = null;

  const COLORS = ['#A489B8', '#6F527F', '#E5D8ED', '#F7D774', '#D9A93A', '#8FD1A8', '#FFFFFF'];

  function confetti(canvas) {
    if (U.reducedMotion()) return () => {};
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(160, Math.round(w / 6));
    const parts = Array.from({ length: count }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.32 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 13,
      vy: -Math.random() * 13 - 4,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      round: Math.random() < 0.3,
    }));

    const start = performance.now();
    const DURATION = 3800;
    let raf = 0;
    const tick = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const fade = t > DURATION - 900 ? Math.max(0, (DURATION - t) / 900) : 1;
      parts.forEach((p) => {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      });
      if (t < DURATION) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }

  CH.close = () => {
    if (!current) return;
    const { el, stop, prevFocus, onKey } = current;
    current = null;
    stop();
    document.removeEventListener('keydown', onKey, true);
    el.classList.add('is-closing');
    setTimeout(() => el.remove(), U.reducedMotion() ? 0 : 250);
    document.body.style.overflow = '';
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  };

  /** Show the champion presentation for a completed tournament. */
  CH.show = (t) => {
    const champ = M.championInfo(t);
    if (!champ) return;
    CH.close();

    const doubles = t.type === 'doubles';
    const players = doubles
      ? `<div class="champ-players">${champ.players.map((n) => `<span class="champ-player">${PSB.icon('user')}${esc(n)}</span>`).join('')}</div>`
      : '';
    const title = doubles && !champ.teamName ? champ.players.join(' & ') : champ.name;

    const el = document.createElement('div');
    el.className = 'champ-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'champ-name');
    el.innerHTML = `
      <canvas class="confetti-canvas" aria-hidden="true"></canvas>
      <div class="champ-stage">
        <button type="button" class="icon-btn champ-close" data-close aria-label="Close">${PSB.icon('x')}</button>
        <div class="champ-brand"><span class="sponsor-label">Sponsored by</span><img src="img/pickle-sa-balay.webp" alt="Pickle sa Balay" width="640" height="298" /></div>
        <p class="champ-event">${esc(t.name)}</p>
        <p class="champ-date">${esc(U.formatDate(t.date, { month: 'long', day: 'numeric', year: 'numeric' }))} · ${M.typeInfo(t).label}</p>
        <div class="champ-trophy-wrap">
          <div class="champ-rays" aria-hidden="true"></div>
          ${PSB.trophySVG('champ-trophy-big')}
        </div>
        <p class="champ-label">${doubles ? 'Champions' : 'Champion'}</p>
        <h2 class="champ-name" id="champ-name">${esc(title)}</h2>
        ${doubles && champ.teamName ? players : ''}
        ${champ.score ? `<div class="champ-final">
          <span class="champ-final-label">${t.bracket && (t.bracket.format === 'double-elim' || (t.bracket.playoff && t.bracket.playoff.format === 'double-elim')) ? 'Grand Final' : 'Final'}</span>
          <span class="champ-final-score">${champ.score[0]} – ${champ.score[1]}</span>
          <span class="champ-final-vs">vs ${esc(champ.opponent)}</span>
        </div>` : champ.record ? `<div class="champ-final">
          <span class="champ-final-label">Round robin record</span>
          <span class="champ-final-score">${champ.record.won} – ${champ.record.lost}</span>
          <span class="champ-final-vs">${champ.record.diff > 0 ? '+' : ''}${champ.record.diff} point difference</span>
        </div>` : ''}
        <div class="champ-actions">
          <button type="button" class="btn btn-ghost" data-close>Close</button>
          <button type="button" class="btn btn-primary" data-replay>${PSB.icon('sparkle')}Celebrate again</button>
        </div>
      </div>`;

    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    const canvas = el.querySelector('canvas');
    let stop = confetti(canvas);

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); CH.close(); }
    };
    document.addEventListener('keydown', onKey, true);

    current = { el, stop: () => stop(), prevFocus: document.activeElement, onKey };
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === el) CH.close();
      if (e.target.closest('[data-replay]')) {
        stop();
        stop = confetti(canvas);
      }
    });
    if (U.reducedMotion()) el.querySelector('[data-replay]').hidden = true;
    requestAnimationFrame(() => el.querySelector('.champ-actions .btn-ghost').focus({ preventScroll: true }));
  };
})(window.PSB);
