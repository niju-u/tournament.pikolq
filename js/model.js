/* Tournament domain helpers: naming, validation and derived status. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = (PSB.model = {});
  const eng = (t) => PSB.engineFor(t);

  M.NAME_MAX = 40;
  M.TITLE_MAX = 80;

  M.TYPES = {
    singles: { label: 'Singles', unit: 'player', units: 'players', Unit: 'Player', Units: 'Players', icon: 'user' },
    doubles: { label: 'Doubles', unit: 'team', units: 'teams', Unit: 'Team', Units: 'Teams', icon: 'users' },
  };

  /** Formats registry — future formats (round robin, double elimination…) are added here
      with their own engine; only `available` formats are offered in the UI. */
  M.FORMATS = {
    'single-elim': { label: 'Single Elimination', short: 'Single Elim', desc: 'One loss and out', icon: 'bracket', available: true },
    'double-elim': { label: 'Double Elimination', short: 'Double Elim', desc: 'Two losses and out', icon: 'swap', available: true },
    'round-robin': { label: 'Round Robin', short: 'Round Robin', desc: 'Everyone plays everyone · optional playoffs', icon: 'refresh', available: true },
  };

  M.STATUS = {
    draft: { label: 'Draft', icon: 'edit' },
    upcoming: { label: 'Upcoming', icon: 'calendar' },
    ongoing: { label: 'Ongoing', icon: 'play' },
    completed: { label: 'Completed', icon: 'trophy' },
  };

  M.typeInfo = (t) => M.TYPES[t.type] || M.TYPES.singles;

  /* ---------- Entrants ---------- */
  M.entrant = (t, id) => (id ? t.participants.find((p) => p.id === id) || null : null);

  /** Main label: player name, team name, or "A & B" for unnamed teams. */
  M.name = (t, p) => {
    if (!p) return 'TBD';
    if (t.type === 'doubles') return p.team || `${p.players[0]} & ${p.players[1]}`;
    return p.players[0];
  };

  /** Secondary label: the two players when a team has its own name. */
  M.sub = (t, p) => (p && t.type === 'doubles' && p.team ? `${p.players[0]} & ${p.players[1]}` : '');

  M.nameById = (t, id) => M.name(t, M.entrant(t, id));

  /**
   * Validate an entrant { team, players } against the rest of the tournament.
   * Returns { ok, value, error, field } with cleaned values.
   */
  M.validateEntrant = (t, input, excludeId) => {
    const doubles = t.type === 'doubles';
    const players = (input.players || []).slice(0, doubles ? 2 : 1).map(U.clean);
    const team = doubles ? U.clean(input.team) : '';

    for (let i = 0; i < (doubles ? 2 : 1); i++) {
      if (!players[i]) {
        return { ok: false, field: 'p' + i, error: doubles ? `Enter a name for player ${i + 1}.` : 'Enter a player name.' };
      }
      if (players[i].length > M.NAME_MAX) {
        return { ok: false, field: 'p' + i, error: `Names can be up to ${M.NAME_MAX} characters.` };
      }
    }
    if (team.length > M.NAME_MAX) return { ok: false, field: 'team', error: `Team names can be up to ${M.NAME_MAX} characters.` };
    if (doubles && players[0].toLowerCase() === players[1].toLowerCase()) {
      return { ok: false, field: 'p1', error: 'A team needs two different players.' };
    }

    const others = t.participants.filter((p) => p.id !== excludeId);
    const taken = new Map();
    others.forEach((p) => p.players.forEach((n) => taken.set(n.toLowerCase(), p)));
    for (let i = 0; i < players.length; i++) {
      const owner = taken.get(players[i].toLowerCase());
      if (owner) {
        const existing = owner.players.find((n) => n.toLowerCase() === players[i].toLowerCase());
        return {
          ok: false,
          field: 'p' + i,
          error: doubles
            ? `${existing} is already on ${M.name(t, owner)}.`
            : `${existing} is already in this tournament.`,
        };
      }
    }
    if (team) {
      const lower = team.toLowerCase();
      const clash = others.find((p) => (p.team || '').toLowerCase() === lower || M.name(t, p).toLowerCase() === lower);
      if (clash) return { ok: false, field: 'team', error: `The team name “${team}” is already used.` };
    }
    return { ok: true, value: { team, players } };
  };

  M.makeEntrant = (value) => ({ id: U.uid('p'), team: value.team || '', players: value.players.slice() });

  /* ---------- Tournament details ---------- */
  /** Format options: Grand Final reset (double elim) and round-robin pools / advancers / playoff format. */
  M.normalizeOptions = (o = {}) => {
    const rr = PSB.roundRobinEngine.config(o || {});
    return { gfReset: !(o && o.gfReset === false), pools: rr.pools, advance: rr.advance, playoff: rr.playoff };
  };

  M.validateDetails = (d) => {
    const errors = {};
    const name = U.clean(d.name);
    if (!name) errors.name = 'Give the tournament a name.';
    else if (name.length > M.TITLE_MAX) errors.name = `Keep the name under ${M.TITLE_MAX} characters.`;
    if (!U.isValidISODate(d.date)) errors.date = 'Choose a valid date.';
    if (!M.TYPES[d.type]) errors.type = 'Choose Singles or Doubles.';
    if (!M.FORMATS[d.format] || !M.FORMATS[d.format].available) errors.format = 'Choose an available format.';
    const options = M.normalizeOptions(d.options);
    if (d.format === 'round-robin' && options.pools > 1 && options.advance === 0) {
      errors.format = 'With more than one pool, choose how many from each pool advance to the playoffs.';
    }
    return { ok: !Object.keys(errors).length, errors, value: { name, date: d.date, type: d.type, format: d.format, options } };
  };

  /* ---------- Derived status ---------- */
  M.status = (t) => {
    if (!t.bracket) return 'draft';
    if (eng(t).champion(t.bracket)) return 'completed';
    if (eng(t).hasResults(t.bracket)) return 'ongoing';
    return t.date && t.date <= U.todayISO() ? 'ongoing' : 'upcoming';
  };

  M.progress = (t) => (t.bracket ? eng(t).progress(t.bracket) : { played: 0, total: 0 });

  M.formatLabel = (t) => (M.FORMATS[t.format] || M.FORMATS['single-elim']).label;

  M.championInfo = (t) => {
    if (!t.bracket) return null;
    const E = eng(t);
    const id = E.champion(t.bracket);
    if (!id) return null;
    const final = E.decidingMatch(t.bracket);
    const p = M.entrant(t, id);
    const base = {
      id,
      entrant: p,
      name: M.name(t, p),
      players: p ? p.players.slice() : [],
      teamName: p ? p.team : '',
    };
    // Round robin without playoffs: the title is won on record, not in a final.
    if (!final) {
      const rec = E.record ? E.record(t.bracket, id) : null;
      return { ...base, opponent: '', score: null, record: rec };
    }
    return {
      ...base,
      opponent: M.nameById(t, E.loserOf(final)),
      score: [final.scores[final.winner], final.scores[1 - final.winner]],
      record: null,
    };
  };
})(window.PSB);
