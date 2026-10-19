/* Lineage | stage-tribe. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== STAGE 3: TRIBE (chieftains lead their people) ============================== */
const TRIBE_TOOLS = [
  { k: 'spear', name: 'Spears', max: 3, costs: [40, 70, 110], desc: 'Members hit harder. Your chief can throw spears.' },
  { k: 'horn', name: 'Horns and drums', max: 3, costs: [40, 70, 110], desc: 'Needed to perform. Each level wins tribes over faster.' },
  { k: 'herb', name: 'Healing herbs', max: 2, costs: [35, 60], desc: 'More health and faster healing at home.' },
  { k: 'torch', name: 'Torches', max: 1, costs: [30], desc: 'Night beasts keep away from your village and your people.' },
  { k: 'net', name: 'Fishing nets', max: 1, costs: [35], desc: 'Members can fish at the shore, which is faster than picking fruit.' },
];
const TRIBE_GOAL = 2;
const TribeStage = {
  idx: 2,
  enter() {
    G.stage = 2; saveGame();
    this.pal = worldPalette(G.seed + 2);
    const sc = this.scene = new THREE.Scene(); sc.fog = new THREE.FogExp2(this.pal.fog, .005);
    this.sky = makeSky(sc, this.pal.skyTop, this.pal.skyBot); this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a3020, 1); sc.add(this.hemi);
    this.sun = sunLight(sc, 0xfff2dd, 2.4, 140);
    const seed = G.seed + 3, r = mulberry32(seed); this.t = 0;
    const homes = G.mode === 2 ? [{ x: -70, z: 30 }, { x: 70, z: 30 }] : [{ x: 0, z: 30 }];
    const base = r() * TAU, tribeSpots = [0, 1, 2, 3].map(i => { const a = base + i * TAU / 4 + .4, d = 175 + r() * 25; return { x: Math.cos(a) * d, z: Math.sin(a) * d }; });
    this.wonders = wonderSites(r, 5, ['stones', 'arch', 'skytree', 'springs', 'spire', 'ribs', 'floaters', 'shrooms'], 120, 235, [...homes, ...tribeSpots].map(f => ({ ...f, r: 34 })));
    this.T = buildTerrain(sc, seed, { size: 640, seg: 160, water: 0, flat: [...[...homes, ...tribeSpots].map(f => ({ ...f, r: 22, h: 3.5 })), ...this.wonders.map(w => ({ ...w, r: 17, h: 4.5 }))], trees: 340, palette: this.pal });
    this.day = new DayNight(sc, this.sky, this.sun, this.hemi, 300, this.pal); this.day.t = 300 * .25; this.wfx = new WorldFX(sc, this.T, this.pal, this.sun, this.day);
    this.H = (x, z) => this.T.ground(x, z); this.fx = new FX3(sc, .7);
    for (const w of this.wonders) { const K = WONDER_KINDS[w.kind], lm = makeLandmark(w.kind, this.pal, r), y = this.T.h(w.x, w.z); lm.g.position.set(w.x, y, w.z); lm.g.rotation.y = r() * TAU; sc.add(lm.g); Disc.add({ x: w.x, z: w.z, y, r: 24, name: K.name, lore: K.lore, icon: K.icon, beacon: lm.beacon, spin: lm.spin, reward: p => this.wonderReward(p, w.kind) }); }
    this.units = []; this.villages = []; this.spears = []; this.pvp = false; this.bushes = []; this.fish = [];
    // fruit & fish
    const bushGeo = sharedGeo('bush', () => new THREE.IcosahedronGeometry(1.6, 1)), fruitM = stdMat(0xff5f9e, { emissive: 0x501030, roughness: .4 });
    for (let k = 0; k < 900 && this.bushes.length < 70; k++) { const x = (r() * 2 - 1) * 240, z = (r() * 2 - 1) * 240; if (this.T.isWater(x, z) || this.T.slopeAt(x, z) > .5) continue; const g = new THREE.Group(); g.position.set(x, this.T.h(x, z) + 1, z); const m = new THREE.Mesh(bushGeo, stdMat(0x2f6b3a, { flatShading: true })); m.castShadow = true; g.add(m); const fr = []; for (let f = 0; f < 4; f++) { const fm = new THREE.Mesh(G_SPHL(), fruitM); fm.scale.setScalar(.35); fm.position.set(Math.cos(f * 1.6) * 1.3, .4 + (f % 2) * .5, Math.sin(f * 1.6) * 1.3); g.add(fm); fr.push(fm); } sc.add(g); this.bushes.push({ x, z, fruit: 6, fr }); }
    for (let k = 0; k < 4000 && this.fish.length < 14; k++) { const x = (r() * 2 - 1) * 240, z = (r() * 2 - 1) * 240, h = this.T.h(x, z); if (h < .3 || h > 1.6 || this.fish.some(f => Math.hypot(f.x - x, f.z - z) < 30)) continue; const ring = new THREE.Mesh(sharedGeo('ring2', () => new THREE.RingGeometry(1.4, 1.8, 24)), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .6, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .15, z); sc.add(ring); this.fish.push({ x, z, ring, stock: 10 }); }
    // villages
    tribeSpots.forEach((s, i) => { const body = genBody(r, { details: 1 }); const v = this.makeVillage({ id: i + 1, x: s.x, z: s.z, owner: -1, hue: body.paint.h1, body, name: makeName(r), temper: ['proud', 'wary', 'friendly', 'wary'][i] }); for (let k = 0; k < 5; k++) this.addUnit({ k: 'tribe', id: v.id }, v.x + rand(-10, 10), v.z + rand(-10, 10), body, 1); });
    // players
    this.pl = [];
    for (let p = 0; p < G.mode; p++) {
      const P = G.players[p]; if (!P.body || P.body.kind !== 'creature') P.body = starterCreature(P);
      const v = this.makeVillage({ id: 10 + p, x: homes[p].x, z: homes[p].z, owner: p, hue: P.hue, body: P.body, name: P.name });
      const q = { p, food: 60, tools: { spear: 0, horn: 0, herb: 0, torch: 0, net: 0 }, hutLvl: 1, village: v, spearCd: 0, birthT: 0 };
      this.pl.push(q);
      q.chief = this.addUnit({ k: 'player', p }, v.x, v.z - 12, P.body, 1.4); q.chief.isChief = true; this.addHeaddress(q.chief, P.hue2 ?? (P.hue + 150));
      for (let k = 0; k < 4; k++) { const u = this.addUnit({ k: 'player', p }, v.x + rand(-8, 8), v.z + rand(-8, 8), P.body, 1); u.state = 'follow'; }
      for (const pet of (P.pets || [])) { const u = this.addUnit({ k: 'player', p }, v.x + rand(-6, 6), v.z + rand(-6, 6), pet.body, (pet.k || 1) * .8); u.pet = pet.name; u.state = 'follow'; u.maxhp = u.hp = u.hp * 1.6; u.dmg *= 1.4; }
      if ((P.pets || []).length) toastP(p, `Your ${P.pets.map(x => x.name).join(' and ')} allies followed you into the tribal age.`, 'good');
      Panes[p].build({ eyebrow: 'Stage 3 · Tribe', title: 'The ' + P.name + ' tribe', meters: [{ id: 'chief', label: 'Chief', color: 'var(--membrane)' }, { id: 'vil', label: 'Village', color: 'var(--ochre)' }, { id: 'uni', label: 'Unity', color: 'var(--violet)' }], stats: [{ id: 'food', label: 'Food' }, { id: 'pop', label: 'People' }, { id: 'tools', label: 'Tools' }, { id: 'won', label: 'Wonders' }] });
      toastP(p, `Lead your people with your chief. ${KEYLABEL[p].a1} commands whatever you are standing near: fruit, fish, prey, enemies or a rival village. Unite ${TRIBE_GOAL} of the 4 tribes${G.mode === 2 ? ' (an accord with your rival counts as one)' : ''}. Golden beacons mark old places worth leading your people to.`);
    }
    this.animalBodies = [genBody(r, { diet: 'herb', details: 0 }), genBody(r, { diet: 'herb', details: 1 })];
    for (let i = 0; i < 16; i++) this.spawnAnimal();
  },
  makeVillage(v) {
    const g = new THREE.Group(), y = this.T.ground(v.x, v.z); g.position.set(v.x, y, v.z); this.scene.add(g);
    const wall = stdMat(col3(v.hue, .22, .5).getHex()), roof = stdMat(col3(v.hue, .45, .32).getHex(), { flatShading: true }), dark = stdMat(0x2a1e18), wood = stdMat(0x7a5a3e, { roughness: .9 });
    /* a ring of round huts with doors facing the fire, a palisade of stakes, and the totem off to one side so it never hides the chief */
    const huts = []; for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + .4, hg = new THREE.Group(); hg.position.set(Math.cos(a) * 11, 0, Math.sin(a) * 11); hg.rotation.y = -a - Math.PI / 2;
      const b = new THREE.Mesh(sharedGeo('hutWall', () => new THREE.CylinderGeometry(2.5, 2.8, 2.6, 10)), wall); b.position.y = 1.3; b.castShadow = true; hg.add(b);
      const rf = new THREE.Mesh(sharedGeo('hutRoof', () => new THREE.ConeGeometry(3.5, 3.4, 10)), roof); rf.position.y = 4.1; rf.castShadow = true; hg.add(rf);
      const door = new THREE.Mesh(G_BOX(), dark); door.scale.set(1.1, 1.7, .3); door.position.set(0, .85, 2.62); hg.add(door);
      const tip = new THREE.Mesh(G_CYL(), wood); tip.scale.set(.12, 1.4, .12); tip.position.y = 6.2; hg.add(tip);
      g.add(hg); huts.push(hg);
    }
    const nStakes = Q.n(34, 'detail', 20), stakes = new THREE.InstancedMesh(G_CYL(), wood, nStakes), dm = new THREE.Object3D();
    for (let k = 0; k < nStakes; k++) { const a = k / nStakes * TAU; if (Math.abs(angDiff(a, Math.PI / 2)) < .28) { dm.scale.set(0, 0, 0); } else { const h = 2 + (k % 3) * .35; dm.position.set(Math.cos(a) * 18.5, h / 2 - .2, Math.sin(a) * 18.5); dm.scale.set(.32, h, .32); dm.rotation.set(0, 0, (k % 2 - .5) * .12); } dm.updateMatrix(); stakes.setMatrixAt(k, dm.matrix); }
    stakes.castShadow = Q.tier === 'high'; g.add(stakes);
    const totem = new THREE.Group(); for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(G_CYL(), stdMat(col3(v.hue + k * 40, .5, .45).getHex())); m.scale.set(.6, 1.6, .6); m.position.y = .8 + k * 1.6; totem.add(m); } const wing = new THREE.Mesh(G_BOX(), stdMat(col3(v.hue, .6, .6).getHex())); wing.scale.set(3, .4, .25); wing.position.y = 4.6; totem.add(wing); totem.position.set(-6, 0, 6); g.add(totem);
    const stones = new THREE.Mesh(sharedGeo('fireRing', () => new THREE.TorusGeometry(1.5, .35, 4, 10)), stdMat(0x6a6460, { flatShading: true })); stones.rotation.x = Math.PI / 2; stones.position.set(0, .2, 0); g.add(stones);
    const fire = new THREE.Mesh(sharedGeo('fire', () => new THREE.ConeGeometry(1, 2.2, 6)), new THREE.MeshBasicMaterial({ color: 0xffa040 })); fire.position.set(0, 1.1, 0); g.add(fire);
    /* point lights make every lit material in the scene more expensive, so only High gets real firelight, and only at the players' villages */
    const light = Q.tier === 'high' && v.owner >= 0 ? new THREE.PointLight(0xff9a40, 0, 40, 1.5) : new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xff9a40, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    if (light.isSprite) { light.scale.setScalar(16); light.intensity = 0; } light.position.set(0, 3, 0); g.add(light);
    Object.assign(v, { g, huts, fire, light, hp: v.owner >= 0 ? 400 : 320, maxhp: v.owner >= 0 ? 400 : 320, rel: [28, 28], war: [false, false], by: -1, how: '', raidT: [130 + rand(0, 40), 150 + rand(0, 40)], warn: [0, 0], giftT: 0, torch: false });
    if (v.temper === 'proud') v.rel = [14, 14]; if (v.temper === 'friendly') v.rel = [40, 40];
    for (let p = 0; p < G.mode; p++) v.rel[p] = Math.min(60, v.rel[p] * G.players[p].mods.social);
    this.villages.push(v); return v;
  },
  addHeaddress(u, hue) { const hg = u.cr.bones[0], r = u.cr.B.sp[0].r; for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(G_CONE(), stdMat(col3(hue + k * 25, .7, .6).getHex())); f.scale.set(r * .12, r * .9, r * .12); f.position.set(-r * .2, r * .9, (k - 2) * r * .25); f.rotation.x = (k - 2) * .25; f.rotation.z = .4; hg.add(f); } },
  side(u) { return u.side; },
  ustats(side, scale) {
    if (side.k === 'player') { const P = G.players[side.p], q = this.pl && this.pl[side.p], ab = abilities(P.body), st = { hp: (55 + ab.A.health * 22 + ab.vol * 40) * P.mods.hp, bite: (5 + (ab.A.bite + ab.A.strike) * 4) * P.mods.dmg, speed: (5.5 + ab.A.speed * 1.5) * (ab.legs ? 1 : .6) }, t = q ? q.tools : { spear: 0, herb: 0 }; return { hp: (st.hp * .55 + t.herb * 18) * scale, dmg: (st.bite * .6 + t.spear * 5 * P.mods.dmg) * scale, speed: st.speed * .85 }; }
    if (side.k === 'wild') return { hp: 70 * scale, dmg: 4 * scale, speed: 9 };
    if (side.k === 'beast') return { hp: 220, dmg: 16, speed: 11 };
    const v = this.villages.find(x => x.id === side.id), tough = v && v.temper === 'proud' ? 1.25 : 1; return { hp: 60 * tough, dmg: 7 * tough, speed: 10.5 };
  },
  baked(body) { if (!this.cache) this.cache = new Map(); if (!this.cache.has(body)) this.cache.set(body, bakeBody(body, { res: .095 })); return this.cache.get(body); },
  addUnit(side, x, z, body, scale) {
    const st = this.ustats(side, scale), cr = new Creature(this.baked(body), scale, { shadow: side.k === 'player' && Math.random() < .6 }); this.scene.add(cr.group);
    const u = { side, cr, x, z, a: rand(0, TAU), wa: rand(0, TAU), hp: st.hp, maxhp: st.hp, dmg: st.dmg, speed: st.speed, state: 'idle', target: null, cd: 0, carry: 0, flash: 0, act: 0, scale };
    cr.update(0, x, z, u.a, this.H); this.units.push(u); return u;
  },
  spawnAnimal() { let x, z, k = 0; do { x = rand(-230, 230); z = rand(-230, 230); k++; } while (k < 30 && (this.T.isWater(x, z) || this.villages.some(v => Math.hypot(v.x - x, v.z - z) < 60))); const u = this.addUnit({ k: 'wild' }, x, z, pick(this.animalBodies), rand(.9, 1.3)); u.home = { x, z }; },
  refreshOwn(p) { for (const u of this.units) if (u.side.k === 'player' && u.side.p === p && !u.pet) { const st = this.ustats(u.side, u.scale), f = u.hp / u.maxhp; u.maxhp = st.hp; u.hp = st.hp * f; u.dmg = st.dmg; } },
  own(p) { return this.units.filter(u => u.side.k === 'player' && u.side.p === p && !u.dead); },
  followers(p) { return this.own(p).filter(u => !u.isChief); },
  cap(q) { return 6 + q.hutLvl * 3; },
  villageOf(u) { return u.side.k === 'tribe' ? this.villages.find(v => v.id === u.side.id) : u.side.k === 'player' ? this.pl[u.side.p].village : null; },
  hostile(a, b) {
    const A = a.side, B = b.side; if (a === b) return false;
    if (A.k === 'beast' || B.k === 'beast') return A.k !== B.k;
    if (A.k === 'wild' || B.k === 'wild') return false;
    if (A.k === 'player' && B.k === 'player') return A.p !== B.p && this.pvp && canHarm();
    const pl = A.k === 'player' ? A : B.k === 'player' ? B : null; if (!pl) return false;
    const tr = A.k === 'tribe' ? A : B; const v = this.villages.find(x => x.id === tr.id); if (!v || v.by >= 0) return false; return v.war[pl.p];
  },
  united(p) { return this.villages.filter(v => v.owner < 0 && v.by === p).length + (G.accord && G.mode === 2 ? 1 : 0); },
  /* ---------- context & input ---------- */
  context(q) {
    const c = q.chief; if (!c || c.dead) return null;
    for (const v of this.villages) if (v !== q.village && Math.hypot(v.x - c.x, v.z - c.z) < 26) return { kind: 'village', v };
    let best = null, bd = 12; for (const u of this.units) { if (u.dead || u === c || (u.side.k === 'player' && u.side.p === q.p)) continue; const d = Math.hypot(u.x - c.x, u.z - c.z); if (d < bd && (u.side.k === 'wild' || this.hostile(c, u) || (u.side.k === 'player' && canHarm()) || u.side.k === 'beast')) { bd = d; best = u; } }
    if (best) return { kind: best.side.k === 'wild' ? 'hunt' : 'attack', u: best };
    if (q.tools.net) for (const f of this.fish) if (f.stock > 0 && Math.hypot(f.x - c.x, f.z - c.z) < 12) return { kind: 'fish', f };
    for (const b of this.bushes) if (b.fruit >= 1 && Math.hypot(b.x - c.x, b.z - c.z) < 10) return { kind: 'gather', b };
    if (Math.hypot(q.village.x - c.x, q.village.z - c.z) < 24) return { kind: 'home' };
    return null;
  },
  onAction(p, act) {
    const q = this.pl[p]; if (!q || q.chief.dead) return;
    if (act === 'menu') { this.openVillage(p); return; }
    if (act === 'a2') { for (const u of this.followers(p)) { u.state = 'follow'; u.target = null; } toastP(p, 'Your people rally to you.'); Sfx.click(p); return; }
    if (act === 'a3') { this.throwSpear(q); return; }
    if (act === 'a4') { const ctx = this.context(q); if (ctx && ctx.kind === 'village') this.perform(q, ctx.v); else toastP(p, 'Stand in a rival village to perform for it.'); return; }
    if (act !== 'a1') return;
    const ctx = this.context(q); if (!ctx) { toastP(p, 'Nothing here to command. Walk up to fruit, fish, prey, enemies or a village.'); return; }
    const fl = this.followers(p);
    if (ctx.kind === 'village') { if (ctx.v.owner >= 0) this.openRivalHome(p, ctx.v); else this.openTribe(p, ctx.v); }
    else if (ctx.kind === 'hunt' || ctx.kind === 'attack') { if (ctx.u.side.k === 'player' && !this.pvp) { if (!canHarm()) { toastP(p, 'You are in accord with your rival.'); return; } this.pvp = true; toastAll(`P${p + 1} attacked P${other(p) + 1}'s people. The tribes are at war.`, 'warn'); } for (const u of fl) { u.state = 'fight'; u.target = ctx.u; } q.chief.state = 'fight'; q.chief.target = ctx.u; q.chief.manual = 2; }
    else if (ctx.kind === 'gather') { for (const u of fl) { u.state = 'gather'; u.target = null; u.spot = ctx.b; } toastP(p, 'Your people gather fruit.'); }
    else if (ctx.kind === 'fish') { for (const u of fl) { u.state = 'fish'; u.spot = ctx.f; } toastP(p, 'Your people fish.'); }
    else if (ctx.kind === 'home') this.openVillage(p);
    Sfx.click(p);
  },
  throwSpear(q) {
    if (!q.tools.spear) { toastP(q.p, 'Make spears at your village first.', 'bad'); return; } if (q.spearCd > 0) return; q.spearCd = 1.4;
    const c = q.chief, y = c.cr.head().y + .5, m = new THREE.Mesh(G_CYL(), stdMat(0xc9a77a)); m.scale.set(.08, 2.4, .08); this.scene.add(m);
    this.spears.push({ x: c.x, y, z: c.z, vx: Math.cos(c.a) * 38, vz: Math.sin(c.a) * 38, vy: 3, m, life: 1.2, owner: c, dmg: (14 + q.tools.spear * 8) * G.players[q.p].mods.dmg });
    Sfx.tone(500, .1, 'triangle', .03, .5, Sfx.pan(q.p));
  },
  perform(q, v) {
    if (v.owner >= 0 || v.by >= 0) return; if (!q.tools.horn) { toastP(q.p, 'Make horns and drums first.', 'bad'); return; } if (v.war[q.p]) { toastP(q.p, 'They will not listen while you are at war.', 'bad'); return; }
    for (const u of this.followers(q.p)) { u.state = 'perform'; u.spot = v; } q.performing = v; toastP(q.p, `Your tribe performs for the ${v.name}. Stay close to keep the music going.`);
  },
  openTribe(p, v) {
    const q = this.pl[p];
    Menus[p].open({ eyebrow: `Rival tribe · ${v.temper}`, title: 'The ' + v.name, live: true,
      sub: () => v.by >= 0 ? (v.by === p ? `${v.how === 'allied' ? 'Allied with' : 'Conquered by'} you.` : `${v.how === 'allied' ? 'Allied with' : 'Conquered by'} P${v.by + 1}.`) : `Friendship ${Math.round(v.rel[p])}% · village ${Math.round(v.hp)}/${v.maxhp}${v.war[p] ? ' · at war with you' : ''}`,
      items: () => v.by >= 0 ? [{ label: 'Leave', close: true, onSelect: () => {} }] : [
        { label: 'Send a gift', value: '30 food', desc: 'Raises friendship. Proud tribes are harder to impress.', disabled: q.food < 30, onSelect: () => { if (q.food < 30) return; q.food -= 30; const g = Math.round(12 * G.players[p].mods.social * (v.temper === 'proud' ? .7 : 1)); v.rel[p] = Math.min(100, v.rel[p] + g); if (v.war[p] && v.rel[p] >= 40) { v.war[p] = false; toastP(p, `The ${v.name} accept peace.`, 'good'); } this.fx.text(v.x, 8, v.z, `+${g} friendship`, '#a6d96a', p); Sfx.good(p); } },
        { label: 'Perform for them', value: KEYLABEL[p].a4, desc: q.tools.horn ? 'Your people play music here. Friendship climbs while they play.' : 'Needs horns and drums from your village.', disabled: !q.tools.horn || v.war[p], onSelect: () => this.perform(q, v), close: true },
        { label: 'Raid their village', desc: 'War with this tribe. Burn the village to take its people. Other tribes like you less.', onSelect: () => { v.war[p] = true; v.rel[p] = 0; for (const o of this.villages) if (o !== v && o.owner < 0) o.rel[p] = Math.max(0, o.rel[p] - 10); for (const u of this.followers(p)) { u.state = 'raid'; u.spot = v; } toastP(p, `Your warriors march on the ${v.name}.`, 'warn'); }, close: true },
        { label: 'Leave', close: true, onSelect: () => {} },
      ] });
  },
  openRivalHome(p, v) {
    Menus[p].open({ eyebrow: 'Rival player', title: 'The ' + v.name + ' village', sub: () => `Village ${Math.round(v.hp)}/${v.maxhp}`, live: true, items: () => [
      ...(canHarm() ? [{ label: 'Raid their village', desc: 'War between your tribes. Damage their village to steal food.', onSelect: () => { this.pvp = true; for (const u of this.followers(p)) { u.state = 'raid'; u.spot = v; } toastAll(`P${p + 1} is raiding P${v.owner + 1}!`, 'warn'); }, close: true }] : []),
      ...accordItem(p), { label: 'Leave', close: true, onSelect: () => {} }] });
  },
  openVillage(p) {
    const q = this.pl[p];
    Menus[p].open({ eyebrow: 'Your village', title: 'The ' + G.players[p].name, live: true, sub: () => `${Math.floor(q.food)} food · ${this.own(p).length}/${this.cap(q) + 1} people`,
      items: () => [
        ...evolveItems(p),
        { head: true, label: 'People' },
        { label: 'Raise a new member', value: '25 food', desc: 'They appear at your village.', disabled: q.food < 25 || this.own(p).length > this.cap(q), onSelect: () => { if (q.food < 25 || this.own(p).length > this.cap(q)) return; q.food -= 25; const u = this.addUnit({ k: 'player', p }, q.village.x, q.village.z, G.players[p].body, .7); u.state = 'follow'; Sfx.good(p); } },
        { label: q.hutLvl < 3 ? 'Expand the village' : 'Village fully expanded', value: q.hutLvl < 3 ? [90, 150][q.hutLvl - 1] + ' food' : '', desc: 'Room for 3 more people and a sturdier village.', disabled: q.hutLvl >= 3 || q.food < [90, 150][q.hutLvl - 1], onSelect: () => { const c = [90, 150][q.hutLvl - 1]; if (q.hutLvl >= 3 || q.food < c) return; q.food -= c; q.hutLvl++; q.village.maxhp += 150; q.village.hp += 150; Sfx.good(p); } },
        { label: 'Recall everyone', desc: 'Bring all your people back to your chief.', onSelect: () => { for (const u of this.followers(p)) { u.state = 'follow'; u.target = null; } }, close: true },
        { head: true, label: 'Tools' },
        ...TRIBE_TOOLS.map(t => { const lv = q.tools[t.k], c = t.costs[lv]; return { label: t.name, value: lv >= t.max ? 'done' : `${lv}/${t.max} · ${c}`, desc: t.desc, disabled: lv >= t.max || q.food < c, onSelect: () => { if (lv >= t.max || q.food < c) return; q.food -= c; q.tools[t.k]++; this.refreshOwn(p); if (t.k === 'torch') q.village.torch = true; Sfx.good(p); } }; }),
        ...accordItem(p),
        { label: 'Close', close: true, onSelect: () => {} },
      ] });
  },
  /* ---------- simulation ---------- */
  update(dt) {
    this.t += dt; const mid = this.pl.reduce((a, q) => ({ x: a.x + q.chief.x / this.pl.length, z: a.z + q.chief.z / this.pl.length }), { x: 0, z: 0 });
    this.day.update(dt, mid.x, mid.z); this.wfx.update(dt, this.pl.map(q => q.chief)); const night = this.day.isNight;
    const spread = this.pl.length > 1 ? Math.hypot(this.pl[0].chief.x - this.pl[1].chief.x, this.pl[0].chief.z - this.pl[1].chief.z) : 0, ss = clamp(spread / 2 + 80, 90, 230);
    const c = this.sun.shadow.camera; if (Math.abs(c.right - ss) > 5) { c.left = -ss; c.right = ss; c.top = ss; c.bottom = -ss; c.updateProjectionMatrix(); }
    for (const q of this.pl) this.updatePlayer(q, dt);
    for (const u of this.units) if (!u.dead && !u.isChief) this.updUnit(u, dt);
    for (const s of this.spears) this.updSpear(s, dt); this.spears = this.spears.filter(s => s.life > 0);
    // deaths
    for (const u of this.units) if (!u.dead && u.hp <= 0) {
      if (u.isChief) continue; u.dead = true; u.cr.dispose(); this.fx.burst(u.x, u.cr.head().y, u.z, '#d9583e', 10, 5, .6, 6);
      const k = u.killer; if (u.side.k === 'wild' && k && k.side.k === 'player') { const q = this.pl[k.side.p], y = ({ carn: 30, omni: 22, herb: 12 }[G.players[q.p].diet]) * G.players[q.p].mods.econ; q.food += y; this.fx.text(u.x, 3, u.z, '+' + Math.round(y) + ' food', '#a6d96a', q.p); }
      if (u.side.k === 'wild') setTimeout(() => { if (S === this) this.spawnAnimal(); }, 20000);
      if (u.side.k === 'player') toastP(u.side.p, u.pet ? `Your ${u.pet} companion has fallen.` : 'One of your people has fallen.', 'bad');
    }
    this.units = this.units.filter(u => !u.dead);
    // villages
    for (const v of this.villages) this.updVillage(v, dt, night);
    // night beasts
    const beasts = this.units.filter(u => u.side.k === 'beast');
    if (night && beasts.length < 2 + G.mode) { const a = rand(0, TAU), u = this.addUnit({ k: 'beast' }, Math.cos(a) * 250, Math.sin(a) * 250, this.beastBody || (this.beastBody = genBody(Math.random, { diet: 'carn', mouth: 'm_maw', segs: 6, details: 2, paint: { h1: 270, h2: 300, h3: 180, l1: .3, pattern: 'bands' } })), 1.5); u.beast = true; }
    if (!night) for (const b of beasts) { b.flee = true; if (Math.hypot(b.x, b.z) > 245) { b.dead = true; b.cr.dispose(); } }
    for (const b of this.bushes) { b.fruit = Math.min(6, b.fruit + .1 * dt); b.fr.forEach((m, i) => m.visible = i < Math.min(4, Math.floor(b.fruit))); }
    for (const f of this.fish) { f.stock = Math.min(10, f.stock + .15 * dt); f.ring.scale.setScalar(1 + .15 * Math.sin(this.t * 3 + f.x)); f.ring.material.opacity = f.stock > 1 ? .6 : .15; }
    this.fx.update(dt);
    Disc.update(dt, p => { const q = this.pl[p]; return q && q.chief && !q.chief.downT ? q.chief : null; });
    for (const q of this.pl) if (this.united(q.p) >= TRIBE_GOAL && !Flow.ready[q.p]) { const con = this.villages.filter(v => v.by === q.p && v.how === 'conquered').length, al = this.villages.filter(v => v.by === q.p && v.how === 'allied').length; playerDone(q.p, con > al ? 'aggr' : al > con ? 'social' : 'mixed', [`Conquered ${con} tribe${con === 1 ? '' : 's'}, allied with ${al}${G.accord ? ', and stood in accord with your rival' : ''}.`, 'Your tribe founds the first city.']); }
  },
  summary(p) { const con = this.villages.filter(v => v.by === p && v.how === 'conquered').length, al = this.villages.filter(v => v.by === p && v.how === 'allied').length; return [`Conquered ${con} tribe${con === 1 ? '' : 's'}, allied with ${al}${G.accord ? ', and stood in accord with your rival' : ''}.`, 'Your tribe founds the first city.']; },
  evolveHint(p) { return `press ${KEYLABEL[p].menu} for your village menu`; },
  wonderReward(p, kind) {
    const q = this.pl[p]; q.food += 40; let extra = '';
    if (kind === 'skytree') { q.food += 60; extra = 'Your people gather a feast: +100 food in all.'; }
    else if (kind === 'stones' || kind === 'arch') { for (const v of this.villages) if (v.owner < 0 && v.by < 0 && !v.war[p]) v.rel[p] = Math.min(99, v.rel[p] + 15); extra = 'Word spreads. Every tribe thinks better of you: +15 friendship.'; }
    else if (kind === 'springs') { for (const u of this.own(p)) u.hp = u.maxhp; if (q.tools.herb < 2) { q.tools.herb++; this.refreshOwn(p); extra = 'Healing herbs grow here: +1 herbs.'; } else extra = 'Your people are healed.'; }
    else { const t = TRIBE_TOOLS.filter(t => q.tools[t.k] < t.max); if (t.length) { const k = pick(t); q.tools[k.k]++; this.refreshOwn(p); if (k.k === 'torch') q.village.torch = true; extra = `The old ones left something behind: +1 ${k.name.toLowerCase()}.`; } else extra = '+40 food.'; }
    return `+40 food. ${extra}`;
  },
  forceStyle(p) { const con = this.villages.filter(v => v.by === p && v.how === 'conquered').length, al = this.villages.filter(v => v.by === p && v.how === 'allied').length; return con > al ? 'aggr' : al > con ? 'social' : 'mixed'; },
  updatePlayer(q, dt) {
    const c = q.chief, P = G.players[q.p], pane = Panes[q.p]; q.spearCd -= dt;
    if (c.hp <= 0) { if (!c.downT) { Menus[q.p].close(); c.downT = 6; c.cr.setVisible(false); toastP(q.p, 'Your chief is wounded and carried home.', 'bad'); Sfx.bad(q.p); } c.downT -= dt; if (c.downT <= 0) { c.downT = 0; c.hp = c.maxhp * .6; c.x = q.village.x; c.z = q.village.z - 12; c.cr.setVisible(true); c.cr.init = false; } this.hud(q); return; }
    c.cd -= dt; c.flash -= dt; c.act -= dt; c.manual = (c.manual || 0) - dt;
    const dir = Menus[q.p].isOpen ? { x: 0, z: 0, m: 0 } : dirOf(q.p);
    if (dir.m) { c.state = 'idle'; c.target = null; c.a = lerpAng(c.a, Math.atan2(dir.z, dir.x), dt * 9); const sp = c.speed * 1.15 * (this.T.isWater(c.x, c.z) ? .55 : 1); c.x += Math.cos(c.a) * sp * dt; c.z += Math.sin(c.a) * sp * dt; const B = this.T.B * .8; c.x = clamp(c.x, -B, B); c.z = clamp(c.z, -B, B); }
    if (c.state === 'fight' && c.target && !c.target.dead && !dir.m) this.fightStep(c, c.target, dt);
    else { c.cr.st.bite = c.act > 0 ? 1 : 0; c.cr.update(dt, c.x, c.z, c.a, this.H); }
    if (c.target && c.target.dead) { c.state = 'idle'; c.target = null; }
    // chief defends itself
    if (!dir.m && c.state !== 'fight') { const e = this.nearest(c, u => this.hostile(c, u), 9); if (e) { c.state = 'fight'; c.target = e; } }
    if (Math.hypot(c.x - q.village.x, c.z - q.village.z) < 30) c.hp = Math.min(c.maxhp, c.hp + (2 + q.tools.herb * 3) * dt); else c.hp = Math.min(c.maxhp, c.hp + .4 * dt);
    if (q.performing) { const v = q.performing; if (Math.hypot(c.x - v.x, c.z - v.z) > 45 || v.by >= 0) { q.performing = null; for (const u of this.followers(q.p)) if (u.state === 'perform') u.state = 'follow'; } else { v.rel[q.p] = Math.min(100, v.rel[q.p] + (.6 + q.tools.horn * .4) * P.mods.social * dt); c.cr.st.sing = true; } } else c.cr.st.sing = false;
    // births keep a dwindling tribe alive
    q.birthT += dt; if (q.birthT > 30 && this.own(q.p).length < 3) { q.birthT = 0; const u = this.addUnit({ k: 'player', p: q.p }, q.village.x, q.village.z, P.body, 1); u.state = 'follow'; toastP(q.p, 'A child is born in your village.'); }
    this.hud(q);
  },
  nearest(u, pred, r) { let best = null, bd = r; for (const o of this.units) { if (o === u || o.dead || o.hp <= 0 || !pred(o)) continue; const d = Math.hypot(o.x - u.x, o.z - u.z); if (d < bd) { bd = d; best = o; } } return best; },
  reach(a, b) { return a.cr.B.len * a.cr.k * .5 + (b.cr ? b.cr.B.len * b.cr.k * .5 : 6) + 1.4; },
  moveTo(u, x, z, dt, mul = 1) {
    const d = Math.hypot(x - u.x, z - u.z); if (d < .6) { u.cr.update(dt, u.x, u.z, u.a, this.H); return true; }
    u.a = lerpAng(u.a, Math.atan2(z - u.z, x - u.x), dt * 6); const sp = u.speed * mul * (this.T.isWater(u.x, u.z) ? .55 : 1), st = Math.min(d, sp * dt);
    u.x += Math.cos(u.a) * st; u.z += Math.sin(u.a) * st; const B = this.T.B * .8; u.x = clamp(u.x, -B, B); u.z = clamp(u.z, -B, B);
    let far = 1e9; for (const q of this.pl) far = Math.min(far, Math.hypot(q.chief.x - u.x, q.chief.z - u.z));
    if (far > 160) { if (!u.hidden) { u.cr.setVisible(false); u.hidden = true; } return false; } if (u.hidden) { u.cr.setVisible(true); u.hidden = false; u.cr.init = false; }
    u.cr.update(dt, u.x, u.z, u.a, this.H); return false;
  },
  fightStep(u, t, dt, isHut) {
    const tx = t.x, tz = t.z, d = Math.hypot(tx - u.x, tz - u.z), reach = isHut ? 14 : this.reach(u, t);
    if (d > reach * .9) this.moveTo(u, tx, tz, dt, 1.05); else { u.a = lerpAng(u.a, Math.atan2(tz - u.z, tx - u.x), dt * 8); u.cr.st.bite = u.act > 0 ? 1 : 0; u.cr.update(dt, u.x, u.z, u.a, this.H); }
    if (d <= reach && u.cd <= 0) {
      u.cd = .9; u.act = .25; let dmg = u.dmg * rand(.85, 1.15); if (u.side.k === 'player' && Math.hypot(u.x - this.pl[u.side.p].village.x, u.z - this.pl[u.side.p].village.z) < 40) dmg *= 1.35;
      t.hp -= dmg; if (!isHut) { t.flash = .12; t.killer = u; if (t.state !== 'fight' && t.side.k !== 'beast') { t.prev = { state: t.state, spot: t.spot }; t.state = 'fight'; t.target = u; } } else t.lastBy = u;
      if (Math.random() < .5) Sfx.hit(u.side.k === 'player' ? u.side.p : 0); if (Math.random() < .5) this.fx.burst(tx, isHut ? 4 : t.cr.head().y, tz, '#ffd2c4', 3, 3, .25);
    }
  },
  updSpear(s, dt) {
    s.life -= dt; s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    _dv.set(s.vx, s.vy, s.vz).normalize(); s.m.quaternion.setFromUnitVectors(_up, _dv); s.m.position.set(s.x, s.y, s.z);
    for (const u of this.units) { if (u === s.owner || u.dead || (u.side.k === 'player' && u.side.p === s.owner.side.p)) continue; if (u.side.k === 'player' && !canHarm()) continue; if (u.side.k === 'tribe' && !this.hostile(s.owner, u)) continue; if (Math.hypot(u.x - s.x, u.z - s.z) < u.cr.B.radius * u.cr.k + 1) { u.hp -= s.dmg; u.flash = .15; u.killer = s.owner; if (u.state !== 'fight') { u.state = 'fight'; u.target = s.owner; } this.fx.text(u.x, u.cr.head().y + 2, u.z, Math.round(s.dmg), '#ffd2c4', s.owner.side.p); s.life = 0; break; } }
    if (s.y < this.T.ground(s.x, s.z) || s.life <= 0) { s.life = 0; this.scene.remove(s.m); }
  },
  updVillage(v, dt, night) {
    v.fire.scale.set(1 + .15 * Math.sin(this.t * 13 + v.x), 1 + .2 * Math.sin(this.t * 9), 1); if (v.light.isSprite) v.light.material.opacity = night ? .55 + .1 * Math.sin(this.t * 9 + v.x) : .12; else v.light.intensity = night ? 30 : 0;
    v.hp = Math.min(v.maxhp, v.hp + 1.5 * dt);
    const dmgk = 1 - v.hp / v.maxhp; v.huts.forEach((h, i) => h.rotation.x = dmgk > (i + 1) * .2 ? .35 : 0);
    if (v.owner >= 0) { // a player's home village
      if (v.hp <= 0) { const q = this.pl[v.owner], lost = Math.floor(q.food / 2); q.food -= lost; v.hp = v.maxhp * .5; toastP(v.owner, `Your village was burned. ${lost} food lost.`, 'bad'); const by = v.lastBy; if (by && by.side.k === 'player') { this.pl[by.side.p].food += lost; toastP(by.side.p, `You plundered ${lost} food from P${v.owner + 1}.`, 'good'); } for (const u of this.units) if (u.state === 'raid' && u.spot === v) { u.state = 'idle'; } }
      return;
    }
    if (v.by >= 0) { if (v.how === 'allied') { v.giftT += dt; if (v.giftT > 25) { v.giftT = 0; this.pl[v.by].food += 8 * G.players[v.by].mods.econ; } } return; }
    if (v.hp <= 0) { this.conquer(v); return; }
    for (let p = 0; p < G.mode; p++) {
      if (v.rel[p] >= 100) { this.allyTribe(v, p); return; }
      if (v.rel[p] < 20 || v.war[p]) {
        if (v.warn[p] > 0) { v.warn[p] -= dt; if (v.warn[p] <= 0) { v.war[p] = true; const mine = this.units.filter(u => u.side.k === 'tribe' && u.side.id === v.id && u.state !== 'fight'); mine.slice(0, 2 + Math.floor(this.t / 200)).forEach(u => { u.state = 'raid'; u.spot = this.pl[p].village; }); toastP(p, `The ${v.name} are raiding your village!`, 'bad'); } }
        else { v.raidT[p] -= dt; if (v.raidT[p] <= 0) { v.warn[p] = 10; v.raidT[p] = rand(90, 130); toastP(p, `The ${v.name} are gathering warriors to raid you. 10 seconds.`, 'warn'); Sfx.bad(p); } }
      }
    }
    if (this.units.filter(u => u.side.k === 'tribe' && u.side.id === v.id).length < 4 && Math.random() < dt * .03) this.addUnit({ k: 'tribe', id: v.id }, v.x, v.z, v.body, 1);
  },
  allyTribe(v, p) { v.by = p; v.how = 'allied'; v.war = [false, false]; Sfx.good(p); toastAll(`The ${v.name} join P${p + 1}${G.mode === 2 ? '' : ''} as allies.`, 'good'); this.recolor(v, G.players[p].hue); for (const u of this.followers(p)) if (u.state === 'perform' && u.spot === v) u.state = 'follow'; if (this.pl[p].performing === v) this.pl[p].performing = null; },
  conquer(v) {
    const by = v.lastBy && v.lastBy.side.k === 'player' ? v.lastBy.side.p : this.pl.reduce((a, q) => (Math.hypot(q.chief.x - v.x, q.chief.z - v.z) < Math.hypot(this.pl[a].chief.x - v.x, this.pl[a].chief.z - v.z) ? q.p : a), 0);
    v.by = by; v.how = 'conquered'; v.war = [false, false]; v.hp = v.maxhp * .5; Sfx.good(by); this.recolor(v, G.players[by].hue);
    const q = this.pl[by]; let joined = 0;
    for (const u of this.units) if (u.side.k === 'tribe' && u.side.id === v.id) { if (this.own(by).length <= this.cap(q) + 2) { u.side = { k: 'player', p: by }; u.state = 'follow'; u.target = null; joined++; } else u.hp = 0; }
    for (const u of this.units) if ((u.state === 'raid') && u.spot === v) u.state = 'follow';
    toastAll(`P${by + 1} burned the ${v.name} village. ${joined} of their people join them.`, 'warn');
    for (const o of this.villages) if (o !== v && o.owner < 0 && o.by < 0) o.rel[by] = Math.max(0, o.rel[by] - 10);
  },
  recolor(v, hue) { v.huts.forEach(h => { h.children[1].material = stdMat(col3(hue, .45, .32).getHex(), { flatShading: true }); }); },
  updUnit(u, dt) {
    u.cd -= dt; u.flash -= dt; u.act -= dt; const S2 = u.side;
    if (u.flash > 0) u.cr.mesh.visible = Math.floor(u.flash * 30) % 2 === 0; else if (!u.hidden) u.cr.mesh.visible = true;
    if (S2.k === 'wild') {
      if (u.state === 'fight' && u.target && !u.target.dead && Math.hypot(u.target.x - u.x, u.target.z - u.z) < 40) { this.fightStep(u, u.target, dt); return; }
      u.state = 'idle'; u.wa += rand(-1, 1) * dt; if (Math.hypot(u.x - u.home.x, u.z - u.home.z) > 40) u.wa = Math.atan2(u.home.z - u.z, u.home.x - u.x);
      this.moveTo(u, u.x + Math.cos(u.wa) * 5, u.z + Math.sin(u.wa) * 5, dt, .35); return;
    }
    if (S2.k === 'beast') {
      if (u.flee) { this.moveTo(u, u.x * 1.2, u.z * 1.2, dt, 1); return; }
      let t = u.target; if (!t || t.dead || Math.random() < dt * .3) { t = null; let bd = 70; for (const o of this.units) { if (o.dead || o.side.k === 'beast') continue; const ov = this.villageOf(o), lit = (ov && ov.torch && Math.hypot(o.x - ov.x, o.z - ov.z) < 50) || (o.side.k === 'player' && this.pl[o.side.p].tools.torch && o.isChief); if (lit) continue; const d = Math.hypot(o.x - u.x, o.z - u.z); if (d < bd) { bd = d; t = o; } } u.target = t; }
      if (t) this.fightStep(u, t, dt); else { u.wa += rand(-1, 1) * dt; this.moveTo(u, u.x + Math.cos(u.wa) * 5, u.z + Math.sin(u.wa) * 5, dt, .5); } return;
    }
    const home = this.villageOf(u);
    if (home && Math.hypot(u.x - home.x, u.z - home.z) < 30) u.hp = Math.min(u.maxhp, u.hp + (S2.k === 'player' ? 1.5 + this.pl[S2.p].tools.herb * 2.5 : 1.5) * dt);
    if (u.state !== 'fight') { const e = this.nearest(u, o => this.hostile(u, o), u.state === 'raid' ? 26 : 16); if (e) { u.prev = { state: u.state, spot: u.spot }; u.state = 'fight'; u.target = e; } }
    const q = S2.k === 'player' ? this.pl[S2.p] : null;
    switch (u.state) {
      case 'fight': { const t = u.target; if (!t || t.dead || t.hp <= 0 || Math.hypot(t.x - u.x, t.z - u.z) > 60) { const pv = u.prev || { state: S2.k === 'player' ? 'follow' : 'idle' }; u.state = pv.state === 'fight' ? (S2.k === 'player' ? 'follow' : 'idle') : pv.state; u.spot = pv.spot; u.target = null; u.prev = null; break; } this.fightStep(u, t, dt); return; }
      case 'follow': { const c = q.chief, fl = this.followers(S2.p), i = fl.indexOf(u), row = Math.floor(i / 4), col = i % 4, fa = c.a + Math.PI, fx = c.x + Math.cos(fa) * (5 + row * 3.5) + Math.cos(fa + Math.PI / 2) * (col - 1.5) * 3, fz = c.z + Math.sin(fa) * (5 + row * 3.5) + Math.sin(fa + Math.PI / 2) * (col - 1.5) * 3; this.moveTo(u, fx, fz, dt, Math.hypot(fx - u.x, fz - u.z) > 6 ? 1.15 : .6); return; }
      case 'gather': case 'fish': {
        if (u.carry >= 5) { if (this.moveTo(u, home.x, home.z, dt) || Math.hypot(u.x - home.x, u.z - home.z) < 12) { const k = u.state === 'fish' ? 1.3 : ({ herb: 1.3, omni: 1, carn: .6 }[G.players[S2.p].diet]); const y = u.carry * k * G.players[S2.p].mods.econ; q.food += y; u.carry = 0; this.fx.text(u.x, 3, u.z, '+' + Math.round(y), '#a6d96a', S2.p); } return; }
        if (u.state === 'fish') { const f = u.spot; if (!f) { u.state = 'follow'; return; } if (Math.hypot(f.x - u.x, f.z - u.z) > 3) this.moveTo(u, f.x + Math.cos(u.wa) * 2, f.z + Math.sin(u.wa) * 2, dt); else { u.cr.update(dt, u.x, u.z, u.a, this.H); u.pick = (u.pick || 0) + dt; if (u.pick > .5 && f.stock >= 1) { u.pick = 0; f.stock--; u.carry++; } } return; }
        let b = u.target; if (!b || b.fruit < 1) { b = null; let bd = 1e9; const from = u.spot || u; for (const o of this.bushes) { if (o.fruit < 1) continue; const d = Math.hypot(o.x - from.x, o.z - from.z); if (d < bd && d < 80) { bd = d; b = o; } } u.target = b; }
        if (!b) { u.state = 'follow'; return; }
        if (Math.hypot(b.x - u.x, b.z - u.z) > 3) this.moveTo(u, b.x, b.z, dt); else { u.cr.update(dt, u.x, u.z, u.a, this.H); u.pick = (u.pick || 0) + dt; if (u.pick > .6) { u.pick = 0; b.fruit -= 1; u.carry++; } }
        return;
      }
      case 'perform': { const v = u.spot; if (!v || v.by >= 0) { u.state = 'follow'; return; } const fl = this.followers(S2.p), i = fl.indexOf(u), a = i / Math.max(1, fl.length) * TAU, px = v.x + Math.cos(a) * 18, pz = v.z + Math.sin(a) * 18; if (Math.hypot(px - u.x, pz - u.z) > 1.5) this.moveTo(u, px, pz, dt); else { u.a = lerpAng(u.a, Math.atan2(v.z - u.z, v.x - u.x), dt * 4); u.cr.st.sing = true; u.cr.st.dance = Math.sin(this.t * 2 + i) > 0; u.cr.update(dt, u.x, u.z, u.a, this.H); v.rel[S2.p] = Math.min(100, v.rel[S2.p] + (.25 + q.tools.horn * .25) * G.players[S2.p].mods.social * dt); if (Math.random() < dt * 1.2) { this.fx.text(u.x, u.cr.head().y + 2, u.z, pick(['♪', '♫', '♩']), pick(['#5ce1e6', '#f2b544', '#b48cff']), S2.p); if (Math.random() < .2) Sfx.note(rint(0, 6), S2.p); } } return; }
      case 'raid': { const v = u.spot; if (!v || (v.owner < 0 && v.by >= 0)) { u.state = S2.k === 'player' ? 'follow' : 'idle'; return; } this.fightStep(u, v, dt, true); return; }
      default: { u.cr.st.sing = false; u.cr.st.dance = false; if (S2.k === 'player') { u.state = 'follow'; return; } u.wa += rand(-1, 1) * dt; const d = Math.hypot(u.x - home.x, u.z - home.z); if (d > 20) u.wa = Math.atan2(home.z - u.z, home.x - u.x); this.moveTo(u, u.x + Math.cos(u.wa) * 5, u.z + Math.sin(u.wa) * 5, dt, d > 30 ? 1 : .3); }
    }
  },
  /* ---------- view ---------- */
  camFor(i, cam, dt) { const q = this.pl[i]; if (!q) return; const c = q.chief, y = c.cr.head().y, k = dt ? Math.min(1, dt * 4) : 1; editorView(cam, i, false); _tv.set(c.x, y + 17, c.z + 23); cam.position.lerp(_tv, k); cam.lookAt(cam.position.x, cam.position.y - 17, cam.position.z - 30); },
  beforeRender(i, cam) { const q = this.pl[i]; if (q) this.T.clearView(cam, q.chief.x, 0, q.chief.z); this.wfx.beforeRender(cam); const P = G.players[i], q2 = this.pl[i]; this.scene.fog.density = this.day.isNight ? (q2 && q2.tools.torch ? .009 : .014) : .005; },
  labels(i) {
    const pane = Panes[i], q = this.pl[i]; if (!q) return;
    for (const v of this.villages) { const c = q.chief; if (Math.hypot(v.x - c.x, v.z - c.z) > 140) continue; const s = project(_kv.set(v.x, this.T.ground(v.x, v.z) + 12, v.z), i); if (!s) continue;
      const sub = v.owner >= 0 ? (v.owner === i ? 'your village' : `P${v.owner + 1}'s village`) : v.by >= 0 ? `${v.how} · P${v.by + 1}` : v.war[i] ? 'at war' : `friendship ${Math.round(v.rel[i])}%${v.warn[i] > 0 ? ' · raid coming!' : ''}`;
      pane.label(s.x, s.y, `<span style="color:${hueCss(v.owner >= 0 ? G.players[v.owner].hue : v.hue, 70, 72)}">${esc(v.name)}</span><small>${esc(sub)}</small>${v.hp < v.maxhp - 1 ? `<small style="color:#ff7a59">${'▮'.repeat(Math.ceil(v.hp / v.maxhp * 8))}</small>` : ''}`); }
    Disc.labels(i, p => this.pl[p] && this.pl[p].chief, s => s.y + 32, (pn, ii, x, y, z, h, c) => CreatureStage.edge.call(this, pn, ii, x, y, z, h, c));
    for (const o of this.pl) if (o !== q) { const c = o.chief; const s = project(_kv.set(c.x, c.cr.head().y + 4, c.z), i); if (s) pane.label(s.x, s.y, `<span style="color:${hueCss(G.players[o.p].hue)}">P${o.p + 1} chief</span>`); }
    const ctx = this.context(q); if (ctx && (ctx.kind === 'hunt' || ctx.kind === 'attack')) { const u = ctx.u, s = project(_kv.set(u.x, u.cr.head().y + u.cr.B.height * u.cr.k + 1, u.z), i); if (s) pane.label(s.x, s.y, `${u.side.k === 'wild' ? 'Prey' : u.side.k === 'beast' ? 'Night beast' : 'Enemy'} <span style="color:#a6d96a">${'▮'.repeat(Math.ceil(clamp(u.hp / u.maxhp, 0, 1) * 5))}</span>`, 'sel'); }
    this.fx.labels(i);
  },
  hud(q) {
    const pane = Panes[q.p], c = q.chief, ctx = this.context(q), t = q.tools;
    pane.meter('chief', c.hp, c.maxhp); pane.meter('vil', q.village.hp, q.village.maxhp); pane.meter('uni', this.united(q.p), TRIBE_GOAL, `${this.united(q.p)} of ${TRIBE_GOAL} tribes`);
    pane.stat('food', Math.floor(q.food)); pane.stat('pop', `${this.own(q.p).length}/${this.cap(q) + 1}`); pane.stat('tools', `${t.spear}⚔ ${t.horn}♪ ${t.herb}+`); pane.stat('won', `${Disc.count(q.p)}/${Disc.list.length}`);
    const lab = !ctx ? 'Command' : { village: 'Visit tribe', hunt: 'Hunt', attack: 'Attack', fish: 'Fish here', gather: 'Gather here', home: 'Village' }[ctx.kind];
    pane.acts([{ act: 'a1', label: lab, off: !ctx, hot: !!ctx }, { act: 'a2', label: 'Rally' }, { act: 'a3', label: 'Throw spear', off: !t.spear || q.spearCd > 0 }, { act: 'a4', label: 'Perform', off: !(ctx && ctx.kind === 'village') || !t.horn }, { act: 'menu', label: 'Village' }]);
    let pr = ''; if (c.downT > 0) pr = 'Your chief is recovering…'; else if (q.performing) pr = `Performing for the ${q.performing.name}: ${Math.round(q.performing.rel[q.p])}%`; else if (this.day.isNight && !t.torch) pr = 'Night: beasts are out. Torches keep them away.'; pane.prompt(pr);
  },
  exit() {},
};
