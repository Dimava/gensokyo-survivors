// Bosses and their spell cards. Each spell card runs as a process that fires
// its emitters (content/patterns.ts) on a schedule until its HP is gone or its
// timer runs out.

import { CHARACTERS, type CharacterId } from "./names.ts";
import type { EmitterDef } from "./patterns.ts";

export interface SpellDef {
  name: string;
  /** HP of this spell card's bar. */
  hp: number;
  /** Seconds before the spell times out (it ends without a capture bonus). */
  time: number;
  emitters: readonly EmitterDef[];
  /** How the boss moves during the card. */
  move: "still" | "wander" | "sway";
  /** Donations for breaking it with damage before the timer. */
  bonus: number;
}

export interface BossDef {
  id: string;
  character: CharacterId;
  radius: number;
  /** Contact damage, and what one of her bullets does. */
  dmg: number;
  bulletDmg: number;
  spells: readonly SpellDef[];
}

export const BOSSES: readonly BossDef[] = [
  {
    id: "cirno",
    character: "cirno",
    radius: 22,
    dmg: 15,
    bulletDmg: 18,
    spells: [
      {
        name: "Ice Sign “Icicle Fall”",
        hp: 1000,
        time: 40,
        move: "sway",
        bonus: 30,
        emitters: [
          { pattern: "rain", every: 4, params: { n: 2, speedMin: 1.7, speedMax: 2.8, width: 320, height: 330, drift: 0, style: "ice" } },
          { pattern: "aimed", every: 55, params: { n: 5, spread: 0.6, speed: 2.6, style: "big" } },
        ],
      },
      {
        name: "Freeze Sign “Perfect Freeze”",
        hp: 1200,
        time: 45,
        move: "wander",
        bonus: 40,
        emitters: [
          {
            pattern: "freeze",
            every: 170,
            params: { n: 56, speedMin: 1.4, speedMax: 3.4, stopAt: 70, turnAt: 125, v2: 1.3, style: "orb", frozenStyle: "frozen" },
          },
          { pattern: "aimed", every: 45, offset: 90, params: { n: 3, spread: 0.35, speed: 3, style: "ice" } },
        ],
      },
      {
        name: "Snow Sign “Diamond Blizzard”",
        hp: 1400,
        time: 50,
        move: "still",
        bonus: 50,
        emitters: [
          { pattern: "burst", every: 4, params: { n: 3, speedMin: 1.4, speedMax: 3.6, style: "ice" } },
          { pattern: "ring", every: 80, params: { n: 20, speed: 1.6, accel: 0.02, vEnd: 3, spin: 0.2, style: "star" } },
        ],
      },
    ],
  },
  {
    id: "rumia",
    character: "rumia",
    radius: 22,
    dmg: 20,
    bulletDmg: 26,
    spells: [
      {
        name: "Night Sign “Night Bird”",
        hp: 2450,
        time: 40,
        move: "sway",
        bonus: 40,
        emitters: [
          { pattern: "spiral", every: 6, params: { arms: 4, step: 0.21, speed: 2.1, style: "orb" } },
          { pattern: "aimed", every: 60, params: { n: 7, spread: 0.9, speed: 2.8, style: "rice" } },
        ],
      },
      {
        name: "Darkness Sign “Demarcation”",
        hp: 2900,
        time: 45,
        move: "wander",
        bonus: 55,
        emitters: [
          { pattern: "ring", every: 40, params: { n: 28, speed: 0.6, accel: 0.03, vEnd: 3.2, spin: 0.11, aim: true, style: "big" } },
          { pattern: "freeze", every: 200, offset: 100, params: { n: 40, speedMin: 1.6, speedMax: 3, stopAt: 60, turnAt: 110, v2: 1.6, style: "star", frozenStyle: "frozen" } },
        ],
      },
      {
        name: "Moon Sign “Moonlight Ray”",
        hp: 3300,
        time: 50,
        move: "still",
        bonus: 70,
        emitters: [
          { pattern: "burst", every: 3, params: { n: 3, speedMin: 1.3, speedMax: 3.4, style: "orb" } },
          { pattern: "aimed", every: 45, params: { n: 3, spread: 0.25, speed: 3.4, style: "big" } },
        ],
      },
    ],
  },
];

export const BOSS_BY_ID: Readonly<Record<string, BossDef>> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

export function bossDef(id: string): BossDef {
  const b = BOSS_BY_ID[id];
  if (!b) throw new Error(`unknown boss "${id}"; bosses: ${BOSSES.map((x) => x.id).join(", ")}`);
  return b;
}

export function bossName(def: BossDef): string {
  return CHARACTERS[def.character].name;
}
