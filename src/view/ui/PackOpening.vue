<script lang="ts">
// A ×10 pull is ten single buys in a row (the same meta path, so pity,
// duplicates, level-ups and refunds resolve exactly as ten opens would). The
// view gathers each pack's pulls before closing it and leaves the last one
// open; the opening shows the gathered pulls when they belong to it.
import { ref as vueRef } from "vue";
import { host as h } from "../host.ts";
import { Pack as PackScope, type Pull } from "../../sim/pack.ts";
import { CARDS, MAX_CARD_LEVEL as MAXL, RARITIES, RARITY_INFO as RINFO, type Rarity as R } from "../../content/cards.ts";
import { packDef as pdef } from "../../content/gacha.ts";

const batch: { opened: number; pulls: Pull[]; count: number } = { opened: -1, pulls: [], count: 1 };

function openedCount(): number {
  return h.k.view().derived("gacha").gacha.opened;
}

/** Buys `count` packs, one after another; the last stays open for the reveal. */
export function buyPacks(pack: string, count: number): void {
  const pulls: Pull[] = [];
  let bought = 0;
  for (let n = 0; n < count; n++) {
    h.meta("pack:buy", { pack });
    if (!h.k.paths().includes("/pack")) break;
    pulls.push(...(h.k.read("/pack", PackScope)?.pulls ?? []));
    bought++;
    if (n < count - 1) h.closePack();
  }
  Object.assign(batch, { opened: openedCount(), pulls, count: bought });
}

/** The pulls of a ×10 opening that is on screen now, else null. */
function batchFor(opened: number): typeof batch | null {
  return batch.opened === opened && batch.count > 1 ? batch : null;
}
export { batchFor, openedCount };

/**
 * A pretend opening (Alt+click in the shop): free, touches no save; random
 * cards at random levels and outcomes, rolled with the pack's odds.
 */
export const demo = vueRef<{ id: number; pack: string; pulls: Pull[]; count: number } | null>(null);
let demoId = 0;
export function fakePacks(pack: string, count: number): void {
  const p = pdef(pack);
  const total = RARITIES.reduce((s, r) => s + p.odds[r], 0);
  const pulls: Pull[] = [];
  for (let n = 0; n < count * p.cards; n++) {
    let x = Math.random() * total;
    const rarity = RARITIES.find((r) => (x -= p.odds[r]) < 0) ?? "N";
    const pool = CARDS.filter((c) => c.rarity === rarity);
    const card = pool[Math.floor(Math.random() * pool.length)]!;
    const roll = Math.random();
    const level = roll < 0.35 ? 1 : roll < 0.8 ? 2 + Math.floor(Math.random() * (MAXL - 1)) : MAXL;
    const outcome = roll < 0.35 ? "new" : roll < 0.8 ? "level" : "refund";
    pulls.push({ card: card.id, rarity: rarity as R, outcome, level, refund: outcome === "refund" ? RINFO[rarity as R].refund : 0, pity: false });
  }
  demo.value = { id: ++demoId, pack, pulls, count };
}
</script>

<script setup lang="ts">
// The pack opening, a gacha pull in shrine dress, animated on one clock:
// every transform is computed each frame from a few event times (when the
// bundle breaks, when each card launches, charges and turns), with springs
// and eases, and written straight to the elements (transform and opacity
// only). The clock runs on the animation speed pref and stops for hit-stops.
// 1. The sealed bundle rises in on a spring, strains (a rattle and a throb
//    that build, the seal glowing the best rarity inside), squashes down to
//    wind up, and breaks: a hit-stop, then the band halves peel off and
//    flutter down, the seal halves tumble, washi scraps drift, light blooms.
// 2. The cards fly out of the light on arcs, spinning, tilting up towards
//    the camera, their shadows loosening, and land with a squash, a thud and
//    a nudge of the table.
// 3. Each card charges (lifts, trembles, leaks its rim metal's light), dips,
//    turns over in 3D with a sheen across it and its edge showing, and slaps
//    down. SR pushes in; SSR dims the room, draws motes in under light rays,
//    then a hit-stop, a flash, sparks and petals, and the camera lets go.
// 4. Revealed cards breathe; SR/SSR faces shimmer; stamps slam in.
// Confirm (click, Enter/Space/Z) hurries the next step; skip (X/Ctrl, Esc,
// the button) settles everything at once.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { prefs } from "../prefs.ts";
import { kds } from "../keys.ts";
import { Pack } from "../../sim/pack.ts";
import { MAX_CARD_LEVEL, RARITY_INFO, cardDef, type Rarity } from "../../content/cards.ts";
import { CURRENCY } from "../../content/names.ts";
import { packDef } from "../../content/gacha.ts";
import { wallet } from "./useGame.ts";
import CardFace from "./CardFace.vue";
import CardBack from "./CardBack.vue";
import Keys from "./Keys.vue";
import Hanko from "./Hanko.vue";

const opening = computed(() => {
  void state.meta;
  return host.k.paths().includes("/pack") ? host.k.read("/pack", Pack) : null;
});
// The pulls of this opening, fixed at mount (the scope goes when it closes).
const fake = demo.value;
const multi = fake ? null : batchFor(openedCount());
const pulls = fake ? fake.pulls : multi ? multi.pulls : (opening.value?.pulls ?? []);
const packs = fake ? fake.count : multi ? multi.count : 1;
const packId = fake ? fake.pack : (opening.value?.pack ?? "");
const pack = packId ? packDef(packId) : null;
const big = packs > 1;
const N = pulls.length;

const RANK: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3 };
/** The glow of each rarity: its rim metal (CardFace), SSR's the brightest gold. */
const METAL: Record<Rarity, string> = { N: "#e9e4d8", R: "#8ea6e6", SR: "#bda3ec", SSR: "#fff1a8" };

// ---------- timing (seconds at animation speed 1) ----------
const ENTER = 0.34;
const STRAIN = 0.55;
const WINDUP = 0.13;
const HITSTOP = 0.075;
const DEAL_DELAY = 0.05;
const DEAL_GAP = big ? 0.03 : 0.09;
const FLY = big ? 0.42 : 0.46;
/** Charge before a card turns; a quick one when hurried. */
const HOLD: Record<Rarity, number> = big ? { N: 0.02, R: 0.05, SR: 0.22, SSR: 0.42 } : { N: 0.2, R: 0.3, SR: 0.3, SSR: 0.5 };
/** From one card's turn to the next card's charge: flips overlap. */
const NEXT: Record<Rarity, number> = big ? { N: 0.055, R: 0.07, SR: 0.55, SSR: 1.0 } : { N: 0.3, R: 0.36, SR: 0.85, SSR: 1.2 };
const WIND = 0.07;
const TURN: Record<Rarity, number> = { N: 0.32, R: 0.34, SR: 0.62, SSR: 0.74 };
/** How far it turns: a rare card spins over three times in a higher jump. */
const SPIN: Record<Rarity, number> = { N: 180, R: 180, SR: 540, SSR: 540 };
const JUMP: Record<Rarity, number> = { N: 18, R: 26, SR: 80, SSR: 110 };
const LIFT: Record<Rarity, number> = { N: 8, R: 12, SR: 26, SSR: 40 };
const GROW: Record<Rarity, number> = big ? { N: 0.04, R: 0.06, SR: 0.35, SSR: 0.7 } : { N: 0.03, R: 0.04, SR: 0.07, SSR: 0.1 };
const TREMBLE: Record<Rarity, number> = { N: 0, R: 0.5, SR: 2, SSR: 3.6 };

// ---------- layout: a row of three, or a grid of packs (one column each) ----------
const CW = 170;
const CH = 250;
const S = big ? (packs > 6 ? 0.5 : 0.62) : 1;
const GX = big ? 12 : 34;
const GY = big ? 12 : 0;
const cols = big ? packs : N;
const rows = big ? (pack?.cards ?? 3) : 1;
const tableW = cols * CW * S + (cols - 1) * GX;
const tableH = rows * CH * S + (rows - 1) * GY;
const home = pulls.map((_, i) => {
  const c = big ? Math.floor(i / rows) : i;
  const r = big ? i % rows : 0;
  return { x: (c - (cols - 1) / 2) * (CW * S + GX), y: (r - (rows - 1) / 2) * (CH * S + GY) };
});

const best = pulls.reduce<Rarity>((b, p) => (RANK[p.rarity] > RANK[b] ? p.rarity : b), "N");
const bestIdx = pulls.findIndex((p) => p.rarity === best);

// ---------- easing ----------
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const outCubic = (t: number) => 1 - (1 - t) ** 3;
const outQuart = (t: number) => 1 - (1 - t) ** 4;
const inCubic = (t: number) => t * t * t;
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** A damped spring's step from 0 to 1 (overshoots when zeta < 1). */
function spring(t: number, hz: number, zeta: number): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}
/** An impulse ringing down: 0 at t = 0, first swing positive. */
const wobble = (t: number, hz: number, decay: number) => (t < 0 || t > 30 ? 0 : Math.exp(-decay * t) * Math.sin(2 * Math.PI * hz * t));
/** Smooth jitter in about -1..1. */
const jitter = (t: number, seed: number) => Math.sin(t * 67 + seed) * 0.6 + Math.sin(t * 41.3 + seed * 2.1) * 0.4;
/** A heartbeat throb, 0..1. */
const throb = (phase: number) => Math.max(0, Math.sin(phase)) ** 6;

// ---------- the clock and the events ----------
type Phase = "pack" | "deal" | "reveal" | "done";
const phase = ref<Phase>("pack");
let T = 0;
let prevT = 0;
let freeze = 0;
let tBreak = ENTER + STRAIN + WINDUP;
let breaking = false;
let burst = false;
let B = Infinity;
let skipped = false;

interface CardT {
  launch: number;
  charge: number;
  flip: number;
  /** When a stamp hit it (a small shake). */
  hit: number;
}
const ct: CardT[] = pulls.map(() => ({ launch: Infinity, charge: Infinity, flip: Infinity, hit: -Infinity }));
const slap = (i: number) => ct[i]!.flip + WIND + TURN[pulls[i]!.rarity] * 0.85;
const landAt = (i: number) => ct[i]!.launch + FLY;
const crossed = (t: number) => prevT < t && t <= T;

/** Card k onwards: each charges after the previous turns. */
function planReveal(k: number, from: number): void {
  let t = from;
  for (let j = k; j < N; j++) {
    const r = pulls[j]!.rarity;
    ct[j]!.charge = t;
    ct[j]!.flip = t + HOLD[r];
    t = ct[j]!.flip + NEXT[r];
  }
}

// Camera: decaying nudges, a push-in towards a card.
interface Nudge {
  t: number;
  x: number;
  y: number;
  hz: number;
}
const nudges: Nudge[] = [];
function nudge(x: number, y: number, hz = 9): void {
  nudges.push({ t: T, x: x * prefs.shake, y: y * prefs.shake, hz });
  if (nudges.length > 12) nudges.shift();
}
interface Flash {
  t: number;
  amp: number;
  dur: number;
}
const flashes: Flash[] = [];

// ---------- particles (plain DOM, pooled per burst) ----------
type Kind = "paper" | "chip" | "spark" | "petal" | "mote" | "body";
interface Part {
  el: HTMLElement;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  fl: number;
  fls: number;
  age: number;
  life: number;
  g: number;
  drag: number;
  x0: number;
  y0: number;
  size: number;
}
const parts: Part[] = [];
const fx = ref<HTMLElement | null>(null);

function spawn(kind: Kind, x: number, y: number, vx: number, vy: number, life: number, size: number, color = ""): void {
  if (!fx.value) return;
  const el = document.createElement("i");
  el.className = `po-p po-${kind}`;
  el.style.width = `${size}px`;
  el.style.height = `${kind === "paper" || kind === "petal" ? size * 1.5 : size}px`;
  el.style.marginLeft = `${-size / 2}px`;
  el.style.marginTop = `${-size / 2}px`;
  if (color) el.style.setProperty("--c", color);
  fx.value.appendChild(el);
  const heavy = kind === "chip" || kind === "spark";
  parts.push({
    el,
    kind,
    x,
    y,
    vx,
    vy,
    r: Math.random() * 360,
    vr: (Math.random() - 0.5) * (heavy ? 900 : 500),
    fl: Math.random() * 6,
    fls: 6 + Math.random() * 8,
    age: 0,
    life,
    g: kind === "spark" ? 500 : kind === "mote" ? 0 : heavy ? 1500 : 700,
    drag: kind === "spark" ? 2.4 : heavy ? 1 : 3.2,
    x0: x,
    y0: y,
    size,
  });
}
/** A big piece of the bundle (band or seal half) thrown as a body. */
function throwBody(el: HTMLElement | null, vx: number, vy: number, vr: number, paper: boolean): void {
  if (!el) return;
  parts.push({ el, kind: "body", x: 0, y: 0, vx, vy, r: 0, vr, fl: 0, fls: paper ? 7 : 0, age: 0, life: 1.4, g: paper ? 900 : 1700, drag: paper ? 1.8 : 0.6, x0: 0, y0: 0, size: 0 });
}
function stepParts(dt: number): void {
  for (let n = parts.length - 1; n >= 0; n--) {
    const p = parts[n]!;
    p.age += dt;
    if (p.age >= p.life) {
      if (p.kind === "body") p.el.style.opacity = "0";
      else p.el.remove();
      parts.splice(n, 1);
      continue;
    }
    const k = p.age / p.life;
    if (p.kind === "mote") {
      // Drawn in towards the charging card, faster as it nears.
      const e = inCubic(k);
      p.x = lerp(p.x0, p.vx, e);
      p.y = lerp(p.y0, p.vy, e);
      p.el.style.opacity = String(Math.min(1, k * 3) * (1 - e * 0.6));
      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${1 - e * 0.5})`;
      continue;
    }
    const d = Math.exp(-p.drag * dt);
    p.vx *= d;
    p.vy = p.vy * d + p.g * dt;
    if (p.fls) {
      // Paper and petals flutter: a sideways sway and a turning over.
      p.fl += p.fls * dt;
      p.vx += Math.sin(p.fl) * 260 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += p.vr * dt;
    p.vr *= Math.exp(-0.6 * dt);
    const fade = 1 - clamp01((k - 0.6) / 0.4);
    if (p.kind === "body") {
      p.el.style.opacity = String(fade);
      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.r}deg) rotateX(${p.fls ? Math.sin(p.fl) * 55 : 0}deg)`;
    } else if (p.kind === "spark") {
      p.el.style.opacity = String(fade);
      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.r}deg) scale(${1 - k * 0.8})`;
    } else {
      p.el.style.opacity = String(fade);
      p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.r}deg) scaleY(${p.fls ? Math.cos(p.fl) : 1})`;
    }
  }
}
function clearParts(): void {
  for (const p of parts) {
    if (p.kind === "body") p.el.style.opacity = "0";
    else p.el.remove();
  }
  parts.length = 0;
}

// ---------- element refs ----------
const root = ref<HTMLElement | null>(null);
const table = ref<HTMLElement | null>(null);
const bundle = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const leak = ref<HTMLElement | null>(null);
const sealGlow = ref<HTMLElement | null>(null);
const wrapL = ref<HTMLElement | null>(null);
const wrapR = ref<HTMLElement | null>(null);
const sealL = ref<HTMLElement | null>(null);
const sealR = ref<HTMLElement | null>(null);
const bloom = ref<HTMLElement | null>(null);
const dimmer = ref<HTMLElement | null>(null);
const flashEl = ref<HTMLElement | null>(null);
const slotEls = ref<HTMLElement[]>([]);
const labelEls = ref<HTMLElement[]>([]);

interface CardEls {
  slot: HTMLElement;
  flipper: HTMLElement;
  shadow: HTMLElement;
  glow: HTMLElement;
  ring: HTMLElement;
  rays: HTMLElement | null;
  sheenB: HTMLElement;
  sheenF: HTMLElement;
  shadeB: HTMLElement;
  shadeF: HTMLElement;
  foil: HTMLElement | null;
  badge: HTMLElement | null;
  max: HTMLElement | null;
  maxBg: HTMLElement | null;
  tag: HTMLElement | null;
  coin: HTMLElement | null;
  label: HTMLElement | null;
  chev: SVGElement | null;
}
let els: CardEls[] = [];

function collect(): void {
  els = slotEls.value.map((slot, i) => {
    const q = (s: string) => slot.querySelector<HTMLElement>(s);
    const label = labelEls.value[i] ?? null;
    return {
      slot,
      flipper: q(".flipper")!,
      shadow: q(".shadow")!,
      glow: q(".glow")!,
      ring: q(".ring")!,
      rays: q(".rays"),
      sheenB: q(".back .sheen")!,
      sheenF: q(".front .sheen")!,
      shadeB: q(".back .shade")!,
      shadeF: q(".front .shade")!,
      foil: q(".foil"),
      badge: q(".badge"),
      max: q(".maxed b"),
      maxBg: q(".maxed"),
      tag: q(".tag"),
      coin: q(".coinrise"),
      label,
      chev: label?.querySelector<SVGElement>(".chev .up") ?? null,
    };
  });
}

/** Opacity, hiding the element outright when it is (nearly) clear, so its layer costs nothing. */
function op(el: HTMLElement | SVGElement | null, o: number): void {
  if (!el) return;
  el.style.opacity = o < 0.004 ? "0" : o.toFixed(3);
  el.style.visibility = o < 0.004 ? "hidden" : "";
}

// ---------- events ----------
function startBreak(): void {
  breaking = true;
  T = tBreak;
  freeze = HITSTOP;
  audio.play("pop", { pitch: 0.6 });
  flashes.push({ t: T, amp: 0.2, dur: 0.3 });
}
function startBurst(): void {
  burst = true;
  B = T;
  audio.play("flip");
  audio.play("whoosh");
  nudge(0, 10, 7);
  throwBody(wrapL.value, -420, -360, -240, true);
  throwBody(wrapR.value, 440, -280, 280, true);
  throwBody(sealL.value, -200, -560, -420, false);
  throwBody(sealR.value, 230, -520, 460, false);
  const n = big ? 34 : 22;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
    const v = 350 + Math.random() * 650;
    const kind = k % 4 === 3 ? "chip" : "paper";
    spawn(kind, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 80, Math.cos(a) * v, Math.sin(a) * v, 1.1 + Math.random() * 0.8, kind === "chip" ? 7 + Math.random() * 7 : 9 + Math.random() * 12);
  }
  ct.forEach((c, i) => (c.launch = B + DEAL_DELAY + i * DEAL_GAP));
  planReveal(0, landAt(N - 1) + 0.2);
  phase.value = "deal";
}
function onSlap(i: number): void {
  const p = pulls[i]!;
  const rank = RANK[p.rarity];
  const at = home[i]!;
  if (!skipped) audio.play(`reveal${p.rarity}` as "revealN", big && rank < 2 ? { vol: 0.45 } : {});
  nudge(0, big && rank < 2 ? 1 : 3 + rank * 2, 10);
  if (rank >= 2) {
    const n = p.rarity === "SSR" ? 30 : 16;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = 300 + Math.random() * (p.rarity === "SSR" ? 700 : 420);
      spawn("spark", at.x, at.y, Math.cos(a) * v, Math.sin(a) * v - 120, 0.6 + Math.random() * 0.5, 10 + Math.random() * 8, METAL[p.rarity]);
    }
  }
  if (p.rarity === "SSR") {
    freeze = HITSTOP;
    flashes.push({ t: T, amp: 0.55, dur: 0.35 });
    for (let k = 0; k < 14; k++) spawn("petal", at.x + (Math.random() - 0.5) * 160, at.y - 80 + (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 500, -300 - Math.random() * 300, 1.8 + Math.random(), 10 + Math.random() * 5);
    for (let k = 0; k < 6; k++) nudges.push({ t: T + k * 0.03, x: (Math.random() - 0.5) * 14 * prefs.shake, y: (Math.random() - 0.5) * 10 * prefs.shake, hz: 13 });
  } else if (p.rarity === "SR") flashes.push({ t: T, amp: 0.25, dur: 0.3 });
}

function frame(now: number): void {
  const real = (Math.min(50, now - last) / 1000) * prefs.animSpeed;
  last = now;
  prevT = T;
  let dt = real;
  if (freeze > 0) {
    freeze -= real;
    dt = 0;
  }
  T += dt;
  if (!breaking && T >= tBreak) startBreak();
  else if (breaking && !burst && freeze <= 0) startBurst();
  if (burst && !skipped) {
    for (let i = 0; i < N; i++) {
      const c = ct[i]!;
      const r = pulls[i]!.rarity;
      if (crossed(landAt(i))) {
        audio.play("flip", { pitch: 0.8 + (i % 5) * 0.08, vol: big ? 0.5 : 1 });
        nudge(0, big ? 1.2 : 3, 11);
      }
      if (crossed(c.charge) && RANK[r] >= 2) audio.play("power", { vol: r === "SSR" ? 1 : 0.6 });
      if (crossed(c.flip)) audio.play("draw", { vol: big ? 0.3 : 0.6 });
      if (crossed(slap(i))) onSlap(i);
      const s = slap(i);
      const p = pulls[i]!;
      if ((p.outcome === "new" && crossed(s + 0.12 + 0.08)) || (p.outcome === "refund" && crossed(s + 0.15 + 0.08))) {
        c.hit = T;
        if (!big || RANK[r] >= 2) audio.play("pop", { pitch: 0.55, vol: 0.5 });
      }
      if (p.outcome === "refund" && crossed(s + 0.3)) audio.play("coin");
      if (!big && p.outcome === "level" && crossed(s + 0.45)) audio.play("ui", { pitch: 1.7 });
      // A rare card throws sparks off as it spins.
      if (RANK[r] >= 2 && T >= c.flip + WIND && T < slap(i) && dt > 0) {
        const at = home[i]!;
        for (let k = 0; k < (r === "SSR" ? 2 : 1); k++) {
          const a = Math.random() * Math.PI * 2;
          spawn("spark", at.x + Math.cos(a) * 70 * S, at.y - JUMP[r] * 0.6 + Math.sin(a) * 100 * S, Math.cos(a) * 140, Math.sin(a) * 140 - 60, 0.5, 7 + Math.random() * 6, METAL[r]);
        }
      }
      // The SSR draws motes of light in while it charges.
      if (r === "SSR" && T >= c.charge && T < c.flip && dt > 0 && Math.random() < dt * 40) {
        const a = Math.random() * Math.PI * 2;
        const d = 180 + Math.random() * 140;
        const at = home[i]!;
        parts.push(makeMote(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, at.x, at.y));
      }
    }
    if (phase.value === "deal" && T >= landAt(N - 1)) phase.value = "reveal";
    if (phase.value === "reveal" && T >= slap(N - 1) + 0.15) phase.value = "done";
  }
  stepParts(dt);
  render();
  raf = requestAnimationFrame(frame);
}
function makeMote(x: number, y: number, tx: number, ty: number): Part {
  const el = document.createElement("i");
  el.className = "po-p po-mote";
  fx.value?.appendChild(el);
  return { el, kind: "mote", x, y, vx: tx, vy: ty, r: 0, vr: 0, fl: 0, fls: 0, age: 0, life: 0.5 + Math.random() * 0.3, g: 0, drag: 0, x0: x, y0: y, size: 6 };
}

// ---------- drawing ----------
function renderBundle(): void {
  const b = bundle.value;
  if (!b) return;
  if (burst) {
    b.style.transform = big ? "scale(1.18)" : "none";
    op(body.value, 0);
    op(leak.value, 0);
    op(sealGlow.value, 0);
    const tb = T - B;
    const bl = bloom.value;
    if (bl) {
      bl.style.transform = `scale(${lerp(1.2, big ? 9 : 7, outQuart(clamp01(tb / 0.5)))})`;
      op(bl, (1 - clamp01(tb / 0.55)) ** 1.5);
    }
    if (tb > 2) b.style.visibility = "hidden";
    return;
  }
  // Rising in on a spring.
  const k = spring(T, 1.7, 0.55);
  let x = 0;
  let y = 380 * (1 - k);
  let rot = -10 * (1 - k);
  let sx = 0.8 + 0.2 * k;
  let sy = sx;
  // Straining: a rattle and a throb that build.
  const s = clamp01((T - ENTER * 0.7) / STRAIN);
  const w = outCubic(clamp01(1 - (tBreak - T) / WINDUP));
  const amp = s * s * (0.8 + RANK[best] * 0.25) * 4 * (1 - w);
  x += amp * jitter(T, 1);
  y += amp * 0.5 * jitter(T, 9);
  rot += amp * 0.7 * jitter(T, 5);
  const beat = throb(T * 2 * Math.PI * (2 + s * 1.5)) * s;
  sx += 0.035 * beat;
  sy -= 0.02 * beat;
  // The wind-up: it squashes down before it gives.
  sx *= 1 + 0.08 * w;
  sy *= 1 - 0.12 * w;
  y += 12 * w;
  let bright = 1;
  if (breaking) {
    // The hit-stop frame: stretched, white-hot.
    sx = 0.93;
    sy = 1.13;
    y = -10;
    x = 0;
    rot = 0;
    bright = 2.2;
  }
  const size = big ? 1.18 : 1;
  b.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${sx * size}, ${sy * size})`;
  if (body.value) body.value.style.filter = bright > 1 ? `brightness(${bright})` : "";
  const glow = clamp01((s - 0.3) / 0.7) + beat * 0.3;
  op(sealGlow.value, breaking ? 1 : glow);
  if (leak.value) {
    op(leak.value, breaking ? 1 : s * 0.75 + beat * 0.2);
    leak.value.style.transform = `scale(${1 + 0.08 * s + 0.05 * beat})`;
  }
  op(bloom.value, breaking ? 1 : 0);
  if (bloom.value) bloom.value.style.transform = "scale(1.4)";
}

function renderCard(i: number): { push: number; dim: number; px: number; py: number } {
  const e = els[i]!;
  const c = ct[i]!;
  const p = pulls[i]!;
  const r = p.rarity;
  const rank = RANK[r];
  const at = home[i]!;
  const out = { push: 0, dim: 0, px: at.x, py: at.y };
  if (!burst) {
    e.slot.style.visibility = "hidden";
    return out;
  }
  e.slot.style.visibility = "visible";
  // Where it lies in the stack it came out of.
  const so = { x: ((i % 3) - 1) * 5, y: ((i % 3) - 1) * -3, r: ((i % 3) - 1) * 3 };
  const tb = T - B;
  let x: number;
  let y: number;
  let rz: number;
  let sc = 1;
  let sx = 1;
  let sy = 1;
  let rx = 0;
  let ry = 0;
  let alt = 0;
  const u = clamp01((T - c.launch) / FLY);
  if (T < c.launch) {
    // Still in the stack: recovering from the burst's stretch, dipping just before it goes.
    const rec = spring(tb, 3, 0.4);
    x = so.x;
    y = so.y;
    rz = so.r;
    sx = lerp(0.93, 1, rec);
    sy = lerp(1.13, 1, rec);
    sc = big ? 1.18 : 1;
    sc *= 1 - 0.05 * clamp01(1 - (c.launch - T) / 0.08);
  } else {
    // In flight: an arc up and over, spinning, tilted to the camera; snappy out, easing in.
    const s = outCubic(u);
    const p0 = so;
    const p2 = at;
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - (big ? 120 : 170) - Math.abs(p2.x) * 0.08 };
    x = (1 - s) ** 2 * p0.x + 2 * (1 - s) * s * p1.x + s * s * p2.x;
    y = (1 - s) ** 2 * p0.y + 2 * (1 - s) * s * p1.y + s * s * p2.y;
    alt = Math.sin(Math.PI * s);
    const dir = i % 2 ? 1 : -1;
    const spin0 = dir * (160 + (i % 3) * 50);
    rz = lerp(so.r, 0, s) + spin0 * (1 - spring(T - c.launch, 1.5, 0.62));
    const scaleFrom = big ? 1.18 : 1;
    sc = lerp(scaleFrom, S, s) * (1 + 0.16 * alt);
    rx = 26 * alt;
    ry = 14 * alt * dir;
    // Touching down: a squash that rings out.
    const tl = T - landAt(i);
    if (tl >= 0) {
      const wv = wobble(tl, 4.2, 9);
      sx = 1 + 0.05 * wv;
      sy = 1 - 0.07 * wv;
    }
  }

  // The charge: lift, grow, tremble, leak light.
  const hold = HOLD[r];
  const v = T >= c.charge ? clamp01((Math.min(T, c.flip) - c.charge) / Math.max(hold, 0.001)) : 0;
  const f = T - c.flip;
  const keep = f >= 0 ? 1 - inCubic(clamp01(f / (WIND + TURN[r] * 0.8))) : 1;
  const lv = inOutCubic(v) * keep;
  y -= LIFT[r] * lv * (big ? 0.6 : 1);
  sc *= 1 + GROW[r] * lv;
  const charging = T >= c.charge && T < c.flip;
  if (charging) {
    const a = TREMBLE[r] * v * v;
    x += a * jitter(T, i * 7);
    y += a * 0.6 * jitter(T, i * 7 + 11);
    rz += a * 0.4 * jitter(T, i * 7 + 3);
  }
  if (big && rank >= 2) {
    // In a ×10 grid the rare card comes forward, towards the middle.
    x = lerp(x, x * 0.7, lv);
    y = lerp(y, y * 0.7, lv);
  }

  // The turn: a dip and a wind-up the other way, then over on a spring, arcing up, slapping down.
  if (f >= 0) {
    const fw = clamp01(f / WIND);
    const turn = TURN[r];
    const ft = f - WIND;
    ry = f < WIND ? -10 * outCubic(fw) : -10 + (SPIN[r] + 10) * spring(ft, 0.5 / turn, 0.68);
    sc *= 1 - 0.035 * Math.sin((Math.PI / 2) * fw) * (1 - clamp01(ft / 0.1));
    const arc = Math.sin(Math.PI * clamp01(ft / (turn * 0.85)));
    y -= JUMP[r] * arc * (big ? 0.5 : 1);
    sc *= 1 + (0.06 + rank * 0.04) * arc;
    alt = Math.max(alt, arc * 0.6);
    const ts = T - slap(i);
    if (ts >= 0) {
      const wv = wobble(ts, 4, 9);
      sc *= 1 - 0.05 * wv;
      rx += -6 * wv;
    }
  }

  // Idle: face-down cards and revealed ones breathe; the stamp's hit shakes it.
  const idleFrom = f >= 0 ? slap(i) + 0.4 : landAt(i) + 0.3;
  const iw = clamp01((T - idleFrom) / 0.8) * (1 - v * keep);
  y += iw * 2.5 * Math.sin(T * 1.7 + i * 1.9) * (big ? 0.5 : 1);
  // (A ×10 grid only bobs: thirty cards tilting in 3D would cost more than they give.)
  if (!big) {
    rx += iw * 2.2 * Math.sin(T * 1.1 + i);
    ry += iw * 3 * Math.sin(T * 0.8 + i * 2.3);
  }
  x += 3 * wobble(T - c.hit, 14, 16);
  rz += 1.2 * wobble(T - c.hit, 11, 14);

  e.slot.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rz}deg) scale(${sc * sx}, ${sc * sy})`;
  e.slot.style.zIndex = charging || (f >= 0 && T < slap(i) + 0.3) ? "5" : u < 1 ? "4" : i === bestIdx && phase.value === "done" ? "3" : "1";
  e.flipper.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;

  // Shadow on the table: loose and faint in the air, tight when it touches.
  const lift = Math.max(alt, lv * 0.5);
  e.shadow.style.transform = `translate3d(${6 + lift * 26}px, ${10 + lift * 60}px, 0) scale(${1 - lift * 0.12})`;
  op(e.shadow, 0.6 - lift * 0.35);

  // Light: the charge's leak, the slap's burst, a warm idle glow on the rare ones.
  const ts = T - slap(i);
  const pulse = charging && rank >= 3 ? throb(T * 2 * Math.PI * (1.6 + v * 3)) * 0.35 : 0;
  const spinning = f >= 0 && ts < 0;
  const leakO = charging ? v * (0.3 + rank * 0.22) + pulse : spinning && rank >= 2 ? 0.55 + rank * 0.1 : 0;
  const burstO = ts >= 0 ? (1 - clamp01(ts / 0.6)) ** 2 * (0.5 + rank * 0.2) : 0;
  const idleO = ts >= 0 ? clamp01(ts / 0.6) * (rank >= 2 ? 0.28 + 0.08 * Math.sin(T * 2 + i) : i === bestIdx && big ? 0.2 : 0) : 0;
  op(e.glow, Math.min(1, leakO + burstO + idleO));
  e.glow.style.transform = `scale(${1 + 0.1 * v + 0.2 * (ts >= 0 ? outCubic(clamp01(ts / 0.4)) * (1 - clamp01(ts / 0.6)) : 0)})`;
  // Ring burst.
  if (ts >= 0 && ts < 0.6) {
    e.ring.style.transform = `scale(${lerp(0.7, 2.2, outCubic(ts / 0.55))})`;
    op(e.ring, (1 - clamp01(ts / 0.55)) ** 1.5);
  } else op(e.ring, 0);
  if (e.rays) {
    const ro = charging ? v * 0.85 : spinning ? 0.9 : ts >= 0 ? lerp(0.9, 0.5, clamp01(ts / 1.2)) : 0;
    op(e.rays, ro);
    e.rays.style.transform = `rotate(${T * 14}deg) scale(${0.6 + 0.4 * (charging ? outCubic(v) : 1) + (ts >= 0 ? 0.25 * wobble(ts, 2, 4) : 0)})`;
  }

  // Sheen across the face as it turns, and shading towards edge-on.
  // Each half turn sweeps the band across once.
  const turnK = f >= 0 ? (((ry % 180) + 180) % 180) / 180 : clamp01((ry + 10) / 200);
  const sheenO = Math.sin(Math.PI * turnK) * 0.85;
  const pos = (turnK * 2.4 - 1.2) * 100;
  e.sheenB.style.transform = `translateX(${pos}%)`;
  e.sheenF.style.transform = `translateX(${-pos}%)`;
  op(e.sheenB, sheenO);
  op(e.sheenF, sheenO);
  const shade = 0.6 * Math.abs(Math.sin((ry * Math.PI) / 180)) ** 1.5;
  op(e.shadeB, shade);
  op(e.shadeF, shade);
  if (e.foil) {
    op(e.foil, ts >= 0 ? clamp01(ts / 0.5) * 0.55 : 0);
    e.foil.style.transform = `translateX(${(((T * 0.22 + ry * 0.01 + i * 0.37) % 1.6) - 1.1) * 100}%)`;
  }

  // Stamps slam in from large, overshoot, settle.
  const stamp = (el: HTMLElement | null, t0: number, tilt: number) => {
    if (!el) return;
    const t = T - t0;
    if (t < 0) return op(el, 0);
    const k2 = spring(t, 3.2, 0.45);
    el.style.transform = `rotate(${tilt + (1 - k2) * -18}deg) scale(${1 + 1.8 * (1 - k2)})`;
    op(el, clamp01(t / 0.05));
  };
  stamp(e.badge, slap(i) + 0.12, 10);
  stamp(e.max, slap(i) + 0.15, -14);
  op(e.maxBg, ts >= 0.15 ? clamp01((ts - 0.15) / 0.15) : 0);
  if (e.tag) {
    const t = ts - 0.2;
    op(e.tag, clamp01(t / 0.15));
    e.tag.style.transform = `translateY(${10 * (1 - spring(t, 3, 0.5))}px)`;
  }
  if (e.coin) {
    const t = ts - 0.3;
    op(e.coin, t < 0 ? 0 : Math.min(1, t / 0.1) * (1 - clamp01((t - 0.8) / 0.4)));
    e.coin.style.transform = `translateY(${-80 * outCubic(clamp01(t / 1.2))}px) scale(${t < 0 ? 0.6 : lerp(0.6, 1, spring(t, 3, 0.4))})`;
  }
  if (e.label) {
    const t = ts - 0.1;
    op(e.label, clamp01(t / 0.2));
    e.label.style.transform = `translateY(${12 * (1 - spring(t, 2.5, 0.55))}px)`;
  }
  if (e.chev) {
    const t = ts - 0.45;
    e.chev.style.transform = `scale(${t < 0 ? 0 : spring(t, 3.5, 0.4)})`;
  }

  if (charging || (f >= 0 && ts < 1.2)) {
    const w = charging ? inOutCubic(v) : 1 - spring(ts, 1.6, 0.5);
    out.push = (rank >= 3 ? 0.07 : rank >= 2 ? 0.03 : 0) * w;
    out.dim = (rank >= 3 ? 0.65 : rank >= 2 ? 0.25 : 0) * (charging ? v : 1 - outCubic(clamp01(ts / 0.8)));
  }
  return out;
}

function render(): void {
  renderBundle();
  let push = 0;
  let dim = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i < N; i++) {
    const o = renderCard(i);
    if (Math.abs(o.push) > Math.abs(push)) {
      push = o.push;
      px = o.px;
      py = o.py;
    }
    dim = Math.max(dim, o.dim);
  }
  // Camera: nudges ring down; a push-in towards the card of the moment.
  let nx = 0;
  let ny = 0;
  for (const n of nudges) {
    const w = wobble(T - n.t, n.hz, 9);
    nx += n.x * w;
    ny += n.y * w;
  }
  if (table.value) table.value.style.transform = `translate3d(${nx - px * push * 0.5}px, ${ny - py * push * 0.5}px, 0) scale(${1 + push})`;
  op(dimmer.value, dim);
  let fl = 0;
  for (const f of flashes) if (T >= f.t) fl += f.amp * (1 - clamp01((T - f.t) / f.dur)) ** 3;
  op(flashEl.value, Math.min(1, fl));
}

let raf = 0;
let last = 0;

/** Confirm: the next step now. */
function advance(): void {
  if (!breaking) {
    tBreak = Math.min(tBreak, T + 0.06);
    return;
  }
  if (!burst) return;
  if (T < landAt(N - 1)) {
    for (const c of ct) if (T < c.launch + FLY) c.launch = Math.min(c.launch, T - FLY * 0.8);
    planReveal(0, T + FLY * 0.2 + 0.12);
    return;
  }
  const k = ct.findIndex((c) => c.flip > T);
  if (k < 0) return;
  const c = ct[k]!;
  if (c.charge > T) {
    c.charge = T;
    c.flip = T + Math.min(HOLD[pulls[k]!.rarity], 0.1);
  } else c.flip = T;
  const r = pulls[k]!.rarity;
  planRest(k + 1, c.flip + NEXT[r]);
}
function planRest(k: number, from: number): void {
  if (k < N) planReveal(k, from);
}
/** Skip: everything settled now, one sound for the best card. */
function revealAll(): void {
  if (phase.value === "done") return;
  skipped = true;
  if (!burst) {
    breaking = true;
    burst = true;
    B = T - 10;
    freeze = 0;
    for (const el of [wrapL.value, wrapR.value, sealL.value, sealR.value]) if (el) el.style.opacity = "0";
  }
  clearParts();
  for (const c of ct) {
    c.launch = Math.min(c.launch, T - 10);
    if (c.flip > T) {
      c.charge = T - 10;
      c.flip = T - 9;
    }
  }
  nudges.length = 0;
  flashes.length = 0;
  flashes.push({ t: T, amp: best === "SSR" ? 0.5 : 0.2, dur: 0.35 });
  prevT = T;
  freeze = 0;
  audio.play(`reveal${best}` as "revealN");
  if (pulls.some((p) => p.outcome === "refund")) audio.play("coin");
  phase.value = "done";
}

function onConfirm(): void {
  if (phase.value !== "done") return advance();
  // Done: Confirm presses the selected button (Continue unless one was picked).
  const a = document.activeElement;
  if (a instanceof HTMLButtonElement && root.value?.contains(a)) a.click();
  else close();
}
function onBack(): void {
  if (phase.value === "done") close();
  else revealAll();
}
function close(): void {
  audio.play("back");
  if (fake) demo.value = null;
  else host.closePack();
}
const canAgain = computed(() => !!pack && (!!fake || wallet.value.coins >= pack.cost));
const canTen = computed(() => !!pack && (!!fake || wallet.value.coins >= pack.cost * 10));
/** Another opening; a pretend one goes on pretending (and Alt+click pretends). */
function again(count: number, e?: MouseEvent): void {
  if (!pack) return;
  audio.play("buy");
  if (fake || e?.altKey) {
    if (!fake) host.closePack();
    return fakePacks(pack.id, count);
  }
  host.closePack();
  buyPacks(pack.id, count);
}

// Skip (X/Ctrl) reveals every card; kds hands it to us whatever has focus.
const offSkip = kds.on({ code: "Action:skip", mods: undefined, event: { repeat: false } }, (e) => {
  e.event.preventDefault();
  revealAll();
});
onMounted(() => {
  collect();
  audio.play("whoosh", { vol: 0.6 });
  last = performance.now();
  render();
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  offSkip();
  clearParts();
});

const summary = computed(() => {
  const n = pulls.filter((p) => p.outcome === "new").length;
  const l = pulls.filter((p) => p.outcome === "level").length;
  const coins = pulls.reduce((s, p) => s + (p.outcome === "refund" ? p.refund : 0), 0);
  const sr = pulls.filter((p) => p.rarity === "SR").length;
  const ssr = pulls.filter((p) => p.rarity === "SSR").length;
  return [n && `${n} new`, l && `${l} level up${l > 1 ? "s" : ""}`, big && sr && `${sr} SR`, big && ssr && `${ssr} SSR`, coins && `+${coins} ${CURRENCY.icon}`].filter(Boolean).join(" · ");
});
const newNames = [...new Set(pulls.filter((p) => p.outcome === "new").map((p) => cardDef(p.card).name))];
const bestName = bestIdx >= 0 ? cardDef(pulls[bestIdx]!.card).name : "";
</script>

<template>
  <div
    v-if="pack"
    ref="root"
    v-keynav="{ confirm: onConfirm, back: onBack, autofocus: false }"
    class="opening"
    :class="[phase, 'best' + best, { big }]"
    @click="phase !== 'done' && advance()"
  >
    <div ref="dimmer" class="dimmer"></div>
    <div class="stage">
      <header>
        <h2>{{ pack.name }}<span v-if="big" class="times"> ×{{ packs }}</span></h2>
        <p class="hint">{{ phase === "done" ? summary : "" }}</p>
      </header>

      <div ref="table" class="table" :style="{ width: `${tableW}px`, height: `${tableH}px` }">
        <!-- The sealed bundle. -->
        <div ref="bundle" class="bundle" :style="{ '--sc': METAL[best] }">
          <div ref="leak" class="leak"></div>
          <div ref="body" class="body">
            <template v-if="big">
              <CardBack v-for="n in 4" :key="n" class="under" :style="{ transform: `translate(${(n % 2 ? 1 : -1) * n * 2.5}px, ${n * 2.5}px) rotate(${(n % 2 ? 1 : -1) * n * 1.2}deg)`, filter: `brightness(${0.5 + n * 0.06})` }" />
            </template>
            <CardBack class="under u1" />
            <CardBack class="under u2" />
            <CardBack class="top" />
          </div>
          <div ref="wrapL" class="wrap left"><span>御神</span></div>
          <div ref="wrapR" class="wrap right"><span>{{ big ? "十連" : "籤" }}</span></div>
          <div ref="sealGlow" class="sealglow"></div>
          <div ref="sealL" class="seal left"><i>封</i></div>
          <div ref="sealR" class="seal right"><i>封</i></div>
        </div>
        <div ref="bloom" class="bloom" :style="{ '--sc': METAL[best] }"></div>

        <div
          v-for="(p, i) in pulls"
          :key="i"
          ref="slotEls"
          class="slot"
          :class="['r' + p.rarity, { best: big && i === bestIdx }]"
          :style="{ '--mc': METAL[p.rarity], '--bs': big ? 1.8 : 1 }"
        >
          <div class="shadow"></div>
          <div v-if="p.rarity === 'SSR'" class="rays"></div>
          <div class="glow"></div>
          <div class="ring"></div>
          <div class="flipper">
            <div class="face back">
              <CardBack />
              <i class="sheen"></i>
              <i class="shade"></i>
            </div>
            <div class="face front">
              <CardFace :card="p.card" :level="p.level" />
              <i v-if="RANK[p.rarity] >= 2" class="foil"></i>
              <div v-if="p.outcome === 'refund'" class="maxed"><b><Hanko ch="極" :tilt="0" /></b></div>
              <i class="sheen"></i>
              <i class="shade"></i>
            </div>
            <i class="edge l"></i>
            <i class="edge r"></i>
          </div>
          <div v-if="p.outcome === 'new'" class="badge new" title="New"><Hanko ch="新" :tilt="0" /></div>
          <div v-if="big && p.outcome === 'level'" class="tag"><small>Lv</small> {{ p.level }}</div>
          <div v-if="p.outcome === 'refund'" class="coinrise">+{{ p.refund }} {{ CURRENCY.icon }}</div>
        </div>
        <div ref="fx" class="fx"></div>
      </div>

      <div v-if="!big" class="labels">
        <div v-for="(p, i) in pulls" :key="i" ref="labelEls" class="label">
          <b class="rname" :style="{ color: RARITY_INFO[p.rarity].css }">{{ RARITY_INFO[p.rarity].label }}</b>
          <span v-if="p.outcome === 'new'" class="out">New card!</span>
          <span v-else-if="p.outcome === 'level'" class="out lvl">
            Level up
            <svg class="chev" viewBox="0 0 44 14" :aria-label="`Level ${p.level}`">
              <path v-for="n in MAX_CARD_LEVEL" :key="n" :class="{ on: n < p.level, up: n === p.level }" :d="`M${n * 13 - 9} 11l5-6 5 6`" />
            </svg>
            <span class="lv">Lv {{ p.level }}</span>
          </span>
          <span v-else class="out coin">Max level: +{{ p.refund }} {{ CURRENCY.name }}</span>
          <span v-if="p.pity" class="pity">Pity guarantee</span>
        </div>
      </div>

      <div class="foot" @click.stop>
        <template v-if="phase === 'done'">
          <button class="btn back" @click="close">Continue</button>
          <button class="btn again" :disabled="!canAgain" @click="again(1, $event)">Open another {{ CURRENCY.icon }} {{ pack.cost }}</button>
          <button class="btn again" :disabled="!canTen" @click="again(10, $event)">Open ×10 {{ CURRENCY.icon }} {{ pack.cost * 10 }}</button>
        </template>
        <button v-else class="btn skip" @click="revealAll">Reveal all <Keys for="Action:skip" :max="1" /></button>
      </div>
      <p class="muted small" :style="{ visibility: phase === 'done' ? 'visible' : 'hidden' }">
        <template v-if="big && bestName">
          Best: <b :style="{ color: RARITY_INFO[best].css }">{{ bestName }}</b> ({{ RARITY_INFO[best].label }}).
        </template>
        {{ newNames.length ? `New cards join your deck while it has room: ${newNames.join(", ")}.` : "No new cards this time." }}
        <span class="coins">{{ CURRENCY.icon }} {{ wallet.coins }}</span>
      </p>
    </div>
    <div ref="flashEl" class="flash"></div>
  </div>
</template>

<style scoped>
.opening {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  cursor: pointer;
  background:
    radial-gradient(ellipse at 50% 55%, rgba(122, 20, 32, 0.35), transparent 60%),
    radial-gradient(ellipse at center, rgba(16, 20, 42, 0.96), rgba(4, 4, 12, 0.98));
}
.opening.done {
  cursor: default;
}
.dimmer {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(60, 40, 0, 0.3), #000 75%);
  pointer-events: none;
  opacity: 0;
}
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  gap: 8px;
}
header {
  position: relative;
  z-index: 6;
  text-align: center;
}
h2 {
  margin: 0;
  font-size: 2rem;
}
.times {
  color: var(--gold, #e8c15a);
}
.hint {
  margin: 4px 0 0;
  min-height: 1.4em;
  color: #fff;
  font-weight: 700;
}
.table {
  position: relative;
  margin: 18px 0 6px;
  will-change: transform;
}
.big .table {
  margin: 10px 0 4px;
}

/* ---------- the sealed bundle ---------- */
.bundle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 170px;
  height: 250px;
  margin: -125px 0 0 -85px;
  z-index: 6;
  will-change: transform;
}
.body {
  position: absolute;
  inset: 0;
}
.under,
.top {
  position: absolute;
  inset: 0;
}
.u1 {
  transform: translate(5px, 5px) rotate(3deg);
  filter: brightness(0.6);
}
.u2 {
  transform: translate(-4px, 3px) rotate(-2.5deg);
  filter: brightness(0.75);
}
.leak {
  /* Light leaking out round the bundle as it strains. */
  position: absolute;
  inset: -40px -46px;
  background: radial-gradient(closest-side, var(--sc) 70%, transparent);
  opacity: 0;
}
.wrap {
  /* The paper band round the bundle, torn in two at the burst. */
  position: absolute;
  top: 100px;
  height: 50px;
  width: 92px;
  background:
    repeating-linear-gradient(90deg, rgba(150, 128, 90, 0.1) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, #fbf6ea, #f4ecd8 55%, #e3d5b4);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.7),
    inset 0 -2px 0 rgba(120, 90, 50, 0.4);
  display: flex;
  align-items: center;
  font: 900 17px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #1b1512;
  will-change: transform, opacity;
}
.wrap.left {
  left: -8px;
  justify-content: flex-start;
  padding-left: 14px;
  clip-path: polygon(0 0, 100% 0, 92% 20%, 100% 38%, 90% 60%, 100% 78%, 94% 100%, 0 100%);
}
.wrap.right {
  right: -8px;
  justify-content: flex-end;
  padding-right: 16px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 6% 100%, 0 78%, 10% 60%, 0 38%, 8% 20%);
}
.seal,
.sealglow {
  position: absolute;
  left: 50%;
  top: 125px;
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  border-radius: 50%;
}
.seal {
  /* The round vermilion seal where the band closes. */
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 40% 35%, #f0604a, #b01e1a 60%, #6a0c0a);
  box-shadow:
    inset 0 0 0 3px rgba(255, 190, 160, 0.35),
    inset 0 0 0 6px #a31a16,
    inset 0 0 0 7px rgba(255, 210, 180, 0.5);
  font: 900 26px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #ffe4d4;
  will-change: transform, opacity;
}
.sealglow {
  /* The seal's glow, the best card's colour (apart from the halves: their clip-path would cut it). */
  box-shadow:
    0 0 16px 4px #fff,
    0 0 60px 24px var(--sc);
  opacity: 0;
}
.seal.left {
  clip-path: polygon(0 0, 50% 0, 44% 30%, 56% 52%, 46% 74%, 52% 100%, 0 100%);
}
.seal.right {
  clip-path: polygon(50% 0, 100% 0, 100% 100%, 52% 100%, 46% 74%, 56% 52%, 44% 30%);
}
.bestSSR .seal {
  background: radial-gradient(circle at 40% 35%, #fff4c0, #f0604a 40%, #b01e1a 70%, #6a0c0a);
}
.bloom {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 80px;
  height: 80px;
  margin: -40px 0 0 -40px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0 20%, var(--sc) 45%, transparent 70%);
  opacity: 0;
  z-index: 7;
  pointer-events: none;
  will-change: transform, opacity;
}

/* ---------- the cards ---------- */
.slot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 170px;
  height: 250px;
  margin: -125px 0 0 -85px;
  visibility: hidden;
  will-change: transform;
}
.flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}
.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 4px;
  overflow: hidden;
}
.face.back {
  transform: translateZ(2px);
}
.face.front {
  transform: rotateY(180deg) translateZ(2px);
}
.edge {
  /* The card's thickness, seen as it turns edge-on. */
  position: absolute;
  top: 1px;
  bottom: 1px;
  width: 4px;
  background: linear-gradient(180deg, #f3dfae, #a07a3a 50%, #4a3210);
  transform: rotateY(90deg);
}
.edge.l {
  left: -2px;
}
.edge.r {
  left: 168px;
}
.sheen {
  /* A specular band sliding across as the card turns. */
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.1) 42%, rgba(255, 255, 255, 0.6) 50%, rgba(255, 255, 255, 0.1) 58%, transparent 70%);
  opacity: 0;
  pointer-events: none;
}
.shade {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
}
.foil {
  /* A slow shimmer over SR and SSR faces. */
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(115deg, transparent 20%, rgba(255, 220, 140, 0.45) 40%, rgba(255, 255, 255, 0.6) 50%, rgba(255, 200, 120, 0.4) 60%, transparent 80%);
  mix-blend-mode: overlay;
  opacity: 0;
  pointer-events: none;
}
.rSSR .foil {
  background: linear-gradient(115deg, transparent 15%, rgba(255, 106, 138, 0.5) 32%, rgba(255, 210, 74, 0.55) 42%, rgba(122, 255, 176, 0.5) 52%, rgba(106, 208, 255, 0.5) 62%, rgba(197, 138, 255, 0.5) 72%, transparent 85%);
}
.shadow {
  /* A soft shadow drawn as a gradient (no blur filter: thirty of them must stay cheap). */
  position: absolute;
  inset: -6px -10px -16px;
  background: radial-gradient(closest-side, rgba(0, 0, 0, 0.85) 62%, transparent);
  opacity: 0;
}
.glow {
  /* The rim metal's light: leaking while it charges, bursting as it lands (a gradient, no blur filter). */
  position: absolute;
  inset: -34px -40px;
  background: radial-gradient(closest-side, var(--mc) 68%, transparent);
  opacity: 0;
}
.rSSR .glow {
  background: radial-gradient(closest-side, #fff6c8 55%, #ffd24a 68%, rgba(255, 106, 138, 0.6) 82%, transparent);
}
.maxed {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 8, 16, 0.45);
  opacity: 0;
}
/* A card already at the top level is stamped 極 across its face; the label under it says what it paid. */
.maxed b {
  width: 76px;
  height: 76px;
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.5));
  opacity: 0;
}
.rays {
  /* The SSR's light rays: fading in with its charge, turning slowly after. */
  position: absolute;
  left: 50%;
  top: 50%;
  width: 620px;
  height: 620px;
  margin: -310px 0 0 -310px;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255, 236, 160, 0.55) 0 5deg, transparent 5deg 18deg);
  mask: radial-gradient(circle, #000 12%, transparent 68%);
  opacity: 0;
  pointer-events: none;
}
.ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 180px;
  height: 180px;
  margin: -90px 0 0 -90px;
  border-radius: 50%;
  border: 4px solid var(--mc);
  box-shadow:
    0 0 20px var(--mc),
    inset 0 0 20px var(--mc);
  opacity: 0;
  pointer-events: none;
}
.rN .ring {
  border-width: 2px;
}
.badge.new {
  /* A new card is stamped 新 on its corner, the seal of every other "new" in the game (Hanko.vue). */
  position: absolute;
  top: calc(-14px * var(--bs));
  right: calc(-14px * var(--bs));
  z-index: 4;
  width: calc(44px * var(--bs));
  height: calc(44px * var(--bs));
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.55));
  opacity: 0;
}
.badge.new :deep(.hanko),
.maxed b :deep(.hanko) {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 1;
}
.tag {
  /* A ×10 grid's level-up note: a lacquer tab on the card's foot, the new level in gold. */
  position: absolute;
  left: 50%;
  bottom: -14px;
  margin-left: -60px;
  width: 120px;
  text-align: center;
  font: 800 30px/1.25 var(--display);
  color: #e8c15a;
  background: rgba(23, 17, 14, 0.94);
  border: 2px solid rgba(232, 193, 90, 0.7);
  border-radius: 2px;
  opacity: 0;
}
.tag small {
  font-size: 0.6em;
  color: #d6c48c;
}
.coinrise {
  position: absolute;
  left: 0;
  right: 0;
  top: 40%;
  z-index: 4;
  text-align: center;
  white-space: nowrap;
  font: 900 calc(22px * var(--bs)) / 1 "Segoe UI", system-ui, sans-serif;
  color: var(--gold, #e8c15a);
  text-shadow:
    0 2px 0 #000,
    0 0 3px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  opacity: 0;
}
.fx {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  z-index: 8;
  pointer-events: none;
}

/* ---------- labels and footer ---------- */
.labels {
  display: flex;
  gap: 34px;
}
.label {
  width: 170px;
  min-height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  opacity: 0;
}
.rname {
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}
.out {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}
.out.coin {
  color: var(--gold, #e8c15a);
}
.chev {
  width: 44px;
  height: 14px;
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.chev path {
  stroke: rgba(255, 255, 255, 0.2);
}
/* The level's chevrons in gold leaf, as a card's level is gold everywhere else. */
.chev path.on,
.chev path.up {
  stroke: #e8c15a;
}
.chev path.up {
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
}
.lv {
  font-family: var(--display);
  color: #e8c15a;
}
.pity {
  font-size: 0.75rem;
  color: var(--gold, #e8c15a);
}
.foot {
  min-height: 46px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.btn.skip {
  opacity: 0.75;
}
.small {
  font-size: 0.85rem;
  margin: 0;
  max-width: min(1100px, 94vw);
  text-align: center;
}
.coins {
  margin-left: 10px;
  color: var(--gold, #e8c15a);
  font-weight: 700;
}
.flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, #fff, #fff6d0 50%, rgba(255, 230, 150, 0.6));
  opacity: 0;
  pointer-events: none;
  z-index: 30;
}
</style>

<style>
/* Particles are made at run time (outside the scoped styles). */
.po-p {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  will-change: transform, opacity;
}
.po-paper {
  background: linear-gradient(180deg, #fbf6ea, #e3d5b4);
  clip-path: polygon(0 8%, 30% 0, 100% 12%, 88% 60%, 100% 100%, 20% 92%, 6% 50%);
}
.po-chip {
  background: linear-gradient(160deg, #a01c28, #3a060c);
  clip-path: polygon(0 0, 100% 20%, 70% 100%, 10% 70%);
}
.po-spark {
  background: #fff;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  box-shadow: 0 0 0 20px var(--c, #fff) inset;
  mix-blend-mode: screen;
}
.po-petal {
  background: radial-gradient(ellipse at 50% 30%, #fff0f5, #ffb7cf 60%, #f48fb1);
  border-radius: 70% 0 70% 0;
}
.po-mote {
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border-radius: 50%;
  background: #fffbe0;
  box-shadow: 0 0 8px 3px rgba(255, 230, 150, 0.8);
}
</style>
