/* ═══════════════════════════════════════════════════
   audio.js — Gestion audio via Web Audio API
   (pas de dépendance externe, fonctionne hors ligne)
   ═══════════════════════════════════════════════════ */

const AudioManager = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ── Bip Morse ── */
  function beep(duration = 80, freq = 680, vol = 0.4) {
    const c = getCtx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration / 1000);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration / 1000 + 0.05);
  }

  /* ── Point Morse ── */
  function dot()  { beep(80); }

  /* ── Trait Morse ── */
  function dash() { beep(240); }

  /* ── Touche machine à écrire ── */
  function typewriterKey() {
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.015));
    }
    const src  = c.createBufferSource();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 2200; filter.Q.value = 0.8;
    src.buffer = buf;
    src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    gain.gain.value = 0.5;
    src.start();
  }

  /* ── Friture radio (fichier mp3) ── */
  let staticAudio = null;

  function startStatic() {
    if (!staticAudio) {
      staticAudio = new Audio('audio/radiofry.mp3');
      staticAudio.loop = true;
      staticAudio.volume = 0.25;
    }
    staticAudio.currentTime = 0;
    staticAudio.play().catch(e => console.warn('Static audio blocked:', e));
  }

  function stopStatic() {
    if (!staticAudio) return;
    let vol = staticAudio.volume;
    const interval = setInterval(() => {
      vol -= 0.02;
      if (vol <= 0) {
        clearInterval(interval);
        staticAudio.pause();
        staticAudio.volume = 0.25;
      } else {
        staticAudio.volume = vol;
      }
    }, 40);
  }

  /* ── Son de papier froissé (synthétique) ── */
  function paperRustle() {
    const c = getCtx();
    const buf  = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate;
      const env = Math.exp(-t * 8) * Math.sin(Math.PI * t / 0.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src  = c.createBufferSource();
    const filt = c.createBiquadFilter();
    const gain = c.createGain();
    filt.type = 'highpass'; filt.frequency.value = 3000;
    src.buffer = buf; gain.gain.value = 0.3;
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start();
  }

  /* ── Fanfare finale (synthétique) ── */
  function victory() {
    const c = getCtx();
    const notes = [523, 659, 784, 1047]; // Do Mi Sol Do
    notes.forEach((freq, i) => {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      const t = c.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t); osc.stop(t + 0.55);
    });
  }

  /* ── Son de tintement (cognac) ── */
  function clink() {
    const c = getCtx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.frequency.value = 1760; osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2);
    osc.start(); osc.stop(c.currentTime + 1.3);
  }

  /* ── Son de tampon ── */
  function stamp() {
    const c = getCtx();
    const buf  = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40);
    }
    const src  = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buf; gain.gain.value = 0.6;
    src.connect(gain); gain.connect(c.destination);
    src.start();
  }

  /* ── Sons de bougie (fichiers audio) ── */
  const candleSounds = {
    light: new Audio('audio/light_the_candle.wav'),
    blow: new Audio('audio/blow_out_candle.wav')
  };

  function playCandleSound(name) {
    const snd = candleSounds[name];
    if (snd) {
      snd.currentTime = 0;
      snd.play().catch(e => console.warn('Audio play blocked:', e));
    }
  }

  function lightCandle() {
    playCandleSound('light');
  }

  function blowOutCandle() {
    playCandleSound('blow');
  }

  return { dot, dash, typewriterKey, startStatic, stopStatic, paperRustle, victory, clink, stamp, lightCandle, blowOutCandle };
})();
