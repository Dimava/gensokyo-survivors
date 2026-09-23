// Enemy kinds. The swarm stores the row index in its `kind` column, so adding
// an enemy is adding a row here (and naming it in a wave of stages.ts).

import type { EmitterDef } from "./patterns.ts";

export type EnemyShape = "fuzz" | "fairy" | "flower" | "ghost" | "orb" | "bigfairy";

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
  /** Enemies that shoot: a bullet emitter aimed from the enemy (see patterns.ts). */
  shoots?: EmitterDef;
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
    xp: 1,
    coin: 0.01,
    heart: 0.002,
    color: 0xf3e6ff,
    shape: "fuzz",
  },
  {
    id: "fairy",
    name: "Lake Fairy",
    blurb: "A mischievous fairy of the Misty Lake.",
    hp: 16,
    speed: 0.95,
    dmg: 7,
    radius: 12,
    xp: 2,
    coin: 0.02,
    heart: 0.003,
    color: 0x6fb6ff,
    shape: "fairy",
  },
  {
    id: "phantom",
    name: "Phantom",
    blurb: "A fast, drifting spirit.",
    hp: 22,
    speed: 1.55,
    dmg: 8,
    radius: 11,
    xp: 3,
    coin: 0.03,
    heart: 0.004,
    color: 0xb9fff4,
    shape: "ghost",
  },
  {
    id: "sunflower",
    name: "Sunflower Fairy",
    blurb: "Sturdy, and fires aimed shots you can graze.",
    hp: 45,
    speed: 0.7,
    dmg: 10,
    radius: 15,
    xp: 5,
    coin: 0.06,
    heart: 0.01,
    color: 0xffd23f,
    shape: "flower",
    shoots: { pattern: "aimed", every: 200, params: { n: 3, spread: 0.5, speed: 2.2, style: "rice" } },
  },
  {
    id: "yinyang",
    name: "Evil Spirit Orb",
    blurb: "Slow and heavy; releases rings of bullets.",
    hp: 140,
    speed: 0.6,
    dmg: 14,
    radius: 20,
    xp: 12,
    coin: 0.25,
    heart: 0.03,
    color: 0xd04a6a,
    shape: "orb",
    heavy: 0.6,
    shoots: { pattern: "ring", every: 240, params: { n: 12, speed: 1.7, style: "orb", spin: 0.13 } },
  },
  {
    id: "bigfairy",
    name: "Great Fairy",
    blurb: "An elite. Drops a heart and a purse of donations.",
    hp: 420,
    speed: 0.8,
    dmg: 16,
    radius: 24,
    xp: 40,
    coin: 1,
    heart: 1,
    color: 0x7bd88f,
    shape: "bigfairy",
    heavy: 0.85,
    shoots: { pattern: "spiral", every: 30, params: { arms: 3, speed: 1.9, step: 0.35, style: "star" } },
  },
];

export const ENEMY_INDEX: Readonly<Record<string, number>> = Object.fromEntries(ENEMIES.map((e, i) => [e.id, i]));

export function enemyIndex(id: string): number {
  const i = ENEMY_INDEX[id];
  if (i === undefined) throw new Error(`unknown enemy "${id}"; enemies: ${ENEMIES.map((e) => e.id).join(", ")}`);
  return i;
}
