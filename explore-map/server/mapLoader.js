// mapLoader.js
// Charge public/assets/map.json (généré par map-generator/generate_map.py)
// et expose des fonctions de collision utilisées pour valider les
// mouvements envoyés par les clients (anti-triche basique côté serveur).

const fs = require("fs");
const path = require("path");

const MAP_PATH = path.join(__dirname, "..", "public", "assets", "map.json");

function loadMap() {
  const raw = fs.readFileSync(MAP_PATH, "utf-8");
  const data = JSON.parse(raw);
  data.blockingSet = new Set(data.blockingTypes);
  data.worldWidth = data.cols * data.tileSize;
  data.worldHeight = data.rows * data.tileSize;
  return data;
}

let map = loadMap();

function reload() {
  map = loadMap();
  return map;
}

function tileAt(px, py) {
  const c = Math.floor(px / map.tileSize);
  const r = Math.floor(py / map.tileSize);
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) {
    return { t: "water", z: "prairie" };
  }
  return map.tiles[r][c];
}

function isBlocked(px, py) {
  return map.blockingSet.has(tileAt(px, py).t);
}

// Boîte de collision simple (4 coins) autour du point (px,py)
function canStand(px, py, halfSize = 8) {
  if (px < 0 || py < 0 || px > map.worldWidth || py > map.worldHeight) return false;
  const pts = [
    [px - halfSize, py - halfSize],
    [px + halfSize, py - halfSize],
    [px - halfSize, py + halfSize],
    [px + halfSize, py + halfSize],
  ];
  return !pts.some(([x, y]) => isBlocked(x, y));
}

function zoneAt(px, py) {
  return tileAt(px, py).z;
}

module.exports = {
  get map() {
    return map;
  },
  reload,
  tileAt,
  isBlocked,
  canStand,
  zoneAt,
};
