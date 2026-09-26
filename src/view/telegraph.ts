// What the field shows a moment before it happens, exactly as the sim will do it.
//
// - Sights: a sniper about to open a salvo stands still for FORMATION.windup ticks and takes aim; the
//   rays of its fan reach out toward Reimu, following her until the salvo's first volley, then stay on
//   the salvo's aim (the `aim` column, which every volley of the salvo fires along) until its last
//   volley has gone, and fade (swarm.ts enemyFire). Only aimed fans have sights: a ring or a spiral
//   aims at nobody.
// - Entries: a formation is announced (formation:incoming) FORMATION.warn ticks before it enters;
//   the stretch of the screen's edge it will come in over is lit from outside, as wide as it is, with an
//   arrow where each lane crosses it (swarm.ts spawnFormation's geometry, relative to Reimu as the camera is).
//   A circle or a ring comes from every side: the whole frame is lit.

import type { Graphics } from "pixi.js";
import { ENEMIES } from "../content/enemies.ts";
import { BULLET_STYLES, STYLE_INDEX } from "../content/patterns.ts";
import { stageDef } from "../content/stages.ts";
import { FORMATION } from "../sim/tuning.ts";
import { PHASE } from "../sim/swarm.ts";

type Col = ArrayLike<number>;

/** The enemy columns a sight reads. */
export interface SightCols {
  count: number;
  x: Col;
  y: Col;
  kind: Col;
  phase: Col;
  fireAt: Col;
  volley: Col;
  aim: Col;
}

const SIGHT = {
  /** Ticks a sight takes to fade after the salvo's last volley. */
  fade: 14,
  /** Past Reimu by this much, and never longer than `max`. */
  reach: 110,
  max: 600,
  dash: 7,
  gap: 6,
};

/** Draws every sniper's sight into `g` (world space). `t` is the action tick. */
export function drawSights(g: Graphics, c: SightCols, t: number, px: number, py: number): void {
  for (let i = 0; i < c.count; i++) {
    if (c.phase[i] !== PHASE.holding) continue;
    const def = ENEMIES[c.kind[i]!]!;
    const list = def.shoots;
    const salvo = def.salvo;
    if (def.move.kind !== "snipe" || !salvo || !list) continue;
    const vol = c.volley[i]!;
    const fa = c.fireAt[i]!;
    const x = c.x[i]!;
    const y = c.y[i]!;
    let dir: number;
    let strength: number;
    let em;
    let tracking = false;
    if (vol % salvo.volleys === 0) {
      if (t >= fa - FORMATION.windup && t < fa) {
        // Winding up: the first volley will aim at wherever she is when it fires.
        em = list[vol % list.length]!;
        dir = Math.atan2(py - y, px - x);
        strength = (t - (fa - FORMATION.windup)) / FORMATION.windup;
        tracking = true;
      } else if (vol > 0 && t - (fa - salvo.rest) < SIGHT.fade) {
        // The salvo has gone: the sight fades where it pointed.
        em = list[(vol - 1) % list.length]!;
        dir = c.aim[i]!;
        strength = 1 - (t - (fa - salvo.rest)) / SIGHT.fade;
      } else continue;
    } else {
      // Mid-salvo: every volley fires along the aim the first one locked.
      em = list[vol % list.length]!;
      dir = c.aim[i]!;
      strength = 1;
    }
    if (em.pattern !== "aimed") continue;
    const p = em.params;
    const color = BULLET_STYLES[STYLE_INDEX[p.style] ?? 0]!.color;
    const d = Math.hypot(px - x, py - y);
    const r0 = def.radius + 5;
    const r1 = Math.min(SIGHT.max, d + SIGHT.reach);
    // Reaching out while it winds up; full length once it fires.
    const grow = tracking ? 1 - (1 - strength) * (1 - strength) : 1;
    const end = r0 + (r1 - r0) * grow;
    const alpha = tracking ? 0.2 + 0.45 * strength : 0.55 * strength;
    // Fired dashes march outward with the bullets; a winding-up sight stands.
    const march = tracking ? 0 : (t * 2.2) % (SIGHT.dash + SIGHT.gap);
    for (let k = 0; k < p.n; k++) {
      const off = p.n === 1 ? 0 : -p.spread / 2 + (p.spread * k) / (p.n - 1);
      const ux = Math.cos(dir + off);
      const uy = Math.sin(dir + off);
      for (let s = r0 + march - SIGHT.dash; s < end; s += SIGHT.dash + SIGHT.gap) {
        const a = Math.max(r0, s);
        const b = Math.min(end, s + SIGHT.dash);
        if (b <= a) continue;
        // Brighter by the sniper, thinning out toward the end.
        const along = 1 - (a - r0) / Math.max(1, r1 - r0);
        g.moveTo(x + ux * a, y + uy * a)
          .lineTo(x + ux * b, y + uy * b)
          .stroke({ width: 1.6, color, alpha: alpha * (0.35 + 0.65 * along), cap: "round" });
      }
    }
  }
}

// ---------- entries ----------

/** A formation on its way: what the announcement said, with the stage script's lane. */
interface Incoming {
  form: string;
  side: string;
  n: number;
  lane: number;
  /** The action tick it was announced and the one it enters on. */
  from: number;
  at: number;
}

/**
 * Where a formation will come in, as the screen's edge shows it: a stretch of the edge lit from outside
 * (screen px along it, `from` to `to`, as wide as the formation), and where along it each of its lanes
 * comes in (none for the whole frame). `a` is how strongly it shows (0..1, pulsing while it waits) and
 * `k` how far through its warning it is (0..1).
 */
export interface EntryGate {
  side: "left" | "right" | "top" | "bottom";
  from: number;
  to: number;
  lanes: number[];
  a: number;
  k: number;
}

const SIDE: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
/** A gate reaches this far past its outermost lanes (screen px). */
const PAD = 26;
/** After it enters, a gate takes this long to go (ticks). */
const AFTER = 10;

export class Entries {
  private list: Incoming[] = [];

  /** A formation:incoming, heard at action tick `now` in stage `stage`. */
  add(ev: { enemy: string; form: string; side: string; n: number; in: number }, now: number, stage: string): void {
    if (ev.form === "midboss") return;
    // The announcement carries no lane: the stage's script has it (its beats are unique by what they bring).
    const beat = stageDef(stage).script.find((b) => b.enemy === ev.enemy && b.form === ev.form && ("side" in b ? b.side : "") === ev.side && ("n" in b ? b.n : 1) === ev.n);
    const lane = beat && "lane" in beat ? (beat.lane ?? 0) : 0;
    this.list.push({ form: ev.form, side: ev.side, n: ev.n, lane, from: now, at: now + ev.in });
  }

  clear(): void {
    this.list = [];
  }

  /** The gates at action tick `t` for a W x H screen centred on Reimu at `zoom`. */
  marks(t: number, W: number, H: number, zoom: number): EntryGate[] {
    this.list = this.list.filter((f) => t < f.at + AFTER && t >= f.from - 1);
    const out: EntryGate[] = [];
    for (const f of this.list) {
      const left = f.at - t;
      // In over a few ticks, a slow double pulse while it waits, out as it enters.
      const age = t - f.from;
      const span = Math.max(1, f.at - f.from);
      const k = Math.min(1, age / span);
      const pulse = 0.8 + 0.2 * Math.cos(k * Math.PI * 4);
      const a = Math.min(1, age / 6) * (left >= 0 ? pulse : Math.max(0, 1 + left / AFTER));
      if (a <= 0.01) continue;
      if (f.form === "circle" || f.form === "ring") {
        // From every side at once: the whole frame is lit.
        for (const side of ["top", "bottom"] as const) out.push({ side, from: 0, to: W, lanes: [], a, k });
        for (const side of ["left", "right"] as const) out.push({ side, from: 0, to: H, lanes: [], a, k });
        continue;
      }
      if (f.form === "posts") {
        // Each sniper comes in from the edge behind its post, on a ray from her.
        const [sx, sy] = SIDE[f.side] ?? [0, -1];
        const mid = Math.atan2(sy, sx);
        for (let i = 0; i < f.n; i++) {
          const ang = mid + (i - (f.n - 1) / 2) * FORMATION.postSpread;
          const ux = Math.cos(ang);
          const uy = Math.sin(ang);
          const r = Math.min(W / 2 / Math.max(1e-6, Math.abs(ux)), H / 2 / Math.max(1e-6, Math.abs(uy)));
          const x = W / 2 + ux * r;
          const y = H / 2 + uy * r;
          const onSide = Math.abs(x - W / 2) >= W / 2 - 0.5;
          const side = onSide ? (ux < 0 ? "left" : "right") : uy < 0 ? "top" : "bottom";
          const at = onSide ? y : x;
          out.push({ side, from: at - PAD, to: at + PAD, lanes: [at], a, k });
        }
        continue;
      }
      const [sx, sy] = SIDE[f.side] ?? [0, -1];
      const side = f.side as EntryGate["side"];
      // Across the edge: q is the formation's "across" (spawnFormation: q = (-h.y, h.x), h = -s).
      const qx = sy;
      const qy = -sx;
      const across: number[] = [];
      if (f.form === "line") for (let i = 0; i < f.n; i++) across.push((i - (f.n - 1) / 2) * FORMATION.lineGap);
      else if (f.form === "vee") for (let j = -Math.ceil((f.n - 1) / 2); j <= Math.ceil((f.n - 1) / 2); j++) across.push(j * FORMATION.veeGap);
      else if (f.form === "rush") across.push(-100, 0, 100);
      else across.push(0);
      const lanes: number[] = [];
      for (const c of across) {
        const o = (f.lane + c) * zoom;
        lanes.push(sx ? H / 2 + qy * o : W / 2 + qx * o);
      }
      // A rush comes in anywhere across its 260 (spawnFormation), not on lanes: its middle stands for it.
      const len = sx ? H : W;
      const lo = f.form === "rush" ? len / 2 - 130 * zoom : Math.min(...lanes);
      const hi = f.form === "rush" ? len / 2 + 130 * zoom : Math.max(...lanes);
      if (hi + PAD < 0 || lo - PAD > len) continue;
      out.push({ side, from: lo - PAD, to: hi + PAD, lanes, a, k });
    }
    return out;
  }
}
