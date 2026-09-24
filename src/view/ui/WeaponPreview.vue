<script setup lang="ts">
// A level-up card's picture of a weapon at the offered level: its projectile
// standing as many times as that level fires it (amulets in their fan, knives
// in their ring, orbs in their circle), in the in-game shapes (atlas.ts shots
// and yin-yang orb, renderer.ts beam and border colours), lightly animated
// (speed ghosts, orbiting orbs, a pulse). The border and the beam: one piece,
// bolder with level.
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { weaponDef, type WeaponDef, type WeaponStats } from "../../content/weapons.ts";
import { prefs } from "../prefs.ts";

const props = defineProps<{ id: string; /** The offered level, 1-based. */ level: number; /** Animating (the live offer); a leaving copy holds its last frame. */ active: boolean }>();

const W = 196;
const H = 90;
const TAU = Math.PI * 2;
const canvas = ref<HTMLCanvasElement | null>(null);

const css = (c: number, a = 1): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

// ---------- the in-game shapes (atlas.ts), centred on the origin ----------

function amulet(g: CanvasRenderingContext2D): void {
  g.fillStyle = "#fff";
  g.fillRect(-8, -5, 16, 10);
  g.strokeStyle = css(0xe0314b);
  g.lineWidth = 2;
  g.strokeRect(-8, -5, 16, 10);
  g.fillStyle = css(0xe0314b);
  g.fillRect(-3, -2, 6, 4);
}
function needle(g: CanvasRenderingContext2D): void {
  g.fillStyle = css(0xffb3c1);
  g.fillRect(-11, -1.5, 22, 3);
  g.fillStyle = "#fff";
  g.fillRect(-11, -0.5, 22, 1);
}
function knife(g: CanvasRenderingContext2D): void {
  const r = 10;
  g.fillStyle = css(0xc0c8e0);
  g.beginPath();
  g.moveTo(-r, -r * 0.18);
  g.lineTo(r * 0.6, -r * 0.18);
  g.lineTo(r, 0);
  g.lineTo(r * 0.6, r * 0.18);
  g.lineTo(-r, r * 0.18);
  g.closePath();
  g.fill();
  g.fillStyle = "#fff";
  g.fillRect(-r, -r * 0.08, r * 1.3, r * 0.16);
}
function yinyang(g: CanvasRenderingContext2D): void {
  const r = 12;
  const red = css(0xe0314b);
  const disc = (x: number, y: number, rr: number, fill: string): void => {
    g.beginPath();
    g.arc(x, y, rr, 0, TAU);
    g.fillStyle = fill;
    g.fill();
  };
  disc(0, 0, r + 2, "rgba(255,255,255,0.35)");
  disc(0, 0, r, "#fff");
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  g.fillStyle = red;
  g.fill();
  disc(0, -r / 2, r / 2, red);
  disc(0, r / 2, r / 2, "#fff");
  disc(0, -r / 2, r / 6, "#fff");
  disc(0, r / 2, r / 6, red);
}
function piece(g: CanvasRenderingContext2D, def: WeaponDef): void {
  if (def.behaviour === "orbit") yinyang(g);
  else if (def.id === "amulet") amulet(g);
  else if (def.id === "needle") needle(g);
  else if (def.id === "knives") knife(g);
  else {
    g.beginPath();
    g.arc(0, 0, 7, 0, TAU);
    g.fillStyle = css(def.color);
    g.fill();
  }
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  if (alpha <= 0.01) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * Where N pieces stand, and which way each points: a fan flying diagonally up
 * the card (amulets, needles), knives pointing out from a ring, orbs around
 * a circle they orbit. Shown big, for the look: not to scale with the game.
 */
function layout(def: WeaponDef, n: number, t: number): { x: number; y: number; a: number }[] {
  const cx = W / 2;
  const cy = H / 2;
  if (def.behaviour === "orbit") {
    // Orbs circle close around the middle, a little apart, within the card's height.
    if (n === 1) return [{ x: cx, y: cy, a: 0 }];
    const r = Math.min(29, Math.max(26, 21 / Math.sin(Math.PI / n)));
    return [...Array(n).keys()].map((i) => {
      const a = t * 2 + (TAU * i) / n;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a };
    });
  }
  if (def.aim === "ring") {
    if (n === 1) return [{ x: cx, y: cy, a: 0 }];
    return [...Array(n).keys()].map((i) => {
      const a = -Math.PI / 2 + (TAU * i) / n;
      return { x: cx + Math.cos(a) * 30, y: cy + Math.sin(a) * 26, a };
    });
  }
  // The fan flies up and to the right, from a point off the card's lower left.
  const R = 130;
  const dir = -Math.PI / 4;
  // Spaced to fit the card at any count.
  const gap = Math.min(def.aim === "facing" ? 20 : 26, 64 / Math.max(1, n - 1)) / R;
  const pts = [...Array(n).keys()].map((i) => {
    const a = dir + (i - (n - 1) / 2) * gap;
    return { x: Math.cos(a) * R, y: Math.sin(a) * R, a };
  });
  // Centred by the pieces' own middle, nudged ahead so the trails behind them balance.
  const mx = pts.reduce((m, p) => m + p.x, 0) / n;
  const my = pts.reduce((m, p) => m + p.y, 0) / n;
  const ahead = 10 * (SIZE[def.id] ?? 1.4);
  return pts.map((p) => ({ x: p.x - mx + cx + Math.cos(dir) * ahead, y: p.y - my + cy + Math.sin(dir) * ahead, a: p.a }));
}

/** How big each weapon's piece is drawn (its in-game shape scaled up). */
const SIZE: Record<string, number> = { amulet: 1.4, needle: 1.8, knives: 1.4, orbs: 1.25 };

function paint(g: CanvasRenderingContext2D, t: number): void {
  const def = weaponDef(props.id);
  const s: WeaponStats = def.levels[props.level - 1] ?? def.levels[0]!;
  g.clearRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;

  if (s.count !== undefined) {
    const n = s.count;
    const orbit = def.behaviour === "orbit";
    const size = SIZE[def.id] ?? 1.4;
    const draw = (x: number, y: number, a: number, alpha: number): void => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y);
      g.rotate(a);
      g.scale(size, size);
      piece(g, def);
      g.restore();
    };
    layout(def, n, t).forEach((p, i) => {
      if (orbit) {
        draw(p.x, p.y, t * 1.5, 1);
        return;
      }
      // Shots hold still; speed ghosts stream back off each like a rocket's flame.
      const dx = Math.cos(p.a);
      const dy = Math.sin(p.a);
      const reach = 30 * size;
      for (let k = 0; k < 5; k++) {
        const f = (t * 2.2 + k / 5 + i * 0.17) % 1;
        draw(p.x - dx * reach * f, p.y - dy * reach * f, p.a, 0.35 * (1 - f) * (1 - f));
      }
      draw(p.x, p.y, p.a, 1);
    });
    return;
  }

  if (def.behaviour === "aura") {
    // The border: a big ring, bolder at higher levels, a pulse running outward.
    const r = 36;
    const bold = (s.radius ?? 70) / Math.max(...def.levels.map((l) => l.radius ?? 70));
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = css(def.color, 0.08 + 0.1 * bold);
    g.fill();
    g.strokeStyle = css(def.color, 0.9);
    g.lineWidth = 2 + 5 * bold;
    g.stroke();
    const q = (t % 2.4) / 1.2;
    if (q < 1) {
      g.beginPath();
      g.arc(cx, cy, r * (0.2 + 0.8 * q), 0, TAU);
      g.strokeStyle = css(def.color, 0.6 * (1 - q));
      g.lineWidth = 2;
      g.stroke();
    }
    return;
  }

  if (def.behaviour === "beam") {
    // One big beam across the card (renderer.ts bands), thicker at higher levels; a ripple runs along it.
    const w = 22 + 26 * ((s.width ?? 26) / Math.max(...def.levels.map((l) => l.width ?? 26)));
    const x0 = 8;
    const x1 = W - 8;
    const band = (width: number, color: number, alpha: number): void => {
      g.fillStyle = css(color, alpha);
      g.fillRect(x0, cy - width / 2, x1 - x0, width);
    };
    band(w * 1.4, def.color, 0.35);
    band(w, def.color, 0.8);
    band(w * 0.45, 0xffffff, 0.95);
    const q = (t % 2.4) / 1.6;
    if (q < 1) glow(g, x0 + (x1 - x0) * q, cy, w * 0.9 + 6, 0.5);
  }
}

let raf = 0;
let last = 0;
let t = 0;
function frame(ms: number): void {
  const g = canvas.value?.getContext("2d");
  if (!g) return;
  const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
  last = ms;
  t += dt * prefs.animSpeed;
  g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  paint(g, t);
  if (props.active) raf = requestAnimationFrame(frame);
}
function start(): void {
  cancelAnimationFrame(raf);
  last = 0;
  raf = requestAnimationFrame(frame);
}

onMounted(() => {
  const c = canvas.value!;
  c.width = Math.round(W * devicePixelRatio);
  c.height = Math.round(H * devicePixelRatio);
  start();
});
watch(
  () => props.active,
  (on) => {
    if (on) start();
    else cancelAnimationFrame(raf);
  },
);
watch(
  () => [props.id, props.level],
  () => {
    t = 0;
    start();
  },
);
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <canvas ref="canvas" class="wpv" :style="{ width: W + 'px', height: H + 'px' }"></canvas>
</template>

<style scoped>
.wpv {
  display: block;
  align-self: center;
  max-width: 100%;
  margin-bottom: 4px;
}
</style>
