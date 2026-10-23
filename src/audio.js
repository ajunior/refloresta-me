'use strict';
// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).

const Sfx = (() => {
  let ac = null;
  let master = null;
  let noiseBuf = null;
  let musicGain = null;

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.6;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      musicGain = ac.createGain();
      musicGain.gain.value = muted ? 0 : 0.5;
      musicGain.connect(master);
      setInterval(schedule, 25);
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, when = 0 } = {}) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, { vol = 0.08, freq = 1200, type = 'lowpass', when = 0 } = {}) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // chiado de chuva com entrada e saída suaves
  function rain(dur) {
    if (!ac) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    f.Q.value = 0.4;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.5);
    g.gain.setValueAtTime(0.05, t + dur - 1.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  // batida da festa: tambor + melodia pentatônica
  const FESTA = [392, 440, 523, 440, 587, 523, 440, 392, 330, 392, 440, 523, 587, 659, 587, 523];
  function beat(i) {
    noise(0.12, { vol: i % 2 ? 0.05 : 0.1, freq: i % 2 ? 900 : 220 });
    if (i % 2 === 0) tone(FESTA[(i / 2) % FESTA.length], 0.22, { type: 'triangle', vol: 0.05 });
  }

  // ---------------------------------------------------------------- música procedural
  // Pentatônica de Lá menor (= Dó maior): as mesmas notas servem para o clima triste e o alegre.
  // O nível de floresta (0..1) controla andamento, densidade, oitava e percussão.
  const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
  const BASS = [110, 87.3, 130.8, 98]; // Lá, Fá, Dó, Sol
  const CHORDS = [[0, 1, 3], [1, 3, 5], [1, 2, 4], [2, 4, 6]];
  const MELODY = (() => {
    let seed = 7, idx = 3;
    const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    return Array.from({ length: 64 }, () => {
      idx = Math.max(0, Math.min(6, idx + Math.round((r() - 0.5) * 4)));
      return { idx, p: r() };
    });
  })();
  let muted = false;
  try { muted = localStorage.getItem('refloresta.mute') === '1'; } catch (e) { /* sem storage */ }
  let musicOn = false, green = 0, greenTarget = 0, next = 0, step = 0;

  function noteAt(freq, t, dur, { type = 'triangle', vol = 0.03, attack = 0.01 } = {}) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function hitAt(t, dur, vol, freq, type) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(musicGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function playStep(s, t, sixteenth) {
    const bar = Math.floor(s / 16) % 4, beat = s % 16;
    if (beat === 0) {
      noteAt(BASS[bar], t, sixteenth * 15, { type: 'sine', vol: 0.07, attack: 0.05 });
      for (const k of CHORDS[bar]) noteAt(SCALE[k], t, sixteenth * 16, { type: 'sine', vol: 0.012 + green * 0.008, attack: 0.4 });
    }
    if (green > 0.45 && beat === 8) noteAt(BASS[bar] * 1.5, t, sixteenth * 6, { type: 'sine', vol: 0.05 });
    const m = MELODY[s];
    const density = 0.12 + green * 0.45;
    if ((beat % 4 === 0 && m.p < 0.35 + green * 0.5) || (beat % 2 === 0 && m.p < density * 0.6)) {
      const idx = Math.min(SCALE.length - 1, m.idx + (green > 0.6 ? 3 : 0));
      noteAt(SCALE[idx], t, sixteenth * (green > 0.5 ? 2.5 : 5), { vol: 0.035 });
    }
    if (green > 0.3 && beat % 2 === 0) hitAt(t, 0.04, 0.012 + green * 0.012, 6000, 'highpass');
    if (green > 0.6 && beat % 8 === 0) hitAt(t, 0.15, 0.08, 140, 'lowpass');
  }

  function schedule() {
    green += (greenTarget - green) * 0.02;
    if (!musicOn || muted) { next = 0; return; }
    if (next < ac.currentTime) { next = ac.currentTime + 0.05; step = 0; }
    const sixteenth = 60 / (78 + green * 30) / 4;
    while (next < ac.currentTime + 0.15) {
      playStep(step, next, sixteenth);
      next += sixteenth;
      step = (step + 1) % 64;
    }
  }

  function music(on, g = greenTarget) {
    musicOn = on;
    greenTarget = g;
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('refloresta.mute', muted ? '1' : '0'); } catch (e) { /* sem storage */ }
    if (musicGain) musicGain.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  const arp = (notes, step = 0.07, opts = {}) => notes.forEach((n, i) => tone(n, step * 1.6, { ...opts, when: i * step }));

  return {
    unlock,
    music,
    toggleMute,
    isMuted: () => muted,
    jump: () => tone(260, 0.14, { slide: 380, vol: 0.05 }),
    spray: () => noise(0.08, { vol: 0.025, freq: 2400, type: 'bandpass' }),
    refill: () => tone(500 + Math.random() * 300, 0.06, { type: 'sine', vol: 0.05, slide: 200 }),
    extinguish: () => { noise(0.4, { vol: 0.12, freq: 3000, type: 'highpass' }); tone(400, 0.25, { type: 'sine', slide: -250, vol: 0.04 }); },
    throwSeed: () => tone(600, 0.08, { type: 'triangle', slide: 300, vol: 0.05 }),
    plant: () => arp([523, 659, 784], 0.06, { type: 'triangle', vol: 0.06 }),
    grow: () => arp([392, 523, 659, 784, 1047], 0.05, { type: 'triangle', vol: 0.05 }),
    fizzle: () => noise(0.25, { vol: 0.06, freq: 800 }),
    pickup: () => arp([880, 1175], 0.05, { vol: 0.04 }),
    rescue: () => arp([523, 659, 784, 1047, 784, 1047], 0.08, { type: 'triangle', vol: 0.07 }),
    bloom: () => arp([392, 494, 587, 784, 988, 1175], 0.07, { type: 'triangle', vol: 0.07 }),
    hurt: () => tone(300, 0.3, { type: 'sawtooth', slide: -220, vol: 0.06 }),
    die: () => arp([392, 330, 262, 196], 0.12, { type: 'sawtooth', vol: 0.05 }),
    rain,
    beat,
    thunder: () => noise(1.6, { vol: 0.18, freq: 160 }),
    card: () => arp([659, 784, 988], 0.05, { type: 'triangle', vol: 0.04 }),
    clean: () => arp([523, 659, 784, 1047, 1319], 0.08, { type: 'sine', vol: 0.07 }),
    win: () => arp([523, 587, 659, 784, 659, 784, 1047], 0.13, { type: 'triangle', vol: 0.08 }),
  };
})();
