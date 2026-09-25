// A bot that plays runs through the same thin input events a player sends,
// choosing level-ups and cards from the kernel's options() (D21). Tests use
// it for scripted playthroughs and balance sweeps; it is also the "attract
// mode" of the title screen.

import { ENEMIES } from "../content/enemies.ts";
import { BULLET_STYLES } from "../content/patterns.ts";
import { cardDef, cardParams } from "../content/cards.ts";
import { weaponDef } from "../content/weapons.ts";
import { activeRun, runView, type Game, type RunPath } from "./game.ts";
import { spiritAt, handCards } from "./cards.ts";
import { bossPos } from "./boss.ts";
import { PHASE, enemyVelocity } from "./swarm.ts";
import { BOSS, PLAYER, sec } from "./tuning.ts";

export interface BotOptions {
  /** 0..1: how hard the bot dodges bullets (1 = its best). */
  dodge?: number;
  /** Play cards when affordable. */
  cards?: boolean;
  /** Ticks between steering decisions (a human's reaction time; 1 = every tick). */
  reaction?: number;
  /** Hold focus when it helps (botFocus); default true. */
  focus?: boolean;
  /**
   * Ticks from a decision to its execution (a person's hands lag their eyes).
   * With a latency every move, focus change and card play is decided now and
   * sent this many steered ticks later (botThink queues, botFlush sends), so
   * the bot plans from where its already-committed moves will have taken it,
   * against where the bullets will be by then.
   */
  latency?: number;
  /** Move only in the 8 directions a keyboard gives (and stand still), instead of 16. */
  keys8?: boolean;
}

/** Reference players: a first-timer and a practised danmaku player for balance, and a person's pace for recordings. */
export const SKILL = {
  novice: { dodge: 0.2, reaction: 14, focus: false },
  expert: { dodge: 1, reaction: 1 },
  /** The ?bot=1 player of the recordings: decides every tick, executes half a second later. */
  human: { dodge: 1, reaction: 1, latency: 30, keys8: true },
} as const satisfies Record<string, BotOptions>;

/** A card is held at least this long after it is drawn before the bot plays it (it reads it first). */
const CARD_READ = sec(1);
/** A best move whose look-ahead danger is at least this still gets hit: a guard card's moment. */
const EMERGENCY = 250;

const pos = { x: 0, y: 0 };

const DIRS: [number, number][] = [[0, 0]];
for (let i = 0; i < 16; i++) DIRS.push([Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);
/** Standing still and the 8 keyboard directions (every other one of DIRS). */
const DIRS8 = DIRS.filter((_, i) => i === 0 || i % 2 === 1);
const LOOK = [3, 6, 10, 15, 21];

/**
 * What botThink hands botMove: where the committed moves leave her (`from`),
 * a tactic's goal that replaces the usual one, and until when (action time)
 * she is untouchable, a shield card's cover included; botMove reports the
 * best move's look-ahead `danger` back.
 */
export interface BotPlan {
  from: { x: number; y: number };
  goal?: { x: number; y: number };
  invuln?: number;
  danger: number;
}

/**
 * The move the bot wants this tick, as the ints the `move` event takes. It
 * scores 17 candidate directions by looking ahead: bullets are computable, so
 * their future positions are exact; enemies are assumed to keep their current velocity.
 * Danger dominates; then it drifts toward gems (or its spot below the boss).
 */
export function botMove(
  k: Game,
  path: RunPath,
  opts: BotOptions = {},
  plan?: BotPlan,
): { x: number; y: number } {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const p = v.derived("player");
  const stats = v.derived("stats");
  // With a latency the move takes effect `lead` ticks from now, from where the committed moves leave her (plan.from).
  const lead = plan ? (opts.latency ?? 0) : 0;
  const t = v.now("action") + lead;
  const td = v.now("danmaku") + lead;
  const px = plan?.from.x ?? p.body.x;
  const py = plan?.from.y ?? p.body.y;
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
  // Enemy positions are known now; with a lead they are carried forward at their current velocity.
  const nearX: number[] = [];
  const nearY: number[] = [];
  const reach = 170 + lead * 4;
  for (let i = 0; i < e.count; i++) {
    let dx = ex[i]! - px;
    let dy = ey[i]! - py;
    if (dx * dx + dy * dy >= reach * reach) continue;
    enemyVelocity(e, i, px, py, t - lead, pos);
    dx += pos.x * lead;
    dy += pos.y * lead;
    if (dx * dx + dy * dy < 170 * 170) {
      near.push(i);
      nearVx.push(pos.x);
      nearVy.push(pos.y);
      nearX.push(ex[i]! + pos.x * lead);
      nearY.push(ey[i]! + pos.y * lead);
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
  if (plan?.goal) {
    gx = plan.goal.x - px;
    gy = plan.goal.y - py;
  }
  const gl = Math.sqrt(gx * gx + gy * gy) || 1;
  gx /= gl;
  gy /= gl;
  let bestScore = Infinity;
  let bestDanger = 0;
  let bx = 0;
  let by = 0;
  for (const [dx, dy] of opts.keys8 ? DIRS8 : DIRS) {
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
      // Untouchable then (a shield's cover): nothing there can hurt her.
      if (plan?.invuln !== undefined && t + k2 < plan.invuln) continue;
      for (let n = 0; n < near.length; n++) {
        const i = near[n]!;
        const def = ENEMIES[e.col("kind")[i]!]!;
        // Each enemy keeps doing what it does now (chasing, crossing, holding a post).
        const ox = nearX[n]! + nearVx[n]! * k2 - qx;
        const oy = nearY[n]! + nearVy[n]! * k2 - qy;
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
    const score = danger - (dx * gx + dy * gy) * (plan?.goal ? 6 : 3) + (dx === 0 && dy === 0 ? 0.5 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestDanger = danger;
      bx = dx;
      by = dy;
    }
  }
  if (plan) plan.danger = bestDanger;
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

/** One decision waiting to be executed (BotOptions.latency). */
export interface BotOrder {
  /** The steered tick it goes out on (BotInputs.clock). */
  due: number;
  move?: { x: number; y: number };
  focus?: boolean;
  card?: string;
}

/** The bot's last sent inputs (so only changes are queued), and with a latency what it has decided but not yet done. */
export interface BotInputs {
  move: { x: number; y: number };
  /** Steered ticks so far (botFlush counts them; overlays don't). */
  clock?: number;
  /** Decisions in the order they go out. */
  orders?: BotOrder[];
  /** The move and focus the queued orders leave her with (what the next decision builds on). */
  planned?: { move: { x: number; y: number }; focus: boolean };
  /** The clock tick each hand card was first seen (a card is read before it is played: CARD_READ). */
  seen?: Record<string, number>;
  /** The latest decision's look-ahead danger (botMove), for the guard cards. */
  danger?: number;
  /** A dive under way (botDive). */
  dive?: Dive | null;
  /** Until when (action time) a queued shield card keeps her untouchable. */
  shieldUntil?: number;
}

/**
 * A dive: the bot holds an area card (Fantasy Seal), walks toward the crowd
 * worth the most XP within reach, and plays the card once enough of that
 * crowd is inside its radius. With bullets thick around her or a crowd too
 * dense to approach, it raises a shield card first and charges in under its cover.
 */
interface Dive {
  card: string;
  x: number;
  y: number;
  /** The crowd's XP when chosen (the card goes once three quarters of it is in reach). */
  value: number;
  /** The clock tick it gives up by. */
  until: number;
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

/**
 * Where the player will be once every queued order has gone out: her position
 * carried forward tick by tick with the move in force (the sent one, then each
 * order's as it comes due). Ignores the arena wall and bumping into enemies,
 * as a person's estimate would.
 */
function plannedFrom(k: Game, path: RunPath, last: BotInputs, lead: number): { x: number; y: number } {
  const v = runView(k, path);
  const p = v.derived("player");
  const stats = v.derived("stats");
  let { x, y } = p.body;
  let m = last.move;
  let focus = p.ctrl.focus;
  const orders = last.orders ?? [];
  const clock = last.clock ?? 0;
  let o = 0;
  for (let i = 1; i <= lead; i++) {
    while (o < orders.length && orders[o]!.due <= clock + i) {
      const ord = orders[o++]!;
      if (ord.move) m = ord.move;
      if (ord.focus !== undefined) focus = ord.focus;
    }
    const len = Math.sqrt(m.x * m.x + m.y * m.y);
    if (!len) continue;
    const s = (PLAYER.speed * (focus ? 1 : stats.speed) * Math.min(1, len / 100)) / len;
    x += m.x * s;
    y += m.y * s;
  }
  return { x, y };
}

/**
 * A decision with a latency (BotOptions.latency): the move, focus and card the
 * bot wants, queued to go out `latency` steered ticks from now. The move is
 * planned from where the orders already queued will have taken her, against
 * where bullets and enemies will be by then. Call every `reaction` ticks;
 * botFlush sends what is due every tick.
 */
export function botThink(k: Game, path: RunPath, last: BotInputs, opts: BotOptions = {}, cards = true): void {
  const lead = opts.latency ?? 0;
  const clock = last.clock ?? 0;
  const orders = (last.orders ??= []);
  const v = runView(k, path);
  const planned = (last.planned ??= { move: { ...last.move }, focus: v.derived("player").ctrl.focus });
  const from = plannedFrom(k, path, last, lead);
  const tactic = cards ? botDive(k, path, last, from, lead) : null;
  const invuln = Math.max(v.derived("player").life.invulnUntil, last.shieldUntil ?? 0);
  const plan: BotPlan = { from, danger: 0, invuln, goal: last.dive ? { x: last.dive.x, y: last.dive.y } : undefined };
  const m = botMove(k, path, opts, plan);
  last.danger = plan.danger;
  const order: BotOrder = { due: clock + lead };
  if (m.x !== planned.move.x || m.y !== planned.move.y) order.move = planned.move = m;
  const on = opts.focus !== false && !last.dive && botFocus(k, path);
  if (on !== planned.focus) order.focus = planned.focus = on;
  if (cards) {
    const c = tactic ?? botCard(k, path, last);
    if (c) order.card = c;
  }
  if (order.move || order.focus !== undefined || order.card) orders.push(order);
}

/** The XP of the enemies within `r` of (x, y), and how many they are. */
function crowdAt(v: ReturnType<typeof runView>, x: number, y: number, r: number): { value: number; count: number } {
  const e = v.packed("enemies");
  let value = 0;
  let count = 0;
  for (let i = 0; i < e.count; i++) {
    if (e.col("phase")[i] === PHASE.leaving) continue;
    const dx = e.col("x")[i]! - x;
    const dy = e.col("y")[i]! - y;
    if (dx * dx + dy * dy < r * r) {
      value += ENEMIES[e.col("kind")[i]!]!.xp;
      count++;
    }
  }
  return { value, count };
}

/** The crowd worth the most XP within `r` of one of its members, among the enemies within `reach` of (x, y). */
function bestCrowd(v: ReturnType<typeof runView>, x: number, y: number, r: number, reach: number): { x: number; y: number; value: number; count: number } | null {
  const e = v.packed("enemies");
  let best: { x: number; y: number; value: number; count: number } | null = null;
  for (let i = 0; i < e.count; i++) {
    const cx = e.col("x")[i]!;
    const cy = e.col("y")[i]!;
    if ((cx - x) ** 2 + (cy - y) ** 2 > reach * reach) continue;
    const c = crowdAt(v, cx, cy, r);
    if (!best || c.value > best.value) best = { x: cx, y: cy, ...c };
  }
  return best;
}

/**
 * The dive tactic (Dive): starts, steers or ends one, and returns a card to
 * play with this decision (the shield going in, the area card at the crowd), or null.
 * Not in the boss fight (botCard plays the cards there).
 */
function botDive(k: Game, path: RunPath, last: BotInputs, from: { x: number; y: number }, lead: number): string | null {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const clock = last.clock ?? 0;
  if (run.overlay !== "none" || run.phase !== "swarm") {
    last.dive = null;
    return null;
  }
  const hand = handCards(v);
  const t = v.now("action");
  const queued = new Set((last.orders ?? []).flatMap((o) => (o.card ? [o.card] : [])));
  let spirit = spiritAt(v, t);
  for (const id of queued) spirit -= cardDef(v.req(id, "card").card.id).cost;
  const ready = (c: { id: string }): boolean => !queued.has(c.id) && clock - (last.seen?.[c.id] ?? clock) >= CARD_READ;

  const d = last.dive;
  if (d) {
    if (!hand.some((c) => c.id === d.card) || clock > d.until) {
      last.dive = null;
      return null;
    }
    const card = v.req(d.card, "card").card;
    const r = cardParams(cardDef(card.id), card.level).radius!;
    const here = crowdAt(v, from.x, from.y, r);
    if (here.value >= d.value * 0.75 || (clock >= d.until - 10 && here.count >= 4)) {
      last.dive = null;
      return cardDef(card.id).cost <= spirit + 1e-9 ? d.card : null;
    }
    // The crowd moves: follow its heart.
    const c = bestCrowd(v, d.x, d.y, r * 0.85, 120);
    if (c) Object.assign(d, { x: c.x, y: c.y, value: c.value });
    return null;
  }

  // A new dive: an area card ready, and a crowd worth it within reach.
  const seal = hand.find((c) => ready(c) && cardDef(v.req(c.id, "card").card.id).effect === "burst");
  if (!seal) return null;
  const sc = v.req(seal.id, "card").card;
  const sdef = cardDef(sc.id);
  if (sdef.cost > spirit + 1e-9) return null;
  const r = cardParams(sdef, sc.level).radius!;
  const full = spirit >= v.derived("stats").spiritMax - 0.05;
  const c = bestCrowd(v, from.x, from.y, r * 0.85, 380);
  if (!c || c.value < (full ? 10 : 20) || c.count < 5) return null;
  last.dive = { card: seal.id, x: c.x, y: c.y, value: c.value, until: clock + sec(3.5) };
  // Too hot to walk in: a shield first, if both cards can be paid for.
  let bullets = 0;
  const b = v.packed("bullets");
  const td = v.now("danmaku") + lead;
  for (let i = 0; i < b.count; i++) if (b.pos(i, td, pos) && (pos.x - from.x) ** 2 + (pos.y - from.y) ** 2 < 220 * 220) bullets++;
  if (bullets < 25 && c.count < 14) return null;
  for (const g of hand) {
    if (g.id === seal.id || !ready(g)) continue;
    const gc = v.req(g.id, "card").card;
    const gdef = cardDef(gc.id);
    if ((gdef.effect !== "clear" && gdef.effect !== "gap") || gdef.cost + sdef.cost > spirit + 1e-9) continue;
    last.shieldUntil = t + lead + sec(cardParams(gdef, gc.level).invuln!);
    // Under cover it has only the shield's time to get there.
    last.dive.until = Math.min(last.dive.until, clock + lead + sec(cardParams(gdef, gc.level).invuln!));
    return g.id;
  }
  return null;
}

/** Advances the bot's clock one steered tick and sends every order that is due (botThink). */
export function botFlush(k: Game, path: RunPath, last: BotInputs): void {
  const p = path as "/run:1";
  const clock = (last.clock = (last.clock ?? 0) + 1);
  const orders = last.orders ?? [];
  while (orders.length && orders[0]!.due <= clock) {
    const o = orders.shift()!;
    if (o.move && (o.move.x !== last.move.x || o.move.y !== last.move.y)) {
      k.queue(p, "move", o.move);
      last.move = o.move;
    }
    const v = runView(k, path);
    if (o.focus !== undefined && o.focus !== v.derived("player").ctrl.focus) k.queue(p, "focus", { on: o.focus });
    // A card still in hand and affordable goes out; one gone or unaffordable by now is dropped, like a fumbled key.
    if (o.card && handCards(v).some((c) => c.id === o.card)) {
      const cost = cardDef(v.req(o.card, "card").card.id).cost;
      if (spiritAt(v, v.now("action")) + 1e-9 >= cost && v.derived("state").run.overlay === "none") k.queue(p, "card:play", { card: o.card });
    }
  }
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

/** Guard cards: spent to survive a hit the dodge can't avoid (BotInputs.danger >= EMERGENCY). */
const GUARDS = new Set(["clear", "timeStop", "gap"]);

/**
 * A card to play now, or null: each playable card is valued for this moment
 * and the best one worth playing is taken.
 *  - Guards (Barrier, Time Stop, Gap Travel) when the best dodge still gets hit;
 *    otherwise their Spirit is kept in reserve unless the meter is full.
 *  - Fantasy Seal on a crowd (or the boss) inside its radius; Master Spark when
 *    the boss is in the beam; Power Charm and Vengeful Amulet in the boss
 *    fight; Healing Charm when none of its HP is wasted (or HP runs low);
 *    Graze Ribbon in thick bullets; Last Stand once, in the boss fight or when hurt.
 *  - With `last`: nothing drawn in the last second (CARD_READ), nothing already
 *    queued, and the guards read the latest decision's danger.
 */
export function botCard(k: Game, path: RunPath, last?: BotInputs): string | null {
  const v = runView(k, path);
  const run = v.derived("state").run;
  if (run.overlay !== "none" || run.phase === "over" || run.phase === "dialogue") return null;
  const p = v.derived("player");
  const stats = v.derived("stats");
  const t = v.now("action");
  const td = v.now("danmaku");
  const hand = handCards(v);
  const clock = last?.clock ?? 0;
  if (last) {
    const seen = (last.seen ??= {});
    for (const c of hand) seen[c.id] ??= clock;
    for (const id of Object.keys(seen)) if (!hand.some((c) => c.id === id)) delete seen[id];
  }
  const queued = new Set((last?.orders ?? []).flatMap((o) => (o.card ? [o.card] : [])));
  let spirit = spiritAt(v, t);
  for (const id of queued) spirit -= cardDef(v.req(id, "card").card.id).cost;
  const full = spirit >= stats.spiritMax - 0.05;
  const emergency = (last?.danger ?? 0) >= EMERGENCY;
  const px = p.body.x;
  const py = p.body.y;
  const hpFrac = p.life.hp / stats.maxHp;
  const has = (rule: string): boolean => v.has(p, "triggers") && p.triggers.some((x) => x.rule === rule);

  const e = v.packed("enemies");
  const within = (r: number): number => {
    let n = 0;
    for (let i = 0; i < e.count; i++) {
      const dx = e.col("x")[i]! - px;
      const dy = e.col("y")[i]! - py;
      if (dx * dx + dy * dy < r * r) n++;
    }
    return n;
  };
  const b = v.packed("bullets");
  const bulletsWithin = (r: number): number => {
    let n = 0;
    for (let i = 0; i < b.count; i++) {
      if (!b.pos(i, td, pos)) continue;
      const dx = pos.x - px;
      const dy = pos.y - py;
      if (dx * dx + dy * dy < r * r) n++;
    }
    return n;
  };
  const boss = run.phase === "boss" ? v.derived("boss") : undefined;
  let bdx = 0;
  let bdy = 0;
  let bd = Infinity;
  if (boss) {
    bossPos(boss, t, pos);
    bdx = pos.x - px;
    bdy = pos.y - py;
    bd = Math.sqrt(bdx * bdx + bdy * bdy);
  }
  // The cheapest guard in hand: its Spirit is held back for an emergency.
  let reserve = 0;
  for (const c of hand) {
    const def = cardDef(v.req(c.id, "card").card.id);
    if (GUARDS.has(def.effect) && !queued.has(c.id)) reserve = reserve ? Math.min(reserve, def.cost) : def.cost;
  }

  let best: string | null = null;
  let bestValue = 0;
  for (const c of hand) {
    if (queued.has(c.id) || c.id === last?.dive?.card) continue;
    if (last && clock - (last.seen?.[c.id] ?? clock) < CARD_READ) continue;
    const card = v.req(c.id, "card").card;
    const def = cardDef(card.id);
    if (def.cost > spirit + 1e-9) continue;
    const prm = cardParams(def, card.level);
    let value = 0;
    switch (def.effect) {
      case "clear":
        if (emergency) value = 100;
        break;
      case "timeStop":
        if (emergency && bulletsWithin(200) >= 20) value = 90;
        break;
      case "gap":
        if (emergency) value = 80;
        else if (!boss && full && v.packed("drops").count >= 60) value = 10;
        break;
      case "heal":
        if (hpFrac < 0.3) value = 70;
        else if (stats.maxHp - p.life.hp >= prm.hp!) value = 20 + (1 - hpFrac) * 40;
        break;
      case "burst": {
        const n = within(prm.radius!);
        if (n >= (full ? 4 : 8)) value = 10 + n;
        if (bd < prm.radius!) value = Math.max(value, 30);
        break;
      }
      case "spark": {
        // How far along and how far off the beam's line (her facing) the boss is.
        const along = bdx * p.body.fx + bdy * p.body.fy;
        const off = Math.abs(bdx * p.body.fy - bdy * p.body.fx);
        if (boss && along > 0 && along < prm.length! && off < prm.width! / 2) value = 60;
        break;
      }
      case "empower":
        if (boss && bd < 360 && !v.has(p, "empowered")) value = 35;
        break;
      case "vengeance":
        if (boss && !has("vengeance")) value = 25;
        break;
      case "grazeHeal":
        if (!has("grazeHeal") && bulletsWithin(120) >= 15) value = 25;
        break;
      case "lastStand":
        if (!has("lastStand") && (boss || hpFrac < 0.5)) value = 40;
        break;
      default:
        if (boss || full) value = 5;
    }
    // A guard's Spirit is kept unless the meter is full or this is worth it.
    if (value > 0 && value < 60 && !GUARDS.has(def.effect) && reserve && !full && spirit - def.cost < reserve) continue;
    if (value > bestValue) {
      bestValue = value;
      best = c.id;
    }
  }
  return best;
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
      if (opts.latency) {
        botFlush(k, path, last);
        if (i % (opts.reaction ?? 1) === 0) botThink(k, path, last, opts, opts.cards !== false);
      } else {
        if (i % (opts.reaction ?? 1) === 0) botSteer(k, path, last, opts);
        if (opts.cards !== false && i % 20 === 0) {
          const c = botCard(k, path);
          if (c) k.queue(p, "card:play", { card: c });
        }
      }
    }
    if (activeRun(k) !== path) break;
    k.tick(p, "fixed");
    opts.onTick?.(i);
  }
  return { ticks: i, path };
}
