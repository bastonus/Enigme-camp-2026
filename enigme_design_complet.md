# 🕵️ OPÉRATION CUBJAC — Design Complet de l'Énigme Web
### *"Le Poste de Transmission d'Ans" — Camp GJ 2026*

> **Contexte narratif :** Nous sommes le 4 août 1944. La libération de Périgueux est imminente. Un parachutage allié est prévu le lendemain au nord de Cubjac. Le Facteur a intercepté un message Morse incomplet, planqué dans une boîte à cigares. Seul un éclaireur capable de lire les étoiles, la carte et le code pourra activer la transmission finale et guider les résistants sur le bon point de chute.

---

## 🖥️ INTERFACE GÉNÉRALE — La Table du Poste de Transmission

### Concept visuel
La page web est une **vue de dessus d'une table en bois sombre**, éclairée par un halo de lampe à huile (effet vignettage CSS). Aucun menu, aucune aide apparente. Les objets sont les seules interfaces.

```
┌─────────────────────────────────────────────────────────────────┐
│  [OMBRE]              [FENÊTRE avec ciel nocturne]    [OMBRE]   │
│                                                                  │
│   [Poste radio bakélite]        [Carte IGN 1944 froissée]       │
│                                                                  │
│   [Boîte à cigares VILLIGER]    [Carnet de notes / grille]      │
│        avec cigare BENTLEY                                       │
│                                                                  │
│   [Luger P08 posé à plat]       [Boussole laiton dorée]         │
│                                                                  │
│              [Cendrier + mégot]      [Verre de cognac]          │
└─────────────────────────────────────────────────────────────────┘
```

### Ambiance CSS & Effets
- `background`: photo HD de table en bois rustique (filter: sepia(0.4) brightness(0.6))
- `vignette`: radial-gradient noir en overlay, opacité 80%
- `grain de film`: texture PNG de bruit semi-transparente en overlay animée
- `cursor`: curseur personnalisé en forme de petite lampe torche (spotlight effect au hover)
- **Aucun texte d'interface visible** : pas de "Cliquez ici", pas de menu

### Son ambiant (Howler.js, lecture en boucle dès l'ouverture)
| Fichier audio | Description | Déclencheur |
|---|---|---|
| `ambient_pluie.mp3` | Pluie légère sur les volets | Dès chargement, loop |
| `ambient_feu.mp3` | Crépitement de cheminée | Dès chargement, loop |
| `ambient_grillon.mp3` | Grillons nocturnes, nuit d'été | Dès chargement, loop |
| `radio_friture.mp3` | Friture radio statique | Au clic sur le poste radio |
| `radio_bbc.mp3` | BBC Londres, intro + Morse | Séquence automatique après friture |
| `machine_a_ecrire.mp3` | Clac mécanique | À chaque frappe de la réponse finale |
| `papier_froisse.mp3` | Froissement papier | Quand on ouvre la boîte à cigares |
| `cognac_verre.mp3` | Easter egg : tintement de verre | Clic sur le verre de cognac |

---

## 📦 OBJET 1 — La Boîte à Cigares VILLIGER 1888

> **Rôle narratif :** C'est le premier objet à interagir. Le Cerveau Parisien (alias "DANDY") cache ses messages dans des boîtes à cigares de luxe — trop voyantes pour la Gestapo, trop élégantes pour être fouillées dans un café.

### Apparence sur la table
- PNG : `boite_cigare.webp` — boîte rouge Villiger 1888, légèrement ouverte, posée en biais
- Drop shadow CSS portée sur la table
- Légère animation `float` CSS (monte/descend de 3px, 4s loop) pour signaler qu'elle est interactive

### Interaction
**Clic sur la boîte** → animation d'ouverture (CSS transform + JS) :
1. Le couvercle s'ouvre lentement (transform: rotateX(-110deg), 0.8s ease)
2. Les 4 cigares apparaissent (Toro, Corona, Torpedo, Robusto)
3. Le cigare BENTLEY (cigare.webp) repose sur le dessus — il est légèrement de travers

**Clic sur le cigare BENTLEY** → il se soulève (animation) :
- Dessous du cigare : un **ticket de tramway** avec un message griffonné à l'encre violette :

```
┌─────────────────────────────────────┐
│  TRAMWAYS DE PÉRIGUEUX - 2ème CL.   │
│                                     │
│  "DANDY à FACTEUR — 4 août 44"      │
│                                     │
│  Écoute ce soir 21h45 sur la BBC.   │
│  Fréquence habituelle.              │
│  Le message sera pour nous.         │
│  — V."                              │
│                                     │
│  [gribouillé en morse au bas :]     │
│  .-.. . ...  ... .- -. --. .-.. --- │
│  - ...                              │
└─────────────────────────────────────┘
```

**→ Indice clé :** "Écoute ce soir 21h45 → aller au poste radio"

---

## 📻 OBJET 2 — Le Poste de Radio Bakélite

> **Rôle narratif :** C'est le cœur de l'énigme. Un vieux poste bakélite brun qui capte Radio Londres. L'Écossais (alias "WHISKY") a mis en place la fréquence avant de partir vers Périgueux.

### Apparence
- PNG : illustration ou photo d'un poste TSF bakélite des années 40 (Philips, marron)
- Cadran lumineux à aiguille, bouton de volume et bouton de fréquence
- Ampoule de cadran : initialement éteinte (opacité 0.1, couleur ambre)

### Interaction — Séquence en 3 temps

**TEMPS 1 — Allumer le poste (clic sur le bouton ON/OFF)**
- Animation : ampoule qui chauffe progressivement (de opacité 0.1 → 1, couleur #FF8C00 → #FFD700, 3s)
- Son : `radio_friture.mp3` — friture radio, statique, 15 secondes
- L'aiguille du cadran tremble légèrement (animation CSS keyframes)

**TEMPS 2 — La voix de Londres (automatique après 15s de friture)**
```
🔊 Audio BBC "radio_bbc_intro.mp3" :

[Musique des Cloches de Big Ben — 3 coups]
"Ici Londres… Les Français parlent aux Français…"
[Pause de 3 secondes]
"Avant nos émissions, veuillez écouter quelques messages personnels."
[Pause de 2 secondes]
"Premier message : Les sanglots longs des violons de l'automne…"
[Pause de 5 secondes]
"Deuxième message : Le canard sauvage vole vers le nord."
[Pause de 2 secondes]
"Troisième message : La boussole indique toujours le chemin du vaillant."
[Pause de 3 secondes]
"Et maintenant, un message pour nos amis de la Dordogne…"
```

**TEMPS 3 — Le Message Morse (le vrai indice)**
```
🔊 Audio "radio_morse.mp3" — le message est transmis 2 fois :

[Morse lent, 12 mots/min, avec friture en fond]

Message en Morse :
ALTITUDE FORGE CENT QUATRE-VINGT-DEUX

Code Morse correspondant :
.- .-.. - .. - ..- -.. . / ..-. --- .-. --. . / -.-. . -. - / -.-. .- -.-. 
--.- ..- .- - .-. . / ...- .. -. --. - / -.. . ..- -..-

Message répété une 2ème fois, légèrement plus fort.
[Friture qui reprend, puis silence]
```

> **Réponse attendue des scouts :** L'altitude est **182m** (inventée ou réelle — à ajuster selon la vraie carte IGN de la Forge d'Ans en Dordogne)

### Widget de décodage Morse
- Un **papier de décodage** apparaît automatiquement sur la table pendant la transmission (glisse depuis le bas)
- Il contient le **tableau Morse complet** (alphabétique)
- Les scouts notent les lettres sur papier réel pendant l'écoute

---

## 🗺️ OBJET 3 — La Carte IGN 1944 de la Dordogne

> **Rôle narratif :** La carte d'état-major récupérée sur un officier de la Kommandantur. Elle est froissée, tachée, mais les points côtés sont lisibles. Le Facteur a cerclé au crayon rouge un lieu-dit : "La Forge d'Ans".

### Apparence
- PNG : extrait de carte IGN historique (scan fond d'écran 1950 ou état-major)
- Filtre CSS : `sepia(0.6) contrast(1.1) brightness(0.85)`
- Posée sur la table, légèrement froissée (effet CSS box-shadow inset + pseudo-éléments)
- Un cercle rouge au crayon (SVG overlay) autour de "La Forge d'Ans"

### Interaction
**Clic sur la carte** → la carte s'ouvre en plein écran (modal avec Leaflet.js)

```javascript
// Leaflet.js avec tuiles IGN historiques
L.tileLayer.wms('https://wxs.ign.fr/.../wms', {
  layers: 'GEOGRAPHICALGRIDSYSTEMS.ETAT-MAJOR.40',
  format: 'image/png',
  transparent: true
})
```

**Outil loupe (draggable, interact.js)**
- Une **loupe ronde** (img PNG, curseur change) peut être déplacée sur la carte
- Sous la loupe, le rendu est agrandi x2 (effect CSS + canvas)
- Quand la loupe passe sur "La Forge d'Ans" : le **point coté "182"** devient lisible

**Ce que les scouts doivent trouver :**
```
Lieu-dit : LA FORGE D'ANS
Point coté (altitude) : 182 m
```

> **Ce nombre (182) est la clé de l'étape suivante.**

---

## 📒 OBJET 4 — Le Carnet de Notes (Échiquier de Substitution)

> **Rôle narratif :** Le carnet de l'Écossais. Il a commencé à remplir la grille de code avant d'être rappelé d'urgence. Il manque une ligne — celle que seule la clé (l'altitude) permet de compléter.

### Apparence
- PNG : carnet moleskine noir, ouvert, pages légèrement gondolées
- Écriture à la main simulée (Google Font: *Caveat* ou *Kalam*)
- Taches de café sur la page de droite
- Grille dessinée à l'encre, partiellement remplie

### Le Chiffre de Vic — Échiquier de Substitution

**Fonctionnement pédagogique (expliqué dans la page web en style "note marginale") :**
```
La clé est le nombre 182.
Écris les chiffres 1, 8, 2 dans cet ordre sous les premières colonnes.
Puis complète la ligne alphabétique selon leur ordre d'apparition dans la clé.
```

**La grille affichée dans le carnet (partiellement pré-remplie) :**
```
     1    8    2    [?]  [?]  [?]  [?]  [?]  [?]  [?]
     A    B    C    D    E    F    G    H    I    J
     K    L    M    N    O    P    Q    R    S    T
     U    V    W    X    Y    Z
```

**Message chiffré (sous le Luger — étape suivante) :**
```
18-2-8-1-2-1  1-2-8  1-8-2-1-8-2  1-2-1-8
(à déchiffrer avec la grille → donne : "DEPUIS TOURTOIRAC AZIMUT")
```

> *Le message chiffré complet sera calibré selon la grille finale lors de la mise en production.*

### Interaction web
- Le carnet est **cliquable case par case** pour remplir la grille
- Chaque case vide est un `<input>` stylisé en écriture manuscrite
- Quand la première ligne est correctement complétée → les cases grises du message chiffré se colorent une à une (animation lettre par lettre, son de plume)

---

## 🔫 OBJET 5 — Le Luger P08

> **Rôle narratif :** Il appartient au colonel Allemand SS. Le Facteur l'a "récupéré" lors d'une embuscade au Pont de Cubjac. Il est posé sur un morceau de papier plié — le message chiffré final.

### Apparence
- PNG : `luger.png` — Luger P08 photographié de face, fond transparent
- Posé horizontalement sur la table, légèrement en biais
- Ombre portée prononcée (box-shadow CSS)
- Un coin de papier jaune dépasse sous la crosse

### Interaction
**Clic sur le Luger** → animation de glissement :
- Le Luger glisse vers le haut (transform: translateY(-120px), 0.6s ease)
- Son : `papier_froisse.mp3`
- En dessous apparaît une **note pliée**, qui se déplie automatiquement (animation CSS)

**Le papier déplié révèle :**
```
┌──────────────────────────────────────────┐
│  [Cachet rouge : GEHEIMNIS — SECRET]     │
│                                          │
│  Ordre de mission — Réseau AS            │
│  Codé selon échiquier habituel :         │
│                                          │
│  18-2 / 8-1-2 / 18-2-1-8 / 2-1-8-2-1   │
│  8-2-1 / 1-8 / 18-2-1 / 8-1             │
│                                          │
│  [À décoder avec la grille du carnet]   │
└──────────────────────────────────────────┘
```

---

## 🧭 OBJET 6 — La Boussole en Laiton

> **Rôle narratif :** La boussole de Tommy Macpherson (l'Écossais). Gravée à son chiffre : "T.M. — 1940". Il l'a laissée sur la table en partant, signe qu'il fait confiance aux éclaireurs pour finir le travail.

### Apparence
- PNG : `boussole.webp` — boussole laiton dorée, rose des vents vintage, fond transparent
- Posée à plat, l'aiguille pointe vers le NE (pas vers le N, indice subtil)
- Légère animation de rotation de l'aiguille (±5°, 3s loop, effet tremblement magnétique)

### Interaction
**Clic sur la boussole** → elle se retourne (flip CSS 3D) :
- Au dos, gravé : **"Azimut — rapporteur sur Tourtoirac"**
- Apparition d'un **rapporteur transparent** (SVG semi-transparent) superposable sur la carte

**Utilisation du rapporteur :**
- Les scouts positionnent le centre du rapporteur sur **Tourtoirac** sur la carte Leaflet
- Ils alignent la graduation sur **l'azimut issu du message décodé** (ex: 245°)
- Un trait rouge apparaît dynamiquement sur la carte (canvas SVG)
- Ce trait pointe exactement sur le village de **CUBJAC**
- Animation finale : zoom progressif sur CUBJAC, cercle rouge pulsant

---

## ✅ ÉTAPE FINALE — La Machine à Écrire

> **Rôle narratif :** La vieille Remington du Facteur. Seul un nom écrit dessus compte comme validation officielle. Le réseau attend la confirmation.

### Apparence
- PNG : machine à écrire Remington des années 40, positionnée au bord de la table
- Le rouleau porte une feuille vierge
- Chaque touche du clavier est cliquable OU les scouts tapent au clavier physique

### Interaction
- Chaque frappe → son `machine_a_ecrire.mp3` + lettre qui apparaît sur le papier (style typewriter)
- Si les scouts tapent **CUBJAC** :
  - Animation : la feuille se soulève, un tampon "TRANSMIS" tombe dessus
  - Son : `tampon_officiel.mp3` + fanfare courte `victoire.mp3`
  - La table s'illumine progressivement (brightness de 0.6 → 1.0)
  - Texte final apparaît en fondu :

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   TRANSMISSION REÇUE — 5 AOÛT 1944 — 00h17                 │
│                                                             │
│   Le parachutage allié aura lieu cette nuit.               │
│   Point de chute confirmé : CUBJAC, confluent de           │
│   l'Auvézère.                                              │
│                                                             │
│   Résistants mobilisés. La Libération approche.            │
│                                                             │
│   "On ne meurt pas pour des idées, on meurt pour des       │
│    hommes." — Le Facteur                                    │
│                                                             │
│   ┌──────────────────────────────────────────┐             │
│   │  PATROUILLE [NOM]     Temps : 00:32:14   │             │
│   │  Rang Renseignement : ██████████ AGENT   │             │
│   └──────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗺️ RÉCAPITULATIF DU PARCOURS COMPLET

```
[OUVERTURE DE LA PAGE]
        │
        ▼
[Ambiance sonore : pluie + cheminée]
[Table sombre — objets visibles]
        │
        ▼
[1. Boîte à cigares VILLIGER cliquée]
   └─ Cigare BENTLEY soulevé
   └─ Ticket de tramway : "Écoute BBC 21h45"
        │
        ▼
[2. Poste radio bakélite cliqué]
   └─ Ampoule qui chauffe (15s)
   └─ BBC Londres : voix + messages personnels
   └─ MESSAGE MORSE : "ALTITUDE FORGE CENT QUATRE-VINGT-DEUX"
   └─ [DÉCODAGE MORSE] → 182
        │
        ▼
[3. Carte IGN 1944 ouverte]
   └─ Leaflet.js avec carte historique
   └─ Loupe draggable sur "La Forge d'Ans"
   └─ Point coté lu : 182m ✓
        │
        ▼
[4. Carnet de notes ouvert]
   └─ Échiquier de substitution partiellement rempli
   └─ Clé = 182 → compléter la grille
        │
        ▼
[5. Luger glissé]
   └─ Papier révélé en dessous
   └─ Message chiffré à décoder avec la grille
   └─ Message décodé : "DEPUIS TOURTOIRAC AZIMUT DEUX CENT QUARANTE-CINQ"
        │
        ▼
[6. Boussole retournée]
   └─ Rapporteur apparu sur la carte
   └─ Azimut 245° tracé depuis Tourtoirac
   └─ Le trait pointe sur CUBJAC → zoom + cercle rouge
        │
        ▼
[7. Machine à écrire]
   └─ Les scouts tapent : C-U-B-J-A-C
   └─ Validation + fanfare + texte final
   └─ Score affiché avec temps de résolution
```

---

## 🔊 LISTE COMPLÈTE DES ASSETS AUDIO À PRODUIRE

| Fichier | Durée | Description | Source suggérée |
|---|---|---|---|
| `ambient_pluie.mp3` | Loop 60s | Pluie légère | freesound.org |
| `ambient_feu.mp3` | Loop 30s | Crépitement cheminée | freesound.org |
| `ambient_grillon.mp3` | Loop 45s | Grillons nuit d'été | freesound.org |
| `radio_friture.mp3` | 15s | Friture radio statique | freesound.org |
| `radio_bbc_intro.mp3` | ~50s | Voix BBC Londres à enregistrer | **À ENREGISTRER** |
| `radio_morse.mp3` | ~90s | Message Morse (x2) | Générateur Morse en ligne |
| `papier_froisse.mp3` | 2s | Froissement papier | freesound.org |
| `machine_a_ecrire.mp3` | 0.3s | Clac unique de touche | freesound.org |
| `tampon_officiel.mp3` | 1s | Son de tampon encreur | freesound.org |
| `victoire.mp3` | 5s | Courte fanfare militaire | freesound.org |
| `cognac_verre.mp3` | 1s | Easter egg : tintement | freesound.org |
| `plume_ecriture.mp3` | 0.2s | Son de plume (grille remplie) | freesound.org |

### Ressources pour le message BBC
> **Script à enregistrer pour `radio_bbc_intro.mp3`** (voix grave, légèrement filtrée, accent neutre) :
> 
> *"Ici Londres… Les Français parlent aux Français… Avant nos émissions, veuillez écouter quelques messages personnels. Premier message : Les sanglots longs des violons de l'automne… Deuxième message : Le canard sauvage vole vers le nord. Troisième message : La boussole indique toujours le chemin du vaillant. Et maintenant… un message pour nos amis de la Dordogne…"*

### Ressources pour le Morse
> Générateurs recommandés :
> - https://morsecode.world/international/translator.html (audio export)
> - https://onlinetonegenerator.com/morse-code.html
> 
> **Message à encoder en audio Morse :**
> `ALTITUDE FORGE CENT QUATRE VINGT DEUX`

---

## 💻 STACK TECHNIQUE RECOMMANDÉE

```
📁 enigme-cubjac/
├── index.html              ← Page principale (table + objets)
├── css/
│   ├── table.css           ← Fond, vignettage, grain de film
│   ├── objects.css         ← Styles de chaque objet
│   └── animations.css      ← Toutes les keyframes CSS
├── js/
│   ├── main.js             ← Orchestration générale
│   ├── audio.js            ← Gestion Howler.js
│   ├── map.js              ← Leaflet.js + loupe + rapporteur
│   ├── morse.js            ← Widget décodage Morse
│   └── cipher.js           ← Logique échiquier de substitution
├── img/
│   ├── boite_cigare.webp   ← ✅ Fourni
│   ├── boussole.webp       ← ✅ Fourni
│   ├── cigare.webp         ← ✅ Fourni
│   ├── luger.png           ← ✅ Fourni
│   ├── table_bois.jpg      ← À trouver/générer
│   ├── carnet.png          ← À générer
│   └── machine_ecrire.png  ← À trouver/générer
└── audio/
    ├── [tous les fichiers MP3 listés ci-dessus]
```

### Librairies
| Lib | Usage | CDN |
|---|---|---|
| `Howler.js` | Gestion audio multi-couche | cdnjs |
| `Leaflet.js` | Carte interactive IGN | cdnjs |
| `interact.js` | Drag & drop des objets | cdnjs |
| Google Fonts | *Caveat* (écriture main) + *Special Elite* (machine à écrire) | Google |

---

## 🎭 EASTER EGGS & DÉTAILS DE CARACTÈRE

| Easter egg | Déclencheur | Réaction |
|---|---|---|
| Clic sur le verre de cognac | 1 clic | Son de tintement, verre qui se remplit |
| Double clic sur le verre | 2ème clic | Voix du Facteur : *"C'est pas le moment de boire, enfin !"* |
| Clic sur le cendrier | 1 clic | Son de cigare qu'on écrase, une volute de fumée CSS |
| Taper "DANDY" sur la machine | — | Réponse : *"Bonne idée, mais non. Cherchez encore."* |
| Taper "GRANDOU" | — | Un bruit de moto passe au loin, silence, puis voix grave : *"Il méritait mieux."* |
| Laisser la page inactive 3 min | Inactivité | Le vent souffle fort, une chandelle s'éteint (assombrissement + son) |

---

## 📊 SCORING ET CLASSEMENT

Pour chaque patrouille, le serveur (PHP/Node) enregistre :

| Donnée | Description |
|---|---|
| `patrol_name` | Nom de la patrouille |
| `start_time` | Horodatage de début |
| `end_time` | Horodatage de validation |
| `total_time` | Durée totale en secondes |
| `hints_used` | Nombre d'indices demandés (si système d'aide) |
| `rank` | Calculé : "Renseignement" / "Agent" / "Opérateur" / "Espion confirmé" |

**Tableau affiché le premier soir du camp :**
```
╔══════════════════════════════════════════════════════╗
║     RENSEIGNEMENT GÉNÉRAL — OPÉRATION CUBJAC         ║
╠══════════════════╦══════════════╦════════════════════╣
║ Patrouille       ║ Temps        ║ Niveau             ║
╠══════════════════╬══════════════╬════════════════════╣
║ Les Renards      ║ 00:18:42     ║ ★★★ Espion Confirmé║
║ Les Aigles       ║ 00:24:15     ║ ★★  Agent          ║
║ Les Loups        ║ 00:31:07     ║ ★   Opérateur      ║
╚══════════════════╩══════════════╩════════════════════╝
```

---

## 🎬 ÉCRAN D'INTRODUCTION — "Ordre de Mission"

Avant d'arriver sur la table, les scouts voient un **écran de chargement narratif** :

- **Fond** : noir total, grain de pellicule 16mm animé en CSS
- Un **télétype** imprime le texte lettre par lettre (son mécanique) :

```
ÉTAT-MAJOR DES F.F.I. — SECTEUR PÉRIGORD NOIR
ORDRE DE MISSION N°4 — CONFIDENTIEL

DATE : 4 AOÛT 1944 — 21H30
DESTINATAIRE : ÉQUIPE [NOM PATROUILLE]

Nos réseaux ont perdu le contact avec l'agent FACTEUR.
Son dernier message Morse indiquait un point de parachutage
allié pour cette nuit. Il n'a pas pu transmettre les coordonnées.

Vous avez accès à son poste de transmission.
Tout ce qu'il vous faut est sur cette table.
La Libération de Périgueux dépend de votre rapidité.

Bonne chance. Ne faites pas de bruit.

— COLONEL SS WILLY [SURNOM CAMP]
  [raturé et remplacé par :] — WHISKY
```

- Après l'impression complète : **fondu au noir**, puis **fondu sur la table**
- La pluie commence doucement pendant le fondu

---

## 🕯️ OBJET 7 — La Lampe à Huile (Mécanique Lampe Torche)

> **Rôle narratif :** La seule source de lumière du poste. Si on l'éteint, on voit ce que la lumière cachait.

### Apparence
- PNG haute résolution : lampe à pétrole vintage, verre ambré, flamme animée CSS
- Placée en haut à gauche de la table, éclairant toute la scène (vignettage radial centré sur elle)
- La flamme : animation CSS `flicker` (opacité 0.85→1→0.9, légère rotation, 2s aléatoire)

### Mécanique principale : **Effet Lampe Torche Inversé**
Par défaut, le curseur de la souris se comporte comme **une lampe torche** :
- Autour du curseur : cercle de lumière de 200px de rayon (radial-gradient CSS en overlay)
- Le reste de la table est plongé dans l'obscurité quasi-totale
- Les objets ne sont visibles qu'à la lumière du curseur → encourage l'exploration

**Clic sur la lampe à huile** → la lampe s'éteint (animation de flamme qui s'évanouit, 1.5s) :
- L'obscurité totale tombe (overlay noir à 95%)
- Mais certains objets révèlent de l'**encre sympathique UV** (voir ci-dessous)
- Un murmure : voix du Facteur : *"Regardez ce que la lumière vous cachait…"*

### 🔦 Encre Sympathique — Révélations dans le Noir
Quand la lampe est éteinte, des éléments **fluorescents apparaissent** (CSS : `color: #00FF88`, `text-shadow: 0 0 12px #00FF88`, `opacity: 0 → 1`) :

| Objet | Ce qui apparaît dans le noir |
|---|---|
| Ticket de tramway (boîte à cigares) | La fréquence BBC manuscrite : **"49.8"** |
| Bord de la carte IGN | Un cercle UV autour de "La Forge d'Ans" avec flèche |
| Dos du carnet | Signature de l'Écossais + date : *"T.M. — Cubjac, 3 août"* |
| Sous la boussole | Une boussole de secours dessinée avec l'azimut **245** écrit en chiffres |

> **Intérêt pédagogique :** Les scouts doivent penser à éteindre la lampe — ce n'est pas évident. C'est un indice de méta-réflexion.

---

## 📡 OBJET 8 — La Clé Télégraphique (Morse Interactif)

> **Rôle narratif :** La clé de transmission du Facteur. Quand le poste radio ne reçoit plus rien, les scouts peuvent eux-mêmes émettre un signal de confirmation.

### Apparence
- PNG/3D render : **clé Morse télégraphique** en laiton sur socle en bois, câble raccordé au poste radio
- Posée à droite du poste radio
- Légère animation de reflet métallique (CSS `shine` sweep, 6s loop)

### Interaction — Jouer du Morse soi-même
- Un clic court sur la clé = **point (·)** → son bip court `bip_court.mp3`
- Un clic long (mousedown maintenu > 300ms) = **trait (—)** → son bip long `bip_long.mp3`
- Les signaux s'accumulent en haut de l'écran dans un **afficheur de papier** type téléscripteur

**Usage dans l'énigme :**
- Après avoir décodé le message BBC, les scouts doivent **réémettre** le code de confirmation : `.-. . -.-. ..-` (*RECU* en Morse)
- Si correct → le poste radio clignote 3 fois (LED verte CSS) et imprime un ticket de confirmation
- Si incorrect → friture + voix : *"Signal non reconnu. Recommencez."*

> ⚠️ **Asset requis :** PNG ou modèle 3D d'une clé Morse télégraphique en laiton, vue légèrement de dessus-côté, fond transparent.

---

## 📰 OBJET 9 — Le Journal "La Dépêche du Périgord"

> **Rôle narratif :** Un vieux journal du 3 août 1944, laissé par le Cheminot. Il a cerclé au crayon bleu une petite annonce codée en page 3 — sa façon à lui de cacher les coordonnées de réunion.

### Apparence
- PNG : une page de journal typographié années 40 (police *Special Elite*, colonnes serrées)
- Posé en biais sur la table, partiellement sous la boîte à cigares
- Titre inventé : **"La Dépêche du Périgord — Mardi 3 août 1944"**
- Un cercle crayon bleu sur une fausse petite annonce

### La fausse petite annonce (contenu réel) :
```
PETITES ANNONCES

À VENDRE : Forge artisanale, outils complets.
Vue imprenable. Alt. 182m. S'adresser au
propriétaire, chemin des Résistants, Ans.
Contacter : M. Dupont avant 22h.
```

> **C'est le second endroit où apparaît "182m"** — confirmation pour les scouts qui auraient raté la carte.

### Interaction
- Clic sur le journal → s'agrandit en plein écran (modal image HD)
- La petite annonce est surlignée en jaune au hover
- Un son de pages de journal qui tournent `journal_pages.mp3`

---

## 🥃 OBJET 10 — La Flasque de Cognac (Johnny Eng)

> **Rôle narratif :** La flasque de Johnny Eng, oubliée sur la table. Gravée : *"Machine Gun Johnny — NYC 1938"*. Si on la secoue, quelque chose cliquète à l'intérieur.

### Apparence
- PNG : flasque en acier gravée, style Art Déco années 30, fond transparent
- Posée debout contre le bord de la table

### Interaction
- **Clic** → son de liquide `cognac_flasque.mp3`
- **Double-clic rapide (secouer)** → son métallique `cliquetis_metal.mp3` + texte : *"Il y a quelque chose à l'intérieur…"*
- **Maintenir le clic 2s (ouvrir)** → animation d'ouverture + un petit **rouleau de papier** tombe sur la table

**Le rouleau de papier contient :**
```
Coordonnées du terrain de parachutage :
45°01'N — 1°05'E

P.S. : J'aurais bien gardé les armes pour moi.
      — J.E.
```
> Ces coordonnées GPS pointent exactement sur Cubjac sur la carte Leaflet — indice de secours pour les patrouilles bloquées.

---

## 🖼️ OBJET 11 — La Photo Encadrée (Roland Grandou)

> **Rôle narratif :** Une photo en noir et blanc dans un cadre simple, posée contre le mur. C'est Roland Grandou — le héros de Cubjac fusillé le 17 août 1944. Le Facteur l'a mis là pour ne pas oublier pourquoi il fait ça.

### Apparence
- PNG : photo sépia d'un homme en costume (générée par IA ou dessin)
- Petit cadre en bois simple
- Une bande de papier collée en bas : *"R.G. — Cubjac — Ne pas oublier"*

### Interaction
- Clic sur la photo → zoom + son de silence (`silence_solennel.mp3`, 3s)
- Un texte apparaît en fondu, police *Special Elite*, blanc sur noir :

```
Roland Grandou — 1907-1944
Garagiste. Lieutenant FFI.
Fusillé à la caserne Daumesnil, Périgueux.
Le 17 août 1944. Trois jours avant la Libération.

La place centrale de Cubjac porte son nom.
```

- Après 5 secondes : retour automatique à la table
- **Effet** : cette interaction n'est pas dans le chemin obligatoire de l'énigme — c'est un moment de mémoire volontaire

---

## 🌌 ÉCRAN DE CHARGEMENT — Le Ciel Étoilé d'Orion (Optionnel — Strate Bonus)

Si le groupe est avancé, on peut ajouter une **étape préliminaire astronomique** avant la table :

- Un ciel nocturne étoilé animé (canvas JS, étoiles scintillantes)
- Les scouts doivent identifier la constellation d'**Orion** et cliquer sur les 3 étoiles du Baudrier dans le bon ordre
- Résultat : un zoom depuis le ciel jusqu'à la table (transition CSS 3D `translateZ` + `scale`)

> Référence aux parachutages nocturnes de la RAF — les pilotes utilisaient Orion comme repère de navigation.

---

## 📋 ASSETS MANQUANTS — CE DONT J'AI BESOIN

Voici précisément ce que tu peux me fournir pour compléter l'interface :

### 🖼️ PNGs nécessaires (fond transparent, haute résolution)

| Asset | Description | Priorité |
|---|---|---|
| `table_bois.jpg` | Photo HD vue de dessus d'une table en bois sombre rustique, éclairage faible | 🔴 Critique |
| `poste_radio.png` | Poste TSF bakélite des années 40, vue légère 3/4, brun/marron | 🔴 Critique |
| `machine_ecrire.png` | Machine à écrire Remington des années 40, vue légère 3/4 | 🔴 Critique |
| `lampe_huile.png` | Lampe à pétrole/huile vintage, verre ambré, vue de côté | 🟡 Important |
| `cle_morse.png` | Clé Morse télégraphique en laiton sur socle bois, vue légère dessus | 🟡 Important |
| `journal_1944.png` | Page de journal typographié années 40 (je peux générer le contenu texte) | 🟡 Important |
| `flasque_acier.png` | Flasque en acier Art Déco gravée, vue de face | 🟢 Optionnel |
| `photo_cadre.png` | Petit cadre photo en bois simple avec photo sépia | 🟢 Optionnel |
| `carnet_ouvert.png` | Carnet moleskine noir ouvert, pages légèrement gondolées, vierge | 🟡 Important |
| `cendrier.png` | Cendrier avec mégot de cigare, années 40 | 🟢 Optionnel |
| `verre_cognac.png` | Verre à cognac à moitié plein, vue légère 3/4 | 🟢 Optionnel |
| `loupe.png` | Loupe ronde en laiton, vue de face fond transparent | 🟡 Important |
| `rapporteur.png` | Rapporteur transparent gradué 0–360°, fond translucide | 🟡 Important |

### 🎲 Modèles 3D (si tu veux une version interactive 3D avec Three.js)

> Si tu as accès à Blender ou à des modèles .glb/.obj, ces éléments en 3D rendraient l'expérience encore plus immersive :

| Asset 3D | Usage | Format idéal |
|---|---|---|
| Poste radio TSF bakélite | Rotation interactive à la souris | `.glb` (GLTF) |
| Clé Morse télégraphique | Animation de frappe | `.glb` |
| Boussole (déjà en PNG) | Rotation de l'aiguille en 3D | `.glb` |
| Luger P08 (déjà en PNG) | Glissement + rotation 3D | `.glb` |

> Si tu n'as pas de modèles 3D, je génère tous les rendus visuellement via CSS/SVG + les PNGs fournis — c'est amplement suffisant pour un résultat impressionnant.

### 🔊 Enregistrements audio à faire (voix humaine)

| Audio | Contenu | Personnage |
|---|---|---|
| `bbc_intro.mp3` | Script BBC Londres ci-dessus | Voix grave neutre (chef de troupe ?) |
| `facteur_voix1.mp3` | *"C'est pas le moment de boire, enfin !"* | Le Facteur (voix nasillarde, affolée) |
| `facteur_voix2.mp3` | *"Regardez ce que la lumière vous cachait…"* | Le Facteur (voix grave) |
| `facteur_voix3.mp3` | *"Signal non reconnu. Recommencez."* | Le Facteur (voix sèche) |
| `grandou_hommage.mp3` | Silence solennel 3s + son de vent | — (ambiance) |

---

*Document de conception — Version 2.0 — Mai 2026*
*Opération Cubjac 2026 — GJ Port-Marly — Confidentialité : RÉSERVÉ*
