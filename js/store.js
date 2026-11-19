/* LocalStorage persistence. All writes go through update(), which mutates
   a copy and only commits if the change succeeds — a failed operation can
   never leave a tournament half-modified. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const KEY = 'psb-tournaments';
  const VERSION = 1;
  const S = (PSB.store = {});

  let db = { version: VERSION, tournaments: [] };
  let storageOk = true;
  const externalListeners = new Set();

  const isTournament = (t) =>
    t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.participants);

  function normalize(t) {
    return {
      id: t.id,
      name: String(t.name),
      date: t.date || '',
      type: t.type === 'doubles' ? 'doubles' : 'singles',
      format: ['double-elim', 'round-robin'].includes(t.format) ? t.format : 'single-elim',
      options: PSB.model ? PSB.model.normalizeOptions(t.options) : { gfReset: !(t.options && t.options.gfReset === false) },
      participants: t.participants
        .filter((p) => p && p.id && Array.isArray(p.players))
        .map((p) => ({ id: p.id, team: p.team || '', players: p.players.map(String) })),
      bracket: t.bracket && (Array.isArray(t.bracket.rounds) || Array.isArray(t.bracket.pools)) ? t.bracket : null,
      createdAt: t.createdAt || Date.now(),
      updatedAt: t.updatedAt || Date.now(),
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tournaments)) {
        db = { version: VERSION, tournaments: parsed.tournaments.filter(isTournament).map(normalize) };
      }
    } catch (e) {
      storageOk = false;
      console.warn('Could not read saved tournaments:', e);
    }
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      storageOk = true;
      return true;
    } catch (e) {
      storageOk = false;
      if (PSB.ui) PSB.ui.toast('Could not save — your browser storage is full or blocked.', 'error');
      return false;
    }
  }

  S.isAvailable = () => storageOk;
  S.all = () => db.tournaments.slice();
  S.get = (id) => db.tournaments.find((t) => t.id === id) || null;

  S.create = (details) => {
    const now = Date.now();
    const t = normalize({ ...details, id: U.uid('t'), participants: [], bracket: null, createdAt: now, updatedAt: now });
    db.tournaments.push(t);
    write();
    return t;
  };

  /**
   * Apply `mutate(copy)` to a copy of the tournament. If it throws, nothing is saved
   * and the error propagates. Returns { tournament, result }.
   */
  S.update = (id, mutate) => {
    const idx = db.tournaments.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error('This tournament no longer exists.');
    const copy = U.clone(db.tournaments[idx]);
    const result = mutate(copy);
    copy.updatedAt = Date.now();
    db.tournaments[idx] = copy;
    write();
    return { tournament: copy, result };
  };

  S.remove = (id) => {
    const before = db.tournaments.length;
    db.tournaments = db.tournaments.filter((t) => t.id !== id);
    if (db.tournaments.length !== before) write();
  };

  /* ---------- Backup ---------- */
  S.exportJSON = () => JSON.stringify({ app: 'pickle-sa-balay-tournaments', version: VERSION, exportedAt: new Date().toISOString(), tournaments: db.tournaments }, null, 2);

  /** Parse a backup file; returns the valid tournaments it contains. */
  S.parseBackup = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.tournaments;
    if (!Array.isArray(list)) throw new Error('No tournaments found in that file.');
    const valid = list.filter(isTournament).map(normalize);
    if (!valid.length) throw new Error('No valid tournaments found in that file.');
    return valid;
  };

  /** Merge imported tournaments in; same id replaces the existing copy. */
  S.importMany = (list) => {
    const byId = new Map(db.tournaments.map((t) => [t.id, t]));
    list.forEach((t) => byId.set(t.id, t));
    db.tournaments = Array.from(byId.values());
    write();
  };

  /* Keep multiple open tabs in step. */
  S.onExternalChange = (fn) => externalListeners.add(fn);
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    read();
    externalListeners.forEach((fn) => fn());
  });

  read();
})(window.PSB);
