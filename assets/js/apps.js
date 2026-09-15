/* apps.js — иконки и содержимое окон */
const Apps = (() => {

  /* ────────── утилиты ────────── */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const node = html => {
    const t = document.createElement('div');
    t.innerHTML = html.trim();
    return t.firstElementChild;
  };
  const money = v => typeof v === 'number'
    ? 'от ' + v.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽'
    : 'по договорённости';
  const yearsOfWork = () => Math.max(1, new Date().getFullYear() - (DATA.profile.since || new Date().getFullYear()));

  const C = DATA.contacts;
  const URLS = {
    telegram:  C.telegram  ? 'https://t.me/' + C.telegram : '',
    instagram: C.instagram ? 'https://instagram.com/' + C.instagram : '',
    whatsapp:  C.whatsapp  ? 'https://wa.me/' + C.whatsapp : '',
    email:     C.email     ? 'mailto:' + C.email : '',
    behance:   C.behance   ? 'https://behance.net/' + C.behance : '',
    github:    C.github    ? 'https://github.com/' + C.github : '',
  };

  /* ────────── иконки (инлайновый SVG, ноль запросов) ────────── */
  const ICON = {
    folder: (() => { let k = 0; return () => { const u = 'f' + (++k); return `
      <svg viewBox="0 0 64 54" role="img">
        <defs>
          <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8ec8ff"/><stop offset="1" stop-color="#3f92e8"/>
          </linearGradient>
          <linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#63a8f0"/>
          </linearGradient>
        </defs>
        <path d="M2 10a6 6 0 0 1 6-6h13.4a4 4 0 0 1 3 1.4L28 10h28a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6z" fill="url(#${u}b)"/>
        <path d="M2 18h60v30a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6z" fill="url(#${u}f)"/>
        <path d="M2 18h60v3H2z" fill="#fff" opacity=".35"/>
      </svg>`; }; })(),
    file: `
      <svg viewBox="0 0 64 54" role="img">
        <path d="M14 2h26l12 12v38a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" fill="#f4f1e8"/>
        <path d="M40 2l12 12H44a4 4 0 0 1-4-4z" fill="#d6d1c2"/>
        <g stroke="#9aa3ad" stroke-width="2" stroke-linecap="round">
          <path d="M18 24h28M18 32h28M18 40h18"/>
        </g>
      </svg>`,
    brief: `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#f6c343"/>
      <rect x="15" y="12" width="34" height="40" rx="4" fill="#fffdf4"/>
      <g stroke="#c99a13" stroke-width="2.6" stroke-linecap="round"><path d="M22 24h20M22 32h20M22 40h12"/></g></svg>`,
    tg: `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#31a8e0"/>
      <path d="M13 31.5l32-12.6c1.6-.6 3 .4 2.5 2.7l-5.5 25.6c-.4 1.9-1.6 2.3-3.2 1.4l-8.8-6.5-4.2 4.1c-.5.5-.9.9-1.8.9l.6-9 16.4-14.8c.7-.6-.2-1-1.1-.4L19.9 33.3l-6.4-2c-1.4-.5-1.4-1.4.5-2z" fill="#fff"/></svg>`,
    ig: `<svg viewBox="0 0 64 64"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#f9ce34"/><stop offset=".5" stop-color="#ee2a7b"/><stop offset="1" stop-color="#6228d7"/></linearGradient></defs>
      <rect width="64" height="64" rx="15" fill="url(#ig)"/>
      <rect x="16" y="16" width="32" height="32" rx="10" fill="none" stroke="#fff" stroke-width="3.4"/>
      <circle cx="32" cy="32" r="8" fill="none" stroke="#fff" stroke-width="3.4"/>
      <circle cx="42.4" cy="21.6" r="2.4" fill="#fff"/></svg>`,
    wa: `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#25d366"/>
      <path d="M32 14c-9.9 0-18 8.1-18 18 0 3.2.9 6.2 2.4 8.8L14 50l9.5-2.3c2.5 1.4 5.4 2.2 8.5 2.2 9.9 0 18-8.1 18-18s-8.1-18-18-18z" fill="#fff"/>
      <path d="M25.4 23.8c-.5-1.1-1-1.1-1.4-1.1h-1.2c-.4 0-1.1.2-1.7.8-.6.6-2.2 2.1-2.2 5.2s2.3 6.1 2.6 6.5c.3.4 4.4 7 10.9 9.5 5.4 2.1 6.5 1.7 7.7 1.6 1.2-.1 3.8-1.6 4.3-3.1.5-1.5.5-2.8.4-3.1-.2-.3-.6-.4-1.2-.7-.6-.3-3.8-1.9-4.3-2.1-.6-.2-1-.3-1.4.3-.4.6-1.6 2.1-2 2.5-.4.4-.7.5-1.3.2-.6-.3-2.7-1-5.1-3.2-1.9-1.7-3.2-3.8-3.5-4.4-.4-.6 0-.9.3-1.2.3-.3.6-.7.9-1.1.3-.4.4-.6.6-1 .2-.4.1-.8 0-1.1-.2-.3-1.4-3.4-1.9-4.6z" fill="#25d366"/></svg>`,
    mail: `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#4a8df8"/>
      <rect x="12" y="19" width="40" height="26" rx="4" fill="#fff"/>
      <path d="M13 22l19 14 19-14" fill="none" stroke="#4a8df8" stroke-width="3.4" stroke-linejoin="round"/></svg>`,
    music: `<svg viewBox="0 0 64 64"><defs><linearGradient id="mu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fd6d7e"/><stop offset="1" stop-color="#e8305a"/></linearGradient></defs>
      <rect width="64" height="64" rx="15" fill="url(#mu)"/>
      <path d="M44 15v25.5a7 7 0 1 1-4-6.3V24l-14 3.2v17.3a7 7 0 1 1-4-6.3V22l22-5z" fill="#fff"/></svg>`,
    trash: `<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#e7ebf0"/>
      <path d="M20 22h24l-2.2 28a4 4 0 0 1-4 3.7H26.2a4 4 0 0 1-4-3.7z" fill="#aab6c4"/>
      <rect x="17" y="16" width="30" height="5" rx="2.5" fill="#8c9aab"/>
      <rect x="27" y="11" width="10" height="5" rx="2.5" fill="#8c9aab"/>
      <g stroke="#e7ebf0" stroke-width="2.4" stroke-linecap="round"><path d="M28 30v15M36 30v15"/></g></svg>`,
    safari: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2f9bf5"/>
      <circle cx="32" cy="32" r="24" fill="#f2f6fa"/>
      <path d="M44 20L28 28 20 44l16-8z" fill="#ff4b4b"/><path d="M28 28l8 8-16 8z" fill="#d8dee6"/></svg>`,
  };

  const arrow = `<svg class="btn__ar" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5L9.5 3.5M4.6 3.5h4.9v4.9"/></svg>`;
  const chev  = `<svg class="link__go" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 3l4 4-4 4"/></svg>`;

  /* авто-обложка кейса из палитры */
  function autoCover(w) {
    const p = w.palette || ['#222', '#555', '#999'];
    return `<div class="work__auto" style="background:linear-gradient(140deg,${p[0]},${p[1]} 58%,${p[2]})">
      <span>${esc(w.title)}</span></div>`;
  }
  function coverHtml(w) {
    return w.cover
      ? `<img src="${esc(w.cover)}" alt="${esc(w.title)}" loading="lazy"
           onerror="this.parentNode.innerHTML=this.dataset.fb" data-fb="${esc(autoCover(w))}">`
      : autoCover(w);
  }

  /* ────────── ОБО МНЕ ────────── */
  function about() {
    const a = DATA.about;
    return node(`<div class="pane">
      <div class="eyebrow">Обо мне</div>
      <h2 class="h1">${esc(DATA.profile.tagline)}</h2>
      <div class="mt-s">${a.intro.map(p => `<p class="p">${esc(p)}</p>`).join('')}</div>

      <div class="grid grid--4 mt">
        ${a.facts.map(f => `<div class="card"><div class="stat__v">${esc(f.v)}</div><div class="stat__k">${esc(f.k)}</div></div>`).join('')}
      </div>

      <div class="eyebrow mt-l">Инструменты</div>
      <div class="grid grid--2">
        ${a.stack.map(s => `<div class="card">
          <div class="h3">${esc(s.group)}</div>
          <div class="chips mt-s">${s.items.map(i => `<span class="chip">${esc(i)}</span>`).join('')}</div>
        </div>`).join('')}
      </div>

      <div class="eyebrow mt-l">Как я работаю</div>
      <div class="grid grid--2">
        ${a.principles.map(p => `<div class="card">
          <div class="h3">${esc(p.t)}</div><p class="p mt-s">${esc(p.d)}</p></div>`).join('')}
      </div>

      <div class="foot">
        <span class="foot__t">${esc(DATA.profile.city)} · ${yearsOfWork()} ${plural(yearsOfWork(), 'год', 'года', 'лет')} в вебе</span>
        <button class="btn btn--a" data-open="brief">Обсудить проект ${arrow}</button>
      </div>
    </div>`);
  }
  const plural = (n, a, b, c) => {
    const m = n % 100, d = n % 10;
    if (m > 10 && m < 20) return c;
    if (d === 1) return a;
    if (d >= 2 && d <= 4) return b;
    return c;
  };

  /* ────────── РАБОТЫ ────────── */
  function works() {
    const n = node(`<div class="pane">
      <div class="eyebrow">Работы · ${DATA.works.length}</div>
      <h2 class="h1">Кейсы, а не скриншоты</h2>
      <p class="p mt-s">Открой любой — внутри задача, решение и что изменилось в цифрах.</p>
      <div class="works mt">
        ${DATA.works.map(w => `
          <article class="work" data-case="${esc(w.slug)}" tabindex="0">
            <div class="work__cover">${coverHtml(w)}<span class="work__yr">${esc(w.year)}</span></div>
            <div class="work__meta">
              <h3 class="work__t">${esc(w.title)}</h3>
              <div class="work__s">${esc(w.type)} · ${w.tags.map(esc).join(' · ')}</div>
            </div>
          </article>`).join('')}
      </div>
      <div class="foot">
        <span class="foot__t">Нужен похожий проект?</span>
        <button class="btn btn--a" data-open="brief">Оставить заявку ${arrow}</button>
      </div>
    </div>`);
    n.querySelectorAll('[data-case]').forEach(card => {
      const go = () => openCase(card.dataset.case);
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    return n;
  }

  function openCase(slug) {
    const w = DATA.works.find(x => x.slug === slug);
    if (!w) return;
    const body = node(`<div>
      <div class="case__hero">${coverHtml(w)}</div>
      <div class="pane">
        <div class="eyebrow">${esc(w.type)} · ${esc(w.year)}</div>
        <h2 class="h1">${esc(w.title)}</h2>
        <div class="chips mt-s">${w.tags.map(t => `<span class="chip chip--a">${esc(t)}</span>`).join('')}</div>

        <dl class="def mt">
          <dt>Было</dt><dd>${esc(w.brief)}</dd>
          <dt>Задача</dt><dd>${esc(w.task)}</dd>
          <dt>Сделал</dt><dd>${esc(w.done)}</dd>
        </dl>

        <div class="eyebrow mt-l">Результат</div>
        <div class="grid grid--3">
          ${w.result.map(r => `<div class="card"><div class="stat__v">${esc(r.v)}</div><div class="stat__k">${esc(r.k)}</div></div>`).join('')}
        </div>

        <div class="foot">
          ${w.url ? `<a class="btn btn--g" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">Открыть сайт ${arrow}</a>` : `<span class="foot__t">Ссылка под NDA</span>`}
          <button class="btn btn--a" data-open="brief">Хочу так же ${arrow}</button>
        </div>
      </div>
    </div>`);
    WM.launch('case-' + slug, { title: w.title + ' — кейс', body, w: 760, h: 620 });
  }

  /* ────────── ПРОЦЕСС И ЦЕНЫ ────────── */
  function pricing() {
    const n = node(`<div class="pane">
      <div class="eyebrow">Цены</div>
      <h2 class="h1">Фиксированная смета до старта</h2>
      <p class="p mt-s">Цена не растёт по ходу проекта. Если объём меняется — сначала обсуждаем, потом делаем.</p>

      <div class="grid grid--2 mt">
        ${DATA.services.map(s => `
          <div class="card price ${s.best ? 'price--best' : ''}">
            ${s.best ? '<span class="price__flag">чаще всего берут</span>' : ''}
            <div class="h3">${esc(s.name)}</div>
            <div class="price__v">${esc(money(s.price))}</div>
            <div class="stat__k" style="margin-top:6px">${esc(s.term)}</div>
            <p class="p mt-s" style="font-size:.79rem">${esc(s.for)}</p>
            <ul class="price__list">${s.includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
            <button class="btn btn--${s.best ? 'a' : 'g'} btn--full mt-s" data-open="brief" data-svc="${esc(s.name)}">Выбрать</button>
          </div>`).join('')}
      </div>

      <div class="eyebrow mt-l">Процесс</div>
      <div class="steps">
        ${DATA.process.map(p => `<div class="step">
          <div class="step__n">${String(p.n).padStart(2, '0')}</div>
          <div><div class="step__t">${esc(p.t)}</div><div class="step__d">${esc(p.d)}</div></div>
        </div>`).join('')}
      </div>

      <div class="eyebrow mt-l">Вопросы</div>
      <div class="faq">
        ${DATA.faq.map(f => `<div class="qa">
          <button class="qa__q" type="button">${esc(f.q)}<span class="qa__i"></span></button>
          <div class="qa__a"><div><p>${esc(f.a)}</p></div></div>
        </div>`).join('')}
      </div>

      <div class="foot">
        <span class="foot__t">Остались вопросы — спроси напрямую</span>
        <button class="btn btn--a" data-open="brief">Оставить заявку ${arrow}</button>
      </div>
    </div>`);
    n.querySelectorAll('.qa__q').forEach(b =>
      b.addEventListener('click', () => b.parentNode.classList.toggle('is-open')));
    return n;
  }

  /* ────────── КОНТАКТЫ ────────── */
  function contacts() {
    const rows = [
      ['telegram',  'Telegram',  '@' + C.telegram,  ICON.tg],
      ['whatsapp',  'WhatsApp',  '+' + C.whatsapp,  ICON.wa],
      ['instagram', 'Instagram', '@' + C.instagram, ICON.ig],
      ['email',     'Почта',     C.email,           ICON.mail],
      ['behance',   'Behance',   C.behance,         ICON.safari],
      ['github',    'GitHub',    C.github,          ICON.safari],
    ].filter(r => URLS[r[0]]);

    return node(`<div class="pane">
      <div class="eyebrow">Контакты</div>
      <h2 class="h1">Пиши, куда удобнее</h2>
      <p class="p mt-s">Отвечаю в течение дня. Если проект срочный — напиши это первым сообщением, подвину очередь.</p>
      <div class="grid mt" style="gap:10px">
        ${rows.map(([k, t, s, ic]) => `
          <a class="link" href="${esc(URLS[k])}" target="_blank" rel="noopener noreferrer">
            <span class="link__ic">${ic}</span>
            <span><span class="link__t">${esc(t)}</span><span class="link__s">${esc(s)}</span></span>
            ${chev}
          </a>`).join('')}
      </div>
      <div class="foot">
        <span class="foot__t">${esc(DATA.profile.city)} · работаю удалённо</span>
        <button class="btn btn--a" data-open="brief">Заполнить бриф ${arrow}</button>
      </div>
    </div>`);
  }

  /* ────────── ЗАЯВКА ────────── */
  function brief(preset) {
    const n = node(`<div class="pane">
      <div class="eyebrow">Заявка</div>
      <h2 class="h1">Расскажи о проекте</h2>
      <p class="p mt-s">Пять полей — минута времени. Форма ничего никуда не отправляет сама: она соберёт сообщение и откроет чат, отправляешь его ты.</p>
      <form class="form mt" novalidate>
        <div class="f"><label for="bf-n">Как тебя зовут</label>
          <input id="bf-n" name="name" autocomplete="name" placeholder="Имя">
          <span class="f__err">Без имени неловко начинать</span></div>

        <div class="f"><label for="bf-c">Как с тобой связаться</label>
          <input id="bf-c" name="contact" placeholder="@telegram, телефон или почта">
          <span class="f__err">Оставь хотя бы один способ связи</span></div>

        <div class="f"><label for="bf-s">Что нужно</label>
          <select id="bf-s" name="svc">
            ${DATA.services.map(s => `<option${preset === s.name ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
            <option>Пока не знаю — нужен совет</option>
          </select></div>

        <div class="f"><label for="bf-b">Бюджет</label>
          <select id="bf-b" name="budget">
            <option>до 100 000 ₽</option><option>100–250 000 ₽</option>
            <option>250–600 000 ₽</option><option>больше 600 000 ₽</option>
            <option>ещё не считал</option>
          </select></div>

        <div class="f"><label for="bf-t">Пара слов о задаче</label>
          <textarea id="bf-t" name="text" placeholder="Что за бизнес, что мешает сейчас, есть ли дедлайн"></textarea>
          <span class="f__err">Хотя бы пару предложений</span></div>

        <button class="btn btn--a btn--full" type="submit">Отправить в Telegram ${arrow}</button>
        <p class="p" style="font-size:.7rem;text-align:center">
          Нажатие откроет чат с готовым текстом. Отправишь его сам.</p>
      </form>
    </div>`);

    const form = n.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const need = [['name', 2], ['contact', 3], ['text', 10]];
      let bad = false;
      need.forEach(([k, min]) => {
        const field = form.elements[k].closest('.f');
        const ok = String(f.get(k) || '').trim().length >= min;
        field.classList.toggle('is-bad', !ok);
        if (!ok) bad = true;
      });
      if (bad) { UI.toast('Заполни подсвеченные поля'); return; }

      const msg =
        `Заявка с сайта ${DATA.contacts.site || ''}\n\n` +
        `Имя: ${f.get('name')}\n` +
        `Связь: ${f.get('contact')}\n` +
        `Услуга: ${f.get('svc')}\n` +
        `Бюджет: ${f.get('budget')}\n\n` +
        `Задача:\n${f.get('text')}`;

      if (URLS.telegram) {
        window.open(URLS.telegram + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        UI.toast('Открыл Telegram — осталось нажать «отправить»');
      } else if (URLS.email) {
        location.href = URLS.email + '?subject=' + encodeURIComponent('Заявка с сайта') + '&body=' + encodeURIComponent(msg);
      } else {
        navigator.clipboard?.writeText(msg);
        UI.toast('Контакты не заполнены — заявка скопирована в буфер');
      }
    });
    form.addEventListener('input', e => e.target.closest('.f')?.classList.remove('is-bad'));
    return n;
  }

  /* ────────── README ────────── */
  function readme() {
    return node(`<div class="note">${DATA.readme.map(esc).join('\n')}</div>`);
  }

  /* ────────── КОРЗИНА ────────── */
  function trash() {
    const n = node(`<div>
      <div class="pane" style="padding-bottom:6px">
        <div class="eyebrow">Корзина · ${DATA.trash.length}</div>
        <h2 class="h2">Идеи, которые не дожили до продакшена</h2>
      </div>
      <div>${DATA.trash.map(t => `<div class="tr">
        <span class="tr__n">${esc(t.n)}</span><span class="tr__s">${esc(t.s)}</span></div>`).join('')}</div>
      <div class="pane" style="padding-top:18px">
        <button class="btn btn--g btn--full" type="button" data-empty>Очистить корзину</button>
      </div>
    </div>`);
    n.querySelector('[data-empty]').addEventListener('click', () =>
      UI.toast('Нельзя. Это памятник, а не мусор.'));
    return n;
  }

  /* ────────── ПЛЕЕР ────────── */
  function player() {
    const n = node(`<div class="pl">
      <div class="pl__art"><div class="pl__rings"><i></i><i></i><i></i></div></div>
      <div class="pl__t">Field Recording</div>
      <div class="pl__s">генерируется прямо сейчас · бесконечно</div>
      <button class="pl__btn" type="button" aria-label="Играть"></button>
      <div class="pl__vol"><span>ТИХО</span>
        <input type="range" min="0" max="100" value="${Math.round(Ambient.getVolume() * 100)}" aria-label="Громкость">
        <span>ГРОМКО</span></div>
      <p class="p mt" style="font-size:.72rem">
        Ни одного загруженного файла: пентатоника и розовый шум синтезируются в браузере.</p>
    </div>`);

    const play = `<svg width="20" height="22" viewBox="0 0 20 22" fill="currentColor"><path d="M2 2.4v17.2c0 1 1 1.6 1.9 1.1l15-8.6c.8-.5.8-1.7 0-2.2l-15-8.6C3 .8 2 1.4 2 2.4z"/></svg>`;
    const pause = `<svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor"><rect x="1" y="1" width="6" height="18" rx="2"/><rect x="11" y="1" width="6" height="18" rx="2"/></svg>`;
    const btn = n.querySelector('.pl__btn');
    const paint = on => { btn.innerHTML = on ? pause : play; n.classList.toggle('is-on', on); };
    paint(Ambient.isOn());
    btn.addEventListener('click', () => Ambient.toggle());
    Ambient.onChange(paint);
    n.querySelector('input').addEventListener('input', e => Ambient.setVolume(e.target.value / 100));
    return n;
  }

  /* ────────── реестр приложений ────────── */
  const REG = {
    about:    { title: 'ОБО МНЕ',        build: about,    w: 740, h: 620 },
    works:    { title: 'РАБОТЫ',         build: works,    w: 860, h: 640 },
    pricing:  { title: 'ПРОЦЕСС И ЦЕНЫ', build: pricing,  w: 820, h: 660 },
    contacts: { title: 'КОНТАКТЫ',       build: contacts, w: 560, h: 560 },
    brief:    { title: 'Заявка',         build: brief,    w: 520, h: 640 },
    readme:   { title: 'README.txt',     build: readme,   w: 560, h: 420 },
    trash:    { title: 'Корзина',        build: trash,    w: 460, h: 480 },
    player:   { title: 'Плеер',          build: player,   w: 380, h: 500 },
  };

  function launch(id, arg) {
    if (URLS[id]) { window.open(URLS[id], '_blank', 'noopener'); return; }
    const a = REG[id];
    if (!a) return;
    WM.launch(id, { title: a.title, body: a.build(arg), w: a.w, h: a.h });
  }
  function toggle(id) {
    if (URLS[id]) { window.open(URLS[id], '_blank', 'noopener'); return; }
    const a = REG[id];
    if (!a) return;
    WM.toggle(id, { title: a.title, body: a.build(), w: a.w, h: a.h });
  }

  return { ICON, REG, launch, toggle, openCase, esc, URLS, arrow };
})();
