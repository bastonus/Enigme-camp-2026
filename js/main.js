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
  gunshotActive: false,
  radioOn: false,
  radioTuned: false,
  radioActivatedOnce: false,
  bbcSequenceActive: false,
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
  cigarShot: false,
  photoShot: false,
  typewriterDecrypted: false,
};

// Codes secrets basés sur l'univers et les personnages de la Résistance à Cubjac 2026
const CARNET_CODE = "GRANDOU";
const FRAME_CODE = "LIBERTE";
const RADIO_CODE = "ROGER";


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
let chronoInterval = null;

const HINTS = [
  "Commencez par déchiffrer la grille de substitution du carnet pour trouver la première clé secrète.",
  "Éteignez la bougie pour révéler la tache de sang sous le Luger. Cliquez sur cette gâchette lumineuse dans le noir pour tirer sur le cadre photo, briser le verre et découvrir la deuxième clé.",
  "Ouvrez la boîte à cigares, faites rouler le cigare pour dévoiler la fréquence radio secrète (58.7 MHz). Allumez la radio sur cette fréquence pour entendre le code Morse secret et obtenir la troisième clé.",
  "Combinez les trois clés secrètes dans l'ordre conseillé par le carnet : [CARNET]-[RADIO]-[CADRE] pour former le mot de passe final.",
  "Tapez ce mot de passe sans espaces ni tirets (GRANDOUROGERLIBERTE) sur la Remington pour décrypter l'ordre de mission d'état-major.",
  "Lisez l'ordre de mission Remington : il donne des indications sur le lieutenant Roland Grandou et son départ de Montignac. Manipulez sa boussole pour trouver l'azimut bloqué à 320°.",
  "Pour la victoire finale des F.F.I., utilisez la clé télégraphique Morse et transmettez le mot 'CUBJAC' pour confirmer la réussite de l'embuscade."
];

/* ──────────────────────────────────────
   INTRO — TÉLÉTYPE
────────────────────────────────────── */
function getGameDate(offsetDays = 0, upper = false, shortYear = false) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const day = d.getDate();
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  let month = months[d.getMonth()];
  if (upper) month = month.toUpperCase();
  const year = shortYear ? "44" : "1944";
  return `${day === 1 ? "1er" : day} ${month} ${year}`;
}

const INTRO_TEXT =
`Nos réseaux ont perdu le contact avec le lieutenant ROLAND GRANDOU.
Son dernier message Morse indiquait un point de parachutage
allié prévu pour cet été. Il n'a pas pu transmettre
les coordonnées complètes.

Vous avez accès à son poste de transmission.
Tout ce qu'il vous faut est sur cette table.
La Libération de Périgueux dépend de votre rapidité.

Ne faites pas de bruit.

                        — WHISKY`;

const PREAMBLE = `ÉTAT-MAJOR DES F.F.I. — SECTEUR PÉRIGORD BLANC
ORDRE DE MISSION N°4 — CONFIDENTIEL
=============================================
DATE : ${getGameDate(0, true, false)} — 21H30

ÉMETTEUR CLANDESTIN DU RÉSEAU AS PRÊT POUR RÉCEPTION.`;

let introIdx = 0, introTimer = null, missionStarted = false, introAnimationFinished = false;

function enterFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(err => {
      console.warn("Échec du passage en plein écran:", err);
    });
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}
function handleIntroClick(e) {
  if (e.target.tagName.toLowerCase() === 'button') return;
  if (!missionStarted) {
    startMission();
  } else if (document.getElementById('intro-screen').style.display !== 'none') {
    skipIntro(e);
  }
}

function startMission() {
  if (missionStarted) return;
  missionStarted = true;
  
  enterFullscreen();
  
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
    introAnimationFinished = true;
    const skipBtn = document.getElementById('intro-skip');
    if (skipBtn) {
      skipBtn.style.color = '#a89060';
      skipBtn.textContent = "[ APPUYER SUR ENTRÉE OU CLIQUER POUR DÉBUTER LA MISSION ]";
    }
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

function skipIntro(e) {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
  if (!introAnimationFinished) {
    finishIntroAnimation();
  } else {
    leaveIntroScreen();
  }
}

function finishIntroAnimation() {
  clearTimeout(introTimer);
  AudioManager.stopIntroTypewriter();
  
  enterFullscreen();
  
  document.getElementById('teletype-text').textContent = PREAMBLE + "\n\n--- DÉBUT DE LA TRANSMISSION ---\n\n" + INTRO_TEXT;
  introAnimationFinished = true;
  
  const skipBtn = document.getElementById('intro-skip');
  if (skipBtn) {
    skipBtn.style.color = '#a89060';
    skipBtn.textContent = "[ APPUYER SUR ENTRÉE OU CLIQUER POUR DÉBUTER LA MISSION ]";
  }
}

function leaveIntroScreen() {
  enterFullscreen();
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
    startChrono();
  }, 1500);
}

function startChrono() {
  const container = document.getElementById('chrono-container');
  const valSpan = document.getElementById('chrono-val');
  if (container) container.style.display = 'block';
  
  if (chronoInterval) clearInterval(chronoInterval);
  
  chronoInterval = setInterval(() => {
    if (!State.startTime || State.victoryDone) return;
    const elapsedMs = Date.now() - State.startTime;
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    if (valSpan) {
      valSpan.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }, 1000);
}

function stopChrono() {
  if (chronoInterval) {
    clearInterval(chronoInterval);
    chronoInterval = null;
  }
}

/* ──────────────────────────────────────
   CURSEUR SPOTLIGHT
────────────────────────────────────── */
function initSpotlight() {
  const spot   = document.getElementById('spotlight');
  const cursor = document.getElementById('custom-cursor');
  document.addEventListener('mousemove', e => {
    let posX = e.clientX;
    let posY = e.clientY;
    
    const body = document.body;
    if (body) {
      if (body.classList.contains('force-landscape-left')) {
        const h = window.innerHeight;
        posX = h - e.clientY;
        posY = e.clientX;
      } else if (body.classList.contains('force-landscape-right')) {
        const w = window.innerWidth;
        posX = e.clientY;
        posY = w - e.clientX;
      }
    }
    
    spot.style.left   = posX + 'px';
    spot.style.top    = posY + 'px';
    if (cursor) {
      cursor.style.left = posX + 'px';
      cursor.style.top  = posY + 'px';
    }
  });

  // Track hover and active states for custom cursor
  if (cursor) {
    document.addEventListener('mousedown', () => {
      cursor.classList.add('active');
    });
    document.addEventListener('mouseup', () => {
      cursor.classList.remove('active');
    });
    document.addEventListener('mouseover', e => {
      const target = e.target;
      if (!target) return;
      
      const isInteractive = target.closest('button, input, select, textarea, a, .obj, .modal-close, [onclick], .morse-paper-close, .ticket-close, .compass-wheel-container, .compass-glass-shine, .leaflet-interactive, .leaflet-control-zoom-in, .leaflet-control-zoom-out');
      
      if (isInteractive) {
        cursor.classList.add('hover');
      } else {
        cursor.classList.remove('hover');
      }
    });
    // Fallback mouseleave to clean hover state
    document.addEventListener('mouseout', e => {
      if (!e.relatedTarget) {
        cursor.classList.remove('hover');
      }
    });
  }
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
      
      State.radioActivatedOnce = true;
      if (!State.bbcSequenceActive) {
        playBbcSequence();
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
  const flame = document.getElementById('cigar-flame');
  const box   = document.getElementById('obj-cigare-box');

  if (box) box.style.filter = 'drop-shadow(4px 8px 12px rgba(0,0,0,0.7)) brightness(1.15)';

  if (cigar) {
    cigar.style.display    = 'block';
    cigar.style.zIndex     = '13';  // sous la boîte au départ
    
    // Aligné sur la boîte
    cigar.style.top        = '66.3%';
    cigar.style.left       = '22.1%';
    
    cigar.style.transition = 'none';
    if (flame) {
      flame.style.display    = 'block';
      flame.style.zIndex     = '12';
      flame.style.transition = 'none';
    }

    const duration = 900;
    const start = performance.now();
    const fromY = 2; // vw
    const toY = -8; // vw

    function step(now) {
      const elapsed = now - start;
      let progress = Math.min(1, elapsed / duration);
      
      // Easing cubic ease-out pour un mouvement naturel
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const currentY = fromY + (toY - fromY) * easedProgress;
      const currentOpacity = Math.min(1, progress * 1.6); // fade in complet vers 60% de l'animation

      cigar.style.transform = `rotate(-12deg) translateY(${currentY}vw)`;
      cigar.style.opacity = currentOpacity.toString();

      if (flame) {
        flame.style.transform = cigar.style.transform;
        flame.style.opacity = currentOpacity.toString();
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        cigar.style.zIndex = '35';
        if (flame) flame.style.zIndex = '34';
      }
    }

    requestAnimationFrame(step);
  }
}

let cigarAnimationId = null;
function toggleCigarRoll() {
  const cigar = document.getElementById('obj-cigare');
  const label = document.getElementById('cigar-label');
  const tagInner = label ? label.querySelector('.cigar-tag-inner') : null;
  if (!cigar) return;

  const duration = 1000; // 1 seconde pour une animation réactive et parfaitement fluide
  const start = performance.now();
  
  if (cigarAnimationId) {
    cancelAnimationFrame(cigarAnimationId);
    cigarAnimationId = null;
  }

  // Désactiver les transitions CSS pour éviter les conflits avec le calcul incrémental JS
  cigar.style.transition = 'none';
  if (tagInner) tagInner.style.transition = 'none';

  cigarSlid = !cigarSlid;
  AudioManager.paperRustle();

  const fromX = cigarSlid ? 0 : 12;
  const toX = cigarSlid ? 12 : 0;

  if (cigarSlid && label) {
    label.style.zIndex = '33';
  }

  function step(now) {
    const elapsed = now - start;
    let progress = Math.min(1, elapsed / duration);
    
    // Easing cubic ease-out pour un mouvement naturel
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Position incrémentale du cigare (en vw)
    const currentX = fromX + (toX - fromX) * easedProgress;
    cigar.style.transform = `rotate(-12deg) translateY(-8vw) translateX(${currentX}vw)`;

    // Taille et clip-path de l'étiquette calculés de manière incrémentale en synchronisation absolue avec la position du cigare
    if (tagInner) {
      let clipPercent = 100;
      // Le cigare a une course de 12vw. La bande du cigare s'aligne sur le bord gauche de l'étiquette (8.2vw)
      // lorsque currentX = 3vw, et sur le bord droit de l'étiquette (17.2vw) lorsque currentX = 12vw.
      // Le clip-path (inset de droite) suit donc précisément la formule physique de la bande.
      if (currentX >= 3) {
        clipPercent = ((12 - currentX) / 9) * 100;
      } else {
        clipPercent = 100;
      }
      tagInner.style.clipPath = `inset(0 ${clipPercent}% 0 0)`;
    }

    if (progress < 1) {
      cigarAnimationId = requestAnimationFrame(step);
    } else {
      cigarAnimationId = null;
      if (!cigarSlid && label) {
        label.style.zIndex = '9';
      }
    }
  }

  cigarAnimationId = requestAnimationFrame(step);

  // Note : nous ne déclenchons pas updateShadows() ici car nous avons désactivé 
  // les ombres portées dynamiques sur le cigare et l'étiquette pour des performances optimales.
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
  const radioGlow = document.getElementById('radio-glow');
  if (radioEl) {
    if (on) {
      radioEl.classList.add('illuminated');
      if (radioImg && !radioImg.src.endsWith('illuminated.png')) {
        radioImg.src = 'img/poste_radio illuminated.png';
      }
      if (radioGlow) {
        radioGlow.style.opacity = '1';
      }
    } else {
      radioEl.classList.remove('illuminated');
      if (radioImg && !radioImg.src.endsWith('off.png')) {
        radioImg.src = 'img/poste_radio off.png';
      }
      if (radioGlow) {
        radioGlow.style.opacity = '0';
      }
    }
  }
  updateShadows();
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
  
  // Stop and clean up any ongoing Morse sequence / BBC loop sequence
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
  State.bbcSequenceActive = false;
  AudioManager.stopRadioLondresVoice();

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
  AudioManager.startRadioLondresVoice(true);
  
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
    
    // Stop Morse and reset loop state
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
    State.bbcSequenceActive = false;
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
    
    // Start static
    AudioManager.startStatic();
    
    // Check tuning
    const isTuned = Math.abs((State.radioFrequency || 0) - 58.7) < 0.15;
    if (isTuned) {
      playBbcSequence();
    } else {
      AudioManager.startRadioLondresVoice(true);
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
const MORSE_MESSAGE = 'ROGER';

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

function playBbcSequence() {
  if (!State.radioOn) {
    State.bbcSequenceActive = false;
    return;
  }
  State.bbcSequenceActive = true;
  
  updateRadioStatus('🔊 BBC LONDRES — MESSAGE VOCAL…');
  
  AudioManager.stopRadioLondresVoice();
  // Play the Radio Londres voice once
  AudioManager.startRadioLondresVoice(false, () => {
    if (!State.radioOn) {
      State.bbcSequenceActive = false;
      return;
    }
    
    updateRadioStatus('🔊 BBC LONDRES — TRANSMISSION MORSE…');
    // Once finished, play the Morse sequence once
    audioMorseSequence(() => {
      if (!State.radioOn) {
        State.bbcSequenceActive = false;
        return;
      }
      // Once Morse is finished, restart the cycle
      playBbcSequence();
    });
  });
}

function audioMorseSequence(onEnded) {
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
    updateRadioStatus('🔊 BBC LONDRES — TRANSMISSION MORSE…');
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
    
    // Stop the Morse audio context and signal interval
    if (morseAudioCtx) {
      try { morseAudioCtx.close(); } catch(err) {}
      morseAudioCtx = null;
    }
    if (morseSignalInterval) {
      clearInterval(morseSignalInterval);
      morseSignalInterval = null;
    }

    if (typeof onEnded === 'function') {
      onEnded();
    }
  }, totalDuration);
  activeRadioTimeouts.push(finishTimeout);
}

/* ──────────────────────────────────────
   CARTE IGN 1950 — LEAFLET
────────────────────────────────────── */

// Coordonnées de Tourtoirac (clocher)
const TOURTOIRAC = [45.2708, 1.0599];
const IGN_TOPO_URL = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN50.1950&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const IGN_ORTHO_URL = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

let miniMap = null;
let fullMap = null;
let rapporteurMarker = null;
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
  }).setView([45.0658, 1.1650], 13);

  L.tileLayer(IGN_TOPO_URL, { maxZoom: 15, attribution: '' }).addTo(miniMap);

  // Marker Montignac (petit point)
  L.circleMarker([45.0658, 1.1650], {
    radius: 4, color: '#e74c3c', fillColor: '#e74c3c',
    fillOpacity: 0.9, weight: 1.5
  }).addTo(miniMap);
}

function openMapModal() {
  const modal = document.getElementById('modal-carte');
  if (!modal) return;
  modal.style.display = 'block';
  AudioManager.paperRustle();

  // Activer le listener clavier du rapporteur à chaque ouverture
  initRapporteurKeyboard();

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
        { name: 'Montpon', coords: [45.009, 0.162], rot: -2 },
        { name: 'Ribérac', coords: [45.247, 0.339], rot: 3 },
        { name: 'Mussidan', coords: [45.035, 0.364], rot: -1 },
        { name: 'Neuvic', coords: [45.101, 0.469], rot: 4 },
        { name: 'Saint-Astier', coords: [45.145, 0.528], rot: -3 },
        { name: 'Tocane', coords: [45.253, 0.478], rot: 2 },
        { name: 'Verteillac', coords: [45.347, 0.366], rot: -4 },
        { name: 'Mareuil', coords: [45.451, 0.451], rot: 1 },
        { name: 'Brantôme', coords: [45.364, 0.648], rot: -2 },
        { name: 'Bourdeilles', coords: [45.322, 0.587], rot: 3 },
        { name: 'Mensignac', coords: [45.195, 0.560], rot: -1 },
        { name: 'Chancelade', coords: [45.205, 0.666], rot: 4 },
        { name: 'Nontron', coords: [45.528, 0.662], rot: -3 },
        { name: 'St-Jean-de-Côle', coords: [45.422, 0.838], rot: 2 },
        { name: 'Thiviers', coords: [45.415, 0.920], rot: -4 },
        { name: 'Sorges', coords: [45.301, 0.873], rot: 1 },
        { name: 'Savignac', coords: [45.274, 0.862], rot: -2 },
        { name: 'Trélissac', coords: [45.195, 0.767], rot: 3 },
        { name: 'Périgueux', coords: [45.1839, 0.7114], rot: -1 },
        { name: 'Vergt', coords: [45.027, 0.718], rot: 4 },
        { name: 'Le Bugue', coords: [44.918, 0.927], rot: -3 },
        { name: 'Rouffignac', coords: [45.048, 0.978], rot: 2 },
        { name: 'Thenon', coords: [45.1383, 1.0717], rot: -4 },
        { name: 'Hautefort', coords: [45.2595, 1.1497], rot: 1 },
        { name: 'Excideuil', coords: [45.3371, 1.0475], rot: -2 },
        { name: 'Cubjac', coords: [45.2222, 0.9389], rot: 3 },
        { name: 'Montignac', coords: [45.0658, 1.1650], rot: -1 },
        { name: 'Tourtoirac', coords: TOURTOIRAC, rot: 4 }
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
          <div id="city-marker-${city.name.toLowerCase()}" style="position:relative; width:0; height:0;">
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

      // Rapporteur solidaire de la carte à Montignac (pointer-events: auto et curseur grab pour le déplacement)
      const MONTIGNAC_COORDS = [45.0658, 1.1650];
      const rapporteurHtml = `
        <div id="rapporteur" style="width:280px; height:280px; position:relative; pointer-events:auto; user-select:none; cursor:grab;">
          <svg id="rapporteur-svg" viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="280" height="280" style="pointer-events:none; overflow:visible;">
            <!-- Fond blanc semi-transparent sur la moitié supérieure uniquement -->
            <path d="M10,140 A130,130 0 0,1 270,140 Z" fill="rgba(255,255,255,0.75)" stroke="none"/>
            <!-- Cercle de bordure continu pour tout le rapporteur -->
            <circle cx="140" cy="140" r="130" fill="transparent" stroke="#111" stroke-width="2"/>
            <circle cx="140" cy="140" r="4" fill="#111"/>
            <!-- Ligne d'azimut (bras mobile) -->
            <line id="rapporteur-arm" x1="140" y1="140" x2="140" y2="10" stroke="#e74c3c" stroke-width="2" stroke-dasharray="6,3" marker-end="url(#arrowhead)"/>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#e74c3c"/>
              </marker>
            </defs>
            <!-- Point central -->
            <circle id="rapporteur-center" cx="140" cy="140" r="5" fill="#e74c3c" opacity="0.9"/>
            <circle cx="140" cy="140" r="2" fill="#fff"/>
          </svg>
          <!-- Instructions intégrées au rapporteur -->
          <div style="position:absolute; top:70px; left:50%; transform:translateX(-50%); width:200px; text-align:center; pointer-events:none;">
            <div style="font-family:'Special Elite',cursive; font-size:12px; color:#111; font-weight:bold; line-height:1.3; opacity:0.85; margin-bottom: 6px;">
              Prenez l'azimut du point de chute avec les flèches du clavier ◀ ▶
            </div>
            <div style="display:inline-block; background:rgba(255,255,255,0.9); border:1px solid #111; padding:2px 10px; border-radius:4px;">
              <span style="font-family:'Special Elite',cursive; color:#111; font-size:0.75rem; font-weight:bold;">AZIMUT : </span>
              <span id="rap-angle-display" style="font-family:'VT323',monospace; font-size:1.4rem; color:#e74c3c; font-weight:bold;">0°</span>
            </div>
          </div>
        </div>
      `;

      const rapporteurIcon = L.divIcon({
        className: 'custom-rapporteur-icon',
        html: rapporteurHtml,
        iconSize: [280, 280],
        iconAnchor: [140, 140]
      });

      // Position de départ du rapporteur (en haut à gauche de toutes les villes)
      const RAPPORTEUR_START_COORDS = [45.35, 0.70];

      rapporteurMarker = L.marker(RAPPORTEUR_START_COORDS, {
        draggable: true,
        icon: rapporteurIcon,
        zIndexOffset: 1000
      }).addTo(fullMap);

      rapporteurMarker.on('dragstart', () => {
        const rapEl = document.getElementById('rapporteur');
        if (rapEl) rapEl.style.cursor = 'grabbing';
      });

      rapporteurMarker.on('dragend', () => {
        const rapEl = document.getElementById('rapporteur');
        if (rapEl) rapEl.style.cursor = 'grab';
        checkMapSuccess();
      });

      // Centrer la carte sur Périgueux (niveau de zoom 10 pour voir large sans donner trop d'indications)
      fullMap.setView([45.1839, 0.7114], 10);

      initRapporteurTicks();
      initRapporteurKeyboard();
    }, 100);
  } else {
    setTimeout(() => { 
      fullMap.invalidateSize(); 
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
  // Rendu obsolète car le rapporteur est désormais un marqueur Leaflet solidaire de la carte
}

function initRapporteurTicks() {
  const svg = document.getElementById('rapporteur-svg');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const cx = 140, cy = 140, R = 130;

  // Ticks tous les 5° sur tout le cercle (0-360°)
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg - 90) * Math.PI / 180; // 0 = top (N)
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
    
    // Déterminer la couleur : blanc ou noir selon si on est sur la partie supérieure (fond blanc) ou inférieure (fond transparent)
    // Moitié haute = de 270° à 90°
    const isUpper = (deg >= 270 || deg <= 90);
    line.setAttribute('stroke', isUpper ? '#111' : '#fff');
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
      text.setAttribute('fill', isUpper ? '#111' : '#fff');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('font-weight', 'bold');
      
      const azimutLabel = deg;
      text.textContent = azimutLabel;
      svg.insertBefore(text, svg.querySelector('#rapporteur-arm'));
    }
  }
}

function updateRapporteurArm() {
  const arm = document.getElementById('rapporteur-arm');
  const disp = document.getElementById('rap-angle-display');
  if (!arm) return;

  const svgRad = (rapporteurAngle - 90) * Math.PI / 180;
  const R = 128;
  const x2 = 140 + R * Math.cos(svgRad);
  const y2 = 140 + R * Math.sin(svgRad);
  arm.setAttribute('x2', x2.toFixed(1));
  arm.setAttribute('y2', y2.toFixed(1));
  if (disp) disp.textContent = rapporteurAngle + '°';
}

function initRapporteurDrag() {
  // Rendu obsolète car le rapporteur est désormais solidaire de la carte et centré sur Tourtoirac
}

function rapporteurKeyHandler(e) {
  const modal = document.getElementById('modal-carte');
  if (!modal || modal.style.display === 'none') return;
  if (e.key === 'ArrowLeft') {
    rapporteurAngle = (rapporteurAngle - 1 + 360) % 360;
    updateRapporteurArm();
    checkMapSuccess();
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    rapporteurAngle = (rapporteurAngle + 1) % 360;
    updateRapporteurArm();
    checkMapSuccess();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    closeMapModal();
  }
}

function initRapporteurKeyboard() {
  document.removeEventListener('keydown', rapporteurKeyHandler);
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
    showToast("La tache de sang sous le pistolet brille dans le noir et révèle la gâchette. Pressez-la pour faire feu !");
  } else {
    showToast("Un pistolet Luger P08 d'officier allemand... Le canon est froid.");
  }
}

/* Modal Luger inline - Obsolete et Supprimé */

/* ──────────────────────────────────────
   BOUSSOLE — RETOURNEMENT (DÉSACTIVÉ)
────────────────────────────────────── */
function slidePhoto() {
  if (!State.photoShot) {
    showToast("Le cadre en bois de Roland Grandou est solidement fixé sur la table.");
  } else {
    zoomPaper('photo');
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
  
  // Si déjà orientée, on repositionne sur 320° et on montre le succès
  // Si déjà orientée, on repositionne sur 320° et on montre le succès
  if (State.boussoleOriented) {
    compassDragState.currentRotation = 320;
    if (wheel) wheel.style.transform = 'rotate(320deg)';
    const readout = document.getElementById('compass-angle-val');
    if (readout) {
      readout.textContent = '320';
      readout.style.color = '#2ecc71';
      readout.style.textShadow = '0 0 10px rgba(46,204,113,0.5)';
    }
    openModal('modal-boussole');
    return;
  }
  
  compassDragState.currentRotation = 0;
  compassDragState.lastBeepRotation = 0;
  if (wheel) wheel.style.transform = 'rotate(0deg)';
  
  const readout = document.getElementById('compass-angle-val');
  if (readout) {
    readout.textContent = '0';
    readout.style.color = '#ffd700';
    readout.style.textShadow = 'none';
  }
  
  const instruction = document.getElementById('compass-instruction');
  if (instruction) {
    instruction.textContent = "Trouver la direction prise par l’agent clandestin depuis sa ville de départ. Le lieutenant Grandou s'est servi de cette boussole pour s'orienter et fuir d'une ville à une autre lors de sa traque. Faites tourner le cadran pour chercher où l'aiguille se bloque physiquement afin de relever l'azimut.";
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
  compassDragState.lastTime = performance.now();
  
  if (container.setPointerCapture && e.pointerId !== undefined) {
    container.setPointerCapture(e.pointerId);
  }
}

function moveCompassDrag(e) {
  if (State.boussoleOriented) return;
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
    readout.textContent = `${displayAngle}`;
  }
  
  if (Math.abs(newRotation - compassDragState.lastBeepRotation) >= 4) {
    AudioManager.beep(6, 1200, 0.04);
    compassDragState.lastBeepRotation = newRotation;
  }
  
  const now = performance.now();
  const dt = now - (compassDragState.lastTime || now);
  compassDragState.lastTime = now;
  const speed = dt > 0 ? Math.abs(delta) / dt : 0; // degrees per ms
  
  if (Math.abs(displayAngle - 320) <= 2.5) {
    if (speed < 0.04) {
      const targetRotation = Math.round(newRotation - (displayAngle - 320));
      if (wheel) wheel.style.transform = `rotate(${targetRotation}deg)`;
      if (readout) {
        readout.textContent = "320";
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



let whiskySlid = false;
function interactWhisky() {
  AudioManager.clink();
  showToast("Ce n'est pas le moment de boire !");
}

/* Zoom de lisibilité pour tous les messages */
function zoomPaper(paperId) {
  const contentEl = document.getElementById('paper-zoom-content');
  const boxEl = document.getElementById('paper-zoom-box');
  if (!contentEl) return;
  
  if (boxEl) {
    boxEl.style.background = "url('img/paper.png') center/cover no-repeat";
    boxEl.style.backgroundBlendMode = "normal";
    boxEl.style.border = "none";
    boxEl.style.color = "#000";
    boxEl.style.aspectRatio = "auto";
    boxEl.style.display = "block";
    boxEl.style.padding = "2.5rem 2.2rem";
    
    const closeBtn = boxEl.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.style.color = "#000";
      closeBtn.style.borderColor = "rgba(0,0,0,0.2)";
    }
  }
  
  let html = '';
  switch(paperId) {
    case 'cigar':
      if (boxEl) {
        boxEl.style.background = "#163e20 url('img/paper.png') center/cover";
        boxEl.style.backgroundBlendMode = "multiply";
        boxEl.style.border = "6px double #d4af37";
        boxEl.style.aspectRatio = "auto";
        boxEl.style.display = "flex";
        boxEl.style.flexDirection = "column";
        boxEl.style.justifyContent = "center";
        boxEl.style.alignItems = "center";
        boxEl.style.padding = "1rem 2rem";
        boxEl.style.color = "#ffffff";
        
        const closeBtn = boxEl.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.style.color = "#d4af37";
          closeBtn.style.borderColor = "rgba(212,175,55,0.4)";
        }
      }
      html = `
        <div style="font-weight: bold; font-size: 1.45rem; border-bottom: 2px solid #d4af37; padding-bottom: 0.2rem; margin-bottom: 0.4rem; text-transform: uppercase; color: #ffffff; text-shadow: 0px 1px 2px rgba(0,0,0,0.5); width: 100%; text-align: center;">
          Réseau AS — Message Secret
        </div>
        <div style="font-weight: bold; font-size: 1.35rem; margin-bottom: 0.2rem; color: #f5e9c8; text-align: center; text-shadow: 0px 1px 2px rgba(0,0,0,0.5); width: 100%;">BBC · 58.7 MHz</div>
        <div style="font-size: 1.15rem; margin-bottom: 0.2rem; text-align: center; color: #ffffff; width: 100%;">Écoute : 21h45</div>
        <div style="border-top: 2px dashed #d4af37; padding-top: 0.4rem; margin-top: 0.4rem; font-style: italic; font-weight: bold; font-size: 1.25rem; text-align: center; color: #f5e9c8; text-shadow: 0px 1px 2px rgba(0,0,0,0.5); width: 100%;">
          "Les sanglots longs des violons de l'automne..."
        </div>
      `;
      break;
    case 'photo':
      html = `
        <div style="font-family: 'Special Elite', cursive; font-size: 1.05rem; line-height: 1.45; color: #000; background: url('img/paper.png') center/cover; padding: 1.5rem; border: 2px solid #000; box-shadow: inset 0 0 10px rgba(0,0,0,0.15); text-align: left;">
          <div style="font-weight: bold; font-size: 1.25rem; text-align: left; margin-bottom: 0.8rem; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 0.4rem;">
            NOTE CONFIDENTIELLE — LNT. GRANDOU
          </div>
          <p style="margin-bottom: 0.8rem; font-style: italic;">
            "La division SS Das Reich remonte du Sud et sème la mort sur son passage... Alors que nos compagnons s'organisent au sein du maquis de l'AS à Oradour-sur-Glane, j'ai rejoint pour ma part notre maquis secret de l'AS, bien caché dans les forêts du Périgord. Face à la barbarie et la trahison, nous ne plierons pas. Nous tiendrons nos positions coûte que coûte."
          </p>
          <p style="margin-bottom: 0.8rem; font-weight: bold;">
            Que notre combat serve la Patrie. Notre mot d'ordre absolu pour guider le pays vers le grand jour de la Libération est : <span style="font-size: 1.25rem; border-bottom: 2px solid #000;">LIBERTE</span>.
          </p>
          <div style="text-align: right; margin-top: 1rem; font-weight: bold;">
            — R.G.
          </div>
        </div>
      `;
      break;
    case 'boussole':
      html = `
        <div style="font-family: 'Special Elite', cursive; font-size: 1.1rem; line-height: 1.45; color: #000; background: url('img/paper.png') center/cover; padding: 1.5rem; border: 2px solid #000; box-shadow: inset 0 0 10px rgba(0,0,0,0.15); text-align: left;">
          <div style="font-weight: bold; font-size: 1.3rem; text-align: left; margin-bottom: 0.8rem; text-transform: uppercase; color: #000; border-bottom: 2px solid #000; padding-bottom: 0.4rem;">
            BOUSSOLE DE ROLAND GRANDOU
          </div>
          <p style="margin-bottom: 0.8rem; font-style: italic;">
            Cette boussole appartenait au lieutenant Grandou. Son aiguille est grippée et se fige précisément sur une direction.
          </p>
          <p style="font-weight: bold; text-align: left; margin-top: 1rem;">
            Faites tourner le cadran de la boussole pour chercher où le mécanisme se bloque physiquement et relever l'azimut.
          </p>
        </div>
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
  }
  
  contentEl.innerHTML = html;
  openModal('modal-paper-zoom');
}

/* Zoom de lisibilité pour le carnet de décryptage */
function toggleCarnetZoom() {
  const wrapper = document.getElementById('carnet-wrapper');
  const backdrop = document.getElementById('carnet-backdrop');
  if (!wrapper || !backdrop) return;

  AudioManager.paperRustle();

  const isZoomed = wrapper.classList.toggle('zoomed');
  if (isZoomed) {
    backdrop.style.display = 'block';
  } else {
    backdrop.style.display = 'none';
  }
}

/* Zoom de lisibilité pour le rapport F.F.I. */
function toggleRapportFfiZoom() {
  const wrapper = document.getElementById('obj-rapport-ffi');
  const backdrop = document.getElementById('rapport-ffi-backdrop');
  if (!wrapper || !backdrop) return;

  AudioManager.paperRustle();

  const isZoomed = wrapper.classList.toggle('zoomed');
  if (isZoomed) {
    backdrop.style.display = 'block';
  } else {
    backdrop.style.display = 'none';
  }
}


/* ──────────────────────────────────────
   LOGIQUE DE LA MACHINE À ÉCRIRE (TYPING ON PORTRAIT SHEET)
   ────────────────────────────────────── */
let typewriterActive = false;
let typewriterAutoTyping = false;

function openTypewriter() {
  const paper = document.getElementById('typewriter-paper');
  const closeBtn = document.querySelector('#modal-machine .modal-close');
  const hint = document.getElementById('typewriter-hint');

  if (State.typewriterDecrypted) {
    // Si l'énigme est déjà résolue, on ne vide pas la feuille pour garder les informations
    if (hint) {
      hint.textContent = "Ordre de mission décrypté. Fermez la machine pour continuer.";
      hint.style.display = 'block';
    }
  } else {
    if (paper) {
      paper.textContent = "";
    }
    if (hint) {
      hint.textContent = "Saisissez la combinaison de codes secrets au clavier pour lancer la transmission (regardez le carnet pour savoir)...";
      hint.style.display = 'block';
    }
  }
  
  // Rétablir le bouton de fermeture
  if (closeBtn) closeBtn.style.display = 'block';
  
  openModal('modal-machine');
  typewriterActive = true;
  typewriterAutoTyping = false;
  
  // Placer le focus et scroller en bas si déjà décrypté
  setTimeout(() => {
    if (paper) {
      paper.focus();
      if (State.typewriterDecrypted) {
        paper.scrollTop = paper.scrollHeight;
      }
    }
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
        
        // Détecter la bonne combinaison de clés (tolérant aux espaces/tirets)
        // Accepte soit l'ordre recommandé (GRANDOUROGERLIBERTE) soit l'ordre secondaire (GRANDOULIBERTEROGER)
        const cleanText = paper.textContent.replace(/[\s-]/g, '').toUpperCase();
        if (cleanText.endsWith('GRANDOUROGERLIBERTE') || cleanText.endsWith('GRANDOULIBERTEROGER')) {
          triggerMagicVictoryTyping();
        }
      }
    }
  });
}

const MAGIC_REVEAL_TEXT =
`
──────────────────────
ORDRE DE MISSION DE T.M. (TOMMY MACPHERSON)
${getGameDate(0, true, false)} — 00H17

A TOUS LES RESISTANTS DE L'AS ET DES FTP :
LE LIEUTENANT ROLAND GRANDOU A ETE FUSILLE PAR LA GESTAPO.

SON RETOUR D'INSPECTION COMMENÇAIT DEPUIS LE MAQUIS DE MONTIGNAC. RETRACEZ SON TRAJET POUR DÉCOUVRIR LE LIEU DE PARACHUTAGE D'ARMES.

VIVE LA FRANCE.

— TOMMY —`;

// Mise à jour des dates statiques dans le DOM (index.html) au chargement
document.addEventListener('DOMContentLoaded', () => {
  const teletypeDate = document.getElementById('dynamic-teletype-date');
  if (teletypeDate) teletypeDate.textContent = getGameDate(0, true, false);

  const ticketDate = document.getElementById('dynamic-ticket-date');
  if (ticketDate) ticketDate.textContent = getGameDate(0, false, true);
  
  const victoryDate = document.getElementById('dynamic-victory-date');
  if (victoryDate) victoryDate.textContent = getGameDate(0, true, false) + " — 00h17";
});

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
      typewriterAutoTyping = false;
      State.typewriterDecrypted = true;
      const closeBtn = document.querySelector('#modal-machine .modal-close');
      if (closeBtn) closeBtn.style.display = 'block';
      const hint = document.getElementById('typewriter-hint');
      if (hint) {
        hint.textContent = "Ordre de mission décrypté. Fermez la machine pour continuer.";
      }
      // Automatiquement valider la carte si le rapporteur est déjà bien positionné
      checkMapSuccess();
      return;
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
    
    // Masquer la gâchette du Luger
    const laserContainer = document.getElementById('luger-laser-container');
    if (laserContainer) laserContainer.style.display = 'none';
  } else {
    AudioManager.blowOutCandle();
    scene.classList.add('lamp-off');
    if (flame) flame.setAttribute('fill', 'none');
    if (lampImg) lampImg.src = 'img/bougie éteinte.png';
    const spotlight = document.getElementById('spotlight');
    if (spotlight) spotlight.style.opacity = '0';
    
    // Toujours réafficher la gâchette du Luger en mode sombre pour continuer de tirer
    const laserContainer = document.getElementById('luger-laser-container');
    if (laserContainer) {
      laserContainer.style.display = 'block';
    }
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
    background: #2e1d0c url('img/paper.png') center/cover no-repeat;
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

  // Masquer temporairement la gâchette / tache de sang pendant le tir pour éviter les clics multiples
  const laserContainer = document.getElementById('luger-laser-container');
  if (laserContainer) {
    laserContainer.style.display = 'none';
  }

  // 1. Jouer le son de tir avec un tout petit retard (25ms) pour s'aligner sur l'affichage
  // Et définir le comportement une fois que le son de coup de feu a FINI de jouer entièrement
  setTimeout(() => {
    AudioManager.playGunshot(() => {
      // Une fois le coup de feu entièrement joué (le son s'est éteint) :
      // On déclenche l'impact physique (vitre brisée, cadre brisé)
      if (!State.photoShot) {
        State.photoShot = true;
        AudioManager.playGlassBreaking();

        const photo = document.getElementById('obj-photo');
        const photoTop = document.getElementById('obj-photo-top');
        const photoBottom = document.getElementById('obj-photo-bottom');
        const paper = document.getElementById('photo-paper');

        if (photo && photoTop && photoBottom) {
          // Masquer le cadre photo intact
          photo.style.display = 'none';

          // Configurer les deux morceaux brisés à leur position de départ parfaitement alignée avec le cadre d'origine
          photoTop.style.transform = 'rotate(-4deg)';
          photoBottom.style.transform = 'rotate(-4deg)';
          photoTop.style.opacity = '1';
          photoBottom.style.opacity = '1';

          // Les afficher
          photoTop.style.display = 'block';
          photoBottom.style.display = 'block';

          // Forcer le reflow du navigateur
          photoTop.offsetHeight;
          photoBottom.offsetHeight;

          // Utiliser requestAnimationFrame pour s'assurer que la transition CSS se déclenche de manière fluide depuis la position alignée
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Les deux morceaux tournent dans le sens antihoraire à -10deg pour l'impact
              photoTop.style.transform = 'rotate(-10deg)';
              photoTop.style.filter = 'drop-shadow(-5px -5px 15px rgba(0,0,0,0.85)) brightness(0.95)';

              photoBottom.style.transform = 'rotate(-10deg)';
              photoBottom.style.filter = 'drop-shadow(5px 10px 18px rgba(0,0,0,0.9)) brightness(0.9)';
            });
          });

          // Révéler le papier caché AU MILIEU
          if (paper) {
            paper.style.transition = 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.7s ease, filter 0.7s ease';
            paper.style.zIndex = '34'; // Entre les morceaux brisés du cadre (z-index sandwich)
            paper.style.opacity = '1';
            paper.style.transform = 'translate(3.8vw, 5.5vw) rotate(4deg) scale(1.22)';
            paper.style.filter = 'brightness(0.88) contrast(0.95) sepia(0.25) drop-shadow(3px 6px 12px rgba(0,0,0,0.75))';
            paper.style.pointerEvents = 'auto';
          }

          showToast("💥 Le tir percute et BRISE le cadre photo ! Roland Grandou est projeté... Un message secret apparaît au milieu du cadre éclaté.");
        }
      } else {
        showToast("💥 PAN ! Vous tirez un nouveau coup de feu avec le Luger dans l'obscurité !");
      }
    });
  }, 25);

  // 2. Afficher le muzzle flash préchargé immédiatement
  const flash = document.getElementById('muzzle-flash-container');
  if (flash) {
    flash.style.display = 'block';
  }

  // 3. Activer l'état d'explosion lumineuse globale et mettre à jour les ombres immédiatement
  State.gunshotActive = true;
  updateShadows();

  // 4. Masquer le flash (la flamme) et restaurer les ombres après 150ms
  setTimeout(() => {
    if (flash) {
      flash.style.display = 'none';
    }
    State.gunshotActive = false;
    updateShadows();

    // Réafficher la gâchette immédiatement après le tir si la bougie est toujours éteinte
    if (!State.lampOn && laserContainer) {
      laserContainer.style.display = 'block';
    }
  }, 150);
}

/* ──────────────────────────────────────
   ÉCHIQUIER DE SUBSTITUTION & CARNET
────────────────────────────────────── */
function buildCipherGrid() {
  renderActiveGrid();
}

function renderActiveGrid() {
  const container = document.getElementById('cipher-grid-container');
  if (!container) return;
  container.innerHTML = '';

  const headers = ['', '1', '2', '3', '4', '5'];
  headers.forEach((h, i) => {
    const cell = document.createElement('div');
    if (i === 0) {
      cell.className = 'cg-h cg-label';
    } else {
      cell.className = 'cg-h';
    }
    cell.textContent = h;
    container.appendChild(cell);
  });

  const rows = [
    ['1', 'A', 'B', 'C', 'D', 'E'],
    ['2', 'F', 'G', 'H', 'I', 'J'],
    ['3', 'K', 'L', 'M', 'N', 'O'],
    ['4', 'P', 'Q', 'R', 'S', 'T'],
    ['5', 'U', 'V', 'X', 'Y', 'Z']
  ];

  rows.forEach(row => {
    row.forEach((ch, i) => {
      const cell = document.createElement('div');
      if (i === 0) {
        cell.className = 'cg-h cg-label';
      } else {
        cell.className = 'cg-c';
      }
      cell.textContent = ch;
      container.appendChild(cell);
    });
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
    if (!State.typewriterDecrypted) {
      updateRadioStatus("📡 Signal bloqué — Déchiffrez d'abord l'ordre de mission sur la Remington.", true);
      setTimeout(() => updateRadioStatus(''), 4000);
      return;
    }
    State.victoryDone = true;
    State.completionTime = Date.now(); // Heure précise au millième de seconde de la fin de saisie de CUBJAC
    stopChrono();
    updateRadioStatus('🎯 TRANSMISSION CUBJAC CONFIRMÉE !', true);
    setTimeout(() => showVictoryScreen(), 300);
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
  
  // Désactiver le bouton pour éviter les clics multiples
  const btn = document.querySelector('#victory-postcard button');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "TRANSMISSION EN COURS...";
    btn.style.opacity = '0.7';
  }

  const startVal = State.startTime || Date.now();
  const durationMs = (State.completionTime || Date.now()) - startVal;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  const durationFormatted = `${minutes}m ${String(seconds).padStart(2, '0')}s`;

  fetch('save_result.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      firstname: prenom,
      lastname: nom,
      completion_time: State.completionTime || Date.now(),
      duration: durationFormatted
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert(data.message);
      // Redirection vers le registre F.F.I. (admin.php) avec cache-buster et highlight après 1 seconde
      setTimeout(() => {
        const highlightParam = data.id ? '&highlight=' + encodeURIComponent(data.id) : '';
        window.location.href = 'admin.php?t=' + Date.now() + highlightParam;
      }, 1000);
    } else {
      alert("Erreur de transmission : " + data.error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "VALIDER LE RÉSULTAT";
        btn.style.opacity = '1';
      }
    }
  })
  .catch(error => {
    console.error('Erreur:', error);
    alert("Échec de la liaison radio. Impossible de joindre le P.C. de transmission.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "VALIDER LE RÉSULTAT";
      btn.style.opacity = '1';
    }
  });
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
  'luger-wrapper': 4,
  'obj-boussole': 3,
  'obj-carnet': 2,
  'obj-photo': 2,
  'obj-carte': 0.5,
  'obj-journal': 0.8,
  'obj-rapport-ffi': 0.6,
};

let shadowAnimationId = null;

function updateShadows() {
  const isPortrait = window.innerHeight > window.innerWidth;
  const canvas = document.getElementById('shadow-canvas');
  if (!canvas) return;
  
  if (isPortrait) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const lightSources = [];

  // 1. Le coup de feu (si actif)
  if (State.gunshotActive) {
    const wrapper = document.getElementById('luger-wrapper');
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const x0 = rect.left + rect.width * 0.0788;
      const y0 = rect.top + rect.height * 0.2535;
      const angle = -8 * Math.PI / 180;
      const dx = x0 - cx;
      const dy = y0 - cy;
      const gx = cx + dx * Math.cos(angle) - dy * Math.sin(angle);
      const gy = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
      lightSources.push({ x: gx, y: gy, type: 'gunshot' });
    }
  }

  // 2. La bougie (si active)
  if (State.lampOn) {
    const lampe = document.getElementById('obj-lampe');
    if (lampe) {
      const rectL = lampe.getBoundingClientRect();
      const lx = rectL.left + rectL.width / 2;
      const ly = rectL.top + rectL.height / 2;
      lightSources.push({ x: lx, y: ly, type: 'candle' });
    }
  }

  // 3. Le poste radio (si illuminé)
  const radioEl = document.getElementById('obj-radio');
  const radioIlluminated = radioEl && radioEl.classList.contains('illuminated');
  if (radioIlluminated) {
    const rectR = radioEl.getBoundingClientRect();
    const rx = rectR.left + rectR.width / 2;
    const ry = rectR.top + rectR.height / 2;
    lightSources.push({ x: rx, y: ry, type: 'radio' });
  }

  // Dessiner les passes pour chaque source lumineuse active
  ctx.save();
  for (const src of lightSources) {
    // Si radio ou gunshot, dessiner la lumière propre à cette source sur le canvas d'arrière-plan
    if (src.type === 'gunshot') {
      ctx.save();
      const grad = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, window.innerWidth * 0.85);
      grad.addColorStop(0, 'rgba(255, 90, 0, 0.8)');
      grad.addColorStop(0.15, 'rgba(255, 40, 0, 0.5)');
      grad.addColorStop(0.5, 'rgba(255, 20, 0, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (src.type === 'radio') {
      ctx.save();
      // Un halo lumineux rouge/orange au sol sous la radio
      const grad = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, window.innerWidth * 0.6);
      grad.addColorStop(0, 'rgba(230, 40, 40, 0.4)');
      grad.addColorStop(0.3, 'rgba(200, 20, 20, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Dessiner les ombres portées pour cette source
    ctx.save();
    ctx.filter = 'brightness(0) blur(3px)';

    for (const [id, height] of Object.entries(OBJECT_HEIGHTS)) {
      // La source de lumière ne projette pas sa propre ombre
      if (src.type === 'radio' && id === 'obj-radio') continue;
      
      const obj = document.getElementById(id);
      if (!obj || obj.style.display === 'none') continue;

      const rect = obj.getBoundingClientRect();
      const ox = rect.left + rect.width / 2;
      const oy = rect.top + rect.height / 2;

      const dx = ox - src.x;
      const dy = oy - src.y;
      
      // Version "light" extrêmement fluide et performante (maximum 3 itérations) pour éviter tout ralentissement
      const steps = Math.min(3, Math.floor(1 + height * 0.15));
      const maxTravel = 0.05 * height;
      const baseOpacity = src.type === 'gunshot' ? 0.35 : (src.type === 'radio' ? 0.25 : 0.18);

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
    ctx.restore();
  }
  ctx.restore();
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

let mapSuccessLine = null;
let mapSuccessActive = false;

let lastMapBlockedToastTime = 0;
function checkMapSuccess() {
  if (!fullMap || !rapporteurMarker) return;
  const pos = rapporteurMarker.getLatLng();
  const MONTIGNAC = [45.0658, 1.1650];
  const dist = pos.distanceTo(L.latLng(MONTIGNAC));

  // Si le rapporteur est placé sur Montignac (< 800m) et l'azimut vaut précisément 320°
  if (dist < 800 && Math.abs(rapporteurAngle - 320) === 0) {
    if (!State.typewriterDecrypted) {
      return;
    }
    triggerMapSuccessAnimation();
  }
}

function triggerMapSuccessAnimation() {
  if (mapSuccessActive) return;
  mapSuccessActive = true;

  // Jouer des effets sonores thématiques (clink puis tamponnage)
  AudioManager.clink();
  setTimeout(() => {
    AudioManager.stamp();
  }, 300);

  const montignacCoords = [45.0658, 1.1650];
  const cubjacCoords = [45.2222, 0.9389];

  // Dessiner un tracé vert dynamique reliant Montignac à Cubjac
  if (mapSuccessLine) {
    fullMap.removeLayer(mapSuccessLine);
  }

  mapSuccessLine = L.polyline([montignacCoords, montignacCoords], {
    color: '#2ecc71',
    weight: 5,
    opacity: 0.9,
    dashArray: '8, 8',
    className: 'success-route-line'
  }).addTo(fullMap);

  let progress = 0;
  const steps = 25;
  const interval = setInterval(() => {
    progress++;
    const currentLat = montignacCoords[0] + (cubjacCoords[0] - montignacCoords[0]) * (progress / steps);
    const currentLng = montignacCoords[1] + (cubjacCoords[1] - montignacCoords[1]) * (progress / steps);
    
    mapSuccessLine.setLatLngs([montignacCoords, [currentLat, currentLng]]);
    
    if (progress >= steps) {
      clearInterval(interval);
      highlightCubjacMarker();
      
      // Rendre visible le rapport papier de localisation F.F.I. sur la table après la fin de l'animation
      setTimeout(() => {
        const rapportFfi = document.getElementById('obj-rapport-ffi');
        if (rapportFfi) {
          rapportFfi.style.display = 'block';
        }
      }, 1000);
    }
  }, 25);
}

function highlightCubjacMarker() {
  const el = document.getElementById('city-marker-cubjac');
  if (el) {
    el.classList.add('pulse-highlight');
    const label = el.querySelector('.city-label-paper');
    if (label) {
      label.style.background = '#2ecc71';
      label.style.color = '#fff';
      label.style.borderColor = '#27ae60';
      label.style.boxShadow = '0 0 15px rgba(46, 204, 113, 0.8)';
    }
  }
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
    // Éviter de basculer en plein écran si l'utilisateur saisit du texte dans un champ
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    if (e.key === 'Enter') {
      if (e.altKey) {
        toggleFullscreenKeyboard();
      } else {
        if (!missionStarted) {
          startMission();
        } else if (document.getElementById('intro-screen').style.display !== 'none') {
          skipIntro();
        }
      }
    } else if (e.key.toLowerCase() === 'f') {
      toggleFullscreenKeyboard();
    }
  });

  function toggleFullscreenKeyboard() {
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    if (isFull) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } else {
      enterFullscreen();
    }
  }
});

