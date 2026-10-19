/* Lineage | stage-space. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== STAGE 5: SPACE (the long voyage) ==============================
   Fly your ship freely across a spiral galaxy. Up always flies up the screen. Stars you have not
   scanned are faint and nameless until you get close. The galactic core is sealed; it opens for a
   species carrying enough Relics of the First Ones, left by an older people who also started in a
   tide pool. Relics lie in ancient ruins (some guarded), and with alien empires who will give one to
   an ally, sell one, or lose one in war. Strange anomalies along the way offer choices and rewards.
   Colonies pay for the voyage; the shipyard at any of your systems upgrades the ship. */
const PLANET_KINDS = { rock: { label: 'Rocky', h: 25 }, ocean: { label: 'Ocean', h: 200 }, ice: { label: 'Ice', h: 190 }, lava: { label: 'Volcanic', h: 8 }, gas: { label: 'Gas giant', h: 280 }, jungle: { label: 'Jungle', h: 110 } };
const STAR_CLASSES = [{ h: 215, s: .8, l: .8, sz: 1.2 }, { h: 48, s: .9, l: .72, sz: 1 }, { h: 28, s: .9, l: .62, sz: .9 }, { h: 6, s: .85, l: .6, sz: .8 }, { h: 0, s: 0, l: .92, sz: .7 }];
const PERSONAS = {
  warlike: { label: 'Warlike', desc: 'Respects a predatory past. Will fight over borders.' },
  trader: { label: 'Traders', desc: 'Likes wealthy, adaptable partners. Will sell almost anything.' },
  zealot: { label: 'Zealots', desc: 'Admires peaceful, cultured species.' },
  scientist: { label: 'Scientists', desc: 'Even-handed and curious. Allies share what they know.' },
};
const SHIP_UP = {
  engine: { name: 'Engines', lv: [0, 150, 320], val: [0, 95, 135, 180], desc: v => `Cruise speed ${v}` },
  hull: { name: 'Hull', lv: [0, 150, 320], val: [0, 200, 320, 460], desc: v => `Hull ${v}` },
  weapons: { name: 'Weapons', lv: [0, 160, 340], val: [0, 16, 26, 40], desc: v => `Firepower ${v}` },
  scanner: { name: 'Scanner', lv: [0, 120, 260], val: [0, 210, 310, 430], desc: v => `Scan range ${v}` },
};
const ANOMALIES = [
  { k: 'ark', name: 'The Drifting Ark', icon: '⛴', lore: 'A vast seed ship, dark and silent, still carrying sleepers.',
    a: { label: 'Wake the sleepers', desc: 'They will settle your nearest free world for you.', go: (st, p, s) => { const t = st.freeWorld(p, s); if (t) { st.colonise(p, t.s, t.pl, true); return `The sleepers found a colony at ${t.s.name}.`; } st.E(p).credits += 120; return 'No free world nearby, so they gave you 120 credits of supplies.'; } },
    b: { label: 'Strip it for parts', desc: '+180 credits.', go: (st, p) => { st.E(p).credits += 180; return '+180 credits.'; } } },
  { k: 'nebula', name: 'The Singing Nebula', icon: '♫', lore: 'A cloud of gas that hums on every radio band at once.',
    a: { label: 'Listen closely', desc: 'Your scanner learns from it. +1 scanner level.', go: (st, p) => { const e = st.E(p); if (e.up.scanner < 3) { e.up.scanner++; return 'Scanner upgraded.'; } e.credits += 120; return 'Your scanner is already perfect: +120 credits instead.'; } },
    b: { label: 'Bottle the gas', desc: '+140 credits.', go: (st, p) => { st.E(p).credits += 140; return '+140 credits.'; } } },
  { k: 'leviathan', name: 'The Star Leviathan', icon: '🐋', lore: 'A creature the size of a moon, grazing on starlight.',
    a: { label: 'Approach in peace', desc: 'It may lead you somewhere.', go: (st, p) => { const r = st.relicSites.find(x => !x.taken); if (r) { r.known[p] = true; for (const o of st.stars) if (Math.hypot(o.x - r.s.x, o.z - r.s.z) < 260) o.known[p] = true; return `It sings a path to ${r.s.name}, where a relic waits.`; } return 'It hums at you kindly and drifts on.'; } },
    b: { label: 'Hunt it', desc: 'A hard fight. Its heart is worth a fortune.', go: (st, p, s) => { st.battle(p, { kind: 'beast', hp: 520, dps: 26, star: s, reward: 400, name: 'the Leviathan' }); return ''; } } },
  { k: 'colony', name: 'The Lost Colony', icon: '⌂', lore: 'Settlers from a species long gone, waving at your ship.',
    a: { label: 'Take them in', desc: 'They join you: a free colony here.', go: (st, p, s) => { const pl = s.planets.find(x => x.T >= 0 && !x.col) || s.planets[0]; st.colonise(p, s, pl, true); st.E(p).stat.allied++; return 'A new colony, and a story your people will tell.'; } },
    b: { label: 'Trade with them', desc: '+120 credits, and they keep their home.', go: (st, p) => { st.E(p).credits += 120; return '+120 credits.'; } } },
  { k: 'beacon', name: 'The Ancient Beacon', icon: '✺', lore: 'A tower on an airless moon, still blinking after a million years.',
    a: { label: 'Decode the signal', desc: 'Reveals the stars around every relic.', go: (st, p) => { for (const r of st.relicSites) { r.known[p] = true; for (const o of st.stars) if (Math.hypot(o.x - r.s.x, o.z - r.s.z) < 160) o.known[p] = true; } return 'Every relic site is now on your map.'; } },
    b: { label: 'Take the power core', desc: '+1 engine level.', go: (st, p) => { const e = st.E(p); if (e.up.engine < 3) { e.up.engine++; return 'Engines upgraded.'; } e.credits += 120; return '+120 credits.'; } } },
  { k: 'wreck', name: 'The Graveyard of Ships', icon: '✝', lore: 'Hulls from a dozen species, all pointed at the core.',
    a: { label: 'Search the wrecks', desc: '+1 hull level and repairs.', go: (st, p) => { const e = st.E(p), q = st.pl[p]; if (e.up.hull < 3) e.up.hull++; else e.credits += 120; q.hp = st.maxHull(p); return 'Your ship is patched with ancient plating.'; } },
    b: { label: 'Salvage the guns', desc: '+1 weapons level.', go: (st, p) => { const e = st.E(p); if (e.up.weapons < 3) { e.up.weapons++; return 'Weapons upgraded.'; } e.credits += 120; return '+120 credits.'; } } },
];
const _sv = new THREE.Vector3(), _sv2 = new THREE.Vector3();
const SpaceStage = {
  idx: 4,
  grade: { bloom: .9, sat: 1.1, vig: .42, th: .7 },
  enter() {
    G.stage = 4; saveGame();
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x03030a);
    sc.add(new THREE.AmbientLight(0x8890c0, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(200, 500, 100); sc.add(dl);
    const seed = G.seed + 5, r = mulberry32(seed); this.t = 0; this.victory = false;
    // stars on three spiral arms, joined so every star is a short hop from another
    const stars = [{ id: 0, x: 0, z: 0, y: 0, core: true, name: 'Galactic Core', planets: [], owner: -1, known: [true, true], visited: [false, false], cls: STAR_CLASSES[0] }];
    const mk = (x, z) => { const cls = STAR_CLASSES[Math.floor(r() * STAR_CLASSES.length)], np = 1 + Math.floor(r() * 4), planets = []; for (let i = 0; i < np; i++) { const kind = ['rock', 'ocean', 'ice', 'lava', 'gas', 'jungle'][Math.floor(r() * 6)], q = r(); planets.push({ kind, T: kind === 'gas' || kind === 'lava' ? -1 : q < .4 ? 0 : 1, col: null }); } return { id: stars.length, x, z, y: (r() - .5) * 30, name: makeName(r, 2) + (r() < .3 ? ' ' + ['Prime', 'Major', 'Minor', 'Reach'][Math.floor(r() * 4)] : ''), cls, planets, owner: -1, known: [false, false], visited: [false, false] }; };
    for (let k = 0; k < 9000 && stars.length < 96; k++) { const arm = Math.floor(r() * 3), d = 320 + Math.pow(r(), .85) * 1350, a = arm * TAU / 3 + d * .0034 + (r() - .5) * .75, x = Math.cos(a) * d, z = Math.sin(a) * d; if (stars.some(s => Math.hypot(s.x - x, s.z - z) < 100)) continue; stars.push(mk(x, z)); }
    stars.forEach((s, i) => s.id = i); this.stars = stars;
    const body = stars.filter(s => !s.core), outer = body.filter(s => Math.hypot(s.x, s.z) > 900), homes = [];
    const far = from => { let best = null, bd = -1; for (const s of outer) { if (from.includes(s)) continue; const d = from.length ? Math.min(...from.map(f => Math.hypot(f.x - s.x, f.z - s.z))) : Math.hypot(s.x, s.z); if (d > bd) { bd = d; best = s; } } return best; };
    homes.push(far([])); while (homes.length < G.mode + 4) homes.push(far(homes));
    this.emps = [];
    for (let p = 0; p < G.mode; p++) {
      const P = G.players[p], h = homes[p]; h.name = P.name + ' Prime'; h.owner = p; h.home = true; h.planets[0] = { kind: 'jungle', T: 1, col: { level: 2 }, homeworld: true };
      this.emps.push({ id: p, player: true, p, name: P.name, hue: P.hue, alive: true, home: h, credits: 400, relics: 0, up: { engine: 1, hull: 1, weapons: 1, scanner: 1 }, stat: { won: 0, colonized: 0, allied: 0, wars: 0 } });
    }
    const personas = Object.keys(PERSONAS).sort(() => r() - .5);
    for (let i = 0; i < 4; i++) {
      const id = G.mode + i, h = homes[id], persona = personas[i];
      const rel = [0, 1].slice(0, G.mode).map(p => { const P = G.players[p]; const base = persona === 'warlike' ? 12 * styleCount(P, 'aggr') - 6 * styleCount(P, 'social') : persona === 'zealot' ? 12 * styleCount(P, 'social') - 6 * styleCount(P, 'aggr') : persona === 'trader' ? 10 * styleCount(P, 'mixed') + (P.mods.econ > 1.15 ? 10 : 0) : 8; return Math.round(clamp(base + (P.mods.social - 1) * 50, -40, 55)); });
      const e = { id, player: false, name: makeName(r, 2) + ' ' + ['Hegemony', 'Compact', 'Choir', 'Collective', 'Dominion', 'Accord'][Math.floor(r() * 6)], hue: (G.players[0].hue + 50 + i * 75) % 360, persona, rel, war: [false, false], pact: [false, false], ally: [false, false], contact: [false, false], alive: true, power: 10, think: 10 + i * 3, home: h, relic: i < 3, raidT: [rand(90, 140), rand(90, 140)] };
      this.emps.push(e); h.owner = id; h.home = true; h.planets[0] = { kind: 'rock', T: 1, col: { level: 2 }, homeworld: true };
      body.filter(s => s.owner < 0 && Math.hypot(s.x - h.x, s.z - h.z) < 380).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)).slice(0, 3 + Math.floor(r() * 2)).forEach(s => this.claim(s, id));
    }
    // relic ruins and anomalies on unclaimed stars, spread out
    const free = () => body.filter(s => s.owner < 0 && !s.relic && !s.anomaly);
    const spread = (list, n, minD) => { const out = []; for (const s of list.sort(() => r() - .5)) { if (out.length >= n) break; if (out.every(o => Math.hypot(o.x - s.x, o.z - s.z) > minD) && this.emps.every(e => Math.hypot(e.home.x - s.x, e.home.z - s.z) > 250)) out.push(s); } return out; };
    this.relicSites = spread(free().filter(s => Math.hypot(s.x, s.z) < 1250), 5, 420).map((s, i) => { s.relic = { s, guard: i < 2 ? 220 + i * 120 : 0, taken: false, known: [false, false] }; return s.relic; });
    spread(free(), ANOMALIES.length, 300).forEach((s, i) => { s.anomaly = { ...ANOMALIES[i], done: [false, false] }; });
    this.relicTotal = this.relicSites.length + this.emps.filter(e => !e.player && e.relic).length;
    for (const s of stars) for (let p = 0; p < G.mode; p++) if (Math.hypot(s.x - this.emps[p].home.x, s.z - this.emps[p].home.z) < 260) s.known[p] = true;
    // discoveries: anomalies and ruins both count as the galaxy's wonders
    Disc.unit = 'ly';
    for (const s of stars) {
      if (s.anomaly) Disc.add({ x: s.x, z: s.z, y: s.y, r: 40, see: 500, far: 0, nameAt: 120, name: s.anomaly.name, lore: s.anomaly.lore, icon: s.anomaly.icon, reward: p => { this.openAnomaly(p, s); return ''; } });
      if (s.relic) Disc.add({ x: s.x, z: s.z, y: s.y, r: 40, see: 500, far: 0, nameAt: 120, name: `Ruins at ${s.name}`, lore: 'Carvings of a tide pool, a cell, a creature, a city, a ship.', icon: '◆', reward: p => { this.takeRelic(p, s.relic, true); return ''; } });
    }
    this.buildVisuals(seed);
    this.pirates = [0, 1, 2].map(() => this.spawnPirate());
    this.pl = [];
    for (let p = 0; p < G.mode; p++) {
      const P = G.players[p], h = this.emps[p].home, g = this.makeShip(P.hue); sc.add(g);
      const pm = []; for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(G_SPH(), stdMat(0xffffff)); m.visible = false; sc.add(m); pm.push(m); }
      const q = { p, x: h.x + 30, z: h.z, y: h.y, vx: 0, vz: 0, a: 0, hp: 0, g, orbit: h, battle: null, planetMeshes: pm, compass: 0, trailT: 0 };
      this.pl.push(q); q.hp = this.maxHull(p);
      Panes[p].build({ eyebrow: 'Stage 5 · Space', title: P.name + ' Voyagers', meters: [{ id: 'hull', label: 'Ship hull', color: 'var(--bio)' }, { id: 'rel', label: 'Relics', color: 'var(--ochre)' }], stats: [{ id: 'cr', label: 'Credits' }, { id: 'col', label: 'Colonies' }, { id: 'ex', label: 'Explored' }, { id: 'won', label: 'Wonders' }] });
      const L = KEYLABEL[p];
      toastP(p, `Fly with ${G.mode === 2 ? L.move : 'the arrows'}: up is always up the screen, hold ${L.a3} to boost. At a star, ${L.a1} opens the system. ${L.back} points your compass at something worth the trip.`);
      toastP(p, `The galactic core is sealed. It opens for a species carrying ${this.need(p)} Relics of the First Ones. Find them in old ruins, or win them from the empires.`);
    }
    this.fx = new FX3(sc, 6);
  },
  /* ---------- visuals ---------- */
  buildVisuals(seed) {
    const sc = this.scene, rr = mulberry32(seed + 1), c = new THREE.Color();
    // backdrop: a gradient sphere with two soft nebula tints, one draw call
    const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float a = pow(max(0.0, dot(vP, normalize(vec3(.6,.2,-.7)))), 6.0), b = pow(max(0.0, dot(vP, normalize(vec3(-.7,-.1,.5)))), 5.0); vec3 col = vec3(.012,.012,.03) + vec3(.28,.08,.32) * a + vec3(.05,.16,.3) * b; gl_FragColor = vec4(col, 1.0); }' }));
    sky.renderOrder = -10; sc.add(sky);
    // galaxy dust along the arms
    const dn = Q.n(5200, 'sky', 1600), dp = new Float32Array(dn * 3), dc = new Float32Array(dn * 3);
    for (let i = 0; i < dn; i++) { const arm = Math.floor(rr() * 3), d = Math.pow(rr(), .7) * 1850, a = arm * TAU / 3 + d * .0034 + (rr() - .5) * 1.0; dp[i * 3] = Math.cos(a) * d; dp[i * 3 + 1] = (rr() - .5) * 70 * (1 - d / 2000) - 30; dp[i * 3 + 2] = Math.sin(a) * d; c.setHSL((.6 + rr() * .28) % 1, .55, .25 + rr() * .35 + (1 - d / 1850) * .2); dc[i * 3] = c.r; dc[i * 3 + 1] = c.g; dc[i * 3 + 2] = c.b; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('color', new THREE.BufferAttribute(dc, 3));
    sc.add(new THREE.Points(dg, new THREE.PointsMaterial({ size: 7, vertexColors: true, map: dotTexture(), transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })));
    const bn = Q.n(2400, 'sky', 700), bp = new Float32Array(bn * 3); for (let i = 0; i < bn; i++) { _sv.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(4200); bp[i * 3] = _sv.x; bp[i * 3 + 1] = _sv.y; bp[i * 3 + 2] = _sv.z; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); sc.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false })));
    // the stars themselves: one glow sprite each, dimmed until scanned
    this.starGlow = this.stars.map(s => { if (s.core) return null; const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color().setHSL(s.cls.h / 360, s.cls.s, s.cls.l), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(s.x, s.y, s.z); m.scale.setScalar(40 * s.cls.sz); sc.add(m);
      const core = new THREE.Mesh(G_SPHL(), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(s.cls.h / 360, s.cls.s * .5, .92) })); core.position.copy(m.position); core.scale.setScalar(4 * s.cls.sz); sc.add(core); return { m, core }; });
    // the core: accretion disc, black hole, and a shell that stays closed until enough relics are carried in
    const cc = document.createElement('canvas'); cc.width = cc.height = 256; const cg = cc.getContext('2d'), gr = cg.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.3, 'rgba(255,230,180,1)'); gr.addColorStop(.55, 'rgba(255,140,80,.7)'); gr.addColorStop(.8, 'rgba(180,90,255,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 256, 256);
    const disk = new THREE.Mesh(new THREE.CircleGeometry(170, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); disk.rotation.x = -Math.PI / 2 + .25; sc.add(disk); this.disk = disk;
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(42, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffcf9a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(900); halo.position.y = -20; sc.add(halo);
    this.shell = new THREE.Mesh(new THREE.IcosahedronGeometry(120, 1), new THREE.MeshBasicMaterial({ color: 0x9f7bff, wireframe: true, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); sc.add(this.shell);
    // territory: a soft disc under every claimed star
    this.terr = this.stars.map(s => { if (s.core) return null; const m = new THREE.Mesh(sharedGeo('terr', () => new THREE.CircleGeometry(90, 28)), new THREE.MeshBasicMaterial({ color: 0xffffff, map: dotTexture(), transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.position.set(s.x, s.y - 4, s.z); m.visible = false; sc.add(m); return m; });
    this.paintAll();
  },
  makeShip(hue) {
    const g = new THREE.Group(), hull = new THREE.Mesh(sharedGeo('spHull', () => new THREE.ConeGeometry(3, 12, 7)), stdMat(col3(hue, .65, .55).getHex(), { metalness: .5, roughness: .3, emissive: col3(hue, .7, .18).getHex() })); hull.rotation.x = Math.PI / 2; g.add(hull);
    const wing = new THREE.Mesh(G_BOX(), stdMat(col3(hue, .45, .78).getHex(), { metalness: .4 })); wing.scale.set(16, .6, 4); wing.position.z = -2; g.add(wing);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: col3(hue, .9, .72), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(12); glow.position.z = -7; g.add(glow);
    return g;
  },
  spawnPirate() {
    const s = pick(this.stars.filter(s => !s.core && s.owner < 0 && !s.relic)), g = new THREE.Group(), m = new THREE.Mesh(sharedGeo('pirate', () => new THREE.OctahedronGeometry(4, 0)), stdMat(0x3a2a2a, { emissive: 0x6a1010, flatShading: true })); m.scale.set(1, .5, 1.6); g.add(m);
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xff4040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); eye.scale.setScalar(10); g.add(eye); this.scene.add(g);
    return { x: s.x + 20, z: s.z, y: s.y, to: null, g, cool: 20, alive: true };
  },
  paintAll() { this.stars.forEach((s, i) => { const m = this.terr[i]; if (!m) return; m.visible = s.owner >= 0; if (s.owner >= 0) m.material.color.copy(col3(this.emps[s.owner].hue, .9, .5)); }); },
  /* ---------- rules ---------- */
  E(p) { return this.emps[p]; },
  need(p) { return G.mode === 1 ? 5 : G.accord ? 6 : 4; },
  relicsFor(p) { return G.accord && G.mode === 2 ? this.emps[0].relics + this.emps[1].relics : this.E(p).relics; },
  maxHull(p) { return SHIP_UP.hull.val[this.E(p).up.hull] * G.players[p].mods.hp; },
  speed(p) { return SHIP_UP.engine.val[this.E(p).up.engine]; },
  scan(p) { return SHIP_UP.scanner.val[this.E(p).up.scanner]; },
  allies(p) { return this.emps.filter(e => !e.player && e.alive && e.ally[p]); },
  dps(p) { return SHIP_UP.weapons.val[this.E(p).up.weapons] * G.players[p].mods.dmg * (1 + .3 * this.allies(p).length + (G.accord && G.mode === 2 ? .25 : 0)); },
  colonies(p) { const out = []; for (const s of this.stars) if (s.owner === p) for (const pl of s.planets) if (pl.col) out.push({ s, pl }); return out; },
  income(p) { let c = 0; for (const { pl } of this.colonies(p)) c += pl.col.level * 1.1; const pacts = this.emps.filter(x => !x.player && x.alive && x.pact[p]).length; return c * G.players[p].mods.econ + pacts * 2 + (G.accord && G.mode === 2 ? 1 : 0); },
  claim(s, id) { s.owner = id; const best = s.planets.find(p => p.T >= 1) || s.planets.find(p => p.T >= 0); if (best) best.col = { level: 1 }; if (this.terr) this.paintAll(); },
  freeWorld(p, from) { let best = null, bd = 1e9; for (const s of this.stars) { if (s.core || (s.owner >= 0 && s.owner !== p)) continue; const pl = s.planets.find(x => x.T >= 1 && !x.col); if (!pl) continue; const d = Math.hypot(s.x - from.x, s.z - from.z); if (d < bd) { bd = d; best = { s, pl }; } } return best; },
  colonise(p, s, pl, free) {
    const e = this.E(p); if (!free) { if (e.credits < 150) return; e.credits -= 150; }
    pl.col = { level: 1 }; s.owner = p; e.stat.colonized++; this.paintAll(); Sfx.good(p); toastP(p, `Colony founded at ${s.name}.`, 'good');
  },
  inOrbit(q) { if (q.battle) return q.battle.star; let best = null, bd = 34; for (const s of this.stars) { const d = Math.hypot(s.x - q.x, s.z - q.z); if (d < bd) { bd = d; best = s; } } return best; },
  battle(p, b) { const q = this.pl[p]; if (q.battle) return; q.battle = { ...b, max: b.hp }; q.vx = q.vz = 0; Sfx.battle(p); toastP(p, `Battle with ${b.name}! ${KEYLABEL[p].back} to retreat.`, 'warn'); },
  endBattle(q, won) {
    const b = q.battle, e = this.E(q.p); q.battle = null; Menus[q.p].close();
    if (!won) { const lost = Math.min(e.credits, 60); e.credits -= lost; toastP(q.p, `Your ship was crippled and towed home. Lost ${Math.round(lost)} credits.`, 'bad'); q.x = e.home.x + 30; q.z = e.home.z; q.y = e.home.y; q.vx = q.vz = 0; q.hp = this.maxHull(q.p) * .4; Sfx.bad(q.p); return; }
    Sfx.good(q.p); e.stat.won++;
    if (b.reward) { e.credits += b.reward; Sfx.coin(q.p); toastP(q.p, `You won. +${b.reward} credits.`, 'good'); }
    if (b.kind === 'pirate') b.pirate.alive = false;
    if (b.kind === 'guard') { b.site.guard = 0; this.takeRelic(q.p, b.site); }
    if (b.kind === 'siege') { const em = b.emp; e.stat.wars++; if (em.relic) { em.relic = false; e.relics++; toastP(q.p, `You took the ${em.name} relic from their homeworld.`, 'good'); this.relicNews(q.p); } em.power = Math.max(4, em.power - 6); toastP(q.p, `The ${em.name} sue for peace.`, 'good'); em.war[q.p] = false; em.rel[q.p] = -20; }
    if (b.kind === 'raid' && b.star && b.emp && b.star.owner === b.emp.id && !b.star.home) {
      const s = b.star, em = b.emp; s.owner = q.p; for (const pl of s.planets) if (pl.col) pl.col.level = 1; this.paintAll(); e.stat.wars++; toastP(q.p, `${s.name} is yours.`, 'good');
      if (em.player) toastP(em.p, `You lost ${s.name} to P${q.p + 1}.`, 'bad'); else { em.power = Math.max(4, em.power - 3); if (!this.stars.some(x => x.owner === em.id)) { em.alive = false; toastAll(`The ${em.name} are no more.`, 'warn'); this.checkFederation(); } }
    }
  },
  /* how a fight would likely go, so nobody flies into a battle they cannot win without warning */
  odds(p, hp, dps) { const win = hp / this.dps(p), lose = this.pl[p].hp / dps; return win < lose * .7 ? 'you should win' : win < lose * 1.1 ? 'a close fight' : 'you would likely lose: upgrade weapons and hull at your shipyard first'; },
  guardDps(site) { return 12 + site.guard * .05; },
  takeRelic(p, site, auto) {
    if (site.taken) { toastP(p, 'The ruins are empty. Someone got here first.'); return; }
    if (site.guard > 0) {
      const o = this.odds(p, site.guard, this.guardDps(site));
      if (auto && o.startsWith('you would')) { toastP(p, `An ancient guardian sleeps in these ruins. It looks too strong for your ship right now. Come back with better weapons and hull, then open the system to face it.`, 'warn'); return; }
      this.battle(p, { kind: 'guard', hp: site.guard, dps: this.guardDps(site), star: site.s, site, name: 'an ancient guardian' }); return;
    }
    site.taken = true; this.E(p).relics++; Sfx.relic(p); this.fx.burst(site.s.x, site.s.y + 10, site.s.z, '#ffd34d', 40, 20, 1.4);
    toastP(p, `You carry a Relic of the First Ones (${this.relicsFor(p)} of ${this.need(p)}).`, 'good'); this.relicNews(p);
  },
  relicNews(p) { if (this.relicsFor(p) >= this.need(p)) { toastP(p, 'The relics hum in unison. The galactic core will open for you. Set your compass on it.', 'good'); this.pl[p].compass = 3; } if (G.mode === 2) toastP(other(p), `P${p + 1} has ${this.E(p).relics} relic${this.E(p).relics === 1 ? '' : 's'}.`); },
  attack(q) {
    const s = this.inOrbit(q); if (!s || q.battle) return; const e = s.owner >= 0 ? this.emps[s.owner] : null;
    if (!e || e.id === q.p) { toastP(q.p, 'Nothing to attack here.'); return; }
    if (e.player && !canHarm()) { toastP(q.p, 'You are in accord with your rival.'); return; }
    if (!e.player) { if (e.ally[q.p]) { toastP(q.p, `The ${e.name} are your allies.`); return; } if (!e.war[q.p]) { e.war[q.p] = true; e.pact[q.p] = false; e.rel[q.p] = Math.min(e.rel[q.p], -40); toastP(q.p, `War with the ${e.name}.`, 'warn'); for (const o of this.emps) if (!o.player && o !== e && o.persona === 'zealot') o.rel[q.p] -= 8; } }
    const home = s.home, hp = 140 + (home ? 260 : 0) + (e.player ? 80 : e.power * 6);
    this.battle(q.p, { kind: home && !e.player ? 'siege' : 'raid', hp, dps: 10 + (e.player ? 10 : e.power * .7) + (home ? 8 : 0), star: s, emp: e, name: `the ${e.name} defences` });
    if (e.player) toastP(e.p, `P${q.p + 1} is attacking ${s.name}!`, 'bad');
  },
  /* ---------- input ---------- */
  onAction(p, act) {
    const q = this.pl[p]; if (!q) return; const s = this.inOrbit(q);
    if (act === 'back') { if (q.battle) { const b = q.battle; q.battle = null; const e = this.E(p); e.credits = Math.max(0, e.credits - 30); q.x += 70; q.vx = 60; toastP(p, 'You break off and run. -30 credits.', 'warn'); if (b.kind === 'pirate') b.pirate.cool = 20; return; } q.compass = (q.compass + 1) % 4; toastP(p, `Compass: ${['the nearest unexplored star', 'the nearest relic you know of', 'home', 'the galactic core'][q.compass]}.`); Sfx.click(p); return; }
    if (act === 'menu') { this.openEmpire(p); return; }
    if (act === 'a3') { Sfx.whoosh(p); return; }
    if (q.battle) return;
    if (act === 'a1') { if (s) this.openSystem(p, s); else toastP(p, 'Fly to a star first.'); return; }
    if (act === 'a2') { const own = s && s.owner >= 0 ? this.emps[s.owner] : null; if (own && own.id !== p) this.openDiplo(p, own); else toastP(p, 'No foreign empire here.'); return; }
    if (act === 'a4') { this.attack(q); return; }
  },
  openAnomaly(p, s) {
    const A = s.anomaly; if (!A || A.done[p]) return; const e = this.E(p);
    Menus[p].open({ eyebrow: 'Anomaly', title: A.name, sub: A.lore, items: () => [
      { label: A.a.label, desc: A.a.desc, onSelect: () => { A.done[p] = true; const m = A.a.go(this, p, s); if (m) toastP(p, m, 'good'); }, close: true },
      { label: A.b.label, desc: A.b.desc, onSelect: () => { A.done[p] = true; const m = A.b.go(this, p, s); if (m) toastP(p, m, 'good'); }, close: true },
      { label: 'Decide later', desc: 'Come back to this star and open the system.', close: true, onSelect: () => {} }] });
  },
  openSystem(p, s) {
    const q = this.pl[p], e = this.E(p);
    if (s.core) { const ok = this.relicsFor(p) >= this.need(p); Menus[p].open({ eyebrow: 'Supermassive black hole', title: 'The Galactic Core', sub: ok ? 'The relics you carry are singing. The shell is opening.' : `Sealed. It opens for ${this.need(p)} relics; you carry ${this.relicsFor(p)}.`, items: [...(ok ? [{ label: 'Enter the core', desc: 'The end of the voyage.', onSelect: () => this.enterCore(p), close: true }] : []), { label: 'Close', close: true, onSelect: () => {} }] }); return; }
    Menus[p].open({ eyebrow: s.owner === p ? 'Your system' : s.owner >= 0 ? this.emps[s.owner].name : 'Unclaimed system', title: s.name, live: true,
      sub: () => `${fmt(e.credits)} credits${s.relic && !s.relic.taken ? ' · ancient ruins here' : ''}${s.anomaly && !s.anomaly.done[p] ? ' · anomaly here' : ''}`,
      items: () => {
        const out = [], mine = s.owner === p || s.owner < 0;
        if (s.relic && !s.relic.taken) out.push({ label: s.relic.guard ? 'Face the ruin guardian' : 'Take the relic', desc: s.relic.guard ? `Something old guards it. Win and the relic is yours. Odds: ${this.odds(p, s.relic.guard, this.guardDps(s.relic))}.` : 'A Relic of the First Ones.', onSelect: () => this.takeRelic(p, s.relic), close: true });
        if (s.anomaly && !s.anomaly.done[p]) out.push({ label: `Deal with ${s.anomaly.name}`, onSelect: () => this.openAnomaly(p, s) });
        s.planets.forEach(pl => { const k = PLANET_KINDS[pl.kind]; out.push({ head: true, label: `${k.label}${pl.homeworld ? ' · homeworld' : ''} · ${pl.T < 0 ? 'cannot live here' : pl.T === 0 ? 'harsh' : 'habitable'}${pl.col ? ' · colony' : ''}` }); if (mine && !pl.col && pl.T >= 1) out.push({ label: 'Found a colony', value: 150, desc: '+1.1 credits a second.', disabled: e.credits < 150, onSelect: () => this.colonise(p, s, pl) }); });
        if (s.owner === p) { out.push({ head: true, label: 'Shipyard' }); for (const k in SHIP_UP) { const U = SHIP_UP[k], lv = e.up[k], c = U.lv[lv]; out.push({ label: `${U.name} ${lv}/3`, value: lv >= 3 ? 'max' : c, desc: lv >= 3 ? U.desc(U.val[lv]) : 'Next: ' + U.desc(U.val[lv + 1]), disabled: lv >= 3 || e.credits < c, onSelect: () => { if (lv >= 3 || e.credits < c) return; e.credits -= c; e.up[k]++; if (k === 'hull') q.hp = this.maxHull(p); Sfx.good(p); } }); } out.push({ label: 'Repair the hull', value: 'free', disabled: q.hp >= this.maxHull(p) - 1, onSelect: () => { q.hp = this.maxHull(p); } }); }
        if (s.owner >= 0 && s.owner !== p) out.push({ label: 'Talk to them', value: KEYLABEL[p].a2, onSelect: () => this.openDiplo(p, this.emps[s.owner]) }, { label: 'Attack this system', value: KEYLABEL[p].a4, onSelect: () => this.attack(q), close: true });
        out.push({ label: 'Close', close: true, onSelect: () => {} }); return out;
      } });
  },
  openDiplo(p, x) {
    const e = this.E(p);
    if (x.player) { Menus[p].open({ eyebrow: 'Rival player', title: x.name, sub: `${x.relics} relics`, items: () => [...accordItem(p), { label: 'Close', close: true, onSelect: () => {} }] }); return; }
    x.contact[p] = true;
    const rivalAlly = G.mode === 2 && x.ally[other(p)] && !G.accord;
    Menus[p].open({ eyebrow: PERSONAS[x.persona].label, title: x.name, live: true,
      sub: () => `${PERSONAS[x.persona].desc} Attitude ${Math.round(x.rel[p])} · ${x.ally[p] ? 'allied' : x.war[p] ? 'at war' : x.pact[p] ? 'trade pact' : 'neutral'}${x.relic ? ' · they keep a relic' : ''}`,
      items: () => x.war[p] ? [
        { label: 'Offer peace', value: 200, disabled: e.credits < 200, onSelect: () => { if (e.credits < 200) return; e.credits -= 200; x.war[p] = false; x.rel[p] = Math.max(x.rel[p], -10); toastP(p, `The ${x.name} accept a ceasefire.`, 'good'); } },
        { label: 'Close', close: true, onSelect: () => {} }] : [
        { label: 'Send a gift', value: 100, disabled: e.credits < 100, onSelect: () => { if (e.credits < 100) return; e.credits -= 100; const g = Math.round(14 * G.players[p].mods.social * (x.persona === 'trader' ? 1.3 : x.persona === 'warlike' ? .7 : 1)); x.rel[p] = Math.min(100, x.rel[p] + g); toastP(p, `Gift accepted. Attitude +${g}.`, 'good'); } },
        ...(!x.pact[p] && !x.ally[p] ? [{ label: 'Trade pact', value: x.rel[p] < 25 ? 'needs 25' : 150, desc: '+2 credits a second, and they warm to you over time.', disabled: e.credits < 150 || x.rel[p] < 25, onSelect: () => { if (e.credits < 150 || x.rel[p] < 25) return; e.credits -= 150; x.pact[p] = true; x.rel[p] += 5; toastP(p, `Trade pact signed with the ${x.name}.`, 'good'); } }] : []),
        ...(!x.ally[p] ? [{ label: 'Form an alliance', value: rivalAlly ? `P${other(p) + 1}'s ally` : x.rel[p] < 70 ? 'needs 70' : '', desc: x.relic ? 'Allies fight beside you, and they will give you their relic.' : 'Allies fight beside you.', disabled: rivalAlly || x.rel[p] < 70, onSelect: () => { if (rivalAlly || x.rel[p] < 70) return; x.ally[p] = true; x.pact[p] = true; e.stat.allied++; Sfx.good(p); toastP(p, `The ${x.name} are now your allies.`, 'good'); if (x.relic) { x.relic = false; e.relics++; toastP(p, `As a sign of friendship, the ${x.name} give you their relic.`, 'good'); this.relicNews(p); } this.checkFederation(); } }] : []),
        ...(x.relic && x.persona === 'trader' && !x.ally[p] ? [{ label: 'Buy their relic', value: 900, desc: 'Traders will sell anything for the right price.', disabled: e.credits < 900, onSelect: () => { if (e.credits < 900 || !x.relic) return; e.credits -= 900; x.relic = false; e.relics++; toastP(p, `You bought the ${x.name} relic.`, 'good'); this.relicNews(p); } }] : []),
        ...(!x.ally[p] ? [{ label: 'Declare war', desc: x.relic ? 'Take their homeworld and their relic is yours.' : '', onSelect: () => { x.war[p] = true; x.pact[p] = false; x.rel[p] = Math.min(x.rel[p], -40); toastP(p, `You declared war on the ${x.name}.`, 'warn'); }, close: true }] : []),
        { label: 'Close', close: true, onSelect: () => {} }] });
  },
  openEmpire(p) {
    const e = this.E(p), q = this.pl[p];
    Menus[p].open({ eyebrow: 'Your empire', title: e.name, live: true, sub: () => `${fmt(e.credits)} credits (+${this.income(p).toFixed(1)}) · ${this.relicsFor(p)} of ${this.need(p)} relics${G.accord && G.mode === 2 ? ' between you' : ''}`,
      items: () => [
        { head: true, label: 'The voyage' },
        { label: 'Relics of the First Ones', value: `${this.relicsFor(p)}/${this.need(p)}`, desc: `${this.relicTotal} exist: ${this.relicSites.length} in ancient ruins, the rest kept by empires. Ally, buy or conquer to get theirs.` },
        { label: 'Compass', value: ['unexplored', 'relic', 'home', 'core'][q.compass], desc: `${KEYLABEL[p].back} cycles where it points.`, onSelect: () => { q.compass = (q.compass + 1) % 4; } },
        { head: true, label: 'Empires' },
        ...this.emps.filter(x => x.id !== p).map(x => ({ label: x.name + (x.player ? ` (P${x.p + 1})` : ''), value: !x.alive ? 'gone' : x.player ? (G.accord ? 'accord' : 'rival') : !x.contact[p] ? 'unknown' : x.ally[p] ? 'ally' : x.war[p] ? 'war' : 'att ' + Math.round(x.rel[p]), desc: x.player ? `${x.relics} relics` : x.contact[p] ? `${PERSONAS[x.persona].label} · ${this.stars.filter(s => s.owner === x.id).length} systems${x.relic ? ' · keeps a relic' : ''}` : 'Fly to one of their stars to make contact.', onSelect: () => { if (x.player || x.contact[p]) this.openDiplo(p, x); } })),
        ...accordItem(p),
        { label: 'Close', close: true, onSelect: () => {} }] });
  },
  enterCore(p) {
    if (this.victory) return; const q = this.pl[p]; if (this.relicsFor(p) < this.need(p)) { toastP(p, 'The shell will not open yet.', 'bad'); return; }
    if (Math.hypot(q.x, q.z) > 90) { toastP(p, 'Fly into the core first.'); return; }
    this.end(G.accord && G.mode === 2 ? 'joint' : 'core', p);
  },
  checkFederation() {
    if (this.victory) return; const alive = this.emps.filter(e => !e.player && e.alive);
    for (const q of this.pl) if (alive.every(e => e.ally[q.p] || (G.accord && G.mode === 2 && e.ally[other(q.p)]))) { this.end('federation', G.accord ? -1 : q.p); return; }
  },
  end(kind, winner) {
    if (this.victory) return; this.victory = true;
    for (let p = 0; p < G.mode; p++) {
      const st = this.E(p).stat, P = G.players[p], style = st.wars > st.allied + 1 ? 'aggr' : st.allied > st.wars ? 'social' : 'mixed'; addLegacy(P, 4, style);
      if (Disc.count(p) >= WANDER_MIN) P.legacies.push({ stage: 4, wander: true, style, title: WANDER[4].title, desc: `${WANDER[4].desc} Found ${Disc.count(p)} wonders.` });
      if (G.accord && G.mode === 2) P.legacies.push({ stage: 4, shared: true, style, title: SHARED.title, desc: SHARED.desc }); recalcMods(P);
    }
    if (G.accord) G.accordStages++; clearSave();
    setTimeout(() => showEnding(kind, winner), 700);
  },
  /* ---------- simulation ---------- */
  update(dt) {
    this.t += dt; this.disk.rotation.z += dt * .15; this.shell.rotation.y += dt * .05;
    const open = this.pl.some(q => this.relicsFor(q.p) >= this.need(q.p)); this.shell.material.opacity = lerp(this.shell.material.opacity, open ? .08 : .35, dt);
    for (const q of this.pl) safely(() => this.updPlayer(q, dt));
    for (const e of this.emps) { if (e.player || !e.alive) continue; e.power += dt * .025; e.think -= dt; if (e.think <= 0) { e.think = rand(12, 18); this.empThink(e); } }
    for (const pr of this.pirates) this.updPirate(pr, dt);
    this.fx.update(dt); WORLD_TIME.value += dt;
    Disc.update(dt, p => { const q = this.pl[p]; return q && !q.battle ? q : null; });
  },
  updPlayer(q, dt) {
    const p = q.p, e = this.E(p), menu = Menus[p].isOpen;
    e.credits += this.income(p) * dt;
    const dir = menu || q.battle ? { x: 0, z: 0, m: 0 } : dirOf(p), boost = held(p, 'a3') && !menu ? 1.8 : 1, sp = this.speed(p) * boost;
    q.vx = lerp(q.vx, dir.x * dir.m * sp, Math.min(1, dt * 3)); q.vz = lerp(q.vz, dir.z * dir.m * sp, Math.min(1, dt * 3));
    if (!q.battle) { q.x += q.vx * dt; q.z += q.vz * dt; }
    const R = Math.hypot(q.x, q.z), sealed = this.relicsFor(p) < this.need(p);
    if (R > 1950) { q.x *= 1950 / R; q.z *= 1950 / R; }
    if (sealed && R < 135) { q.x *= 135 / R; q.z *= 135 / R; if (!q.bumped) { q.bumped = 3; toastP(p, `The core's shell turns you away. It opens for ${this.need(p)} relics.`, 'warn'); } }
    q.bumped = Math.max(0, (q.bumped || 0) - dt);
    const s = this.inOrbit(q); q.y = lerp(q.y, s ? s.y : 0, dt * 2);
    if (Math.hypot(q.vx, q.vz) > 4) q.a = lerpAng(q.a, Math.atan2(q.vz, q.vx), dt * 6);
    // scanning reveals stars; orbiting a star visits it
    const sr = this.scan(p); for (const o of this.stars) if (!o.known[p] && Math.hypot(o.x - q.x, o.z - q.z) < sr) o.known[p] = true;
    if (s && !s.visited[p]) { s.visited[p] = true; if (s.owner >= G.mode) { const em = this.emps[s.owner]; if (!em.contact[p]) { em.contact[p] = true; toastP(p, `First contact: the ${em.name}. ${PERSONAS[em.persona].label}, attitude ${em.rel[p] > 20 ? 'friendly' : em.rel[p] < -20 ? 'hostile' : 'neutral'}.${em.relic ? ' They keep a relic.' : ''}`); } if (em.war[p] && !q.battle) this.battle(p, { kind: 'raid', hp: 90 + em.power * 5, dps: 8 + em.power * .6, star: s, emp: em, name: `a ${em.name} patrol` }); } }
    if (!sealed && R < 70 && !this.victory) this.enterCore(p);
    // repair at friendly stars
    if (s && !q.battle) { const friendly = s.owner === p || (s.owner >= G.mode && this.emps[s.owner].ally[p]); q.hp = Math.min(this.maxHull(p), q.hp + (friendly ? 30 : 3) * dt); }
    if (q.battle) {
      const b = q.battle; b.hp -= this.dps(p) * dt; q.hp -= b.dps * dt; const st = b.star || q;
      if (Math.random() < dt * 14) this.fx.burst(st.x + rand(-30, 30), (st.y || 0) + rand(0, 10), st.z + rand(-30, 30), '#ffb347', 3, 8, .4);
      if (b.hp <= 0) this.endBattle(q, true); else if (q.hp <= 0) this.endBattle(q, false);
    }
    // visuals: ship, trail, planets of the star you orbit
    q.g.position.set(q.x, q.y + 14 + (s ? Math.sin(this.t * 1.5) * 2 : 0), q.z); q.g.rotation.set(0, -q.a + Math.PI / 2, 0);
    q.trailT -= dt; if (Math.hypot(q.vx, q.vz) > 20 && q.trailT <= 0) { q.trailT = .05; this.fx.burst(q.x - Math.cos(q.a) * 9, q.y + 14, q.z - Math.sin(q.a) * 9, hueCss(G.players[p].hue, 80, 70), 1, 3, .7); }
    q.planetMeshes.forEach((m, i) => { const pl = s && !s.core && s.planets[i]; m.visible = !!pl; if (!pl) return; const k = PLANET_KINDS[pl.kind], a = this.t * (.4 - i * .07) + i * 1.7, d = 26 + i * 13; m.position.set(s.x + Math.cos(a) * d, s.y, s.z + Math.sin(a) * d); m.scale.setScalar(pl.kind === 'gas' ? 6 : 3.5); m.material = stdMat(col3(k.h, pl.col ? .7 : .45, pl.T >= 1 ? .5 : .4).getHex(), { roughness: .7 }); });
  },
  updPirate(pr, dt) {
    if (!pr.alive) { pr.cool -= dt; if (pr.cool <= -120) { this.scene.remove(pr.g); Object.assign(pr, this.spawnPirate()); } pr.g.visible = false; return; }
    pr.g.visible = true; pr.cool -= dt;
    let tgt = null, td = 160; for (const q of this.pl) { if (q.battle) continue; const d = Math.hypot(q.x - pr.x, q.z - pr.z); if (d < td && Math.hypot(q.x, q.z) > 150) { td = d; tgt = q; } }
    if (tgt && pr.cool <= 0) { const d = td || 1; pr.x += (tgt.x - pr.x) / d * 70 * dt; pr.z += (tgt.z - pr.z) / d * 70 * dt; if (d < 22) { pr.cool = 25; this.battle(tgt.p, { kind: 'pirate', hp: 110 + this.t * .08, dps: 9 + this.t * .006, star: null, pirate: pr, reward: 100, name: 'pirates' }); } }
    else { if (!pr.to || Math.hypot(pr.to.x - pr.x, pr.to.z - pr.z) < 10) pr.to = pick(this.stars.filter(s => !s.core && s.owner < 0)); const d = Math.hypot(pr.to.x - pr.x, pr.to.z - pr.z) || 1; pr.x += (pr.to.x - pr.x) / d * 35 * dt; pr.z += (pr.to.z - pr.z) / d * 35 * dt; }
    pr.g.position.set(pr.x, 14, pr.z); pr.g.rotation.y += dt;
  },
  empThink(e) {
    const mine = this.stars.filter(s => s.owner === e.id);
    if (mine.length < 5 + this.t / 180 && Math.random() < .6) { let best = null, bd = 380; for (const s of this.stars) { if (s.core || s.owner >= 0 || s.relic || s.anomaly || !s.planets.some(p => p.T >= 1)) continue; for (const m of mine) { const d = Math.hypot(s.x - m.x, s.z - m.z); if (d < bd) { bd = d; best = s; } } } if (best) this.claim(best, e.id); }
    for (let p = 0; p < G.mode; p++) {
      if (e.pact[p]) e.rel[p] = Math.min(100, e.rel[p] + 2); if (e.persona === 'scientist' && !e.war[p]) e.rel[p] = Math.min(100, e.rel[p] + .5);
      if (e.ally[p] && Math.random() < .3) this.E(p).credits += 25;
      if (!e.war[p] && !e.ally[p] && ((e.persona === 'warlike' && e.rel[p] < -20) || e.rel[p] < -55)) { e.war[p] = true; e.pact[p] = false; e.contact[p] = true; toastP(p, `The ${e.name} declare war on you! Their patrols will attack you in their space.`, 'bad'); Sfx.bad(p); }
      // at war they pick off an undefended colony near their border now and then
      if (e.war[p] && (e.raidT[p] -= 15) <= 0) { e.raidT[p] = rand(80, 120); const tg = this.stars.filter(s => s.owner === p && !s.home).sort((a, b) => Math.min(...mine.map(m => Math.hypot(m.x - a.x, m.z - a.z))) - Math.min(...mine.map(m => Math.hypot(m.x - b.x, m.z - b.z))))[0]; if (tg && mine.length && !this.pl[p].battle) { for (const pl of tg.planets) pl.col = null; this.claim(tg, e.id); toastP(p, `The ${e.name} took your colony at ${tg.name}.`, 'bad'); } }
    }
  },
  /* ---------- view ---------- */
  camFor(i, cam, dt) {
    const q = this.pl[i]; if (!q) return; const k = dt ? Math.min(1, dt * 3) : 1, zoom = q.battle ? .75 : 1;
    _tv.set(q.x, q.y + 260 * zoom, q.z + 190 * zoom); cam.position.lerp(_tv, k); cam.up.set(0, 1, 0); cam.lookAt(q.x, q.y, q.z - 30);
  },
  compassTarget(q) {
    const p = q.p, near = list => list.sort((a, b) => Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z))[0];
    if (q.compass === 0) { const s = near(this.stars.filter(s => !s.core && !s.visited[p])); if (s) return { s, label: `◌ ${s.known[p] ? s.name : 'unexplored'}`, col: '#cfc6ff' }; }
    if (q.compass === 1) { const sites = this.relicSites.filter(r => !r.taken && (r.known[p] || r.s.known[p])).map(r => r.s); const s = near(sites.concat(this.emps.filter(e => !e.player && e.relic && e.contact[p]).map(e => e.home))); if (s) return { s, label: `◆ ${s.name}`, col: '#ffd34d' }; return { s: this.stars[0], label: 'no relic known yet', col: '#ffd34d' }; }
    if (q.compass === 2) return { s: this.E(p).home, label: '★ home', col: hueCss(G.players[p].hue) };
    return { s: this.stars[0], label: '◉ core', col: '#b48cff' };
  },
  labels(i) {
    const pane = Panes[i], q = this.pl[i]; if (!q) return; const orbit = this.inOrbit(q);
    const list = this.stars.filter(s => !s.core).map(s => ({ s, d: Math.hypot(s.x - q.x, s.z - q.z) })).filter(o => o.d < 700).sort((a, b) => a.d - b.d).slice(0, 18);
    for (const { s } of list) {
      const v = project(_kv.set(s.x, s.y + 16, s.z), i); if (!v) continue; const own = s.owner >= 0 ? this.emps[s.owner] : null;
      if (!s.known[i]) { pane.label(v.x, v.y, '<small style="color:#6f6890">?</small>'); continue; }
      const tags = (s.relic && !s.relic.taken ? '◆' : '') + (s.anomaly && !s.anomaly.done[i] ? '✺' : '') + (s.home ? '★' : '') + (own && !own.player && own.relic ? '◆' : '');
      pane.label(v.x, v.y, `<span style="color:${own ? hueCss(own.hue, 70, 75) : s.visited[i] ? '#efe9f7' : '#a59fc4'}">${esc(s.name)}${tags ? ` <b style="color:#ffd34d">${tags}</b>` : ''}</span>${s === orbit ? `<small>${own ? esc(own.name) : 'unclaimed'} · ${s.planets.filter(p => p.T >= 1).length} habitable</small>` : ''}`, s === orbit ? 'sel' : '');
    }
    const c = project(_kv.set(0, 60, 0), i); if (c) pane.label(c.x, c.y, `<span style="color:#d9c4ff">Galactic Core</span><small>${this.relicsFor(i) >= this.need(i) ? 'open to you' : `sealed · ${this.relicsFor(i)}/${this.need(i)} relics`}</small>`);
    for (const pr of this.pirates) if (pr.alive && Math.hypot(pr.x - q.x, pr.z - q.z) < 500) { const v = project(_kv.set(pr.x, 30, pr.z), i); if (v) pane.label(v.x, v.y, '<small style="color:#ff6a6a">pirates</small>'); }
    const t = this.compassTarget(q); if (t && t.s && !edgeMark(pane, i, t.s.x, t.s.y + 10, t.s.z, t.label, t.col) && t.s !== orbit) { const v = project(_kv.set(t.s.x, t.s.y - 14, t.s.z), i); if (v) pane.label(v.x, v.y + 34, `<small style="color:${t.col}">▲ compass</small>`); }
    if (G.mode === 2) { const o = this.pl[other(i)], v = project(_kv.set(o.x, o.y + 32, o.z), i); if (v) pane.label(v.x, v.y, `<span style="color:${hueCss(G.players[o.p].hue)}">P${o.p + 1}</span>`); }
    this.fx.labels(i);
  },
  beforeRender(i) {
    const q = this.pl[i]; if (!q) return; const pane = Panes[i], e = this.E(i), s = this.inOrbit(q);
    pane.meter('hull', q.hp, this.maxHull(i)); pane.meter('rel', this.relicsFor(i), this.need(i), `${this.relicsFor(i)} of ${this.need(i)}`);
    pane.stat('cr', `${fmt(e.credits)} +${this.income(i).toFixed(1)}`); pane.stat('col', this.colonies(i).length); pane.stat('ex', `${this.stars.filter(x => x.visited[i]).length}/${this.stars.length - 1}`); pane.stat('won', `${Disc.count(i)}/${Disc.list.length}`);
    const foreign = s && s.owner >= 0 && s.owner !== i;
    pane.acts(q.battle ? [{ act: 'back', label: 'Retreat', hot: true }] : [{ act: 'a1', label: 'System', off: !s, hot: !!s }, { act: 'a2', label: 'Talk', off: !foreign }, { act: 'a4', label: 'Attack', off: !foreign }, { act: 'a3', label: 'Boost' }, { act: 'menu', label: 'Empire' }, { act: 'back', label: 'Compass' }]);
    pane.prompt(q.battle ? `Battle with ${q.battle.name}: enemy ${Math.max(0, Math.round(q.battle.hp))} · your hull ${Math.round(q.hp)}` : s ? (s.core ? 'The galactic core' : `In orbit at ${s.name}${s.owner === i ? ' · shipyard open' : ''}${s.relic && !s.relic.taken ? ` · ruins here, press ${KEYLABEL[i].a1}` : ''}${s.anomaly && !s.anomaly.done[i] ? ` · anomaly, press ${KEYLABEL[i].a1}` : ''}`) : '');
  },
  musicMood() { return this.pl.some(q => q.battle) ? 1 : this.pirates.some(pr => pr.alive && this.pl.some(q => Math.hypot(pr.x - q.x, pr.z - q.z) < 220)) ? .4 : 0; },
  exit() {},
};
