// The boss's winds, as the field shows them (the sim: rules.ts "boss:approach", swarm.ts blowAway,
// drops.ts cyclone). At the approach the swarm is blown straight away from Reimu, harmless, and the
// drops round her spiral in over WIND.spiral ticks, turning WIND.spin a tick. The view stages it from
// the run's phase ("warning") and those columns alone, on the action clock, so it holds still under a
// level-up exactly as the sim does:
// - a gale: streaks of wind thrown outward across the whole field, curling the way the cyclone turns;
// - the cyclone: arcs circling round her on the rim of the gems' vortex, at the gems' own spin;
// - the boss's element on the wind (Cirno's ice flakes, Rumia's scraps of dark);
// - fog rolling in from the edges (the Misty Lake's mist, Rumia's darkness), drifting, which is what
//   "swallows the swarm" when the dialogue opens; it lifts as the fight begins.

import { CanvasSource, Container, Graphics, Sprite, Texture, TilingSprite } from "pixi.js";
import { WIND } from "../sim/tuning.ts";

/** One streak of wind, seeded once: where it starts, when, for how long. */
interface Streak {
  a: number;
  r: number;
  delay: number;
  life: number;
  len: number;
  width: number;
  speed: number;
  /** A gale streak flies outward; a cyclone streak circles. */
  gust: boolean;
}

/** The warning's length in ticks (BOSS.warning): the winds are staged over it. */
const WARNING = 150;
/** The gems' vortex starts this wide (WIND.reach) and closes over WIND.spiral ticks. */
const VORTEX = WIND.reach;
/** How the fog stands at its thickest: a stage's mist, or its boss's dark. */
const FOG: Record<string, { color: number; alpha: number }> = {
  lake: { color: 0xd8e6ef, alpha: 0.5 },
  forest: { color: 0x07040d, alpha: 0.8 },
};

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function mix(a: number, b: number, k: number): number {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k) << sh;
  return ch(16) | ch(8) | ch(0);
}

function canvasTexture(size: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  paint(c.getContext("2d")!);
  return new Texture({ source: new CanvasSource({ resource: c }) });
}

/** A vignette: clear in the middle, full at the edges, white (tinted at use). */
function vignette(inner: number, stops: [number, number][]): Texture {
  return canvasTexture(256, (g) => {
    const grad = g.createRadialGradient(128, 128, inner, 128, 128, 182);
    for (const [at, a] of stops) grad.addColorStop(at, `rgba(255,255,255,${a})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  });
}

/** Soft clouds that tile: white puffs of every size, wrapped at the edges. */
function clouds(): Texture {
  const rnd = seeded(77);
  return canvasTexture(256, (g) => {
    for (let i = 0; i < 46; i++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const r = 24 + rnd() * 70;
      const a = 0.12 + rnd() * 0.26;
      for (const dx of [-256, 0, 256])
        for (const dy of [-256, 0, 256]) {
          const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
          grad.addColorStop(0, `rgba(255,255,255,${a})`);
          grad.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = grad;
          g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
        }
    }
  });
}

export class Winds {
  /** Over the enemies and drops, under Reimu: the streaks and the element on them (world space). */
  readonly g = new Graphics();
  /** The fog, over the field in screen space: an even haze at the edges and clouds drifting through it. */
  readonly fog = new Container();
  private haze: Sprite;
  private cloud: TilingSprite;
  private cloudMask: Sprite;
  /** The action tick the warning began (-1: none this run). */
  private from = -1;
  /** 0..1: how thick the fog stands; it lifts on its own once the fight is on. */
  private fogK = 0;
  /** Seconds of drift. */
  private drift = 0;
  private streaks: Streak[] = [];
  /** Flakes riding the wind: angle, radius, spin, size, delay. */
  private flakes: { a: number; r: number; s: number; size: number; delay: number }[] = [];

  constructor() {
    this.haze = new Sprite(vignette(60, [[0, 0], [0.5, 0.15], [0.85, 0.7], [1, 1]]));
    this.cloudMask = new Sprite(vignette(20, [[0, 0], [0.4, 0.35], [0.75, 1], [1, 1]]));
    this.cloud = new TilingSprite({ texture: clouds(), width: 100, height: 100 });
    this.cloud.mask = this.cloudMask;
    this.fog.addChild(this.haze, this.cloud, this.cloudMask);
    this.fog.visible = false;
    const rnd = seeded(2027);
    for (let i = 0; i < 96; i++) {
      const gust = i < 60;
      this.streaks.push({
        a: rnd() * Math.PI * 2,
        r: gust ? 30 + rnd() * rnd() * 560 : 0.25 + rnd() * 0.85,
        delay: gust ? rnd() * rnd() * 46 : 14 + rnd() * 96,
        life: gust ? 22 + rnd() * 18 : 30 + rnd() * 26,
        len: gust ? 90 + rnd() * 150 : 0.5 + rnd() * 0.7,
        width: gust ? 1.3 + rnd() * 1.9 : 1.1 + rnd() * 1.4,
        speed: 13 + rnd() * 11,
        gust,
      });
    }
    for (let i = 0; i < 54; i++) this.flakes.push({ a: rnd() * Math.PI * 2, r: 40 + rnd() * 420, s: rnd() * 2 - 1, size: 1.7 + rnd() * 2.3, delay: rnd() * 70 });
  }

  /**
   * One frame. `phase` is the run's; `t` the action tick; `blownAt` the tick the wind caught the
   * swarm (a blown enemy's `until`, -1 if none is left), for a run loaded mid-warning.
   */
  draw(phase: string, t: number, blownAt: number, px: number, py: number, stage: string, bossColor: number, W: number, H: number, dt: number): void {
    const g = this.g;
    g.clear();
    if (phase === "swarm") this.from = -1;
    if (phase === "warning" && this.from < 0) this.from = blownAt >= 0 ? blownAt : t;
    const tau = this.from >= 0 && phase === "warning" ? t - this.from : -1;

    // The fog: rolls in over the warning, stands through the dialogue, lifts once the fight is on.
    const fogDef = FOG[stage] ?? FOG.lake!;
    if (tau >= 0) this.fogK = Math.min(1, Math.max(this.fogK, Math.sqrt(tau / WARNING)));
    else if (phase === "dialogue" && this.from >= 0) this.fogK = 1;
    else this.fogK = Math.max(0, this.fogK - dt * 0.8);
    this.fog.visible = this.fogK > 0.005;
    if (this.fog.visible) {
      const k = this.fogK * this.fogK * (3 - 2 * this.fogK);
      this.drift += dt;
      for (const s of [this.haze, this.cloudMask]) {
        // A little larger than the screen, so the full edge stands just outside it.
        s.position.set(-W * 0.06, -H * 0.08);
        s.width = W * 1.12;
        s.height = H * 1.16;
      }
      this.cloud.width = W;
      this.cloud.height = H;
      this.cloud.tileScale.set(2.6);
      // The mist drifts across, turning slowly the cyclone's way.
      this.cloud.tilePosition.set(this.drift * 22, -this.drift * 7);
      this.haze.tint = fogDef.color;
      this.cloud.tint = fogDef.color;
      this.haze.alpha = fogDef.alpha * 0.7;
      this.cloud.alpha = Math.min(1, fogDef.alpha * 1.6);
      this.fog.alpha = k;
    }
    if (tau < 0) return;

    const color = mix(0xffffff, bossColor === 0x2b2238 ? 0xb9a6ff : bossColor, 0.3);
    // The vortex's rim: the furthest gems close in at a steady pace, arriving together at WIND.spiral.
    const rim = VORTEX * Math.max(0.12, 1 - tau / WIND.spiral);
    for (const s of this.streaks) {
      const age = tau - s.delay;
      const k = age / s.life;
      if (k <= 0 || k >= 1) continue;
      const fade = Math.sin(Math.PI * k);
      if (s.gust) {
        // Thrown outward, fast at first; each curls a little the way the gems turn.
        const r0 = s.r + age * s.speed;
        const a0 = s.a + age * WIND.spin * 0.3;
        this.arc(g, px, py, r0, r0 + s.len, a0, a0 + (s.len / (r0 + 60)) * 0.8, s.width * 1.2, color, 0.62 * fade);
      } else {
        // The cyclone: arcs on and inside the vortex, going round at the gems' own spin.
        const r = rim * s.r + 40;
        const a0 = s.a + tau * WIND.spin;
        this.arc(g, px, py, r, r * 0.97, a0, a0 + s.len, s.width, color, 0.5 * fade * Math.min(1, (WARNING - tau) / 30));
      }
    }
    // The element on the wind: small six-armed flakes whirled out and round.
    const dark = bossColor === 0x2b2238;
    const flakeColor = dark ? 0x4a3d6e : mix(0xffffff, bossColor, 0.35);
    for (const f of this.flakes) {
      const age = tau - f.delay;
      const k = age / 80;
      if (k <= 0 || k >= 1) continue;
      const r = f.r + age * 5.5;
      const a = f.a + age * WIND.spin * 0.6;
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      const alpha = Math.sin(Math.PI * k) * 0.9;
      const rot = f.s * tau * 0.08;
      const sz = f.size;
      for (let j = 0; j < 3; j++) {
        const q = rot + (j * Math.PI) / 3;
        g.moveTo(x - Math.cos(q) * sz, y - Math.sin(q) * sz).lineTo(x + Math.cos(q) * sz, y + Math.sin(q) * sz);
      }
      g.stroke({ width: 1.1, color: flakeColor, alpha });
    }
  }

  /** A tapered streak along a spiral from (r0, a0) to (r1, a1) round (cx, cy). */
  private arc(g: Graphics, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, width: number, color: number, alpha: number): void {
    if (alpha <= 0.01) return;
    const N = 10;
    const pt = (u: number): [number, number] => {
      const r = r0 + (r1 - r0) * u;
      const a = a0 + (a1 - a0) * u;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    // Thin over its whole length, full width in its middle: a stroke that tapers at both ends.
    const run = (u0: number, u1: number, w: number, al: number) => {
      const [x0, y0] = pt(u0);
      g.moveTo(x0, y0);
      for (let i = 1; i <= N; i++) {
        const [x, y] = pt(u0 + ((u1 - u0) * i) / N);
        g.lineTo(x, y);
      }
      g.stroke({ width: w, color, alpha: al, cap: "round" });
    };
    run(0, 1, width * 0.45, alpha * 0.55);
    run(0.25, 0.75, width, alpha);
  }

  /** How a blown enemy tumbles, `tt` ticks after the wind caught it: its turn, and how far it has shrunk away. */
  static tumble(uid: number, tt: number): { rotation: number; scale: number; alpha: number } {
    const dir = uid % 2 ? 1 : -1;
    const k = Math.min(1, tt / 50);
    return { rotation: dir * tt * 0.16, scale: 1 - 0.35 * k, alpha: 1 - 0.6 * k };
  }
}
