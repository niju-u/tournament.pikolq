/* Modals, confirmation dialogs and toasts. */
(function (PSB) {
  'use strict';

  const U = PSB.util;
  const UI = (PSB.ui = {});
  const stack = [];

  /* ---------- Toasts ---------- */
  UI.toast = (message, type = 'success', ms = 3200) => {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const icon = { success: 'check', error: 'alert', info: 'sparkle' }[type] || 'info';
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${PSB.icon(icon)}<span>${U.esc(message)}</span>`;
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), U.reducedMotion() ? 0 : 200);
    }, ms);
  };

  /* ---------- Modal ---------- */
  /**
   * UI.modal({ title, subtitle, body, footer, size, onClose, initialFocus })
   * body/footer are HTML strings. Returns { el, body, close }.
   */
  UI.modal = (opts) => {
    const root = document.getElementById('modal-root');
    const titleId = U.uid('mt');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal ${opts.size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-head">
          <div>
            <h2 class="modal-title" id="${titleId}">${U.esc(opts.title)}</h2>
            ${opts.subtitle ? `<p class="modal-sub">${U.esc(opts.subtitle)}</p>` : ''}
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Close">${PSB.icon('x')}</button>
        </div>
        <div class="modal-body">${opts.body || ''}</div>
        ${opts.footer ? `<div class="modal-foot">${opts.footer}</div>` : ''}
      </div>`;

    const previousFocus = document.activeElement;
    let closed = false;
    const api = {
      el: backdrop,
      body: backdrop.querySelector('.modal-body'),
      close(reason) {
        if (closed) return;
        closed = true;
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        backdrop.classList.add('is-closing');
        setTimeout(() => backdrop.remove(), U.reducedMotion() ? 0 : 160);
        if (!stack.length) document.body.style.overflow = '';
        if (previousFocus && previousFocus.focus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
        if (opts.onClose) opts.onClose(reason);
      },
    };

    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) api.close('backdrop'); });
    backdrop.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close('cancel'); });
    backdrop.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = U.$$('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], summary, [tabindex]:not([tabindex="-1"])', backdrop)
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    root.appendChild(backdrop);
    stack.push(api);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const target = (opts.initialFocus && backdrop.querySelector(opts.initialFocus)) ||
        backdrop.querySelector('.modal-body input, .modal-body select, .modal-foot .btn-primary, .modal-foot .btn-danger') ||
        backdrop.querySelector('[data-close]');
      if (target) target.focus({ preventScroll: true });
    });
    return api;
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      e.preventDefault();
      stack[stack.length - 1].close('escape');
    }
  });

  UI.closeAll = () => stack.slice().forEach((m) => m.close('route'));

  /**
   * Promise-based confirmation.
   * UI.confirm({ title, message (HTML), confirmLabel, danger, icon }) -> Promise<boolean>
   */
  UI.confirm = (opts) =>
    new Promise((resolve) => {
      let answered = false;
      const m = UI.modal({
        title: opts.title,
        body: `
          <div class="confirm-icon ${opts.danger ? 'is-danger' : ''}">${PSB.icon(opts.icon || (opts.danger ? 'alert' : 'info'), 'icon-lg')}</div>
          <div class="confirm-message">${opts.message || ''}</div>`,
        footer: `
          <button type="button" class="btn btn-ghost" data-close>${U.esc(opts.cancelLabel || 'Cancel')}</button>
          <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-ok>${U.esc(opts.confirmLabel || 'Confirm')}</button>`,
        initialFocus: '[data-ok]',
        onClose: () => { if (!answered) resolve(false); },
      });
      m.el.querySelector('[data-ok]').addEventListener('click', () => {
        answered = true;
        resolve(true);
        m.close('ok');
      });
    });
})(window.PSB);
