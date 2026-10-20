# Lineage

A 3D evolution adventure from single cell to galactic core, for one or two players on one keyboard.
Mould your own cell and creature in a mouse-driven editor, then befriend, hunt or explore your way to the stars.

Static site with no build step. Cloudflare Pages serves the repo root as it is (build command empty, output directory `/`).

## Files
| File | Purpose |
|---|---|
| index.html | Page markup and styles, loads the scripts in order |
| js/core.js | Helpers, input, game state, legacies, saves |
| js/audio.js | Synthesised sound effects, ambience and generative music for each stage |
| js/ui.js | Player HUD panes, key-driven menus, the shared modal |
| js/engine.js | Graphics tiers, renderer, split screen, stage flow, discoveries, post-processing |
| js/genome.js | Genes and mutation drafts, the decision cards, the chronicle of story events |
| js/bodies.js | Mouldable bodies: parts, baking, the animated creature |
| js/world.js | Terrain, sky, day and night, water, scenery, wonder landmarks |
| js/editor.js | The cell and creature editor |
| js/stage-*.js | One file per stage: cell, creature, tribe, civ, space |
| js/main.js | Title, pause, ending and the main loop |
| js/mc-tables.js | Marching cubes tables (from three.js examples, MIT licence) |
| three.min.js | three.js r160, bundled locally so the game works offline |
| sw.js | Service worker: offline play and app install |
| manifest.webmanifest, icon.svg | App install details |
| _headers | Cloudflare Pages cache rules |

## Graphics and old laptops
The game picks Low, Medium or High from the graphics chip, then watches the real frame rate. It lowers the
render resolution when frames slow down and drops a tier if that is not enough. Change it in the pause menu
(Auto, Low, Medium, High); the choice is remembered.
Low uses simple shading, soft blob shadows and lighter scenery. High adds real shadows, bloom and a colour grade.

## Sound
Every stage has its own ambient music, made live in the browser so there are no audio files to download. Drums build when you are in danger.
The pause menu sets Music, Effects and Ambience levels separately, and the Sound button mutes everything. Settings are remembered.

## Pace
No stage is a race. Reaching a stage's goal makes your species ready to evolve, and you choose when to go.
In split screen the game moves on once both players have chosen. Once one player has evolved, the other can
follow at any time. Every world hides wonders marked by golden beacons; finding three or more in a stage earns
an Explorer legacy, and every find goes in your journal.

## Controls
Player 1: arrows to move, `/` `.` `;` `'` for moves 1 to 4, Enter to interact or open your main menu, Right Shift for the second menu, target or compass.
Player 2: WASD to move, `F` `G` `R` `T` for moves 1 to 4, E to interact or open your main menu, Q for the second menu, target or compass.
Esc pauses. The editor uses the mouse. Two game controllers play as P1 and P2.

Cell: move 1 dashes, move 3 lunges, Shift or Q opens the cell menu (evolve, editor, accord).
Creature: evolve from your nest. Golden beacons mark wonders worth the walk.
Tribe: evolve from your village menu.
Civilization: fly over the planet, up is always up the screen. Over a city, move 2 sends an army, hold move 4 to inspire it, move 1 opens it to trade or talk. Your compass points at the next city, wonder or home.
Space: fly freely, hold move 3 to boost. At a star, move 1 opens the system. Collect Relics of the First Ones from ruins and empires to open the galactic core.

## Systems that run through every stage
**Genes.** At key moments you pick one mutation from a draft of three: as a cell grows, when a clutch of eggs hatches, when you reach a far wonder, when you catalogue enough alien life. Genes stack and stay with your species to the end. Tolerance genes open the world: Antifreeze Blood lets a creature climb the frozen peaks, keeps a tribe alive through winter and lets a spacefaring people settle ice worlds. Heat Scales let a cell feed at the vents, a creature cross the sulphur fields and a starfaring people live on volcanic worlds.
**The chronicle.** A few times each stage something happens: a virus at the membrane, a storm, a sickness in the huts, a signal from the stars, a distress call. Each is a choice, and some echo forward: answer the signal as a civilization and the empires of the galaxy already know you.
Decisions open in your side menu when you are not in danger. Close one and it waits at the top of your main menu.

## What each stage adds
| Stage | New mechanics |
|---|---|
| Cell | Mutation drafts at 25%, 50% and 75% growth. Engulf any cell under half your size; some survive inside you and become Mitochondria, Chloroplasts or Glow Bodies. Heat Scales turn the vents into food. |
| Creature | Frozen highlands, a sulphur field and a toxic marsh that hurt you without the right gene, each hiding a wonder and a bone pile. Lay eggs at your nest and guard them from thieves; every clutch that hatches adds young to your pack and passes on a mutation you choose. |
| Tribe | Seasons. Autumn harvests are richer, winter stops the fruit and fish while your people eat from your stores. Build a pen and tame wild animals to feed you all year. |
| Civilization | Give each city a focus: farms for spice, barracks for stronger armies and walls, a temple that wins over the cities around it. Story choices here can carry into space. |
| Space | Survey alien life at every star; deeper life needs a better scanner, and every four species offer a mutation. Settle harsh, ice and volcanic worlds with your tolerance genes, or terraform them. Unstable blue stars go supernova: evacuate, keep clear, then harvest the remnant. |

## Two players
Compete with your rival, or form an accord to share allies, revive each other and land team combos.
As rivals you can win a species away from each other, and finish off a downed rival to steal some of their DNA.

Intellectual property of Sidedoor Digital.
