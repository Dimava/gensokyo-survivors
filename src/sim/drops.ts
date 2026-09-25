// Pickups (experience gems, donation coins, hearts) as a packed store with a
// magnet radius. Resting items are checked conservatively like bullets: an
// item at distance d cannot enter the magnet radius for (d - R) / (player max
// speed) ticks, so most of a field of gems is skipped every tick. Pulled items
// fly to the player with growing speed.

import type { Ctx } from "gamebones";
import type { RS0 } from "./run.ts";
import { PICKUP } from "./tuning.ts";

export const DROP = { xp: 0, coin: 1, heart: 2 } as const;
export const HEART_HEAL = 25;

type C = Ctx<RS0>;

export function addDrop(ctx: C, kind: number, x: number, y: number, value: number): void {
  const d = ctx.packed("drops");
  if (kind === DROP.xp && d.count >= PICKUP.softCap) {
    // Too many gems on the field: fold the value into the oldest gem instead (it grows).
    d.col("value")[0] = d.col("value")[0]! + value;
    return;
  }
  if (d.count >= d.capacity) return;
  d.add({ x, y, kind, value, pulled: 0, check: 0, spd: 0, born: ctx.now("action") });
}

export interface Collected {
  xp: number;
  coins: number;
  hearts: number;
  n: number;
}

export function stepDrops(ctx: C, magnetScale: number, playerSpeed: number): Collected {
  const d = ctx.packed("drops");
  const t = ctx.now("action");
  const { body } = ctx.derived("player");
  const x = d.col("x");
  const y = d.col("y");
  const kind = d.col("kind");
  const value = d.col("value");
  const pulled = d.col("pulled");
  const check = d.col("check");
  const spd = d.col("spd");
  const born = d.col("born");
  const R = PICKUP.magnet * magnetScale;
  const out: Collected = { xp: 0, coins: 0, hearts: 0, n: 0 };
  for (let i = d.count - 1; i >= 0; i--) {
    if (!pulled[i] && check[i]! > t) continue;
    const ddx = body.x - x[i]!;
    const ddy = body.y - y[i]!;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (pulled[i]) {
      const s = Math.min(PICKUP.pullMax, spd[i]! + PICKUP.pullAccel);
      spd[i] = s;
      if (dist <= PICKUP.collect + s) {
        if (kind[i] === DROP.xp) out.xp += value[i]!;
        else if (kind[i] === DROP.coin) out.coins += value[i]!;
        else out.hearts += 1;
        out.n++;
        d.remove(i);
        continue;
      }
      x[i] = x[i]! + (ddx / dist) * s;
      y[i] = y[i]! + (ddy / dist) * s;
      continue;
    }
    if (dist <= R || (kind[i] === DROP.xp && t - born[i]! >= PICKUP.drift)) {
      pulled[i] = 1;
      spd[i] = PICKUP.pullSpeed;
      continue;
    }
    check[i] = t + Math.max(1, Math.floor((dist - R) / Math.max(playerSpeed, 0.01)));
    if (kind[i] === DROP.xp) check[i] = Math.min(check[i]!, born[i]! + PICKUP.drift);
  }
  return out;
}

export function pullAll(ctx: C): void {
  const d = ctx.packed("drops");
  const pulled = d.col("pulled");
  const spd = d.col("spd");
  for (let i = 0; i < d.count; i++) {
    if (!pulled[i]) {
      pulled[i] = 1;
      spd[i] = PICKUP.pullSpeed;
    }
  }
}
