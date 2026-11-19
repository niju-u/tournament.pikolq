/* =====================================================================
   Double-elimination bracket engine (pure data, no DOM).

   Everyone starts in the Winners bracket. A first loss drops you into
   the Losers bracket; a second loss knocks you out. The Winners and
   Losers champions meet in the Grand Final. With "bracket reset" on,
   if the Losers-bracket side wins the Grand Final (handing the other
   side its first loss) a deciding second match is played.

   Bracket shape:
   {
     format: 'double-elim', size, seeds, reset: bool,
     rounds:  [[match…]…]   // Winners bracket (same layout as single elim)
     losers:  [[match…]…]   // Losers bracket
     finals:  [gf1, gf2?]   // Grand Final (+ reset match)
   }
   match: { id, bracket:'W'|'L'|'GF', round, index, num,
            sources:[src, src], empty:[bool, bool],
            slots, scores, winner, bye, dead, void, completedAt }
   src:   { seed: true } | { from: matchId, take: 'winner' | 'loser' | 'reset' }

   `empty` marks a side that can never be filled (it traces back to a
   first-round BYE). That is fixed when the bracket is generated, so
   BYEs and dead matches are known up front. Every other slot is
   re-derived from earlier results by sync().
   ===================================================================== */
(function (PSB) {
  'use strict';

  const SE = PSB.bracketEngine;
  const D = (PSB.doubleElimEngine = {});
  const clone = (o) => JSON.parse(JSON.stringify(o));

  D.format = 'double-elim';
  D.MIN_ENTRANTS = 4;
  D.MAX_ENTRANTS = 64;
  D.MAX_SCORE = SE.MAX_SCORE;
  D.validateScores = SE.validateScores;
  D.sizeFor = SE.sizeFor;

  D.plan = (n) => {
    if (n < D.MIN_ENTRANTS) return null;
    const size = SE.sizeFor(n);
    const k = Math.log2(size);
    return { size, byes: size - n, wRounds: k, lRounds: 2 * (k - 1), matches: 2 * n - 2 };
  };

  D.planRows = (n) => {
    const p = D.plan(n);
    if (!p) return [];
    return [
      ['Bracket size', p.size],
      ['BYEs', p.byes],
      ['Winners rounds', p.wRounds],
      ['Losers rounds', p.lRounds],
      ['Matches to play', `${p.matches}–${p.matches + 1}`],
    ];
  };

  /* ---------- Queries ---------- */
  D.ordered = (b) => [...b.rounds.flat(), ...b.losers.flat(), ...b.finals];
  D.all = D.ordered;
  D.find = (b, id) => D.ordered(b).find((m) => m.id === id) || null;
  const index = (b) => {
    const map = {};
    D.ordered(b).forEach((m) => { map[m.id] = m; });
    return map;
  };

  D.winnerOf = (m) => (m && m.winner !== null && m.winner !== undefined ? m.slots[m.winner] : null);
  D.loserOf = (m) => (m && !m.bye && !m.dead && m.winner !== null && m.winner !== undefined ? m.slots[1 - m.winner] : null);

  /** 'void' (never played) | 'bye' | 'completed' | 'ready' | 'pending' */
  D.status = (m) => {
    if (m.dead || m.void) return 'void';
    if (m.bye) return 'bye';
    if (m.winner !== null) return 'completed';
    if (m.slots[0] && m.slots[1]) return 'ready';
    return 'pending';
  };

  const isReal = (m) => !m.bye && !m.dead && !m.void;

  D.champion = (b) => {
    if (!b) return null;
    const [gf1, gf2] = b.finals;
    if (gf1.winner === null) return null;
    if (gf1.winner === 0 || !gf2) return D.winnerOf(gf1);
    return D.winnerOf(gf2);
  };

  D.decidingMatch = (b) => {
    if (!D.champion(b)) return null;
    const [gf1, gf2] = b.finals;
    return gf2 && gf1.winner === 1 ? gf2 : gf1;
  };

  D.isChampionship = (b, m) => m.bracket === 'GF';

  D.progress = (b) => {
    const real = D.ordered(b).filter((m) => isReal(m) && !(m.id === 'gf2' && b.finals[0].winner !== 1));
    return { played: real.filter((m) => m.winner !== null).length, total: real.length };
  };

  D.hasResults = (b) => !!b && D.ordered(b).some((m) => isReal(m) && m.winner !== null);

  D.positions = (b) => {
    const map = {};
    b.rounds[0].forEach((m) => m.slots.forEach((id, slot) => { if (id) map[id] = { match: m, slot }; }));
    return map;
  };

  /* ---------- Generation ---------- */
  function mk(id, bracket, round, idx) {
    return {
      id, bracket, round, index: idx, num: null,
      sources: [null, null], empty: [false, false],
      slots: [null, null], scores: [null, null], winner: null,
      bye: false, dead: false, void: false, completedAt: null,
    };
  }
  const W = (id) => ({ from: id, take: 'winner' });
  const Lz = (id) => ({ from: id, take: 'loser' });

  /** Spread players dropping from the Winners bracket so they avoid an instant rematch. */
  function dropIndex(j, i, count) {
    if (count === 1) return 0;
    return j % 2 === 1 ? count - 1 - i : (i + count / 2) % count;
  }

  D.generate = (ids, opts = {}) => {
    if (!Array.isArray(ids) || ids.length < D.MIN_ENTRANTS) {
      throw new Error(`Double elimination needs at least ${D.MIN_ENTRANTS} entrants.`);
    }
    if (ids.length > D.MAX_ENTRANTS) throw new Error(`Brackets support up to ${D.MAX_ENTRANTS} entrants.`);
    if (new Set(ids).size !== ids.length) throw new Error('Each entrant can appear only once.');

    const size = SE.sizeFor(ids.length);
    const k = Math.log2(size);
    const order = SE.seedPositions(size);

    // Winners bracket
    const wr = [];
    for (let r = 0; r < k; r++) {
      const ms = [];
      for (let i = 0; i < size >> (r + 1); i++) {
        const m = mk(`w${r}m${i}`, 'W', r, i);
        if (r === 0) {
          m.sources = [{ seed: true }, { seed: true }];
          m.slots = [ids[order[2 * i] - 1] || null, ids[order[2 * i + 1] - 1] || null];
          m.empty = [!m.slots[0], !m.slots[1]];
        } else {
          m.sources = [W(wr[r - 1][2 * i].id), W(wr[r - 1][2 * i + 1].id)];
        }
        ms.push(m);
      }
      wr.push(ms);
    }

    // Losers bracket: a "first losers" round, then alternating drop-in / reduce rounds.
    const lr = [];
    const addRound = (count, makeSources) => {
      const r = lr.length;
      const ms = [];
      for (let i = 0; i < count; i++) {
        const m = mk(`l${r}m${i}`, 'L', r, i);
        m.sources = makeSources(i);
        ms.push(m);
      }
      lr.push(ms);
    };
    addRound(size / 4, (i) => [Lz(wr[0][2 * i].id), Lz(wr[0][2 * i + 1].id)]);
    for (let j = 1; j < k; j++) {
      const prev = lr[lr.length - 1];
      const count = size >> (j + 1);
      addRound(count, (i) => [W(prev[i].id), Lz(wr[j][dropIndex(j, i, count)].id)]);
      if (j < k - 1) {
        const p2 = lr[lr.length - 1];
        addRound(size >> (j + 2), (i) => [W(p2[2 * i].id), W(p2[2 * i + 1].id)]);
      }
    }

    // Grand Final (+ optional reset)
    const gf1 = mk('gf1', 'GF', 0, 0);
    gf1.sources = [W(wr[k - 1][0].id), W(lr[lr.length - 1][0].id)];
    const finals = [gf1];
    if (opts.reset !== false) {
      const gf2 = mk('gf2', 'GF', 1, 0);
      gf2.sources = [{ from: 'gf1', take: 'reset' }, { from: 'gf1', take: 'reset' }];
      finals.push(gf2);
    }

    const seeds = {};
    ids.forEach((id, i) => { seeds[id] = i + 1; });
    const b = { format: 'double-elim', size, seeds, reset: finals.length === 2, rounds: wr, losers: lr, finals, generatedAt: Date.now() };

    markByes(b);
    let n = 1;
    D.ordered(b).forEach((m) => { if (!m.bye && !m.dead && m.bracket !== 'GF') m.num = n++; });
    sync(b);
    return b;
  };

  /** Work out (once) which sides can never be filled, and so which matches are BYEs or dead. */
  function markByes(b) {
    const byId = index(b);
    D.ordered(b).forEach((m) => {
      if (m.id === 'gf2') return;
      if (!(m.bracket === 'W' && m.round === 0)) {
        m.empty = m.sources.map((src) => {
          const f = byId[src.from];
          return src.take === 'winner' ? f.dead : f.bye || f.dead;
        });
      }
      m.dead = m.empty[0] && m.empty[1];
      m.bye = !m.dead && (m.empty[0] || m.empty[1]);
      m.winner = m.bye ? (m.empty[0] ? 1 : 0) : null;
    });
  }

  /**
   * Re-derive every slot from earlier results. Matches whose line-up changes
   * lose their (now invalid) result. Returns ids of matches whose results were cleared.
   */
  function sync(b) {
    const byId = index(b);
    const cleared = [];
    const clear = (m) => {
      if (isReal(m) && m.winner !== null) cleared.push(m.id);
      if (!m.bye) m.winner = null;
      m.scores = [null, null];
      m.completedAt = null;
    };

    D.ordered(b).forEach((m) => {
      if (m.bracket === 'W' && m.round === 0) return;
      let want;
      if (m.id === 'gf2') {
        const g = byId.gf1;
        const voided = g.winner === 0;
        want = g.winner === 1 ? [g.slots[0], g.slots[1]] : [null, null];
        if (voided && m.winner !== null) clear(m);
        m.void = voided;
      } else {
        want = m.sources.map((src, k) => {
          if (m.empty[k]) return null;
          const f = byId[src.from];
          return src.take === 'winner' ? D.winnerOf(f) : D.loserOf(f);
        });
      }
      if (want[0] !== m.slots[0] || want[1] !== m.slots[1]) {
        if (isReal(m) && m.winner !== null) clear(m);
        m.slots = want;
      }
    });
    return cleared;
  }
  D.sync = sync;

  /* ---------- Results ---------- */
  D.setResult = (b, matchId, rawA, rawB) => {
    const m = D.find(b, matchId);
    if (!m) throw new Error('Match not found.');
    if (!isReal(m)) throw new Error(m.void ? 'The reset match is not needed.' : 'BYE matches advance automatically and have no score.');
    if (!m.slots[0] || !m.slots[1]) throw new Error('Both sides of this match must be decided first.');
    const v = D.validateScores(rawA, rawB);
    if (!v.ok) throw new Error(v.error);
    m.scores = v.scores;
    m.winner = v.winner;
    m.completedAt = Date.now();
    return sync(b);
  };

  D.clearResult = (b, matchId) => {
    const m = D.find(b, matchId);
    if (!m) throw new Error('Match not found.');
    if (!isReal(m)) throw new Error('This match has no result to reset.');
    m.scores = [null, null];
    m.winner = null;
    m.completedAt = null;
    return sync(b);
  };

  D.restart = (b) => {
    D.ordered(b).forEach((m) => {
      if (m.bye || m.dead) return;
      m.scores = [null, null];
      m.winner = null;
      m.completedAt = null;
    });
    sync(b);
  };

  /** Swap two entrants' first-round positions. BYE placement stays fixed. */
  D.swapEntrants = (b, idA, idB) => {
    if (!idA || !idB || idA === idB) throw new Error('Choose two different entrants to swap.');
    const pos = D.positions(b);
    const pa = pos[idA];
    const pb = pos[idB];
    if (!pa || !pb) throw new Error('Both entrants must be in the first round.');
    [pa.match, pb.match].forEach((m) => {
      if (!m.bye && m.winner !== null) {
        throw new Error(`Match ${m.num} already has a result. Reset it first to change its players.`);
      }
    });
    pa.match.slots[pa.slot] = idB;
    pb.match.slots[pb.slot] = idA;
    return sync(b);
  };

  D.preview = (b, op) => op(clone(b)) || [];

  /* ---------- Presentation helpers ---------- */
  const wName = (b, r) => {
    const k = b.rounds.length;
    return r === k - 1 ? 'Winners Final' : SE.roundName(r, k);
  };
  const lName = (b, r) => (r === b.losers.length - 1 ? 'Losers Final' : `Losers Round ${r + 1}`);

  D.stages = (b) => {
    const k = b.rounds.length;
    return [
      ...b.rounds.map((matches, r) => ({
        key: `w${r}`, group: 'Winners', name: wName(b, r),
        tab: r === k - 1 ? 'W Final' : `W ${SE.roundShort(r, k)}`, matches,
      })),
      ...b.losers.map((matches, r) => ({
        key: `l${r}`, group: 'Losers', name: lName(b, r),
        tab: r === b.losers.length - 1 ? 'L Final' : `L R${r + 1}`, matches,
      })),
      { key: 'gf', group: 'Final', name: 'Grand Final', tab: 'Grand Final', matches: b.finals },
    ];
  };

  D.stageName = (b, m) => {
    if (m.bracket === 'GF') return m.id === 'gf2' ? 'Grand Final · Reset' : 'Grand Final';
    if (m.bracket === 'L') return lName(b, m.round);
    const n = wName(b, m.round);
    return n.startsWith('Winners') ? n : `Winners · ${n}`;
  };

  D.title = (b, m) => {
    if (m.id === 'gf1') return 'Grand Final';
    if (m.id === 'gf2') return 'Final Reset';
    if (m.dead) return 'No match';
    return m.bye ? 'BYE' : `Match ${m.num}`;
  };

  D.isFirstRound = (b, m) => m.bracket === 'W' && m.round === 0;

  D.slotHint = (b, m, k) => {
    if (m.id === 'gf2') return 'Only if needed';
    const src = m.sources[k];
    if (!src || src.seed) return 'To be decided';
    const f = D.find(b, src.from);
    // A BYE just passes its one entrant through, so describe where that entrant comes from.
    if (f.bye && src.take === 'winner') return D.slotHint(b, f, f.empty[0] ? 1 : 0);
    if (src.take === 'winner' && f.bracket === 'W' && f.round === b.rounds.length - 1) return 'Winners champion';
    if (src.take === 'winner' && f.bracket === 'L' && f.round === b.losers.length - 1) return 'Losers champion';
    return `${src.take === 'winner' ? 'Winner' : 'Loser'} of ${D.title(b, f)}`;
  };

  function directDestinations(b, m) {
    const out = { winner: null, loser: null };
    if (m.id === 'gf1') {
      // The Losers side winning the Grand Final forces the reset match.
      if (b.reset && m.winner === 1) out.winner = b.finals[1];
      return out;
    }
    D.ordered(b).forEach((x) => {
      x.sources.forEach((src, k) => {
        if (!src || src.from !== m.id || x.empty[k]) return;
        if (src.take === 'winner') out.winner = x;
        if (src.take === 'loser') out.loser = x;
      });
    });
    return out;
  }

  /** Next real match for the winner and loser (BYEs they would pass straight through are skipped). */
  D.destinations = (b, m) => {
    const out = directDestinations(b, m);
    const skipByes = (x) => {
      while (x && x.bye) x = directDestinations(b, x).winner;
      return x;
    };
    return { winner: skipByes(out.winner), loser: skipByes(out.loser) };
  };
})(window.PSB);
