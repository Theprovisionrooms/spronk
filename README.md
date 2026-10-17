# Lineage

A 3D evolution game from single cell to galactic core, for one or two players on one keyboard.

Static site: no build step. Cloudflare Pages serves the repo root as is (build command empty, output directory `/`).

## Files
| File | Purpose |
|---|---|
| index.html | The whole game (HTML, CSS and script) |
| three.min.js | three.js r160, bundled locally so the game works offline |
| sw.js | Service worker: offline play and app install |
| manifest.webmanifest, icon.svg | App install details |
| _headers | Cloudflare Pages cache rules |

## Controls
Player 1: arrows to move, `/ . ; '` for actions 1 to 4, Enter for menus, Right Shift to go back.
Player 2: WASD to move, `F G R T` for actions 1 to 4, E for menus, Q to go back.
Esc pauses. In one-player mode both sets work.

Intellectual property of Sidedoor Digital.
