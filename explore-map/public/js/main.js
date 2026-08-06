// main.js — orchestre i18n, réseau, rendu et la boucle de jeu

const BLOCKING = new Set(["building", "tree", "water", "hut"]);
const SPEED = 2.6;

let me = { pseudo: "", x: 0, y: 0, color: "#e8b64b" };
let others = {};
let keys = {};
let mapData = null;
let renderer = null;
let isAdmin = false;
let kicked = false;
let lastAnnounceTs = 0;
let facing = { x: 0, y: 1 }; // direction du regard, pour l'animation
let moving = false;
let onlineListOpen = false;

const ADMIN_SS_AUTHED = "pw_admin_authed";
const ADMIN_SS_CODE = "pw_admin_code";
let pendingAdminCode = "";
let manualAdminAuthPending = false;

function tileAt(px, py) {
  const c = Math.floor(px / mapData.tileSize), r = Math.floor(py / mapData.tileSize);
  if (c < 0 || r < 0 || c >= mapData.cols || r >= mapData.rows) return { t: "water", z: "prairie" };
  return mapData.tiles[r][c];
}
function canStand(px, py) {
  const size = 8;
  const pts = [[px - size, py - size], [px + size, py - size], [px - size, py + size], [px + size, py + size]];
  return !pts.some(([x, y]) => BLOCKING.has(tileAt(x, y).t));
}

function update() {
  let dx = 0, dy = 0;
  if (keys.ArrowUp) dy -= SPEED;
  if (keys.ArrowDown) dy += SPEED;
  if (keys.ArrowLeft) dx -= SPEED;
  if (keys.ArrowRight) dx += SPEED;
  if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

  moving = dx !== 0 || dy !== 0;
  if (moving) facing = { x: Math.sign(dx), y: Math.sign(dy) || (dx === 0 ? facing.y : 0) };

  if (dx !== 0 && canStand(me.x + dx, me.y)) me.x += dx;
  if (dy !== 0 && canStand(me.x, me.y + dy)) me.y += dy;

  me.x = Math.max(4, Math.min(renderer.WORLD_W - 4, me.x));
  me.y = Math.max(4, Math.min(renderer.WORLD_H - 4, me.y));
}

let lastSent = 0;
function maybeSendMove() {
  const now = Date.now();
  if (now - lastSent > 66) { // ~15 envois/s
    sendMove(me.x, me.y);
    lastSent = now;
  }
}

function loop() {
  if (!kicked) {
    update();
    maybeSendMove();
    renderer.render(me, others, { moving, facing });
    document.getElementById("hudZone").textContent = t(tileAt(me.x, me.y).z);
    if (onlineListOpen) renderOnlineList();
  }
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement && document.activeElement.tagName;
  const typingInField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
  keys[e.key] = true;

  if ((e.key === "g" || e.key === "G") && !e.repeat && !typingInField) {
    toggleOnlineList();
  }
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

function toggleOnlineList() {
  onlineListOpen = !onlineListOpen;
  const panel = document.getElementById("onlineListPanel");
  panel.style.display = onlineListOpen ? "block" : "none";
  if (onlineListOpen) renderOnlineList();
}

function renderOnlineList() {
  const ul = document.getElementById("onlineListItems");
  ul.innerHTML = "";

  const rows = [{ pseudo: me.pseudo, color: me.color, zone: tileAt(me.x, me.y).z, self: true }];
  Object.values(others).forEach((p) => rows.push({ pseudo: p.pseudo, color: p.color, zone: p.zone, self: false }));
  rows.sort((a, b) => (b.self - a.self) || a.pseudo.localeCompare(b.pseudo));

  rows.forEach((r) => {
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = r.color;
    li.appendChild(swatch);
    const name = document.createElement("span");
    name.textContent = r.pseudo;
    li.appendChild(name);
    if (r.self) {
      const you = document.createElement("span");
      you.className = "youTag";
      you.textContent = "(" + t("you") + ")";
      li.appendChild(you);
    }
    const zone = document.createElement("span");
    zone.className = "zoneTag";
    zone.textContent = t(r.zone);
    li.appendChild(zone);
    ul.appendChild(li);
  });
}

/* ---------------------------- Connexion / login ---------------------------- */

function colorFromName(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const palette = ["#e8b64b", "#5fb246", "#4aa3d6", "#d94f4f", "#b06fd9", "#e08a2b", "#3fc7c0", "#e05fa0"];
  return palette[h % palette.length];
}

async function boot() {
  await loadLocales();
  applyI18n();

  const playBtn = document.getElementById("playBtn");
  playBtn.disabled = true;
  playBtn.textContent = t("connecting");

  try {
    await connect();
  } catch (e) {
    document.getElementById("loginError").textContent = t("connectError");
    return;
  }

  playBtn.disabled = false;
  playBtn.textContent = t("play");

  // Si cet onglet s'était déjà authentifié en admin, on revalide auprès du
  // nouveau socket sans redemander le code (persistance "tant que l'onglet
  // n'est pas fermé", via sessionStorage).
  const savedCode = sessionStorage.getItem(ADMIN_SS_CODE);
  if (sessionStorage.getItem(ADMIN_SS_AUTHED) === "1" && savedCode) {
    pendingAdminCode = savedCode;
    manualAdminAuthPending = false;
    adminAuth(savedCode);
  }

  Net.onJoined = ({ map, spawn, season, selfId }) => {
    mapData = map;
    me.x = spawn.x;
    me.y = spawn.y;
    const canvas = document.getElementById("game");
    renderer = makeRenderer(canvas, mapData);
    renderer.setSeason(season);
    document.getElementById("gameScreen").style.display = "flex";
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("hudPseudo").textContent = me.pseudo;
    loop();
  };

  Net.onState = ({ players, season, online }) => {
    others = {};
    Object.entries(players).forEach(([id, p]) => {
      if (id !== Net.socket.id) others[id] = p;
    });
    renderer && renderer.setSeason(season);
    document.getElementById("hudSeason").textContent = t(season);
    document.getElementById("hudOnline").textContent = online;
  };

  Net.onCorrection = ({ x, y }) => { me.x = x; me.y = y; };

  Net.onAnnouncement = ({ text, ts }) => {
    if (ts === lastAnnounceTs) return;
    lastAnnounceTs = ts;
    const bar = document.getElementById("announceBar");
    bar.textContent = "📢 " + text;
    bar.style.display = "block";
    clearTimeout(bar._t);
    bar._t = setTimeout(() => (bar.style.display = "none"), 6000);
  };

  Net.onKicked = () => {
    kicked = true;
    document.getElementById("kickMsgText").textContent = t("kicked");
    document.getElementById("kickMsgBox").style.display = "flex";
  };

  Net.onAdminAuthResult = ({ ok }) => {
    if (ok) {
      isAdmin = true;
      sessionStorage.setItem(ADMIN_SS_AUTHED, "1");
      sessionStorage.setItem(ADMIN_SS_CODE, pendingAdminCode);
      document.getElementById("adminCodeOverlay").style.display = "none";
      if (manualAdminAuthPending) {
        document.getElementById("adminPanel").style.display = "flex";
      }
    } else {
      sessionStorage.removeItem(ADMIN_SS_AUTHED);
      sessionStorage.removeItem(ADMIN_SS_CODE);
      if (manualAdminAuthPending) {
        document.getElementById("adminCodeError").textContent = t("adminWrong");
      }
    }
    manualAdminAuthPending = false;
  };

  Net.onAdminActionError = (err) => {
    if (err === "player_not_found") {
      document.getElementById("adminGoToError").textContent = t("noPlayerFound");
      document.getElementById("adminPullError").textContent = t("noPlayerFound");
    }
  };

  playBtn.addEventListener("click", startGame);
  document.getElementById("pseudoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });
}

function startGame() {
  const val = document.getElementById("pseudoInput").value.trim();
  if (val.length < 2 || val.length > 12) {
    document.getElementById("loginError").textContent = t("errPseudo");
    return;
  }
  me.pseudo = val;
  me.color = colorFromName(val);
  join(val);
}

/* ---------------------------- Panneau admin ---------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const adminCodeOverlay = document.getElementById("adminCodeOverlay");
  const adminPanel = document.getElementById("adminPanel");

  document.getElementById("adminOpenBtn").addEventListener("click", () => {
    if (isAdmin) {
      adminPanel.style.display = "flex";
      return;
    }
    document.getElementById("adminCodeInput").value = "";
    document.getElementById("adminCodeError").textContent = "";
    adminCodeOverlay.style.display = "flex";
    setTimeout(() => document.getElementById("adminCodeInput").focus(), 50);
  });
  document.getElementById("adminCodeCancel").addEventListener("click", () => {
    adminCodeOverlay.style.display = "none";
  });
  document.getElementById("adminCodeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("adminCodeSubmit").click();
  });
  document.getElementById("adminCodeSubmit").addEventListener("click", () => {
    const code = document.getElementById("adminCodeInput").value.trim();
    pendingAdminCode = code;
    manualAdminAuthPending = true;
    adminAuth(code);
  });
  document.getElementById("adminPanelClose").addEventListener("click", () => {
    adminPanel.style.display = "none";
  });
  document.getElementById("adminSeasonSelect").addEventListener("change", (e) => {
    adminSetSeason(e.target.value);
  });
  document.querySelectorAll("#adminPanel .zoneBtns button").forEach((b) => {
    b.addEventListener("click", () => adminTeleport(b.dataset.zone));
  });
  document.getElementById("adminMsgSend").addEventListener("click", () => {
    const input = document.getElementById("adminMsgInput");
    if (!input.value.trim()) return;
    adminAnnounce(input.value.trim());
    input.value = "";
  });
  document.getElementById("adminKickBtn").addEventListener("click", () => {
    const input = document.getElementById("adminKickInput");
    if (!input.value.trim()) return;
    adminKick(input.value.trim());
    input.value = "";
  });
  document.getElementById("adminGoToBtn").addEventListener("click", () => {
    const input = document.getElementById("adminGoToInput");
    document.getElementById("adminGoToError").textContent = "";
    if (!input.value.trim()) return;
    adminTeleportToPlayer(input.value.trim());
  });
  document.getElementById("adminPullBtn").addEventListener("click", () => {
    const input = document.getElementById("adminPullInput");
    document.getElementById("adminPullError").textContent = "";
    if (!input.value.trim()) return;
    adminPullPlayer(input.value.trim());
  });

  boot();
});
