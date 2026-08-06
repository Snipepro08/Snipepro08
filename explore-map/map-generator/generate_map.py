#!/usr/bin/env python3
"""
generate_map.py
----------------
Génère procéduralement la carte du monde (grille de tuiles + zones)
et l'exporte en JSON, consommé aussi bien par le serveur Node.js
(pour la validation des collisions) que par le client JS (pour l'affichage).

Usage:
    python3 generate_map.py [--seed 42] [--out ../public/assets/map.json]
"""

import argparse
import json
import random
import os

TILE_SIZE = 24
COLS, ROWS = 50, 38

# Zones rectangulaires : (col_min, row_min, col_max, row_max)
ZONES = {
    "village": {"c1": 2,  "r1": 2,  "c2": 18, "r2": 11},
    "city":    {"c1": 24, "r1": 2,  "c2": 48, "r2": 15},
    "forest":  {"c1": 2,  "r1": 16, "c2": 22, "r2": 35},
    "beach":   {"c1": 26, "r1": 20, "c2": 48, "r2": 36},
}

BLOCKING_TYPES = {"building", "tree", "water", "hut"}


def in_zone(col, row, z):
    return z["c1"] <= col <= z["c2"] and z["r1"] <= row <= z["r2"]


def build_grid(seed):
    rng = random.Random(seed)
    # table de hasard pré-tirée pour rester déterministe indépendamment
    # de l'ordre d'appel (chaque tuile tire sa propre valeur via une seed dérivée)
    def tile_rand(col, row):
        r = random.Random(f"{seed}:{col}:{row}")
        return r.random()

    grid = []
    for row in range(ROWS):
        line = []
        for col in range(COLS):
            zone = "prairie"
            tile = "grass"

            if in_zone(col, row, ZONES["village"]):
                zone = "village"
                tile = "hut" if tile_rand(col, row) > 0.87 else "grass"
            elif in_zone(col, row, ZONES["city"]):
                zone = "city"
                tile = "road" if (col % 4 == 0 or row % 4 == 0) else "building"
            elif in_zone(col, row, ZONES["forest"]):
                zone = "forest"
                tile = "tree" if tile_rand(col, row) > 0.62 else "grass"
            elif in_zone(col, row, ZONES["beach"]):
                zone = "beach"
                if col >= 44:
                    tile = "water"
                elif tile_rand(col, row) > 0.93:
                    tile = "palm"
                else:
                    tile = "sand"

            line.append({"t": tile, "z": zone})
        grid.append(line)
    return grid


def build_spawns():
    """Un point de spawn au centre de chaque zone, en pixels."""
    spawns = {}
    for name, z in ZONES.items():
        col = (z["c1"] + z["c2"]) // 2
        row = (z["r1"] + z["r2"]) // 2
        spawns[name] = {"x": col * TILE_SIZE, "y": row * TILE_SIZE}
    return spawns


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(__file__), "..", "public", "assets", "map.json"),
    )
    args = parser.parse_args()

    grid = build_grid(args.seed)

    data = {
        "tileSize": TILE_SIZE,
        "cols": COLS,
        "rows": ROWS,
        "seed": args.seed,
        "blockingTypes": sorted(BLOCKING_TYPES),
        "zones": ZONES,
        "spawns": build_spawns(),
        "tiles": grid,  # tiles[row][col] = {"t": type, "z": zone}
    }

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    print(f"Carte générée : {out_path}")
    print(f"  {COLS}x{ROWS} tuiles, seed={args.seed}")


if __name__ == "__main__":
    main()
