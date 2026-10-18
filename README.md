# Lineage

A 3D evolution game from single cell to galactic core, for one or two players on one keyboard.
Mould your own cell and creature in a mouse-driven editor, then befriend or hunt your way to the stars.

Static site with no build step. Cloudflare Pages serves the repo root as it is (build command empty, output directory `/`).

## Files
| File | Purpose |
|---|---|
| index.html | The whole game (HTML, CSS and script) |
| three.min.js | three.js r160, bundled locally so the game works offline |
| sw.js | Service worker: offline play and app install |
| manifest.webmanifest, icon.svg | App install details |
| _headers | Cloudflare Pages cache rules |

## Controls
Player 1: arrows to move, `/` attack, `.` special, `;` greet, `'` jump or dodge, Enter to interact (nest, dig, invite, revive), Right Shift to switch target.
Player 2: WASD to move, `F` attack, `G` special, `R` greet, `T` jump or dodge, E to interact, Q to switch target.
During a duet the four move keys become sing, dance, charm and pose. Movement follows the camera.
In the cell stage: move 1 dashes, move 3 lunges, and in an accord move 4 sends your partner DNA.
Esc pauses. The editor uses the mouse. Two game controllers play as P1 and P2.

## Two players
Race your rival to the end of each stage, or form an accord to share allies, revive each other and land team combos.
As rivals you can win a species away from each other, and finish off a downed rival to steal some of their DNA.

Intellectual property of Sidedoor Digital.
