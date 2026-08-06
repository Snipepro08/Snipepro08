#!/usr/bin/env bash
# scripts/build.sh — génère la carte (Python) puis démarre le serveur (Node.js)
set -e

echo "→ Génération de la carte (Python)..."
python3 map-generator/generate_map.py --seed "${MAP_SEED:-42}"

echo "→ Installation des dépendances Node.js..."
npm install

echo "→ Démarrage du serveur..."
npm start
