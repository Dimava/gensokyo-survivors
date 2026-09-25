// The swarm: enemies as a packed `columns` store, stepped in bulk. Each kind
// has a job (content/enemies.ts `move`): fuzzballs chase; fairies arrive in
// formations (stages.ts beats), cross the field, hold a post, or circle the
// player, fire, and leave. Their motion is integrated, not computable: they
// react to the player, push each other apart through the spatial grid and
// take knockback. Kills are collected in one pass that emits one
// `enemies:died` event with the positions, so drops and effects are rules,
// not bulk code.

import { fromBase64, toBase64, type Columns, type Ctx, type ScopeData } from "gamebones";
import { ENEMIES, type EnemyDef } from "../content/enemies.ts";
import type { Beat, Side } from "../content/stages.ts";
import type { RS0 } from "./run.ts";
import { Grid } from "./spatial.ts";
import { CAP, FORMATION, SWARM, WIND, XP } from "./tuning.ts";
import { emitPattern } from "./danmaku.ts";
import { stageDef } from "../content/stages.ts";

/**
 * Enemy rows. Besides position and health: `vx, vy` a heading (crossers, and
 * everyone leaving) or the orbit's spin in `vx`; `ax, ay` the post as an offset
 * from the player (snipers) or the orbit's angle and radius (orbiters);
 * `phase` 0 arriving or on the job, 1 holding a post, 2 leaving, 3 blown away
 * by the boss's winds; `until` the tick the job ends (blown: the tick the wind
 * caught it). `xp` is the value of the gem it drops (0 once blown).
 */
export const ENEMY_FIELDS = [
  "x",
  "y",
  "hp",
  "kind",
  "uid",
  "hitAt",
  "orbAt",
  "fireAt",
  "kx",
  "ky",
  "volley",
  "vx",
  "vy",
  "ax",
  "ay",
  "phase",
  "until",
  // Last, for the v1 -> v2 save migration: the direction a salvo locked on its first volley.
  "aim",
  // After it, for the v3 -> v4 migration: the gem's value, fixed at spawn.
  "xp",
] as const;
export type EnemyCols = Columns<(typeof ENEMY_FIELDS)[number]>;

export const PHASE = { active: 0, holding: 1, leaving: 2, blown: 3 } as const;

/** Scratch grid over the enemies, rebuilt from the store whenever a rule needs it. */
export const enemyGrid = new Grid(SWARM.cell, SWARM.leash + 200, CAP.enemies);

type C = Ctx<RS0>;

export function rebuildGrid(ctx: C): EnemyCols {
  const e = ctx.packed("enemies");
  const { body } = ctx.derived("player");
  enemyGrid.build(e.col("x"), e.col("y"), e.count, body.x, body.y);
  return e;
}

interface Job {
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  until?: number;
  /** Ticks from spawn to the first volley (default FORMATION.enterShot). */
  fireIn?: number;
}

/** A first-shot delay for enemies that never fire. */
const NEVER = 1e9;

/** Adds one enemy (nothing if the store is full); returns its row or -1. */
export function spawnEnemy(ctx: C, kind: number, x: number, y: number, job: Job = {}): number {
  const e = ctx.packed("enemies");
  if (e.count >= e.capacity) return -1;
  const def = ENEMIES[kind]!;
  const run = ctx.derived("state");
  const uid = run.run.nextUid;
  ctx.mut(run, "run").nextUid = uid + 1;
  const t = ctx.now("action");
  const scale = def.midboss ? 1 : 1 + stageDef(run.run.stage).hpPerMinute * (t / 3600);
  const first = def.shoots?.[0];
  const hp = Math.round(def.hp * scale);
  if (SPAWN_PROBE.on) SPAWN_PROBE.on(kind, hp, gemValue(def, hp), t);
  return e.add({
    x,
    y,
    hp,
    kind,
    uid,
    hitAt: -100,
    orbAt: -100,
    fireAt: first ? t + (job.fireIn ?? FORMATION.enterShot) : 0,
    kx: 0,
    ky: 0,
    volley: 0,
    vx: job.vx ?? 0,
    vy: job.vy ?? 0,
    ax: job.ax ?? 0,
    ay: job.ay ?? 0,
    phase: PHASE.active,
    until: job.until ?? 0,
    aim: 0,
    xp: gemValue(def, hp),
  });
}

/** The experience an enemy of `hp` HP at spawn drops. */
export function gemValue(def: EnemyDef, hp: number): number {
  return Math.round(hp * (def.xpPerHp ?? XP.perHp) * 100) / 100;
}

/** Spawns n chasers at random points of the spawn ring around the player. */
export function spawnAround(ctx: C, kind: number, n: number): void {
  const { body } = ctx.derived("player");
  const r = ctx.rng("spawn");
  for (let i = 0; i < n; i++) {
    const [dx, dy] = unitFromTurn(r.float());
    const d = SWARM.spawnMin + r.float() * (SWARM.spawnMax - SWARM.spawnMin);
    spawnEnemy(ctx, kind, body.x + dx * d, body.y + dy * d);
  }
}

/** A unit vector for a fraction of a full turn. */
export function unitFromTurn(turn: number): [number, number] {
  const a = turn * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
}

const SIDE: Readonly<Record<Side, [number, number]>> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

/** Distance from the player to the edge of the view (plus a margin) along the unit direction (dx, dy). */
function edge(dx: number, dy: number): number {
  return 1 / Math.max(Math.abs(dx) / FORMATION.edgeX, Math.abs(dy) / FORMATION.edgeY);
}

/** Spawns one beat's formation around the player. */
export function spawnFormation(ctx: C, beat: Beat, kind: number): void {
  const { body } = ctx.derived("player");
  const def = ENEMIES[kind]!;
  const t = ctx.now("action");
  switch (beat.form) {
    case "line":
    case "vee":
    case "stream": {
      // s points from the player to the entry edge; the formation flies along h = -s; p is across it.
      const [sx, sy] = SIDE[beat.side];
      const hx = -sx;
      const hy = -sy;
      const qx = -hy;
      const qy = hx;
      const lane = beat.lane ?? 0;
      const d = edge(sx, sy);
      const bx = body.x + sx * d + qx * lane;
      const by = body.y + sy * d + qy * lane;
      for (let i = 0; i < beat.n; i++) {
        let across = 0;
        let back = 0;
        if (beat.form === "line") across = (i - (beat.n - 1) / 2) * FORMATION.lineGap;
        else if (beat.form === "stream") back = i * FORMATION.streamGap;
        else {
          const j = Math.ceil(i / 2);
          across = (i % 2 ? 1 : -1) * j * FORMATION.veeGap;
          back = j * FORMATION.veeGap * 0.8;
        }
        // Only every few fairies (every few ranks of a V) shoot. Ranks further back fire when they reach
        // the spot the front fired from, so the volley ripples down the formation.
        const shooter = (beat.form === "vee" ? Math.ceil(i / 2) : i) % FORMATION.shooterEvery === 0;
        const fireIn = shooter ? FORMATION.enterShot + Math.round(back / def.speed) : NEVER;
        spawnEnemy(ctx, kind, bx + qx * across + sx * back, by + qy * across + sy * back, { vx: hx, vy: hy, fireIn });
      }
      return;
    }
    case "posts": {
      // Posts on an arc on that side; each sniper enters from the edge behind its post.
      const [sx, sy] = SIDE[beat.side];
      const mid = Math.atan2(sy, sx);
      for (let i = 0; i < beat.n; i++) {
        const a = mid + (i - (beat.n - 1) / 2) * FORMATION.postSpread;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const r = FORMATION.postRadius * (beat.side === "top" || beat.side === "bottom" ? 0.8 : 1.15);
        const d = edge(ux, uy);
        spawnEnemy(ctx, kind, body.x + ux * d, body.y + uy * d, { ax: ux * r, ay: uy * r });
      }
      return;
    }
    case "circle": {
      if (def.move.kind !== "orbit") return;
      for (let i = 0; i < beat.n; i++) {
        const a = (i / beat.n) * Math.PI * 2;
        const r = FORMATION.circleRadius;
        const fireIn = i % FORMATION.shooterEvery === 0 ? FORMATION.enterShot : NEVER;
        spawnEnemy(ctx, kind, body.x + Math.cos(a) * r, body.y + Math.sin(a) * r, { vx: beat.spin ?? 1, ax: a, ay: r, until: t + def.move.life, fireIn });
      }
      return;
    }
    case "ring":
      for (let i = 0; i < beat.n; i++) {
        const [dx, dy] = unitFromTurn(i / beat.n);
        spawnEnemy(ctx, kind, body.x + dx * beat.radius, body.y + dy * beat.radius);
      }
      return;
    case "rush": {
      const [sx, sy] = SIDE[beat.side];
      const r = ctx.rng("spawn");
      for (let i = 0; i < beat.n; i++) {
        const d = edge(sx, sy) + r.float() * 120;
        const across = (r.float() - 0.5) * 260;
        spawnEnemy(ctx, kind, body.x + sx * d - sy * across, body.y + sy * d + sx * across);
      }
      return;
    }
    case "midboss": {
      if (def.move.kind !== "hover") return;
      spawnEnemy(ctx, kind, body.x, body.y - edge(0, -1), { until: t + def.move.stay });
      return;
    }
  }
}

/**
 * Where an enemy wants to go this tick (before knockback and separation), as
 * a velocity. Pure: the bot calls it to predict enemies. Phase changes happen
 * in `stepEnemies`.
 */
export function enemyVelocity(e: EnemyCols, i: number, px: number, py: number, t: number, out: { x: number; y: number }): void {
  const def = ENEMIES[e.col("kind")[i]!]!;
  const x = e.col("x")[i]!;
  const y = e.col("y")[i]!;
  const phase = e.col("phase")[i]!;
  const move = def.move;
  if (phase === PHASE.blown) {
    const k = WIND.speed + WIND.accel * (t - e.col("until")[i]!);
    out.x = e.col("vx")[i]! * k;
    out.y = e.col("vy")[i]! * k;
    return;
  }
  if (phase === PHASE.leaving || move.kind === "cross") {
    const k = phase === PHASE.leaving ? FORMATION.leaveSpeed : 1;
    out.x = e.col("vx")[i]! * def.speed * k;
    out.y = e.col("vy")[i]! * def.speed * k;
    return;
  }
  let tx = px;
  let ty = py;
  let cap = def.speed;
  switch (move.kind) {
    case "chase":
      break;
    case "snipe":
      // A sniper stands still through a salvo (from just before its first volley to its last), so it reads as one barrage.
      if (phase === PHASE.holding && def.salvo && (e.col("volley")[i]! % def.salvo.volleys !== 0 || t >= e.col("fireAt")[i]! - FORMATION.windup)) {
        out.x = 0;
        out.y = 0;
        return;
      }
      tx = px + e.col("ax")[i]!;
      ty = py + e.col("ay")[i]!;
      // Arriving: fast enough to reach a post that moves with the player. Holding: a slow drift, not a chase.
      cap = def.speed * (phase === PHASE.holding ? FORMATION.holdDrift : FORMATION.orbitCatchUp);
      break;
    case "orbit": {
      const a = e.col("ax")[i]!;
      const r = e.col("ay")[i]!;
      tx = px + Math.cos(a) * r;
      ty = py + Math.sin(a) * r;
      cap = def.speed * FORMATION.orbitCatchUp;
      break;
    }
    case "hover":
      tx = px + FORMATION.hoverSway * Math.sin(t * 0.012);
      ty = py - FORMATION.hoverHeight;
      break;
  }
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) {
    out.x = 0;
    out.y = 0;
    return;
  }
  // Chasers go flat out; everyone else eases into their spot.
  const s = move.kind === "chase" ? cap : Math.min(cap, d * 0.12);
  out.x = (dx / d) * s;
  out.y = (dy / d) * s;
}

const vel = { x: 0, y: 0 };

/** Sets a row leaving: straight away from the player. */
function leave(e: EnemyCols, i: number, px: number, py: number): void {
  let dx = e.col("x")[i]! - px;
  let dy = e.col("y")[i]! - py;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    dx /= d;
    dy /= d;
  } else {
    dx = 0;
    dy = -1;
  }
  e.col("phase")[i] = PHASE.leaving;
  e.col("vx")[i] = dx;
  e.col("vy")[i] = dy;
}

/**
 * The boss's winds: every enemy is blown straight away from the player, harmless
 * and worth nothing (stepEnemies drops it once out of sight).
 */
export function blowAway(ctx: C): void {
  const e = ctx.packed("enemies");
  const { body } = ctx.derived("player");
  const t = ctx.now("action");
  for (let i = 0; i < e.count; i++) {
    leave(e, i, body.x, body.y);
    e.col("phase")[i] = PHASE.blown;
    e.col("until")[i] = t;
    e.col("xp")[i] = 0;
  }
}

/** Job changes (arrive, hold, leave), movement, knockback, separation; chasers are leashed, everyone else leaves the field. */
export function stepEnemies(ctx: C): void {
  const e = rebuildGrid(ctx);
  const { body } = ctx.derived("player");
  const run = ctx.derived("state").run;
  const t = ctx.now("action");
  const x = e.col("x");
  const y = e.col("y");
  const kx = e.col("kx");
  const ky = e.col("ky");
  const kind = e.col("kind");
  const phase = e.col("phase");
  const hits = enemyGrid.hits;
  const n = e.count;
  let gone: number[] | null = null;
  for (let i = 0; i < n; i++) {
    const def = ENEMIES[kind[i]!]!;
    const move = def.move;
    const ddx = body.x - x[i]!;
    const ddy = body.y - y[i]!;
    const d2 = ddx * ddx + ddy * ddy;
    if (phase[i] === PHASE.blown) {
      if (d2 > FORMATION.gone * FORMATION.gone) {
        (gone ??= []).push(i);
        continue;
      }
    } else if (move.kind === "chase") {
      if (d2 > SWARM.leash * SWARM.leash && !run.arena) {
        // Too far behind: reappear ahead of the player, on the far side.
        const d = Math.sqrt(d2);
        x[i] = body.x + (ddx / d) * SWARM.spawnMin;
        y[i] = body.y + (ddy / d) * SWARM.spawnMin;
        continue;
      }
    } else if (offField(e, i, ddx, ddy, d2)) {
      (gone ??= []).push(i);
      continue;
    } else if (phase[i] === PHASE.active || phase[i] === PHASE.holding) {
      stepJob(ctx, e, i, def, t, body.x, body.y);
    }
    enemyVelocity(e, i, body.x, body.y, t, vel);
    let mx = vel.x + kx[i]!;
    let my = vel.y + ky[i]!;
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
      const o2 = ox * ox + oy * oy;
      if (o2 >= rr * rr) continue;
      pushed++;
      if (o2 < 1e-6) {
        // Exactly on top of each other: nudge by row order so the result is deterministic.
        mx += i < j ? 0.5 : -0.5;
        continue;
      }
      const dd = Math.sqrt(o2);
      const push = ((rr - dd) / dd) * SWARM.separation;
      mx += ox * push;
      my += oy * push;
    }
    x[i] = x[i]! + mx;
    y[i] = y[i]! + my;
  }
  if (gone) {
    // Descending, so swap-remove only moves rows already visited.
    for (let g = gone.length - 1; g >= 0; g--) {
      const def = ENEMIES[kind[gone[g]!]!]!;
      if (def.midboss && phase[gone[g]!] !== PHASE.blown) ctx.emit("banner", { text: `${def.name} retreats`, tone: "info" });
      e.remove(gone[g]!);
    }
    rebuildGrid(ctx);
  }
}

/** A non-chaser has left the field: leaving, or a crosser past the player, and out of sight; or lost far away. */
function offField(e: EnemyCols, i: number, ddx: number, ddy: number, d2: number): boolean {
  if (d2 > FORMATION.lost * FORMATION.lost) return true;
  const outward = -ddx * e.col("vx")[i]! - ddy * e.col("vy")[i]! > 0;
  if (!outward || d2 <= FORMATION.gone * FORMATION.gone) return false;
  return e.col("phase")[i] === PHASE.leaving || ENEMIES[e.col("kind")[i]!]!.move.kind === "cross";
}

/** Advances a row's job: snipers arrive and hold, orbiters close in, and everyone's time runs out. */
function stepJob(ctx: C, e: EnemyCols, i: number, def: EnemyDef, t: number, px: number, py: number): void {
  const move = def.move;
  const phase = e.col("phase");
  const until = e.col("until");
  switch (move.kind) {
    case "snipe": {
      if (phase[i] === PHASE.active) {
        const dx = px + e.col("ax")[i]! - e.col("x")[i]!;
        const dy = py + e.col("ay")[i]! - e.col("y")[i]!;
        if (dx * dx + dy * dy < FORMATION.arrived * FORMATION.arrived) {
          phase[i] = PHASE.holding;
          until[i] = t + move.hold;
          e.col("fireAt")[i] = t + FORMATION.firstShot;
        }
      } else if (t >= until[i]!) leave(e, i, px, py);
      return;
    }
    case "orbit": {
      const r = e.col("ay")[i]!;
      e.col("ax")[i] = e.col("ax")[i]! + (e.col("vx")[i]! * def.speed) / Math.max(r, 60);
      e.col("ay")[i] = Math.max(move.min, r - move.inward);
      if (t >= until[i]!) leave(e, i, px, py);
      return;
    }
    case "hover":
      if (t >= until[i]!) {
        leave(e, i, px, py);
        e.col("vx")[i] = 0;
        e.col("vy")[i] = -1;
      }
      return;
    default:
      return;
  }
}

/**
 * Every hit, for balance scripts (scripts/balance-power.ts): `src` is the weapon or card id, `eff`
 * the part of `dmg` the target had HP left for (the boss: all of it), `t` the action tick. Outside
 * the kernel's state and never read by the sim; null in the game.
 */
export const DAMAGE_PROBE: { on: ((src: string, target: "swarm" | "boss", dmg: number, eff: number, t: number) => void) | null } = { on: null };

/** Every enemy spawned, for balance scripts: its kind, HP, gem value and action tick. Null in the game. */
export const SPAWN_PROBE: { on: ((kind: number, hp: number, xp: number, t: number) => void) | null } = { on: null };

/** Damage to one enemy row from `src` (a weapon or card id); knockback away from (sx, sy). */
export function hurtEnemy(e: EnemyCols, i: number, dmg: number, sx: number, sy: number, knock: number, t: number, src: string): void {
  const hp = e.col("hp");
  if (DAMAGE_PROBE.on) DAMAGE_PROBE.on(src, "swarm", dmg, Math.min(dmg, Math.max(0, hp[i]!)), t);
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
  const xp: number[] = [];
  // Descending, so swap-remove only moves rows already visited.
  for (let i = e.count - 1; i >= 0; i--) {
    if (hp[i]! > 0) continue;
    xs.push(round1(e.col("x")[i]!));
    ys.push(round1(e.col("y")[i]!));
    kinds.push(e.col("kind")[i]!);
    xp.push(e.col("xp")[i]!);
    e.remove(i);
  }
  if (xs.length) {
    ctx.emit("enemies:died", { xs, ys, kinds, xp });
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
  const phase = e.col("phase");
  const found = enemyGrid.query(body.x, body.y, 40);
  let dmg = 0;
  for (let k = 0; k < found; k++) {
    const i = enemyGrid.hits[k]!;
    if (phase[i] === PHASE.blown) continue;
    const def = ENEMIES[kind[i]!]!;
    const ddx = x[i]! - body.x;
    const ddy = y[i]! - body.y;
    const rr = def.radius + 11;
    if (ddx * ddx + ddy * ddy < rr * rr && def.dmg > dmg) dmg = def.dmg;
  }
  return dmg;
}

/**
 * Shooters fire their emitters in turn when due: crossers and chasers when in
 * range, snipers only from their post, a midboss once she is in place;
 * nobody fires while leaving. Mobs fire in salvos and rest between them.
 */
export function enemyFire(ctx: C): void {
  const e = ctx.packed("enemies");
  const t = ctx.now("action");
  const { body } = ctx.derived("player");
  const kind = e.col("kind");
  const fireAt = e.col("fireAt");
  const volley = e.col("volley");
  const phase = e.col("phase");
  const x = e.col("x");
  const y = e.col("y");
  for (let i = 0; i < e.count; i++) {
    const def = ENEMIES[kind[i]!]!;
    const list = def.shoots;
    if (!list || fireAt[i]! > t || phase[i] === PHASE.leaving || phase[i] === PHASE.blown) continue;
    const ddx = x[i]! - body.x;
    const ddy = y[i]! - body.y;
    const d2 = ddx * ddx + ddy * ddy;
    const move = def.move.kind;
    if (move === "snipe" && phase[i] !== PHASE.holding) continue;
    if (move === "hover" && d2 > FORMATION.hoverFireRange * FORMATION.hoverFireRange) continue;
    const em = list[volley[i]! % list.length]!;
    fireAt[i] = t + em.every;
    if (d2 > SWARM.shootRange * SWARM.shootRange) continue;
    // A salvo aims once, on its first volley; the rest fire the same way, so its gaps stay put.
    const aim = e.col("aim");
    if (!def.salvo || volley[i]! % def.salvo.volleys === 0) aim[i] = Math.atan2(body.y - y[i]!, body.x - x[i]!);
    emitPattern(ctx, em, x[i]!, y[i]!, volley[i]!, def.midboss ? 0 : FORMATION.bulletLife, aim[i]!);
    volley[i] = volley[i]! + 1;
    if (def.salvo && volley[i]! % def.salvo.volleys === 0) fireAt[i] = t + def.salvo.rest;
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

const OLD_ENEMY_FIELDS = 11;
/** Enemy columns in run save v1 (before `aim`), and v2 (before `xp`). */
const V1_ENEMY_FIELDS = 17;
const V2_ENEMY_FIELDS = 18;

/**
 * Run save v0 -> v1 (formations): enemy rows gain the job columns, and the
 * director's states are renamed. Enemies that no longer chase were saved as
 * chasers, so they are sent away (leaving, heading out from the player); the
 * director resumes at the first beat after the saved time.
 */
export function migrateToFormations(data: ScopeData): ScopeData {
  const player = data.entities.find((e) => e.body) as { body: { x: number; y: number } } | undefined;
  const px = player?.body.x ?? 0;
  const py = player?.body.y ?? 0;
  const packed = { ...data.packed };
  const old = fromBase64(packed.enemies!);
  const n = new DataView(old.buffer, old.byteOffset, old.byteLength).getUint32(0, true);
  const oldCols = new Float64Array(old.slice(8).buffer);
  const F = V1_ENEMY_FIELDS;
  const bytes = new Uint8Array(8 + n * 8 * F);
  new DataView(bytes.buffer).setUint32(0, n, true);
  const cols = new Float64Array(bytes.buffer, 8, n * F);
  cols.set(oldCols.subarray(0, n * OLD_ENEMY_FIELDS));
  const col = (f: (typeof ENEMY_FIELDS)[number]): number => ENEMY_FIELDS.indexOf(f) * n;
  for (let i = 0; i < n; i++) {
    const def = ENEMIES[cols[col("kind") + i]!];
    if (!def || def.move.kind === "chase") continue;
    let dx = cols[col("x") + i]! - px;
    let dy = cols[col("y") + i]! - py;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d;
    dy /= d;
    cols[col("vx") + i] = dx;
    cols[col("vy") + i] = dy;
    cols[col("phase") + i] = PHASE.leaving;
  }
  packed.enemies = toBase64(bytes);
  const sys = data.sys as unknown as { clocks: Record<string, { now: number }>; procs: { type: string; state: string; locals: unknown }[] };
  const run = data.entities.find((e) => e.run) as { run: { stage: string } } | undefined;
  const now = sys.clocks.action?.now ?? 0;
  const script = run ? stageDef(run.run.stage).script : [];
  let beat = script.findIndex((b) => b.at * 60 > now);
  if (beat < 0) beat = script.length;
  const procs = sys.procs
    .filter((p) => !(p.type === "director" && p.state === "boss"))
    .map((p) => (p.type === "director" && p.state === "swarm" ? { ...p, state: "script", locals: { beat, held: 0, heldFrom: 0, waveAt: 0 } } : p));
  return { ...data, packed, sys: { ...sys, procs } as unknown as ScopeData["sys"] };
}

/** Run save v1 -> v2 (salvos): enemy rows gain `aim`, the locked direction of a salvo (0 until the next salvo sets it). */
export function migrateSalvoAim(data: ScopeData): ScopeData {
  const old = fromBase64(data.packed.enemies!);
  const n = new DataView(old.buffer, old.byteOffset, old.byteLength).getUint32(0, true);
  const bytes = new Uint8Array(8 + n * 8 * V2_ENEMY_FIELDS);
  new DataView(bytes.buffer).setUint32(0, n, true);
  // Columns are stored one after another, so the new last column is zeros past the old ones.
  new Float64Array(bytes.buffer, 8, n * V2_ENEMY_FIELDS).set(new Float64Array(old.slice(8).buffer, 0, n * V1_ENEMY_FIELDS));
  return { ...data, packed: { ...data.packed, enemies: toBase64(bytes) } };
}

/**
 * Run save v3 -> v4 (gems worth HP): enemy rows gain `xp`, their gem's value, at
 * their kind's base HP (their spawn time is not saved); the stage clear bonus
 * (`coinClear`) gives way to the tick the boss fight began, if it has.
 */
export function migrateGemValue(data: ScopeData): ScopeData {
  const old = fromBase64(data.packed.enemies!);
  const n = new DataView(old.buffer, old.byteOffset, old.byteLength).getUint32(0, true);
  const F = ENEMY_FIELDS.length;
  const bytes = new Uint8Array(8 + n * 8 * F);
  new DataView(bytes.buffer).setUint32(0, n, true);
  const cols = new Float64Array(bytes.buffer, 8, n * F);
  cols.set(new Float64Array(old.slice(8).buffer, 0, n * V2_ENEMY_FIELDS));
  const kind = ENEMY_FIELDS.indexOf("kind") * n;
  const xp = ENEMY_FIELDS.indexOf("xp") * n;
  for (let i = 0; i < n; i++) {
    const def = ENEMIES[cols[kind + i]!];
    if (def) cols[xp + i] = gemValue(def, def.hp);
  }
  const boss = data.entities.find((e) => e.boss) as { boss: { spellStart: number } } | undefined;
  const entities = data.entities.map((e) => {
    if (!e.progress) return e;
    const { coinClear: _, ...progress } = e.progress as Record<string, unknown>;
    return { ...e, progress: { ...progress, bossFrom: boss?.boss.spellStart ?? 0 } };
  });
  return { ...data, entities, packed: { ...data.packed, enemies: toBase64(bytes) } };
}
