// The run: one survivors stage, from the first fuzzball to the boss's last
// spell card. A logged child scope of the meta scope, opened per run at
// `/run:<n>` (the key reseeds its rng streams). Bulk data lives in packed
// stores (enemies, drops, shots, bullets); the player, weapons, passives,
// cards and the boss are entities.
//
// Clocks: `fixed` is the 60 Hz driver; `game` pauses under overlays (level-up,
// dialogue) and after the run ends; `action` is a child of `game` that
// hitstop pauses; `danmaku` is a child of `action` that the time-stop card
// pauses, so frozen bullets hang in the air while everything else moves.

import { z } from "zod";
import { columns, defineScope, event, input, ref, relation, type SpecOf } from "gamebones";
import { STAT_KEYS, baseStats, type StatKey, type Stats } from "../content/stats.ts";
import { passiveDef } from "../content/passives.ts";
import { BulletStore } from "./bullets.ts";
import { BOSS, CAP } from "./tuning.ts";
import { LevelUp } from "./levelup.ts";
import { Vn } from "./vn.ts";
import { directorProcess } from "./director.ts";
import { ENEMY_FIELDS } from "./swarm.ts";
import { spellProcess } from "./boss.ts";

import { OUTCOMES, PHASES, DeckEntry } from "./schemas.ts";
export { OUTCOMES, PHASES, OfferChoice, RunSummary } from "./schemas.ts";
export type { Outcome, Phase } from "./schemas.ts";

const num = z.number();
const int = z.int();
const nums = z.array(z.number());

const RunDecl = defineScope("run", {
  components: {
    run: z.strictObject({
      stage: z.string(),
      phase: z.enum(PHASES),
      outcome: z.enum(OUTCOMES),
      overlay: z.enum(["none", "levelup", "vn"]),
      /** Boss arena centre (valid while `arena`). */
      arena: z.boolean(),
      ax: num,
      ay: num,
      /** Next stable enemy uid (swap-remove moves rows; uids stay). */
      nextUid: int,
      /** Action tick the run ended (0 while running). */
      endedAt: int,
    }),
    body: z.strictObject({ x: num, y: num, fx: num, fy: num }),
    /**
     * The last `move` and `focus` inputs: the move vector (-100..100) and whether focus (Shift) is held.
     * Focus eases in and out (weapons.ts `focusAmount`): the action tick it last changed and how far in it was then (0..1).
     */
    ctrl: z.strictObject({ mx: int, my: int, focus: z.boolean(), focusAt: int, focusFrom: num }),
    life: z.strictObject({ hp: num, invulnUntil: int, revivesUsed: int, hits: int }),
    progress: z.strictObject({
      level: int,
      xp: num,
      pending: int,
      kills: int,
      grazes: int,
      cardsPlayed: int,
      spellsCaptured: int,
      rerollsUsed: int,
      coinDrops: num,
      coinSpells: num,
      /** Action tick the boss fight began (0 before it): the swarm and the boss pay by the second at different rates. */
      bossFrom: int,
    }),
    /** Computable Spirit: value(t) = min(max, base + rate * (t - t0)); rate and max come from stats. */
    spirit: z.strictObject({ base: num, t0: int }),
    meter: z.strictObject({ graze: num }),
    loadout: z.strictObject({ bonuses: z.record(z.string(), num), unlocked: z.array(z.string()) }),
    weapon: z.strictObject({ id: z.string(), level: int, readyAt: int, armed: num }),
    passive: z.strictObject({ id: z.string(), level: int }),
    empowered: z.strictObject({ pct: num, until: int, pid: z.string() }),
    timestop: z.strictObject({ until: int, pid: z.string() }),
    /** Card-granted statuses whose expiry is scheduled: rule name -> pending `after` pid. */
    timed: z.strictObject({ pids: z.record(z.string(), z.string()) }),
    hitstop: z.strictObject({ pid: z.string() }),
    boss: z.strictObject({
      id: z.string(),
      spell: int,
      hp: num,
      max: num,
      spellStart: int,
      spellEnd: int,
      invulnUntil: int,
      pid: z.string(),
      hitsAtStart: int,
      /** Last tick an orbiting orb hit the boss. */
      orbAt: int,
      /** Movement: from (x0, y0) at t0 to (x1, y1) at t1, eased; sway adds a sine on top. */
      x0: num,
      y0: num,
      x1: num,
      y1: num,
      t0: int,
      t1: int,
      sway: z.boolean(),
      /** The spell card's bonus timer ran out; breaking it now gives no bonus. */
      late: z.boolean(),
      results: z.array(z.enum(["captured", "broken", "timeout"])),
    }),
    card: z.strictObject({ id: z.string(), level: int, effect: z.string() }),
    pile: z.strictObject({ kind: z.enum(["deck", "hand", "discard"]) }),
  },
  relations: { inPile: relation("in", { ordered: "at" }) },
  events: {
    // Input from the player (queued between ticks by the adapter).
    move: input({ x: int.min(-100).max(100), y: int.min(-100).max(100) }),
    /** Focus (Shift) pressed or released: sent only on change. It narrows the weapons (weapons.ts); slow movement is the shorter `move` vector. */
    focus: input({ on: z.boolean() }),
    "card:play": input({ card: ref() }, { subject: "card" }),

    // From the meta scope.
    "run:begin": event({ stage: z.string(), bonuses: z.record(z.string(), num), unlocked: z.array(z.string()), deck: z.array(DeckEntry) }),
    "run:forfeit": event(),

    // Combat.
    "weapon:fire": event({ weapon: ref(), dmg: num }, { subject: "weapon" }),
    "enemies:died": event({ xs: nums, ys: nums, kinds: z.array(int), xp: nums }),
    "swarm:struck": event({ n: int, xs: nums, ys: nums }),
    blast: event({ x: num, y: num, radius: num, dmg: num, source: z.string() }),
    beam: event({ x: num, y: num, dx: num, dy: num, length: num, width: num, dmg: num, color: int, source: z.string() }),
    aura: event({ x: num, y: num, radius: num, color: int }),
    "player:hurt": event({ player: ref(), dmg: num, cause: z.enum(["enemy", "bullet", "boss"]) }, { subject: "player" }),
    "player:downed": event({ player: ref() }, { subject: "player" }),
    "player:revived": event({ player: ref() }),
    graze: event({ player: ref(), n: int, x: num, y: num }, { subject: "player" }),
    "bullets:erase": event({ x: num, y: num, radius: num, gems: z.boolean() }),
    "drops:collected": event({ xp: num, coins: num, hearts: int, n: int }),
    "drops:pullAll": event(),
    "hitstop:start": event({ ticks: int }),
    "hitstop:end": event(),

    // Progression.
    "level:up": event(),
    "levelup:picked": event({ index: int }),
    "levelup:reroll": event(),

    // Cards.
    "card:draw": event(),
    "card:drawn": event({ card: ref() }),
    "card:played": event({ card: ref(), x: num, y: num, fx: num, fy: num }, { subject: "card" }),
    "status:expire": event({ status: z.string() }),
    "timestop:end": event(),

    // Stage and boss.
    banner: event({ text: z.string(), tone: z.enum(["info", "warn", "boss", "good"]) }),
    "boss:approach": event(),
    "boss:dialogue": event(),
    "vn:closed": event(),
    "boss:hit": event({ dmg: num }),
    "spell:start": event({ index: int }),
    "spell:late": event({ index: int }),
    "spell:break": event({ index: int, timeout: z.boolean() }),
    "boss:defeated": event(),
    "run:over": event({ outcome: z.enum(OUTCOMES) }),
    "run:finish": event(),
  },
  clocks: {
    fixed: { driver: true },
    game: { parent: "fixed" },
    action: { parent: "game" },
    danmaku: { parent: "action" },
  },
  rng: ["spawn", "loot", "levelup", "deck", "boss", "weapons"],
  packed: {
    enemies: () =>
      columns({ fields: ENEMY_FIELDS, capacity: CAP.enemies }),
    drops: () => columns({ fields: ["x", "y", "kind", "value", "pulled", "check", "spd"], capacity: CAP.drops }),
    shots: () =>
      columns({
        fields: ["x0", "y0", "vx", "vy", "t0", "dieAt", "dmg", "pierce", "radius", "weapon", "knock", "lastUid"],
        capacity: CAP.shots,
      }),
    bullets: () => new BulletStore(CAP.bullets),
  },
  children: { levelup: LevelUp, vn: Vn },
}).derive({
  state: (v) => v.q("run")[0]!,
  player: (v) => v.q("body", "life", "progress", "spirit", "meter", "ctrl")[0]!,
  loadout: (v) => v.q("loadout")[0]!.loadout,
  /** Final stats: base, plus shrine bonuses from the loadout, plus passives picked this run. */
  stats: (v): Stats => upgradedStats(v.q("loadout")[0]?.loadout.bonuses ?? {}, v.q("passive"), 1),
  /** The stats as they count against a boss: each upgrade at its boss share (BOSS.upgradeShare). */
  bossStats: (v): Stats => upgradedStats(v.q("loadout")[0]?.loadout.bonuses ?? {}, v.q("passive"), BOSS.upgradeShare),
  piles: (v) => {
    const out = { deck: "", hand: "", discard: "" };
    for (const p of v.q("pile")) out[p.pile.kind] = p.id;
    return out;
  },
  boss: (v) => v.q("boss")[0],
  weapons: (v) => v.q("weapon"),
  passives: (v) => v.q("passive"),
});

export type RS0 = SpecOf<typeof RunDecl>;

/** Base stats plus shrine bonuses and passives, each upgrade scaled by `share` (a passive's own bossMulti wins when share < 1). */
function upgradedStats(bonuses: Partial<Record<StatKey, number>>, passives: readonly { passive: { id: string; level: number } }[], share: number): Stats {
  const s = baseStats();
  for (const k of STAT_KEYS) s[k] += (bonuses[k] ?? 0) * share;
  for (const p of passives) {
    const def = passiveDef(p.passive.id);
    s[def.stat] += def.per * p.passive.level * (share < 1 ? (def.bossMulti ?? share) : 1);
  }
  s.cooldown = Math.max(0.35, s.cooldown);
  return s;
}

const RunBase = RunDecl.processes((process) => ({
  director: directorProcess(process),
  spell: spellProcess(process),
}));

export type RS = SpecOf<typeof RunBase>;
export { RunBase };
