// state.js
// État global du monde, partagé par toutes les connexions Socket.io.
// Volontairement en mémoire (simple et rapide) : pour une vraie mise en
// production multi-instance, remplacer ce module par une couche Redis
// (voir README, section "Aller plus loin").

const players = new Map(); // socket.id -> { pseudo, x, y, color, zone, lastMoveAt }
let seasonOverride = "auto"; // "auto" | "spring" | "summer" | "autumn" | "winter"

function autoSeason() {
  const m = new Date().getMonth() + 1;
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "autumn";
}

function currentSeason() {
  return seasonOverride === "auto" ? autoSeason() : seasonOverride;
}

function setSeason(value) {
  seasonOverride = value;
}

function publicPlayers() {
  const out = {};
  for (const [id, p] of players.entries()) {
    out[id] = { pseudo: p.pseudo, x: p.x, y: p.y, color: p.color, zone: p.zone };
  }
  return out;
}

module.exports = {
  players,
  publicPlayers,
  currentSeason,
  setSeason,
  get seasonOverride() {
    return seasonOverride;
  },
};
