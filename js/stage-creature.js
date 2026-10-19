/* Lineage | stage-creature. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== STAGE 2: CREATURE ============================== */
const SOCIALS = [{ k: 'sing', act: 'a1', icon: 'sing', sym: '♪', col: '#5ce1e6' }, { k: 'dance', act: 'a2', icon: 'dance', sym: '≈', col: '#b48cff' }, { k: 'charm', act: 'a3', icon: 'charm', sym: '♥', col: '#ff8fb8' }, { k: 'pose', act: 'a4', icon: 'pose', sym: '★', col: '#f2b544' }];
const COMBAT = [{ k: 'bite', cd: 1.1 }, { k: 'strike', cd: .9 }, { k: 'charge', cd: 5 }, { k: 'spit', cd: 2.6 }];
const BRAIN = [0, 50, 120, 200, 290, 380];
const TEMPERS = { peaceful: 'Peaceful herd', skittish: 'Skittish', territorial: 'Territorial', aggressive: 'Pack hunters', nocturnal: 'Night hunters', giant: 'Gentle giants', ambusher: 'Ambushers', spitter: 'Spitters', rogue: 'Rogue', epic: 'Epic' };
const HOSTILE_T = new Set(['aggressive', 'nocturnal', 'ambusher', 'rogue', 'epic', 'territorial', 'spitter']);
const CreatureStage = {
  idx: 1,
  grade: { bloom: .5, sat: 1.16, vig: .3 },
  enter() {
    G.stage = 1; saveGame();
    const seed = G.seed + 2, r = mulberry32(seed); this.t = 0; this.hitstop = 0; this.pal = worldPalette(seed);
    const sc = this.scene = new THREE.Scene(); sc.fog = new THREE.FogExp2(this.pal.fog, .006);
    this.sky = makeSky(sc, this.pal.skyTop, this.pal.skyBot); this.hemi = new THREE.HemisphereLight(0xdcefff, 0x4a3a2a, .75); sc.add(this.hemi);
    this.sun = sunLight(sc, 0xfff2dd, 2.6, 70);
    const nests = G.mode === 2 ? [{ x: -30, z: 20 }, { x: 30, z: 20 }] : [{ x: 0, z: 20 }];
    const base = r() * TAU; this.spots = Array.from({ length: 9 }, (_, i) => { const a = base + i * TAU / 9, d = 115 + r() * 95; return { x: Math.cos(a) * d, z: Math.sin(a) * d }; });
    this.wonders = wonderSites(r, 6, ['arch', 'spire', 'ribs', 'skytree', 'floaters', 'springs', 'shrooms'], 150, 228, [...nests.map(n => ({ ...n, r: 20 })), ...this.spots.map(n => ({ ...n, r: 14 }))]);
    this.T = buildTerrain(sc, seed, { size: 640, seg: 170, water: 0, flat: [...nests.map(n => ({ ...n, r: 14, h: 3 })), ...this.spots.map(n => ({ ...n, r: 10, h: 4 })), ...this.wonders.map(n => ({ ...n, r: 17, h: 4.5 }))], trees: 380, palette: this.pal });
    this.day = new DayNight(sc, this.sky, this.sun, this.hemi, 320, this.pal); this.fx = new FX3(sc, .7); this.ground = (x, z) => this.T.ground(x, z);
    this.wfx = new WorldFX(sc, this.T, this.pal, this.sun, this.day);
    for (const w of this.wonders) { const K = WONDER_KINDS[w.kind], lm = makeLandmark(w.kind, this.pal, r), y = this.T.h(w.x, w.z); lm.g.position.set(w.x, y, w.z); lm.g.rotation.y = r() * TAU; sc.add(lm.g); Disc.add({ x: w.x, z: w.z, y, r: 22, name: K.name, lore: K.lore, icon: K.icon, beacon: lm.beacon, spin: lm.spin, kind: w.kind, reward: p => this.wonderReward(p, w.kind) }); }
    this.ents = []; this.meat = []; this.bushes = []; this.bones = []; this.spits = []; this.species = []; this.events = []; this.raidT = 140; this.bountyT = 110;
    const bushGeo = sharedGeo('bush', () => new THREE.IcosahedronGeometry(1.6, 1)), fruitM = stdMat(0xff5f9e, { emissive: 0x501030, roughness: .4 }), leafM = swayMaterial(litMat({ color: col3(this.pal.trees[0], .45, .32), flatShading: true }), .05, 1.6);
    for (let k = 0; k < 900 && this.bushes.length < 80; k++) { const x = (r() * 2 - 1) * 245, z = (r() * 2 - 1) * 245; if (this.T.isWater(x, z) || this.T.slopeAt(x, z) > .5) continue; const g = new THREE.Group(); g.position.set(x, this.T.h(x, z) + 1, z); const m = new THREE.Mesh(bushGeo, leafM); m.castShadow = true; g.add(m); const fr = []; for (let f = 0; f < 4; f++) { const fm = new THREE.Mesh(sharedGeo('fruit', () => new THREE.SphereGeometry(1, 8, 6)), fruitM); fm.scale.setScalar(.38); fm.position.set(Math.cos(f * 1.6) * 1.35, .4 + (f % 2) * .5, Math.sin(f * 1.6) * 1.35); g.add(fm); fr.push(fm); } sc.add(g); this.bushes.push({ x, z, fruit: 3, regen: 0, fr }); }
    const boneM = stdMat(0xeee4cc, { roughness: .6 });
    for (let k = 0; k < 400 && this.bones.length < 10; k++) { const x = (r() * 2 - 1) * 255, z = (r() * 2 - 1) * 255; if (this.T.isWater(x, z) || Math.hypot(x, z) < 45 || this.bones.some(b => Math.hypot(b.x - x, b.z - z) < 55)) continue; const g = new THREE.Group(); g.position.set(x, this.T.h(x, z), z);
      for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(sharedGeo('bcyl', () => new THREE.CylinderGeometry(1, 1, 1, 6)), boneM); m.scale.set(.22, 2 - i * .12, .22); m.position.set(i * .6 - 1.8, .4, Math.sin(i) * .3); m.rotation.set(Math.PI / 2 + .3, 0, i * .25); g.add(m); }
      const sk = new THREE.Mesh(sharedGeo('fruit', () => new THREE.SphereGeometry(1, 8, 6)), boneM); sk.scale.set(.9, .65, .75); sk.position.set(-2.6, .5, 0); g.add(sk);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 26, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 13; g.add(beam);
      sc.add(g); this.bones.push({ x, z, dug: [false, false], g, beam }); }
    // the wildlife: all built from the same mouldable bodies
    const plan = [['herb', 'peaceful', [1, 1.3], 6], ['herb', 'skittish', [.65, .8], 5], ['carn', 'aggressive', [.9, 1.1], 4], ['omni', 'territorial', [1.2, 1.5], 4], ['carn', 'nocturnal', [1, 1.2], 3], ['herb', 'giant', [2.1, 2.5], 2], ['omni', 'peaceful', [.9, 1.1], 5], ['carn', 'ambusher', [.9, 1.1], 3], ['omni', 'spitter', [.8, 1], 4]];
    plan.forEach(([diet, temper, ks, count], i) => {
      const body = genBody(r, { diet, posture: temper === 'giant' ? 'level' : undefined, legPairs: temper === 'giant' ? 2 : undefined, leg: temper === 'skittish' ? 'l_strider' : temper === 'giant' ? 'l_stomper' : temper === 'ambusher' ? 'l_talon' : undefined });
      if (temper === 'nocturnal' && !body.parts.some(p => p.id === 'd_glow')) body.parts.push({ id: 'd_glow', s: .2, dx: .2, dy: 1, dz: 0, scale: 1 });
      if (temper === 'spitter' && !body.parts.some(p => p.id === 'd_spitter')) body.parts.push({ id: 'd_spitter', s: .5, dx: .2, dy: -.4, dz: .8, scale: 1 });
      if ((temper === 'aggressive' || temper === 'territorial') && !body.parts.some(p => p.id === 'd_horn')) body.parts.push({ id: 'd_horn', s: .1, dx: .3, dy: 1, dz: .35, scale: 1 });
      this.addSpecies({ diet, temper, ks, count, body, nest: this.spots[i] }, r);
    });
    const rogueBody = genBody(r, { diet: 'carn', mouth: 'm_fang', details: 3, legPairs: 2 }); this.rogue = this.addSpecies({ diet: 'carn', temper: 'rogue', ks: [1.7, 1.9], count: 1, body: rogueBody, nest: { x: 0, z: -160 } }, r);
    this.epics = [[-185, 185], [185, -175]].map(([x, z], i) => { const b = genBody(r, { diet: 'carn', mouth: i ? 'm_fang' : 'm_maw', posture: 'level', legPairs: 2, leg: 'l_stomper', details: 3, segs: 7 }); return this.addSpecies({ diet: 'carn', temper: 'epic', ks: [3.2, 3.4], count: 1, body: b, nest: { x, z }, name: 'Epic ' + makeName(r, 2) }, r); });
    this.pl = [];
    for (let p = 0; p < G.mode; p++) {
      const P = G.players[p]; if (!P.body || P.body.kind !== 'creature') P.body = starterCreature(P);
      const n = nests[p]; this.addNest(n.x, n.z, P.hue, true);
      const q = { p, isPlayer: true, x: n.x, z: n.z - 13, a: -Math.PI / 2, camYaw: -Math.PI / 2, vx: 0, vz: 0, lift: 0, vy: 0, hp: 1, maxhp: 1, hunger: 85, stam: 3, dead: 0, downed: 0, revT: 0, inv: 0, cds: {}, target: null, duet: null, pack: [], nest: n, dna: 30 + (P.dna || 0), prog: 0, kills: 0, act: null, actT: 0, glide: false, sprintT: 0, shake: 0, combo: { n: 0, t: 0 }, dodge: 0, pending: null, combatT: 0, lastHitOn: null, lastHitT: 0 };
      P.dna = 0;
      this.pl.push(q); this.ents.push(q); this.rebuildPlayer(q); q.hp = q.maxhp;
      Panes[p].build({ eyebrow: 'Stage 2 · Creature', title: P.name, meters: [{ id: 'hp', label: 'Health', color: 'var(--membrane)' }, { id: 'hu', label: 'Hunger', color: 'var(--ochre)' }, { id: 'br', label: 'Brain', color: 'var(--violet)' }], stats: [{ id: 'dna', label: 'DNA' }, { id: 'pack', label: 'Pack' }, { id: 'won', label: 'Wonders' }, { id: 'time', label: 'Time' }] });
      const L = KEYLABEL[p]; toastP(p, `Move with ${G.mode === 2 ? L.move : 'the arrows'}. ${L.a1} attack, ${L.a2} special, ${L.a3} greet, ${L.a4} jump or dodge, ${L.menu} interact, ${L.back} next target. Befriend, hunt or explore to grow your brain: golden beacons mark wonders worth the walk.`);
    }
  },
  addSpecies(o, r) {
    const B = bakeBody(o.body, { res: .085 }), ab = abilities(o.body), favs = SOCIALS.map(s => s.k).sort(() => r() - .5).slice(0, 2);
    const sp = { id: this.species.length, name: o.name || makeName(r), body: o.body, B, ab, diet: ab.diet, temper: o.temper, ks: o.ks, n0: o.count, nest: { ...o.nest }, favs, need: o.temper === 'giant' || o.temper === 'skittish' ? 2 : 1, rel: [0, 0], allied: [false, false], hostile: [HOSTILE_T.has(o.temper) && o.temper !== 'territorial' && o.temper !== 'spitter', 0].map((v, i) => v && (o.temper === 'rogue' || o.temper === 'epic')), kills: [0, 0], extinct: false, breedT: 60, target: null, cool: [0, 0] };
    if (o.temper === 'rogue' || o.temper === 'epic') sp.hostile = [true, true];
    this.species.push(sp); if (o.temper !== 'rogue' && o.temper !== 'epic') this.addNest(sp.nest.x, sp.nest.z, o.body.paint.h1, false);
    for (let m = 0; m < o.count; m++) this.addNpc(sp, sp.nest.x + rand(-8, 8), sp.nest.z + rand(-8, 8), m === 0);
    return sp;
  },
  addNest(x, z, hue, big) {
    const g = new THREE.Group(), y = this.T.ground(x, z); g.position.set(x, y, z); const m = stdMat(col3(hue, .3, .35).getHex());
    const n = big ? 22 : 14; for (let k = 0; k < n; k++) { const st = new THREE.Mesh(sharedGeo('bcyl', () => new THREE.CylinderGeometry(1, 1, 1, 6)), m); const a = k / n * TAU; st.scale.set(.07, 1.5, .07); st.position.set(Math.cos(a) * (big ? 2.2 : 1.8), .12 + (k % 2) * .1, Math.sin(a) * (big ? 2.2 : 1.8)); st.rotation.set(Math.PI / 2, 0, a + .9); g.add(st); }
    const eggs = []; for (let k = 0; k < 3; k++) { const e = new THREE.Mesh(sharedGeo('fruit', () => new THREE.SphereGeometry(1, 8, 6)), stdMat(col3(hue, .45, .82).getHex())); e.scale.set(.28, .36, .28); e.position.set(Math.cos(k * 2) * .5, .3, Math.sin(k * 2) * .5); g.add(e); eggs.push(e); }
    if (big) { const ring = new THREE.Mesh(new THREE.RingGeometry(7.5, 8, 48), new THREE.MeshBasicMaterial({ color: col3(hue, .8, .6), transparent: true, opacity: .5, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .15; g.add(ring); }
    this.scene.add(g); return eggs;
  },
  hpFor(ab, k, mods = { hp: 1 }) { return (60 + ab.A.health * 22 + ab.vol * 40) * (.6 + k * .4) * mods.hp; },
  addNpc(sp, x, z, alpha) {
    const k = rand(sp.ks[0], sp.ks[1]) * (alpha ? 1.2 : 1), cr = new Creature(sp.B, k, { shadow: sp.temper === 'giant' || sp.temper === 'epic' || alpha }); this.scene.add(cr.group);
    const hp = this.hpFor(sp.ab, k) * (sp.temper === 'epic' ? 4.5 : sp.temper === 'rogue' ? 2 : 1), speed = (4.6 + sp.ab.A.speed * 1.3) * (sp.ab.legs ? 1 : .6) * (sp.temper === 'giant' ? .7 : 1) * (.85 + k * .15);
    const n = { sp, cr, x, z, a: rand(0, TAU), wa: rand(0, TAU), vx: 0, vz: 0, k, alpha, hp, maxhp: hp, speed, state: sp.temper === 'ambusher' ? 'lurk' : 'idle', target: null, cds: {}, think: rand(0, .5), owner: -1, hungerT: rand(30, 70), flash: 0, stun: 0, windup: null, fled: false, roamTo: null };
    cr.update(0, x, z, n.a, this.ground); this.ents.push(n); return n;
  },
  rebuildPlayer(q) {
    const P = G.players[q.p]; if (q.cr) { q.cr.dispose(); q.B.geometry.dispose(); }
    q.B = bakeBody(P.body); q.ab = abilities(P.body); q.cr = new Creature(q.B, 1); this.scene.add(q.cr.group); q.cr.update(0, q.x, q.z, q.a, this.ground);
    const f = q.maxhp > 1 ? q.hp / q.maxhp : 1; q.maxhp = this.hpFor(q.ab, 1, P.mods); q.hp = q.maxhp * f;
    q.speed = (6 + q.ab.A.speed * 1.5) * (q.ab.legs ? 1 : .6); q.k = 1;
  },
  /* ---------- progress ---------- */
  brainLvl(q) { let l = 1; for (let i = 1; i < BRAIN.length; i++) if (q.prog >= BRAIN[i]) l = i + 1; return Math.min(5, l); },
  packMax(q) { return Math.min(4, this.brainLvl(q)); },
  gain(q, prog, dna, why) { q.prog += prog; q.dna += dna; if (why) this.fx.text(q.x, q.cr.head().y + 2.5, q.z, why, '#c9a8ff', q.p); const lv = this.brainLvl(q); if (lv !== q.lastLvl) { if (q.lastLvl) { toastP(q.p, `Brain level ${lv}. Your pack can be ${this.packMax(q)} strong.`, 'good'); Sfx.good(q.p); this.fx.burst(q.x, q.cr.head().y + 1, q.z, '#c9a8ff', 30, 8, 1); } q.lastLvl = lv; } this.check(q); },
  canEat(q, type) { const d = q.ab.diet; return type === 'fruit' ? d === 'herb' || d === 'omni' : d === 'carn' || d === 'omni'; },
  living(sp) { return this.ents.filter(e => e.sp === sp && !e.dead); },
  check(q) {
    if (q.prog >= BRAIN[5] && !Flow.ready[q.p]) {
      const al = this.species.filter(s => s.allied[q.p]).length, ex = this.species.filter(s => s.extinct && s.kills[q.p] > 0).length, k = q.kills;
      const style = ex > al || (al === 0 && k > 8) ? 'aggr' : al > ex ? 'social' : 'mixed';
      G.players[q.p].dna = Math.floor(q.dna * .5);
      playerDone(q.p, style, [`Befriended ${al} species, drove ${ex} to extinction, ${k} kills.`, 'Your species gathers into its first tribe.']);
    }
  },
  forceStyle(p) { const al = this.species.filter(s => s.allied[p]).length, ex = this.species.filter(s => s.extinct && s.kills[p] > 0).length; G.players[p].dna = Math.floor(this.pl[p].dna * .5); return ex > al ? 'aggr' : al > ex ? 'social' : 'mixed'; },
  summary(p) { const q = this.pl[p], al = this.species.filter(s => s.allied[p]).length, ex = this.species.filter(s => s.extinct && s.kills[p] > 0).length; return [`Befriended ${al} species, drove ${ex} to extinction, ${q.kills} kills, brain level ${this.brainLvl(q)}.`, 'Your species gathers into its first tribe.']; },
  evolveHint(p) { return `go home to your nest and press ${KEYLABEL[p].menu}`; },
  wonderReward(p, kind) {
    const q = this.pl[p], P = G.players[p]; this.gain(q, 30, 20, '+30 brain'); let extra = '';
    if (kind === 'springs') { q.hp = q.maxhp; extra = 'Fully healed.'; }
    else if (kind === 'skytree') { q.hunger = 100; extra = 'You eat your fill.'; }
    else if (kind === 'stones' || kind === 'arch') { for (const sp of this.species) if (!sp.hostile[p] && !sp.allied[p] && !['epic', 'rogue'].includes(sp.temper) && !sp.mate) sp.rel[p] = Math.min(95, sp.rel[p] + 15); extra = 'Every species warms to you a little.'; }
    else { const locked = Object.values(PARTS).filter(d => d.lock && !P.unlocked.includes(d.id) && !/^c_/.test(d.id)); if (locked.length) { const d = pick(locked); P.unlocked.push(d.id); extra = `New part: ${d.name}.`; } else { q.dna += 15; extra = '+15 DNA.'; } }
    return `+30 brain, +20 DNA. ${extra}`;
  },
  onFinish(p, P) { P.pets = this.species.filter(s => s.allied[p] && s.temper !== 'epic' && !s.mate).slice(0, 2).map(s => ({ body: s.body, name: s.name, k: Math.min(1.4, (s.ks[0] + s.ks[1]) / 2) })); },
  alive(e) { return e && !e.dead && !(e.isPlayer && (e.dead > 0 || e.downed > 0)); },
  /* ---------- input ---------- */
  onAction(p, act) {
    const q = this.pl[p]; if (!q || q.dead > 0) return;
    if (q.downed > 0) return;
    if (q.duet) { const s = SOCIALS.find(x => x.act === act); if (s) this.respond(q, s.k); else if (act === 'back' || act === 'menu') this.endDuet(q, false, true); return; }
    if (act === 'a1') this.attack(q);
    else if (act === 'a2') this.special(q);
    else if (act === 'a3') this.greet(q);
    else if (act === 'a4') this.jump(q);
    else if (act === 'menu') this.interact(q);
    else if (act === 'back') this.cycleTarget(q);
  },
  onRelease(p, act) { const q = this.pl && this.pl[p]; if (q && act === 'a4') q.glide = false; },
  cycleTarget(q) {
    const list = this.ents.filter(e => e !== q && this.alive(e) && e.owner !== q.p && Math.hypot(e.x - q.x, e.z - q.z) < 32).sort((a, b) => Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z));
    if (!list.length) return; const i = list.indexOf(q.target); q.target = list[(i + 1) % list.length]; q.lock = 5; Sfx.click(q.p);
  },
  reach(a, b) { return (a.cr.B.len * .5 * a.cr.k) + (b.cr.B.len * .5 * b.cr.k) + 1.2; },
  attack(q) {
    if ((q.cds.atk || 0) > 0 || q.pending) return; const A = q.ab.A, t = q.target, P = G.players[q.p];
    const dn = this.pl[other(q.p)]; if (dn && dn !== q && dn.downed > 0 && canHarm() && Math.hypot(dn.x - q.x, dn.z - q.z) < this.reach(q, dn) + 2) { const st = Math.floor(dn.dna * .2); dn.dna -= st; q.dna += st; q.cds.atk = .6; q.cr.st.bite = .3; this.die(dn); this.fx.text(q.x, q.cr.head().y + 2.5, q.z, `+${st} DNA stolen`, '#f2b544', q.p); toastP(dn.p, `P${q.p + 1} finished you off and took ${st} DNA.`, 'bad'); toastP(q.p, `You finished P${dn.p + 1} and stole ${st} DNA.`, 'good'); Sfx.hit(q.p); return; }
    q.combo.n = q.combo.t > 0 ? q.combo.n + 1 : 1; q.combo.t = 1.1;
    const type = A.strike && (q.combo.n % 2 === 0 || !A.bite) ? 'strike' : 'bite';
    q.cds.atk = Math.max(.32, .62 - A.strike * .05); q.act = type; q.actT = .3; q.combatT = 4;
    if (t && this.alive(t) && !(t.isPlayer && !canHarm()) && !(t.owner === q.p)) {
      const d = Math.hypot(t.x - q.x, t.z - q.z), rch = this.reach(q, t);
      if (d < rch + 5) { q.a = Math.atan2(t.z - q.z, t.x - q.x); const gap = Math.max(0, d - rch * .85); q.lungeV = Math.min(gap / .12, 40); q.lungeT = .12; q.pending = { t, type, at: .12, crit: q.combo.n % 3 === 0 }; Sfx.tone(260, .08, 'square', .02, 1.6, Sfx.pan(q.p)); return; }
    }
    Sfx.tone(220, .06, 'square', .015, 1.2, Sfx.pan(q.p)); q.cr.st.bite = .25;
  },
  special(q) {
    if ((q.cds.spec || 0) > 0) return; const A = q.ab.A, t = this.alive(q.target) ? q.target : null; q.combatT = 4;
    if (A.charge) { q.cds.spec = Math.max(3, 6 - A.charge * .6); if (t) q.a = Math.atan2(t.z - q.z, t.x - q.x); q.charging = .55; q.chargeHit = false; q.act = 'charge'; q.actT = .55; Sfx.tone(160, .35, 'sawtooth', .03, 1.8, Sfx.pan(q.p)); }
    else if (A.spit) { q.cds.spec = Math.max(1.4, 3 - A.spit * .3); q.act = 'spit'; q.actT = .3; this.spit(q, t); }
    else { q.cds.spec = 6; q.act = 'roar'; q.actT = .6; q.cr.st.sing = true; this.roar(q); }
  },
  roar(q) {
    Sfx.tone(120, .5, 'sawtooth', .04, .6, Sfx.pan(q.p)); this.fx.burst(q.x, q.cr.head().y, q.z, '#ffffff', 26, 12, .5); q.shake = .25;
    for (const e of this.ents) { if (e === q || !this.alive(e) || e.owner === q.p) continue; const d = Math.hypot(e.x - q.x, e.z - q.z); if (d > 12) continue; if (e.isPlayer && !canHarm()) continue; const kx = (e.x - q.x) / (d || 1), kz = (e.z - q.z) / (d || 1); e.vx += kx * 10 / (e.k || 1); e.vz += kz * 10 / (e.k || 1); if (!e.isPlayer) { if (e.k < 1.3 && e.sp.temper !== 'epic') { e.state = 'flee'; e.target = q; e.fleeT = 3; } else e.stun = .6; } }
  },
  greet(q) {
    const t = q.target, A = q.ab.A;
    if (!t || !this.alive(t) || t.isPlayer) { q.act = 'sing'; q.actT = .9; Sfx.note(rint(0, 6), q.p); if (t && t.isPlayer) toastP(q.p, 'Offer an accord from your nest menu instead.'); return; }
    const sp = t.sp;
    if (sp.temper === 'epic' || sp.temper === 'rogue') { toastP(q.p, `The ${sp.name} only wants to eat you.`, 'bad'); return; }
    if (sp.hostile[q.p]) { toastP(q.p, `The ${sp.name} are hostile to you now.`, 'bad'); return; }
    if (t.owner >= 0 || (sp.allied[q.p])) { toastP(q.p, t.owner === q.p ? 'Already in your pack.' : `Allies. Press ${KEYLABEL[q.p].menu} to invite one into your pack.`); return; }
    if (t.state === 'sleep') { toastP(q.p, 'It is asleep.'); return; }
    if (sp.cool[q.p] > 0) { toastP(q.p, 'They are ignoring you for a moment.'); return; }
    if (Math.hypot(t.x - q.x, t.z - q.z) > this.reach(q, t) + 12) { toastP(q.p, 'Get closer.'); return; }
    if (t.state === 'duet' || t.state === 'fight') return;
    if (!SOCIALS.some(s => A[s.k])) { toastP(q.p, 'You have no social parts yet. Add a singing mouth, frills, a crest or graspers in the editor.', 'warn'); return; }
    q.duet = { t, sp, ask: pick(sp.favs), round: 0, need: 5, time: 4.5, demo: 1 }; t.state = 'duet'; t.duetWith = q; Sfx.good(q.p);
  },
  jump(q) {
    if (q.lift > .05) { if (q.ab.A.glide) q.glide = true; return; }
    const d = dirOf(q.p);
    if (d.m > 0 && (q.cds.dodge || 0) <= 0) { q.cds.dodge = 1.1; q.dodge = .4; const s = 13 + q.ab.A.speed; q.vx += Math.cos(q.a) * s; q.vz += Math.sin(q.a) * s; q.vy = 5 + q.ab.A.jump; Sfx.tone(500, .1, 'sine', .03, 2, Sfx.pan(q.p)); this.fx.burst(q.x, this.T.ground(q.x, q.z) + .3, q.z, '#ffffff', 8, 4, .4); }
    else { q.vy = 7.5 + q.ab.A.jump * 2.2; Sfx.tone(400, .12, 'sine', .03, 1.5, Sfx.pan(q.p)); }
  },
  interact(q) {
    const p = q.p, o = this.pl[other(p)];
    if (o && o.downed > 0 && Math.hypot(o.x - q.x, o.z - q.z) < 5) { toastP(p, `Hold ${KEYLABEL[p].menu} to revive P${o.p + 1}.`); return; }
    if (Math.hypot(q.x - q.nest.x, q.z - q.nest.z) < 10) { this.openNest(p); return; }
    const bp = this.bones.find(b => !b.dug[p] && Math.hypot(b.x - q.x, b.z - q.z) < 6); if (bp) { this.dig(q, bp); return; }
    const t = q.target; if (t && !t.isPlayer && this.alive(t) && t.sp.allied[p] && t.owner < 0 && Math.hypot(t.x - q.x, t.z - q.z) < 14) { this.recruit(q, t); return; }
    if (t && !t.isPlayer && t.owner === p && Math.hypot(t.x - q.x, t.z - q.z) < 14) { t.owner = -1; t.state = 'idle'; q.pack = q.pack.filter(m => m !== t); toastP(p, 'Pack member released.'); return; }
    toastP(p, 'Nothing to do here. Your nest, bone piles and allied creatures can be used with this key.');
  },
  openNest(p) {
    const q = this.pl[p], P = G.players[p], o = this.pl[other(p)];
    Menus[p].open({ eyebrow: 'Your nest', title: P.name, sub: () => `${q.dna} DNA · brain level ${this.brainLvl(q)} · pack ${q.pack.length}/${this.packMax(q)}`, live: true, items: () => [
      ...evolveItems(p), { head: true, label: 'Nest' },
      { label: 'Change your body in the editor', desc: 'Reshape your body and add parts. The game pauses while you edit.', onSelect: () => { Menus[p].close(); this.openEditor(p); } },
      { label: 'Call a mate', value: '10 DNA', desc: 'A member of your own species joins your pack.', disabled: q.dna < 10 || q.pack.length >= this.packMax(q), onSelect: () => { if (q.dna < 10 || q.pack.length >= this.packMax(q)) return; q.dna -= 10; this.addMate(q); } },
      ...(G.mode === 2 && G.accord && o ? [{ label: `Give 20 DNA to P${o.p + 1}`, disabled: q.dna < 20, onSelect: () => { if (q.dna < 20) return; q.dna -= 20; o.dna += 20; toastP(o.p, `P${p + 1} sent you 20 DNA.`, 'good'); } }] : []),
      { label: 'Release your pack', disabled: !q.pack.length, onSelect: () => { for (const m of q.pack) { m.owner = -1; m.state = 'idle'; } q.pack = []; } },
      ...accordItem(p), { label: 'Close', close: true, onSelect: () => {} }] });
  },
  openEditor(p) {
    const q = this.pl[p];
    Editor.open(p, 'creature', { dna: q.dna, onDone: (saved, wallet) => { q.dna = wallet; if (saved) { this.rebuildPlayer(q); for (const m of q.pack) if (m.mate) this.refreshMate(m, q); toastP(p, 'Your creature has evolved.', 'good'); } saveGame(); } });
  },
  addMate(q) {
    const P = G.players[q.p], sp = { id: 100 + q.p, name: P.name, body: P.body, B: q.B, ab: q.ab, temper: 'peaceful', ks: [.9, .9], allied: [true, true], hostile: [false, false], rel: [100, 100], kills: [0, 0], favs: [], need: 1, mate: true, cool: [0, 0], nest: q.nest };
    const m = this.addNpc(sp, q.nest.x + rand(-3, 3), q.nest.z + rand(-3, 3), false); m.owner = q.p; m.state = 'follow'; m.mate = true; q.pack.push(m); Sfx.good(q.p);
  },
  refreshMate(m, q) { m.cr.dispose(); m.sp.B = q.B; m.sp.ab = q.ab; m.sp.body = G.players[q.p].body; m.cr = new Creature(q.B, m.k); this.scene.add(m.cr.group); },
  recruit(q, t) {
    if (q.pack.length >= this.packMax(q)) { toastP(q.p, `Your pack is full (${q.pack.length}/${this.packMax(q)}). Grow your brain for more room.`, 'warn'); return; }
    t.owner = q.p; t.state = 'follow'; q.pack.push(t); Sfx.good(q.p); toastP(q.p, `A ${t.sp.name} joins your pack.`, 'good');
  },
  dig(q, b) {
    b.dug[q.p] = true; const P = G.players[q.p], locked = Object.values(PARTS).filter(d => d.lock && !P.unlocked.includes(d.id) && !/^c_/.test(d.id));
    this.gain(q, 15, 20, '+15 brain'); this.fx.burst(b.x, this.T.h(b.x, b.z) + 1, b.z, '#ffd34d', 24, 6, .9, 6); Sfx.good(q.p);
    if (locked.length) { const d = pick(locked); P.unlocked.push(d.id); toastP(q.p, `Bones dug up. New part unlocked: ${d.name}. +20 DNA.`, 'good'); } else toastP(q.p, 'Bones dug up. +20 DNA.', 'good');
    if (b.dug.slice(0, G.mode).every(Boolean)) b.beam.visible = false;
  },
  unlockFrom(q, sp) { const P = G.players[q.p], c = sp.body.parts.map(pl => PARTS[pl.id]).filter(d => d && d.lock && !P.unlocked.includes(d.id)); if (c.length) { P.unlocked.push(c[0].id); toastP(q.p, `You learned the ${c[0].name} from the ${sp.name}.`, 'good'); } },
  /* ---------- damage ---------- */
  lvl(e, k) { return e.isPlayer ? e.ab.A[k] : e.sp.ab.A[k]; },
  dmgFor(e, k) { const L = this.lvl(e, k), m = e.isPlayer ? G.players[e.p].mods.dmg : e.owner >= 0 ? G.players[e.owner].mods.dmg : 1, kk = e.isPlayer ? 1 : e.k; return ({ bite: 6 + L * 5, charge: 10 + L * 7, strike: 4 + L * 4.5, spit: 4 + L * 4, roar: 4 }[k]) * m * (.6 + kk * .4) * (e.sp && e.sp.temper === 'epic' ? 1.5 : 1); },
  spit(e, t) {
    const y = e.cr.head().y, m = new THREE.Mesh(sharedGeo('fruit', () => new THREE.SphereGeometry(1, 8, 6)), stdMat(0x9be15a, { emissive: 0x5aa020, emissiveIntensity: 1.2 })); m.scale.setScalar(.28); this.scene.add(m);
    let dx = Math.cos(e.a), dz = Math.sin(e.a); if (t) { const d = Math.hypot(t.x - e.x, t.z - e.z) || 1; dx = (t.x - e.x) / d; dz = (t.z - e.z) / d; }
    this.spits.push({ x: e.x + dx * 1.5, y, z: e.z + dz * 1.5, vx: dx * 24, vz: dz * 24, life: 1, m, from: e, dmg: this.dmgFor(e, 'spit') }); Sfx.tone(600, .1, 'square', .02, .5);
  },
  hit(from, to, dmg, kb = 4, opt = {}) {
    if (!this.alive(to) || (from.isPlayer ? from.dead > 0 || from.downed > 0 : from.dead)) return;
    if (to.isPlayer && from.isPlayer && !canHarm()) return;
    if (to.isPlayer && (to.inv > 0 || to.dodge > 0)) { if (to.dodge > 0) this.fx.text(to.x, to.cr.head().y + 2, to.z, 'dodged', '#5ce1e6', to.p); return; }
    // team combo: both players hitting the same target in accord
    if (from.isPlayer && G.accord && !to.isPlayer) { const o = this.pl[other(from.p)]; if (o && o.lastHitOn === to && this.t - o.lastHitT < 1.6) { dmg *= 1.4; this.fx.text(to.x, to.cr.head().y + 3.2, to.z, 'TEAM COMBO', '#f2b544'); } }
    if (from.isPlayer) { from.lastHitOn = to; from.lastHitT = this.t; }
    if (opt.crit) dmg *= 1.5;
    const d = Math.hypot(to.x - from.x, to.z - from.z) || 1, kx = (to.x - from.x) / d, kz = (to.z - from.z) / d, kk = to.isPlayer ? 1 : to.k;
    to.vx += kx * kb / kk; to.vz += kz * kb / kk;
    if (to.isPlayer) { dmg *= 1 - Math.min(.4, to.ab.A.health * .04); to.hp -= dmg; to.hurtT = 0; to.shake = Math.min(.5, to.shake + .25); Sfx.hurt(to.p); this.fx.text(to.x, to.cr.head().y + 2, to.z, '-' + Math.round(dmg), '#ff4d6d', to.p); if (to.duet) this.endDuet(to, false, true); to.combatT = 4; }
    else { to.hp -= dmg; to.flash = .18; }
    if (from.isPlayer) { this.hitstop = Math.max(this.hitstop, opt.big ? .09 : .05); from.shake = Math.min(.4, from.shake + (opt.big ? .3 : .12)); this.fx.text(to.x, to.cr.head().y + 2.4, to.z, (opt.crit ? '★' : '') + Math.round(dmg), opt.crit ? '#f2b544' : '#ffe2d6', from.p); Sfx.hit(from.p); }
    this.fx.burst(to.x, to.cr.head().y, to.z, opt.crit ? '#f2b544' : '#ffd2c4', opt.big ? 14 : 7, 5, .35);
    to.lastHit = from.isPlayer ? from : from.owner >= 0 ? this.pl[from.owner] : from;
    if (from.isPlayer && !to.isPlayer) this.provoke(from, to);
    if (!to.isPlayer && !from.isPlayer && to.state !== 'fight' && to.sp.temper !== 'skittish' && to.owner < 0) { to.state = 'fight'; to.target = from; }
    if (to.isPlayer && to.hp <= 0) this.down(to, from);
  },
  provoke(q, n) {
    const sp = n.sp; if (sp.mate) return;
    if (!sp.hostile[q.p] && sp.temper !== 'epic') { sp.hostile[q.p] = true; sp.rel[q.p] = 0; if (sp.allied[q.p]) { sp.allied[q.p] = false; for (const m of q.pack.filter(m => m.sp === sp)) { m.owner = -1; m.state = 'idle'; } q.pack = q.pack.filter(m => m.sp !== sp); } toastP(q.p, `The ${sp.name} will remember that.`, 'warn'); }
    for (const o of this.ents) if (!o.isPlayer && o.sp === sp && o.owner < 0 && !o.dead && Math.hypot(o.x - n.x, o.z - n.z) < 45) { if ((sp.temper === 'skittish' || sp.temper === 'peaceful') && !o.alpha) { o.state = 'flee'; o.target = q; o.fleeT = 6; } else { o.state = 'fight'; o.target = q; } }
  },
  /* ---------- social ---------- */
  respond(q, k) {
    const d = q.duet; if (!d) return; const L = q.ab.A[k], P = G.players[q.p];
    q.act = k; q.actT = .9; Sfx.note(SOCIALS.findIndex(s => s.k === k) * 2 + L, q.p); this.fx.burst(q.x, q.cr.head().y + 1, q.z, SOCIALS.find(s => s.k === k).col, 6 + L * 3, 3, .6);
    if (d.demo > 0) return;
    if (!L || k !== d.ask) { this.endDuet(q, false); return; }
    const o = this.pl[other(q.p)], together = G.accord && o && o.duet && o.duet.sp === d.sp;
    const g = Math.round((4 + L * 4) * P.mods.social * (L >= d.sp.need ? 1 : .5) * (together ? 1.6 : 1)); this.addRel(q, d.sp, g); d.round++;
    this.fx.text(d.t.x, d.t.cr.head().y + 3, d.t.z, together ? `+${g} together!` : `+${g}`, '#a6d96a', q.p); this.gain(q, 2, 1);
    if (!q.duet) return;
    if (d.round >= d.need) { this.endDuet(q, true); return; }
    d.ask = pick(d.sp.favs.concat(d.round > 2 ? [pick(SOCIALS).k] : [])); d.time = Math.max(2.4, 4.2 - d.round * .3); d.demo = .7;
  },
  addRel(q, sp, g) {
    sp.rel[q.p] = Math.min(100, sp.rel[q.p] + g);
    if (sp.rel[q.p] >= 100 && !sp.allied[q.p]) { if (q.duet) this.endDuet(q, true); this.allySpecies(q, sp); }
  },
  endDuet(q, good, quiet) {
    const d = q.duet; if (!d) return; if (d.t.state === 'duet') d.t.state = 'idle'; d.t.duetWith = null; q.duet = null;
    if (good) { this.gain(q, 6, 3, 'impressed'); Sfx.good(q.p); }
    else if (!quiet) { d.sp.rel[q.p] = Math.max(0, d.sp.rel[q.p] - 8); d.sp.cool[q.p] = 4; this.fx.text(d.t.x, d.t.cr.head().y + 3, d.t.z, 'unimpressed', '#ff4d6d', q.p); Sfx.bad(q.p); }
  },
  allySpecies(q, sp) {
    const o = this.pl[other(q.p)];
    if (G.mode === 2 && o && sp.allied[o.p] && !G.accord) { sp.allied[o.p] = false; sp.rel[o.p] = 40; for (const m of o.pack.filter(m => m.sp === sp)) { m.owner = -1; m.state = 'idle'; } o.pack = o.pack.filter(m => m.sp !== sp); toastP(o.p, `P${q.p + 1} won the ${sp.name} away from you!`, 'bad'); }
    sp.allied[q.p] = true; this.gain(q, 40, 25, `${sp.name} allied`); Sfx.good(q.p); toastP(q.p, `The ${sp.name} are your allies. Press ${KEYLABEL[q.p].menu} near one to invite it into your pack.`, 'good'); this.unlockFrom(q, sp);
    if (G.mode === 2 && o) { if (G.accord) { if (!sp.allied[o.p]) { sp.allied[o.p] = true; sp.hostile[o.p] = false; this.gain(o, 20, 12, `${sp.name} allied`); toastP(o.p, `Thanks to your accord, the ${sp.name} are allies to you both.`, 'good'); } } else toastP(o.p, `P${q.p + 1} befriended the ${sp.name}. Out-impress them to win the species over.`, 'warn'); }
    for (const e of this.events) if (e.kind === 'bounty' && e.n.sp === sp) this.claimBounty(e, q);
  },
  /* ---------- death, downed and revive ---------- */
  down(q, by) {
    if (q.dead > 0 || q.downed > 0) return; const o = this.pl[other(q.p)];
    Menus[q.p].close(); if (q.duet) this.endDuet(q, false, true); q.charging = 0; q.pending = null;
    for (const e of this.ents) if (e.target === q) { e.target = null; if (e.state === 'fight') e.state = 'idle'; }
    if (G.mode === 2 && o && this.alive(o) && Math.hypot(o.x - q.x, o.z - q.z) < 80) { q.downed = 14; q.hp = 0; q.revT = 0; q.downBy = by && by.isPlayer ? by.p : -1; toastP(q.p, `Downed! P${o.p + 1} can revive you.`, 'bad'); toastP(o.p, G.accord ? `P${q.p + 1} is down! Hold ${KEYLABEL[o.p].menu} next to them to revive.` : `P${q.p + 1} is down. Revive them (${KEYLABEL[o.p].menu}), or finish them with an attack to steal DNA.`, 'warn'); Sfx.bad(q.p); return; }
    this.die(q);
  },
  die(q) {
    if (q.dead > 0) return; q.downed = 0; q.dead = 4; q.cr.setVisible(false); Menus[q.p].close(); if (q.duet) this.endDuet(q, false, true);
    this.fx.burst(q.x, q.cr.head().y, q.z, hueCss(G.players[q.p].hue), 22, 7, 1, 6); Sfx.bad(q.p);
    for (const e of this.ents) if (e.target === q) { e.target = null; if (e.state === 'fight') e.state = 'idle'; }
    for (const o of this.pl) if (o.target === q) o.target = null;
  },
  respawn(q) {
    q.dead = 0; q.downed = 0; q.x = q.nest.x + rand(-2, 2); q.z = q.nest.z - 13; q.a = q.camYaw = -Math.PI / 2; q.vx = q.vz = 0; q.lift = 0; q.vy = 0; q.hp = q.maxhp; q.hunger = Math.max(q.hunger, 70); q.inv = 3; q.duet = null; q.target = null; q.charging = 0; q.pending = null; q.cds = {};
    Menus[q.p].close(); q.cr.setVisible(true); q.cr.init = false; q.cr.update(0, q.x, q.z, q.a, this.ground); Panes[q.p].wait(false);
    for (const m of q.pack) { m.x = q.x + rand(-4, 4); m.z = q.z + rand(-4, 4); m.cr.init = false; m.state = 'follow'; m.target = null; }
  },
  /* ---------- per frame ---------- */
  update(dt0) {
    let dt = dt0; if (this.hitstop > 0) { this.hitstop -= dt0; dt = dt0 * .12; }
    this.t += dt; let mx = 0, mz = 0; for (const q of this.pl) { mx += q.x / this.pl.length; mz += q.z / this.pl.length; }
    this.day.update(dt, mx, mz); this.wfx.update(dt0, this.pl);
    const spread = this.pl.length > 1 ? Math.hypot(this.pl[0].x - this.pl[1].x, this.pl[0].z - this.pl[1].z) : 0, ss = clamp(spread / 2 + 45, 50, 200), c = this.sun.shadow.camera;
    if (Math.abs(c.right - ss) > 4) { c.left = -ss; c.right = ss; c.top = ss; c.bottom = -ss; c.updateProjectionMatrix(); }
    for (const sp of this.species) { sp.cool[0] = Math.max(0, sp.cool[0] - dt); sp.cool[1] = Math.max(0, sp.cool[1] - dt); }
    for (const q of this.pl) safely(() => this.updatePlayer(q, dt), () => this.respawn(q));
    for (const e of this.ents) if (!e.isPlayer && !e.dead) safely(() => this.updateNpc(e, dt), () => { e.hp = 0; });
    this.separate();
    for (const e of this.ents) { if (e.isPlayer || e.dead || e.hp > 0) continue; this.killNpc(e); }
    this.ents = this.ents.filter(e => e.isPlayer || !e.dead);
    for (const sp of this.species) {
      if (sp.extinct || sp.mate) continue; sp.breedT -= dt; const alive = this.living(sp).filter(n => n.owner < 0);
      if (sp.temper === 'rogue' || sp.temper === 'epic') { if (!alive.length && sp.breedT <= 0) { sp.breedT = 150; this.addNpc(sp, sp.nest.x, sp.nest.z, true); } continue; }
      if (sp.breedT <= 0) { sp.breedT = 55; if (alive.length >= 2 && alive.length < sp.n0) this.addNpc(sp, sp.nest.x + rand(-4, 4), sp.nest.z + rand(-4, 4), false); }
    }
    for (const b of this.bushes) { b.regen += dt; if (b.regen > 16 && b.fruit < 4) { b.fruit++; b.regen = 0; } for (let i = 0; i < 4; i++) b.fr[i].visible = i < b.fruit; }
    for (const m of this.meat) { m.life -= dt; if (m.life <= 0) this.scene.remove(m.mesh); } this.meat = this.meat.filter(m => m.life > 0);
    for (const s of this.spits) { s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt; s.y = lerp(s.y, this.T.ground(s.x, s.z) + .8, dt * 2); s.m.position.set(s.x, s.y, s.z); for (const e of this.ents) { if (e === s.from || !this.alive(e) || (e.owner >= 0 && s.from.isPlayer && e.owner === s.from.p) || (s.from.owner >= 0 && e.isPlayer && e.p === s.from.owner)) continue; if (!s.from.isPlayer && !e.isPlayer && e.sp === s.from.sp) continue; if (Math.hypot(e.x - s.x, e.z - s.z) < e.cr.B.radius * e.cr.k + .6) { this.hit(s.from, e, s.dmg, 3); s.life = 0; break; } } if (s.life <= 0) { this.scene.remove(s.m); this.fx.burst(s.x, s.y, s.z, '#9be15a', 8, 4, .4); } }
    this.spits = this.spits.filter(s => s.life > 0);
    for (const b of this.bones) b.beam.material.opacity = .1 + .06 * Math.sin(this.t * 2);
    this.updateEvents(dt);
    Disc.update(dt, p => { const q = this.pl[p]; return q && this.alive(q) ? q : null; });
    this.fx.update(dt0);
  },
  separate() {
    const E = this.ents.filter(e => !e.dead && !(e.isPlayer && e.dead > 0)); for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j], dx = b.x - a.x, dz = b.z - a.z; if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue; const d = Math.hypot(dx, dz), rr = (a.cr.B.radius * a.cr.k + b.cr.B.radius * b.cr.k) * .55; if (d >= rr || d < 1e-4) continue;
      const push = (rr - d) / d * .5, wa = b.cr.k / (a.cr.k + b.cr.k); a.x -= dx * push * wa; a.z -= dz * push * wa; b.x += dx * push * (1 - wa); b.z += dz * push * (1 - wa);
    }
  },
  killNpc(e) {
    e.dead = true; e.cr.dispose(); const r = e.cr.B.radius * e.k;
    const m = new THREE.Mesh(sharedGeo('fruit', () => new THREE.SphereGeometry(1, 8, 6)), stdMat(0xb8432e, { roughness: .5 })); m.scale.set(r * .8, r * .35, r * .6); m.position.set(e.x, this.T.ground(e.x, e.z) + r * .2, e.z); m.castShadow = true; this.scene.add(m); this.meat.push({ x: e.x, z: e.z, mesh: m, life: 70, food: 3 });
    this.fx.burst(e.x, e.cr.head().y, e.z, hueCss(e.sp.body.paint.h1), 20, 7, .8, 6);
    const k = e.lastHit && e.lastHit.isPlayer ? e.lastHit : null;
    if (k && !e.sp.mate) {
      e.sp.kills[k.p]++; k.kills++; const T = e.sp.temper, big = T === 'epic' ? 60 : T === 'rogue' ? 30 : e.alpha ? 15 : 6;
      this.gain(k, big, T === 'epic' ? 50 : T === 'rogue' ? 25 : 6, T === 'epic' ? 'Epic slain!' : T === 'rogue' ? 'Rogue slain!' : '+brain'); if (T === 'epic' || T === 'rogue') toastAll(`P${k.p + 1} brought down the ${e.sp.name}!`, 'good');
      if (e.raiding !== undefined) { this.gain(k, 8, 4, 'raider repelled'); }
      for (const ev of this.events) if (ev.kind === 'bounty' && ev.n === e) this.claimBounty(ev, k);
      const o = this.pl[other(k.p)]; if (G.accord && o && o.lastHitOn === e) { this.gain(o, Math.round(big / 2), 3, 'assist'); }
    }
    if (e.owner >= 0) { const q = this.pl[e.owner]; q.pack = q.pack.filter(x => x !== e); toastP(e.owner, 'A pack member has fallen.', 'bad'); }
    for (const q of this.pl) if (q.target === e) q.target = null;
    for (const o of this.ents) if (o.target === e) { o.target = null; if (o.state === 'fight') o.state = 'idle'; }
    const sp = e.sp;
    if (!sp.mate && sp.temper !== 'epic' && sp.temper !== 'rogue' && !sp.extinct && !this.living(sp).length) { sp.extinct = true; toastAll(`The ${sp.name} are extinct.`, 'warn'); if (k) { this.gain(k, 30, 15, 'extinct'); this.unlockFrom(k, sp); } }
    if (sp.temper === 'epic' || sp.temper === 'rogue') sp.breedT = 150;
  },
  updatePlayer(q, dt) {
    const P = G.players[q.p], pane = Panes[q.p], A = q.ab.A;
    for (const k in q.cds) q.cds[k] -= dt;
    q.shake = Math.max(0, q.shake - dt * 1.6);
    if (q.dead > 0) { q.dead -= dt; pane.wait(true, 'You died', `Hatching again at your nest in ${Math.ceil(q.dead)}…`); if (q.dead <= 0) this.respawn(q); this.hud(q); return; }
    if (q.downed > 0) {
      q.downed -= dt; const o = this.pl[other(q.p)]; pane.wait(true, 'Downed', `${o && this.alive(o) ? `P${o.p + 1} can revive you` : 'Waiting'} · ${Math.ceil(q.downed)}s`);
      const d = dirOf(q.p); if (d.m) { q.x += d.x * 1.2 * dt; q.z += d.z * 1.2 * dt; }
      if (o && this.alive(o) && Math.hypot(o.x - q.x, o.z - q.z) < 5 && held(o.p, 'menu')) { q.revT += dt; if (q.revT >= 1.5) { q.downed = 0; q.hp = q.maxhp * .5; q.inv = 2; pane.wait(false); toastP(q.p, `P${o.p + 1} revived you!`, 'good'); toastP(o.p, `You revived P${q.p + 1}.`, 'good'); this.gain(o, G.accord ? 10 : 15, 5, 'revived'); Sfx.good(o.p); } }
      else q.revT = Math.max(0, q.revT - dt);
      if (q.downed <= 0 && q.hp <= 0) this.die(q);
      q.cr.st.sleep = true; q.cr.update(dt, q.x, q.z, q.a, this.ground); this.hud(q); return;
    }
    if (q.hp <= 0) { this.down(q, null); return; }
    q.cr.st.sleep = false; q.actT -= dt; q.hurtT = (q.hurtT || 9) + dt; q.inv -= dt; q.dodge -= dt; q.combo.t -= dt; q.combatT -= dt; q.lock = (q.lock || 0) - dt;
    const menu = Menus[q.p].isOpen; let d = menu || q.duet ? { x: 0, z: 0, m: 0 } : dirOf(q.p);
    // camera-relative movement
    const cy = q.camYaw, fx = Math.cos(cy), fz = Math.sin(cy), mvx = fx * -d.z + -fz * d.x, mvz = fz * -d.z + fx * d.x, mm = Math.hypot(mvx, mvz);
    if (mm > .1) q.sprintT += dt; else q.sprintT = 0;
    const sprint = q.sprintT > 1.4 && q.stam > .2; q.stam = clamp(q.stam + (sprint ? -dt : dt * .6), 0, 3 + A.speed * .4);
    const inW = this.T.isWater(q.x, q.z);
    let spd = q.speed * (sprint ? 1.55 : 1) * (inW && q.lift < .5 ? .62 : 1) * d.m;
    if (q.charging > 0) { q.charging -= dt; spd = q.speed * 2.8; q.x += Math.cos(q.a) * spd * dt; q.z += Math.sin(q.a) * spd * dt; if (Math.random() < .5) this.fx.burst(q.x, this.T.ground(q.x, q.z) + .3, q.z, '#e8dcc8', 2, 3, .4); for (const e of this.ents) { if (q.chargeHit || e === q || !this.alive(e) || e.owner === q.p || (e.isPlayer && !canHarm())) continue; if (Math.hypot(e.x - q.x, e.z - q.z) < this.reach(q, e)) { q.chargeHit = true; this.hit(q, e, this.dmgFor(q, 'charge'), 12, { big: true }); e.stun = 1; q.charging = 0; } } }
    else if (q.lungeT > 0) { q.lungeT -= dt; q.x += Math.cos(q.a) * q.lungeV * dt; q.z += Math.sin(q.a) * q.lungeV * dt; }
    else if (mm > .1) { const ta = Math.atan2(mvz, mvx); q.a = lerpAng(q.a, ta, dt * 10); q.x += Math.cos(ta) * spd * dt; q.z += Math.sin(ta) * spd * dt; }
    if (q.pending) { q.pending.at -= dt; if (q.pending.at <= 0) { const pd = q.pending; q.pending = null; if (this.alive(pd.t) && Math.hypot(pd.t.x - q.x, pd.t.z - q.z) < this.reach(q, pd.t) + 1.4) this.hit(q, pd.t, this.dmgFor(q, pd.type) * (pd.type === 'bite' && !A.bite ? .6 : 1), pd.crit ? 6 : 3.5, { crit: pd.crit }); } }
    // knockback and gravity
    q.x += q.vx * dt; q.z += q.vz * dt; const fr = Math.max(0, 1 - dt * 6); q.vx *= fr; q.vz *= fr;
    q.vy -= (q.glide && A.glide && q.vy < 0 ? 4 : 24) * dt; if (q.glide && A.glide && q.vy < -1.5) q.vy = -1.5 + A.glide * .2; q.lift = Math.max(0, q.lift + q.vy * dt); if (q.lift <= 0) { q.vy = 0; q.glide = false; }
    const Bd = this.T.B * .8; q.x = clamp(q.x, -Bd, Bd); q.z = clamp(q.z, -Bd, Bd);
    // camera follows heading, or frames the fight
    const t = this.alive(q.target) ? q.target : null;
    if (q.combatT > 0 && t && Math.hypot(t.x - q.x, t.z - q.z) < 25) q.camYaw = lerpAng(q.camYaw, Math.atan2(t.z - q.z, t.x - q.x), dt * 1.6);
    else if (mm > .1 && (mvx * fx + mvz * fz) > -.3) q.camYaw = lerpAng(q.camYaw, q.a, dt * 1.3);
    // needs
    q.hunger -= dt * .4; if (q.hunger <= 0) { q.hunger = 0; q.hp -= 2 * dt; q.hurtT = 0; if (q.hp <= 0) this.die(q); }
    const atNest = Math.hypot(q.x - q.nest.x, q.z - q.nest.z) < 10;
    q.hp = Math.min(q.maxhp, q.hp + q.maxhp * ((atNest ? .08 : q.hurtT > 5 && q.hunger > 25 ? .03 : 0)) * dt);
    for (const b of this.bushes) if (b.fruit > 0 && q.hunger < 92 && this.canEat(q, 'fruit') && Math.hypot(b.x - q.x, b.z - q.z) < 3 + q.cr.B.len * .5) { b.fruit--; q.hunger = Math.min(100, q.hunger + 24 * P.mods.econ); this.gain(q, 1, 1); q.cr.st.eat = .6; Sfx.eat(q.p); }
    for (const m of this.meat) if (m.food > 0 && q.hunger < 94 && this.canEat(q, 'meat') && Math.hypot(m.x - q.x, m.z - q.z) < 2.5 + q.cr.B.len * .5) { m.food--; q.hunger = Math.min(100, q.hunger + 32); this.gain(q, 1, 2); q.cr.st.eat = .6; Sfx.eat(q.p); if (m.food <= 0) m.life = 0; }
    // auto-targeting: nearest in front, sticky; manual choice holds for a while
    const tv = t && Math.hypot(t.x - q.x, t.z - q.z) < 34 && (q.lock > 0 || q.combatT > 0 || Math.abs(angDiff(q.a, Math.atan2(t.z - q.z, t.x - q.x))) < 1.7);
    if (!q.duet && !tv) { let best = null, bs = 1e9; for (const e of this.ents) { if (e === q || !this.alive(e) || e.owner === q.p) continue; const dx = e.x - q.x, dz = e.z - q.z, dd = Math.hypot(dx, dz); if (dd > 28) continue; const da = Math.abs(angDiff(q.a, Math.atan2(dz, dx))); if (da > 1.2) continue; const sc = dd + da * 9 - (e.state === 'fight' && e.target === q ? 12 : 0); if (sc < bs) { bs = sc; best = e; } } q.target = best; }
    if (q.duet) { const du = q.duet; if (du.demo > 0) du.demo -= dt; else du.time -= dt; if (du.time <= 0) this.endDuet(q, false); else if (!this.alive(du.t)) q.duet = null; else q.a = lerpAng(q.a, Math.atan2(du.t.z - q.z, du.t.x - q.x), dt * 4); }
    // animation
    const cs = q.cr.st; cs.bite = (q.act === 'bite' && q.actT > 0) || cs.bite > 0 ? (cs.bite > 0 ? cs.bite - dt : 1) : 0; cs.strike = q.act === 'strike' && q.actT > 0 ? 1 : 0; cs.charge = q.charging > 0; cs.sing = (q.act === 'sing' || q.act === 'roar') && q.actT > 0; cs.dance = q.act === 'dance' && q.actT > 0; cs.charm = q.act === 'charm' && q.actT > 0; cs.pose = q.act === 'pose' && q.actT > 0; cs.eat = cs.eat > 0 ? cs.eat - dt : 0; cs.lunge = (q.act === 'spit' && q.actT > 0) || q.lungeT > 0 ? 1 : 0;
    q.cr.look = t ? clamp(angDiff(q.a, Math.atan2(t.z - q.z, t.x - q.x)), -1, 1) : 0;
    const swim = inW ? Math.max(0, -this.T.h(q.x, q.z) - q.cr.B.dy * .6) : 0;
    q.cr.update(dt, q.x, q.z, q.a, this.ground, q.lift + swim);
    q.cr.mesh.visible = !(q.inv > 0 && Math.floor(q.inv * 12) % 2);
    pane.wait(false); this.hud(q);
  },
  updateNpc(n, dt) {
    const sp = n.sp, T = sp.temper; for (const k in n.cds) n.cds[k] -= dt; n.flash -= dt; n.think -= dt; n.stun -= dt; n.hungerT -= dt;
    const night = this.day.isNight;
    let near = 1e9; for (const q of this.pl) near = Math.min(near, Math.hypot(q.x - n.x, q.z - n.z)); n.cr.setVisible(near < 140);
    n.x += n.vx * dt; n.z += n.vz * dt; const fr = Math.max(0, 1 - dt * 5); n.vx *= fr; n.vz *= fr;
    if (n.think <= 0) { n.think = .35 + Math.random() * .3; this.decide(n, night); }
    // morale: wounded animals run for it
    if (!n.fled && n.owner < 0 && n.hp < n.maxhp * .25 && T !== 'epic' && T !== 'rogue' && !(T === 'territorial' && n.alpha) && n.state === 'fight') { n.fled = true; n.state = 'flee'; n.fleeT = 8; n.target = n.target || null; }
    if (n.state !== 'fight') n.windup = null;
    let tx = null, tz = null, spd = n.speed * .45;
    switch (n.state) {
      case 'follow': {
        const q = this.pl[n.owner]; if (!q) { n.owner = -1; n.state = 'idle'; break; }
        if (q.dead > 0) { tx = q.nest.x; tz = q.nest.z; spd = n.speed; break; }
        const foe = (q.combatT > 0 && this.alive(q.target) && q.target !== n && q.target.owner !== q.p && !(q.target.isPlayer && !canHarm())) ? q.target : this.ents.find(e => !e.dead && !e.isPlayer && e.state === 'fight' && (e.target === q || e.target === n));
        if (foe && Math.hypot(foe.x - q.x, foe.z - q.z) < 35) { this.fightStep(n, foe, dt); return; }
        const i = q.pack.indexOf(n), fa = q.a + Math.PI + (i - 1.5) * .6, R = 5 + q.cr.B.len + i, fx = q.x + Math.cos(fa) * R, fz = q.z + Math.sin(fa) * R;
        if (Math.hypot(fx - n.x, fz - n.z) > 2) { tx = fx; tz = fz; spd = Math.max(n.speed, q.speed) * 1.15; }
        n.hp = Math.min(n.maxhp, n.hp + 1.5 * dt); break;
      }
      case 'fight': { const t = n.target; if (!this.alive(t) || (t.isPlayer && t.inv > 0) || Math.hypot(t.x - n.x, t.z - n.z) > 65) { n.state = 'idle'; n.target = null; n.windup = null; break; } this.fightStep(n, t, dt); return; }
      case 'flee': { const t = n.target; n.fleeT = (n.fleeT || 4) - dt; if (n.fleeT <= 0) { n.state = 'idle'; break; } if (t && !t.dead) { tx = n.x + (n.x - t.x); tz = n.z + (n.z - t.z); } else { tx = sp.nest.x; tz = sp.nest.z; } spd = n.speed * 1.12; n.hp = Math.min(n.maxhp, n.hp + 2 * dt); break; }
      case 'raid': { const q = this.pl[n.raiding]; if (!q) { n.state = 'idle'; break; } const d = Math.hypot(q.nest.x - n.x, q.nest.z - n.z); if (this.alive(q) && Math.hypot(q.x - n.x, q.z - n.z) < 18 && q.inv <= 0) { n.state = 'fight'; n.target = q; break; } if (d > 6) { tx = q.nest.x; tz = q.nest.z; spd = n.speed * .9; } else { n.lootT = (n.lootT || 0) + dt; n.cr.st.eat = 1; if (n.lootT > 6) { n.lootT = 0; const lost = Math.min(q.dna, 10); q.dna -= lost; if (lost) { toastP(q.p, `Raiders are stealing from your nest! -${lost} DNA`, 'bad'); this.fx.text(q.nest.x, this.T.ground(q.nest.x, q.nest.z) + 3, q.nest.z, `-${lost} DNA`, '#ff4d6d', q.p); } n.raidLoots = (n.raidLoots || 0) + 1; if (n.raidLoots >= 4) { n.state = 'idle'; n.raiding = undefined; n.cr.st.eat = 0; } } } break; }
      case 'lurk': { n.cr.st.sleep = true; n.cr.update(dt, n.x, n.z, n.a, this.ground); return; }
      case 'eat': { const m = n.target; if (!m || (m.life !== undefined && m.life <= 0) || (m.fruit !== undefined && m.fruit <= 0)) { n.state = 'idle'; break; } if (Math.hypot(m.x - n.x, m.z - n.z) > 2.5 + n.cr.B.len * n.k * .5) { tx = m.x; tz = m.z; spd = n.speed * .7; } else { n.eatT = (n.eatT || 0) + dt; n.cr.st.eat = 1; if (n.eatT > 2.5) { n.eatT = 0; n.cr.st.eat = 0; if (m.food !== undefined) { m.food--; if (m.food <= 0) m.life = 0; } else m.fruit--; n.hungerT = rand(50, 90); n.state = 'idle'; } } break; }
      case 'sleep': n.cr.st.sleep = true; n.cr.update(dt, n.x, n.z, n.a, this.ground); return;
      case 'duet': { const q = n.duetWith; if (!q || !q.duet) { n.state = 'idle'; break; } n.a = lerpAng(n.a, Math.atan2(q.z - n.z, q.x - n.x), dt * 5); const s = n.cr.st; for (const k of ['sing', 'dance', 'charm', 'pose']) s[k] = q.duet.ask === k && q.duet.demo > 0; n.cr.update(dt, n.x, n.z, n.a, this.ground); return; }
      default: {
        n.wa += rand(-1, 1) * dt * 1.5; const hx = sp.nest.x - n.x, hz = sp.nest.z - n.z, hd = Math.hypot(hx, hz), roam = T === 'giant' ? 80 : T === 'aggressive' ? 75 : T === 'spitter' ? 50 : 38;
        if (T === 'rogue' || T === 'epic') { if (!n.roamTo || Math.hypot(n.roamTo.x - n.x, n.roamTo.z - n.z) < 8) n.roamTo = { x: rand(-230, 230), z: rand(-230, 230) }; tx = n.roamTo.x; tz = n.roamTo.z; spd = n.speed * .45; break; }
        if (T === 'peaceful' || T === 'giant') { let ax = 0, az = 0, cx = 0, cz = 0, sx = 0, sz = 0, k = 0; for (const o of this.ents) { if (o === n || o.sp !== sp || o.dead || o.owner >= 0) continue; const dx = o.x - n.x, dz = o.z - n.z, dd = Math.hypot(dx, dz); if (dd < 20) { ax += Math.cos(o.a); az += Math.sin(o.a); cx += o.x; cz += o.z; k++; if (dd < 4 && dd > 0) { sx -= dx / dd; sz -= dz / dd; } } } if (k) { const vx = Math.cos(n.wa) + ax / k * .6 + (cx / k - n.x) * .05 + sx * 1.2, vz = Math.sin(n.wa) + az / k * .6 + (cz / k - n.z) * .05 + sz * 1.2; n.wa = lerpAng(n.wa, Math.atan2(vz, vx), dt * 2); } }
        if (hd > roam) n.wa = Math.atan2(hz, hx);
        if (this.T.isWater(n.x + Math.cos(n.wa) * 6, n.z + Math.sin(n.wa) * 6)) n.wa += 1.3;
        tx = n.x + Math.cos(n.wa) * 10; tz = n.z + Math.sin(n.wa) * 10; spd = n.speed * (T === 'skittish' ? .55 : .35);
      }
    }
    n.cr.st.sleep = false; if (n.cr.st.eat && n.state !== 'eat' && n.state !== 'raid') n.cr.st.eat = 0; for (const k of ['sing', 'dance', 'charm', 'pose']) n.cr.st[k] = false;
    if (tx !== null && n.stun <= 0) this.moveNpc(n, tx, tz, spd, dt); else this.animNpc(n, dt);
  },
  decide(n, night) {
    const sp = n.sp, T = sp.temper; if (n.owner >= 0) { if (n.state !== 'fight') n.state = 'follow'; return; }
    if (n.state === 'duet' || n.state === 'raid' || (n.state === 'eat' && n.target) || n.state === 'flee') return;
    if (n.state === 'fight' && this.alive(n.target)) return;
    // ambushers lie in wait and pounce
    if (T === 'ambusher') {
      for (const q of this.pl) { if (!this.alive(q) || q.inv > 0 || sp.allied[q.p]) continue; const d = Math.hypot(q.x - n.x, q.z - n.z); if (d < 13 - q.ab.A.sneak * 1.8) { n.state = 'fight'; n.target = q; n.windup = { k: 'pounce', t: .35, total: .35 }; return; } }
      if (n.state === 'lurk') return;
      if (n.state === 'idle' && Math.hypot(sp.nest.x - n.x, sp.nest.z - n.z) < 30 && Math.random() < .3) { n.state = 'lurk'; return; }
    }
    if (T === 'nocturnal' && !night) { if (Math.hypot(sp.nest.x - n.x, sp.nest.z - n.z) < 9 || n.state === 'sleep') { n.state = 'sleep'; return; } n.state = 'idle'; n.wa = Math.atan2(sp.nest.z - n.z, sp.nest.x - n.x); return; }
    if (!['nocturnal', 'epic', 'rogue', 'ambusher'].includes(T) && night && Math.hypot(sp.nest.x - n.x, sp.nest.z - n.z) < 12 && Math.random() < .4) { n.state = 'sleep'; return; }
    if (n.state === 'sleep' && night && T !== 'nocturnal') return;
    if (T === 'peaceful' || T === 'skittish') {
      let th = null, td = T === 'skittish' ? 26 : 20;
      for (const e of this.ents) { if (!this.alive(e) || e === n) continue; const d = Math.hypot(e.x - n.x, e.z - n.z); if (d > td) continue; const danger = e.isPlayer ? (sp.hostile[e.p] || (T === 'skittish' && !sp.allied[e.p] && d < 9 && !e.duet)) : (e.owner < 0 && e.sp !== sp && ((e.state === 'fight' && e.target && e.target.sp === sp) || e.sp.temper === 'epic' || e.sp.temper === 'rogue')); if (danger) { th = e; td = d; } }
      if (th) { if (n.alpha && T === 'peaceful' && th.isPlayer && sp.hostile[th.p]) { n.state = 'fight'; n.target = th; return; } n.state = 'flee'; n.target = th; n.fleeT = 4; for (const o of this.ents) if (o.sp === sp && !o.dead && o.owner < 0 && o.state !== 'fight' && Math.hypot(o.x - n.x, o.z - n.z) < 24) { o.state = 'flee'; o.target = th; o.fleeT = 4; } return; }
    }
    // aggression toward players
    for (const q of this.pl) {
      if (!this.alive(q) || q.inv > 0 || sp.allied[q.p]) continue; const d = Math.hypot(q.x - n.x, q.z - n.z), sneak = q.ab.A.sneak * 2;
      const go = T === 'territorial' ? Math.hypot(q.x - sp.nest.x, q.z - sp.nest.z) < 22 : T === 'aggressive' ? d < 18 - sneak && sp.rel[q.p] < 30 : T === 'nocturnal' ? night && d < 26 - sneak : T === 'epic' || T === 'rogue' ? d < 28 - sneak : T === 'spitter' ? d < 20 - sneak && sp.rel[q.p] < 30 : sp.hostile[q.p] && d < 18;
      if (go && !(q.duet && q.duet.sp === sp)) { n.state = 'fight'; n.target = q; if (T === 'aggressive') for (const o of this.ents) if (o.sp === sp && o !== n && !o.dead && o.owner < 0 && o.state !== 'fight' && Math.hypot(o.x - n.x, o.z - n.z) < 40) { o.state = 'fight'; o.target = q; } return; }
      if (T === 'territorial' && Math.hypot(q.x - sp.nest.x, q.z - sp.nest.z) < 32 && !n.warned) { n.warned = 4; this.fx.text(n.x, n.cr.head().y + 2.5, n.z, 'GRRR', '#ffb347', q.p); }
    }
    if (n.warned) n.warned = Math.max(0, n.warned - .5);
    // predators hunt other species, rogues and epics attack anything
    if ((T === 'aggressive' || (T === 'nocturnal' && night) || T === 'epic' || T === 'rogue') && n.hungerT <= 0) {
      if (sp.target && !sp.target.dead && Math.hypot(sp.target.x - n.x, sp.target.z - n.z) < 120) { n.state = 'fight'; n.target = sp.target; return; }
      let prey = null, pd = 170; for (const e of this.ents) { if (e.dead || e.isPlayer || e.sp === sp || e.owner >= 0 || e.sp.mate || !(e.sp.temper === 'peaceful' || e.sp.temper === 'skittish' || ((T === 'epic' || T === 'rogue') && e.k < n.k))) continue; const d = Math.hypot(e.x - n.x, e.z - n.z); if (d < pd) { pd = d; prey = e; } }
      if (prey) { n.state = 'fight'; n.target = prey; sp.target = prey; n.hungerT = rand(60, 100); return; }
    }
    if (n.hungerT <= 0) {
      if (sp.diet !== 'herb') { let m = null, md = 70; for (const x of this.meat) { const d = Math.hypot(x.x - n.x, x.z - n.z); if (d < md) { md = d; m = x; } } if (m) { n.state = 'eat'; n.target = m; return; } }
      if (sp.diet !== 'carn') { let b = null, bd = 60; for (const x of this.bushes) { if (x.fruit < 1) continue; const d = Math.hypot(x.x - n.x, x.z - n.z); if (d < bd) { bd = d; b = x; } } if (b) { n.state = 'eat'; n.target = b; return; } }
      n.hungerT = rand(20, 40);
    }
    if (n.state !== 'lurk') n.state = 'idle';
  },
  /* enemies wind up before they hit, so players can see it coming and get out of the way */
  fightStep(n, t, dt) {
    const d = Math.hypot(t.x - n.x, t.z - n.z), reach = this.reach(n, t), A = n.sp.ab.A, T = n.sp.temper;
    n.cr.look = clamp(angDiff(n.a, Math.atan2(t.z - n.z, t.x - n.x)), -1, 1);
    if (n.windup) {
      const w = n.windup; w.t -= dt; n.a = lerpAng(n.a, Math.atan2(t.z - n.z, t.x - n.x), dt * 6); n.cr.st.pose = w.k !== 'spit'; n.cr.st.bite = 0;
      if (w.t <= 0) {
        n.windup = null; n.cr.st.pose = false;
        if (w.k === 'spit') { this.spit(n, t); n.cds.spit = 3; }
        else if (w.k === 'charge' || w.k === 'pounce') { n.dash = { t: w.k === 'pounce' ? .35 : .5, hit: false, k: w.k }; n.cds.charge = 6; }
        else if (d < reach + 1.3) { n.cr.st.bite = .3; this.hit(n, t, this.dmgFor(n, w.k) * (A[w.k] || w.k === 'bite' ? 1 : .5), w.k === 'strike' ? 3 : 4.5); }
        n.cds[w.k] = (COMBAT.find(c => c.k === w.k) || { cd: 1.2 }).cd * 1.2;
      }
      this.animNpc(n, dt); return;
    }
    if (n.dash) {
      n.dash.t -= dt; const s = n.speed * (n.dash.k === 'pounce' ? 3.4 : 2.7); n.x += Math.cos(n.a) * s * dt; n.z += Math.sin(n.a) * s * dt; n.cr.st.charge = true;
      if (!n.dash.hit && d < reach + .4) { n.dash.hit = true; this.hit(n, t, this.dmgFor(n, n.dash.k === 'pounce' ? 'bite' : 'charge') * (n.dash.k === 'pounce' ? 1.4 : 1), 10, { big: true }); }
      if (n.dash.t <= 0) { n.dash = null; n.cr.st.charge = false; }
      this.animNpc(n, dt, n.dash ? 1 : 0); return;
    }
    // spitters keep their distance
    if (T === 'spitter' && A.spit) {
      if (d < 8) { this.moveNpc(n, n.x + (n.x - t.x), n.z + (n.z - t.z), n.speed * .9, dt); }
      else if (d > 15) this.moveNpc(n, t.x, t.z, n.speed, dt);
      else { n.a = lerpAng(n.a, Math.atan2(t.z - n.z, t.x - n.x), dt * 6); this.animNpc(n, dt); }
      if ((n.cds.spit || 0) <= 0 && d < 18) n.windup = { k: 'spit', t: .45, total: .45 };
      return;
    }
    if (A.charge && d > reach + 3 && d < 14 && (n.cds.charge || 0) <= 0 && n.stun <= 0) { n.a = Math.atan2(t.z - n.z, t.x - n.x); n.windup = { k: 'charge', t: .7, total: .7 }; this.animNpc(n, dt); return; }
    if (A.spit && d > reach + 2 && d < 14 && (n.cds.spit || 0) <= 0) n.windup = { k: 'spit', t: .4, total: .4 };
    if (d > reach * .95) {
      let gx = t.x, gz = t.z;
      if (n.sp.temper === 'aggressive' && n.owner < 0) { const pack = this.ents.filter(e => e.sp === n.sp && e.state === 'fight' && e.target === t); const i = pack.indexOf(n), ang = Math.atan2(n.z - t.z, n.x - t.x) * .3 + (i / Math.max(1, pack.length)) * TAU; if (d > reach * 1.6) { gx = t.x + Math.cos(ang) * reach; gz = t.z + Math.sin(ang) * reach; } }
      this.moveNpc(n, gx, gz, n.speed * (n.owner >= 0 ? 1.15 : t.isPlayer ? 1.05 : 1.3), dt);
    } else { n.a = lerpAng(n.a, Math.atan2(t.z - n.z, t.x - n.x), dt * 8); this.animNpc(n, dt); }
    if (d <= reach + .8 && n.stun <= 0) {
      const opts = ['bite', 'strike'].filter(k => (A[k] || k === 'bite') && (n.cds[k] || 0) <= 0); if (!opts.length) return;
      const k = opts.sort((a, b) => (A[b] || 0) - (A[a] || 0))[0]; const wt = (T === 'epic' ? .75 : T === 'giant' ? .6 : .42) * (t.isPlayer ? 1 : .5);
      n.windup = { k, t: wt, total: wt };
    }
  },
  moveNpc(n, tx, tz, spd, dt) {
    const a = Math.atan2(tz - n.z, tx - n.x); n.a = lerpAng(n.a, a, dt * 4.5);
    const s = spd * (this.T.isWater(n.x, n.z) ? .6 : 1), B = this.T.B * .8, d = Math.hypot(tx - n.x, tz - n.z), step = Math.min(d, s * dt);
    n.x = clamp(n.x + Math.cos(n.a) * step, -B, B); n.z = clamp(n.z + Math.sin(n.a) * step, -B, B);
    this.animNpc(n, dt);
  },
  animNpc(n, dt) { n.cr.update(dt, n.x, n.z, n.a, this.ground); n.cr.mesh.visible = !(n.flash > 0 && Math.floor(n.flash * 30) % 2); },
  /* ---------- world events ---------- */
  updateEvents(dt) {
    this.raidT -= dt; this.bountyT -= dt;
    if (this.raidT <= 0) {
      this.raidT = rand(150, 210);
      const targets = this.pl.filter(q => this.alive(q)); const q = targets.length ? pick(targets) : null;
      const cand = q ? this.species.filter(s => ['aggressive', 'territorial', 'nocturnal', 'spitter'].includes(s.temper) && !s.allied[q.p] && this.living(s).filter(n => n.owner < 0).length >= 2) : [];
      if (q && cand.length) { const sp = pick(cand), crew = this.living(sp).filter(n => n.owner < 0).slice(0, 3); for (const n of crew) { n.state = 'raid'; n.raiding = q.p; n.raidLoots = 0; } this.events.push({ kind: 'raid', sp, p: q.p, t: 75, crew }); toastP(q.p, `The ${sp.name} are raiding your nest! Get back and drive them off.`, 'bad'); if (G.mode === 2) toastP(other(q.p), `The ${sp.name} are raiding P${q.p + 1}'s nest.`, 'warn'); Sfx.bad(q.p); }
    }
    if (this.bountyT <= 0) {
      this.bountyT = rand(170, 240);
      const alphas = this.ents.filter(e => !e.isPlayer && !e.dead && e.alpha && e.owner < 0 && !e.sp.mate && e.sp.temper !== 'epic' && !e.sp.allied[0] && !e.sp.allied[1]);
      if (alphas.length) { const n = pick(alphas); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: .25, depthWrite: false, blending: THREE.AdditiveBlending })); this.scene.add(beam); this.events.push({ kind: 'bounty', n, t: 120, beam }); toastAll(`Bounty: a golden ${n.sp.name} alpha has appeared. Defeat it or befriend its species first for a big reward!`, 'warn'); }
    }
    for (const e of this.events) {
      e.t -= dt;
      if (e.kind === 'raid') { e.crew = e.crew.filter(n => !n.dead && n.state === 'raid'); if (!e.crew.length || e.t <= 0) { e.t = 0; for (const n of e.crew) { n.state = 'idle'; n.raiding = undefined; } } }
      if (e.kind === 'bounty') { if (e.n.dead || e.t <= 0) e.t = Math.min(e.t, 0); else e.beam.position.set(e.n.x, this.T.ground(e.n.x, e.n.z) + 15, e.n.z); }
    }
    for (const e of this.events) if (e.t <= 0 && e.beam) { this.scene.remove(e.beam); e.beam = null; }
    this.events = this.events.filter(e => e.t > 0);
  },
  claimBounty(e, q) {
    if (e.claimed) return; e.claimed = true; e.t = 0; const o = this.pl[other(q.p)];
    this.gain(q, 35, 30, 'BOUNTY!'); toastAll(`P${q.p + 1} claimed the bounty!`, 'good');
    if (G.accord && o) { this.gain(o, 20, 15, 'shared bounty'); }
  },
  /* ---------- view ---------- */
  camFor(i, cam, dt) {
    const q = this.pl[i]; if (!q) return; const k = dt ? Math.min(1, dt * 4) : 1, L = q.cr.B.len, Hh = q.cr.B.height, dist = 9 + L * 1.6, hgt = 3.4 + Hh * 1.2, ca = Math.cos(q.camYaw), sa = Math.sin(q.camYaw);
    const gx = q.x - ca * dist, gz = q.z - sa * dist, gy = Math.max(this.T.ground(gx, gz) + 1.5, this.T.ground(q.x, q.z) + hgt + q.lift * .6);
    _tv4.set(gx, gy, gz); cam.position.lerp(_tv4, k);
    if (q.shake > 0) { cam.position.x += (Math.random() - .5) * q.shake * .8; cam.position.y += (Math.random() - .5) * q.shake * .6; }
    _kv4.set(q.x + ca * 7, this.T.ground(q.x, q.z) + Hh * .95 + q.lift * .6, q.z + sa * 7); if (!q._look) q._look = _kv4.clone(); q._look.lerp(_kv4, k); cam.lookAt(q._look);
  },
  beforeRender(i, cam) { const q = this.pl[i]; if (!q) return; this.T.clearView(cam, q.x, 0, q.z); this.wfx.beforeRender(cam); const sight = q.ab.A.sight; this.scene.fog.density = (this.day.isNight ? .016 - sight * .002 : .0052 - sight * .0008); },
  edge(pane, i, x, y, z, html, col) { return edgeMark(pane, i, x, y, z, html, col); },
  labels(i) {
    const pane = Panes[i], q = this.pl[i]; if (!q) return;
    for (const o of this.pl) if (o !== q && !(o.dead > 0)) {
      const col = hueCss(G.players[o.p].hue), y = o.cr.head().y + 2.2, tag = o.downed > 0 ? `P${o.p + 1} DOWNED · ${Math.ceil(o.downed)}s` : `P${o.p + 1}`;
      if (!this.edge(pane, i, o.x, y, o.z, tag, o.downed > 0 ? '#ff4d6d' : col)) { const s = project(_kv4.set(o.x, y, o.z), i); if (s) pane.label(s.x, s.y, o.downed > 0 ? `<div class="down"><b>DOWNED</b><small>hold ${KEYLABEL[i].menu} to revive${!G.accord ? ` · ${KEYLABEL[i].a1} to finish` : ''}</small>${q && Math.hypot(o.x - q.x, o.z - q.z) < 5 ? `<div class="relbar"><i style="width:${o.revT / 1.5 * 100}%"></i></div>` : ''}</div>` : `<span style="color:${col}">P${o.p + 1} · ${esc(G.players[o.p].name)}</span>`); }
    }
    for (const e of this.events) {
      if (e.kind === 'raid' && e.p === i) this.edge(pane, i, q.nest.x, this.T.ground(q.nest.x, q.nest.z) + 3, q.nest.z, 'RAID at your nest', '#ff4d6d');
      if (e.kind === 'bounty' && !e.n.dead) { const y = e.n.cr.head().y + 3; if (!this.edge(pane, i, e.n.x, y, e.n.z, '★ Bounty', '#ffd34d')) { const s = project(_kv4.set(e.n.x, y + 1.5, e.n.z), i); if (s) pane.label(s.x, s.y, '<b style="color:#ffd34d">★ BOUNTY</b>'); } }
    }
    Disc.labels(i, p => this.pl[p], s => s.y + 30, this.edge.bind(this));
    if (Math.hypot(q.nest.x - q.x, q.nest.z - q.z) > 60) this.edge(pane, i, q.nest.x, this.T.ground(q.nest.x, q.nest.z) + 3, q.nest.z, 'nest', hueCss(G.players[i].hue));
    // enemies about to strike you
    for (const e of this.ents) if (!e.isPlayer && !e.dead && e.windup && e.target === q) { const s = project(_kv4.set(e.x, e.cr.head().y + 1.8, e.z), i); if (s) pane.label(s.x, s.y, `<b class="warn-ico">!</b>`); }
    const t = q.target;
    if (this.alive(t) && !q.duet) {
      const s = project(_kv4.set(t.x, t.cr.head().y + t.cr.B.height * t.cr.k * .4 + 1.6, t.z), i);
      if (s && !t.isPlayer && t.state !== 'lurk') { const sp = t.sp, ico = t.owner === i ? '<b style="color:#a6d96a">♥ pack</b>' : sp.allied[i] ? '<b style="color:#a6d96a">♥ ally</b>' : sp.hostile[i] || sp.temper === 'epic' || sp.temper === 'rogue' ? '<b style="color:#ff4d6d">! hostile</b>' : t.state === 'sleep' ? '<b>z asleep</b>' : '';
        const rel = !sp.allied[i] && !sp.hostile[i] && !['epic', 'rogue'].includes(sp.temper) && !sp.mate ? `<div class="relbar"><i style="width:${sp.rel[i]}%"></i>${G.mode === 2 && sp.rel[other(i)] > 0 ? `<i class="rival" style="width:${sp.rel[other(i)]}%"></i>` : ''}</div>` : '';
        const likes = !sp.allied[i] && !sp.hostile[i] && sp.favs.length ? `<small style="color:var(--bio)">likes ${sp.favs.join(' & ')}${sp.need > 1 ? ` (level ${sp.need}+)` : ''}</small>` : '';
        const owned = G.mode === 2 && sp.allied[other(i)] && !sp.allied[i] ? `<small style="color:${hueCss(G.players[other(i)].hue)}">allied with P${other(i) + 1}</small>` : '';
        pane.label(s.x, s.y, `${esc(sp.name)}${t.alpha ? ' (alpha)' : ''}<div class="hpbar"><i style="width:${clamp(t.hp / t.maxhp, 0, 1) * 100}%"></i></div><small>${esc(TEMPERS[sp.temper] || '')} · ${DIET_WORD[sp.diet] || ''}</small>${ico ? `<small>${ico}</small>` : ''}${owned}${rel}${likes}`, 'sel'); }
      if (s && t.isPlayer) pane.label(s.x, s.y, `<span style="color:${hueCss(G.players[t.p].hue)}">P${t.p + 1}</span><div class="hpbar"><i style="width:${clamp(t.hp / t.maxhp, 0, 1) * 100}%"></i></div>${canHarm() ? '<small style="color:#ff4d6d">rival</small>' : '<small style="color:#a6d96a">in accord</small>'}`, 'sel');
      const ring = project(_kv4.set(t.x, this.T.ground(t.x, t.z) + .2, t.z), i); if (ring) pane.label(ring.x, ring.y + 10, `<div class="tring${(t.isPlayer ? canHarm() : t.sp.hostile[i] || t.state === 'fight') ? ' combat' : ''}"></div>`);
    }
    if (q.duet) {
      const d = q.duet, n = d.t, s = project(_kv4.set(n.x, n.cr.head().y + n.cr.B.height * n.k * .4 + 2.2, n.z), i), so = SOCIALS.find(x => x.k === d.ask);
      if (s) pane.label(s.x, s.y, `<div class="duet"><small>${d.demo > 0 ? 'WATCH…' : 'YOUR TURN'}</small><div class="big" style="color:${so.col}">${so.sym}</div><small>${d.ask} · press ${KEYLABEL[i][so.act]} · ${d.demo > 0 ? '' : Math.ceil(d.time) + 's · '}${d.round}/${d.need}</small><div class="relbar"><i style="width:${d.sp.rel[i]}%"></i></div></div>`);
    }
    for (const b of this.bones) if (!b.dug[i] && Math.hypot(b.x - q.x, b.z - q.z) < 70) { const s = project(_kv4.set(b.x, this.T.h(b.x, b.z) + 4, b.z), i); if (s) pane.label(s.x, s.y, `<span style="color:#ffd34d">Bone pile</span>${Math.hypot(b.x - q.x, b.z - q.z) < 6 ? `<small>press ${KEYLABEL[i].menu} to dig</small>` : ''}`); }
    for (const sp of this.species) if (sp.nest && !['epic', 'rogue'].includes(sp.temper) && Math.hypot(sp.nest.x - q.x, sp.nest.z - q.z) < 90) { const s = project(_kv4.set(sp.nest.x, this.T.ground(sp.nest.x, sp.nest.z) + 2.5, sp.nest.z), i); if (s) pane.label(s.x, s.y, `<small style="color:${sp.extinct ? '#706890' : sp.allied[i] ? '#a6d96a' : sp.hostile[i] ? '#ff4d6d' : '#f2b544'}">${esc(sp.name)} nest${sp.extinct ? ' · extinct' : sp.allied[i] ? ' · allies' : ''}</small>`); }
    if (Math.hypot(q.nest.x - q.x, q.nest.z - q.z) < 60) { const s = project(_kv4.set(q.nest.x, this.T.ground(q.nest.x, q.nest.z) + 3, q.nest.z), i); if (s) pane.label(s.x, s.y, `<span style="color:${hueCss(G.players[i].hue)}">Your nest</span>${Math.hypot(q.nest.x - q.x, q.nest.z - q.z) < 10 ? `<small>press ${KEYLABEL[i].menu} to evolve</small>` : ''}`); }
    this.fx.labels(i);
  },
  hud(q) {
    const pane = Panes[q.p], A = q.ab.A, lv = this.brainLvl(q);
    pane.meter('hp', Math.max(0, q.hp), q.maxhp); pane.meter('hu', q.hunger, 100, Math.round(q.hunger) + '%'); pane.meter('br', q.prog, BRAIN[5], `level ${lv} · ${Math.floor(q.prog)}/${BRAIN[5]}`);
    pane.stat('dna', q.dna); pane.stat('pack', `${q.pack.length}/${this.packMax(q)}`); pane.stat('won', `${Disc.count(q.p)}/${Disc.list.length}`); pane.stat('time', this.day.isNight ? 'Night' : 'Day');
    if (q.duet) { pane.acts(SOCIALS.map(s => ({ act: s.act, label: s.k, icon: s.icon, lv: A[s.k] || 0, off: !A[s.k], hot: q.duet.ask === s.k && q.duet.demo <= 0 })).concat([{ act: 'back', label: 'Stop', icon: 'swap' }])); }
    else {
      const atk = A.strike > A.bite ? 'strike' : 'bite', spec = A.charge ? 'charge' : A.spit ? 'spit' : 'roar', o = this.pl[other(q.p)];
      const atNest = Math.hypot(q.x - q.nest.x, q.z - q.nest.z) < 10, bp = this.bones.some(b => !b.dug[q.p] && Math.hypot(b.x - q.x, b.z - q.z) < 6), inv = this.alive(q.target) && !q.target.isPlayer && q.target.sp.allied[q.p] && q.target.owner < 0, rev = o && o.downed > 0 && Math.hypot(o.x - q.x, o.z - q.z) < 5;
      const canGreet = this.alive(q.target) && !q.target.isPlayer && !q.target.sp.hostile[q.p] && !q.target.sp.allied[q.p] && !['epic', 'rogue'].includes(q.target.sp.temper);
      pane.acts([
        { act: 'a1', label: atk, icon: atk === 'strike' ? 'strike' : 'bite', lv: Math.max(A.bite, A.strike) || 0, cd: (q.cds.atk || 0) > 0 ? q.cds.atk / .62 : 0 },
        { act: 'a2', label: spec, icon: spec === 'roar' ? 'sing' : spec, lv: spec === 'roar' ? 0 : A[spec], cd: (q.cds.spec || 0) > 0 ? q.cds.spec / 6 : 0 },
        { act: 'a3', label: 'greet', icon: 'charm', hot: canGreet, off: !SOCIALS.some(s => A[s.k]) },
        { act: 'a4', label: dirOf(q.p).m ? 'dodge' : 'jump', icon: dirOf(q.p).m ? 'dash' : 'jump', cd: (q.cds.dodge || 0) > 0 ? q.cds.dodge / 1.1 : 0 },
        { act: 'menu', label: rev ? 'Revive' : atNest ? 'Nest' : bp ? 'Dig' : inv ? 'Invite' : 'Use', icon: rev ? 'mate' : atNest ? 'edit' : bp ? 'eat' : inv ? 'mate' : 'menu', hot: rev || atNest || bp || inv, off: !(rev || atNest || bp || inv) },
        { act: 'back', label: 'target', icon: 'swap' }]);
    }
    if (!(q.dead > 0) && !(q.downed > 0)) pane.prompt(q.hunger < 20 ? (this.canEat(q, 'fruit') ? 'Starving: walk into fruit bushes to eat' : 'Starving: hunt, then walk over the meat') : q.duet ? '' : this.ents.some(e => !e.isPlayer && e.windup && e.target === q) ? 'Incoming attack: dodge!' : '');
  },
  exit() { for (const e of this.ents) if (e.cr) e.cr.dispose(); for (const e of this.events) if (e.beam) this.scene.remove(e.beam); },
};
const _tv4 = new THREE.Vector3(), _kv4 = new THREE.Vector3();
