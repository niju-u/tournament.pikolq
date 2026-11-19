/* =====================================================================
   Round-robin engine (pure data, no DOM).

   Entrants are split into pools (snake order by seed, so every pool gets
   a fair spread). Everyone plays everyone in their pool. Optionally the
   top N of each pool advance to a playoff bracket, which is an ordinary
   single- or double-elimination bracket built by those engines.

   Bracket shape:
   {
     format: 'round-robin', seeds, reset,
     pools: [{ name: 'A', ids: [...], rounds: [[match…]…] }],
     advance: N per pool (0 = no playoff, best record wins),
     playoffFormat: 'single-elim' | 'double-elim' | null,
     playoffMatches: planned playoff match count (for progress before it exists),
     qualifiers: [ids in playoff seed order] | null,
     playoff: inner single/double-elim bracket | null,
   }
   pool match: { id, stage: 'pool', pool, round, index, num,
                 slots, scores, winner, bye: false, completedAt }

   The playoff is DERIVED, like later rounds in the other engines: once
   every pool match has a result, sync() seeds the playoff from the
   standings. If a pool result later changes the qualifiers or their
   order, the playoff is rebuilt and its results are reported as cleared,
   so the score dialog can warn and confirm first.

   Every function also accepts a bare playoff bracket (the bracket view
   renders the playoff with the elimination code paths) and hands it to
   that bracket's own engine.
   ===================================================================== */
(function (PSB) {
  'use strict';

  const SE = PSB.bracketEngine;
  const DE = PSB.doubleElimEngine;
  const R = (PSB.roundRobinEngine = {});
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const POOL_NAMES = 'ABCDEFGH';

  R.format = 'round-robin';
  R.MIN_ENTRANTS = 3;
  R.MAX_ENTRANTS = 64;
  R.MAX_POOLS = 8;
  R.MIN_PER_POOL = 3;
  R.MAX_ADVANCE = 4;
  R.MAX_SCORE = SE.MAX_SCORE;
  R.validateScores = SE.validateScores;

  const isRR = (b) => !!b && b.format === 'round-robin';
  const engineOf = (b) => (b && b.format === 'double-elim' ? DE : SE);
  const isPool = (m) => !!m && m.stage === 'pool';
  const clampInt = (v, lo, hi, dflt) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };

  /** Normalised round-robin options from a tournament's `options`. */
  R.config = (opts = {}) => ({
    pools: clampInt(opts.pools, 1, R.MAX_POOLS, 1),
    advance: clampInt(opts.advance, 0, R.MAX_ADVANCE, 0),
    playoff: opts.playoff === 'double-elim' ? 'double-elim' : 'single-elim',
    reset: opts.gfReset !== false,
  });

  /** Pool sizes for n entrants: as even as possible, larger pools first. */
  const poolSizes = (n, p) => Array.from({ length: p }, (_, i) => Math.floor(n / p) + (i < n % p ? 1 : 0));

  /* ---------- Plan (before generating) ---------- */
  R.plan = (n, opts) => {
    if (n < R.MIN_ENTRANTS) return null;
    const c = R.config(opts);
    if (n < c.pools * R.MIN_PER_POOL) {
      return { error: `${c.pools} pools need at least ${c.pools * R.MIN_PER_POOL} entrants (${R.MIN_PER_POOL} per pool).` };
    }
    const sizes = poolSizes(n, c.pools);
    const smallest = Math.min(...sizes);
    if (c.pools > 1 && c.advance === 0) {
      return { error: 'With more than one pool, choose how many from each pool advance to the playoffs.' };
    }
    if (c.advance >= smallest) {
      return { error: `The smallest pool has ${smallest} — at most ${smallest - 1} per pool can advance.` };
    }
    const q = c.pools * c.advance;
    const hasPlayoff = q >= 2;
    const playoffFormat = !hasPlayoff ? null : c.playoff === 'double-elim' && q >= DE.MIN_ENTRANTS ? 'double-elim' : 'single-elim';
    const poolMatches = sizes.reduce((s, k) => s + (k * (k - 1)) / 2, 0);
    const playoffMatches = !hasPlayoff ? 0 : playoffFormat === 'double-elim' ? 2 * q - 2 : q - 1;
    const rounds = Math.max(...sizes.map((k) => (k % 2 ? k : k - 1)));
    return {
      pools: c.pools, sizes, rounds, poolMatches, qualifiers: hasPlayoff ? q : 0, advance: c.advance,
      playoffFormat, playoffMatches, matches: poolMatches + playoffMatches,
      fellBack: hasPlayoff && c.playoff === 'double-elim' && playoffFormat !== 'double-elim',
      toast: `Schedule generated — ${c.pools > 1 ? `${c.pools} pools, ` : ''}${poolMatches} pool matches${hasPlayoff ? `, then a ${q}-${q === 2 ? 'player final' : 'way playoff'}` : ''}.`,
    };
  };

  R.planRows = (n, opts) => {
    const p = R.plan(n, opts);
    if (!p || p.error) return [];
    const label = p.playoffFormat === 'double-elim' ? 'Double elim' : 'Single elim';
    return [
      ['Pools', p.pools === 1 ? '1 (everyone plays everyone)' : `${p.pools} · sizes ${p.sizes.join(', ')}`],
      ['Pool rounds', p.rounds],
      ['Pool matches', p.poolMatches],
      ['Playoffs', p.qualifiers ? `Top ${p.advance}${p.pools > 1 ? ' per pool' : ''} → ${p.qualifiers} · ${label}${p.fellBack ? ' (needs 4+ for double)' : ''}` : 'None — best record wins'],
      ['Matches to play', p.playoffFormat === 'double-elim' ? `${p.matches}–${p.matches + 1}` : p.matches],
    ];
  };

  /* ---------- Generation ---------- */
  /** Snake split by seed: 1→A, 2→B, …, then back the other way, so pools are balanced. */
  function split(ids, p) {
    const pools = Array.from({ length: p }, () => []);
    ids.forEach((id, i) => {
      const row = Math.floor(i / p);
      const col = i % p;
      pools[row % 2 === 0 ? col : p - 1 - col].push(id);
    });
    return pools;
  }

  /** Circle method: every pair meets exactly once; with an odd count one entrant sits out each round. */
  function schedule(ids) {
    const list = ids.slice();
    if (list.length % 2) list.push(null);
    const n = list.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = list[i];
        const c = list[n - 1 - i];
        if (a && c) pairs.push(r % 2 ? [c, a] : [a, c]);
      }
      rounds.push(pairs);
      list.splice(1, 0, list.pop()); // rotate everyone except the first entrant
    }
    return rounds;
  }

  R.generate = (ids, opts = {}) => {
    if (!Array.isArray(ids) || ids.length < R.MIN_ENTRANTS) {
      throw new Error(`Round robin needs at least ${R.MIN_ENTRANTS} entrants.`);
    }
    if (ids.length > R.MAX_ENTRANTS) throw new Error(`Round robin supports up to ${R.MAX_ENTRANTS} entrants.`);
    if (new Set(ids).size !== ids.length) throw new Error('Each entrant can appear only once.');
    const plan = R.plan(ids.length, opts);
    if (plan.error) throw new Error(plan.error);
    const c = R.config(opts);

    const pools = split(ids, c.pools).map((pids, p) => ({
      name: POOL_NAMES[p],
      ids: pids,
      rounds: schedule(pids).map((pairs, r) => pairs.map((slots, i) => ({
        id: `p${p}r${r}m${i}`, stage: 'pool', pool: p, round: r, index: i, num: null,
        slots, scores: [null, null], winner: null, bye: false, completedAt: null,
      }))),
    }));
    // Number matches in play order: round 1 of every pool, then round 2, …
    const maxRounds = Math.max(...pools.map((pl) => pl.rounds.length));
    let num = 1;
    for (let r = 0; r < maxRounds; r++) pools.forEach((pl) => (pl.rounds[r] || []).forEach((m) => { m.num = num++; }));

    const seeds = {};
    ids.forEach((id, i) => { seeds[id] = i + 1; });
    const b = {
      format: 'round-robin', seeds, pools, reset: c.reset,
      advance: plan.qualifiers ? c.advance : 0,
      playoffFormat: plan.playoffFormat, playoffMatches: plan.playoffMatches,
      qualifiers: null, playoff: null, generatedAt: Date.now(),
    };
    sync(b);
    return b;
  };

  /* ---------- Queries ---------- */
  const poolMatches = (b) => b.pools.flatMap((pl) => pl.rounds.flat());
  const poolsDone = (b) => poolMatches(b).every((m) => m.winner !== null);
  R.hasPlayoff = (b) => isRR(b) && b.advance > 0 && b.pools.length * b.advance >= 2;
  R.poolsDone = (b) => isRR(b) && poolsDone(b);

  R.all = (b) => (isRR(b) ? [...poolMatches(b), ...(b.playoff ? engineOf(b.playoff).all(b.playoff) : [])] : engineOf(b).all(b));
  R.find = (b, id) => {
    if (!isRR(b)) return engineOf(b).find(b, id);
    return poolMatches(b).find((m) => m.id === id) || (b.playoff ? engineOf(b.playoff).find(b.playoff, id) : null);
  };
  R.winnerOf = DE.winnerOf;
  R.loserOf = DE.loserOf;
  R.status = (m) => (isPool(m) ? (m.winner !== null ? 'completed' : 'ready') : DE.status(m));

  /**
   * Pool table, best first. Ties on wins are broken by head-to-head wins
   * among the tied entrants, then point difference, then points scored,
   * then original seed.
   */
  R.standings = (b, p) => {
    const pool = b.pools[p];
    const rows = {};
    pool.ids.forEach((id) => { rows[id] = { id, pool: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, diff: 0 }; });
    const done = pool.rounds.flat().filter((m) => m.winner !== null);
    done.forEach((m) => {
      m.slots.forEach((id, k) => {
        const row = rows[id];
        row.played++;
        row.pf += m.scores[k];
        row.pa += m.scores[1 - k];
        if (m.winner === k) row.won++; else row.lost++;
      });
    });
    const list = Object.values(rows);
    list.forEach((r) => { r.diff = r.pf - r.pa; });
    const seed = (id) => b.seeds[id] || 999;
    list.sort((x, y) => y.won - x.won || seed(x.id) - seed(y.id));
    // Re-order each block of entrants tied on wins.
    const out = [];
    for (let i = 0; i < list.length;) {
      let j = i;
      while (j < list.length && list[j].won === list[i].won) j++;
      const block = list.slice(i, j);
      if (block.length > 1) {
        const inBlock = new Set(block.map((r) => r.id));
        const h2h = {};
        block.forEach((r) => { h2h[r.id] = 0; });
        done.forEach((m) => {
          if (inBlock.has(m.slots[0]) && inBlock.has(m.slots[1])) h2h[m.slots[m.winner]]++;
        });
        block.sort((x, y) => h2h[y.id] - h2h[x.id] || y.diff - x.diff || y.pf - x.pf || seed(x.id) - seed(y.id));
      }
      out.push(...block);
      i = j;
    }
    out.forEach((r, i) => { r.rank = i + 1; });
    return out;
  };

  /** Pool record for an entrant (used for a champion decided without a playoff). */
  R.record = (b, id) => {
    if (!isRR(b)) return null;
    for (let p = 0; p < b.pools.length; p++) {
      const row = R.standings(b, p).find((r) => r.id === id);
      if (row) return row;
    }
    return null;
  };

  /** Qualifiers in playoff seed order: all pool winners first (best record first), then runners-up, … */
  R.qualifiers = (b) => {
    if (!R.hasPlayoff(b)) return [];
    const tables = b.pools.map((_, p) => R.standings(b, p));
    const pct = (r) => (r.played ? r.won / r.played : 0);
    const per = (r) => (r.played ? r.diff / r.played : 0);
    const out = [];
    for (let place = 0; place < b.advance; place++) {
      const tier = tables.map((tb) => tb[place]).filter(Boolean);
      tier.sort((x, y) => pct(y) - pct(x) || per(y) - per(x) || y.pf - x.pf || (b.seeds[x.id] || 0) - (b.seeds[y.id] || 0));
      out.push(...tier);
    }
    return spreadPools(out, b.pools.length);
  };

  /**
   * Avoid same-pool rematches in the first playoff round: swap a clashing
   * entrant with another of the same finishing place from a different pool.
   */
  function spreadPools(list, poolCount) {
    const q = list.length;
    if (poolCount < 2) return list;
    const order = SE.seedPositions(SE.sizeFor(q));
    const pairs = [];
    for (let i = 0; i < order.length; i += 2) pairs.push([order[i] - 1, order[i + 1] - 1]);
    const partner = {};
    pairs.forEach(([a, c]) => { partner[a] = c; partner[c] = a; });
    const clash = (i) => partner[i] < q && list[i] && list[partner[i]] && list[i].pool === list[partner[i]].pool;
    const tierOf = (i) => Math.floor(i / poolCount);
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let i = 0; i < q; i++) {
        if (!clash(i)) continue;
        // Move the lower seed of the clashing pair.
        const mover = Math.max(i, partner[i]);
        for (let j = 0; j < q; j++) {
          if (j === mover || tierOf(j) !== tierOf(mover)) continue;
          [list[mover], list[j]] = [list[j], list[mover]];
          if (!clash(mover) && !clash(j)) { changed = true; break; }
          [list[mover], list[j]] = [list[j], list[mover]];
        }
      }
      if (!changed) break;
    }
    return list;
  }

  /** Build the playoff bracket from qualifier ids; match numbers continue after the pool matches. */
  function buildPlayoff(b, ids) {
    const E = engineOf({ format: b.playoffFormat });
    const pb = E.generate(ids, { reset: b.reset });
    const offset = poolMatches(b).length;
    E.all(pb).forEach((m) => { if (m.num) m.num += offset; });
    return pb;
  }

  /**
   * Re-derive the playoff from the pool results. Returns ids of playoff
   * matches whose results were cleared because the playoff had to change.
   */
  function sync(b) {
    const cleared = [];
    const want = R.hasPlayoff(b) && poolsDone(b) ? R.qualifiers(b).map((r) => r.id) : null;
    if (JSON.stringify(want) !== JSON.stringify(b.qualifiers)) {
      if (b.playoff) {
        engineOf(b.playoff).all(b.playoff).forEach((m) => {
          if (!m.bye && !m.dead && !m.void && m.winner !== null) cleared.push(m.id);
        });
      }
      b.playoff = want ? buildPlayoff(b, want) : null;
      b.qualifiers = want;
    }
    return cleared;
  }
  R.sync = sync;

  R.champion = (b) => {
    if (!b) return null;
    if (!isRR(b)) return engineOf(b).champion(b);
    if (b.playoff) return engineOf(b.playoff).champion(b.playoff);
    if (R.hasPlayoff(b) || !poolsDone(b)) return null;
    return R.standings(b, 0)[0].id;
  };
  R.decidingMatch = (b) => {
    if (!isRR(b)) return engineOf(b).decidingMatch(b);
    return b.playoff ? engineOf(b.playoff).decidingMatch(b.playoff) : null;
  };
  R.isChampionship = (b, m) => {
    if (isPool(m)) return false;
    const pb = isRR(b) ? b.playoff : b;
    return !!pb && engineOf(pb).isChampionship(pb, m);
  };

  R.progress = (b) => {
    if (!isRR(b)) return engineOf(b).progress(b);
    const pm = poolMatches(b);
    const pool = { played: pm.filter((m) => m.winner !== null).length, total: pm.length };
    const po = b.playoff ? engineOf(b.playoff).progress(b.playoff) : { played: 0, total: b.playoffMatches || 0 };
    return { played: pool.played + po.played, total: pool.total + po.total };
  };

  R.hasResults = (b) => {
    if (!b) return false;
    if (!isRR(b)) return engineOf(b).hasResults(b);
    return poolMatches(b).some((m) => m.winner !== null) || (!!b.playoff && engineOf(b.playoff).hasResults(b.playoff));
  };

  /* ---------- Results ---------- */
  R.setResult = (b, matchId, rawA, rawB) => {
    if (!isRR(b)) return engineOf(b).setResult(b, matchId, rawA, rawB);
    const m = R.find(b, matchId);
    if (!m) throw new Error('Match not found.');
    if (!isPool(m)) return engineOf(b.playoff).setResult(b.playoff, matchId, rawA, rawB);
    const v = R.validateScores(rawA, rawB);
    if (!v.ok) throw new Error(v.error);
    m.scores = v.scores;
    m.winner = v.winner;
    m.completedAt = Date.now();
    return sync(b);
  };

  R.clearResult = (b, matchId) => {
    if (!isRR(b)) return engineOf(b).clearResult(b, matchId);
    const m = R.find(b, matchId);
    if (!m) throw new Error('Match not found.');
    if (!isPool(m)) return engineOf(b.playoff).clearResult(b.playoff, matchId);
    m.scores = [null, null];
    m.winner = null;
    m.completedAt = null;
    return sync(b);
  };

  R.restart = (b) => {
    if (!isRR(b)) { engineOf(b).restart(b); return; }
    poolMatches(b).forEach((m) => { m.scores = [null, null]; m.winner = null; m.completedAt = null; });
    b.playoff = null;
    b.qualifiers = null;
    sync(b);
  };

  R.preview = (b, op) => op(clone(b)) || [];

  // Pools are drawn from the seed list; there is no first-round line-up to swap.
  R.positions = () => ({});
  R.isFirstRound = () => false;
  R.swapEntrants = () => { throw new Error('Pool line-ups are fixed. Reset the bracket to change the draw.'); };

  /* ---------- Presentation helpers ---------- */
  R.poolName = (b, p) => `Pool ${b.pools[p].name}`;

  R.stages = (b) => {
    if (!isRR(b)) return engineOf(b).stages(b);
    const maxRounds = Math.max(...b.pools.map((pl) => pl.rounds.length));
    const stages = [];
    for (let r = 0; r < maxRounds; r++) {
      stages.push({
        key: `pr${r}`, group: 'Pools', pools: true,
        name: `Pool play · Round ${r + 1}`, tab: `Round ${r + 1}`,
        matches: b.pools.flatMap((pl) => pl.rounds[r] || []),
      });
    }
    if (b.playoff) {
      engineOf(b.playoff).stages(b.playoff).forEach((s) => {
        stages.push({ ...s, key: `po-${s.key}`, group: `Playoffs${s.group ? ` · ${s.group}` : ''}` });
      });
    } else if (R.hasPlayoff(b)) {
      stages.push({ key: 'po', group: 'Playoffs', name: 'Playoffs', tab: 'Playoffs', matches: [], placeholder: true });
    }
    return stages;
  };

  R.stageName = (b, m) => {
    if (isPool(m)) return `${R.poolName(b, m.pool)} · Round ${m.round + 1}`;
    const pb = isRR(b) ? b.playoff : b;
    return engineOf(pb).stageName(pb, m);
  };

  R.title = (b, m) => {
    if (isPool(m)) return `Match ${m.num}`;
    const pb = isRR(b) ? b.playoff : b;
    return engineOf(pb).title(pb, m);
  };

  R.slotHint = (b, m, k) => {
    if (isPool(m)) return 'To be decided';
    const pb = isRR(b) ? b.playoff : b;
    return engineOf(pb).slotHint(pb, m, k);
  };

  R.destinations = (b, m) => {
    if (isPool(m)) return { winner: null, loser: null };
    const pb = isRR(b) ? b.playoff : b;
    return engineOf(pb).destinations(pb, m);
  };
})(window.PSB);
