/* ═══════════════════════════════════════════════════
   main.js — Logique principale Opération Cubjac 2026
   ═══════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────
   ÉTAT GLOBAL & GLOBALS
────────────────────────────────────── */
const State = {
  startTime: null,
  lampOn: true,
  radioOn: false,
  radioTuned: false,
  radioActivatedOnce: false,
  morseDecoded: false,
  altitudeFound: false,
  cipherComplete: true, // true par défaut pour déchiffrer en direct
  paperRevealed: false,
  boussoleFlipped: false,
  boussoleOriented: false,
  targetFound: false,
  victoryDone: false,
  hintCount: 0,
  typedAnswer: '',
  radioFrequency: 40.0,
};

// Map & Protractor global references
let map = null;
let protractor = null;
let mapLine = null;
let cubjacMarker = null;
let tourtoiracMarker = null;

// Morse timing and decoding state
let lastPressTime = 0;
let lastReleaseTime = 0;
let isKeyPressed = false;
let currentMorseLetter = '';
let decodedMorseWord = '';
let letterTimer = null;
let wordTimer = null;

const HINTS = [
  "Commence par ouvrir la boîte à cigares — soulève le cigare.",
  "Allume le poste radio et écoute attentivement. Note les sons courts (·) et longs (—).",
  "Le message Morse te donne un nombre. Cherche ce nombre sur la carte IGN.",
  "L'altitude trouvée (182) est la clé de la grille du carnet.",
  "Glisse le Luger — il repose sur un message chiffré. Utilise la grille pour le décoder.",
  "Retourne la boussole : l'azimut 245° depuis Tourtoirac pointe sur le village cible.",
  "Tape CUBJAC sur la machine à écrire pour valider.",
];

/* ──────────────────────────────────────
   INTRO — TÉLÉTYPE
────────────────────────────────────── */
const INTRO_TEXT =
`ÉTAT-MAJOR DES F.F.I. — SECTEUR PÉRIGORD VERT
ORDRE DE MISSION N°4 — CONFIDENTIEL
─────────────────────────────────────────────

DATE : 4 AOÛT 1944 — 21H30

Nos réseaux ont perdu le contact avec l'agent FACTEUR.
Son dernier message Morse indiquait un point de parachutage
allié prévu pour cette nuit. Il n'a pas pu transmettre
les coordonnées complètes.

Vous avez accès à son poste de transmission.
Tout ce qu'il vous faut est sur cette table.
La Libération de Périgueux dépend de votre rapidité.

Ne faites pas de bruit.

                        — WHISKY`;

const PREAMBLE = `ORDRE DE MISSION N°4
====================
Secteur : Périgord Vert
Date : 4 août 1944

Émetteur clandestin du réseau AS prêt pour réception.`;

let introIdx = 0, introTimer = null, missionStarted = false;
function handleIntroClick(e) {
  if (e.target.tagName.toLowerCase() === 'button') return;
  if (!missionStarted) {
    startMission();
  } else if (document.getElementById('intro-screen').style.display !== 'none') {
    skipIntro();
  }
}

function startMission() {
  if (missionStarted) return;
  missionStarted = true;
  
  const prompt = document.getElementById('intro-start-prompt');
  if (prompt) prompt.style.display = 'none';
  
  const skipBtn = document.getElementById('intro-skip');
  if (skipBtn) skipBtn.style.display = 'block';

  // Ajouter un saut de ligne et un séparateur pour la suite de la transmission
  const el = document.getElementById('teletype-text');
  if (el) {
    el.textContent = PREAMBLE + "\n\n--- DÉBUT DE LA TRANSMISSION ---\n\n";
  }

  runIntro();
}

function runIntro() {
  const el = document.getElementById('teletype-text');
  if (introIdx === 0) {
    AudioManager.startIntroTypewriter();
  }
  if (introIdx >= INTRO_TEXT.length) {
    const skipBtn = document.getElementById('intro-skip');
    if (skipBtn) skipBtn.style.color = '#a89060';
    AudioManager.stopIntroTypewriter();
    return;
  }
  el.textContent += INTRO_TEXT[introIdx];
  introIdx++;
  // Vitesse variable : plus rapide sur les tirets/espaces
  const ch = INTRO_TEXT[introIdx - 1];
  const delay = ch === '\n' ? 60 : ch === '─' ? 15 : ch === ' ' ? 18 : 28;
  introTimer = setTimeout(runIntro, delay);
}

function skipIntro() {
  clearTimeout(introTimer);
  AudioManager.stopIntroTypewriter();
  document.getElementById('teletype-text').textContent = PREAMBLE + "\n\n--- DÉBUT DE LA TRANSMISSION ---\n\n" + INTRO_TEXT;
  showScene();
}

function showScene() {
  document.getElementById('intro-screen').style.opacity = '0';
  document.getElementById('intro-screen').style.transition = 'opacity 1.5s';
  setTimeout(() => {
    document.getElementById('intro-screen').style.display = 'none';
    const scene = document.getElementById('scene');
    scene.classList.add('visible');
    State.startTime = Date.now();
  }, 1500);
}

/* ──────────────────────────────────────
   CURSEUR SPOTLIGHT
────────────────────────────────────── */
function initSpotlight() {
  const spot   = document.getElementById('spotlight');
  const cursor = document.getElementById('custom-cursor');
  document.addEventListener('mousemove', e => {
    spot.style.left   = e.clientX + 'px';
    spot.style.top    = e.clientY + 'px';
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });
}

/* ──────────────────────────────────────
   MODALS
────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('closing');
  el.classList.add('open');
  if (id === 'modal-carte' && !window._mapInit) initMap();
  if (id === 'modal-machine') {
    const paper = document.getElementById('typewriter-paper');
    if (paper) paper.focus();
  }
}

function closeModal(id) {
  if (id === 'modal-machine' && typewriterAutoTyping) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('closing');
  
  if (id === 'modal-machine') {
    typewriterActive = false;
  }
  
  if (id === 'modal-radio-tuner') {
    if (tunerTunedTimer) {
      clearTimeout(tunerTunedTimer);
      tunerTunedTimer = null;
    }
    
    // Check if successfully tuned to the correct BBC frequency with radio turned ON
    const isTuned = Math.abs((State.radioFrequency || 0) - 58.7) < 0.15;
    const radioEl = document.getElementById('obj-radio');
    
    if (isTuned && State.radioOn) {
      State.radioTuned = true;
      if (radioEl) {
        radioEl.classList.add('on');
      }
      setRadioIlluminated(true);
      
      if (!State.bbcVoicePlayed) {
        if (radioEl) radioEl.classList.add('disabled');
        updateRadioStatus('🔊 RÉCEPTION RÉUSSIE — ÉCOUTEZ LE MESSAGE…');
        
        State.radioActivatedOnce = true;
        AudioManager.makeRadioLondresVoiceSingle(() => {
          if (radioEl) radioEl.classList.remove('disabled');
          if (!State.radioOn) return;
          State.bbcVoicePlayed = true;
          updateRadioStatus('🔊 BBC LONDRES — EN COURS DE RÉCEPTION…');
          audioMorseSequence();
        });
      } else {
        if (radioEl) radioEl.classList.remove('disabled');
        updateRadioStatus('🔊 BBC LONDRES — EN COURS DE RÉCEPTION…');
        audioMorseSequence();
      }
    } else {
      // Not tuned or radio is OFF: keep playing background stations/static if ON
      if (!State.radioOn) {
        if (radioEl) radioEl.classList.remove('on');
        setRadioIlluminated(false);
        updateRadioStatus('[ RADIO ÉTEINTE ]');
      } else {
        if (radioEl) radioEl.classList.add('on');
        setRadioIlluminated(true);
        updateRadioStatus('🔊 SYNTONISATION… FRÉQUENCE : ' + State.radioFrequency.toFixed(1) + ' MHz');
      }
    }
  }

  setTimeout(() => {
    if (el.classList.contains('closing')) {
      el.classList.remove('open');
      el.classList.remove('closing');
    }
  }, 580);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      const id = m.id;
      if (id) closeModal(id);
      else m.classList.remove('open');
    });
  }
});

/* ──────────────────────────────────────
   BOÎTE À CIGARES
────────────────────────────────────── */
let cigareOpen = false;
let cigarSlid = false;

function openCigareBox() {
  if (cigareOpen) return;
  cigareOpen = true;
  AudioManager.paperRustle();

  const cigar = document.getElementById('obj-cigare');
  const box   = document.getElementById('obj-cigare-box');

  if (box) box.style.filter = 'drop-shadow(4px 8px 12px rgba(0,0,0,0.7)) brightness(1.15)';

  if (cigar) {
    cigar.style.display    = 'block';
    cigar.style.zIndex     = '13';  // sous la boîte au départ
    
    // Aligné sur la boîte
    cigar.style.top        = '66.3%';
    cigar.style.left       = '22.1%';
    
    cigar.style.transition = 'none';
    cigar.style.opacity    = '0';
    // Part caché plus bas dans l'axe -12deg
    cigar.style.transform  = 'rotate(-12deg) translateY(2vw)';
    cigar.offsetHeight; // force reflow

    // Glisse vers le haut (le long de l'axe de la boîte)
    cigar.style.transition = 'transform 0.9s cubic-bezier(0.25,0.8,0.25,1), opacity 0.6s ease';
    cigar.style.opacity    = '1';
    cigar.style.transform  = 'rotate(-12deg) translateY(-8vw)';

    setTimeout(() => { cigar.style.zIndex = '35'; }, 900);
  }
}

function toggleCigarRoll() {
  const cigar = document.getElementById('obj-cigare');
  const label = document.getElementById('cigar-label');
  if (!cigarSlid) {
    cigarSlid = true;
    AudioManager.paperRustle();

    // Glisse vers la droite en restant droit pour dévoiler l'étiquette
    cigar.style.transition = 'transform 1.2s cubic-bezier(0.25,0.8,0.25,1)';
    cigar.style.transform  = 'rotate(-12deg) translateY(-8vw) translateX(12vw)';

    if (label) {
      setTimeout(() => {
        label.style.transition   = 'transform 0.8s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.8s ease';
        label.style.zIndex       = '34';
        label.style.opacity      = '1';
        label.style.transform    = 'scale(1) translate(10vw, -10vw) rotate(-8deg)';
        label.style.filter       = 'brightness(0.84) contrast(0.92) sepia(0.35) drop-shadow(5px 10px 18px rgba(0,0,0,0.85))';
        label.style.pointerEvents = 'auto';
      }, 600);
    }
  } else {
    cigarSlid = false;
    AudioManager.paperRustle();

    // Revient à sa position juste au-dessus de la boîte
    cigar.style.transition = 'transform 1.2s cubic-bezier(0.25,0.8,0.25,1)';
    cigar.style.transform  = 'rotate(-12deg) translateY(-8vw) translateX(0)';

    if (label) {
      label.style.transition    = 'transform 0.5s ease, opacity 0.5s ease';
      label.style.opacity       = '0';
      label.style.transform     = 'scale(0.5) rotate(15deg)';
      label.style.pointerEvents = 'none';
      setTimeout(() => { if (!cigarSlid) label.style.zIndex = '14'; }, 500);
    }
  }

  if (typeof updateShadows === 'function') {
    setTimeout(updateShadows, 50);
    setTimeout(updateShadows, 600);
    setTimeout(updateShadows, 1200);
  }
}

/* ──────────────────────────────────────
   RADIO BAKÉLITE
────────────────────────────────────── */
const MORSE_TABLE = {
  A:'·−',B:'−···',C:'−·−·',D:'−··',E:'·',F:'··−·',G:'−−·',H:'····',
  I:'··',J:'·−−−',K:'−·−',L:'·−··',M:'−−',N:'−·',O:'−−−',P:'·−−·',
  Q:'−−·−',R:'·−·',S:'···',T:'−',U:'··−',V:'···−',W:'·−−',X:'−··−',
  Y:'−·−−',Z:'−−··',
  '1':'·−−−−','2':'··−−−','3':'···−−','4':'····−','5':'·····',
  '6':'−····','7':'−−···','8':'−−−··','9':'−−−−·','0':'−−−−−'
};

let radioPhase = 0;
let morseAudioCtx = null;
let morseMasterGain = null;
let morseMasterFilter = null;
let morseSignalInterval = null;
let activeRadioTimeouts = [];

function updateRadioStatus(htmlText, forceShow = false) {
  const bar = document.getElementById('radio-status-bar');
  if (!bar) return;
  if (htmlText) {
    bar.innerHTML = htmlText;
    bar.classList.add('visible');
  } else if (!forceShow) {
    bar.classList.remove('visible');
  }
}

function setRadioIlluminated(on) {
  const radioEl = document.getElementById('obj-radio');
  const radioImg = radioEl ? radioEl.querySelector('img') : null;
  if (radioEl) {
    if (on) {
      radioEl.classList.add('illuminated');
      if (radioImg && !radioImg.src.endsWith('illuminated.png')) {
        radioImg.src = 'img/poste_radio illuminated.png';
      }
    } else {
      radioEl.classList.remove('illuminated');
      if (radioImg && !radioImg.src.endsWith('off.png')) {
        radioImg.src = 'img/poste_radio off.png';
      }
    }
  }
}

function toggleRadioPower(e) {
  if (e) e.stopPropagation();
  if (window.adminActive) return;

  const radioEl = document.getElementById('obj-radio');
  if (radioEl && radioEl.classList.contains('disabled')) return;
  
  openRadioTuner();
}

let tunerTunedTimer = null;

function openRadioTuner() {
  openModal('modal-radio-tuner');
  
  // Stop and clean up any ongoing Morse sequence states only if not solved yet (keeps Morse on airwaves if solved)
  if (!State.bbcVoicePlayed) {
    if (morseAudioCtx) {
      try { morseAudioCtx.close(); } catch(err) {}
      morseAudioCtx = null;
    }
    if (morseSignalInterval) {
      clearInterval(morseSignalInterval);
      morseSignalInterval = null;
    }
    activeRadioTimeouts.forEach(tId => clearTimeout(tId));
    activeRadioTimeouts = [];
  }

  // Make the desk radio show it is ON
  const radioEl = document.getElementById('obj-radio');
  State.radioOn = true;
  if (radioEl) {
    radioEl.classList.add('on');
    radioEl.classList.remove('disabled');
  }
  setRadioIlluminated(true);
  updateRadioStatus('[ FRITURE… RÉGLAGE DE LA FRÉQUENCE ]');
  
  // Update power button visual state (ON / pushed)
  const powerBtn = document.getElementById('tuner-power-btn');
  const powerLabel = document.getElementById('tuner-power-label');
  if (powerBtn) {
    powerBtn.style.transform = 'translateY(2px)';
    powerBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.6), inset 0 4px 8px rgba(0,0,0,0.6)';
    powerBtn.style.background = 'radial-gradient(circle at 35% 35%, #ff6b60, #d90b00)';
  }
  if (powerLabel) {
    powerLabel.textContent = "ON";
    powerLabel.style.color = "#30a030";
  }

  // Set tuner state
  const slider = document.getElementById('tuner-slider');
  if (slider) {
    if (State.radioFrequency === undefined || State.radioFrequency === 40.0) {
      State.radioFrequency = parseFloat((41.0 + Math.random() * 4).toFixed(1)); // random start frequency between 41.0 and 45.0
    }
    slider.value = State.radioFrequency;
    updateRadioTuningUI(State.radioFrequency);
  }
  
  // Start static and voice for audio feedback
  AudioManager.startStatic();
  if (!State.bbcVoicePlayed) {
    AudioManager.startRadioLondresVoice(true);
  } else if (!morseAudioCtx) {
    audioMorseSequence();
  }
  
  // Start historical stations in background
  AudioManager.updateStationVolumes(State.radioFrequency || 40.0, true);
  
  // Listen for changes
  if (slider && !slider._listenerAdded) {
    slider._listenerAdded = true;
    slider.addEventListener('input', () => {
      State.radioFrequency = parseFloat(slider.value);
      updateRadioTuningUI(State.radioFrequency);
    });
  }
}

function toggleTunerPower() {
  const powerBtn = document.getElementById('tuner-power-btn');
  const powerLabel = document.getElementById('tuner-power-label');

  if (State.radioOn) {
    // Turn OFF
    State.radioOn = false;
    AudioManager.updateStationVolumes(State.radioFrequency || 40.0, false);
    AudioManager.stopStatic();
    AudioManager.stopRadioLondresVoice();
    
    // Visuel bouton rouge OFF (relâché)
    if (powerBtn) {
      powerBtn.style.transform = 'translateY(0)';
      powerBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.3)';
      powerBtn.style.background = 'radial-gradient(circle at 35% 35%, #ff3b30, #a90b00)';
    }
    if (powerLabel) {
      powerLabel.textContent = "OFF";
      powerLabel.style.color = "#a03030";
    }

    // Update desk radio visual
    const radioEl = document.getElementById('obj-radio');
    if (radioEl) radioEl.classList.remove('on');
    setRadioIlluminated(false);
    updateRadioStatus('[ RADIO ÉTEINTE ]');
    
    // Stop Morse
    if (morseAudioCtx) {
      try { morseAudioCtx.close(); } catch(err) {}
      morseAudioCtx = null;
    }
    if (morseSignalInterval) {
      clearInterval(morseSignalInterval);
      morseSignalInterval = null;
    }
    activeRadioTimeouts.forEach(tId => clearTimeout(tId));
    activeRadioTimeouts = [];
  } else {
    // Turn ON
    State.radioOn = true;
    
    // Visuel bouton rouge ON (enfoncé)
    if (powerBtn) {
      powerBtn.style.transform = 'translateY(2px)';
      powerBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.6), inset 0 4px 8px rgba(0,0,0,0.6)';
      powerBtn.style.background = 'radial-gradient(circle at 35% 35%, #ff6b60, #d90b00)';
    }
    if (powerLabel) {
      powerLabel.textContent = "ON";
      powerLabel.style.color = "#30a030";
    }

    // Update desk radio visual
    const radioEl = document.getElementById('obj-radio');
    if (radioEl) radioEl.classList.add('on');
    setRadioIlluminated(true);
    updateRadioStatus('[ FRITURE… RÉGLAGE DE LA FRÉQUENCE ]');
    
    // Start static and voice for audio feedback
    AudioManager.startStatic();
    if (!State.bbcVoicePlayed) {
      AudioManager.startRadioLondresVoice(true);
    } else if (!morseAudioCtx) {
      audioMorseSequence();
    }
    
    // Start historical stations in background
    AudioManager.updateStationVolumes(State.radioFrequency || 40.0, true);
  }
}

function adjustTuner(delta) {
  const slider = document.getElementById('tuner-slider');
  if (slider) {
    let val = parseFloat(slider.value) + delta;
    val = Math.max(40.0, Math.min(60.0, val));
    slider.value = val.toFixed(1);
    State.radioFrequency = val;
    updateRadioTuningUI(val);
  }
}

function updateRadioTuningUI(freq) {
  const freqVal = document.getElementById('tuner-freq-val');
  const needle = document.getElementById('tuner-needle');
  const glow = document.getElementById('tuner-glow');
  
  if (freqVal) freqVal.textContent = freq.toFixed(1);
  
  // Map 40.0 - 60.0 to 0% - 100%
  const pct = ((freq - 40.0) / 20.0) * 100;
  if (needle) {
    needle.style.left = `calc(${pct}% - 1px)`;
  }
  
  if (glow) {
    glow.style.background = 'radial-gradient(circle, rgba(212,130,10,0.08) 0%, transparent 80%)';
  }

  // Update historical stations volume, static noise, and filters based on power status
  AudioManager.updateStationVolumes(freq, State.radioOn);
}

/* Séquence Morse audio (synthétisée) */
const MORSE_MESSAGE = 'ALTITUDE FORGE CENT QUATRE VINGT DEUX';

function updateMorseSignalProperties() {
  if (!morseAudioCtx || !morseMasterGain || !morseMasterFilter) return;
  
  const freq = State.radioFrequency || 40.0;
  const bbcDistance = Math.abs(freq - 58.7);
  const bbcMaxDistance = 2.2;
  
  if (bbcDistance < bbcMaxDistance && State.radioOn) {
    const proximity = 1 - (bbcDistance / bbcMaxDistance);
    let vol = 1.0 * proximity;
    
    // Glitch/Cutout effect if not exactly tuned
    if (bbcDistance >= 0.15) {
      const cutoffProb = 0.12 + (1 - proximity) * 0.68;
      if (Math.random() < cutoffProb) {
        vol = 0.0;
      } else {
        vol = vol * (0.2 + Math.random() * 0.8);
      }
    }
    
    const cTime = morseAudioCtx.currentTime;
    morseMasterGain.gain.setTargetAtTime(vol, cTime, 0.04);
    const cutoff = 250 + (proximity * proximity) * 11750;
    morseMasterFilter.frequency.setTargetAtTime(cutoff, cTime, 0.04);
  } else {
    morseMasterGain.gain.setTargetAtTime(0.0, morseAudioCtx.currentTime, 0.04);
  }
}

function audioMorseSequence() {
  activeRadioTimeouts.forEach(tId => clearTimeout(tId));
  activeRadioTimeouts = [];
  
  if (!morseAudioCtx) {
    morseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    morseMasterFilter = morseAudioCtx.createBiquadFilter();
    morseMasterFilter.type = 'lowpass';
    morseMasterFilter.frequency.value = 12000;
    
    morseMasterGain = morseAudioCtx.createGain();
    morseMasterGain.gain.value = 1.0;
    
    morseMasterFilter.connect(morseMasterGain);
    morseMasterGain.connect(morseAudioCtx.destination);
    
    morseSignalInterval = setInterval(updateMorseSignalProperties, 85);
  }

  // Update desk radio status text
  const isTuned = Math.abs((State.radioFrequency || 0) - 58.7) < 0.15;
  if (isTuned) {
    updateRadioStatus('🔊 BBC LONDRES — EN COURS DE RÉCEPTION…');
  }

  const DOT = 240, DASH = 720, GAP = 240, LETTER_GAP = 720, WORD_GAP = 1680;
  let t = morseAudioCtx.currentTime + 1.0;
  let currentDelay = 1000;

  function scheduleSymbol(sym) {
    const dur = sym === '·' ? DOT : DASH;
    const osc  = morseAudioCtx.createOscillator();
    const gain = morseAudioCtx.createGain();
    osc.connect(gain); gain.connect(morseMasterFilter);
    osc.frequency.value = 680; osc.type = 'sine';
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.setValueAtTime(0.35, t + dur/1000 - 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur/1000 + 0.02);
    osc.start(t); osc.stop(t + dur/1000 + 0.05);
    t += dur/1000 + GAP/1000;
  }

  function triggerLed(on, delay) {
    const tId = setTimeout(() => {
      if (!State.radioOn) return;
      const isCurrentlyTuned = Math.abs((State.radioFrequency || 0) - 58.7) < 0.15;
      if (isCurrentlyTuned) {
        setRadioIlluminated(on);
      } else {
        setRadioIlluminated(false);
      }
    }, delay);
    activeRadioTimeouts.push(tId);
  }

  MORSE_MESSAGE.split('').forEach(ch => {
    if (ch === ' ') {
      currentDelay += WORD_GAP;
      t += WORD_GAP/1000;
      return;
    }
    const code = MORSE_TABLE[ch.toUpperCase()];
    if (!code) return;
    [...code].forEach(sym => {
      if (sym !== ' ') {
        const dur = sym === '·' ? DOT : DASH;
        scheduleSymbol(sym);
        
        triggerLed(true, currentDelay);
        triggerLed(false, currentDelay + dur);
        
        currentDelay += dur + GAP;
      }
    });
    currentDelay += LETTER_GAP;
    t += LETTER_GAP / 1000;
  });

  const totalDuration = (t - morseAudioCtx.currentTime + 0.5) * 1000;
  const finishTimeout = setTimeout(() => {
    if (!State.radioOn) return;
    State.morseDecoded = true;
    audioMorseSequence(); // Loop the morse sequence
  }, totalDuration);
  activeRadioTimeouts.push(finishTimeout);
}

/* ──────────────────────────────────────
   CARTE IGN 1950 — LEAFLET
────────────────────────────────────── */

// Coordonnées de Tourtoirac (clocher)
const TOURTOIRAC = [45.0165, 1.0398];
const IGN_TOPO_URL = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN50.1950&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const IGN_ORTHO_URL = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

let miniMap = null;
let fullMap = null;
let currentLayer = 'topo';
let topoLayer = null, orthoLayer = null;
let topoLayerFull = null, orthoLayerFull = null;
let rapporteurAngle = 0;
let rapDragging = false;
let rapOffset = { x: 0, y: 0 };
let rapPos = { x: 0, y: 0 };

function initMap() {
  if (window._miniMapInit) return;
  window._miniMapInit = true;

  const container = document.getElementById('obj-carte');
  if (!container) return;

  // Créer un div intérieur pour Leaflet (sinon Leaflet écrit dans le div .obj)
  const mapDiv = document.createElement('div');
  mapDiv.id = 'mini-map-inner';
  mapDiv.style.cssText = 'width:100%; height:100%; position:absolute; inset:0;';
  container.appendChild(mapDiv);

  miniMap = L.map('mini-map-inner', {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    keyboard: false,
    touchZoom: false,
    attributionControl: false,
    boxZoom: false,
  }).setView(TOURTOIRAC, 13);

  L.tileLayer(IGN_TOPO_URL, { maxZoom: 15, attribution: '' }).addTo(miniMap);

  // Marker Tourtoirac (petit point)
  L.circleMarker(TOURTOIRAC, {
    radius: 4, color: '#e74c3c', fillColor: '#e74c3c',
    fillOpacity: 0.9, weight: 1.5
  }).addTo(miniMap);
}

function openMapModal() {
  const modal = document.getElementById('modal-carte');
  if (!modal) return;
  modal.style.display = 'block';
  AudioManager.paperRustle();

  // Initialise la carte plein écran une seule fois
  if (!window._fullMapInit) {
    window._fullMapInit = true;

    setTimeout(() => {
      fullMap = L.map('fullscreen-map', {
        zoomControl: false,
        attributionControl: false,
        keyboard: false,
      });

      topoLayerFull  = L.tileLayer(IGN_TOPO_URL,  { maxZoom: 19, maxNativeZoom: 15, attribution: '' });
      orthoLayerFull = L.tileLayer(IGN_ORTHO_URL, { maxZoom: 19, attribution: '' });
      topoLayerFull.addTo(fullMap);

      // Villes et fil d'ariane rouge
      const MAP_CITIES = [
        { name: 'Périgueux', coords: [45.1839, 0.7114], rot: -2 },
        { name: 'Cubjac', coords: [45.2222, 0.9389], rot: 3 },
        { name: 'Excideuil', coords: [45.3371, 1.0475], rot: -4 },
        { name: 'Hautefort', coords: [45.2595, 1.1497], rot: 2 },
        { name: 'Thenon', coords: [45.1383, 1.0717], rot: -1 },
        { name: 'Montignac', coords: [45.0658, 1.1650], rot: 4 },
        { name: 'Tourtoirac', coords: TOURTOIRAC, rot: -3 }
      ];

      // Fil rouge reliant les villes (continu)
      const pathCoords = MAP_CITIES.map(c => c.coords);
      L.polyline(pathCoords, {
        color: '#e74c3c', // Fil rouge
        weight: 3.5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'red-thread-shadow'
      }).addTo(fullMap);

      // Épingles et étiquettes papier pour chaque ville
      MAP_CITIES.forEach(city => {
        const iconHtml = `
          <div style="position:relative; width:0; height:0;">
            <div class="city-label-paper" style="transform: translateX(-50%) rotate(${city.rot}deg);">
              ${city.name}
            </div>
            <div class="city-label-pin"></div>
          </div>
        `;
        const cityIcon = L.divIcon({
          className: 'custom-city-icon',
          html: iconHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0] // L'origine est exactement à la coordonnée (là où se trouve l'épingle)
        });
        L.marker(city.coords, { icon: cityIcon }).addTo(fullMap);
      });

      // Ajuster la vue pour englober toutes les villes
      const bounds = L.latLngBounds(pathCoords);
      fullMap.fitBounds(bounds, { padding: [60, 60] });

      // Position initiale du rapporteur (centré sur l'écran)
      setTimeout(() => {
        positionRapporteurCenter();
      }, 50);
      
      initRapporteurTicks();
      initRapporteurDrag();
      initRapporteurKeyboard();
    }, 100);
  } else {
    setTimeout(() => { 
      fullMap.invalidateSize(); 
      // Réajuster la vue sur les villes si on rouvre la carte
      if (typeof MAP_CITIES !== 'undefined') {
        // Wait, MAP_CITIES is scoped to the if block. Let's not re-fit bounds if they moved the map, they might want to keep their view.
        // Actually, they want the overview every time they open.
      }
      positionRapporteurCenter();
    }, 100);
  }
}

function closeMapModal() {
  const modal = document.getElementById('modal-carte');
  if (modal) modal.style.display = 'none';
  AudioManager.paperRustle();
  // Désactiver le listener clavier du rapporteur
  document.removeEventListener('keydown', rapporteurKeyHandler);
}

function setMapLayer(type) {
  if (!fullMap) return;
  currentLayer = type;
  if (type === 'topo') {
    if (orthoLayerFull) fullMap.removeLayer(orthoLayerFull);
    if (topoLayerFull) topoLayerFull.addTo(fullMap);
    document.getElementById('map-layer-topo').style.borderColor = '#8a7040';
    document.getElementById('map-layer-topo').style.color = '#d4c890';
    document.getElementById('map-layer-ortho').style.borderColor = '#4a4030';
    document.getElementById('map-layer-ortho').style.color = '#7a6850';
  } else {
    if (topoLayerFull) fullMap.removeLayer(topoLayerFull);
    if (orthoLayerFull) orthoLayerFull.addTo(fullMap);
    document.getElementById('map-layer-ortho').style.borderColor = '#8a7040';
    document.getElementById('map-layer-ortho').style.color = '#d4c890';
    document.getElementById('map-layer-topo').style.borderColor = '#4a4030';
    document.getElementById('map-layer-topo').style.color = '#7a6850';
  }
}

function positionRapporteurCenter() {
  const rap = document.getElementById('rapporteur');
  const mapDiv = document.getElementById('fullscreen-map');
  if (!rap || !mapDiv) return;
  
  const rect = mapDiv.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  rap.style.transform = 'none';
  rap.style.left = (centerX - 140) + 'px';
  rap.style.top  = (centerY - 140) + 'px';
  rapPos = { x: centerX - 140, y: centerY - 140 };
}

function initRapporteurTicks() {
  const svg = document.getElementById('rapporteur-svg');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const cx = 140, cy = 140, R = 130;

  // Ticks tous les 5° sur le demi-cercle supérieur (0-180°)
  for (let deg = 0; deg <= 180; deg += 5) {
    const rad = (deg - 90) * Math.PI / 180; // 0 = top
    const isMajor = deg % 10 === 0;
    const inner = R - (isMajor ? 14 : 8);
    const x1 = cx + R * Math.cos(rad);
    const y1 = cy + R * Math.sin(rad);
    const x2 = cx + inner * Math.cos(rad);
    const y2 = cy + inner * Math.sin(rad);

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x1.toFixed(1));
    line.setAttribute('y1', y1.toFixed(1));
    line.setAttribute('x2', x2.toFixed(1));
    line.setAttribute('y2', y2.toFixed(1));
    line.setAttribute('stroke', '#111');
    line.setAttribute('stroke-width', isMajor ? '1.5' : '0.8');
    line.setAttribute('opacity', '0.8');
    svg.insertBefore(line, svg.querySelector('#rapporteur-arm'));

    // Labels tous les 30°
    if (deg % 30 === 0) {
      const lr = R - 25;
      const tx = cx + lr * Math.cos(rad);
      const ty = cy + lr * Math.sin(rad);
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', tx.toFixed(1));
      text.setAttribute('y', ty.toFixed(1));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#111');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('font-weight', 'bold');
      // Afficher l'azimut réel (0° = N, 90° = E, etc.)
      // Sur un rapporteur classique : 0 à gauche, 180 à droite
      // Ici on affiche l'azimut réel (270+deg pour compenser)
      const azimutLabel = deg;
      text.textContent = azimutLabel;
      svg.insertBefore(text, svg.querySelector('#rapporteur-arm'));
    }
  }

  // Ligne de base horizontale
  const baseline = document.createElementNS(ns, 'line');
  baseline.setAttribute('x1', (cx - R).toFixed(1));
  baseline.setAttribute('y1', cy.toFixed(1));
  baseline.setAttribute('x2', (cx + R).toFixed(1));
  baseline.setAttribute('y2', cy.toFixed(1));
  baseline.setAttribute('stroke', '#f5c842');
  baseline.setAttribute('stroke-width', '1');
  baseline.setAttribute('opacity', '0.6');
  svg.insertBefore(baseline, svg.querySelector('#rapporteur-arm'));
}

function updateRapporteurArm() {
  const arm = document.getElementById('rapporteur-arm');
  const disp = document.getElementById('rap-angle-display');
  if (!arm) return;

  // Azimut 0 = Nord (en haut). La ligne part vers le haut quand angle=0.
  // En SVG, 0° pointe vers le haut (y diminue), sens horaire.
  const rad = (rapporteurAngle - 180) * Math.PI / 180; // offset -180 car le bras dépasse vers le haut
  // En fait: azimut 0 = bras vers le haut = -90° en référentiel SVG (x droite)
  const svgRad = (rapporteurAngle - 90) * Math.PI / 180;
  const R = 128;
  const x2 = 140 + R * Math.cos(svgRad);
  const y2 = 140 + R * Math.sin(svgRad);
  arm.setAttribute('x2', x2.toFixed(1));
  arm.setAttribute('y2', y2.toFixed(1));
  if (disp) disp.textContent = rapporteurAngle + '°';
}

function initRapporteurDrag() {
  const rap = document.getElementById('rapporteur');
  if (!rap) return;

  rap.addEventListener('pointerdown', (e) => {
    // Éviter les clics sur les contrôles enfants
    rapDragging = true;
    const rect = rap.getBoundingClientRect();
    rapOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    rap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!rapDragging) return;
    const mapEl = document.getElementById('fullscreen-map');
    const mapRect = mapEl ? mapEl.getBoundingClientRect() : { left: 0, top: 0 };
    const newX = e.clientX - mapRect.left - rapOffset.x;
    const newY = e.clientY - mapRect.top  - rapOffset.y;
    rap.style.left = newX + 'px';
    rap.style.top  = newY + 'px';
    rapPos = { x: newX, y: newY };
    e.preventDefault();
  });

  window.addEventListener('pointerup', () => { rapDragging = false; });
}

function rapporteurKeyHandler(e) {
  const modal = document.getElementById('modal-carte');
  if (!modal || modal.style.display === 'none') return;
  if (e.key === 'ArrowLeft') {
    rapporteurAngle = (rapporteurAngle - 1 + 360) % 360;
    updateRapporteurArm();
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    rapporteurAngle = (rapporteurAngle + 1) % 360;
    updateRapporteurArm();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    closeMapModal();
  }
}

function initRapporteurKeyboard() {
  document.addEventListener('keydown', rapporteurKeyHandler);
  updateRapporteurArm();
}

// Initialiser la mini-carte dès le chargement de la scène

/* ──────────────────────────────────────
   LUGER — GLISSEMENT
────────────────────────────────────── */
let lugerSlid = false;
function slideLuger() {
  if (!State.lampOn) {
    showToast("Le laser rouge indique la ligne de mire. Visez le cigare en pressant le cercle sur la gâchette !");
  } else {
    showToast("Un pistolet Luger P08 d'officier allemand... Le canon est froid.");
  }
}

/* Modal Luger inline */
(function() {
  // Créer la modal luger dynamiquement
  const div = document.createElement('div');
  div.id = 'modal-luger'; div.className = 'modal-overlay';
  div.innerHTML = `
    <div class="modal-box" style="width:min(480px,92vw);background:#f0e8c8;color:#1a0a00;font-family:'Caveat',cursive;transform:rotate(-1deg);">
      <span class="modal-close" onclick="closeModal('modal-luger')">✕</span>
      <div class="secret-paper">
        <p style="font-family:'Special Elite',cursive;font-size:.85rem;margin-bottom:1rem;">Ordre de mission — Réseau AS<br>Codé selon échiquier habituel :</p>
        <p style="font-size:1.3rem;letter-spacing:.05em;font-weight:bold;color:#3a1a00;line-height:2;">
          18-2 · 8-1-2 · 18-2-1-8 · 2-1-8-2-1<br>
          8-2-1 · 1-8 · 18-2-1 · 8-1
        </p>
        <p style="margin-top:1rem;font-size:.9rem;color:#6a4020;font-style:italic;">
          [Déchiffre avec la grille du carnet]
        </p>
      </div>
    </div>`;
  document.body.appendChild(div);
})();

/* ──────────────────────────────────────
   BOUSSOLE — RETOURNEMENT (DÉSACTIVÉ)
────────────────────────────────────── */
let photoSlid = false;
function slidePhoto() {
  const photo = document.getElementById('obj-photo');
  const paper = document.getElementById('photo-paper');
  if (!photoSlid) {
    photoSlid = true;
    photo.style.transition = 'transform 0.5s ease';
    photo.style.transform = 'translate(-30px, -20px) rotate(-12deg)';
    if (paper) {
      paper.style.transition = 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease, filter 0.5s ease';
      paper.style.zIndex = '40';
      paper.style.opacity = '1';
      paper.style.transform = 'translate(14vw, 4vw) rotate(6deg)';
      paper.style.filter = 'brightness(0.84) contrast(0.92) sepia(0.35) drop-shadow(5px 10px 18px rgba(0,0,0,0.85))';
      paper.style.pointerEvents = 'auto';
    }
    AudioManager.paperRustle();
  } else {
    photoSlid = false;
    photo.style.transform = 'rotate(var(--rot))';
    if (paper) {
      paper.style.transition = 'transform 0.5s ease, opacity 0.5s ease, filter 0.5s ease';
      paper.style.opacity = '0';
      paper.style.transform = 'rotate(0deg)';
      paper.style.filter = 'brightness(0.2) contrast(0.8) sepia(0.65) hue-rotate(-12deg) drop-shadow(1px 2px 4px rgba(0,0,0,0.95))';
      paper.style.pointerEvents = 'none';
      setTimeout(() => { if (!photoSlid) paper.style.zIndex = '9'; }, 500);
    }
    AudioManager.paperRustle();
  }
}

function clickBoussole() {
  openCompassModal();
}


let compassDragState = {
  dragging: false,
  centerX: 0,
  centerY: 0,
  startAngle: 0,
  currentRotation: 0,
  lastBeepRotation: 0,
};

function openCompassModal() {
  // Toujours ouvrir la modale (même si déjà orientée — pour revoir)
  compassDragState.dragging = false;
  
  const wheel = document.getElementById('compass-wheel');
  
  // Si déjà orientée, on repositionne sur 245° et on montre le succès
  if (State.boussoleOriented) {
    compassDragState.currentRotation = 245;
    if (wheel) wheel.style.transform = 'rotate(245deg)';
    const readout = document.getElementById('compass-angle-val');
    if (readout) {
      readout.textContent = '245°';
      readout.style.color = '#2ecc71';
      readout.style.textShadow = '0 0 10px rgba(46,204,113,0.5)';
    }
    const successMsg = document.getElementById('compass-success-msg');
    if (successMsg) successMsg.style.display = 'block';
    const instruction = document.getElementById('compass-instruction');
    if (instruction) instruction.style.display = 'none';
    openModal('modal-boussole');
    return;
  }
  
  compassDragState.currentRotation = 0;
  compassDragState.lastBeepRotation = 0;
  if (wheel) wheel.style.transform = 'rotate(0deg)';
  
  const readout = document.getElementById('compass-angle-val');
  if (readout) {
    readout.textContent = '0°';
    readout.style.color = '#ffd700';
    readout.style.textShadow = 'none';
  }
  
  const successMsg = document.getElementById('compass-success-msg');
  if (successMsg) successMsg.style.display = 'none';
  
  const instruction = document.getElementById('compass-instruction');
  if (instruction) {
    instruction.textContent = "Orientez la boussole pour viser le village où a lieu le parachutage. L'azimut est noté sur le document déchiffré.";
    instruction.style.display = 'block';
  }
  
  openModal('modal-boussole');
}

function startCompassDrag(e) {
  if (State.boussoleOriented) return;
  
  const container = document.getElementById('compass-wheel-container');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  compassDragState.centerX = rect.left + rect.width / 2;
  compassDragState.centerY = rect.top + rect.height / 2;
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  compassDragState.startAngle = Math.atan2(clientY - compassDragState.centerY, clientX - compassDragState.centerX) * (180 / Math.PI);
  compassDragState.dragging = true;
  
  if (container.setPointerCapture && e.pointerId !== undefined) {
    container.setPointerCapture(e.pointerId);
  }
}

function moveCompassDrag(e) {
  if (!compassDragState.dragging) return;
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  const currentAngle = Math.atan2(clientY - compassDragState.centerY, clientX - compassDragState.centerX) * (180 / Math.PI);
  let delta = currentAngle - compassDragState.startAngle;
  
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  
  let newRotation = compassDragState.currentRotation + delta;
  let displayAngle = (Math.round(newRotation) % 360 + 360) % 360;
  
  const wheel = document.getElementById('compass-wheel');
  if (wheel) {
    wheel.style.transform = `rotate(${newRotation}deg)`;
  }
  
  const readout = document.getElementById('compass-angle-val');
  if (readout) {
    readout.textContent = `${displayAngle}°`;
  }
  
  if (Math.abs(newRotation - compassDragState.lastBeepRotation) >= 4) {
    AudioManager.beep(6, 1200, 0.04);
    compassDragState.lastBeepRotation = newRotation;
  }
  
  if (Math.abs(displayAngle - 245) <= 2.5) {
    const targetRotation = Math.round(newRotation - (displayAngle - 245));
    if (wheel) wheel.style.transform = `rotate(${targetRotation}deg)`;
    if (readout) {
      readout.textContent = "245°";
      readout.style.color = "#2ecc71";
      readout.style.textShadow = "0 0 10px rgba(46, 204, 113, 0.5)";
    }
    
    compassDragState.dragging = false;
    compassDragState.currentRotation = targetRotation;
    triggerCompassSuccess();
  } else {
    compassDragState.startAngle = currentAngle;
    compassDragState.currentRotation = newRotation;
  }
}

function stopCompassDrag(e) {
  if (!compassDragState.dragging) return;
  compassDragState.dragging = false;
  
  const container = document.getElementById('compass-wheel-container');
  if (container && container.releasePointerCapture && e.pointerId !== undefined) {
    container.releasePointerCapture(e.pointerId);
  }
}

function triggerCompassSuccess() {
  State.boussoleOriented = true;
  AudioManager.clink();
  AudioManager.stamp();
  
  const successMsg = document.getElementById('compass-success-msg');
  if (successMsg) successMsg.style.display = 'block';
  
  const instruction = document.getElementById('compass-instruction');
  if (instruction) instruction.style.display = 'none';
  // La modale reste ouverte — l'utilisateur ferme avec ✕
}

function initCompassEvents() {
  const container = document.getElementById('compass-wheel-container');
  if (!container) return;
  
  container.addEventListener('pointerdown', startCompassDrag);
  window.addEventListener('pointermove', moveCompassDrag);
  window.addEventListener('pointerup', stopCompassDrag);
  window.addEventListener('pointercancel', stopCompassDrag);
}

let journalOpen = false;
function slideJournal() {
  const journal = document.getElementById('obj-journal');
  const overlay = document.getElementById('journal-overlay');
  if (!journalOpen) {
    journalOpen = true;
    // Le journal s'affiche en plein écran
    if (overlay) overlay.classList.add('open');
    AudioManager.paperRustle();
  } else {
    journalOpen = false;
    if (overlay) overlay.classList.remove('open');
    journal.style.transform = 'rotate(var(--rot))';
    AudioManager.paperRustle();
  }
}

let whiskySlid = false;
function interactWhisky() {
  AudioManager.clink();
  showToast("Ce n'est pas le moment de boire !");
}

/* Zoom de lisibilité pour tous les messages */
function zoomPaper(paperId) {
  const contentEl = document.getElementById('paper-zoom-content');
  if (!contentEl) return;
  
  let html = '';
  switch(paperId) {
    case 'cigar':
      html = `
        <div style="font-weight: bold; font-size: 1.45rem; border-bottom: 2px solid #000; padding-bottom: 0.4rem; margin-bottom: 0.8rem; text-transform: uppercase;">
          Réseau AS — Message
        </div>
        <div style="font-weight: bold; font-size: 1.35rem; margin-bottom: 0.4rem;">BBC · 58.7 MHz</div>
        <div style="font-size: 1.15rem; margin-bottom: 0.4rem;">Écoute : 21h45</div>
        <div style="border-top: 2px dashed #000; padding-top: 0.4rem; margin-top: 0.8rem; font-style: italic; font-weight: bold; font-size: 1.25rem;">
          "Les sanglots longs..."
        </div>
      `;
      break;
    case 'luger':
      html = `
        <div style="font-weight:bold; font-size:1.4rem; margin-bottom:0.6rem; text-transform:uppercase;">GEHEIMNIS</div>
        <div style="border-bottom:2px solid #000; margin-bottom:1rem;"></div>
        <div style="font-size: 1.1rem; line-height: 1.8; margin-bottom: 1rem; font-weight: bold; letter-spacing: 0.05em;">
          5·6·8-7·2-2·8-1·2-1  /  2-8·8-6·2-2·8-7·2-8·8-6·8-1·8-7·1·4<br>
          1·2-7·8-1·8-4·2-2·2-8  /  5·6·2-2·2-5  /  4·6·8-5·2-8<br>
          8-9·2-2·1·8-7·1·8-5·2-8·6  /  4·8-1·8-5·8-9
        </div>
        <div style="font-size:0.9rem; font-style:italic; border-top:2px dashed #000; padding-top:0.6rem;">
          Échiquier habituel — Clé connue (altitude)
        </div>
      `;
      break;
    case 'boussole':
      html = `
        <div style="font-weight:bold; font-size:1.35rem; margin-bottom:0.6rem;">NOTES DE T.M.</div>
        <div style="border-bottom:2px solid #000; margin-bottom:1rem;"></div>
        <div style="font-weight:bold; font-size:1.6rem; margin-bottom:0.6rem; color: #8c1c1c;">AZIMUT : 245°</div>
        <div style="font-size:1rem; font-style:italic;">Depuis le clocher de Tourtoirac</div>
      `;
      break;
    case 'whisky':
      html = `
        <div style="font-weight:bold; margin-bottom:0.4rem; font-size:1.2rem;">Coordonnées parachutage :</div>
        <div style="font-weight:bold; font-size:1.5rem; margin-bottom:0.8rem; color: #8c1c1c;">45°01'N — 1°05'E</div>
        <div style="font-size:1rem; font-style:italic; border-top:2px dashed #000; padding-top:0.6rem; margin-top:0.6rem;">"J'aurais bien gardé les armes."</div>
        <div style="font-size:0.9rem; text-align:right; margin-top:0.4rem;">— J.E.</div>
      `;
      break;
    case 'photo':
      html = `
        <div style="font-weight:bold; font-size:1.35rem; text-align:center; margin-bottom:0.6rem;">R. GRANDOU</div>
        <div style="border-bottom:2px solid #000; margin-bottom:1rem;"></div>
        <div style="font-size:1.15rem; line-height:1.5; text-align:center; font-family: inherit;">
          "Camarades,<br>
          Ne cessez jamais le combat.<br>
          Notre liberté est proche.<br>
          <strong>Pour la France, pour la patrie.</strong>"
        </div>
        <div style="text-align:right; font-size:1rem; margin-top:0.8rem; font-style: italic;">— Roland</div>
      `;
      break;
  }
  
  contentEl.innerHTML = html;
  openModal('modal-paper-zoom');
}

/* ──────────────────────────────────────
   CARNET — ZOOM SUR PLACE (pas de popup)
   ────────────────────────────────────── */
let carnetZoomed = false;

function toggleCarnetZoom() {
  const wrapper  = document.getElementById('carnet-wrapper');
  const backdrop = document.getElementById('carnet-backdrop');
  if (!wrapper) return;

  if (!carnetZoomed) {
    carnetZoomed = true;
    wrapper.classList.add('zoomed');
    if (backdrop) backdrop.style.display = 'block';
    AudioManager.paperRustle();
  } else {
    carnetZoomed = false;
    wrapper.classList.remove('zoomed');
    if (backdrop) backdrop.style.display = 'none';
    AudioManager.paperRustle();
  }
}

/* ──────────────────────────────────────
   LOGIQUE DE LA MACHINE À ÉCRIRE (TYPING ON PORTRAIT SHEET)
   ────────────────────────────────────── */
let typewriterActive = false;
let typewriterAutoTyping = false;

function openTypewriter() {
  const paper = document.getElementById('typewriter-paper');
  if (paper) {
    paper.textContent = "";
  }
  
  // Rétablir le bouton de fermeture et l'aide
  const closeBtn = document.querySelector('#modal-machine .modal-close');
  if (closeBtn) closeBtn.style.display = 'block';
  
  const hint = document.getElementById('typewriter-hint');
  if (hint) {
    hint.textContent = "Saisissez le lieu de départ décrypté au clavier pour lancer la transmission...";
    hint.style.display = 'block';
  }
  
  openModal('modal-machine');
  typewriterActive = true;
  typewriterAutoTyping = false;
  
  // Placer le focus
  setTimeout(() => {
    if (paper) paper.focus();
  }, 100);
}

function initTypewriterKeyboardEvents() {
  document.addEventListener('keydown', e => {
    // Si la victoire est faite, ou si la machine n'est pas active, ou en auto-frappe
    if (State.victoryDone) return;
    if (!typewriterActive || typewriterAutoTyping) return;
    
    // Ignorer si on écrit dans un champ texte d'admin ou autre
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      return;
    }
    
    const paper = document.getElementById('typewriter-paper');
    if (!paper) return;
    
    // Fermeture manuelle avec Echap
    if (e.key === 'Escape') {
      closeModal('modal-machine');
      typewriterActive = false;
      return;
    }
    
    // Touche Effacer (Retour)
    if (e.key === 'Backspace') {
      e.preventDefault();
      const text = paper.textContent;
      if (text.length > 0) {
        paper.textContent = text.slice(0, -1);
        AudioManager.typewriterKey();
      }
      return;
    }
    
    // Entrée
    if (e.key === 'Enter') {
      e.preventDefault();
      paper.textContent += '\n';
      AudioManager.typewriterKey();
      paper.scrollTop = paper.scrollHeight;
      return;
    }
    
    // Saisie de lettre / chiffre / ponctuation
    if (e.key.length === 1) {
      e.preventDefault();
      const char = e.key.toUpperCase();
      
      // Limiter pour éviter le débordement
      if (paper.textContent.length < 500) {
        paper.textContent += char;
        AudioManager.typewriterKey();
        paper.scrollTop = paper.scrollHeight;
        
        // Détecter TOURTOIRAC à la fin de la saisie
        const cleanText = paper.textContent.trim().toUpperCase();
        if (cleanText.endsWith('TOURTOIRAC')) {
          triggerMagicVictoryTyping();
        }
      }
    }
  });
}

const MAGIC_REVEAL_TEXT =
`
──────────────────────
TRANSMISSION REÇUE.
5 AOÛT 1944 — 00H17

OPÉRATION CONFIRMÉE.
POINT DE CHUTE : CUBJAC
VALLÉE DE L'AUVÉZÈRE
PÉRIGORD VERT

LE CAMP SE DÉROULERA
SUR LES TRACES DE
ROLAND GRANDOU
ET DES F.F.I.

RENDEZ-VOUS AU CONFLUENT.

— WHISKY —`;

function triggerMagicVictoryTyping() {
  typewriterAutoTyping = true;
  
  // Masquer le bouton de fermeture et l'aide
  const closeBtn = document.querySelector('#modal-machine .modal-close');
  if (closeBtn) closeBtn.style.display = 'none';
  
  const hint = document.getElementById('typewriter-hint');
  if (hint) {
    hint.textContent = "Transmission en cours de réception...";
  }
  
  const paper = document.getElementById('typewriter-paper');
  let idx = 0;
  
  function typeNext() {
    if (!typewriterActive) return;
    
    if (idx >= MAGIC_REVEAL_TEXT.length) {
      State.victoryDone = true;
      AudioManager.victory(); // Jouer le son de victoire directement ici
      return; // Fin de l'énigme, on laisse la feuille affichée
    }
    
    const ch = MAGIC_REVEAL_TEXT[idx];
    if (paper) {
      paper.textContent += ch;
      paper.scrollTop = paper.scrollHeight;
    }
    
    if (ch !== '\n' && ch !== '─') {
      AudioManager.typewriterKey();
    }
    
    idx++;
    const delay = ch === '\n' ? 180 : ch === '─' ? 30 : ch === ' ' ? 70 : 55;
    setTimeout(typeNext, delay);
  }
  
  setTimeout(typeNext, 800);
}

/* ──────────────────────────────────────
   LAMPE — MODE UV
────────────────────────────────────── */
function toggleLamp() {
  const scene = document.getElementById('scene');
  const flame = document.getElementById('lamp-flame');
  const lampImg = document.getElementById('obj-lampe');
  State.lampOn = !State.lampOn;
  updateShadows();
  if (State.lampOn) {
    AudioManager.lightCandle();
    scene.classList.remove('lamp-off');
    if (flame) flame.setAttribute('fill', '#FFB830');
    if (lampImg) lampImg.src = 'img/bougie.png';
    const spotlight = document.getElementById('spotlight');
    if (spotlight) spotlight.style.opacity = '1';
    
    // Masquer le laser du Luger
    const laserContainer = document.getElementById('luger-laser-container');
    if (laserContainer) laserContainer.style.display = 'none';
  } else {
    AudioManager.blowOutCandle();
    scene.classList.add('lamp-off');
    if (flame) flame.setAttribute('fill', 'none');
    if (lampImg) lampImg.src = 'img/bougie éteinte.png';
    const spotlight = document.getElementById('spotlight');
    if (spotlight) spotlight.style.opacity = '0';
    
    // Afficher le laser du Luger
    const laserContainer = document.getElementById('luger-laser-container');
    if (laserContainer) laserContainer.style.display = 'block';
  }
}

/* ── Système de notifications Vintage (Toast) ── */
function showToast(msg) {
  const existing = document.getElementById('vintage-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'vintage-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 2.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: #2e1d0c url('paper.png') center/cover no-repeat;
    border: 2.5px double #8a7040;
    color: #1a1008;
    padding: 12px 28px;
    font-family: 'Special Elite', cursive;
    font-size: 1.1rem;
    font-weight: bold;
    box-shadow: 0 5px 20px rgba(0,0,0,0.85);
    z-index: 10000;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    text-align: center;
    max-width: 80vw;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  
  setTimeout(() => { toast.style.opacity = '1'; }, 50);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { toast.remove(); }, 300);
  }, 4000);
}

/* ── Action de Tir au Luger ── */
function shootLuger() {
  if (State.lampOn) return;

  // Jouer le bruit de tir synthétique
  AudioManager.playGunshot();

  // Muzzle flash sur le canon (côté gauche du container)
  const laserContainer = document.getElementById('luger-laser-container');
  if (laserContainer) {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: absolute;
      top: 32%;
      right: 100%;
      width: 4.5vw;
      height: 4.5vw;
      background: radial-gradient(circle, #ffffff 10%, #ffd700 45%, rgba(255, 69, 0, 0.8) 75%, transparent 100%);
      transform: translate(50%, -50%);
      z-index: 1000;
      border-radius: 50%;
      box-shadow: 0 0 35px #ffd700, 0 0 20px #ff4500;
      pointer-events: none;
    `;
    laserContainer.appendChild(flash);
    setTimeout(() => { flash.remove(); }, 120);
  }

  // Vérifier si le cigare est sorti ("dans la course")
  if (cigarSlid) {
    showToast("🔥 Le tir fait mouche ! Le cigare prend feu sous l'impact !");

    // Impact visuel sur le cigare
    const cigar = document.getElementById('obj-cigare');
    if (cigar) {
      cigar.style.filter = 'brightness(2.2) contrast(1.5) sepia(1) hue-rotate(-50deg)';
      setTimeout(() => {
        cigar.style.filter = 'brightness(0.85) contrast(0.95) sepia(0.35) drop-shadow(0 0 12px #ff4500)';
      }, 150);

      // Création de l'effet d'incendie du cigare (petit point rouge incandescent)
      let burnEffect = document.getElementById('cigar-burn');
      if (!burnEffect) {
        burnEffect = document.createElement('div');
        burnEffect.id = 'cigar-burn';
        burnEffect.style.cssText = `
          position: absolute;
          top: 61%;
          left: 31%;
          width: 1.8vw;
          height: 1.8vw;
          border-radius: 50%;
          background: radial-gradient(circle, #ffffff 5%, #ff4500 45%, #ff0000 75%, transparent 100%);
          box-shadow: 0 0 12px #ff4500, 0 0 25px #ff0000;
          z-index: 90;
          pointer-events: none;
          animation: cigar-burn-glow 1.5s infinite alternate;
        `;
        document.getElementById('scene').appendChild(burnEffect);
      }
    }
  } else {
    showToast("💨 Le tir se perd dans l'obscurité. Il n'y a rien dans la ligne de mire.");
  }
}

/* ──────────────────────────────────────
   ÉCHIQUIER DE SUBSTITUTION & CARNET
────────────────────────────────────── */
const GRID_KEY = [1, 8, 2, 3, 4, 5, 6, 7, 9, 0];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function buildCipherGrid() {
  renderActiveGrid();
}

function renderActiveGrid() {
  const container = document.getElementById('cipher-grid-container');
  if (!container) return;
  container.innerHTML = '';

  // 1. Headers Row: 1 8 2 3 4 5 6 7 9 0
  GRID_KEY.forEach(h => {
    const cell = document.createElement('div');
    cell.className = 'cipher-cell key-row';
    cell.textContent = h;
    container.appendChild(cell);
  });

  // 2. Row 1: A, [blank], [blank], B, C, D, E, F, G, H
  const row1 = ['A', '', '', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  row1.forEach(ch => {
    const cell = document.createElement('div');
    cell.className = 'cipher-cell';
    cell.textContent = ch;
    if (ch === '') cell.style.background = 'rgba(0,0,0,0.15)';
    container.appendChild(cell);
  });

  // 3. Row 8: I J K L M N O P Q R
  const row8 = ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
  row8.forEach(ch => {
    const cell = document.createElement('div');
    cell.className = 'cipher-cell';
    cell.textContent = ch;
    container.appendChild(cell);
  });

  // 4. Row 2: S T U V W X Y Z . /
  const row2 = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '.', '/'];
  row2.forEach(ch => {
    const cell = document.createElement('div');
    cell.className = 'cipher-cell';
    cell.textContent = ch;
    container.appendChild(cell);
  });
}

function initCarnetEvents() {
  State.cipherComplete = true;
  if (typeof updateMapInstructions === 'function') updateMapInstructions();
  renderActiveGrid();
}

function updateMapInstructions() {}

/* ──────────────────────────────────────
   CLÉ TÉLÉGRAPHIQUE — TON CONTINU + CUBJAC
   ────────────────────────────────────── */

// CUBJAC en Morse : C=−·−·  U=··−  B=−···  J=·−−−  A=·−  C=−·−·
const CUBJAC_MORSE = ['-.-.', '..-', '-...', '.---', '.-', '-.-.'];

let mkCtx = null, mkOsc = null, mkGain = null;
let mkPressTime  = 0;
let mkSymbols    = [];   // symboles de la lettre en cours (.  ou -)
let mkWord       = [];   // { code, letter } des lettres du mot
let mkLetterTmr  = null;
let mkWordTmr    = null;

const MK_DOT_MS    = 280;   // < 280ms = point, sinon tiret
const MK_LETTER_MS = 1600;  // pause entre lettres (laisse plus de temps pour taper)
const MK_WORD_MS   = 3500;  // pause entre mots (laisse plus de temps pour espacer)

function mkStartTone() {
  if (!mkCtx) mkCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (mkCtx.state === 'suspended') mkCtx.resume();
  if (mkOsc) { try { mkOsc.stop(); } catch(e){} mkOsc = null; }

  mkGain = mkCtx.createGain();
  mkGain.gain.setValueAtTime(0, mkCtx.currentTime);
  mkGain.gain.linearRampToValueAtTime(0.45, mkCtx.currentTime + 0.008);
  mkGain.connect(mkCtx.destination);

  mkOsc = mkCtx.createOscillator();
  mkOsc.type = 'sine';
  mkOsc.frequency.value = 520;   // note différente du Morse radio (680 Hz)
  mkOsc.connect(mkGain);
  mkOsc.start();
}

function mkStopTone() {
  if (mkGain && mkCtx) {
    mkGain.gain.linearRampToValueAtTime(0, mkCtx.currentTime + 0.012);
  }
  setTimeout(() => { if (mkOsc) { try { mkOsc.stop(); } catch(e){} mkOsc = null; } }, 20);
}

function mkSymbol2Letter(code) {
  for (const [letter, pattern] of Object.entries(MORSE_TABLE)) {
    const norm = pattern.replace(/·/g, '.').replace(/−/g, '-');
    if (norm === code) return letter;
  }
  return '?';
}

function mkShowFeedback() {
  const word = mkWord.map(x => x.letter).join('');
  const cur  = mkSymbols.join('');
  const txt  = (word || cur)
    ? `📡 Morse : <strong>${word}</strong>${cur ? ' | ' + cur : ''}`
    : '';
  updateRadioStatus(txt, !!txt);
}

function mkFinalizeLetter() {
  if (!mkSymbols.length) return;
  const code   = mkSymbols.join('');
  mkSymbols    = [];
  const letter = mkSymbol2Letter(code);
  mkWord.push({ code, letter });
  mkShowFeedback();
}

function mkFinalizeWord() {
  mkFinalizeLetter();
  if (!mkWord.length) return;
  const codes = mkWord.map(x => x.code);
  const word  = mkWord.map(x => x.letter).join('');
  mkWord      = [];
  mkShowFeedback();

  const isCubjac = codes.length === CUBJAC_MORSE.length &&
                   codes.every((c, i) => c === CUBJAC_MORSE[i]);
  if (isCubjac || word === 'CUBJAC') {
    updateRadioStatus('🎯 TRANSMISSION CUBJAC CONFIRMÉE !', true);
    setTimeout(() => showVictoryScreen(), 1200);
  } else {
    updateRadioStatus(`📡 Reçu : "${word}" — Recommencez…`, true);
    setTimeout(() => updateRadioStatus(''), 3000);
  }
}

function interactMorseKey(pressed) {
  const cle = document.getElementById('obj-cle-morse');

  if (pressed) {
    mkPressTime = Date.now();
    mkStartTone();
    if (cle) cle.style.transform = 'rotate(-6deg) scale(0.96) translateY(2px)';
    // Annuler les timers de fin de lettre/mot
    clearTimeout(mkLetterTmr); mkLetterTmr = null;
    clearTimeout(mkWordTmr);   mkWordTmr   = null;
  } else {
    if (!mkPressTime) return;
    mkStopTone();
    if (cle) cle.style.transform = 'rotate(-6deg) scale(1)';

    const dur = Date.now() - mkPressTime;
    mkPressTime = 0;
    mkSymbols.push(dur < MK_DOT_MS ? '.' : '-');
    mkShowFeedback();

    // Timer fin de lettre
    mkLetterTmr = setTimeout(() => {
      mkFinalizeLetter();
      // Timer fin de mot
      mkWordTmr = setTimeout(() => mkFinalizeWord(), MK_WORD_MS - MK_LETTER_MS);
    }, MK_LETTER_MS);
  }
}

function initMorseKeyboardEvents() { /* handlers inline dans le HTML */ }

/* ──────────────────────────────────────
   ENREGISTREMENT & LEADERBOARD (VICTOIRE)
────────────────────────────────────── */
function initRegistrationEvents() {
  const submitBtn = document.getElementById('reg-submit-btn');
  if (!submitBtn) return;
  
  submitBtn.addEventListener('click', () => {
    const nom = document.getElementById('reg-nom').value.trim() || 'Patrouille Inconnue';
    const prenom = document.getElementById('reg-prenom').value.trim() || 'Résistant';
    
    saveScore(nom, prenom);
    
    const regForm = document.getElementById('victory-registration-form');
    if (regForm) regForm.style.display = 'none';
    
    const leaderboardCont = document.getElementById('leaderboard-container');
    if (leaderboardCont) leaderboardCont.style.display = 'block';
    
    renderLeaderboard();
  });
}

function saveScore(nom, prenom) {
  const elapsed = Math.floor((Date.now() - State.startTime) / 1000);
  const dateStr = new Date().toLocaleDateString('fr-FR');
  
  let leaderboard = JSON.parse(localStorage.getItem('cubjac_leaderboard') || '[]');
  leaderboard.push({
    nom: nom,
    prenom: prenom,
    time: elapsed,
    date: dateStr
  });
  
  leaderboard.sort((a, b) => a.time - b.time);
  leaderboard = leaderboard.slice(0, 10);
  localStorage.setItem('cubjac_leaderboard', JSON.stringify(leaderboard));
}

function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  
  let leaderboard = JSON.parse(localStorage.getItem('cubjac_leaderboard') || '[]');
  
  if (leaderboard.length === 0) {
    leaderboard = [
      { nom: 'Les Cerfs (ESTP)', prenom: 'Benoît', time: 232, date: '19/05/2026' },
      { nom: 'Les Sangliers (Périgord)', prenom: 'Hélie', time: 305, date: '19/05/2026' },
      { nom: 'Les Chamois', prenom: 'Arthur', time: 412, date: '19/05/2026' }
    ];
    localStorage.setItem('cubjac_leaderboard', JSON.stringify(leaderboard));
  }
  
  tbody.innerHTML = '';
  leaderboard.forEach((entry, idx) => {
    const min = String(Math.floor(entry.time / 60)).padStart(2, '0');
    const sec = String(entry.time % 60).padStart(2, '0');
    
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(138, 112, 80, 0.2)';
    tr.innerHTML = `
      <td style="padding:6px 0; font-weight:bold; color:${idx === 0 ? '#FFD700' : '#d4c890'};">#${idx + 1}</td>
      <td style="padding:6px 0;">${entry.nom}</td>
      <td style="padding:6px 0; font-style:italic; color:#a89060;">${entry.prenom}</td>
      <td style="padding:6px 0; text-align:right; font-weight:bold; color:#FFD700;">${min}:${sec}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showVictoryScreen() {
  // Arrêter la radio si elle était allumée
  if (State.radioOn && typeof toggleTunerPower === 'function') {
    toggleTunerPower();
  }
  
  // Jouer le Chant des Partisans
  AudioManager.playChantDesPartisans();
  
  const vs = document.getElementById('victory-screen');
  if (vs) vs.classList.add('show');
  if (vs) vs.style.display = 'flex'; // assure l'affichage
}

function registerVictory() {
  const prenom = document.getElementById('victory-prenom').value.trim();
  const nom = document.getElementById('victory-nom').value.trim();
  if (!prenom || !nom) {
    alert("Veuillez inscrire votre prénom et votre nom sur la carte.");
    return;
  }
  
  // Sauvegarde ou logique de fin
  alert(`Mission validée pour ${prenom} ${nom} ! La Résistance vous remercie.`);
  
  // Optionnel : recharger la page ou fermer la carte
  // location.reload();
}

function flipCard(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') {
    return; // Ne pas retourner la carte si on clique pour remplir son nom
  }
  const inner = document.getElementById('victory-card-inner');
  if (inner) {
    const isFlipped = inner.style.transform === 'rotateY(180deg)';
    inner.style.transform = isFlipped ? 'rotateY(0deg)' : 'rotateY(180deg)';
  }
}

/* ──────────────────────────────────────
   SYSTÈME D'AIDE
────────────────────────────────────── */
function showHint() {
  const idx = Math.min(State.hintCount, HINTS.length - 1);
  const tip = document.createElement('div');
  tip.style.cssText = `position:fixed;bottom:3.5rem;right:1rem;
    background:rgba(10,6,2,0.95);color:#D4820A;font-family:'Caveat',cursive;
    font-size:1rem;padding:1rem 1.2rem;border:1px solid #3a2a10;z-index:600;
    max-width:300px;border-radius:2px;animation:fadeIn .3s;`;
  tip.innerHTML = `<div style="font-size:.65rem;color:#555;margin-bottom:.3rem;">INDICE ${idx+1}/${HINTS.length}</div>
    ${HINTS[idx]}<br>
    <span onclick="this.parentElement.remove()" style="cursor:pointer;font-size:.75rem;color:#666;">[ fermer ]</span>`;
  document.body.appendChild(tip);
  setTimeout(() => tip.remove(), 8000);
  State.hintCount++;
}

/* ──────────────────────────────────────
   EASTER EGGS
────────────────────────────────────── */


/* ──────────────────────────────────────
   OMBRES VOLUMÉTRIQUES (CANVAS)
────────────────────────────────────── */
const OBJECT_HEIGHTS = {
  'obj-radio': 12,
  'obj-machine': 14,
  'obj-whisky': 9,
  'obj-cle-morse': 5,
  'obj-luger': 4,
  'obj-boussole': 3,
  'obj-cigare-box': 4,
  'obj-cigare': 2,
  'obj-carnet': 2,
  'obj-photo': 2,
  'obj-carte': 0.5,
  'obj-journal': 0.8,
};

let shadowAnimationId = null;

function updateShadows() {
  const canvas = document.getElementById('shadow-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!State.lampOn) return;
  const lampe = document.getElementById('obj-lampe');
  if (!lampe) return;
  const rectL = lampe.getBoundingClientRect();
  const lx = rectL.left + rectL.width / 2;
  const ly = rectL.top + rectL.height / 2;
  
  ctx.filter = 'brightness(0) blur(3px)';

  for (const [id, height] of Object.entries(OBJECT_HEIGHTS)) {
    const obj = document.getElementById(id);
    if (!obj || obj.style.display === 'none') continue;

    const rect = obj.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    const dx = ox - lx;
    const dy = oy - ly;
    
    const steps = Math.min(25, Math.floor(8 + height * 1.5));
    const maxTravel = 0.05 * height;
    const baseOpacity = 0.18;

    ctx.save();
    for(let i=1; i<=steps; i++) {
      const progress = i / steps;
      const travelFactor = progress * maxTravel;
      
      const tx = dx * travelFactor;
      const ty = dy * travelFactor;
      
      const currentScale = 1 + (progress * 0.008 * height);
      ctx.globalAlpha = baseOpacity * Math.pow((1 - progress), 1.5);
      
      ctx.save();
      ctx.translate(ox + tx, oy + ty);
      ctx.scale(currentScale, currentScale);
      ctx.translate(-ox, -oy);
      
      let drawTarget = obj;
      if (obj.tagName.toLowerCase() === 'div') {
        const img = obj.querySelector('img');
        if (img && img.complete && img.naturalWidth > 0) drawTarget = img;
        else { ctx.restore(); continue; }
      }
      if (!(drawTarget instanceof HTMLImageElement) && !(drawTarget instanceof HTMLCanvasElement)) {
        ctx.restore(); continue;
      }
      ctx.drawImage(drawTarget, rect.left, rect.top, rect.width, rect.height);
      ctx.restore();
    }
    ctx.restore();
  }
}

function startShadowAnimation(durationMs = 600) {
  const startTime = performance.now();
  function step(time) {
    updateShadows();
    if (time - startTime < durationMs) {
      shadowAnimationId = requestAnimationFrame(step);
    }
  }
  if(shadowAnimationId) cancelAnimationFrame(shadowAnimationId);
  shadowAnimationId = requestAnimationFrame(step);
}

window.addEventListener('resize', () => { updateShadows(); });

/* ──────────────────────────────────────
   INITIALISATION
────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSpotlight();
  buildCipherGrid();
  initCarnetEvents();
  initRegistrationEvents();
  initMorseKeyboardEvents();
  initTypewriterKeyboardEvents();
  initCompassEvents();
  // Mini-carte Leaflet initialisée après rendu de la scène
  setTimeout(initMap, 300);
  
  setTimeout(updateShadows, 100);

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (!missionStarted) {
        startMission();
      } else if (document.getElementById('intro-screen').style.display !== 'none') {
        skipIntro();
      }
    }
  });
});
