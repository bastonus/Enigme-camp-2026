/* ═══════════════════════════════════════════════════
   main.js — Logique principale Opération Cubjac 2026
   ═══════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────
   ÉTAT GLOBAL
────────────────────────────────────── */
const State = {
  startTime: null,
  lampOn: true,
  radioOn: false,
  morseDecoded: false,
  altitudeFound: false,
  cipherComplete: false,
  paperRevealed: false,
  boussoleFlipped: false,
  victoryDone: false,
  hintCount: 0,
  typedAnswer: '',
};

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
`ÉTAT-MAJOR DES F.F.I. — SECTEUR PÉRIGORD NOIR
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

let introIdx = 0, introTimer = null;

function runIntro() {
  const el = document.getElementById('teletype-text');
  if (introIdx >= INTRO_TEXT.length) {
    document.getElementById('intro-skip').style.color = '#a89060';
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
  document.getElementById('teletype-text').textContent = INTRO_TEXT;
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
  el.classList.add('open');
  if (id === 'modal-carte' && !window._mapInit) initMap();
  if (id === 'modal-machine') focusMachine();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ──────────────────────────────────────
   BOÎTE À CIGARES
────────────────────────────────────── */
let cigareOpen = false;
let cigarSlid = false;

function openCigareBox() {
  AudioManager.paperRustle();
  if (!cigareOpen) {
    document.getElementById('obj-cigare-box').style.filter =
      'drop-shadow(4px 8px 12px rgba(0,0,0,0.7)) brightness(1.2)';
    cigareOpen = true;
    
    // Révéler le cigare
    const cigar = document.getElementById('obj-cigare');
    if (cigar) {
      cigar.style.display = 'block';
      if (typeof updateShadows === 'function') updateShadows();
    }
  }
}

function slideCigar() {
  if (!cigarSlid) {
    AudioManager.paperRustle();
    const cigar = document.getElementById('obj-cigare');
    cigar.style.transition = 'transform 0.5s ease, top 0.5s ease, left 0.5s ease';
    cigar.style.top = (parseFloat(cigar.style.top || '68') - 4) + '%';
    cigar.style.left = (parseFloat(cigar.style.left || '24') + 5) + '%';
    cigar.style.transform = 'rotate(20deg)';
    cigarSlid = true;
    
    startShadowAnimation(600);
    
    // Révéler le ticket en dessous
    setTimeout(() => {
      document.getElementById('ticket-overlay').classList.add('open');
    }, 600);
  } else {
    document.getElementById('ticket-overlay').classList.add('open');
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
  
  if (State.radioOn) {
    State.radioOn = false;
    radioPhase = 0;
    if (radioEl) radioEl.classList.remove('on');
    setRadioIlluminated(false);
    AudioManager.stopStatic();
    
    if (morseAudioCtx) {
      try { morseAudioCtx.close(); } catch(err) {}
      morseAudioCtx = null;
    }
    
    activeRadioTimeouts.forEach(tId => clearTimeout(tId));
    activeRadioTimeouts = [];
    
    updateRadioStatus(null);
    const sheet = document.getElementById('morse-sheet');
    if (sheet) sheet.style.display = 'none';
  } else {
    State.radioOn = true;
    radioPhase = 1;
    if (radioEl) radioEl.classList.add('on');
    
    updateRadioStatus('[ FRITURE… SYNTONISATION EN COURS… ]');
    AudioManager.startStatic();

    // Effet de grésillement lumineux pendant la syntonisation (3s)
    let flickerCount = 0;
    const flickerInterval = setInterval(() => {
      if (!State.radioOn) {
        clearInterval(flickerInterval);
        return;
      }
      setRadioIlluminated(Math.random() > 0.35);
      flickerCount++;
      if (flickerCount > 18) {
        clearInterval(flickerInterval);
        if (State.radioOn) setRadioIlluminated(true);
      }
    }, 150);

    const tId = setTimeout(() => {
      if (!State.radioOn) return;
      updateRadioStatus('🔊 BBC LONDRES — EN COURS DE RÉCEPTION…');
      audioMorseSequence();
    }, 3000);
    activeRadioTimeouts.push(tId);
  }
}

/* Séquence Morse audio (synthétisée) */
const MORSE_MESSAGE = 'ALTITUDE FORGE CENT QUATRE VINGT DEUX';

function audioMorseSequence() {
  const sheet = document.getElementById('morse-sheet');
  buildMorseTable();
  if (sheet) sheet.style.display = 'block';

  updateRadioStatus('📡 <em>Ici Londres… Les Français parlent aux Français…</em><br>'
    + '<small style="color:#a89060">Message personnel suit — notez les signaux</small>');

  morseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Morse ralenti (facteur 3x) : DOT 240ms, DASH 720ms
  const DOT = 240, DASH = 720, GAP = 240, LETTER_GAP = 720, WORD_GAP = 1680;
  let t = morseAudioCtx.currentTime + 2.5;
  let currentDelay = 2500;

  function scheduleSymbol(sym) {
    const dur = sym === '·' ? DOT : DASH;
    const osc  = morseAudioCtx.createOscillator();
    const gain = morseAudioCtx.createGain();
    osc.connect(gain); gain.connect(morseAudioCtx.destination);
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
      setRadioIlluminated(on);
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

  const totalDuration = (t - morseAudioCtx.currentTime + 1) * 1000;
  const finishTimeout = setTimeout(() => {
    if (!State.radioOn) return;
    AudioManager.stopStatic();
    setRadioIlluminated(false);
    updateRadioStatus('✅ Message reçu — <strong>Décode le Morse</strong> avec l\'aide-mémoire à droite.<br>'
      + '<small style="color:#d4c890">Résultat → cherche l\'altitude de la Forge d\'Ans sur la carte</small>', true);
    State.morseDecoded = true;
  }, totalDuration);
  activeRadioTimeouts.push(finishTimeout);
}

function buildMorseTable() {
  const container = document.getElementById('morse-table');
  if (!container || container.children.length > 0) return;
  container.innerHTML = '';
  Object.entries(MORSE_TABLE).forEach(([letter, code]) => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:1px 2px;white-space:nowrap;font-size:0.85rem;';
    div.innerHTML = `<strong style="color:#8c1c1c">${letter}</strong> <span style="font-family:monospace">${code}</span>`;
    container.appendChild(div);
  });
}

/* ──────────────────────────────────────
   CARTE LEAFLET
────────────────────────────────────── */
function initMap() {
  window._mapInit = true;
  const map = L.map('map', { center: [45.18, 1.02], zoom: 13 });

  // Tuile IGN SCAN 1950 (WMTS public)
  L.tileLayer(
    'https://wxs.ign.fr/essentiels/geoportail/wmts?SERVICE=WMTS&REQUEST=GetTile' +
    '&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN50.1950' +
    '&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fjpeg',
    { attribution: '© IGN', maxZoom: 16, errorTileUrl: '' }
  ).addTo(map);

  // Fallback OpenStreetMap si IGN indisponible
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OSM', maxZoom: 19, opacity: 0.5
  }).addTo(map);

  // Marqueur La Forge d'Ans
  const forgeIcon = L.divIcon({
    html: '<div style="width:14px;height:14px;border-radius:50%;border:3px solid #c0392b;background:rgba(192,57,43,0.3);"></div>',
    iconSize: [14,14], iconAnchor: [7,7]
  });
  const forgeMarker = L.marker([45.178, 1.021], { icon: forgeIcon })
    .addTo(map)
    .bindPopup('<strong>La Forge d\'Ans</strong><br><em>Passe la loupe ici…</em>');

  // Loupe draggable
  const magnifier = document.getElementById('magnifier');
  let dragging = false, ox = 0, oy = 0;

  magnifier.addEventListener('mousedown', e => {
    dragging = true;
    ox = e.clientX - magnifier.getBoundingClientRect().left;
    oy = e.clientY - magnifier.getBoundingClientRect().top;
    magnifier.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const box = document.getElementById('modal-carte').querySelector('.modal-box').getBoundingClientRect();
    magnifier.style.left = (e.clientX - box.left - ox + 45) + 'px';
    magnifier.style.top  = (e.clientY - box.top  - oy + 45) + 'px';
    // Détecter si la loupe est près du marqueur
    const mp = map.latLngToContainerPoint([45.178, 1.021]);
    const mx = parseFloat(magnifier.style.left);
    const my = parseFloat(magnifier.style.top);
    if (Math.abs(mx - mp.x) < 80 && Math.abs(my - mp.y) < 80 && !State.altitudeFound) {
      State.altitudeFound = true;
      document.getElementById('altitude-reveal').style.display = 'block';
    }
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    magnifier.style.cursor = 'grab';
  });
}

/* ──────────────────────────────────────
   LUGER — GLISSEMENT
────────────────────────────────────── */
let lugerSlid = false;
function slideLuger() {
  if (lugerSlid) { openModal('modal-luger'); return; }
  AudioManager.paperRustle();
  const luger = document.getElementById('obj-luger');
  const paper = document.getElementById('luger-paper');
  luger.style.transition = 'transform 0.5s ease, top 0.5s ease, left 0.5s ease';
  luger.style.top = (parseFloat(luger.style.top || '36.98') - 5) + '%';
  luger.style.left = (parseFloat(luger.style.left || '71.22') + 5) + '%';
  luger.style.transform = 'rotate(15deg)';
  paper.style.opacity = '1';
  lugerSlid = true;
  State.paperRevealed = true;
  setTimeout(() => openModal('modal-luger'), 500);
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
   CLÉ MORSE
────────────────────────────────────── */
function interactMorseKey(down) {
  const cle = document.getElementById('obj-cle-morse');
  if (down) {
    cle.style.transform = 'rotate(-8deg) scale(0.96)';
    AudioManager.dot();
  } else {
    cle.style.transform = 'rotate(-8deg) scale(1.02)';
  }
}

/* ──────────────────────────────────────
   BOUTEILLE DE WHISKY
────────────────────────────────────── */
let whiskySlid = false;
function interactWhisky() {
  if (whiskySlid) return;
  AudioManager.clink();
  const whisky = document.getElementById('obj-whisky');
  const paper = document.getElementById('whisky-paper');
  whisky.style.transition = 'transform 0.5s ease, left 0.5s ease';
  whisky.style.left = (parseFloat(whisky.style.left || '78.59') - 6) + '%';
  whisky.style.transform = 'rotate(-25deg)';
  paper.style.opacity = '1';
  whiskySlid = true;
  
  startShadowAnimation(600);
}

/* ──────────────────────────────────────
   PHOTO ROLAND GRANDOU
────────────────────────────────────── */
function showPhotoTribute() {
  const tip = document.createElement('div');
  tip.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:rgba(10,6,2,0.95);color:#D4820A;font-family:'Special Elite',cursive;
    font-size:1.1rem;padding:1.5rem 2.5rem;border:1px solid #D4820A;z-index:600;
    text-align:center;max-width:400px;animation:fadeIn .3s;`;
  tip.innerHTML = `
    <div style="font-size:1.5rem;margin-bottom:1rem;color:#FFD700;font-family:'Caveat',cursive;">Roland Grandou</div>
    <em>"À mon ami le Facteur."</em><br><br>
    <div style="font-size:.85rem;color:#8a7050;">Mort pour la France. Son sacrifice ne sera pas oublié.</div>
    <button onclick="this.parentElement.remove()" style="margin-top:1.5rem;background:none;border:1px solid #D4820A;color:#D4820A;padding:.4rem 1rem;cursor:pointer;font-family:'Special Elite',cursive;">Respect ✓</button>`;
  document.body.appendChild(tip);
}

/* ──────────────────────────────────────
   BOUSSOLE — RETOURNEMENT
────────────────────────────────────── */
let boussoleFlipped = false;
function flipBoussole() {
  const bou = document.getElementById('obj-boussole');
  if (!boussoleFlipped) {
    bou.style.transition = 'transform 0.6s ease';
    bou.style.transform = 'rotateY(180deg) scale(1.3)';
    boussoleFlipped = true;
    State.boussoleFlipped = true;
    setTimeout(() => {
      // Affiche un tooltip
      const tip = document.createElement('div');
      tip.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        background:rgba(10,6,2,0.95);color:#D4820A;font-family:'Special Elite',cursive;
        font-size:1rem;padding:1.2rem 2rem;border:1px solid #D4820A;z-index:600;
        text-align:center;max-width:340px;animation:fadeIn .3s;`;
      tip.innerHTML = `
        <div style="font-size:.7rem;color:#666;margin-bottom:.5rem;">GRAVÉ AU DOS — T.M. 1940</div>
        <em>"Azimut — rapporteur sur Tourtoirac"</em><br>
        <div style="margin-top:.8rem;font-size:2rem;letter-spacing:.1em;color:#FFD700;">245°</div>
        <div style="font-size:.75rem;color:#8a7050;margin-top:.5rem;">Depuis le clocher de Tourtoirac</div>
        <button onclick="this.parentElement.remove()" style="margin-top:.8rem;background:none;border:1px solid #D4820A;color:#D4820A;padding:.3rem .8rem;cursor:pointer;font-family:'Special Elite',cursive;">Compris ✓</button>`;
      document.body.appendChild(tip);
    }, 700);
  } else {
    bou.style.transform = 'rotateY(0deg)';
    boussoleFlipped = false;
  }
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
  } else {
    AudioManager.blowOutCandle();
    scene.classList.add('lamp-off');
    if (flame) flame.setAttribute('fill', 'none');
    if (lampImg) lampImg.src = 'img/bougie éteinte.png';
    const spotlight = document.getElementById('spotlight');
    if (spotlight) spotlight.style.opacity = '0';
  }
}

/* ──────────────────────────────────────
   ÉCHIQUIER DE SUBSTITUTION
────────────────────────────────────── */
// Alphabet et grille (clé 182 → ordre 1,8,2 → A en col 1, B en col 8, C en col 2...)
// Grille de Vic simplifiée
const GRID_KEY = [1, 8, 2, 3, 4, 5, 6, 7, 9, 0];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function buildCipherGrid() {
  const container = document.getElementById('cipher-grid-container');
  container.innerHTML = '';

  // Ligne de clé
  GRID_KEY.forEach(n => {
    const cell = document.createElement('div');
    cell.className = 'cipher-cell key-row';
    cell.textContent = n;
    container.appendChild(cell);
  });

  // Lignes de l'alphabet
  for (let row = 0; row < Math.ceil(ALPHABET.length / 10); row++) {
    for (let col = 0; col < 10; col++) {
      const idx  = row * 10 + col;
      const cell = document.createElement('div');
      cell.className = 'cipher-cell';
      if (idx < ALPHABET.length) {
        cell.textContent = ALPHABET[idx];
      }
      container.appendChild(cell);
    }
  }

  // Note explicative
  const note = document.createElement('div');
  note.className = 'note-margin';
  note.innerHTML = 'Clé = <strong>182</strong> → colonne 1 = A, colonne 8 = B, colonne 2 = C… ' +
    'Pour décoder : trouve la lettre à l\'intersection ligne/colonne.';
  container.parentElement.insertBefore(note, container);
}

/* ──────────────────────────────────────
   MACHINE À ÉCRIRE
────────────────────────────────────── */
const ANSWER = 'CUBJAC';
let machineActive = false;

function focusMachine() {
  machineActive = true;
  document.getElementById('typed-text').textContent = State.typedAnswer;
}

document.addEventListener('keydown', e => {
  if (!machineActive) return;
  if (!document.getElementById('modal-machine').classList.contains('open')) { machineActive = false; return; }

  if (e.key === 'Backspace') {
    State.typedAnswer = State.typedAnswer.slice(0, -1);
  } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && State.typedAnswer.length < 10) {
    AudioManager.typewriterKey();
    State.typedAnswer += e.key.toUpperCase();
  }

  const typed = document.getElementById('typed-text');
  const feedback = document.getElementById('machine-feedback');
  typed.textContent = State.typedAnswer;

  if (State.typedAnswer === ANSWER) {
    triggerVictory();
  } else if (ANSWER.startsWith(State.typedAnswer)) {
    feedback.textContent = '';
    feedback.style.color = '#666';
  } else {
    feedback.textContent = '— signal non reconnu —';
    feedback.style.color = '#8a0000';
  }
});

/* ──────────────────────────────────────
   VICTOIRE
────────────────────────────────────── */
function triggerVictory() {
  if (State.victoryDone) return;
  State.victoryDone = true;

  AudioManager.stamp();
  const paper = document.getElementById('typewriter-paper');
  paper.classList.add('success');
  document.getElementById('machine-feedback').innerHTML =
    '<span style="color:#1a6020;font-size:1.2rem;">✅ TRANSMISSION VALIDÉE</span>';

  setTimeout(() => {
    closeModal('modal-machine');
    AudioManager.victory();
    const vs = document.getElementById('victory-screen');
    vs.classList.add('show');
    const elapsed = Math.floor((Date.now() - State.startTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    document.getElementById('timer-display').textContent = `${min}:${sec}`;
  }, 1200);
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
document.addEventListener('DOMContentLoaded', () => {

  // Inactivité 3 min : chandelle qui s'éteint
  let inactivityTimer;
  function resetInactivity() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (State.lampOn) toggleLamp();
    }, 3 * 60 * 1000);
  }
  document.addEventListener('mousemove', resetInactivity);
  document.addEventListener('click', resetInactivity);
  resetInactivity();
});



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
  
  // L'ombre volumétrique est noire avec un léger flou de diffusion
  ctx.filter = 'brightness(0) blur(3px)';

  for (const [id, height] of Object.entries(OBJECT_HEIGHTS)) {
    const obj = document.getElementById(id);
    if (!obj || obj.style.display === 'none') continue;

    const rect = obj.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    const dx = ox - lx;
    const dy = oy - ly;
    
    // Le nombre de couches dépend de la hauteur de l'objet
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
      
      // L'ombre s'estompe vers la fin
      ctx.globalAlpha = baseOpacity * Math.pow((1 - progress), 1.5);
      
      ctx.save();
      ctx.translate(ox + tx, oy + ty);
      ctx.scale(currentScale, currentScale);
      ctx.translate(-ox, -oy);
      
      let drawTarget = obj;
      if (obj.tagName.toLowerCase() === 'div') {
        const img = obj.querySelector('img');
        if (img) drawTarget = img;
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

// Relancer l'animation des ombres quand la fenêtre est redimensionnée
window.addEventListener('resize', () => { updateShadows(); });

/* ──────────────────────────────────────
   INITIALISATION
────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSpotlight();
  buildCipherGrid();
  
  // Calcul initial des ombres
  setTimeout(updateShadows, 100);

  // Démarrer l'intro après 500ms
  setTimeout(runIntro, 500);

  // Raccourci Entrée pour passer l'intro
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('intro-screen').style.display !== 'none') {
      skipIntro();
    }
  });

  // Easter egg : taper GRANDOU sur la machine déclenche un son spécial
  // (géré via le même listener keydown)
});
