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
import { BOSS } from "./tuning.ts";

export interface BotOptions {
  /** 0..1: how hard the bot dodges bullets (1 = its best). */
  dodge?: number;
  /** Play cards when affordable. */
  cards?: boolean;
}

const pos = { x: 0, y: 0 };

/** The move the bot wants this tick, as the ints the `move` event takes. */
export function botMove(k: Game, path: RunPath, opts: BotOptions = {}): { x: number; y: number } {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const p = v.derived("player");
  const t = v.now("action");
  const px = p.body.x;
  const py = p.body.y;
  let vx = 0;
  let vy = 0;
  // Enemies: repelled by the ones close by.
  const e = v.packed("enemies");
  const ex = e.col("x");
  const ey = e.col("y");
  for (let i = 0; i < e.count; i++) {
    const dx = ex[i]! - px;
    const dy = ey[i]! - py;
    const d2 = dx * dx + dy * dy;
    if (d2 > 200 * 200 || d2 < 1) continue;
    const r = ENEMIES[e.col("kind")[i]!]!.radius + 30;
    const w = (r * r) / d2;
    vx -= dx * w * 0.02;
    vy -= dy * w * 0.02;
  }
  // Bullets: strongly repelled by the near ones, looking a few ticks ahead.
  const dodge = opts.dodge ?? 1;
  const b = v.packed("bullets");
  const td = v.now("danmaku");
  for (let i = 0; i < b.count; i++) {
    if (!b.pos(i, td + 6, pos)) continue;
    const dx = pos.x - px;
    const dy = pos.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 > 70 * 70 || d2 < 0.01) continue;
    const r = BULLET_STYLES[b.col("style")[i]!]!.radius + 12;
    const w = ((r * r) / d2) * dodge;
    vx -= dx * w * 0.35;
    vy -= dy * w * 0.35;
  }
  // Gems: drift toward the nearest one when nothing presses.
  const d = v.packed("drops");
  let best = 400 * 400;
  let gx = 0;
  let gy = 0;
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
  if (best < 400 * 400) {
    const dd = Math.sqrt(best) || 1;
    vx += (gx / dd) * 0.6;
    vy += (gy / dd) * 0.6;
  }
  // Boss: hold a spot below it; stay inside the arena.
  const boss = v.derived("boss");
  if (boss) {
    bossPos(boss, t, pos);
    const tx = pos.x;
    const ty = pos.y + 220;
    vx += (tx - px) * 0.01;
    vy += (ty - py) * 0.01;
  }
  if (run.arena) {
    const dx = px - run.ax;
    const dy = py - run.ay;
    const dd = Math.sqrt(dx * dx + dy * dy);
    if (dd > BOSS.arena - 60) {
      vx -= (dx / dd) * 1.5;
      vy -= (dy / dd) * 1.5;
    }
  } else if (Math.abs(vx) + Math.abs(vy) < 0.15) {
    // Nothing to do: circle slowly so the swarm follows and gems come into reach.
    vx += Math.cos(t / 240);
    vy += Math.sin(t / 240);
  }
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len < 0.05) return { x: 0, y: 0 };
  // Eight directions, like a keyboard: keeps the log small and the bot honest.
  const ax = Math.abs(vx / len) > 0.38 ? Math.sign(vx) : 0;
  const ay = Math.abs(vy / len) > 0.38 ? Math.sign(vy) : 0;
  const n = Math.sqrt(ax * ax + ay * ay) || 1;
  return { x: Math.round((ax / n) * 100), y: Math.round((ay / n) * 100) };
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
  let last = { x: 0, y: 0 };
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
      const m = botMove(k, path, opts);
      if (m.x !== last.x || m.y !== last.y) {
        k.queue(p, "move", m);
        last = m;
      }
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
