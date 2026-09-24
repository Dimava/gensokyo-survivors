// Enemy kinds. The swarm stores the row index in its `kind` column, so adding
// an enemy is adding a row here (and naming it in a beat or wave of stages.ts).
// Each kind has a job (`move`): only fuzzballs chase; fairies fly in, fire and
// leave, the way stage enemies do in Touhou.

import type { EmitterDef } from "./patterns.ts";

export type EnemyShape = "fuzz" | "fairy" | "flower" | "ghost" | "orb" | "bigfairy";

/**
 * How an enemy moves. Times are ticks; `speed` on the row sets the pace.
 * - chase: walks at the player forever (the survivors filler).
 * - cross: flies straight along the heading its formation gave it, firing, and leaves the field.
 * - snipe: flies to a post near the player, stops and fires for `hold` ticks, then leaves.
 * - orbit: circles the player, closing in by `inward` px per tick down to `min`, for `life` ticks, then leaves.
 * - hover: a midboss; keeps station above the player for `stay` ticks, then retreats if still alive.
 */
export type EnemyMove =
  | { kind: "chase" }
  | { kind: "cross" }
  | { kind: "snipe"; hold: number }
  | { kind: "orbit"; inward: number; min: number; life: number }
  | { kind: "hover"; stay: number };

export interface EnemyDef {
  id: string;
  name: string;
  /** What the player reads in the codex line of How to Play. */
  blurb: string;
  hp: number;
  /** Pixels per tick at 60 ticks per second. */
  speed: number;
  /** Contact damage. */
  dmg: number;
  radius: number;
  /** Experience value of the gem it drops. */
  xp: number;
  /** Chance of also dropping a donation coin, and of a heart. */
  coin: number;
  heart: number;
  color: number;
  shape: EnemyShape;
  /** One character for the test renderer's ASCII field. */
  glyph: string;
  move: EnemyMove;
  /** Enemies that shoot: bullet emitters fired from the enemy in turn, one per volley (see patterns.ts). */
  shoots?: readonly EmitterDef[];
  /**
   * Fire in salvos: `volleys` volleys (spaced by each emitter's `every`), then
   * `rest` ticks of silence. Without it the emitters fire back to back.
   */
  salvo?: { volleys: number; rest: number };
  /** A midboss: its defeat turns every bullet into points, and the stage waits for it. Its HP does not grow with run time. */
  midboss?: boolean;
  /** Knockback resistance 0..1 (bosses and elites shrug hits off). */
  heavy?: number;
}

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: "kedama",
    name: "Kedama",
    blurb: "A fuzzball. Weak, but never alone.",
    hp: 7,
    speed: 1.05,
    dmg: 5,
    radius: 10,
    xp: 2,
    coin: 0.01,
    heart: 0.002,
    color: 0xf3e6ff,
    shape: "fuzz",
    glyph: "k",
    move: { kind: "chase" },
  },
  {
    id: "fairy",
    name: "Lake Fairy",
    blurb: "Flies across in lines and streams, firing at you as it passes.",
    hp: 16,
    speed: 1.9,
    dmg: 7,
    radius: 12,
    xp: 3,
    coin: 0.02,
    heart: 0.003,
    color: 0x6fb6ff,
    shape: "fairy",
    glyph: "f",
    move: { kind: "cross" },
    shoots: [{ pattern: "aimed", every: 16, params: { n: 3, spread: 0.3, speed: 2.6, style: "rice" } }],
    salvo: { volleys: 2, rest: 450 },
  },
  {
    id: "icefairy",
    name: "Ice Fairy",
    blurb: "Cirno's rowdier friends: faster, tougher, and they fire three icicles at once.",
    hp: 26,
    speed: 2.1,
    dmg: 8,
    radius: 12,
    xp: 4,
    coin: 0.03,
    heart: 0.004,
    color: 0x9fe8ff,
    shape: "fairy",
    glyph: "i",
    move: { kind: "cross" },
    shoots: [{ pattern: "aimed", every: 18, params: { n: 3, spread: 0.35, speed: 2.3, style: "ice" } }],
    salvo: { volleys: 2, rest: 450 },
  },
  {
    id: "phantom",
    name: "Phantom",
    blurb: "Circles you in a ring that slowly closes, shedding little rings of bullets, then drifts away.",
    hp: 22,
    speed: 1.55,
    dmg: 8,
    radius: 11,
    xp: 4,
    coin: 0.03,
    heart: 0.004,
    color: 0xb9fff4,
    shape: "ghost",
    glyph: "p",
    move: { kind: "orbit", inward: 0.9, min: 150, life: 720 },
    shoots: [{ pattern: "ring", every: 16, params: { n: 5, speed: 1.4, style: "orb", spin: 0.6 } }],
    salvo: { volleys: 2, rest: 300 },
  },
  {
    id: "sunflower",
    name: "Sunflower Fairy",
    blurb: "Takes up a post near you, fires aimed fans, then leaves. Kill it before it goes.",
    hp: 45,
    speed: 1.7,
    dmg: 10,
    radius: 15,
    xp: 6,
    coin: 0.06,
    heart: 0.01,
    color: 0xffd23f,
    shape: "flower",
    glyph: "s",
    move: { kind: "snipe", hold: 300 },
    shoots: [{ pattern: "aimed", every: 14, params: { n: 3, spread: 0.7, speed: 2.1, style: "rice" } }],
    salvo: { volleys: 2, rest: 240 },
  },
  {
    id: "yinyang",
    name: "Evil Spirit Orb",
    blurb: "Slow and heavy; drifts across, releasing rings of bullets.",
    hp: 140,
    speed: 0.8,
    dmg: 14,
    radius: 20,
    xp: 10,
    coin: 0.25,
    heart: 0.03,
    color: 0xd04a6a,
    shape: "orb",
    glyph: "Y",
    heavy: 0.6,
    move: { kind: "cross" },
    shoots: [{ pattern: "ring", every: 240, params: { n: 8, speed: 1.6, style: "orb", spin: 0.2 } }],
  },
  {
    id: "shade",
    name: "Dusk Shade",
    blurb: "A scrap of Rumia's darkness; it slips in, fires short fans, and slips away.",
    hp: 30,
    speed: 1.6,
    dmg: 9,
    radius: 13,
    xp: 4,
    coin: 0.04,
    heart: 0.004,
    color: 0x5a3d8a,
    shape: "ghost",
    glyph: "d",
    move: { kind: "snipe", hold: 200 },
    shoots: [{ pattern: "aimed", every: 16, params: { n: 5, spread: 0.9, speed: 1.9, style: "star" } }],
    salvo: { volleys: 2, rest: 200 },
  },
  {
    id: "bigfairy",
    name: "Great Fairy",
    blurb: "An elite. Hovers and spins out stars for a while, then leaves; kill it first for a heart and a purse of donations.",
    hp: 420,
    speed: 1.4,
    dmg: 16,
    radius: 24,
    xp: 30,
    coin: 1,
    heart: 1,
    color: 0x7bd88f,
    shape: "bigfairy",
    glyph: "F",
    heavy: 0.85,
    move: { kind: "snipe", hold: 720 },
    shoots: [{ pattern: "spiral", every: 8, params: { arms: 3, speed: 1.9, step: 0.35, style: "star" } }],
    salvo: { volleys: 12, rest: 200 },
  },
  {
    id: "daiyousei",
    name: "Daiyousei",
    blurb: "The lake's midboss. Stays above you for half a minute; defeat her and every bullet turns into points.",
    hp: 600,
    speed: 2,
    dmg: 16,
    radius: 26,
    xp: 60,
    coin: 1,
    heart: 1,
    color: 0x7bd88f,
    shape: "bigfairy",
    glyph: "M",
    heavy: 1,
    move: { kind: "hover", stay: 1500 },
    midboss: true,
    shoots: [
      { pattern: "ring", every: 70, params: { n: 18, speed: 1.7, style: "rice", spin: 0.17 } },
      { pattern: "aimed", every: 55, params: { n: 7, spread: 1.1, speed: 2.4, style: "star" } },
      { pattern: "ring", every: 70, params: { n: 18, speed: 1.5, style: "orb", spin: -0.17 } },
      { pattern: "aimed", every: 90, params: { n: 7, spread: 1.1, speed: 2.4, style: "star" } },
    ],
  },
  {
    id: "duskfairy",
    name: "Great Dusk Fairy",
    blurb: "The forest's midboss, grown fat on Rumia's darkness. Defeat her and every bullet turns into points.",
    hp: 950,
    speed: 2,
    dmg: 18,
    radius: 26,
    xp: 80,
    coin: 1,
    heart: 1,
    color: 0x7a55c0,
    shape: "bigfairy",
    glyph: "M",
    heavy: 1,
    move: { kind: "hover", stay: 1500 },
    midboss: true,
    shoots: [
      { pattern: "spiral", every: 12, params: { arms: 4, speed: 1.8, step: 0.21, style: "star" } },
      { pattern: "spiral", every: 12, params: { arms: 4, speed: 1.8, step: 0.21, style: "star" } },
      { pattern: "spiral", every: 12, params: { arms: 4, speed: 1.8, step: 0.21, style: "star" } },
      { pattern: "spiral", every: 12, params: { arms: 4, speed: 1.8, step: 0.21, style: "star" } },
      { pattern: "aimed", every: 70, params: { n: 9, spread: 1.4, speed: 2.2, style: "orb" } },
    ],
  },
];

export const ENEMY_INDEX: Readonly<Record<string, number>> = Object.fromEntries(ENEMIES.map((e, i) => [e.id, i]));

export function enemyIndex(id: string): number {
  const i = ENEMY_INDEX[id];
  if (i === undefined) throw new Error(`unknown enemy "${id}"; enemies: ${ENEMIES.map((e) => e.id).join(", ")}`);
  return i;
}
