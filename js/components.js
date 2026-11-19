/* Reusable HTML builders shared across views. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const C = (PSB.components = {});
  const esc = U.esc;

  C.statusBadge = (status) => {
    const s = M.STATUS[status] || M.STATUS.draft;
    return `<span class="badge badge-dot badge-${status}">${s.label}</span>`;
  };

  C.typeBadge = (t) => {
    const info = M.typeInfo(t);
    return `<span class="badge badge-type">${PSB.icon(info.icon)}${info.label}</span>`;
  };

  C.countLabel = (t, n = t.participants.length) => {
    const info = M.typeInfo(t);
    return U.plural(n, info.unit, info.units);
  };

  C.empty = ({ icon = 'bracket', img, title, text, action = '' }) => `
    <div class="empty">
      <div class="empty-art">${img ? `<img src="${img}" alt="" />` : PSB.icon(icon)}</div>
      <h3>${esc(title)}</h3>
      ${text ? `<p>${text}</p>` : ''}
      ${action}
    </div>`;

  /* ---------- Tournament summary card ---------- */
  C.tournamentCard = (t, i = 0, { compact = false } = {}) => {
    const status = M.status(t);
    const prog = M.progress(t);
    const champ = M.championInfo(t);
    const pct = prog.total ? Math.round((prog.played / prog.total) * 100) : 0;
    const base = `#/t/${encodeURIComponent(t.id)}`;
    const primary = t.bracket
      ? `<a class="btn btn-primary btn-sm" href="${base}/bracket">${PSB.icon('bracket')}View Bracket</a>`
      : `<a class="btn btn-primary btn-sm" href="${base}/participants">${PSB.icon('users')}Set up ${M.typeInfo(t).units}</a>`;

    return `
      <article class="card t-card" style="--i:${i}">
        <div class="t-card-top">
          <h3 class="t-card-title"><a href="${base}/${t.bracket ? 'bracket' : 'participants'}">${esc(t.name)}</a></h3>
          ${C.statusBadge(status)}
        </div>
        <div class="t-meta">
          <span>${PSB.icon('calendar', 'icon-sm')}${esc(U.formatDate(t.date))}</span>
          <span>${PSB.icon(M.typeInfo(t).icon, 'icon-sm')}${esc(C.countLabel(t))}</span>
        </div>
        <div class="t-badges">${C.typeBadge(t)}<span class="badge badge-type">${esc(M.formatLabel(t))}</span></div>
        ${champ ? `<div class="t-champ">${PSB.icon('trophy')}<span>Champion: <strong>${esc(champ.name)}</strong></span></div>` : ''}
        ${t.bracket ? `
          <div>
            <div class="progress-row"><span>Matches played</span><span>${prog.played} / ${prog.total}</span></div>
            <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${prog.total}" aria-valuenow="${prog.played}" aria-label="Matches played"><span style="width:${pct}%"></span></div>
          </div>` : ''}
        <div class="t-card-actions">
          ${primary}
          ${compact ? '' : `
            <a class="icon-btn" href="${base}/participants" title="Manage ${M.typeInfo(t).units}" aria-label="Manage ${M.typeInfo(t).units} for ${esc(t.name)}">${PSB.icon('users')}</a>
            <a class="icon-btn" href="${base}/settings" title="Edit tournament" aria-label="Edit ${esc(t.name)}">${PSB.icon('edit')}</a>
            <button type="button" class="icon-btn is-danger" data-action="delete" data-id="${esc(t.id)}" title="Delete tournament" aria-label="Delete ${esc(t.name)}">${PSB.icon('trash')}</button>`}
        </div>
      </article>`;
  };

  /** Dark hero band used at the top of inner pages (portfolio "services hero"). */
  C.pageHero = ({ eyebrow = '', title, text = '', actions = '', back = '', meta = '', center = false }) => `
    <section class="page-hero ${center ? 'is-center' : ''}">
      <span class="orb orb-1" aria-hidden="true"></span><span class="orb orb-2" aria-hidden="true"></span>
      <div class="container">
        ${back}
        <div class="page-hero-row">
          <div>
            ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
            <h1 data-split>${title}</h1>
            ${text ? `<p>${text}</p>` : ''}
            ${meta}
          </div>
          ${actions ? `<div class="page-hero-actions">${actions}</div>` : ''}
        </div>
      </div>
    </section>`;

  /** Numbered list row (portfolio "case study" card) used on the dashboard. */
  C.tournamentRow = (t, i = 0) => {
    const status = M.status(t);
    const prog = M.progress(t);
    const champ = M.championInfo(t);
    const pct = prog.total ? Math.round((prog.played / prog.total) * 100) : 0;
    const href = `#/t/${encodeURIComponent(t.id)}/${t.bracket ? 'bracket' : 'participants'}`;
    let side;
    if (champ) side = `<strong>${PSB.icon('trophy', 'icon-sm')} ${esc(champ.name)}</strong><small>Champion</small>`;
    else if (t.bracket) side = `<strong>${prog.played} / ${prog.total} matches</strong><small>played so far</small><div class="progress"><span style="width:${pct}%"></span></div>`;
    else side = `<strong>${esc(C.countLabel(t))}</strong><small>Draft — bracket not generated</small>`;
    return `
      <a class="t-row reveal" style="--d:${i}" href="${href}">
        <span class="t-row-num">${String(i + 1).padStart(2, '0')}</span>
        <div class="t-row-info">
          <h3>${esc(t.name)}</h3>
          <div class="tag-row"><span class="tag">${esc(M.typeInfo(t).label)}</span><span class="tag">${esc(M.formatLabel(t))}</span>${C.statusBadge(status)}</div>
          <div class="t-meta">
            <span>${PSB.icon('calendar', 'icon-sm')}${esc(U.formatDate(t.date))}</span>
            <span>${PSB.icon(M.typeInfo(t).icon, 'icon-sm')}${esc(C.countLabel(t))}</span>
          </div>
        </div>
        <div class="t-row-side">${side}<span class="t-row-go">${t.bracket ? 'View bracket' : 'Set up'}${PSB.icon('arrowRight', 'icon-sm')}</span></div>
      </a>`;
  };

  C.deleteTournament = async (t) => {
    const ok = await PSB.ui.confirm({
      title: 'Delete tournament?',
      message: `<p><strong>${esc(t.name)}</strong> and all of its ${esc(M.typeInfo(t).units)}, matches and results will be permanently removed from this browser.</p><p>This can't be undone.</p>`,
      confirmLabel: 'Delete tournament',
      danger: true,
      icon: 'trash',
    });
    if (!ok) return false;
    PSB.store.remove(t.id);
    PSB.ui.toast(`Deleted “${t.name}”.`);
    return true;
  };

  /* ---------- Match card ---------- */
  function placeholder(cls, text) {
    return `<div class="team ${cls}"><span class="team-seed"></span><span class="team-name"><span class="tn-main">${esc(text)}</span></span><span class="team-score"></span></div>`;
  }

  function teamRow(t, b, m, k, E) {
    const pid = m.slots[k];
    const st = E.status(m);
    if (!pid) {
      const empty = m.empty ? m.empty[k] : m.bye;
      if (empty) return placeholder('is-bye-slot', 'BYE');
      if (m.void) return placeholder('is-tbd', 'Not needed');
      return placeholder('is-tbd', E.slotHint(b, m, k));
    }
    const p = M.entrant(t, pid);
    const cls = m.winner === null || m.winner === undefined ? '' : m.winner === k ? (m.bye ? 'is-winner is-advance' : 'is-winner') : 'is-loser';
    const sub = M.sub(t, p);
    const score = st === 'completed' && m.scores[k] !== null ? m.scores[k] : '';
    // Unnamed doubles teams show one partner per line so neither name gets cut off.
    const nameHtml = t.type === 'doubles' && p && !p.team
      ? `<span class="tn-main">${esc(p.players[0])}</span><span class="tn-main tn-second">${esc(p.players[1])}</span>`
      : `<span class="tn-main">${esc(M.name(t, p))}</span>${sub ? `<span class="tn-sub">${esc(sub)}</span>` : ''}`;
    return `
      <div class="team ${cls}" data-pid="${esc(pid)}">
        <span class="team-seed" title="Seed">${b.seeds[pid] || ''}</span>
        <span class="team-name" title="${esc(M.name(t, p))}${sub ? ` (${esc(sub)})` : ''}">${nameHtml}</span>
        <span class="team-score">${score}</span>
      </div>`;
  }

  const STATUS_LABEL = {
    completed: ['Done', 'check'],
    ready: ['Ready', 'play'],
    pending: ['Waiting', 'clock'],
    bye: ['Auto', 'arrowRight'],
    void: ['Skipped', 'x'],
  };

  /** "Winner → Match 9 · Semifinals" / "Loser → Match 7 · Losers Round 2" lines. */
  C.nextLines = (t, b, m, E = PSB.engineFor(t)) => {
    const d = E.destinations(b, m);
    const line = (icon, who, x) => `<div class="match-next">${PSB.icon(icon)}${who} → ${esc(E.title(b, x))} · ${esc(E.stageName(b, x))}</div>`;
    let html = '';
    if (d.winner) html += line('arrowRight', 'Winner', d.winner);
    else if (E.isChampionship(b, m)) {
      html += `<div class="match-next">${PSB.icon('trophy')}${m.id === 'gf1' && b.reset ? 'Winners-side win = champion; otherwise a reset match' : 'Winner is the champion'}</div>`;
    }
    if (d.loser) html += line('down', 'Loser', d.loser);
    return html;
  };

  C.matchCard = (t, b, m, { i = 0, showNext = false } = {}) => {
    const E = PSB.engineFor(t);
    const st = E.status(m);
    const clickable = st !== 'pending' && st !== 'void';
    const tag = clickable ? 'button' : 'div';
    const [label, icon] = STATUS_LABEL[st];
    const title = E.title(b, m);
    const names = m.slots.map((id) => (id ? M.nameById(t, id) : 'TBD'));
    let aria = `${E.stageName(b, m)}, ${title}`;
    if (st === 'bye') aria += `: ${m.slots[m.winner] ? names[m.winner] : 'the entrant'} advances automatically`;
    else if (st === 'void') aria += ': not played';
    else aria += `: ${names[0]} versus ${names[1]}`;
    if (st === 'completed') aria += `. ${names[m.winner]} won ${m.scores[m.winner]} to ${m.scores[1 - m.winner]}. Activate to edit the result.`;
    if (st === 'ready') aria += '. Activate to enter the score.';
    if (st === 'pending') aria += '. Waiting for earlier matches.';
    const tagHtml = m.bracket === 'W' || m.bracket === 'L' ? `<span class="bracket-tag tag-${m.bracket.toLowerCase()}">${m.bracket}</span>` : '';

    return `
      <${tag} ${clickable ? 'type="button"' : ''} class="match status-${st} ${m.bye ? 'is-bye' : ''} ${m.bracket === 'GF' ? 'is-gf' : ''}" data-mid="${m.id}" style="--i:${i}" aria-label="${esc(aria)}">
        <div class="match-head">
          <span class="match-title">${tagHtml}${esc(title)}</span>
          <span class="match-status ms-${st}">${PSB.icon(icon)}${label}</span>
        </div>
        ${teamRow(t, b, m, 0, E)}
        ${teamRow(t, b, m, 1, E)}
        ${st === 'ready' ? `<span class="match-cta">${PSB.icon('edit', 'icon-sm')}Enter score</span>` : ''}
        ${showNext ? C.nextLines(t, b, m, E) : ''}
      </${tag}>`;
  };

  C.champCard = (t, b, { i = 0 } = {}) => {
    const champ = M.championInfo(t);
    if (!champ) {
      return `
        <div class="champ-card is-tbd" style="--i:${i}">
          <div class="champ-trophy">${PSB.trophySVG()}</div>
          <span class="champ-card-label">Champion</span>
          <span class="champ-card-name">To be decided</span>
          <span class="champ-card-sub" style="color:var(--text-2)">${b.format === 'round-robin' && !PSB.roundRobinEngine.hasPlayoff(b) ? 'Best record after pool play' : `Winner of the ${b.format === 'double-elim' || (b.playoff && b.playoff.format === 'double-elim') ? 'Grand Final' : 'final'}`}</span>
        </div>`;
    }
    const sub = t.type === 'doubles' ? champ.players.join(' & ') : '';
    return `
      <div class="champ-card" style="--i:${i}" data-champ="${esc(champ.id)}">
        <div class="champ-trophy">${PSB.trophySVG()}</div>
        <span class="champ-card-label">${t.type === 'doubles' ? 'Champions' : 'Champion'}</span>
        <span class="champ-card-name">${esc(champ.name)}</span>
        ${sub && champ.teamName ? `<span class="champ-card-sub">${esc(sub)}</span>` : ''}
        <span class="champ-card-sub">${champ.score ? `Final ${champ.score[0]}–${champ.score[1]}` : champ.record ? `Record ${champ.record.won}–${champ.record.lost} · ${champ.record.diff > 0 ? '+' : ''}${champ.record.diff}` : ''}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-action="champion">${PSB.icon('sparkle')}Celebrate</button>
      </div>`;
  };
})(window.PSB);
