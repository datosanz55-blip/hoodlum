/* scene.js — процедурные слои SVG-сцены + параллакс */
const Scene = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a = {}) => {
    const e = document.createElementNS(NS, n);
    for (const k in a) e.setAttribute(k, a[k]);
    return e;
  };

  /* детерминированный шум, чтобы сцена не «прыгала» между перерисовками */
  let seed = 20250915;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rr = (a, b) => a + rand() * (b - a);

  function clouds(g) {
    for (let i = 0; i < 7; i++) {
      const y = rr(90, 380), s = rr(.55, 1.5), dur = rr(90, 240);
      const c = el('g', { class: 'cloud', transform: `translate(0 ${y}) scale(${s})` });
      c.style.animationDuration = dur + 's';
      c.style.animationDelay = -rr(0, dur) + 's';
      const puffs = Math.round(rr(3, 6));
      let x = 0;
      for (let p = 0; p < puffs; p++) {
        const r = rr(22, 46);
        c.appendChild(el('ellipse', { cx: x, cy: rr(-8, 8), rx: r * rr(1.1, 1.7), ry: r }));
        x += r * rr(.9, 1.4);
      }
      g.appendChild(c);
    }
  }

  function stars(g) {
    for (let i = 0; i < 90; i++) {
      const s = el('circle', {
        class: 'star', cx: rr(-100, 1700), cy: rr(-60, 560), r: rr(.7, 2.1),
      });
      s.style.opacity = rr(.2, .9);
      s.style.animationDuration = rr(2.4, 7) + 's';
      s.style.animationDelay = -rr(0, 6) + 's';
      g.appendChild(s);
    }
    /* пара падающих звёзд */
    for (let i = 0; i < 2; i++) {
      const x = rr(200, 1300), y = rr(80, 280);
      const p = el('path', { class: 'star', d: `M${x} ${y} l46 26`, stroke: '#fff', 'stroke-width': 1.4, fill: 'none' });
      p.style.opacity = .35;
      g.appendChild(p);
    }
  }

  function trees(g) {
    for (let i = 0; i < 30; i++) {
      const x = rr(-120, 1720), base = 648 + Math.sin(x / 240) * 12;
      const h = rr(16, 46), w = h * rr(.9, 1.5);
      const t = el('path', {
        class: 'tree',
        d: `M${x - w / 2} ${base} q${w * .04} ${-h * .95} ${w * .3} ${-h}`
         + ` q${w * .2} ${-h * .22} ${w * .4} ${h * .04}`
         + ` q${w * .28} ${h * .1} ${w * .3} ${h * .96} z`,
      });
      t.style.opacity = .45 + ((x % 9) / 18);
      g.appendChild(t);
    }
  }

  function grass(g) {
    const rows = [
      { y: 906, h: [70, 150], w: 5,   o: .96, n: 150 },
      { y: 888, h: [48, 108], w: 3.6, o: .82, n: 130 },
      { y: 852, h: [26, 66],  w: 2.6, o: .58, n: 110 },
    ];
    rows.forEach((row, ri) => {
      for (let i = 0; i < row.n; i++) {
        const x = rr(-140, 1740), h = rr(row.h[0], row.h[1]), lean = rr(-22, 22);
        const b = el('path', {
          class: 'blade',
          d: `M${x} ${row.y} q${lean * .25} ${-h * .55} ${lean} ${-h}`,
          'stroke-width': rr(row.w * .5, row.w),
        });
        b.style.opacity = row.o;
        b.style.animationDuration = rr(3.6, 7.6) + 's';
        b.style.animationDelay = -rr(0, 7) + 's';
        g.appendChild(b);
      }
      if (ri === 1) {
        for (let i = 0; i < 22; i++) {
          const f = el('circle', {
            cx: rr(-100, 1700), cy: rr(770, 850), r: rr(2.5, 5.5),
            fill: i % 3 ? '#e8d78a' : '#e8a3b8', stroke: 'none',
          });
          f.style.opacity = .55;
          g.appendChild(f);
        }
      }
    });
  }

  function birds(g) {
    for (let i = 0; i < 5; i++) {
      const x = rr(240, 1400), y = rr(120, 300), s = rr(.6, 1.2);
      g.appendChild(el('path', {
        class: 'bird', transform: `translate(${x} ${y}) scale(${s})`,
        d: 'M0 0 q9 -8 18 0 q9 -8 18 0',
      }));
    }
  }

  function parallax(node) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (matchMedia('(pointer: coarse)').matches) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    addEventListener('pointermove', e => {
      tx = (e.clientX / innerWidth - .5) * -26;
      ty = (e.clientY / innerHeight - .5) * -16;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    function tick() {
      cx += (tx - cx) * .06; cy += (ty - cy) * .06;
      node.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
      raf = Math.abs(tx - cx) > .1 || Math.abs(ty - cy) > .1 ? requestAnimationFrame(tick) : 0;
    }
  }

  /* если пользователь положил свой арт в assets/img/wallpaper.png — показываем его */
  function tryPhoto(sceneNode, img) {
    if (!img) return;
    img.addEventListener('load', () => {
      if (img.naturalWidth > 4) sceneNode.classList.add('has-photo');
    });
    img.addEventListener('error', () => { img.removeAttribute('src'); });
  }

  function init() {
    const s = document.getElementById('scene');
    clouds(document.getElementById('lClouds'));
    stars(document.getElementById('lStars'));
    trees(document.getElementById('lTrees'));
    grass(document.getElementById('lGrass'));
    birds(document.getElementById('lBirds'));
    tryPhoto(s, document.getElementById('scenePhoto'));
    parallax(s);
  }

  return { init };
})();
