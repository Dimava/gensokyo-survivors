// A bot that plays runs through the same thin input events a player sends,
// choosing level-ups and cards from the kernel's options() (D21). Tests use
// it for scripted playthroughs and balance sweeps; it is also the "attract
// mode" of the title screen.

import { ENEMIES } from "../content/enemies.ts";
import { BULLET_STYLES } from "../content/patterns.ts";
import { cardDef } from "../content/cards.ts";
import { weaponDef } from "../content/weapons.ts";
import { activeRun, runView, type Game, type RunPath } from "./game.ts";
import { spiritAt, handCards } from "./cards.ts";
import { bossPos } from "./boss.ts";
import { PHASE, enemyVelocity } from "./swarm.ts";
import { BOSS, PLAYER } from "./tuning.ts";

export interface BotOptions {
  /** 0..1: how hard the bot dodges bullets (1 = its best). */
  dodge?: number;
  /** Play cards when affordable. */
  cards?: boolean;
  /** Ticks between steering decisions (a human's reaction time; 1 = every tick). */
  reaction?: number;
  /** Hold focus when it helps (botFocus); default true. */
  focus?: boolean;
}

/** Two reference players for balance: a first-timer and a practised danmaku player. */
export const SKILL = {
  novice: { dodge: 0.2, reaction: 14, focus: false },
  expert: { dodge: 1, reaction: 1 },
} as const satisfies Record<string, BotOptions>;

const pos = { x: 0, y: 0 };

const DIRS: [number, number][] = [[0, 0]];
for (let i = 0; i < 16; i++) DIRS.push([Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);
const LOOK = [3, 6, 10, 15, 21];

/**
 * The move the bot wants this tick, as the ints the `move` event takes. It
 * scores 17 candidate directions by looking ahead: bullets are computable, so
 * their future positions are exact; enemies are assumed to keep their current velocity.
 * Danger dominates; then it drifts toward gems (or its spot below the boss).
 */
export function botMove(k: Game, path: RunPath, opts: BotOptions = {}): { x: number; y: number } {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const p = v.derived("player");
  const stats = v.derived("stats");
  const t = v.now("action");
  const td = v.now("danmaku");
  const px = p.body.x;
  const py = p.body.y;
  // Focused she moves at the base pace (rules.ts movePlayer).
  const speed = PLAYER.speed * (p.ctrl.focus ? 1 : stats.speed);
  const dodge = opts.dodge ?? 1;
  // Nearby threats, gathered once.
  const e = v.packed("enemies");
  const ex = e.col("x");
  const ey = e.col("y");
  let midboss = -1;
  for (let i = 0; i < e.count; i++) if (ENEMIES[e.col("kind")[i]!]!.midboss && e.col("phase")[i] !== PHASE.leaving) midboss = i;
  const near: number[] = [];
  const nearVx: number[] = [];
  const nearVy: number[] = [];
  for (let i = 0; i < e.count; i++) {
    const dx = ex[i]! - px;
    const dy = ey[i]! - py;
    if (dx * dx + dy * dy < 170 * 170) {
      near.push(i);
      enemyVelocity(e, i, px, py, t, pos);
      nearVx.push(pos.x);
      nearVy.push(pos.y);
    }
  }
  const b = v.packed("bullets");
  const bnear: number[] = [];
  for (let i = 0; i < b.count; i++) {
    if (!b.pos(i, td, pos)) continue;
    const dx = pos.x - px;
    const dy = pos.y - py;
    if (dx * dx + dy * dy < 150 * 150) bnear.push(i);
  }
  // Goal: the boss spot, else under the midboss, else the nearest gem, else a slow circle.
  let gx = Math.cos(t / 240);
  let gy = Math.sin(t / 240);
  const boss = v.derived("boss");
  if (boss) {
    bossPos(boss, t, pos);
    gx = pos.x - px;
    gy = pos.y + 170 - py;
  } else if (midboss >= 0) {
    // Stand under the midboss so every weapon is on her.
    gx = ex[midboss]! - px;
    gy = ey[midboss]! + 170 - py;
  } else {
    const d = v.packed("drops");
    let best = 450 * 450;
    for (let i = 0; i < d.count; i++) {
      const dx = d.col("x")[i]! - px;
      const dy = d.col("y")[i]! - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        gx = dx;
        gy = dy;
      }
    }
  }
  const gl = Math.sqrt(gx * gx + gy * gy) || 1;
  gx /= gl;
  gy /= gl;
  let bestScore = Infinity;
  let bx = 0;
  let by = 0;
  for (const [dx, dy] of DIRS) {
    let danger = 0;
    for (const k2 of LOOK) {
      let qx = px + dx * speed * k2;
      let qy = py + dy * speed * k2;
      if (run.arena) {
        const ax = qx - run.ax;
        const ay = qy - run.ay;
        const ad = Math.sqrt(ax * ax + ay * ay);
        if (ad > BOSS.arena - 20) danger += (ad - BOSS.arena + 20) * 2;
        if (ad > BOSS.arena - 8) {
          qx = run.ax + (ax / ad) * (BOSS.arena - 8);
          qy = run.ay + (ay / ad) * (BOSS.arena - 8);
        }
      }
      const w = 1 / (1 + k2 * 0.08);
      for (let n = 0; n < near.length; n++) {
        const i = near[n]!;
        const def = ENEMIES[e.col("kind")[i]!]!;
        // Each enemy keeps doing what it does now (chasing, crossing, holding a post).
        const ox = ex[i]! + nearVx[n]! * k2 - qx;
        const oy = ey[i]! + nearVy[n]! * k2 - qy;
        const dd = Math.sqrt(ox * ox + oy * oy);
        const r = def.radius + 11 + 8;
        if (dd < r + 20) danger += ((r + 20 - dd) / (r + 20)) * 30 * w;
      }
      for (const i of bnear) {
        if (!b.pos(i, td + k2, pos)) continue;
        const ox = pos.x - qx;
        const oy = pos.y - qy;
        const dd = Math.sqrt(ox * ox + oy * oy);
        const r = BULLET_STYLES[b.col("style")[i]!]!.radius + 3 + 6 * (1 - dodge);
        if (dd < r) danger += 400 * w * dodge;
        else if (dd < r + 14) danger += ((r + 14 - dd) / 14) * 12 * w * dodge;
      }
    }
    const score = danger - (dx * gx + dy * gy) * 3 + (dx === 0 && dy === 0 ? 0.5 : 0);
    if (score < bestScore) {
      bestScore = score;
      bx = dx;
      by = dy;
    }
  }
  if (!bx && !by) return { x: 0, y: 0 };
  return { x: Math.round(bx * 100), y: Math.round(by * 100) };
}

/**
 * Focus thresholds. Dense: this many bullets within `denseR` turns focus on
 * (slow, precise threading), fewer than `sparse` within `sparseR` lets it go.
 * Boss: facing within `aimOn` radians of the boss turns it on (the facing
 * weapons stay on her while strafing), beyond `aimOff` lets it go so moving
 * can re-aim. `hold`: action ticks between changes, so it never flickers.
 */
const FOCUS_BOT = { dense: 5, denseR: 60, sparse: 2, sparseR: 80, aimOn: 0.5, aimOff: 1.1, hold: 20 };

/**
 * Whether the bot holds focus now: threading bullets close by, or in a boss
 * fight while her facing points at the boss. Reads the current focus for
 * hysteresis (tighter to turn on than to stay on) and holds each change
 * FOCUS_BOT.hold ticks.
 */
export function botFocus(k: Game, path: RunPath): boolean {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const p = v.derived("player");
  const was = p.ctrl.focus;
  const t = v.now("action");
  if (run.overlay !== "none" || run.phase === "over") return was;
  if (t - p.ctrl.focusAt < FOCUS_BOT.hold) return was;
  const px = p.body.x;
  const py = p.body.y;
  const td = v.now("danmaku");
  const b = v.packed("bullets");
  const r = was ? FOCUS_BOT.sparseR : FOCUS_BOT.denseR;
  const need = was ? FOCUS_BOT.sparse : FOCUS_BOT.dense;
  let n = 0;
  for (let i = 0; i < b.count && n < need; i++) {
    if (!b.pos(i, td, pos)) continue;
    const dx = pos.x - px;
    const dy = pos.y - py;
    if (dx * dx + dy * dy < r * r) n++;
  }
  if (n >= need) return true;
  const boss = v.derived("boss");
  if (boss && run.phase === "boss") {
    bossPos(boss, t, pos);
    const a = Math.atan2(pos.y - py, pos.x - px) - Math.atan2(p.body.fy, p.body.fx);
    const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (off < (was ? FOCUS_BOT.aimOff : FOCUS_BOT.aimOn)) return true;
  }
  return false;
}

/** The bot's last sent inputs (so only changes are queued). */
export interface BotInputs {
  move: { x: number; y: number };
}

/**
 * One steering decision as logged input: queues `move` and `focus` when they
 * change (focus off when opts.focus is false). Shared by playRun, the tests and the ?bot=1 host.
 */
export function botSteer(k: Game, path: RunPath, last: BotInputs, opts: BotOptions = {}): void {
  const p = path as "/run:1";
  const m = botMove(k, path, opts);
  if (m.x !== last.move.x || m.y !== last.move.y) {
    k.queue(p, "move", m);
    last.move = m;
  }
  const on = opts.focus !== false && botFocus(k, path);
  if (on !== runView(k, path).derived("player").ctrl.focus) k.queue(p, "focus", { on });
}

/** Which level-up choice to take: grow weapons first, then new weapons, then passives. */
export function botPick(k: Game, path: RunPath): number {
  const offer = k.view(`${path}/levelup` as "/").q("offer" as never)[0] as unknown as
    | { offer: { choices: { kind: string; id: string; level: number }[] } }
    | undefined;
  const choices = offer?.offer.choices ?? [];
  let best = 0;
  let bestScore = -1;
  choices.forEach((c, i) => {
    let s = 0;
    if (c.kind === "weapon") s = c.level > 1 ? 50 + c.level : 45;
    else if (c.kind === "passive") s = ["power", "heart", "clock", "tome", "grimoire"].includes(c.id) ? 40 : 30;
    else s = 5;
    if (c.kind === "weapon" && weaponDef(c.id).behaviour === "orbit") s += 3;
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

/** A card to play now, or null. */
export function botCard(k: Game, path: RunPath): string | null {
  const v = runView(k, path);
  const run = v.derived("state").run;
  if (run.overlay !== "none" || run.phase === "over" || run.phase === "dialogue") return null;
  const p = v.derived("player");
  const stats = v.derived("stats");
  const spirit = spiritAt(v, v.now("action"));
  const bullets = v.packed("bullets").count;
  for (const c of handCards(v)) {
    const def = cardDef(v.req(c.id, "card").card.id);
    if (def.cost > spirit + 1e-9) continue;
    switch (def.effect) {
      case "heal":
        if (p.life.hp < stats.maxHp * 0.55) return c.id;
        break;
      case "clear":
      case "timeStop":
        if (bullets > 60) return c.id;
        break;
      case "lastStand":
        if (!v.has(p, "triggers")) return c.id;
        break;
      default:
        if (run.phase === "boss" || v.packed("enemies").count > 40) return c.id;
    }
  }
  return null;
}

export interface PlayResult {
  ticks: number;
  path: RunPath;
}

/**
 * Plays the active run until it ends (or maxTicks): the bot answers overlays,
 * steers, and plays cards; every decision goes in as input.
 */
export function playRun(k: Game, opts: BotOptions & { maxTicks?: number; onTick?: (i: number) => void } = {}): PlayResult {
  const path = activeRun(k);
  if (!path) throw new Error("playRun: no active run; dispatch run:start first");
  const p = path as "/run:1";
  const last: BotInputs = { move: { x: 0, y: 0 } };
  const max = opts.maxTicks ?? 60 * 60 * 10;
  let i = 0;
  for (; i < max; i++) {
    if (activeRun(k) !== path) break;
    const v = runView(k, path);
    const overlay = v.derived("state").run.overlay;
    if (overlay === "levelup") {
      k.dispatch(`${p}/levelup` as "/run:1/levelup", "levelup:pick", { index: botPick(k, path) });
    } else if (overlay === "vn") {
      k.dispatch(`${p}/vn` as "/run:1/vn", "vn:next", {});
    } else {
      if (i % (opts.reaction ?? 1) === 0) botSteer(k, path, last, opts);
      if (opts.cards !== false && i % 20 === 0) {
        const c = botCard(k, path);
        if (c) k.queue(p, "card:play", { card: c });
      }
    }
    if (activeRun(k) !== path) break;
    k.tick(p, "fixed");
    opts.onTick?.(i);
  }
  return { ticks: i, path };
}
