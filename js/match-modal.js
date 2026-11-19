/* Score-entry modal: enter/edit/reset a result, or swap first-round entrants. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const M = PSB.model;
  const S = PSB.store;
  const UI = PSB.ui;
  const esc = U.esc;
  const MM = (PSB.matchModal = {});

  /** "Match 9 · Semifinals — Ana 11–7 Ben" for confirmation lists. */
  function describe(t, b, id) {
    const E = PSB.engineFor(t);
    const m = E.find(b, id);
    const a = M.nameById(t, m.slots[0]);
    const c = M.nameById(t, m.slots[1]);
    const score = m.winner !== null ? `${m.scores[0]}–${m.scores[1]}` : 'vs';
    return `<li><strong>${esc(E.title(b, m))} · ${esc(E.stageName(b, m))}</strong><br>${esc(a)} ${score} ${esc(c)}</li>`;
  }
  MM.describeList = (t, b, ids) => `<ul class="confirm-list">${ids.map((id) => describe(t, b, id)).join('')}</ul>`;

  function sideHtml(t, b, m, k) {
    const pid = m.slots[k];
    const p = M.entrant(t, pid);
    const sub = t.type === 'doubles' ? p.players.join(' & ') : '';
    const val = m.scores[k] !== null ? m.scores[k] : '';
    const E = PSB.engineFor(t);
    return `
      <div class="score-side" data-side="${k}">
        <span class="score-side-seed">Seed ${b.seeds[pid] || '–'}</span>
        <span class="score-side-name" id="side-name-${k}">${esc(M.name(t, p))}</span>
        ${sub && p.team ? `<span class="score-side-sub">${esc(sub)}</span>` : ''}
        <div class="stepper">
          <button type="button" data-step="-1" data-k="${k}" aria-label="Decrease score for ${esc(M.name(t, p))}">${PSB.icon('down')}</button>
          <input class="score-input" name="s${k}" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="${E.MAX_SCORE}" step="1"
                 value="${val}" placeholder="0" aria-labelledby="side-name-${k}" autocomplete="off" />
          <button type="button" data-step="1" data-k="${k}" aria-label="Increase score for ${esc(M.name(t, p))}">${PSB.icon('up')}</button>
        </div>
        <span class="score-win-tag">${PSB.icon('trophy', 'icon-sm')} Winner</span>
      </div>`;
  }

  function swapHtml(t, b, m) {
    const E = PSB.engineFor(t);
    if (!E.isFirstRound(b, m)) return '';
    const pos = E.positions(b);
    const own = new Set(m.slots.filter(Boolean));
    const options = t.participants
      .filter((p) => pos[p.id] && !own.has(p.id))
      .sort((x, y) => (b.seeds[x.id] || 0) - (b.seeds[y.id] || 0))
      .map((p) => {
        const pm = pos[p.id].match;
        const played = !pm.bye && pm.winner !== null;
        const where = E.title(b, pm);
        return `<option value="${esc(p.id)}" ${played ? 'disabled' : ''}>${esc(M.name(t, p))} — ${where}${played ? ' (played)' : ''}</option>`;
      })
      .join('');
    if (!options) return '';
    const rows = m.slots
      .map((pid) => {
        if (!pid) return '';
        return `
          <div class="swap-row">
            <label class="field">
              <span class="field-label">Replace ${esc(M.nameById(t, pid))} with</span>
              <select class="select" data-swap-from="${esc(pid)}"><option value="">Choose a ${M.typeInfo(t).unit}…</option>${options}</select>
            </label>
            <button type="button" class="btn btn-soft" data-swap="${esc(pid)}">${PSB.icon('swap')}Swap</button>
          </div>`;
      })
      .join('');
    return `
      <details class="swap-box">
        <summary>${PSB.icon('right', 'chev icon-sm')}${PSB.icon('swap', 'icon-sm')}Change participants</summary>
        <div class="swap-body">
          ${rows}
        </div>
      </details>`;
  }

  /**
   * Open the modal for a match.
   * callbacks.onChange(info) is called after any saved change:
   *   { kind: 'result' | 'reset' | 'swap', matchId, winnerPid, loserPid, cleared, prevChampion, champion }
   */
  MM.open = (tid, mid, callbacks = {}) => {
    const t = S.get(tid);
    if (!t || !t.bracket) return;
    const E = PSB.engineFor(t);
    const b = t.bracket;
    const m = E.find(b, mid);
    if (!m) return;
    const st = E.status(m);
    const roundName = E.stageName(b, m);

    if (st === 'pending') {
      UI.toast('This match is waiting for earlier results.', 'info');
      return;
    }
    if (st === 'void') {
      UI.toast(m.id === 'gf2' ? 'The reset match is only played if the Losers-bracket side wins the Grand Final.' : 'This match is not played — both sides are BYEs.', 'info');
      return;
    }

    if (st === 'bye') {
      const pid = E.winnerOf(m);
      const who = pid ? `${esc(M.nameById(t, pid))} advances automatically.` : `${esc(E.slotHint(b, m, m.winner))} will advance automatically.`;
      const modal = UI.modal({
        title: 'BYE',
        subtitle: `${roundName} · automatic advancement`,
        body: `
          <div class="notice">${PSB.icon('info')}<div><strong>${who}</strong>
          There aren't enough entrants to fill the bracket, so this side has no opponent${E.isFirstRound(b, m) ? ' — the top seeds receive BYEs' : ''}.</div></div>
          ${swapHtml(t, b, m)}`,
        footer: `<button type="button" class="btn btn-ghost" data-close>Close</button>`,
      });
      wireSwap(modal, tid, mid, callbacks);
      return;
    }

    const hasResult = m.winner !== null;
    const formId = U.uid('score');
    let hint = 'Enter the final score — the higher score wins and advances.';
    if (m.stage === 'pool') {
      hint = 'Enter the final score — it counts toward the pool standings.';
    } else if (m.id === 'gf1' && b.reset) {
      hint = `If ${esc(M.nameById(t, m.slots[0]))} (unbeaten) wins, they are champion. If ${esc(M.nameById(t, m.slots[1]))} wins, a deciding reset match is played.`;
    } else if (E.isChampionship(b, m)) {
      hint = 'Enter the final score — the winner is crowned champion.';
    } else if (E.destinations(b, m).loser) {
      hint = 'Enter the final score — the winner advances and the loser drops to the Losers bracket.';
    }
    const modal = UI.modal({
      title: E.title(b, m),
      subtitle: `${roundName}${E.isChampionship(b, m) ? ' · Championship' : ''} · ${hasResult ? 'Edit result' : 'Enter result'}`,
      size: 'lg',
      body: `
        <form id="${formId}" novalidate>
          <div class="score-grid">
            ${sideHtml(t, b, m, 0)}
            <span class="score-vs">VS</span>
            ${sideHtml(t, b, m, 1)}
          </div>
          <div class="score-error" role="alert" hidden></div>
          <div class="notice notice-warning score-impact" hidden></div>
          <p class="score-hint">${hint}</p>
          ${swapHtml(t, b, m)}
        </form>`,
      footer: `
        ${hasResult ? `<button type="button" class="btn btn-danger-ghost foot-start" data-reset>${PSB.icon('refresh')}Reset result</button>` : ''}
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary" form="${formId}">${PSB.icon('check')}Save Result</button>`,
      initialFocus: 'input[name="s0"]',
    });

    const form = modal.el.querySelector('form');
    const inputs = [form.s0, form.s1];
    const sides = U.$$('.score-side', form);
    const errorBox = form.querySelector('.score-error');
    const impactBox = form.querySelector('.score-impact');

    const showError = (msg, side) => {
      errorBox.innerHTML = `${PSB.icon('alert')}<span>${esc(msg)}</span>`;
      errorBox.hidden = false;
      inputs.forEach((inp, k) => inp.classList.toggle('is-invalid', side === undefined || side === k));
    };
    const clearError = () => {
      errorBox.hidden = true;
      inputs.forEach((inp) => inp.classList.remove('is-invalid'));
    };

    const refresh = () => {
      clearError();
      const v = E.validateScores(inputs[0].value, inputs[1].value);
      sides.forEach((el, k) => el.classList.toggle('is-leading', v.ok && v.winner === k));
      impactBox.hidden = true;
      if (v.ok && hasResult && v.winner !== m.winner) {
        const cur = S.get(tid);
        const cleared = E.preview(cur.bracket, (c) => E.setResult(c, mid, v.scores[0], v.scores[1]));
        if (cleared.length) {
          impactBox.innerHTML = `${PSB.icon('alert')}<div><strong>This changes the winner.</strong>${U.plural(cleared.length, 'later result')} that depended on this match will be cleared when you save.</div>`;
          impactBox.hidden = false;
        }
      }
    };
    refresh();

    inputs.forEach((inp) => {
      inp.addEventListener('input', refresh);
      inp.addEventListener('focus', () => inp.select());
    });
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      const inp = inputs[Number(btn.dataset.k)];
      const cur = /^\d+$/.test(inp.value) ? Number(inp.value) : 0;
      inp.value = Math.max(0, Math.min(E.MAX_SCORE, cur + Number(btn.dataset.step)));
      refresh();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = E.validateScores(inputs[0].value, inputs[1].value);
      if (!v.ok) {
        showError(v.error, v.side);
        (inputs[v.side || 0]).focus();
        return;
      }
      const cur = S.get(tid);
      const cm = E.find(cur.bracket, mid);
      if (cm.winner !== null && cm.scores[0] === v.scores[0] && cm.scores[1] === v.scores[1]) {
        modal.close('unchanged');
        return;
      }
      const cleared = E.preview(cur.bracket, (c) => E.setResult(c, mid, v.scores[0], v.scores[1]));
      if (cleared.length) {
        const ok = await UI.confirm({
          title: 'Replace later results?',
          message: `<p>Changing the winner of ${esc(E.title(cur.bracket, cm))} means these later results no longer apply and will be cleared:</p>${MM.describeList(cur, cur.bracket, cleared)}`,
          confirmLabel: `Save & clear ${cleared.length}`,
          danger: true,
        });
        if (!ok) return;
      }
      const prevChampion = E.champion(cur.bracket);
      try {
        const { tournament } = S.update(tid, (tt) => E.setResult(tt.bracket, mid, v.scores[0], v.scores[1]));
        const nm = E.find(tournament.bracket, mid);
        modal.close('saved');
        if (callbacks.onChange) {
          callbacks.onChange({
            kind: 'result', matchId: mid, winnerPid: E.winnerOf(nm), loserPid: E.loserOf(nm), cleared,
            prevChampion, champion: E.champion(tournament.bracket),
          });
        }
      } catch (err) {
        showError(err.message);
      }
    });

    const resetBtn = modal.el.querySelector('[data-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        const cur = S.get(tid);
        const cm = E.find(cur.bracket, mid);
        const cleared = E.preview(cur.bracket, (c) => E.clearResult(c, mid));
        const ok = await UI.confirm({
          title: `Reset ${E.title(cur.bracket, cm)}?`,
          message: `<p>The result <strong>${esc(M.nameById(cur, cm.slots[0]))} ${cm.scores[0]}–${cm.scores[1]} ${esc(M.nameById(cur, cm.slots[1]))}</strong> will be removed and the match will be open for scoring again.</p>
            ${cleared.length ? `<p>These later results depend on it and will also be cleared:</p>${MM.describeList(cur, cur.bracket, cleared)}` : ''}`,
          confirmLabel: cleared.length ? `Reset ${cleared.length + 1} matches` : 'Reset result',
          danger: true,
          icon: 'refresh',
        });
        if (!ok) return;
        S.update(tid, (tt) => E.clearResult(tt.bracket, mid));
        modal.close('reset');
        if (callbacks.onChange) callbacks.onChange({ kind: 'reset', matchId: mid, cleared });
      });
    }

    wireSwap(modal, tid, mid, callbacks);
  };

  function wireSwap(modal, tid, mid, callbacks) {
    modal.el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-swap]');
      if (!btn) return;
      const fromId = btn.dataset.swap;
      const select = modal.el.querySelector(`select[data-swap-from="${CSS.escape(fromId)}"]`);
      const toId = select && select.value;
      if (!toId) {
        UI.toast(`Choose who should replace ${M.nameById(S.get(tid), fromId)}.`, 'error');
        if (select) select.focus();
        return;
      }
      const cur = S.get(tid);
      const E = PSB.engineFor(cur);
      let cleared;
      try {
        cleared = E.preview(cur.bracket, (c) => E.swapEntrants(c, fromId, toId));
      } catch (err) {
        UI.toast(err.message, 'error');
        return;
      }
      const a = M.nameById(cur, fromId);
      const c = M.nameById(cur, toId);
      const ok = await UI.confirm({
        title: 'Swap participants?',
        message: `<p><strong>${esc(a)}</strong> and <strong>${esc(c)}</strong> will trade places in the first round.</p>
          ${cleared.length ? `<p>These later results depend on the current line-up and will be cleared:</p>${MM.describeList(cur, cur.bracket, cleared)}` : ''}`,
        confirmLabel: 'Swap',
        icon: 'swap',
      });
      if (!ok) return;
      try {
        S.update(tid, (tt) => E.swapEntrants(tt.bracket, fromId, toId));
      } catch (err) {
        UI.toast(err.message, 'error');
        return;
      }
      modal.close('swap');
      UI.toast(`Swapped ${a} and ${c}.`);
      if (callbacks.onChange) callbacks.onChange({ kind: 'swap', matchId: mid, cleared });
    });
  }
})(window.PSB);
