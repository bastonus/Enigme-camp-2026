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

  /* Helper robustes pour éviter les AbortError lors des transitions rapides play/pause */
  function safePlay(audioEl) {
    if (!audioEl) return;
    try {
      const p = audioEl.play();
      if (p !== undefined) {
        audioEl._lastPlayPromise = p;
        p.catch(e => {
          console.warn('Lecture audio empêchée ou interrompue:', e);
        });
      }
    } catch (e) {
      console.warn('Erreur lors du play:', e);
    }
  }

  function safePause(audioEl) {
    if (!audioEl) return;
    const p = audioEl._lastPlayPromise;
    if (p !== undefined) {
      p.then(() => {
        if (audioEl._lastPlayPromise === p) {
          try {
            audioEl.pause();
          } catch (e) {
            console.warn('Erreur lors du pause après résolution:', e);
          }
        }
      }).catch(() => {});
    } else {
      try {
        audioEl.pause();
      } catch (e) {
        console.warn('Erreur lors du pause:', e);
      }
    }
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

  /* ── Sons continus pour manipulation manuelle ── */
  let activeOsc = null;
  let activeGain = null;

  function startTone(freq = 680, vol = 0.4) {
    if (activeOsc) return;
    const c = getCtx();
    activeOsc = c.createOscillator();
    activeGain = c.createGain();
    activeOsc.connect(activeGain);
    activeGain.connect(c.destination);
    activeOsc.frequency.value = freq;
    activeOsc.type = 'sine';
    activeGain.gain.setValueAtTime(0, c.currentTime);
    activeGain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01);
    activeOsc.start(c.currentTime);
  }

  function stopTone() {
    if (!activeOsc) return;
    const c = getCtx();
    const localOsc = activeOsc;
    const localGain = activeGain;
    activeOsc = null;
    activeGain = null;
    localGain.gain.setValueAtTime(localGain.gain.value, c.currentTime);
    localGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.01);
    localOsc.stop(c.currentTime + 0.02);
  }

  /* ── Touche machine à écrire ── */
  const typewriterSounds = [
    new Audio('audio/typing_sound.wav'),
    new Audio('audio/typing_sound_2.wav')
  ];

  function typewriterKey() {
    const snd = typewriterSounds[Math.floor(Math.random() * typewriterSounds.length)];
    if (snd) {
      snd.currentTime = 0;
      snd.volume = 0.55;
      snd.play().catch(e => console.warn('Typewriter key play blocked:', e));
    }
  }

  /* ── Son de la machine de l'introduction ── */
  let introTypewriterAudio = null;

  function startIntroTypewriter() {
    if (!introTypewriterAudio) {
      introTypewriterAudio = new Audio('audio/intro-typewriter.wav');
      introTypewriterAudio.loop = true;
      introTypewriterAudio.volume = 0.45;
    }
    introTypewriterAudio.currentTime = 0;
    safePlay(introTypewriterAudio);
  }

  function stopIntroTypewriter() {
    if (!introTypewriterAudio) return;
    let vol = introTypewriterAudio.volume;
    const interval = setInterval(() => {
      vol -= 0.04;
      if (vol <= 0) {
        clearInterval(interval);
        safePause(introTypewriterAudio);
        introTypewriterAudio.volume = 0.45;
      } else {
        introTypewriterAudio.volume = vol;
      }
    }, 30);
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
    safePlay(staticAudio);
  }

  function stopStatic() {
    if (!staticAudio) return;
    let vol = staticAudio.volume;
    const interval = setInterval(() => {
      vol -= 0.02;
      if (vol <= 0) {
        clearInterval(interval);
        safePause(staticAudio);
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

  /* ── Voix Radio Londres (Les français parlent aux français) ── */
  let bbcVoiceAudio = null;

  function startRadioLondresVoice(loop = false, onEnded = null) {
    if (!bbcVoiceAudio) {
      bbcVoiceAudio = new Audio('audio/Les français parlent aux français.wav');
      bbcVoiceAudio.volume = 0.8;
    }
    bbcVoiceAudio.loop = loop;
    bbcVoiceAudio.onended = onEnded;
    bbcVoiceAudio.currentTime = 0;
    safePlay(bbcVoiceAudio);
  }

  function makeRadioLondresVoiceSingle(onEnded) {
    if (bbcVoiceAudio) {
      bbcVoiceAudio.loop = false;
      bbcVoiceAudio.onended = onEnded;
    }
  }

  function stopRadioLondresVoice() {
    if (!bbcVoiceAudio) return;
    bbcVoiceAudio.onended = null;
    let vol = bbcVoiceAudio.volume;
    const interval = setInterval(() => {
      vol -= 0.05;
      if (vol <= 0) {
        clearInterval(interval);
        safePause(bbcVoiceAudio);
        bbcVoiceAudio.volume = 0.8;
      } else {
        bbcVoiceAudio.volume = vol;
      }
    }, 40);
  }

  function setStaticVolume(vol) {
    if (!staticAudio) {
      staticAudio = new Audio('audio/radiofry.mp3');
      staticAudio.loop = true;
    }
    staticAudio.volume = vol;
  }

  function setVoiceVolume(vol) {
    if (!bbcVoiceAudio) {
      bbcVoiceAudio = new Audio('audio/Les français parlent aux français.wav');
    }
    bbcVoiceAudio.volume = vol;
  }

  /* ── Stations Radio Historiques ── */
  const stations = [
    {
      freq: 41.2,
      file: 'La Radio française (1936-1939).mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 43.3,
      file: 'audio/Somewhere Over the Rainbow - The Wizard of Oz (18) Movie CLIP (1939) HD.wav',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 45.4,
      file: 'la grand vadrouille (  marche hongroise)  1966  georges auric.mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 47.5,
      file: 'La Grande Vadrouille - Tea For Two.mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 49.6,
      file: '17 juin 1940 - Maréchal Pétain - Je fais à la France le don de ma personne - Armistice.mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 51.7,
      file: 'Le vrai visage de Mgr Lefebvre.mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 53.8,
      file: 'Nini Peau DChien.mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    },
    {
      freq: 55.9,
      file: 'Fernandel  Jai un beau chapeau  1946.mp3',
      audio: null,
      source: null,
      filter: null,
      gain: null
    }
  ];

  let radioLoopInterval = null;
  let lastFreq = 40.0;
  let isRadioActive = false;

  function startRadioEngineLoop() {
    if (radioLoopInterval) return;
    radioLoopInterval = setInterval(() => {
      if (!isRadioActive) {
        stopRadioEngineLoop();
        return;
      }

      const STATION_FREQS = [41.2, 43.3, 45.4, 47.5, 49.6, 51.7, 53.8, 55.9, 58.7];
      const minDistance = Math.min(...STATION_FREQS.map(f => Math.abs(lastFreq - f)));

      // 1. Calculate static volume: static is loudest in between stations, fades out as we tune in
      let staticVol = 0.35;
      if (minDistance < 2.0) {
        const proximity = 1 - (minDistance / 2.0);
        staticVol = 0.02 + (1 - proximity) * 0.33;
      }
      
      // Add extra static crackles when close but not perfect
      if (minDistance >= 0.15 && minDistance < 2.0) {
        if (Math.random() < 0.18) {
          staticVol = Math.min(0.55, staticVol + 0.22);
        }
      }
      
      setStaticVolume(staticVol);

      const c = getCtx();

      // 2. Update historical stations
      stations.forEach(st => {
        const distance = Math.abs(lastFreq - st.freq);
        const maxDistance = 2.0;

        if (distance < maxDistance && st.gain && st.filter) {
          const proximity = 1 - (distance / maxDistance);
          let vol = proximity * 0.8;

          // Glitch / Cutout effect if not exactly tuned
          if (distance >= 0.15) {
            // Further away = higher chance of cutting out completely
            const cutoffProb = 0.12 + (1 - proximity) * 0.68;
            if (Math.random() < cutoffProb) {
              vol = 0.0; // Cut out!
            } else {
              // Rapid flicker
              vol = vol * (0.2 + Math.random() * 0.8);
            }
          }

          st.gain.gain.setTargetAtTime(vol, c.currentTime, 0.04);
          const cutoff = 250 + (proximity * proximity) * 11750;
          st.filter.frequency.setTargetAtTime(cutoff, c.currentTime, 0.04);
        } else if (st.gain) {
          st.gain.gain.setTargetAtTime(0.0, c.currentTime, 0.04);
        }
      });

      // 3. Update the BBC voice (Les français parlent aux français) if active
      const bbcDistance = Math.abs(lastFreq - 58.7);
      const bbcMaxDistance = 2.2;
      if (bbcDistance < bbcMaxDistance) {
        const proximity = 1 - (bbcDistance / bbcMaxDistance);
        let bbcVol = 0.8 * proximity;

        // Glitch/Cutout effect if not exactly tuned
        if (bbcDistance >= 0.15) {
          const cutoffProb = 0.12 + (1 - proximity) * 0.68;
          if (Math.random() < cutoffProb) {
            bbcVol = 0.0;
          } else {
            bbcVol = bbcVol * (0.2 + Math.random() * 0.8);
          }
        }
        setVoiceVolume(bbcVol);
      } else {
        setVoiceVolume(0.0);
      }
    }, 85);
  }

  function stopRadioEngineLoop() {
    if (radioLoopInterval) {
      clearInterval(radioLoopInterval);
      radioLoopInterval = null;
    }
  }

  function startAllStations() {
    const c = getCtx();
    stations.forEach(st => {
      if (!st.audio) {
        st.audio = new Audio(st.file);
        st.audio.loop = true;
        st.audio.crossOrigin = 'anonymous';
        st.audio.volume = 1.0; // Control volume via Web Audio GainNode
        
        st.source = c.createMediaElementSource(st.audio);
        st.filter = c.createBiquadFilter();
        st.filter.type = 'lowpass';
        st.filter.frequency.value = 250; // start muffled
        
        st.gain = c.createGain();
        st.gain.gain.value = 0.0; // start silent
        
        st.source.connect(st.filter);
        st.filter.connect(st.gain);
        st.gain.connect(c.destination);
      }
      
      if (st.audio.paused) {
        safePlay(st.audio);
      }
    });
  }

  function updateStationVolumes(currentFreq, radioOn) {
    lastFreq = currentFreq;
    isRadioActive = radioOn;

    if (!radioOn) {
      stopRadioEngineLoop();
      stations.forEach(st => {
        if (st.gain) {
          st.gain.gain.value = 0;
        }
        if (st.audio && !st.audio.paused) {
          safePause(st.audio);
        }
      });
      return;
    }
    
    startAllStations();
    startRadioEngineLoop();
  }

  /* ── Chant des partisans ── */
  let victoryChantAudio = null;

  function playChantDesPartisans() {
    if (!victoryChantAudio) {
      victoryChantAudio = new Audio('LE CHANT DES PARTISANS.mp3');
      victoryChantAudio.volume = 0.85;
      victoryChantAudio.loop = true;
    }
    victoryChantAudio.currentTime = 0;
    safePlay(victoryChantAudio);
  }

  function stopChantDesPartisans() {
    if (victoryChantAudio) {
      safePause(victoryChantAudio);
    }
  }

  const gunshotAudio = new Audio('audio/luger_sound_effect.wav');

  /* ── Bruit de tir (Luger) ── */
  function playGunshot(onEndedCallback) {
    gunshotAudio.currentTime = 0;
    gunshotAudio.volume = 0.8;
    if (onEndedCallback) {
      gunshotAudio.onended = () => {
        gunshotAudio.onended = null;
        onEndedCallback();
      };
    } else {
      gunshotAudio.onended = null;
    }
    gunshotAudio.play().catch(e => {
      console.warn('Gunshot audio play blocked:', e);
      if (onEndedCallback) {
        onEndedCallback();
      }
    });
  }

  const glassBreakingAudio = new Audio('glass breaking.wav');

  /* ── Bruit de vitre brisée (cadre photo) ── */
  function playGlassBreaking() {
    glassBreakingAudio.currentTime = 0;
    glassBreakingAudio.volume = 0.95;
    glassBreakingAudio.play().catch(e => console.warn('Glass breaking audio play blocked:', e));
  }

  return { dot, dash, startTone, stopTone, typewriterKey, startIntroTypewriter, stopIntroTypewriter, startStatic, stopStatic, paperRustle, victory, clink, stamp, lightCandle, blowOutCandle, startRadioLondresVoice, makeRadioLondresVoiceSingle, stopRadioLondresVoice, setStaticVolume, setVoiceVolume, updateStationVolumes, beep, playChantDesPartisans, stopChantDesPartisans, playGunshot, playGlassBreaking };
})();

