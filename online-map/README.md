# 🗺️ Pixel World — carte multijoueur en pixel art

Un monde persistant vu de dessus, en pixel art, avec de vrais joueurs connectés
en temps réel via WebSocket. Trois langages, chacun à sa place :

| Langage | Rôle |
|---|---|
| **Python** | génère la carte (zones, tuiles, collisions) → `public/assets/map.json` |
| **Node.js (JavaScript)** | serveur temps réel autoritaire (Express + Socket.io) : positions, saisons, admin |
| **JavaScript navigateur** | rendu Canvas pixel art, i18n, entrées clavier |

Le code admin (**1238**) n'est plus jamais envoyé au navigateur : il est
vérifié côté serveur (`server/index.js`), donc impossible à lire dans le
code source de la page — contrairement à une version 100% front.

## Arborescence du dépôt (quoi mettre où sur GitHub)

```
pixel-world/                     ← racine du dépôt
├── README.md
├── package.json                 ← dépendances Node (express, socket.io) + scripts npm
├── Dockerfile                   ← build multi-étapes (Python → Node) pour déployer
├── docker-compose.yml           ← lancer le tout avec `docker compose up`
├── .gitignore                   ← exclut node_modules/, .env, __pycache__/
├── scripts/
│   └── build.sh                 ← génère la carte puis démarre le serveur (usage local)
│
├── map-generator/                ← 🐍 TOUT LE PYTHON VIT ICI
│   └── generate_map.py           ← génère public/assets/map.json (zones, tuiles, spawns)
│
├── server/                       ← 🟩 TOUT LE BACKEND NODE.JS VIT ICI
│   ├── index.js                  ← Express + Socket.io, boucle réseau, routes admin
│   ├── state.js                  ← état en mémoire : joueurs connectés, saison courante
│   └── mapLoader.js              ← charge map.json, calcule les collisions serveur
│
└── public/                       ← 🟦 TOUT LE FRONTEND (servi tel quel par Express) VIT ICI
    ├── index.html                ← page unique, écran de connexion + écran de jeu
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── i18n.js                ← charge les fichiers de public/locales/*.json
    │   ├── network.js             ← client Socket.io (émission/réception des events)
    │   ├── render.js              ← dessin des tuiles et des joueurs sur le <canvas>
    │   └── main.js                ← boucle de jeu, clavier, panneau admin
    ├── locales/
    │   ├── fr.json
    │   ├── en.json
    │   ├── ur.json                ← ourdou
    │   └── arz.json               ← arabe égyptien
    └── assets/
        └── map.json               ← généré par map-generator/, NE PAS éditer à la main
```

**Règle simple :** un nouveau fichier Python → toujours dans `map-generator/`.
Un nouveau fichier serveur/réseau → toujours dans `server/`. Tout ce qui
s'affiche dans le navigateur → toujours dans `public/`.

## Installation et lancement

```bash
git clone <votre-repo>
cd pixel-world

# 1. Génère la carte avec Python (aucune dépendance externe, stdlib uniquement)
python3 map-generator/generate_map.py

# 2. Installe les dépendances Node et lance le serveur
npm install
npm start
```

Puis ouvrez `http://localhost:3000`. Le code admin par défaut est **1238**
(modifiable via la variable d'environnement `ADMIN_CODE`).

### Panneau admin

- Une fois le code entré avec succès, il est mémorisé (`sessionStorage`) pour
  l'onglet du navigateur : plus besoin de le retaper tant que l'onglet reste
  ouvert (il faut le refaire après une fermeture d'onglet, car
  `sessionStorage` est propre à chaque onglet).
- **Se téléporter vers un joueur** : entrez son pseudo pour rejoindre sa
  position actuelle.
- **Téléporter un joueur vers moi** : entrez son pseudo pour le faire
  apparaître à votre position (utile pour rassembler un groupe).
- Ces deux actions, comme le reste du panneau, sont vérifiées côté serveur
  (`server/index.js`) : impossible d'y accéder sans avoir validé le code
  admin sur le socket en cours.

Raccourci équivalent aux deux commandes ci-dessus :
```bash
./scripts/build.sh
```

### Avec Docker

```bash
docker compose up --build
```

## Fonctionnalités de jeu

- **Un seul lobby** : tous les joueurs connectés au serveur partagent le
  même monde (pas de salons séparés) — visible dans le HUD ("🌐 Lobby principal").
- **Liste des joueurs en ligne** : appuyez sur **G** en jeu pour afficher/masquer
  la liste des joueurs connectés (pseudo, couleur, zone actuelle).
- **Décor détaillé** : fleurs et cailloux sur l'herbe, champignons en forêt,
  arbres qui se balancent, réverbères et fenêtres allumées en ville, fumée
  de cheminée dans les cabanes, coquillages sur la plage — tout est généré de
  façon déterministe (identique pour tous les joueurs) à partir des
  coordonnées de la tuile.
- **Personnage animé** : léger rebond de marche et regard orienté selon la
  direction de déplacement.

## Ce qui rend le multijoueur solide

- **Prédiction côté client** : votre personnage réagit instantanément aux
  flèches (pas d'attente réseau).
- **Validation côté serveur** : chaque mouvement envoyé est revérifié dans
  `mapLoader.canStand()` (collisions) et borné en vitesse
  (`MAX_STEP_PX` dans `server/index.js`) pour empêcher la téléportation ou
  le passage à travers les murs via un client modifié.
- **Diffusion à 10 Hz** (`TICK_MS`) : tous les clients reçoivent la position
  de tout le monde toutes les 100 ms.

## Aller plus loin

- Remplacer `server/state.js` (Map en mémoire) par **Redis** pour supporter
  plusieurs instances du serveur derrière un load balancer.
- Régénérer une carte différente : `python3 map-generator/generate_map.py --seed 7`.
- Ajouter une langue : dupliquer `public/locales/fr.json`, traduire les clés,
  puis ajouter le code dans `LANG_CODES` (`public/js/i18n.js`).
