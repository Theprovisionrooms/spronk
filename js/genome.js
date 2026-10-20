/* Lineage | genome. Intellectual property of Sidedoor Digital. */
'use strict';
/* ============================== GENOME, DECISIONS AND THE CHRONICLE ==============================
   Three systems that run through every stage, so what you do early keeps mattering late:
   - Genes: mutations you pick from a draft of three at key moments (growing, hatching a clutch, a story
     choice). Each gene is small on its own, they stack, and they carry forward to the very end. Some
     open up parts of the world: a frost gene lets you climb into the cold highlands as a creature and
     settle ice worlds as a spacefaring species.
   - Decisions: a per-player queue of choice cards (mutation drafts and story events). A card opens in
     that player's side menu when they are not in danger, and waits in their main menu if they close it.
   - The Chronicle: short story events with two or three choices, a few per stage, each one written for
     the stage it happens in. Choices leave a line in the journal. */
const GENES = {
  /* tolerances: open up hostile ground in the creature and tribe stages, and harsh worlds in space */
  frost: { name: 'Antifreeze Blood', icon: '❄', flag: 'cold', desc: 'Cold no longer hurts you. The frozen highlands open up, and in space ice worlds can be settled.' },
  heat: { name: 'Heat Scales', icon: '♨', flag: 'heat', desc: 'Scalding ground no longer hurts you. Sulphur fields open up, and in space volcanic worlds can be settled.' },
  toxin: { name: 'Iron Liver', icon: '☣', flag: 'toxin', desc: 'Poison and toxic marsh no longer hurt you. Marshes open up, and harsh worlds become fully habitable.' },
  gills: { name: 'Gills', icon: '≋', flag: 'water', desc: 'Swim at full speed and heal in water. In space, ocean worlds grow richer colonies.' },
  /* fighting */
  jaws: { name: 'Crushing Jaws', icon: '⚔', mods: { dmg: 1.12 }, desc: '+12% damage, for good.' },
  hide: { name: 'Tough Hide', icon: '⛨', mods: { hp: 1.15 }, desc: '+15% health, for good.' },
  venom: { name: 'Venom Glands', icon: '☠', flag: 'venom', mods: { dmg: 1.04 }, desc: 'Your bites and blows poison what they hit. Later your spears, armies and starships carry the same bite.' },
  adren: { name: 'Adrenaline', icon: '⚡', flag: 'adren', desc: 'Below a third of your health you move and hit 40% harder.' },
  /* getting along */
  voice: { name: 'Resonant Voice', icon: '♪', mods: { social: 1.15 }, desc: '+15% social power: songs, gifts and diplomacy all land better.' },
  colour: { name: 'Bright Colours', icon: '✿', mods: { social: 1.08, econ: 1.04 }, desc: '+8% social, +4% income. Others notice you, in a good way.' },
  /* living well */
  gut: { name: 'Iron Gut', icon: '◍', mods: { econ: 1.12 }, desc: '+12% food and income.' },
  fat: { name: 'Fat Reserves', icon: '●', flag: 'fat', desc: 'Hunger drains a third slower, and your tribe eats less in winter.' },
  regen: { name: 'Fast Healing', icon: '✚', flag: 'regen', desc: 'Heal twice as fast when out of a fight.' },
  clutch: { name: 'Big Clutches', icon: '◒', flag: 'clutch', desc: 'One more egg in every clutch, and new tribe members cost less.' },
  /* moving and seeing */
  swift: { name: 'Long Muscles', icon: '➹', mods: { speed: 1.12 }, desc: '+12% speed, on foot, at sea and in the stars.' },
  eyes: { name: 'Keen Eyes', icon: '◉', flag: 'eyes', desc: 'See further through fog and dark, and scanners reach further.' },
  night: { name: 'Night Eyes', icon: '☾', flag: 'night', desc: 'Night is as clear as day, and night hunters think twice about you.' },
  memory: { name: 'Long Memory', icon: '✦', flag: 'memory', desc: 'Wonders are spotted from much further away, your compass shows more of them, and each one you find gives a little extra.' },
  /* only from engulfing other cells, the way real mitochondria and chloroplasts began */
  mito: { name: 'Mitochondria', icon: '⦿', mods: { speed: 1.06, dmg: 1.04 }, flag: 'mito', engulf: true, desc: 'A captured cell now powers yours. Faster, and dashes recharge quicker.' },
  chloro: { name: 'Chloroplasts', icon: '❦', mods: { econ: 1.06 }, flag: 'photo', engulf: true, desc: 'A captured cell now feeds on light. You grow slowly in sunlight and hunger slower by day.' },
  glow: { name: 'Glow Bodies', icon: '✧', mods: { social: 1.05 }, flag: 'night', engulf: true, desc: 'A captured cell makes light inside you. You see in the dark, and you glow.' },
};
const TOLERANCE_GENES = ['frost', 'heat', 'toxin', 'gills'];
const hasGene = (P, id) => !!(P && P.genes && P.genes.includes(id));
const hasFlag = (P, flag) => !!(P && P.genes && P.genes.some(g => GENES[g] && GENES[g].flag === flag));
function geneChip(id) { const g = GENES[id]; return g ? `<span title="${esc(g.desc)}">${g.icon} ${esc(g.name)}</span>` : ''; }
function genomeHTML(P) { const gs = (P.genes || []).filter(g => GENES[g]); return gs.length ? `<div class="mods">${gs.map(geneChip).join('')}</div>` : '<p style="font-size:12.5px">No mutations yet.</p>'; }
function addGene(P, id, quiet) {
  if (!GENES[id] || hasGene(P, id)) return false; P.genes = P.genes || []; P.genes.push(id); recalcMods(P);
  if (!quiet) { toastP(P.i, `Mutation: ${GENES[id].name}. ${GENES[id].desc}`, 'good'); Sfx.discover(P.i); }
  if (S && S.onGene) safely(() => S.onGene(P.i, id)); return true;
}
/* three genes you do not have; the first creature-stage draft always offers a tolerance so new ground opens early */
function draftGenes(P, n = 3, opts = {}) {
  const own = new Set(P.genes || []), pool = Object.keys(GENES).filter(k => !own.has(k) && !GENES[k].engulf && !(opts.not || []).includes(k));
  const out = []; const tol = pool.filter(k => TOLERANCE_GENES.includes(k));
  if ((opts.tolerance || (G.stage === 1 && !TOLERANCE_GENES.some(k => own.has(k)))) && tol.length) out.push(pick(tol));
  const rest = pool.filter(k => !out.includes(k)).sort(() => Math.random() - .5);
  while (out.length < n && rest.length) out.push(rest.pop());
  return out.sort(() => Math.random() - .5);
}

/* ---------- decision cards (mutation drafts and story events) ---------- */
const Decide = {
  q: [[], []], wait: [0, 0],
  reset() { this.q = [[], []]; this.wait = [3, 3]; },
  /* card: { eyebrow, title, sub, choices: [{ label, desc, value?, go() -> string|void }], kind } */
  push(p, card) { if (p >= G.mode) return; card.t = 0; this.q[p].push(card); flowChip(p); Sfx.click(p); },
  pending(p) { return this.q[p] && this.q[p].length; },
  /* opens the next card when the player is not in danger; a card closed without choosing waits in the main menu */
  update(dt) {
    for (let p = 0; p < G.mode; p++) {
      const c = this.q[p][0]; if (!c) continue; c.t += dt; this.wait[p] -= dt;
      if (c.shown || Menus[p].isOpen || this.wait[p] > 0 || Modal.isOpen || Editor.active) continue;
      const calm = !S || !S.calm || S.calm(p); if (!calm && c.t < 45) continue;
      c.shown = true; this.open(p);
    }
  },
  open(p) {
    const c = this.q[p][0]; if (!c) return;
    Menus[p].open({ eyebrow: c.eyebrow, title: c.title, sub: c.sub, menuSelects: false, items: () => [
      ...c.choices.map(ch => ({ label: ch.label, value: ch.value, desc: ch.desc, disabled: ch.ok && !ch.ok(), close: true, onSelect: () => this.choose(p, c, ch) })),
      { label: 'Decide later', desc: 'It waits at the top of your main menu.', close: true, onSelect: () => { this.wait[p] = 60; } }] });
  },
  choose(p, c, ch) {
    this.q[p] = this.q[p].filter(x => x !== c); this.wait[p] = 4; let msg = '';
    try { msg = ch.go ? ch.go() : ''; } catch (e) { console.error(e); }
    if (msg) toastP(p, msg, 'good');
    if (c.kind === 'story') { const P = G.players[p]; P.chronicle = P.chronicle || []; P.chronicle.push({ stage: G.stage, title: c.title, choice: ch.label }); }
    flowChip(p);
  },
  /* entries for the top of every stage's main menu */
  items(p) { const c = this.q[p] && this.q[p][0]; if (!c) return []; return [{ head: true, label: c.kind === 'gene' ? 'Mutation' : 'Something happened' }, { label: c.title, value: this.q[p].length > 1 ? `${this.q[p].length} waiting` : '', desc: c.kind === 'gene' ? 'Choose a mutation for your species.' : 'A decision is waiting for you.', onSelect: () => this.open(p) }]; },
};
/* a mutation draft: pick one of three */
function offerGenes(p, why, opts = {}) {
  const P = G.players[p]; if (!P) return; const ids = opts.ids || draftGenes(P, 3, opts); if (!ids.length) return;
  Decide.push(p, { kind: 'gene', eyebrow: 'Mutation', title: opts.title || 'Your species is changing', sub: why, choices: ids.map(id => ({ label: `${GENES[id].icon} ${GENES[id].name}`, desc: GENES[id].desc, go: () => { addGene(P, id); return ''; } })) });
}

/* ---------- the chronicle: story events per stage ---------- */
const Story = {
  t: [0, 0], seen: [new Set(), new Set()],
  reset() { this.t = [rand(70, 95), rand(85, 110)]; this.seen = [new Set(), new Set()]; },
  update(dt) {
    const list = S && S.chronicle; if (!list || !list.length) return;
    for (let p = 0; p < G.mode; p++) {
      this.t[p] -= dt; if (this.t[p] > 0) continue; this.t[p] = rand(120, 170);
      if (Decide.pending(p) >= 2) continue;
      const ok = list.filter(e => !this.seen[p].has(e.id) && (!e.when || safelyVal(() => e.when.call(S, p))));
      if (!ok.length) continue; const e = pick(ok); this.seen[p].add(e.id); this.fire(p, e);
    }
  },
  fire(p, e) {
    const text = typeof e.text === 'function' ? e.text.call(S, p) : e.text;
    Decide.push(p, { kind: 'story', eyebrow: e.eyebrow || `${STAGE_NAMES[G.stage]} · the chronicle`, title: e.title, sub: text, choices: e.choices.map(ch => ({ label: ch.label, desc: typeof ch.desc === 'function' ? ch.desc.call(S, p) : ch.desc, ok: ch.ok ? () => safelyVal(() => ch.ok.call(S, p)) : null, go: () => ch.go.call(S, p) })) });
    toastP(p, `Something has happened: ${e.title}.`, 'warn');
  },
};
function safelyVal(fn) { try { return fn(); } catch (e) { console.error(e); return false; } }
function chronicleHTML(P) { const c = P.chronicle || []; return c.length ? `<div class="mods">${c.slice(-12).map(e => `<span>${esc(STAGE_NAMES[e.stage] || '')} · ${esc(e.title)}: ${esc(e.choice)}</span>`).join('')}</div>` : '<p style="font-size:12.5px">Nothing written yet.</p>'; }
