// The swarm: enemies as a packed `columns` store, stepped in bulk. Enemies
// chase the player (so their motion is integrated, not computable), push each
// other apart through the spatial grid, take knockback, and some of them fire
// bullets. Kills are collected in one pass that emits one `enemies:died`
// event with the positions, so drops and effects are rules, not bulk code.

import type { Columns, Ctx } from "gamebones";
import { ENEMIES } from "../content/enemies.ts";
import type { RS0 } from "./run.ts";
import { Grid } from "./spatial.ts";
import { CAP, SWARM } from "./tuning.ts";
import { emitPattern } from "./danmaku.ts";

export type EnemyCols = Columns<"x" | "y" | "hp" | "kind" | "uid" | "hitAt" | "orbAt" | "fireAt" | "kx" | "ky" | "volley">;

/** Scratch grid over the enemies, rebuilt from the store whenever a rule needs it. */
export const enemyGrid = new Grid(SWARM.cell, SWARM.leash + 200, CAP.enemies);

type C = Ctx<RS0>;

export function rebuildGrid(ctx: C): EnemyCols {
  const e = ctx.packed("enemies");
  const { body } = ctx.derived("player");
  enemyGrid.build(e.col("x"), e.col("y"), e.count, body.x, body.y);
  return e;
}

export function spawnEnemy(ctx: C, kind: number, x: number, y: number): void {
  const e = ctx.packed("enemies");
  if (e.count >= e.capacity) return;
  const def = ENEMIES[kind]!;
  const run = ctx.derived("state");
  const uid = run.run.nextUid;
  ctx.mut(run, "run").nextUid = uid + 1;
  const t = ctx.now("action");
  e.add({
    x,
    y,
    hp: def.hp,
    kind,
    uid,
    hitAt: -100,
    orbAt: -100,
    // Shooters wait a random part of their period before the first volley.
    fireAt: def.shoots ? t + 30 + ctx.rng("spawn").int(def.shoots.every) : 0,
    kx: 0,
    ky: 0,
    volley: 0,
  });
}

/** Spawns n enemies at random points of the spawn ring around the player. */
export function spawnAround(ctx: C, kind: number, n: number): void {
  const { body } = ctx.derived("player");
  const r = ctx.rng("spawn");
  for (let i = 0; i < n; i++) {
    const [dx, dy] = unitFromTurn(r.float());
    const d = SWARM.spawnMin + r.float() * (SWARM.spawnMax - SWARM.spawnMin);
    spawnEnemy(ctx, kind, body.x + dx * d, body.y + dy * d);
  }
}

/** A closing ring of n enemies at radius r around the player. */
export function spawnRing(ctx: C, kind: number, n: number, radius: number): void {
  const { body } = ctx.derived("player");
  for (let i = 0; i < n; i++) {
    const [dx, dy] = unitFromTurn(i / n);
    spawnEnemy(ctx, kind, body.x + dx * radius, body.y + dy * radius);
  }
}

/** A clump of n enemies from one random direction. */
export function spawnRush(ctx: C, kind: number, n: number): void {
  const { body } = ctx.derived("player");
  const r = ctx.rng("spawn");
  const [dx, dy] = unitFromTurn(r.float());
  for (let i = 0; i < n; i++) {
    const d = SWARM.spawnMin + r.float() * 120;
    const side = (r.float() - 0.5) * 260;
    spawnEnemy(ctx, kind, body.x + dx * d - dy * side, body.y + dy * d + dx * side);
  }
}

/**
 * A unit vector for a fraction of a full turn, without trigonometry: the
 * swarm only needs directions, and polynomial sin/cos keeps the rule portable
 * and cheap. Accurate to about 1e-3, which is plenty for spawn angles.
 */
export function unitFromTurn(turn: number): [number, number] {
  const a = (turn - Math.floor(turn)) * 4; // quadrant position 0..4
  const q = Math.floor(a);
  const f = a - q; // 0..1 within the quadrant
  // Bhaskara-style quarter wave: s ~ sin(f * pi/2), c ~ cos(f * pi/2).
  const s = (f * (3 - f * f)) / 2;
  const c = ((1 - f) * (3 - (1 - f) * (1 - f))) / 2;
  const len = Math.sqrt(s * s + c * c);
  const x = c / len;
  const y = s / len;
  switch (q) {
    case 0:
      return [x, y];
    case 1:
      return [-y, x];
    case 2:
      return [-x, -y];
    default:
      return [y, -x];
  }
}

/** Chase, knockback, separation, leash. */
export function stepEnemies(ctx: C): void {
  const e = rebuildGrid(ctx);
  const { body } = ctx.derived("player");
  const run = ctx.derived("state").run;
  const x = e.col("x");
  const y = e.col("y");
  const kx = e.col("kx");
  const ky = e.col("ky");
  const kind = e.col("kind");
  const hits = enemyGrid.hits;
  const n = e.count;
  for (let i = 0; i < n; i++) {
    const def = ENEMIES[kind[i]!]!;
    let ddx = body.x - x[i]!;
    let ddy = body.y - y[i]!;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    if (d > SWARM.leash && !run.arena) {
      // Too far behind: reappear ahead of the player, on the far side.
      x[i] = body.x + (ddx / d) * SWARM.spawnMin;
      y[i] = body.y + (ddy / d) * SWARM.spawnMin;
      continue;
    }
    if (d > 0.001) {
      ddx /= d;
      ddy /= d;
    }
    let mx = ddx * def.speed + kx[i]!;
    let my = ddy * def.speed + ky[i]!;
    kx[i] = kx[i]! * 0.72;
    ky[i] = ky[i]! * 0.72;
    // Separation: push away from the first few overlapping neighbours.
    const r = def.radius;
    const found = enemyGrid.query(x[i]!, y[i]!, r * 2);
    let pushed = 0;
    for (let k = 0; k < found && pushed < 10; k++) {
      const j = hits[k]!;
      if (j === i) continue;
      const ox = x[i]! - x[j]!;
      const oy = y[i]! - y[j]!;
      const rr = r + ENEMIES[kind[j]!]!.radius;
      const d2 = ox * ox + oy * oy;
      if (d2 >= rr * rr) continue;
      pushed++;
      if (d2 < 1e-6) {
        // Exactly on top of each other: nudge by row order so the result is deterministic.
        mx += i < j ? 0.5 : -0.5;
        continue;
      }
      const dd = Math.sqrt(d2);
      const push = ((rr - dd) / dd) * SWARM.separation;
      mx += ox * push;
      my += oy * push;
    }
    x[i] = x[i]! + mx;
    y[i] = y[i]! + my;
  }
}

/** Damage to one enemy row; knockback away from (sx, sy). */
export function hurtEnemy(e: EnemyCols, i: number, dmg: number, sx: number, sy: number, knock: number, t: number): void {
  const hp = e.col("hp");
  hp[i] = hp[i]! - dmg;
  e.col("hitAt")[i] = t;
  if (knock > 0) {
    const def = ENEMIES[e.col("kind")[i]!]!;
    const k = knock * (1 - (def.heavy ?? 0)) * 0.3;
    let ddx = e.col("x")[i]! - sx;
    let ddy = e.col("y")[i]! - sy;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    if (d > 0.001) {
      ddx /= d;
      ddy /= d;
      e.col("kx")[i] = e.col("kx")[i]! + ddx * k;
      e.col("ky")[i] = e.col("ky")[i]! + ddy * k;
    }
  }
}

/** Removes dead rows (hp <= 0) and emits one `enemies:died` with where they fell. */
export function collectDead(ctx: C): number {
  const e = ctx.packed("enemies");
  const hp = e.col("hp");
  const xs: number[] = [];
  const ys: number[] = [];
  const kinds: number[] = [];
  // Descending, so swap-remove only moves rows already visited.
  for (let i = e.count - 1; i >= 0; i--) {
    if (hp[i]! > 0) continue;
    xs.push(round1(e.col("x")[i]!));
    ys.push(round1(e.col("y")[i]!));
    kinds.push(e.col("kind")[i]!);
    e.remove(i);
  }
  if (xs.length) {
    ctx.emit("enemies:died", { xs, ys, kinds });
    rebuildGrid(ctx);
  }
  return xs.length;
}

/** Highest contact damage among enemies touching the player, 0 if none. */
export function contactDamage(ctx: C): number {
  const e = ctx.packed("enemies");
  const { body } = ctx.derived("player");
  const x = e.col("x");
  const y = e.col("y");
  const kind = e.col("kind");
  const found = enemyGrid.query(body.x, body.y, 40);
  let dmg = 0;
  for (let k = 0; k < found; k++) {
    const i = enemyGrid.hits[k]!;
    const def = ENEMIES[kind[i]!]!;
    const ddx = x[i]! - body.x;
    const ddy = y[i]! - body.y;
    const rr = def.radius + 11;
    if (ddx * ddx + ddy * ddy < rr * rr && def.dmg > dmg) dmg = def.dmg;
  }
  return dmg;
}

/** Shooters near the player fire their emitter when due. */
export function enemyFire(ctx: C): void {
  const e = ctx.packed("enemies");
  const t = ctx.now("action");
  const { body } = ctx.derived("player");
  const kind = e.col("kind");
  const fireAt = e.col("fireAt");
  const volley = e.col("volley");
  const x = e.col("x");
  const y = e.col("y");
  for (let i = 0; i < e.count; i++) {
    const def = ENEMIES[kind[i]!]!;
    if (!def.shoots || fireAt[i]! > t) continue;
    fireAt[i] = t + def.shoots.every;
    const ddx = x[i]! - body.x;
    const ddy = y[i]! - body.y;
    if (ddx * ddx + ddy * ddy > SWARM.shootRange * SWARM.shootRange) continue;
    emitPattern(ctx, def.shoots, x[i]!, y[i]!, volley[i]!);
    volley[i] = volley[i]! + 1;
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
