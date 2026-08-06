// server/index.js
// Serveur autoritaire : sert les fichiers statiques (front) et gère le
// temps réel via Socket.io. Le code admin n'est JAMAIS envoyé au client :
// il est vérifié ici, côté serveur.

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const mapLoader = require("./mapLoader");
const state = require("./state");

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || "1238";
const TICK_MS = 100; // fréquence de diffusion de l'état du monde
const MAX_STEP_PX = 12; // distance max acceptée entre deux positions envoyées (anti-triche)

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

function colorFromName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const palette = ["#e8b64b", "#5fb246", "#4aa3d6", "#d94f4f", "#b06fd9", "#e08a2b", "#3fc7c0", "#e05fa0"];
  return palette[h % palette.length];
}

io.on("connection", (socket) => {
  socket.isAdmin = false;

  socket.on("join", ({ pseudo }) => {
    pseudo = String(pseudo || "").trim().slice(0, 12);
    if (pseudo.length < 2) {
      socket.emit("joinError", "invalid_pseudo");
      return;
    }
    const spawn = mapLoader.map.spawns.village;
    state.players.set(socket.id, {
      pseudo,
      x: spawn.x,
      y: spawn.y,
      color: colorFromName(pseudo),
      zone: mapLoader.zoneAt(spawn.x, spawn.y),
      lastMoveAt: Date.now(),
    });
    socket.emit("joined", {
      map: {
        cols: mapLoader.map.cols,
        rows: mapLoader.map.rows,
        tileSize: mapLoader.map.tileSize,
        tiles: mapLoader.map.tiles,
        zones: mapLoader.map.zones,
      },
      spawn,
      season: state.currentSeason(),
      selfId: socket.id,
    });
  });

  // Le client envoie sa position calculée localement (prédiction pour la
  // fluidité) ; le serveur revalide ici et corrige si besoin.
  socket.on("move", ({ x, y }) => {
    const p = state.players.get(socket.id);
    if (!p) return;
    if (typeof x !== "number" || typeof y !== "number") return;

    const dist = Math.hypot(x - p.x, y - p.y);
    const now = Date.now();
    const elapsed = Math.max(16, now - p.lastMoveAt);
    const allowedStep = MAX_STEP_PX * (elapsed / 16); // tolérance selon le temps écoulé

    if (dist > allowedStep || !mapLoader.canStand(x, y)) {
      // mouvement invalide ou trop rapide : on renvoie la position correcte
      socket.emit("correction", { x: p.x, y: p.y });
      return;
    }

    p.x = x;
    p.y = y;
    p.zone = mapLoader.zoneAt(x, y);
    p.lastMoveAt = now;
  });

  socket.on("admin:auth", (code) => {
    if (String(code) === ADMIN_CODE) {
      socket.isAdmin = true;
      socket.emit("admin:authResult", { ok: true });
    } else {
      socket.emit("admin:authResult", { ok: false });
    }
  });

  socket.on("admin:season", (value) => {
    if (!socket.isAdmin) return;
    const valid = ["auto", "spring", "summer", "autumn", "winter"];
    if (!valid.includes(value)) return;
    state.setSeason(value);
    io.emit("season", state.currentSeason());
  });

  socket.on("admin:announce", (text) => {
    if (!socket.isAdmin) return;
    text = String(text || "").slice(0, 140);
    if (!text) return;
    io.emit("announcement", { text, ts: Date.now() });
  });

  socket.on("admin:teleportZone", (zoneName) => {
    if (!socket.isAdmin) return;
    const spawn = mapLoader.map.spawns[zoneName];
    if (!spawn) return;
    const p = state.players.get(socket.id);
    if (!p) return;
    p.x = spawn.x;
    p.y = spawn.y;
    p.zone = zoneName;
    socket.emit("correction", { x: p.x, y: p.y });
  });

  // Admin se téléporte vers la position actuelle d'un joueur.
  socket.on("admin:teleportToPlayer", (targetPseudo) => {
    if (!socket.isAdmin) return;
    const me = state.players.get(socket.id);
    if (!me) return;
    const target = [...state.players.values()].find((p) => p.pseudo === targetPseudo);
    if (!target) {
      socket.emit("admin:actionError", "player_not_found");
      return;
    }
    me.x = target.x;
    me.y = target.y;
    me.zone = target.zone;
    socket.emit("correction", { x: me.x, y: me.y });
  });

  // Admin téléporte un joueur vers sa propre position.
  socket.on("admin:pullPlayer", (targetPseudo) => {
    if (!socket.isAdmin) return;
    const me = state.players.get(socket.id);
    if (!me) return;
    const targetEntry = [...state.players.entries()].find(([, p]) => p.pseudo === targetPseudo);
    if (!targetEntry) {
      socket.emit("admin:actionError", "player_not_found");
      return;
    }
    const [targetId, target] = targetEntry;
    target.x = me.x;
    target.y = me.y;
    target.zone = me.zone;
    io.to(targetId).emit("correction", { x: target.x, y: target.y });
  });

  socket.on("admin:kick", (targetPseudo) => {
    if (!socket.isAdmin) return;
    for (const [id, p] of state.players.entries()) {
      if (p.pseudo === targetPseudo) {
        io.to(id).emit("kicked");
        state.players.delete(id);
        io.sockets.sockets.get(id)?.disconnect(true);
      }
    }
  });

  socket.on("disconnect", () => {
    state.players.delete(socket.id);
  });
});

// Diffusion périodique de l'état du monde à tous les clients connectés.
setInterval(() => {
  io.emit("state", {
    players: state.publicPlayers(),
    season: state.currentSeason(),
    online: state.players.size,
  });
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`Pixel World server listening on http://localhost:${PORT}`);
  console.log(`Admin code: ${ADMIN_CODE === "1238" ? "1238 (défaut — changez ADMIN_CODE en prod)" : "défini via ADMIN_CODE"}`);
});
