/* audio.js — фоновый эмбиент на Web Audio API.
   Ни одного мегабайта аудио: всё синтезируется в браузере. */
const Ambient = (() => {
  let ctx = null, master = null, timer = null, playing = false, vol = .35;
  const subs = new Set();

  /* пентатоника — что ни сыграй, диссонанса не будет */
  const SCALE = [174.61, 196.00, 220.00, 261.63, 293.66, 349.23, 392.00, 440.00, 523.25];

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;

    /* мягкий фильтр + реверб из шума */
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = .4;

    const conv = ctx.createConvolver();
    conv.buffer = impulse(3.4, 2.6);
    const wet = ctx.createGain(); wet.gain.value = .45;
    const dry = ctx.createGain(); dry.gain.value = .62;

    master.connect(lp);
    lp.connect(dry); dry.connect(ctx.destination);
    lp.connect(conv); conv.connect(wet); wet.connect(ctx.destination);

    noiseBed();
    return true;
  }

  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  /* «ветер в поле» — отфильтрованный розовый шум */
  function noiseBed() {
    const n = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .997 * b0 + w * .0555179;
      b1 = .963 * b1 + w * .0750759;
      b2 = .574 * b2 + w * .1538520;
      d[i] = (b0 + b1 + b2 + w * .1848) * .16;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = .7;
    const g = ctx.createGain(); g.gain.value = .5;

    /* медленное «дыхание» ветра */
    const lfo = ctx.createOscillator(); lfo.frequency.value = .055;
    const lfoG = ctx.createGain(); lfoG.gain.value = .3;
    lfo.connect(lfoG); lfoG.connect(g.gain);

    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(); lfo.start();
  }

  function note(freq, at, len, gain) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.003;      // лёгкая расстройка — «живой» тембр
    const g2 = ctx.createGain(); g2.gain.value = .22;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + len * .35);
    g.gain.exponentialRampToValueAtTime(.0001, at + len);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    o.start(at); o2.start(at);
    o.stop(at + len + .1); o2.stop(at + len + .1);
  }

  function step() {
    const t = ctx.currentTime + .05;
    const root = SCALE[Math.floor(Math.random() * 4)];
    note(root, t, 7.5, .11);                                  // педаль
    note(root * 1.5, t + .4, 6.2, .055);                      // квинта
    if (Math.random() < .78) {                                // мелодическая искра
      const m = SCALE[3 + Math.floor(Math.random() * 6)];
      note(m, t + Math.random() * 2.4, 3.4, .075);
    }
    if (Math.random() < .4) {
      const m = SCALE[4 + Math.floor(Math.random() * 5)] * 2;
      note(m, t + 1.6 + Math.random() * 2.6, 2.2, .04);
    }
  }

  function emit() { subs.forEach(f => f(playing)); }

  async function start() {
    if (!ctx && !build()) return false;
    if (ctx.state === 'suspended') await ctx.resume();
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2.2);
    step();
    clearInterval(timer);
    timer = setInterval(step, 6400);
    emit();
    return true;
  }

  function stop() {
    if (!ctx) return;
    playing = false;
    clearInterval(timer); timer = null;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    emit();
  }

  return {
    toggle: () => (playing ? (stop(), false) : (start(), true)),
    isOn: () => playing,
    setVolume(v) {
      vol = Math.max(0, Math.min(1, v));
      if (ctx && playing) master.gain.linearRampToValueAtTime(vol, ctx.currentTime + .2);
    },
    getVolume: () => vol,
    onChange(f) { subs.add(f); return () => subs.delete(f); },
  };
})();
