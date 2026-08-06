// render.js — dessin de la carte et des joueurs sur le <canvas>

const PALETTES = {
  spring: { grass: "#7ec850", grass2: "#8fd863", tree: "#4a934a", trunk: "#5c4326", water: "#4aa3d6", sand: "#e6cf8f", roof: "#c0503f", flower: ["#e97fb0", "#f2e14a", "#ffffff"] },
  summer: { grass: "#5fb236", grass2: "#6fc244", tree: "#2e7d32", trunk: "#4a3420", water: "#2f8fc9", sand: "#e8d189", roof: "#c0503f", flower: ["#f2c14a", "#e8544a", "#ffffff"] },
  autumn: { grass: "#c9a227", grass2: "#b98a1f", tree: "#c66a1f", trunk: "#4a3420", water: "#3a7fa8", sand: "#d8bd7d", roof: "#8a3e2b", flower: ["#e0662a", "#b5401e", "#8a5a1f"] },
  winter: { grass: "#eef2f5", grass2: "#e2e9ee", tree: "#e8f0ee", trunk: "#3a2c1a", water: "#a9c9dd", sand: "#e4e9ec", roof: "#6f7a85", flower: [] },
};

// Hasard déterministe (col,row,salt) -> [0,1) : identique sur tous les clients
function hash01(c, r, salt) {
  let x = Math.sin(c * 127.1 + r * 311.7 + salt * 74.3) * 43758.5453;
  return x - Math.floor(x);
}

function makeRenderer(canvas, mapData) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const TILE = mapData.tileSize;
  const COLS = mapData.cols, ROWS = mapData.rows;
  const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;
  let camX = 0, camY = 0;
  let season = "spring";

  function setSeason(s) { season = s; }

  function drawTile(x, y, col, row, tile, pal) {
    switch (tile.t) {
      case "grass": case "prairie":
        ctx.fillStyle = ((col + row) % 2 === 0) ? pal.grass : pal.grass2;
        ctx.fillRect(x, y, TILE, TILE);
        drawGrassDecor(x, y, col, row, tile, pal);
        break;
      case "road":
        ctx.fillStyle = "#6b6b6b"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#7c7c7c"; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = "#8f8f52";
        if (row % 4 === 0) { ctx.fillRect(x + TILE / 2 - 1, y, 2, TILE); }
        if (col % 4 === 0) { ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2); }
        if (col % 8 === 0 && row % 8 === 0) drawLamppost(x, y);
        break;
      case "building":
        drawBuilding(x, y, col, row, pal);
        break;
      case "hut":
        ctx.fillStyle = pal.grass; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#8a6a45"; ctx.fillRect(x + 3, y + 10, TILE - 6, TILE - 12);
        ctx.fillStyle = "#5a4530"; ctx.fillRect(x + TILE / 2 - 3, y + TILE - 9, 6, 5); // porte
        ctx.fillStyle = "#cfe8f0"; ctx.fillRect(x + 5, y + 13, 3, 3); // fenêtre
        ctx.fillStyle = pal.roof; ctx.beginPath();
        ctx.moveTo(x + 1, y + 10); ctx.lineTo(x + TILE / 2, y + 1); ctx.lineTo(x + TILE - 1, y + 10);
        ctx.closePath(); ctx.fill();
        if (season === "winter") { ctx.fillStyle = "#f4f8fb"; ctx.fillRect(x + 2, y + 8, TILE - 4, 2); }
        drawSmoke(x + TILE / 2 + 6, y);
        break;
      case "tree":
        ctx.fillStyle = pal.grass; ctx.fillRect(x, y, TILE, TILE);
        drawTree(x, y, col, row, pal);
        break;
      case "palm":
        ctx.fillStyle = pal.sand; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "#8a6a35"; ctx.fillRect(x + TILE / 2 - 2, y + 8, 4, 14);
        ctx.fillStyle = pal.tree; ctx.beginPath();
        ctx.arc(x + TILE / 2, y + 8, 7, 0, Math.PI * 2); ctx.fill();
        break;
      case "sand":
        ctx.fillStyle = pal.sand; ctx.fillRect(x, y, TILE, TILE);
        if (hash01(col, row, 5) > 0.9) {
          ctx.fillStyle = "#fff6e0";
          ctx.beginPath(); ctx.arc(x + TILE * 0.4, y + TILE * 0.6, 2, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case "water":
        ctx.fillStyle = pal.water; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255,.18)";
        ctx.fillRect(x + 2, y + ((Date.now() / 300 + x) % TILE | 0), TILE - 4, 2);
        break;
    }
  }

  function drawGrassDecor(x, y, col, row, tile, pal) {
    const h = hash01(col, row, 1);
    if (tile.z === "forest") {
      if (h > 0.88 && pal.flower.length) { // champignon
        ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2 - 2, 3, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#f2ede1"; ctx.fillRect(x + TILE / 2 - 1, y + TILE / 2 - 1, 2, 3);
      } else if (h > 0.78) {
        ctx.fillStyle = "#5c4326"; ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, 2, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    if (h > 0.9 && pal.flower.length) {
      const fc = pal.flower[Math.floor(hash01(col, row, 2) * pal.flower.length)];
      ctx.fillStyle = fc;
      const fx = x + 6 + hash01(col, row, 3) * (TILE - 12);
      const fy = y + 6 + hash01(col, row, 4) * (TILE - 12);
      ctx.fillRect(fx, fy, 2, 2); ctx.fillRect(fx - 2, fy + 2, 2, 2); ctx.fillRect(fx + 2, fy + 2, 2, 2);
    } else if (h > 0.83) {
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.beginPath(); ctx.arc(x + TILE * 0.3, y + TILE * 0.7, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTree(x, y, col, row, pal) {
    const sway = Math.sin(Date.now() / 900 + col * 0.7) * 1.2;
    ctx.fillStyle = pal.trunk; ctx.fillRect(x + TILE / 2 - 2, y + TILE - 10, 4, 8);
    ctx.fillStyle = pal.tree;
    ctx.beginPath(); ctx.arc(x + TILE / 2 + sway, y + TILE / 2 - 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + TILE / 2 - 5 + sway, y + TILE / 2 + 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + TILE / 2 + 5 + sway, y + TILE / 2 + 2, 6, 0, Math.PI * 2); ctx.fill();
  }

  function drawBuilding(x, y, col, row, pal) {
    ctx.fillStyle = "#3c3c46"; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = season === "winter" ? "#dfe6ea" : "#55556a";
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    const lit = hash01(col, row, 6) > 0.5;
    ctx.fillStyle = lit ? "#f2d98a" : "#20202a";
    ctx.fillRect(x + 5, y + 8, 4, 4);
    ctx.fillStyle = !lit ? "#f2d98a" : "#20202a";
    ctx.fillRect(x + TILE - 9, y + 8, 4, 4);
    if (season === "winter") { ctx.fillStyle = "#eef4f7"; ctx.fillRect(x + 1, y + 1, TILE - 2, 2); }
  }

  function drawLamppost(x, y) {
    ctx.fillStyle = "#2c2c2c";
    ctx.fillRect(x + TILE / 2 - 1, y + 4, 2, TILE - 8);
    ctx.fillStyle = "#f6e29b";
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(246,226,155,.25)";
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + 4, 7, 0, Math.PI * 2); ctx.fill();
  }

  function drawSmoke(x, y) {
    const t = Date.now() / 500;
    for (let i = 0; i < 3; i++) {
      const o = (t + i * 0.8) % 3;
      ctx.fillStyle = `rgba(230,230,230,${0.5 - o * 0.15})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(o) * 3, y - o * 6, 2 + o, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayer(px, py, color, pseudo, anim) {
    const bob = anim && anim.moving ? Math.sin(Date.now() / 110) * 2 : 0;
    const sx = px - camX, sy = py - camY + bob;

    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(sx, py - camY + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = color;
    ctx.fillRect(sx - 7, sy - 10, 14, 18);
    ctx.fillStyle = "#f2d9b8";
    ctx.fillRect(sx - 5, sy - 18, 10, 9);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.strokeRect(sx - 7, sy - 10, 14, 18);

    // yeux, orientés selon la direction du regard
    if (anim && anim.facing) {
      const ex = anim.facing.x || 0;
      ctx.fillStyle = "#1b1b22";
      ctx.fillRect(sx - 3 + ex, sy - 15, 2, 2);
      ctx.fillRect(sx + 1 + ex, sy - 15, 2, 2);
    }

    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "#000";
    ctx.strokeText(pseudo, sx, sy - 22);
    ctx.fillStyle = "#fff";
    ctx.fillText(pseudo, sx, sy - 22);
  }

  function render(me, others, animState) {
    const pal = PALETTES[season] || PALETTES.spring;
    camX = Math.max(0, Math.min(WORLD_W - canvas.width, me.x - canvas.width / 2));
    camY = Math.max(0, Math.min(WORLD_H - canvas.height, me.y - canvas.height / 2));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(COLS, Math.ceil((camX + canvas.width) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(ROWS, Math.ceil((camY + canvas.height) / TILE) + 1);

    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        drawTile(c * TILE - camX, r * TILE - camY, c, r, mapData.tiles[r][c], pal);
      }
    }

    Object.values(others).forEach((p) => {
      drawPlayer(p.x, p.y, p.color, p.pseudo, null);
    });
    drawPlayer(me.x, me.y, me.color, me.pseudo, animState);
  }

  return { render, setSeason, WORLD_W, WORLD_H };
}
