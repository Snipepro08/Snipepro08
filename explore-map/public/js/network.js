// network.js — toute la communication temps réel avec le serveur Node.js
const Net = {
  socket: null,
  onJoined: null,
  onState: null,
  onCorrection: null,
  onSeason: null,
  onAnnouncement: null,
  onKicked: null,
  onAdminAuthResult: null,
  onAdminActionError: null,
};

function connect() {
  Net.socket = io(); // servi automatiquement par le paquet socket.io côté serveur

  Net.socket.on("joined", (payload) => Net.onJoined && Net.onJoined(payload));
  Net.socket.on("state", (payload) => Net.onState && Net.onState(payload));
  Net.socket.on("correction", (payload) => Net.onCorrection && Net.onCorrection(payload));
  Net.socket.on("season", (season) => Net.onSeason && Net.onSeason(season));
  Net.socket.on("announcement", (payload) => Net.onAnnouncement && Net.onAnnouncement(payload));
  Net.socket.on("kicked", () => Net.onKicked && Net.onKicked());
  Net.socket.on("admin:authResult", (r) => Net.onAdminAuthResult && Net.onAdminAuthResult(r));
  Net.socket.on("admin:actionError", (err) => Net.onAdminActionError && Net.onAdminActionError(err));

  return new Promise((resolve, reject) => {
    Net.socket.on("connect", resolve);
    Net.socket.on("connect_error", reject);
  });
}

function join(pseudo) {
  Net.socket.emit("join", { pseudo });
}
function sendMove(x, y) {
  Net.socket.emit("move", { x, y });
}
function adminAuth(code) {
  Net.socket.emit("admin:auth", code);
}
function adminSetSeason(value) {
  Net.socket.emit("admin:season", value);
}
function adminAnnounce(text) {
  Net.socket.emit("admin:announce", text);
}
function adminTeleport(zone) {
  Net.socket.emit("admin:teleportZone", zone);
}
function adminTeleportToPlayer(pseudo) {
  Net.socket.emit("admin:teleportToPlayer", pseudo);
}
function adminPullPlayer(pseudo) {
  Net.socket.emit("admin:pullPlayer", pseudo);
}
function adminKick(pseudo) {
  Net.socket.emit("admin:kick", pseudo);
}
