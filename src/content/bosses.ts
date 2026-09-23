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
  /** Contact damage. */
  dmg: number;
  spells: readonly SpellDef[];
}

export const BOSSES: readonly BossDef[] = [
  {
    id: "cirno",
    character: "cirno",
    radius: 22,
    dmg: 15,
    spells: [
      {
        name: "Ice Sign “Icicle Fall”",
        hp: 2400,
        time: 40,
        move: "sway",
        bonus: 60,
        emitters: [
          { pattern: "rain", every: 5, params: { n: 1, speedMin: 1.6, speedMax: 2.6, width: 320, height: 330, drift: 0, style: "ice" } },
          { pattern: "aimed", every: 70, params: { n: 5, spread: 0.7, speed: 2.4, style: "big" } },
        ],
      },
      {
        name: "Freeze Sign “Perfect Freeze”",
        hp: 3000,
        time: 45,
        move: "wander",
        bonus: 80,
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
        hp: 3600,
        time: 50,
        move: "still",
        bonus: 100,
        emitters: [
          { pattern: "burst", every: 5, params: { n: 3, speedMin: 1.4, speedMax: 3.6, style: "ice" } },
          { pattern: "ring", every: 80, params: { n: 20, speed: 1.6, accel: 0.02, vEnd: 3, spin: 0.2, style: "star" } },
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
