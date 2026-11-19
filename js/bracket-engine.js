/* =====================================================================
   Single-elimination bracket engine (pure data, no DOM).

   Bracket shape:
   {
     format: 'single-elim',
     size: 16,                       // power of two
     seeds: { [entrantId]: seedNo },
     rounds: [ [match, ...], ... ],  // rounds[0] = first round
     generatedAt
   }
   match: { id, round, index, num, slots:[idA|null, idB|null],
            scores:[a|null, b|null], winner: 0|1|null, bye, completedAt }

   Winners of rounds[r][2i] and rounds[r][2i+1] meet in rounds[r+1][i].
   Later-round slots are always DERIVED from earlier winners by sync(),
   so progression can never drift out of step with results.
   ===================================================================== */
(function (PSB) {
  'use strict';

  const E = (PSB.bracketEngine = {});
  const clone = (o) => JSON.parse(JSON.stringify(o));

  E.MIN_ENTRANTS = 2;
  E.MAX_ENTRANTS = 64;
  E.MAX_SCORE = 99;

  E.sizeFor = (n) => {
    let size = 2;
    while (size < n) size *= 2;
    return size;
  };

  /** Bracket facts for n entrants (null if not enough). */
  E.plan = (n) => {
    if (n < E.MIN_ENTRANTS) return null;
    const size = E.sizeFor(n);
    return { size, byes: size - n, rounds: Math.log2(size), matches: n - 1 };
  };

  /**
   * Standard seeding positions: seed 1 and 2 can only meet in the final,
   * 1–4 in the semis, etc. Returns seed numbers in bracket-line order.
   */
  E.seedPositions = (size) => {
    let seeds = [1, 2];
    while (seeds.length < size) {
      const sum = seeds.length * 2 + 1;
      seeds = seeds.flatMap((s) => [s, sum - s]);
    }
    return seeds.slice(0, size);
  };

  E.roundName = (r, total) => {
    const left = total - r;
    if (left === 1) return 'Final';
    if (left === 2) return 'Semifinals';
    if (left === 3) return 'Quarterfinals';
    return `Round of ${2 ** left}`;
  };

  E.roundShort = (r, total) => {
    const left = total - r;
    if (left === 1) return 'Final';
    if (left === 2) return 'Semis';
    if (left === 3) return 'Quarters';
    return `R${2 ** left}`;
  };

  /* ---------- Queries ---------- */
  E.all = (b) => b.rounds.flat();
  E.find = (b, id) => {
    for (const round of b.rounds) for (const m of round) if (m.id === id) return m;
    return null;
  };
  E.finalMatch = (b) => b.rounds[b.rounds.length - 1][0];
  E.winnerOf = (m) => (m && m.winner !== null && m.winner !== undefined ? m.slots[m.winner] : null);
  E.loserOf = (m) => (m && m.winner !== null && m.winner !== undefined ? m.slots[1 - m.winner] : null);
  E.champion = (b) => (b ? E.winnerOf(E.finalMatch(b)) : null);
  E.isFinal = (b, m) => m.round === b.rounds.length - 1;

  E.next = (b, m) => {
    if (m.round + 1 >= b.rounds.length) return null;
    return { match: b.rounds[m.round + 1][m.index >> 1], slot: m.index & 1 };
  };

  E.feeders = (b, m) =>
    m.round === 0 ? [null, null] : [b.rounds[m.round - 1][m.index * 2], b.rounds[m.round - 1][m.index * 2 + 1]];

  /** 'bye' | 'completed' | 'ready' (both sides known) | 'pending' (waiting on earlier match) */
  E.status = (m) => {
    if (m.bye) return 'bye';
    if (m.winner !== null) return 'completed';
    if (m.slots[0] && m.slots[1]) return 'ready';
    return 'pending';
  };

  E.progress = (b) => {
    const real = E.all(b).filter((m) => !m.bye);
    return { played: real.filter((m) => m.winner !== null).length, total: real.length };
  };

  E.hasResults = (b) => !!b && E.all(b).some((m) => !m.bye && m.winner !== null);

  /** Where each entrant sits in round 1: id -> { match, slot }. */
  E.positions = (b) => {
    const map = {};
    b.rounds[0].forEach((m) => m.slots.forEach((id, slot) => { if (id) map[id] = { match: m, slot }; }));
    return map;
  };

  /* ---------- Generation ---------- */
  E.generate = (ids) => {
    if (!Array.isArray(ids) || ids.length < E.MIN_ENTRANTS) {
      throw new Error(`At least ${E.MIN_ENTRANTS} entrants are needed to build a bracket.`);
    }
    if (ids.length > E.MAX_ENTRANTS) throw new Error(`Brackets support up to ${E.MAX_ENTRANTS} entrants.`);
    if (new Set(ids).size !== ids.length) throw new Error('Each entrant can appear only once.');

    const size = E.sizeFor(ids.length);
    const total = Math.log2(size);
    const order = E.seedPositions(size);
    const rounds = [];
    for (let r = 0; r < total; r++) {
      const count = size >> (r + 1);
      const ms = [];
      for (let i = 0; i < count; i++) {
        ms.push({ id: `r${r}m${i}`, round: r, index: i, num: null, slots: [null, null], scores: [null, null], winner: null, bye: false, completedAt: null });
      }
      rounds.push(ms);
    }
    rounds[0].forEach((m, i) => {
      m.slots = [ids[order[2 * i] - 1] || null, ids[order[2 * i + 1] - 1] || null];
    });

    const seeds = {};
    ids.forEach((id, i) => { seeds[id] = i + 1; });

    const b = { format: 'single-elim', size, seeds, rounds, generatedAt: Date.now() };
    applyByes(b);
    let n = 1;
    b.rounds.forEach((round) => round.forEach((m) => { m.num = m.bye ? null : n++; }));
    sync(b);
    return b;
  };

  /** First-round matches with exactly one entrant are BYEs: that entrant advances automatically. */
  function applyByes(b) {
    b.rounds[0].forEach((m) => {
      const [a, c] = m.slots;
      if (!a && !c) throw new Error('A first-round match cannot have two BYEs.');
      if (!a || !c) {
        m.bye = true;
        m.winner = a ? 0 : 1;
        m.scores = [null, null];
        m.completedAt = null;
      }
    });
  }

  /**
   * Rebuild every later-round slot from the winners feeding it.
   * Any match whose line-up changes loses its (now invalid) result.
   * Returns the ids of matches whose results were cleared.
   */
  function sync(b) {
    const cleared = [];
    for (let r = 1; r < b.rounds.length; r++) {
      b.rounds[r].forEach((m) => {
        const want = [E.winnerOf(b.rounds[r - 1][m.index * 2]), E.winnerOf(b.rounds[r - 1][m.index * 2 + 1])];
        if (want[0] !== m.slots[0] || want[1] !== m.slots[1]) {
          if (m.winner !== null) {
            cleared.push(m.id);
            m.winner = null;
            m.scores = [null, null];
            m.completedAt = null;
          }
          m.slots = want;
        }
      });
    }
    return cleared;
  }
  E.sync = sync;

  /* ---------- Scores ---------- */
  E.validateScores = (rawA, rawB) => {
    const parse = (v) => {
      const s = String(v == null ? '' : v).trim();
      if (s === '') return { error: 'Enter a score for both sides.' };
      if (!/^\d+$/.test(s)) return { error: 'Scores must be whole numbers (0 or more).' };
      const n = Number(s);
      if (n > E.MAX_SCORE) return { error: `Scores can't be higher than ${E.MAX_SCORE}.` };
      return { value: n };
    };
    const a = parse(rawA);
    if (a.error) return { ok: false, error: a.error, side: 0 };
    const b = parse(rawB);
    if (b.error) return { ok: false, error: b.error, side: 1 };
    if (a.value === b.value) return { ok: false, error: "Scores can't be tied — a match needs a winner." };
    return { ok: true, scores: [a.value, b.value], winner: a.value > b.value ? 0 : 1 };
  };

  /** Record a result. Mutates b. Returns ids of later matches whose results were cleared. */
  E.setResult = (b, matchId, rawA, rawB) => {
    const m = E.find(b, matchId);
    if (!m) throw new Error('Match not found.');
    if (m.bye) throw new Error('BYE matches advance automatically and have no score.');
    if (!m.slots[0] || !m.slots[1]) throw new Error('Both sides of this match must be decided first.');
    const v = E.validateScores(rawA, rawB);
    if (!v.ok) throw new Error(v.error);
    m.scores = v.scores;
    m.winner = v.winner;
    m.completedAt = Date.now();
    return sync(b);
  };

  E.clearResult = (b, matchId) => {
    const m = E.find(b, matchId);
    if (!m) throw new Error('Match not found.');
    if (m.bye) throw new Error('BYE matches cannot be reset.');
    m.scores = [null, null];
    m.winner = null;
    m.completedAt = null;
    return sync(b);
  };

  /** Clear every played result but keep the draw. */
  E.restart = (b) => {
    E.all(b).forEach((m) => {
      if (m.bye) return;
      m.scores = [null, null];
      m.winner = null;
      m.completedAt = null;
    });
    sync(b);
  };

  /**
   * Swap two entrants' first-round positions (used to change match participants).
   * Both first-round matches involved must not have a played result.
   */
  E.swapEntrants = (b, idA, idB) => {
    if (!idA || !idB || idA === idB) throw new Error('Choose two different entrants to swap.');
    const pos = E.positions(b);
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
    // BYE matches keep their single entrant (now a different person) as the automatic winner.
    [pa.match, pb.match].forEach((m) => {
      if (m.bye) m.winner = m.slots[0] ? 0 : 1;
    });
    return sync(b);
  };

  /** Run an operation on a copy to learn which later results it would clear. */
  E.preview = (b, op) => {
    const copy = clone(b);
    const cleared = op(copy) || [];
    return cleared;
  };

  /* ---------- Shared engine interface (also implemented by double elimination) ---------- */
  E.format = 'single-elim';

  E.planRows = (n) => {
    const p = E.plan(n);
    if (!p) return [];
    return [
      ['Bracket size', p.size],
      ['BYEs', p.byes],
      ['Rounds', p.rounds],
      ['Matches to play', p.matches],
      ['First round', E.roundName(0, p.rounds)],
    ];
  };

  /** Ordered groups of matches, used for column headers and the round-by-round view. */
  E.stages = (b) => {
    const total = b.rounds.length;
    return b.rounds.map((matches, r) => ({
      key: `r${r}`, group: '', name: E.roundName(r, total), tab: E.roundShort(r, total), matches,
    }));
  };
  E.stageName = (b, m) => E.roundName(m.round, b.rounds.length);
  E.title = (b, m) => (m.bye ? 'BYE' : `Match ${m.num}`);
  E.isFirstRound = (b, m) => m.round === 0;
  E.isChampionship = (b, m) => E.isFinal(b, m);
  E.decidingMatch = (b) => (E.champion(b) ? E.finalMatch(b) : null);

  /** Placeholder text for an empty slot. */
  E.slotHint = (b, m, k) => {
    const f = E.feeders(b, m)[k];
    return f && f.num ? `Winner of Match ${f.num}` : 'To be decided';
  };

  /** Where this match's winner (and loser, in other formats) goes next. */
  E.destinations = (b, m) => {
    const nx = E.next(b, m);
    return { winner: nx ? nx.match : null, loser: null };
  };
})(window.PSB);
