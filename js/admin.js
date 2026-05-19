// js/admin.js

let adminActive = false;
let selectedObj = null;

// Création de l'overlay de transformation
const overlay = document.createElement('div');
overlay.id = 'transform-overlay';
overlay.style.cssText = `
  position: absolute; border: 2px dashed #00aaff;
  box-sizing: border-box; cursor: move; z-index: 99999;
  display: none; background: rgba(0, 170, 255, 0.1);
  transform-origin: 50% 50%;
`;

const handleStyle = `
  position: absolute; width: 14px; height: 14px; background: #fff;
  border: 2px solid #00aaff; border-radius: 50%;
  transform: translate(-50%, -50%);
`;

const hBR = document.createElement('div'); 
hBR.style.cssText = handleStyle + 'top:100%;left:100%;cursor:nwse-resize;';

const hRot = document.createElement('div'); 
hRot.style.cssText = handleStyle + 'top:-30px;left:50%;cursor:grab;background:#00aaff;';

const rotLine = document.createElement('div');
rotLine.style.cssText = 'position:absolute;top:-30px;left:50%;width:2px;height:30px;background:#00aaff;transform:translateX(-50%);';

overlay.appendChild(rotLine);
overlay.appendChild(hBR);
overlay.appendChild(hRot);

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('scene').appendChild(overlay);
  document.body.appendChild(floatUI);
});

// UI flottante pour Z-Index, Hauteur et Générer CSS
const floatUI = document.createElement('div');
floatUI.style.cssText = `
  position: absolute; display:none; background:#222; color:#fff; padding:15px; border-radius:5px;
  font-family:sans-serif; font-size:13px; z-index:100000; box-shadow:0 4px 10px rgba(0,0,0,0.5);
  pointer-events: auto; width: 150px;
`;
floatUI.innerHTML = `
  <div style="margin-bottom:8px;font-weight:bold;color:#00aaff" id="tf-title"></div>
  <div style="margin-bottom:8px;display:flex;justify-content:space-between;">
    <b>Z-Index:</b> <input type="number" id="tf-z" style="width:50px;">
  </div>
  <div style="margin-bottom:12px;display:flex;justify-content:space-between;">
    <b>Hauteur:</b> <input type="number" id="tf-h" style="width:50px;" step="0.5">
  </div>
  <button id="tf-copy" style="background:#00aaff;border:none;color:white;padding:8px;cursor:pointer;width:100%;border-radius:3px;">Copier CSS Global</button>
`;

function selectObject(obj) {
  selectedObj = obj;
  overlay.style.display = 'block';
  floatUI.style.display = 'block';
  
  // S'assurer que le transform n'écrase pas l'overlay
  let rot = parseFloat(obj.style.getPropertyValue('--rot')) || 0;
  if (rot === 0 && window.getComputedStyle(obj).transform !== 'none') {
    const values = window.getComputedStyle(obj).transform.split('(')[1].split(')')[0].split(',');
    if (values.length >= 2) {
      rot = Math.round(Math.atan2(values[1], values[0]) * (180/Math.PI));
    }
  }
  obj.style.setProperty('--rot', rot + 'deg');
  obj.style.transform = `rotate(${rot}deg)`;
  
  document.getElementById('tf-title').innerText = obj.id;
  document.getElementById('tf-z').value = obj.style.zIndex || window.getComputedStyle(obj).zIndex || 10;
  document.getElementById('tf-h').value = OBJECT_HEIGHTS[obj.id] || 1;
  
  updateOverlay();
}

function updateOverlay() {
  if (!selectedObj) return;
  const comp = window.getComputedStyle(selectedObj);
  overlay.style.width = comp.width;
  overlay.style.height = comp.height;
  
  // Utiliser la position calculée
  let left = selectedObj.style.left || ((parseFloat(comp.left) / window.innerWidth) * 100 + '%');
  let top = selectedObj.style.top || ((parseFloat(comp.top) / window.innerHeight) * 100 + '%');
  
  overlay.style.left = left;
  overlay.style.top = top;
  
  let rot = selectedObj.style.getPropertyValue('--rot') || '0deg';
  overlay.style.transform = `rotate(${rot})`;
  
  const rect = selectedObj.getBoundingClientRect();
  floatUI.style.top = Math.max(10, rect.top - 20) + 'px';
  floatUI.style.left = Math.min(window.innerWidth - 170, rect.right + 20) + 'px';
}

// Variables d'état drag
let isDragging = false;
let isResizing = false;
let isRotating = false;
let startX, startY;
let initialLeft, initialTop;
let initialDist, startWidth;
let centerX, centerY;

overlay.addEventListener('mousedown', (e) => {
  if (e.target !== overlay) return;
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialLeft = parseFloat(selectedObj.style.left) || (selectedObj.offsetLeft / window.innerWidth * 100);
  initialTop = parseFloat(selectedObj.style.top) || (selectedObj.offsetTop / window.innerHeight * 100);
  e.stopPropagation();
});

hBR.addEventListener('mousedown', (e) => {
  isResizing = true;
  const rect = selectedObj.getBoundingClientRect();
  centerX = rect.left + rect.width / 2;
  centerY = rect.top + rect.height / 2;
  initialDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
  startWidth = parseFloat(selectedObj.style.width) || (selectedObj.offsetWidth / window.innerWidth * 100);
  e.stopPropagation();
});

hRot.addEventListener('mousedown', (e) => {
  isRotating = true;
  const rect = selectedObj.getBoundingClientRect();
  centerX = rect.left + rect.width / 2;
  centerY = rect.top + rect.height / 2;
  e.stopPropagation();
});

window.addEventListener('mousemove', (e) => {
  if (!selectedObj) return;
  
  if (isDragging) {
    let dx = (e.clientX - startX) / window.innerWidth * 100;
    let dy = (e.clientY - startY) / window.innerHeight * 100;
    selectedObj.style.left = (initialLeft + dx).toFixed(2) + '%';
    selectedObj.style.top = (initialTop + dy).toFixed(2) + '%';
    selectedObj.style.bottom = 'auto';
    selectedObj.style.right = 'auto';
    updateOverlay();
    if (typeof updateShadows === 'function') updateShadows();
  }
  
  if (isResizing) {
    let dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    let ratio = dist / initialDist;
    selectedObj.style.width = (startWidth * ratio).toFixed(2) + '%';
    updateOverlay();
    if (typeof updateShadows === 'function') updateShadows();
  }
  
  if (isRotating) {
    let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    angle += 90; // Adjust relative to top handle
    let rot = Math.round(angle);
    selectedObj.style.setProperty('--rot', rot + 'deg');
    selectedObj.style.transform = `rotate(${rot}deg)`;
    updateOverlay();
    if (typeof updateShadows === 'function') updateShadows();
  }
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  isResizing = false;
  isRotating = false;
});

// Click management
document.addEventListener('mousedown', (e) => {
  if (!adminActive) return;
  
  if (overlay.contains(e.target) || floatUI.contains(e.target)) return;
  
  if (e.target.classList.contains('obj')) {
    e.preventDefault();
    e.stopPropagation();
    selectObject(e.target);
  } else {
    selectedObj = null;
    overlay.style.display = 'none';
    floatUI.style.display = 'none';
  }
}, true);

// Prevent default drag and drop behavior in HTML
document.addEventListener('dragstart', (e) => {
  if (adminActive) e.preventDefault();
});

// Inputs in Float UI
floatUI.querySelector('#tf-z').addEventListener('input', (e) => {
  if(selectedObj) {
    selectedObj.style.zIndex = e.target.value;
  }
});
floatUI.querySelector('#tf-h').addEventListener('input', (e) => {
  if(selectedObj) {
    OBJECT_HEIGHTS[selectedObj.id] = parseFloat(e.target.value);
    if (typeof updateShadows === 'function') updateShadows();
  }
});

// Generate CSS
floatUI.querySelector('#tf-copy').addEventListener('click', () => {
  let css = "/* ==========================================\n   COPIEZ CES LIGNES DANS style.css\n========================================== */\n\n";
  document.querySelectorAll('.obj').forEach(obj => {
    let w = obj.style.width || (obj.offsetWidth / window.innerWidth * 100).toFixed(2) + '%';
    let t = obj.style.top || (obj.offsetTop / window.innerHeight * 100).toFixed(2) + '%';
    let l = obj.style.left || (obj.offsetLeft / window.innerWidth * 100).toFixed(2) + '%';
    let z = obj.style.zIndex || window.getComputedStyle(obj).zIndex;
    let r = obj.style.getPropertyValue('--rot') || '0deg';
    
    css += `#${obj.id} {\n`;
    css += `  width: ${w}; top: ${t}; left: ${l};\n`;
    css += `  --rot: ${r};\n`;
    if(z && z !== 'auto' && z !== '10' && z !== '0') css += `  z-index: ${z};\n`;
    css += `}\n\n`;
  });
  
  css += "/* ==========================================\n   COPIEZ CECI DANS main.js (OBJECT_HEIGHTS)\n========================================== */\n";
  css += "const OBJECT_HEIGHTS = {\n";
  for(let id in OBJECT_HEIGHTS) {
    css += `  '${id}': ${OBJECT_HEIGHTS[id]},\n`;
  }
  css += "};\n";
  
  navigator.clipboard.writeText(css).then(() => {
    const btn = floatUI.querySelector('#tf-copy');
    btn.innerText = "Copié !";
    setTimeout(() => btn.innerText = "Copier CSS Global", 2000);
  }).catch(err => {
    console.log("Erreur clipboard", err);
    alert("Copiez le CSS depuis la console");
    console.log(css);
  });
});

function toggleAdmin() {
  adminActive = !adminActive;
  if (adminActive) {
    document.body.style.cursor = 'default';
    alert("Mode Éditeur Visuel Activé\\nCliquez sur n'importe quel objet pour le redimensionner, le tourner ou le déplacer !");
  } else {
    document.body.style.cursor = 'none';
    selectedObj = null;
    overlay.style.display = 'none';
    floatUI.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    toggleAdmin();
  }
});
