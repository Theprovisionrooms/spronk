/* Lineage | engine. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== GRAPHICS QUALITY ==============================
   Three tiers so the game runs on anything from an old office laptop to a gaming PC.
   The tier is picked from the GPU name, then a live frame-time monitor scales the render
   resolution up and down, and drops a tier if even the lowest resolution can't keep up.
   Low: Lambert shading, no shadow maps (soft blob shadows instead), no post, lean geometry.
   Medium: PBR shading, small shadow map updated every other frame, no post.
   High: PBR, soft 2048 shadows, HDR bloom and colour grade, full geometry. */
const TIERS = {
  low: { name: 'Low', lambert: true, shadows: 0, post: false, aa: false, dpr: 1, minScale: .5, maxScale: .85, terrain: .56, trees: .45, grass: 0, tufts: .35, detail: .5, res: 1.45, particles: .5, sky: .5 },
  medium: { name: 'Medium', lambert: false, shadows: 1024, post: false, aa: false, dpr: 1, minScale: .6, maxScale: 1, terrain: .76, trees: .7, grass: .5, tufts: .65, detail: .75, res: 1.2, particles: .75, sky: .75 },
  high: { name: 'High', lambert: false, shadows: 2048, post: true, aa: true, dpr: 1.5, minScale: .7, maxScale: 1, terrain: 1, trees: 1, grass: 1, tufts: 1, detail: 1, res: 1, particles: 1, sky: 1 },
};
const TIER_ORDER = ['low', 'medium', 'high'];
const Q = {
  pref: 'auto', tier: 'medium', b: TIERS.medium, scale: 1, gpu: 'unknown', frame: 0,
  win: { t: 0, n: 0, slow: 0, fast: 0 }, fps: 60, built: 'medium',
  load() { try { const p = localStorage.getItem('lineage-gfx'); if (p && (p === 'auto' || TIERS[p])) this.pref = p; } catch (_) {} },
  save() { try { localStorage.setItem('lineage-gfx', this.pref); } catch (_) {} },
  /* guess a tier from the GPU name, using a throwaway context so the real one can pick its antialias setting */
  detect() {
    let name = '';
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
    } catch (_) {}
    this.gpu = name || 'unknown'; const n = name.toLowerCase(), cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    let t = 'medium';
    if (/swiftshader|llvmpipe|software|basic render|gma|mali-[2-7]|adreno.*\b[2-5]\d\d\b|powervr|hd graphics( [2-5]\d{3}| [2-5]\d\d\b|$)|hd graphics family|intel.*(hd|gma)(?!.*(5[2-9]\d|6[0-9]\d))/.test(n)) t = 'low';
    else if (/nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro)|\brx \d|apple m\d|apple gpu/.test(n)) t = 'high';
    if (cores <= 2 || mem <= 2) t = 'low'; else if (mem <= 4 && t === 'high') t = 'medium';
    return t;
  },
  init() { this.load(); this.auto = this.detect(); this.set(this.pref === 'auto' ? this.auto : this.pref, true); this.built = this.tier; },
  set(tier, quiet) {
    this.tier = tier; this.b = TIERS[tier]; this.scale = this.b.maxScale; this.win = { t: 0, n: 0, slow: 0, fast: 0 };
    if (renderer) this.apply();
    if (!quiet) toastAll(`Graphics: ${this.b.name}. Scenery detail updates from the next stage.`);
  },
  /* what can change live: resolution, shadows, post, materials */
  apply() {
    renderer.setPixelRatio(Math.min(this.b.dpr, window.devicePixelRatio || 1) * this.scale);
    const sh = this.b.shadows > 0; if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; scenesNeedMaterialUpdate(); }
    renderer.shadowMap.type = this.tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    rebuildBodyMats(); resize(); document.body.dataset.gfx = this.tier;
  },
  /* real wall-clock frame time, not the capped game step */
  tick(realDt) {
    this.frame++; if (this.grace > 0) { this.grace -= realDt; this.win = { t: 0, n: 0, slow: 0, fast: 0 }; return; } const w = this.win; w.t += realDt; w.n++; if (w.t < 1.5) return;
    this.fps = w.n / w.t; w.t = 0; w.n = 0; if (G.paused || Editor.active || Modal.isOpen) return;
    if (this.fps < 40) { w.slow++; w.fast = 0; } else if (this.fps > 56) { w.fast++; w.slow = 0; } else { w.slow = 0; w.fast = 0; }
    if (w.slow >= 1 && this.scale > this.b.minScale + .01) { this.scale = Math.max(this.b.minScale, this.scale - (this.fps < 24 ? .15 : .08)); w.slow = 0; this.apply(); }
    else if (w.slow >= 3 && this.pref === 'auto' && this.tier !== 'low') { const t = TIER_ORDER[TIER_ORDER.indexOf(this.tier) - 1]; this.set(t, true); this.scale = this.b.maxScale * .9; this.apply(); toastAll(`Graphics lowered to ${this.b.name} to keep things smooth. Change it in the pause menu.`); }
    else if (w.fast >= 3 && this.scale < this.b.maxScale - .01) { this.scale = Math.min(this.b.maxScale, this.scale + .05); w.fast = 0; this.apply(); }
  },
  n(v, key = 'detail', min = 1) { return Math.max(min, Math.round(v * this.b[key])); },
};
/* lit material that follows the tier: Lambert on Low, PBR above */
const PBR_ONLY = ['roughness', 'metalness', 'envMapIntensity', 'clearcoat'];
function litMat(params = {}) {
  if (!Q.b.lambert) return new THREE.MeshStandardMaterial(params);
  const p = { ...params }; for (const k of PBR_ONLY) delete p[k];
  if (params.roughness !== undefined && params.roughness < .3) return new THREE.MeshPhongMaterial({ ...p, shininess: 60, specular: 0x334455 });
  return new THREE.MeshLambertMaterial(p);
}
let renderer = null, W = 1, H = 1;
const cams = [new THREE.PerspectiveCamera(60, 1, .5, 6000), new THREE.PerspectiveCamera(60, 1, .5, 6000)];
let paneRects = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 }];
Q.init();
function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: Q.b.aa, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.enabled = Q.b.shadows > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setScissorTest(true);
  Q.apply();
}
function resize() {
  const a = $('#app').getBoundingClientRect(); W = Math.max(2, a.width); H = Math.max(2, a.height);
  if (renderer) renderer.setSize(W, H, false);
  paneRects = Panes.map(p => p.rect());
}
window.addEventListener('resize', () => { resize(); });
function setupPanes() {
  $('#panes').innerHTML = ''; Panes = []; Menus = [];
  if (G.mode === 2) { Panes.push(new Pane(0, 'left'), new Pane(1, 'right')); } else Panes.push(new Pane(0, 'solo'));
  Menus = Panes.map(p => new PMenu(p));
  $('#divider').hidden = G.mode !== 2; $('#tools').className = 'tools' + (G.mode === 2 ? '' : ' solo');
  buildCodeMap(); resize();
}
function scenesNeedMaterialUpdate() { const sc = S && S.scene; if (sc) sc.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); }); }
/* shadow maps follow the tier: size per sun, refreshed every frame on High and every other frame on Medium */
function tierShadow(light) { if (!light || !light.shadow) return; const s = Q.b.shadows || 512; light.shadow.mapSize.set(s, s); light.castShadow = Q.b.shadows > 0; }
function render() {
  if (!S || !S.scene) return;
  renderer.shadowMap.needsUpdate = Q.b.shadows > 0 && (Q.tier === 'high' || Q.frame % 2 === 0);
  for (let i = 0; i < Panes.length; i++) {
    const r = paneRects[i] || { x: 0, y: 0, w: W, h: H }, cam = cams[i];
    const asp = r.w / Math.max(1, r.h); if (Math.abs(cam.aspect - asp) > 1e-3) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h); renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
    if (S.beforeRender) S.beforeRender(i, cam);
    if (S.cull) S.cull(i, cam);
    if (!Q.b.post) { renderer.setClearColor(S.scene.background && S.scene.background.isColor ? S.scene.background : 0x000000, 1); renderer.render(S.scene, cam); }
    else Post.draw(S.scene, cam, r, S.grade);
  }
}
/* shift the picture away from an open side menu so the subject stays visible */
function editorView(cam, i, on) {
  const r = paneRects[i]; if (!r) return;
  if (on) { const dx = (G.mode === 2 && i === 0 ? -1 : 1) * r.w * .2; if (!cam.view || !cam.view.enabled || Math.abs(cam.view.offsetX - dx) > 1 || cam.view.width !== r.w) cam.setViewOffset(r.w, r.h, dx, 0, r.w, r.h); }
  else if (cam.view && cam.view.enabled) cam.clearViewOffset();
}
const _pv = new THREE.Vector3();
function project(v, i) {
  const r = paneRects[i]; if (!r) return null; _pv.copy(v).project(cams[i]);
  if (_pv.z > 1 || _pv.z < -1) return null; const x = (_pv.x + 1) / 2 * r.w, y = (1 - _pv.y) / 2 * r.h;
  if (x < -40 || x > r.w + 40 || y < -40 || y > r.h + 40) return null; return { x, y, ndc: _pv.clone() };
}
/* an arrow on the edge of a player's view pointing at something off screen; returns false if it is on screen */
const _em = new THREE.Vector3();
function edgeMark(pane, i, x, y, z, html, col, force) {
  const r = paneRects[i]; if (!r) return false; if (!force && project(_em.set(x, y, z), i)) return false;
  const cam = cams[i], v = _em.set(x, y, z).applyMatrix4(cam.matrixWorldInverse); let ax = v.x, ay = -v.y; if (v.z > 0) { ax = -ax; ay = -ay; } const a = Math.atan2(ay, ax);
  const kk = Math.min((r.w / 2 - 44) / Math.abs(Math.cos(a) || 1e-6), (r.h / 2 - (Math.sin(a) < 0 ? 100 : 80)) / Math.abs(Math.sin(a) || 1e-6));
  pane.label(r.w / 2 + Math.cos(a) * kk, r.h / 2 + Math.sin(a) * kk + 10, `<div class="edge" style="--c:${col}"><i style="transform:rotate(${(a + Math.PI / 2).toFixed(2)}rad)"></i><span>${html}</span></div>`); return true;
}
function disposeScene(scene) {
  if (!scene) return; scene.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { if (x.map && !x.map.userData.shared) x.map.dispose(); if (!x.userData.shared) x.dispose(); }); });
}

/* ---------- shared textures, materials & scenery helpers ---------- */
const TEX = {};
const _up = new THREE.Vector3(0, 1, 0), _dv = new THREE.Vector3(), _tv = new THREE.Vector3(), _kv = new THREE.Vector3();
const G_SPH = () => sharedGeo('p_sph', () => new THREE.SphereGeometry(1, 14, 10)), G_SPHL = () => sharedGeo('p_sphl', () => new THREE.SphereGeometry(1, 9, 7)), G_CYL = () => sharedGeo('p_cyl', () => new THREE.CylinderGeometry(1, 1, 1, 8)), G_CONE = () => sharedGeo('p_cone', () => new THREE.ConeGeometry(1, 1, 8)), G_BOX = () => sharedGeo('p_box', () => new THREE.BoxGeometry(1, 1, 1));
function dotTexture() {
  if (TEX.dot) return TEX.dot; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); TEX.dot = new THREE.CanvasTexture(c); TEX.dot.userData.shared = true; return TEX.dot;
}
const MATS = new Map();
function stdMat(color, opts = {}) {
  const key = color + JSON.stringify(opts) + (Q.b.lambert ? 'L' : 'S'); if (MATS.has(key)) return MATS.get(key);
  const m = litMat({ color, roughness: .75, metalness: 0, ...opts }); m.userData.shared = true; MATS.set(key, m); return m;
}
const GEO = {};
function sharedGeo(name, make) { if (!GEO[name]) { GEO[name] = make(); GEO[name].userData.shared = true; } return GEO[name]; }
function sunLight(scene, color = 0xffffff, intensity = 2, size = 160) {
  const l = new THREE.DirectionalLight(color, intensity); tierShadow(l);
  const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 900; l.shadow.bias = -.0008; l.shadow.normalBias = .4;
  scene.add(l); scene.add(l.target); return l;
}

/* ---------- 3D particles and floating text ---------- */
class FX3 {
  constructor(scene, size = 1.2, max = 900) {
    this.max = max; this.n = 0; this.p = []; this.texts = [];
    const geo = new THREE.BufferGeometry(); this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.pts.frustumCulled = false; scene.add(this.pts); this.c = new THREE.Color();
  }
  burst(x, y, z, color, n = 10, sp = 8, life = .7, grav = 0) {
    this.c.set(color); for (let i = 0; i < n; i++) { if (this.p.length >= this.max) this.p.shift(); const a = rand(0, TAU), b = rand(-1, 1), v = rand(.3, 1) * sp, s = Math.sqrt(1 - b * b); this.p.push({ x, y, z, vx: Math.cos(a) * s * v, vy: b * v + sp * .3, vz: Math.sin(a) * s * v, life: life * rand(.6, 1.1), max: life, r: this.c.r, g: this.c.g, b: this.c.b, grav }); }
  }
  text(x, y, z, str, color = '#fff', only = -1) { this.texts.push({ v: new THREE.Vector3(x, y, z), str, color, life: 1.3, only }); }
  update(dt) {
    for (const p of this.p) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= p.grav * dt; const d = 1 - dt * 2; p.vx *= d; p.vz *= d; p.life -= dt; }
    this.p = this.p.filter(p => p.life > 0);
    const n = this.p.length; for (let i = 0; i < n; i++) { const p = this.p[i], k = clamp(p.life / p.max, 0, 1); this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z; this.col[i * 3] = p.r * k; this.col[i * 3 + 1] = p.g * k; this.col[i * 3 + 2] = p.b * k; }
    this.pts.geometry.setDrawRange(0, n); this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    for (const t of this.texts) { t.life -= dt; t.v.y += dt * 3; } this.texts = this.texts.filter(t => t.life > 0);
  }
  labels(i) { const pane = Panes[i]; for (const t of this.texts) { if (t.only >= 0 && t.only !== i) continue; const s = project(t.v, i); if (s) { const el = pane.label(s.x, s.y, `<span style="color:${t.color};opacity:${clamp(t.life * 1.5, 0, 1).toFixed(2)}">${esc(t.str)}</span>`); } } }
}

/* ============================== STAGE FLOW (evolve when ready, discoveries, accord) ==============================
   Reaching a stage's goal never ends it. It makes the species ready to evolve, and each player chooses
   when to go. In split screen the stage moves on once both have chosen; there is no countdown, and once
   one player has evolved the other may follow at any time, goal or not. */
let S = null;
const Flow = { ready: [null, null], done: [null, null], finishing: false, proposal: [-1e9, -1e9] };
let gameClock = 0;
function setStage(st) {
  if (S && S.exit) S.exit(); if (S && S.scene) disposeScene(S.scene);
  for (const m of Menus) m.close(); for (const p of Panes) p.clear(); for (const c of cams) if (c.view && c.view.enabled) c.clearViewOffset();
  Flow.ready = [null, null]; Flow.done = [null, null]; Flow.finishing = false; Disc.reset();
  S = st; st.enter(); S._snap = 3; updateStageBar(); updateAccord(); Q.grace = 3;
  Music.play(st.idx === undefined ? 'title' : ['cell', 'creature', 'tribe', 'civ', 'space'][st.idx]);
}
function updateStageBar() { const b = $('#stagebar'); b.hidden = !S || S.idx === undefined; [...b.children].forEach((s, j) => s.className = j < G.stage ? 'done' : j === G.stage ? 'on' : ''); }
function updateAccord() { const a = $('#accord'); a.hidden = G.mode !== 2 || !S || S.idx === undefined; a.className = G.accord ? 'on' : ''; a.textContent = G.accord ? 'In accord · shared prosperity' : 'Rivals'; }
const other = p => 1 - p;
/* run the editor for each player in turn, then continue */
function runEditors(list, kind, then, first) {
  if (!list.length) { then(); return; }
  const p = list[0], P = G.players[p];
  if (kind === 'creature' && (!P.body || P.body.kind !== 'creature')) P.body = starterCreature(P);
  if (S && S.scene) { disposeScene(S.scene); S.scene = null; }
  const wallet = (P.dna || 0) + 40;
  Modal.open(`<div class="eyebrow">${G.mode === 2 ? 'P' + (p + 1) + ' · ' : ''}${esc(P.name)}</div><h2>${first ? 'Time to grow legs' : 'Evolve'}</h2><p>Your cell has crawled out of the water. Shape your first creature: drag its spine, fatten it, add legs, a mouth and eyes, then paint it.${G.mode === 2 ? ` P${other(p) + 1} gets their turn next.` : ''}</p><p>You have ${wallet} DNA to spend. Use the mouse.</p><div class="row"><button class="btn primary" data-act="go">Open the creature editor</button></div>`,
    { go: () => { Modal.close(); Editor.open(p, kind, { dna: wallet, onDone: (saved, w) => { P.dna = Math.max(0, w - 40); runEditors(list.slice(1), kind, then, first); } }); } },
    { onPress: (pp, act) => { if (act === 'a1' || act === 'menu') Modal.handlers.go(); } });
}
function proposeAccord(p) {
  if (G.mode !== 2) return;
  if (G.accord) { G.accord = false; updateAccord(); toastAll(`P${p + 1} broke the accord. You are rivals again.`, 'warn'); Sfx.bad(); if (S && S.onAccordChange) S.onAccordChange(); return; }
  Flow.proposal[p] = gameClock;
  if (gameClock - Flow.proposal[other(p)] < 30) { G.accord = true; updateAccord(); toastAll('Accord formed. You can no longer harm each other, and you share in each other\'s success.', 'good'); Sfx.good(); if (S && S.onAccordChange) S.onAccordChange(); }
  else { toastP(p, `Accord offered. P${other(p) + 1} has 30 seconds to accept.`); toastP(other(p), `P${p + 1} offers an accord. Open your menu and accept it to stop fighting and share success.`, 'warn'); }
}
function accordItem(p) {
  if (G.mode !== 2) return [];
  const pending = gameClock - Flow.proposal[other(p)] < 30 && !G.accord;
  return [{ head: true, label: 'Your rival' }, { label: G.accord ? 'Break the accord' : pending ? `Accept P${other(p) + 1}'s accord` : 'Offer an accord', desc: G.accord ? 'Go back to being rivals. You can fight again.' : 'Allies cannot hurt each other and both earn Shared Prosperity at the end of the stage.', onSelect: () => proposeAccord(p), close: true }];
}
const canHarm = () => !G.accord;
/* a stage calls this when a player meets its goal; nothing ends until they choose to evolve */
function playerDone(p, style, lines) {
  if (Flow.ready[p] || Flow.finishing || !S || S.idx === undefined) return;
  Flow.ready[p] = { style, lines }; Sfx.ready(p);
  toastP(p, `Your species is ready to evolve into the ${STAGE_NAMES[S.idx + 1]} stage. There is no rush: explore as long as you like, then ${S.evolveHint ? S.evolveHint(p) : 'evolve from your menu'}.`, 'good');
  if (G.mode === 2 && !Flow.done[other(p)]) toastP(other(p), `P${p + 1} is ready to evolve. Take your time.`);
  flowChip(p);
}
const canEvolve = p => !!(Flow.ready[p] || (G.mode === 2 && Flow.done[other(p)]));
function evolve(p) {
  if (Flow.done[p] || Flow.finishing || !canEvolve(p)) return;
  const r = Flow.ready[p], style = S.forceStyle ? S.forceStyle(p) : r ? r.style : 'mixed';
  Flow.done[p] = { style, lines: (S.summary ? S.summary(p) : r ? r.lines : null) || ['Followed their rival into the next age.'] };
  Menus[p].close(); Sfx.good(p);
  if (Flow.done.slice(0, G.mode).every(Boolean)) { finishStage(); return; }
  toastP(other(p), `P${p + 1} has chosen to evolve. Follow whenever you like${Flow.ready[other(p)] ? '' : ', even before your goal'}: ${S.evolveHint ? S.evolveHint(other(p)) : 'evolve from your menu'}.`, 'warn');
  flowChip(p); flowChip(other(p));
}
function unEvolve(p) { if (!Flow.done[p] || Flow.finishing) return; Flow.done[p] = null; flowChip(p); flowChip(other(p)); }
/* menu entries every stage adds to its main menu */
function evolveItems(p) {
  if (!S || S.idx === undefined || S.idx >= 4) return [];
  const next = STAGE_NAMES[S.idx + 1];
  if (Flow.done[p]) return [{ head: true, label: 'Evolution' }, { label: `Waiting for P${other(p) + 1}`, desc: 'You will evolve together. Choose this to stay a while longer.', onSelect: () => unEvolve(p) }];
  if (!canEvolve(p)) return [];
  return [{ head: true, label: 'Evolution' }, { label: `Evolve into the ${next} stage`, desc: Flow.ready[p] ? 'Your species is ready. Your choices here become a legacy.' : `P${other(p) + 1} has evolved. You can follow now.`, onSelect: () => evolve(p), close: true }];
}
function flowChip(p) {
  const pane = Panes[p]; if (!pane) return;
  const d = Flow.done[p], hint = S && S.evolveHint ? S.evolveHint(p) : 'open your menu';
  pane.chip(d ? `Evolving · waiting for P${other(p) + 1}` : canEvolve(p) ? `Ready to evolve · ${hint}` : '', d ? '' : 'go');
}
function finishStage() {
  if (Flow.finishing) return; Flow.finishing = true; const idx = S.idx;
  for (let p = 0; p < G.mode; p++) {
    const P = G.players[p], d = Flow.done[p]; addLegacy(P, idx, d.style);
    const found = Disc.count(p); if (found >= WANDER_MIN) P.legacies.push({ stage: idx, wander: true, style: d.style, title: WANDER[idx].title, desc: `${WANDER[idx].desc} Found ${found} wonders.` });
    if (found) d.lines = d.lines.concat([`Discovered ${found} of ${Disc.list.length} wonders.`]);
    if (G.accord && G.mode === 2) P.legacies.push({ stage: idx, shared: true, style: d.style, title: SHARED.title, desc: SHARED.desc });
    if (S.onFinish) S.onFinish(p, P);
    recalcMods(P); Panes[p].chip('');
  }
  if (G.accord) G.accordStages++;
  G.stage = idx + 1; saveGame(); Sfx.evolve();
  const ready = [false, false];
  const html = () => `<div class="eyebrow">Stage ${idx + 1} complete</div><h2>${['Out of the water', 'A mind awakens', 'The first city', 'To the stars'][idx]}</h2>
    <div class="results">${G.players.slice(0, G.mode).map((P, p) => { const d = Flow.done[p], ls = P.legacies.filter(l => l.stage === idx); return `<div><div class="who" style="margin-bottom:6px"><i style="background:${hueCss(P.hue)};width:10px;height:10px;border-radius:2px;display:inline-block"></i> ${G.mode === 2 ? 'P' + (p + 1) + ' · ' : ''}${esc(P.name)}</div>${d.lines.map(l => `<p style="margin:4px 0">${esc(l)}</p>`).join('')}${ls.map(legacyCard).join('<div style="height:8px"></div>')}${modsHTML(P)}</div>`; }).join('')}</div>
    <div class="row"><button class="btn primary" data-act="go">Begin the ${STAGE_NAMES[idx + 1]} stage</button>${G.mode === 2 ? `<span class="ready">P1 ${ready[0] ? '<b>ready</b>' : `press ${KEYLABEL[0].a1}`} · P2 ${ready[1] ? '<b>ready</b>' : `press ${KEYLABEL[1].a1}`}</span>` : `<span class="ready">or press ${KEYLABEL[0].a1} / F</span>`}</div>`;
  const go = () => { Modal.close(); if (idx === 0) runEditors(G.players.slice(0, G.mode).map(P => P.i), 'creature', () => startStage(1), true); else startStage(idx + 1); };
  Modal.open(html(), { go }, { onPress: (p, act) => { if (act === 'a1' || act === 'menu') { ready[p] = true; if (ready.slice(0, G.mode).every(Boolean)) go(); else Modal.rerender(html()); } } });
}

/* ============================== DISCOVERIES ==============================
   Every world hides wonders worth the trip: landmarks you can see from far away, each with its own
   reward and a line for the journal. Both players can find every wonder; nobody races for them.
   A stage registers sites with Disc.add, then calls Disc.update(players) each frame and Disc.labels(i). */
const WANDER_MIN = 3;
const WANDER = [
  { title: 'Tide Drifter', desc: 'Wandered the whole tide pool. +5% health and income.' },
  { title: 'Trailblazer', desc: 'Walked to the far corners of the world. +5% health and income.' },
  { title: 'Pathfinder', desc: 'Led the tribe to the old places. +5% health and income.' },
  { title: 'Cartographer', desc: 'Mapped the whole planet. +5% health and income.' },
  { title: 'Voyager', desc: 'Charted the deep galaxy. +5% health and income.' },
];
const Disc = {
  list: [],
  unit: 'm',
  reset() { this.list = []; this.dist = null; this.vis = null; this.unit = 'm'; },
  /* site: { x, z, y?, r, name, lore, icon, reward(p) -> string, g?: Object3D, beacon?: Object3D } */
  add(site) { site.found = [false, false]; site.id = this.list.length; this.list.push(site); return site; },
  count(p) { return this.list.filter(s => s.found[p]).length; },
  /* pos(p) -> {x, z} of that player's explorer, or null */
  dist: null,
  d(q, s) { return this.dist ? this.dist(q, s) : Math.hypot(q.x - s.x, q.z - s.z); },
  update(dt, pos) {
    for (const s of this.list) {
      if (s.spin) s.spin(dt);
      for (let p = 0; p < G.mode; p++) {
        if (s.found[p]) continue; const q = pos(p); if (!q) continue;
        if (this.d(q, s) < s.r) this.find(s, p);
      }
      if (s.beacon) s.beacon.visible = s.found.slice(0, G.mode).some(f => !f);
    }
  },
  find(s, p) {
    s.found[p] = true; const P = G.players[p]; P.journal = P.journal || []; P.journal.push({ stage: S.idx, name: s.name });
    const got = s.reward ? s.reward(p) : ''; Sfx.discover(p);
    toastP(p, `Discovered: ${s.name}. ${s.lore}${got ? ' ' + got : ''}`, 'good');
    if (S && S.fx) S.fx.burst(s.x, (s.y || 0) + 4, s.z, '#ffe08a', 30, 10, 1.2, s.up ? 0 : 4);
  },
  /* names float over wonders you can see; unfound ones you can't see get a compass mark at the screen edge */
  labels(i, pos, yOf, edge) {
    const pane = Panes[i], q = pos(i); if (!q) return;
    /* only the two nearest unfound wonders get a compass mark, so the edge of the screen stays readable */
    const near = this.list.filter(s => !s.found[i]).map(s => [s, this.d(q, s)]).sort((a, b) => a[1] - b[1]).slice(0, 2).map(o => o[0]);
    for (const s of this.list) {
      const d = this.d(q, s), y = yOf(s);
      const seen = !this.vis || this.vis(i, s);
      if (d < (s.see || 260) && seen) { const v = project(_dv.set(s.x, y, s.z), i); if (v) { pane.label(v.x, v.y, s.found[i] ? `<small style="color:#d8c99a">${esc(s.name)}</small>` : `<span style="color:#ffe08a">${s.icon || '✦'} ${d < (s.nameAt || 70) ? esc(s.name) : 'Something out there'}</span><small>${Math.round(d)} ${this.unit}</small>`); continue; } }
      if (edge && near.includes(s) && d < (s.far || 420)) edge(pane, i, s.x, y, s.z, `${s.icon || '✦'} ${Math.round(d)} ${this.unit}`, '#ffe08a', !seen);
    }
  },
  journalHTML(P) { const j = P.journal || []; return j.length ? `<div class="mods">${j.map(e => `<span>${esc(STAGE_NAMES[e.stage] || '')} · ${esc(e.name)}</span>`).join('')}</div>` : '<p style="font-size:12.5px">No wonders discovered yet.</p>'; },
};
/* ============================== POST-PROCESSING ==============================
   Each viewport renders into an HDR multisampled target, then a bright pass, a two-pass blur and a
   composite (bloom, colour grade, vignette, tone mapping) draw it to its slice of the screen. */
const Post = {
  ok: false, w: 0, h: 0,
  init() {
    if (this.ok) return; this.ok = true;
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quad = new THREE.Mesh(tri); this.quad.frustumCulled = false; this.sc = new THREE.Scene(); this.sc.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: .85 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(.2126,.7152,.0722)); float k = smoothstep(th, th + .6, l); gl_FragColor = vec4(c * k, 1.0); }' });
    this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * .227; c += (texture2D(t, vUv + d * 1.38).rgb + texture2D(t, vUv - d * 1.38).rgb) * .316; c += (texture2D(t, vUv + d * 3.23).rgb + texture2D(t, vUv - d * 3.23).rgb) * .07; gl_FragColor = vec4(c, 1.0); }' });
    this.comp = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b: { value: null }, bloom: { value: .55 }, sat: { value: 1.14 }, vig: { value: .32 }, tint: { value: new THREE.Color(1.03, 1.0, .96) }, time: { value: 0 } }, vertexShader: vs, depthTest: false, depthWrite: false, toneMapped: true,
      fragmentShader: `uniform sampler2D t; uniform sampler2D b; uniform float bloom, sat, vig, time; uniform vec3 tint; varying vec2 vUv;
        void main(){ vec3 c = texture2D(t, vUv).rgb + texture2D(b, vUv).rgb * bloom; c *= tint; c = max(vec3(0.0), (c - .18) * 1.12 + .18); float l = dot(c, vec3(.2126,.7152,.0722)); c = mix(vec3(l), c, sat);
          vec2 q = vUv - .5; c *= 1.0 - vig * dot(q, q) * 2.2; gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          float g = fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453); gl_FragColor.rgb += (g - .5) * .012; }` });
  },
  size(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (w === this.w && h === this.h) return; this.w = w; this.h = h;
    for (const k of ['rt', 'a', 'b']) if (this[k]) this[k].dispose();
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
    this.a = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType }); this.b = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType });
    this.qw = qw; this.qh = qh;
  },
  pass(mat, target) { this.quad.material = mat; renderer.setRenderTarget(target); renderer.render(this.sc, this.cam); },
  /* render scene through cam into the screen rectangle (css pixels, top-left origin) */
  draw(scene, cam, r, grade) {
    this.init(); const pr = renderer.getPixelRatio(); this.size(r.w * pr, r.h * pr);
    renderer.setRenderTarget(this.rt); renderer.setClearColor(scene.background && scene.background.isColor ? scene.background : 0x000000, 1); renderer.clear(); renderer.render(scene, cam);
    this.bright.uniforms.t.value = this.rt.texture; this.bright.uniforms.th.value = grade && grade.th || .85; this.pass(this.bright, this.a);
    this.blur.uniforms.t.value = this.a.texture; this.blur.uniforms.d.value.set(1 / this.qw, 0); this.pass(this.blur, this.b);
    this.blur.uniforms.t.value = this.b.texture; this.blur.uniforms.d.value.set(0, 1 / this.qh); this.pass(this.blur, this.a);
    this.blur.uniforms.t.value = this.a.texture; this.blur.uniforms.d.value.set(2 / this.qw, 0); this.pass(this.blur, this.b);
    this.blur.uniforms.t.value = this.b.texture; this.blur.uniforms.d.value.set(0, 2 / this.qh); this.pass(this.blur, this.a);
    const u = this.comp.uniforms; u.t.value = this.rt.texture; u.b.value = this.a.texture; u.time.value = (u.time.value + 1.7) % 1000;
    u.bloom.value = grade && grade.bloom !== undefined ? grade.bloom : .55; u.sat.value = grade && grade.sat || 1.14; u.vig.value = grade && grade.vig !== undefined ? grade.vig : .32;
    renderer.setRenderTarget(null); renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h); renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
    this.quad.material = this.comp; renderer.render(this.sc, this.cam);
  },
};
/* shared clock for animated shaders (grass, trees, water) */
const WORLD_TIME = { value: 0 };
function swayMaterial(mat, amount = .12, ref = 1, nearFade = 0) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = WORLD_TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      ${nearFade ? `transformed *= smoothstep(${(nearFade * .4).toFixed(1)}, ${nearFade.toFixed(1)}, distance(ip.xz, cameraPosition.xz));` : ''}
      float sw = max(0.0, position.y + ${ref.toFixed(2)}) ; sw = sw * sw * ${amount.toFixed(3)};
      transformed.x += sin(uTime * 1.7 + ip.x * .21 + ip.z * .13) * sw; transformed.z += cos(uTime * 1.3 + ip.z * .19) * sw * .7;`);
  };
  return mat;
}
/* soft skin: tiny bumps that stick to the body plus a rim light */
function skinShader(mat, rim = .32) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uRim = { value: new THREE.Color(0xd8ecff) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBindP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vBindP; uniform vec3 uRim;
      float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y), mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 bp = vBindP * 16.0; normal = normalize(normal + (vec3(n3(bp), n3(bp + 17.1), n3(bp + 31.7)) - .5) * .22);`)
      .replace('#include <opaque_fragment>', `outgoingLight += uRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0) * ${rim.toFixed(2)} * (0.4 + diffuseColor.rgb);
        #include <opaque_fragment>`);
  };
  mat.needsUpdate = true; return mat;
}
