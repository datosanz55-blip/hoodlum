/* wm.js — оконный менеджер: открытие, фокус, перетаскивание, ресайз */
const WM = (() => {
  const mount = () => document.getElementById('windows');
  const open = new Map();          // id -> {node, state}
  let zTop = 10;
  const isMobile = () => matchMedia('(max-width:760px)').matches;
  const subs = new Set();
  const emit = () => subs.forEach(f => f([...open.keys()], focusedId()));

  function focusedId() {
    let best = null, z = -1;
    open.forEach((w, id) => {
      const cz = +w.node.style.zIndex || 0;
      if (!w.node.classList.contains('is-hidden') && cz > z) { z = cz; best = id; }
    });
    return best;
  }

  function place(i) {
    const vw = innerWidth, vh = innerHeight;
    const w = Math.min(920, Math.round(vw * .62));
    const h = Math.min(640, Math.round(vh * .66));
    const off = (i % 6) * 30;
    return {
      w, h,
      x: Math.round((vw - w) / 2) + off - 70,
      y: Math.max(56, Math.round((vh - h) / 2) - 30) + off,
    };
  }

  function clamp(win) {
    const r = win.node.getBoundingClientRect();
    const minY = 46, maxY = innerHeight - 52;
    let x = win.x, y = win.y;
    x = Math.min(Math.max(x, -r.width + 120), innerWidth - 120);
    y = Math.min(Math.max(y, minY), maxY);
    win.x = x; win.y = y;
    win.node.style.left = x + 'px';
    win.node.style.top = y + 'px';
  }

  function focus(id) {
    const w = open.get(id);
    if (!w) return;
    open.forEach(o => o.node.classList.remove('is-focus'));
    w.node.classList.add('is-focus');
    w.node.style.zIndex = ++zTop;
    w.node.hidden = false;
    w.node.classList.remove('is-min');
    emit();
  }

  function close(id) {
    const w = open.get(id);
    if (!w) return;
    w.node.classList.add('is-closing');
    setTimeout(() => { w.node.remove(); open.delete(id); emit(); }, 210);
  }

  function minimize(id) {
    const w = open.get(id);
    if (!w) return;
    w.node.classList.add('is-min');
    setTimeout(() => { if (open.has(id)) { w.node.hidden = true; w.node.classList.remove('is-min'); emit(); } }, 260);
  }

  function toggleMax(id) {
    const w = open.get(id);
    if (!w || isMobile()) return;
    const n = w.node;
    if (n.classList.contains('is-max')) {
      n.classList.remove('is-max');
      Object.assign(n.style, { left: w.x + 'px', top: w.y + 'px', width: w.w + 'px', height: w.h + 'px' });
    } else {
      n.classList.add('is-max');
      Object.assign(n.style, { left: '0px', top: 'calc(var(--mb-h) + var(--safe-t))', width: '100vw', height: 'calc(100vh - var(--mb-h) - var(--safe-t))' });
    }
  }

  function drag(win, handle) {
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('.win__lights')) return;
      if (isMobile() || win.node.classList.contains('is-max')) return;
      const sx = e.clientX, sy = e.clientY, ox = win.x, oy = win.y;
      handle.setPointerCapture(e.pointerId);
      const move = ev => { win.x = ox + ev.clientX - sx; win.y = oy + ev.clientY - sy; clamp(win); };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  function resize(win, grip) {
    grip.addEventListener('pointerdown', e => {
      if (isMobile()) return;
      e.stopPropagation();
      const sx = e.clientX, sy = e.clientY, ow = win.w, oh = win.h;
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        win.w = Math.max(320, Math.min(innerWidth - 20, ow + ev.clientX - sx));
        win.h = Math.max(220, Math.min(innerHeight - 60, oh + ev.clientY - sy));
        win.node.style.width = win.w + 'px';
        win.node.style.height = win.h + 'px';
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }

  /** opts: {title, body:Node|string, w,h} */
  function launch(id, opts) {
    if (open.has(id)) {
      const w = open.get(id);
      w.node.hidden = false;
      focus(id);
      return w;
    }
    const geo = place(open.size);
    const node = document.createElement('section');
    node.className = 'win is-focus';
    node.dataset.win = id;
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', opts.title || id);
    Object.assign(node.style, {
      left: geo.x + 'px', top: geo.y + 'px',
      width: (opts.w || geo.w) + 'px', height: (opts.h || geo.h) + 'px',
      zIndex: ++zTop,
    });
    node.innerHTML = `
      <header class="win__bar">
        <div class="win__lights">
          <button class="lt-close" type="button" aria-label="Закрыть"></button>
          <button class="lt-min"   type="button" aria-label="Свернуть"></button>
          <button class="lt-max"   type="button" aria-label="Развернуть"></button>
        </div>
        <span class="win__title"></span>
        <span class="win__spacer"></span>
      </header>
      <div class="win__body scroll"></div>
      <div class="win__rz" aria-hidden="true"></div>`;
    node.querySelector('.win__title').textContent = opts.title || '';
    const body = node.querySelector('.win__body');
    if (opts.body instanceof Node) body.appendChild(opts.body);
    else body.innerHTML = opts.body || '';

    const win = { node, id, x: geo.x, y: geo.y, w: opts.w || geo.w, h: opts.h || geo.h };
    open.set(id, win);
    mount().appendChild(node);

    node.querySelector('.lt-close').onclick = () => close(id);
    node.querySelector('.lt-min').onclick = () => minimize(id);
    node.querySelector('.lt-max').onclick = () => toggleMax(id);
    node.querySelector('.win__bar').addEventListener('dblclick', e => {
      if (!e.target.closest('.win__lights')) toggleMax(id);
    });
    node.addEventListener('pointerdown', () => focus(id), true);
    drag(win, node.querySelector('.win__bar'));
    resize(win, node.querySelector('.win__rz'));
    open.forEach((o, k) => { if (k !== id) o.node.classList.remove('is-focus'); });
    emit();
    return win;
  }

  function toggle(id, opts) {
    const w = open.get(id);
    if (w && !w.node.hidden && focusedId() === id) { minimize(id); return; }
    if (w) { w.node.hidden = false; focus(id); return; }
    launch(id, opts);
  }

  addEventListener('keydown', e => {
    if (e.key === 'Escape') { const f = focusedId(); if (f) close(f); }
  });
  addEventListener('resize', () => { if (!isMobile()) open.forEach(clamp); });

  return {
    launch, toggle, close, focus, minimize,
    isOpen: id => open.has(id),
    closeAll: () => [...open.keys()].forEach(close),
    focusedId,
    onChange(f) { subs.add(f); return () => subs.delete(f); },
  };
})();
