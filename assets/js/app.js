/* app.js — загрузка системы, иконки, док, меню-бар, контекстное меню */
const UI = (() => {

  const $ = s => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('studio.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('studio.' + k, JSON.stringify(v)); } catch {} },
  };

  /* ── тосты ── */
  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('is-on'));
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      t.classList.remove('is-on');
      setTimeout(() => { t.hidden = true; }, 320);
    }, 2600);
  }

  /* ── тема: day → dusk → night ── */
  const THEMES = [['day', 'DAY'], ['dusk', 'SUNSET'], ['night', 'NIGHT']];
  function applyTheme(name) {
    const t = THEMES.find(x => x[0] === name) || THEMES[0];
    document.documentElement.dataset.theme = t[0];
    $('#themeState').textContent = t[1];
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', { day: '#8fb6d9', dusk: '#b4586a', night: '#0b1020' }[t[0]]);
    store.set('theme', t[0]);
  }
  function cycleTheme() {
    const cur = document.documentElement.dataset.theme;
    const i = THEMES.findIndex(x => x[0] === cur);
    applyTheme(THEMES[(i + 1) % THEMES.length][0]);
  }
  /* при первом визите — тема по местному времени */
  function guessTheme() {
    const h = new Date().getHours();
    return h >= 21 || h < 6 ? 'night' : h >= 18 ? 'dusk' : 'day';
  }

  /* ── часы ── */
  function clock() {
    const n = $('#clock');
    const tick = () => {
      try {
        n.textContent = new Intl.DateTimeFormat('ru-RU', {
          hour: '2-digit', minute: '2-digit', timeZone: DATA.profile.timezone,
        }).format(new Date());
      } catch {
        n.textContent = new Date().toTimeString().slice(0, 5);
      }
    };
    tick(); setInterval(tick, 10000);
  }

  /* ── музыка ── */
  function wireMusic() {
    const b = $('#btnMusic'), s = $('#musicState');
    const paint = on => { b.setAttribute('aria-pressed', String(on)); s.textContent = on ? 'ON' : 'OFF'; };
    b.addEventListener('click', () => Ambient.toggle());
    Ambient.onChange(paint);
    paint(false);
  }

  /* ── иконки рабочего стола ── */
  const isMobile = () => matchMedia('(max-width:760px)').matches;

  function layout(i, total) {
    const top0 = 108;
    if (isMobile()) {
      const colW = 112, rowH = 100, cols = 2;
      const left = (innerWidth - cols * colW) / 2;
      return {
        x: Math.round(left + (i % cols) * colW),
        y: Math.round(Math.max(186, innerHeight * .28) + Math.floor(i / cols) * rowH),
      };
    }
    /* рабочий стол: иконки прижаты к левому краю, как в настоящей ОС,
       чтобы не наезжать на иллюстрацию справа */
    const colW = 126, rowH = 122;
    const perCol = Math.max(3, Math.ceil((innerHeight - top0 - 150) / rowH));
    return {
      x: Math.round(28 + Math.floor(i / perCol) * colW),
      y: Math.round(top0 + (i % perCol) * rowH),
    };
  }

  function buildIcons() {
    const wrap = $('#icons');
    wrap.innerHTML = '';
    const saved = store.get('iconPos', {});
    DESKTOP_ITEMS.forEach((item, i) => {
      const b = document.createElement('div');
      b.className = 'ic';
      b.dataset.id = item.id;
      b.tabIndex = 0;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', item.label);
      b.innerHTML = `
        <span class="ic__art">
          ${item.kind === 'folder' ? Apps.ICON.folder() : Apps.ICON.file}
          ${item.badge ? `<span class="ic__badge">${item.badge}</span>` : ''}
        </span>
        <span class="ic__label">${Apps.esc(item.label)}</span>`;
      const p = saved[item.id] && !isMobile()
        ? saved[item.id] : layout(i, DESKTOP_ITEMS.length);
      b.style.left = p.x + 'px';
      b.style.top = p.y + 'px';
      wrap.appendChild(b);
      wireIcon(b, item);
    });
  }

  function wireIcon(b, item) {
    let lastTap = 0, moved = false;

    b.addEventListener('pointerdown', e => {
      if (e.button === 2) return;
      selectOnly(b);
      moved = false;
      const sx = e.clientX, sy = e.clientY;
      const ox = parseFloat(b.style.left), oy = parseFloat(b.style.top);
      b.setPointerCapture(e.pointerId);
      const move = ev => {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
        moved = true;
        b.classList.add('is-drag');
        const x = Math.max(4, Math.min(innerWidth - 116, ox + ev.clientX - sx));
        const y = Math.max(56, Math.min(innerHeight - 130, oy + ev.clientY - sy));
        b.style.left = x + 'px'; b.style.top = y + 'px';
      };
      const up = () => {
        b.classList.remove('is-drag');
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
        b.removeEventListener('pointercancel', up);
        if (moved) {
          const pos = store.get('iconPos', {});
          pos[item.id] = { x: parseFloat(b.style.left), y: parseFloat(b.style.top) };
          store.set('iconPos', pos);
        }
      };
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    });

    b.addEventListener('dblclick', () => { if (!moved) openItem(item.id); });
    /* мобильный: одно касание = открыть */
    b.addEventListener('pointerup', e => {
      if (moved || e.pointerType === 'mouse') return;
      const now = Date.now();
      if (now - lastTap < 600) return;
      lastTap = now;
      openItem(item.id);
    });
    b.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(item.id); }
    });
  }

  function openItem(id) {
    hideHint();
    Apps.launch(id);
  }
  function selectOnly(b) {
    document.querySelectorAll('.ic.is-sel').forEach(n => n.classList.remove('is-sel'));
    b?.classList.add('is-sel');
  }

  /* ── док ── */
  function buildDock() {
    const d = $('#dock');
    d.innerHTML = '';
    DOCK_ITEMS.forEach(item => {
      if (item.sep) {
        const s = document.createElement('span');
        s.className = 'dk__sep'; s.setAttribute('aria-hidden', 'true');
        d.appendChild(s);
      }
      if (item.ext && !Apps.URLS[item.id]) return;   // контакт не заполнен — прячем
      const b = document.createElement('button');
      b.className = 'dk';
      b.type = 'button';
      b.dataset.id = item.id;
      b.setAttribute('aria-label', item.label);
      b.innerHTML = `${Apps.ICON[item.icon]}
        <span class="dk__tip">${Apps.esc(item.label)}</span>
        <span class="dk__run" aria-hidden="true"></span>`;
      b.addEventListener('click', () => { hideHint(); Apps.toggle(item.id); });
      d.appendChild(b);
    });
    WM.onChange(ids => {
      d.querySelectorAll('.dk').forEach(b =>
        b.classList.toggle('is-run', ids.includes(b.dataset.id)));
    });
  }

  /* ── заголовок активного окна в меню-баре ── */
  function wireActiveTitle() {
    const n = $('#mbActive');
    WM.onChange((ids, focused) => {
      const reg = Apps.REG[focused];
      n.textContent = reg ? reg.title
        : focused?.startsWith('case-') ? 'Кейс'
        : 'Finder';
    });
  }

  /* ── контекстное меню ── */
  function wireCtx() {
    const menu = $('#ctx');
    const items = () => ([
      ['Открыть работы', 'works', '⏎'],
      ['Оставить заявку', 'brief', ''],
      null,
      ['Сменить время суток', '@theme', 'T'],
      ['Музыка вкл/выкл', '@music', 'M'],
      null,
      ['Закрыть все окна', '@closeall', 'Esc'],
      ['Вернуть иконки на место', '@reset', ''],
    ]);
    function show(x, y) {
      menu.innerHTML = items().map(it => it
        ? `<button type="button" data-act="${it[1]}">${Apps.esc(it[0])}<span>${Apps.esc(it[2])}</span></button>`
        : '<hr>').join('');
      menu.hidden = false;
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
      menu.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
    }
    const hide = () => { menu.hidden = true; };

    $('#desktop').addEventListener('contextmenu', e => {
      if (e.target.closest('.win')) return;
      e.preventDefault();
      selectOnly(null);
      show(e.clientX, e.clientY);
    });
    menu.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      hide();
      const a = b.dataset.act;
      if (a === '@theme') cycleTheme();
      else if (a === '@music') Ambient.toggle();
      else if (a === '@closeall') WM.closeAll();
      else if (a === '@reset') { store.set('iconPos', {}); buildIcons(); toast('Иконки на месте'); }
      else openItem(a);
    });
    addEventListener('pointerdown', e => { if (!e.target.closest('.ctx')) hide(); });
    addEventListener('scroll', hide, true);
  }

  /* ── выделение рамкой ── */
  function wireMarquee() {
    const m = $('#marquee'), desk = $('#desktop');
    desk.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('.win, .ic, .dock, .menubar')) return;
      selectOnly(null);
      const sx = e.clientX, sy = e.clientY;
      let on = false;
      const move = ev => {
        if (!on && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
        on = true; m.hidden = false;
        const x = Math.min(sx, ev.clientX), y = Math.min(sy, ev.clientY);
        const w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy);
        Object.assign(m.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        document.querySelectorAll('.ic').forEach(ic => {
          const r = ic.getBoundingClientRect();
          ic.classList.toggle('is-sel', !(r.right < x || r.left > x + w || r.bottom < y || r.top > y + h));
        });
      };
      const up = () => {
        m.hidden = true;
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }

  /* ── горячие клавиши ── */
  function wireKeys() {
    addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 't') cycleTheme();
      else if (k === 'm') Ambient.toggle();
      else if (k === 'w' && !e.metaKey && !e.ctrlKey) Apps.launch('works');
      else if (k === 'b') Apps.launch('brief');
    });
  }

  /* ── подсказка ── */
  let hintT = 0;
  function hideHint() { $('#hint')?.classList.add('is-off'); clearTimeout(hintT); }

  /* ── загрузка ── */
  const LOG = [
    'studio.os 2.4 — инициализация',
    'монтирую /поле ................ <b>ok</b>',
    'рисую траву (312 стеблей) ..... <b>ok</b>',
    'греюсь на солнце .............. <b>ok</b>',
    'подключаю ЭЛТ-монитор ......... <b>ok</b>',
    'ищу вдохновение ............... <b>найдено</b>',
    'готов к работе',
  ];
  function boot() {
    const bar = document.getElementById('bootBar');
    const log = document.getElementById('bootLog');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = 0, done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(t);
      document.getElementById('boot').classList.add('is-done');
      ['menubar', 'desktop', 'dock'].forEach(id => { document.getElementById(id).hidden = false; });
      hintT = setTimeout(hideHint, 7000);
      setTimeout(() => document.getElementById('boot').remove(), 800);
    };

    document.getElementById('bootSkip').addEventListener('click', finish);
    if (reduce) { finish(); return; }

    const t = setInterval(() => {
      i++;
      bar.style.width = Math.min(100, (i / LOG.length) * 100) + '%';
      if (LOG[i - 1]) {
        log.innerHTML = LOG.slice(Math.max(0, i - 3), i).join('<br>');
      }
      if (i >= LOG.length) setTimeout(finish, 420);
    }, 260);
  }

  /* ── старт ── */
  function init() {
    /* подставляем имя из data.js */
    const nm = DATA.profile.name;
    document.title = `${nm} — ${DATA.profile.role}`;
    ['bootLogo', 'mbName'].forEach(id => { document.getElementById(id).textContent = nm; });
    const h = document.getElementById('heroTitle');
    h.firstChild.textContent = nm;
    document.getElementById('heroSub').textContent = DATA.profile.role;

    applyTheme(store.get('theme', guessTheme()));
    Scene.init();
    clock();
    wireMusic();
    buildIcons();
    buildDock();
    wireActiveTitle();
    wireCtx();
    wireMarquee();
    wireKeys();

    document.getElementById('btnTheme').addEventListener('click', cycleTheme);
    document.getElementById('mbLogo').addEventListener('click', () => Apps.launch('about'));

    /* кнопки [data-open] внутри окон */
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-open]');
      if (!b) return;
      Apps.launch(b.dataset.open, b.dataset.svc);
    });

    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        buildIcons();
      }, 200);
    });

    boot();
  }

  return { init, toast, cycleTheme };
})();

document.addEventListener('DOMContentLoaded', UI.init);
