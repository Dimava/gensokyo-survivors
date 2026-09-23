// Weapon behaviours (the code half of content/weapons.ts) and the hit tests
// shared by weapons and cards: player shots are computable too (straight
// lines from their spawn parameters), checked against the spatial grid.

import { atan2, cos, sin, type Ctx, type EntityOf } from "gamebones";
import { ENEMIES } from "../content/enemies.ts";
import { WEAPONS, WEAPON_INDEX, weaponDef, type WeaponStats } from "../content/weapons.ts";
import { bossDef } from "../content/bosses.ts";
import type { RS0 } from "./run.ts";
import { enemyGrid, hurtEnemy, rebuildGrid } from "./swarm.ts";
import { bossPos, bossVulnerable } from "./boss.ts";

type C = Ctx<RS0>;
const TAU = 6.283185307179586;
const MAX_ENEMY_R = Math.max(...ENEMIES.map((e) => e.radius));
const bp = { x: 0, y: 0 };

export function weaponStats(id: string, level: number): WeaponStats {
  const def = weaponDef(id);
  return def.levels[Math.min(level, def.levels.length) - 1]!;
}

/** Starts volleys whose cooldown is over (computable cooldown: only `readyAt` is stored). */
export function fireWeapons(ctx: C): void {
  const t = ctx.now("action");
  const stats = ctx.derived("stats");
  for (const w of ctx.derived("weapons")) {
    if (t < w.weapon.readyAt) continue;
    const s = weaponStats(w.weapon.id, w.weapon.level);
    ctx.mut(w, "weapon").readyAt = t + Math.max(6, Math.floor(s.cooldown * stats.cooldown));
    ctx.emit("weapon:fire", { weapon: w.id, dmg: s.dmg });
  }
}

/** The behaviour of one volley, after modify rules settled its damage. */
export function applyVolley(ctx: C, w: EntityOf<RS0> & { weapon: { id: string; level: number } }, dmg: number): void {
  const def = weaponDef(w.weapon.id);
  const s = weaponStats(w.weapon.id, w.weapon.level);
  const stats = ctx.derived("stats");
  const { body } = ctx.derived("player");
  const t = ctx.now("action");
  switch (def.behaviour) {
    case "fan": {
      const shots = ctx.packed("shots");
      const count = (s.count ?? 1) + stats.amount;
      const speed = s.speed ?? 6;
      let base: number;
      if (def.aim === "nearest") {
        const e = rebuildGrid(ctx);
        const i = enemyGrid.nearest(body.x, body.y, 520, e.col("x"), e.col("y"));
        const boss = ctx.derived("boss");
        if (boss && bossVulnerable(boss, t)) {
          bossPos(boss, t, bp);
          base = atan2(bp.y - body.y, bp.x - body.x);
        } else if (i >= 0) base = atan2(e.col("y")[i]! - body.y, e.col("x")[i]! - body.x);
        else base = atan2(body.fy, body.fx);
      } else if (def.aim === "ring") {
        base = ctx.rng("weapons").float() * TAU;
      } else {
        base = atan2(body.fy, body.fx);
      }
      const spread = def.aim === "ring" ? TAU : (s.spread ?? 0.2) * Math.max(1, count - 1);
      for (let k = 0; k < count; k++) {
        const a = def.aim === "ring" ? base + (TAU * k) / count : count === 1 ? base : base - spread / 2 + (spread * k) / (count - 1);
        shots.add({
          x0: body.x,
          y0: body.y,
          vx: cos(a) * speed,
          vy: sin(a) * speed,
          t0: t,
          dieAt: t + (s.life ?? 60),
          dmg,
          pierce: s.pierce ?? 1,
          radius: (s.radius ?? 8) * stats.area,
          weapon: WEAPON_INDEX[def.id]!,
          knock: s.knock ?? 4,
          lastUid: -1,
        });
      }
      return;
    }
    case "orbit":
      ctx.mut(w, "weapon").armed = dmg;
      return;
    case "aura": {
      const r = (s.radius ?? 80) * stats.area;
      ctx.emit("aura", { x: body.x, y: body.y, radius: r, color: def.color });
      damageArea(ctx, body.x, body.y, r, dmg, s.knock ?? 8);
      return;
    }
    case "beam":
      ctx.emit("beam", {
        x: body.x,
        y: body.y,
        dx: body.fx,
        dy: body.fy,
        length: (s.length ?? 400) * stats.area,
        width: (s.width ?? 24) * stats.area,
        dmg,
        color: def.color,
        source: def.id,
      });
      return;
  }
}

export interface ShotResult {
  bossDmg: number;
  struckX: number[];
  struckY: number[];
}

/** Moves nothing (shots are computable); tests each live shot against the grid and the boss. */
export function stepShots(ctx: C): ShotResult {
  const shots = ctx.packed("shots");
  const e = ctx.packed("enemies");
  const t = ctx.now("action");
  const boss = ctx.derived("boss");
  const bossOn = boss !== undefined && bossVulnerable(boss, t);
  let bossR = 0;
  if (bossOn) {
    bossPos(boss, t, bp);
    bossR = bossDef(boss.boss.id).radius;
  }
  const x0 = shots.col("x0");
  const y0 = shots.col("y0");
  const vx = shots.col("vx");
  const vy = shots.col("vy");
  const t0 = shots.col("t0");
  const dieAt = shots.col("dieAt");
  const dmg = shots.col("dmg");
  const pierce = shots.col("pierce");
  const radius = shots.col("radius");
  const knock = shots.col("knock");
  const lastUid = shots.col("lastUid");
  const ex = e.col("x");
  const ey = e.col("y");
  const ehp = e.col("hp");
  const ekind = e.col("kind");
  const euid = e.col("uid");
  const res: ShotResult = { bossDmg: 0, struckX: [], struckY: [] };
  for (let s = shots.count - 1; s >= 0; s--) {
    if (t >= dieAt[s]!) {
      shots.remove(s);
      continue;
    }
    const dt = t - t0[s]!;
    const sx = x0[s]! + vx[s]! * dt;
    const sy = y0[s]! + vy[s]! * dt;
    const r = radius[s]!;
    if (bossOn) {
      const ddx = bp.x - sx;
      const ddy = bp.y - sy;
      const rr = bossR + r;
      if (ddx * ddx + ddy * ddy < rr * rr) {
        res.bossDmg += dmg[s]!;
        if (res.struckX.length < 24) {
          res.struckX.push(sx);
          res.struckY.push(sy);
        }
        shots.remove(s);
        continue;
      }
    }
    const found = enemyGrid.query(sx, sy, r + MAX_ENEMY_R);
    let gone = false;
    for (let k = 0; k < found; k++) {
      const i = enemyGrid.hits[k]!;
      if (ehp[i]! <= 0 || euid[i] === lastUid[s]) continue;
      const ddx = ex[i]! - sx;
      const ddy = ey[i]! - sy;
      const rr = ENEMIES[ekind[i]!]!.radius + r;
      if (ddx * ddx + ddy * ddy >= rr * rr) continue;
      hurtEnemy(e, i, dmg[s]!, sx - vx[s]!, sy - vy[s]!, knock[s]!, t);
      if (res.struckX.length < 24) {
        res.struckX.push(sx);
        res.struckY.push(sy);
      }
      lastUid[s] = euid[i]!;
      pierce[s] = pierce[s]! - 1;
      if (pierce[s]! <= 0) {
        gone = true;
        break;
      }
    }
    if (gone) shots.remove(s);
  }
  return res;
}

/** Orbiting orbs hit what they touch, each enemy at most once per the weapon's cooldown. */
export function stepOrbits(ctx: C): number {
  const t = ctx.now("action");
  const stats = ctx.derived("stats");
  const e = ctx.packed("enemies");
  const { body } = ctx.derived("player");
  const boss = ctx.derived("boss");
  const bossOn = boss !== undefined && bossVulnerable(boss, t);
  if (bossOn) bossPos(boss, t, bp);
  let bossDmg = 0;
  for (const w of ctx.derived("weapons")) {
    const def = weaponDef(w.weapon.id);
    if (def.behaviour !== "orbit" || w.weapon.armed <= 0) continue;
    const s = weaponStats(w.weapon.id, w.weapon.level);
    const count = (s.count ?? 1) + stats.amount;
    const dist = (s.radius ?? 70) * stats.area;
    const size = (s.size ?? 12) * stats.area;
    const orbAt = e.col("orbAt");
    const hp = e.col("hp");
    for (let k = 0; k < count; k++) {
      const a = t * (s.spin ?? 0.06) + (TAU * k) / count;
      const ox = body.x + cos(a) * dist;
      const oy = body.y + sin(a) * dist;
      const found = enemyGrid.query(ox, oy, size + MAX_ENEMY_R);
      for (let j = 0; j < found; j++) {
        const i = enemyGrid.hits[j]!;
        if (hp[i]! <= 0 || t - orbAt[i]! < s.cooldown) continue;
        const ddx = e.col("x")[i]! - ox;
        const ddy = e.col("y")[i]! - oy;
        const rr = ENEMIES[e.col("kind")[i]!]!.radius + size;
        if (ddx * ddx + ddy * ddy >= rr * rr) continue;
        orbAt[i] = t;
        hurtEnemy(e, i, w.weapon.armed, body.x, body.y, s.knock ?? 5, t);
      }
      if (bossOn && boss && t - boss.boss.orbAt >= s.cooldown) {
        const ddx = bp.x - ox;
        const ddy = bp.y - oy;
        const rr = bossDef(boss.boss.id).radius + size;
        if (ddx * ddx + ddy * ddy < rr * rr) {
          bossDmg += w.weapon.armed;
          ctx.mut(boss, "boss").orbAt = t;
        }
      }
    }
  }
  return bossDmg;
}

/** Damages every enemy within r of (x, y) and the boss if it is inside. Returns the boss damage (already emitted). */
export function damageArea(ctx: C, x: number, y: number, r: number, dmg: number, knock: number): void {
  const t = ctx.now("action");
  const e = rebuildGrid(ctx);
  const hp = e.col("hp");
  const found = enemyGrid.query(x, y, r + MAX_ENEMY_R);
  for (let k = 0; k < found; k++) {
    const i = enemyGrid.hits[k]!;
    if (hp[i]! <= 0) continue;
    const ddx = e.col("x")[i]! - x;
    const ddy = e.col("y")[i]! - y;
    const rr = r + ENEMIES[e.col("kind")[i]!]!.radius;
    if (ddx * ddx + ddy * ddy < rr * rr) hurtEnemy(e, i, dmg, x, y, knock, t);
  }
  const boss = ctx.derived("boss");
  if (boss && bossVulnerable(boss, t)) {
    bossPos(boss, t, bp);
    const ddx = bp.x - x;
    const ddy = bp.y - y;
    const rr = r + bossDef(boss.boss.id).radius;
    if (ddx * ddx + ddy * ddy < rr * rr) ctx.emit("boss:hit", { dmg });
  }
}

/** Damages everything in a beam from (x, y) along the unit vector (dx, dy). */
export function damageLine(ctx: C, x: number, y: number, dx: number, dy: number, length: number, width: number, dmg: number, knock: number): void {
  const t = ctx.now("action");
  const e = ctx.packed("enemies");
  const hp = e.col("hp");
  const half = width / 2;
  const hitsLine = (px: number, py: number, pr: number): boolean => {
    const rx = px - x;
    const ry = py - y;
    const along = rx * dx + ry * dy;
    if (along < -pr || along > length + pr) return false;
    const across = Math.abs(rx * -dy + ry * dx);
    return across < half + pr;
  };
  for (let i = 0; i < e.count; i++) {
    if (hp[i]! <= 0) continue;
    if (hitsLine(e.col("x")[i]!, e.col("y")[i]!, ENEMIES[e.col("kind")[i]!]!.radius)) {
      hurtEnemy(e, i, dmg, e.col("x")[i]! - dx, e.col("y")[i]! - dy, knock, t);
    }
  }
  const boss = ctx.derived("boss");
  if (boss && bossVulnerable(boss, t)) {
    bossPos(boss, t, bp);
    if (hitsLine(bp.x, bp.y, bossDef(boss.boss.id).radius)) ctx.emit("boss:hit", { dmg });
  }
}

export { WEAPONS };
