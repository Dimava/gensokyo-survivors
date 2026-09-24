// Danmaku: pattern emitters (the code half of content/patterns.ts) and the
// per-tick check of bullets against the player.
//
// Bullets are computable (bullets.ts). The check is "only near the player"
// by conservative advancement: a bullet at distance d can reach the graze
// ring no sooner than (d - reach) / (its max speed + the player's max speed)
// ticks from now, so its `check` column is set to that tick and the bullet is
// skipped (one comparison) until then. Far bullets cost nothing; bullets
// hugging the player are checked every tick.

import type { Ctx } from "gamebones";
import { BULLET_STYLES, styleIndex, type EmitterDef } from "../content/patterns.ts";
import type { RS0 } from "./run.ts";
import { BULLET_CULL, PLAYER, SLOW_BULLET } from "./tuning.ts";

type C = Ctx<RS0>;
const TAU = 6.283185307179586;
const pos = { x: 0, y: 0 };

/**
 * Fires one volley of an emitter from (ox, oy); `volley` counts volleys so far
 * (spins and spirals use it). Given a `life`, slow bullets fade out after that
 * many ticks: the view follows the player, so a slow bullet would otherwise
 * drift about the screen for ages. Fast ones leave the view on their own.
 */
export function emitPattern(ctx: C, em: EmitterDef, ox: number, oy: number, volley: number, life = 0, aim?: number): void {
  const b = ctx.packed("bullets");
  const t0 = ctx.now("danmaku");
  const { body } = ctx.derived("player");
  // Aimed patterns aim at the player, or along `aim` when the shooter locked one (a salvo).
  const aimAt = (): number => aim ?? Math.atan2(body.y - oy, body.x - ox);
  const add = (a: number, speed: number, style: string, accel?: number, vEnd?: number): void => {
    const slow = Math.max(speed, vEnd ?? speed) < SLOW_BULLET;
    b.add({ x: ox, y: oy, t0, dx: Math.cos(a), dy: Math.sin(a), speed, accel, vEnd, style: styleIndex(style), life: slow ? life : 0 });
  };
  switch (em.pattern) {
    case "ring": {
      const p = em.params;
      const base = (p.aim ? aimAt() : 0) + (p.spin ?? 0) * volley;
      for (let k = 0; k < p.n; k++) add(base + (TAU * k) / p.n, p.speed, p.style, p.accel, p.vEnd);
      return;
    }
    case "aimed": {
      const p = em.params;
      const base = aimAt();
      for (let k = 0; k < p.n; k++) {
        const off = p.n === 1 ? 0 : -p.spread / 2 + (p.spread * k) / (p.n - 1);
        add(base + off, p.speed, p.style, p.accel, p.vEnd);
      }
      return;
    }
    case "spiral": {
      const p = em.params;
      for (let k = 0; k < p.arms; k++) add(p.step * volley + (TAU * k) / p.arms, p.speed, p.style, p.accel, p.vEnd);
      return;
    }
    case "burst": {
      const p = em.params;
      const r = ctx.rng("boss");
      for (let k = 0; k < p.n; k++) add(r.float() * TAU, p.speedMin + r.float() * (p.speedMax - p.speedMin), p.style);
      return;
    }
    case "rain": {
      const p = em.params;
      const r = ctx.rng("boss");
      const run = ctx.derived("state").run;
      const cx = run.arena ? run.ax : body.x;
      const cy = run.arena ? run.ay : body.y;
      const drift = p.drift ?? 0;
      const len = Math.sqrt(drift * drift + 1);
      for (let k = 0; k < p.n; k++) {
        b.add({
          x: cx + (r.float() * 2 - 1) * p.width,
          y: cy - p.height,
          t0,
          dx: drift / len,
          dy: 1 / len,
          speed: p.speedMin + r.float() * (p.speedMax - p.speedMin),
          style: styleIndex(p.style),
          life,
        });
      }
      return;
    }
    case "freeze": {
      const p = em.params;
      const r = ctx.rng("boss");
      for (let k = 0; k < p.n; k++) {
        const a = r.float() * TAU;
        const a2 = r.float() * TAU;
        const v0 = p.speedMin + r.float() * (p.speedMax - p.speedMin);
        b.add({
          x: ox,
          y: oy,
          t0,
          dx: Math.cos(a),
          dy: Math.sin(a),
          speed: v0,
          accel: -v0 / p.stopAt,
          vEnd: 0,
          turnAt: p.turnAt,
          dx2: Math.cos(a2),
          dy2: Math.sin(a2),
          v2: p.v2,
          style: styleIndex(p.style),
          style2: styleIndex(p.frozenStyle ?? p.style),
          life,
        });
      }
      return;
    }
  }
}

export interface DanmakuResult {
  /** A bullet touched the hitbox (while vulnerable). */
  hit: boolean;
  grazes: number;
  /** Rows examined this tick (the broadphase's work). */
  checked: number;
}

/** Checks due bullets against the player; culls far and expired ones. Grazes flag the bullet so each grazes once. */
export function stepBullets(ctx: C, playerSpeed: number): DanmakuResult {
  const b = ctx.packed("bullets");
  const t = ctx.now("danmaku");
  const { body, life } = ctx.derived("player");
  const vulnerable = ctx.now("action") >= life.invulnUntil;
  const check = b.col("check");
  const grazed = b.col("grazed");
  const style = b.col("style");
  const grazeR = PLAYER.graze;
  let hit = false;
  let grazes = 0;
  let checked = 0;
  for (let i = b.count - 1; i >= 0; i--) {
    if (check[i]! > t) continue;
    if (!b.pos(i, t, pos)) {
      if (t >= b.endsAt(i)) b.remove(i);
      continue;
    }
    checked++;
    const ddx = pos.x - body.x;
    const ddy = pos.y - body.y;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    if (d > BULLET_CULL) {
      b.remove(i);
      continue;
    }
    const br = BULLET_STYLES[style[i]!]!.radius;
    if (d < PLAYER.hitbox + br && vulnerable && !hit) {
      hit = true;
      b.remove(i);
      continue;
    }
    if (d < grazeR + br) {
      if (!grazed[i]) {
        grazed[i] = 1;
        grazes++;
      }
      check[i] = t + 1;
      continue;
    }
    const gap = d - grazeR - br;
    const closing = b.maxSpeed(i, t) + playerSpeed;
    check[i] = Math.min(t + Math.max(1, Math.floor(gap / Math.max(closing, 0.01))), b.endsAt(i));
  }
  return { hit, grazes, checked };
}

/** Removes bullets within radius of (x, y); returns the positions of the removed ones (for gems). */
export function eraseBullets(ctx: C, x: number, y: number, radius: number): { xs: number[]; ys: number[] } {
  const b = ctx.packed("bullets");
  const t = ctx.now("danmaku");
  const xs: number[] = [];
  const ys: number[] = [];
  const r2 = radius * radius;
  for (let i = b.count - 1; i >= 0; i--) {
    if (!b.pos(i, t, pos)) {
      if (radius >= 1e6) b.remove(i);
      continue;
    }
    const ddx = pos.x - x;
    const ddy = pos.y - y;
    if (ddx * ddx + ddy * ddy > r2) continue;
    xs.push(pos.x);
    ys.push(pos.y);
    b.remove(i);
  }
  return { xs, ys };
}
