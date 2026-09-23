// Stages: the swarm timeline (waves and set pieces) and the boss that ends it.
// Times are in seconds of run time; the director (src/sim/director.ts) reads
// these rows, so a new stage is a new row.

import { PLACES } from "./names.ts";

export interface WaveDef {
  /** Active from..to seconds. */
  from: number;
  to: number;
  /** Ticks between spawn groups, and enemies per group. */
  every: number;
  count: number;
  /** No spawns while this many enemies are alive. */
  cap: number;
  /** Enemy id to relative weight. */
  kinds: Readonly<Record<string, number>>;
}

export type SetPiece =
  | { at: number; kind: "ring"; enemy: string; n: number; radius: number; banner?: string }
  | { at: number; kind: "elite"; enemy: string; n: number; banner?: string }
  | { at: number; kind: "rush"; enemy: string; n: number; banner?: string };

export interface StageDef {
  id: string;
  name: string;
  blurb: string;
  /** Seconds until the boss appears (the swarm thins out first). */
  bossAt: number;
  boss: string;
  /** Dialogue script played before the boss (dialogue.ts). */
  dialogue: string;
  waves: readonly WaveDef[];
  setPieces: readonly SetPiece[];
  /** While the boss is up the director keeps a thin trickle going. */
  bossWave: WaveDef;
  /** Enemy HP grows by this fraction per minute of run time. */
  hpPerMinute: number;
  /** Donations for clearing the stage. */
  clearBonus: number;
  /** Background colours for the renderer. */
  ground: number;
  grid: number;
}

export const STAGES: readonly StageDef[] = [
  {
    id: "lake",
    name: PLACES.lake,
    blurb: "Fog, fairies, and an ice fairy who thinks she is the strongest.",
    bossAt: 240,
    boss: "cirno",
    dialogue: "cirno-pre",
    clearBonus: 150,
    hpPerMinute: 0.6,
    ground: 0x1d2b3a,
    grid: 0x2a3d52,
    waves: [
      { from: 0, to: 25, every: 35, count: 6, cap: 75, kinds: { kedama: 1 } },
      { from: 25, to: 55, every: 28, count: 8, cap: 150, kinds: { kedama: 3, fairy: 2 } },
      { from: 55, to: 90, every: 23, count: 10, cap: 275, kinds: { kedama: 3, fairy: 3, sunflower: 1 } },
      { from: 90, to: 130, every: 21, count: 12, cap: 425, kinds: { fairy: 3, phantom: 2, sunflower: 1, kedama: 2 } },
      { from: 130, to: 170, every: 18, count: 14, cap: 600, kinds: { fairy: 2, phantom: 3, sunflower: 2, yinyang: 1 } },
      { from: 170, to: 205, every: 15, count: 16, cap: 800, kinds: { phantom: 3, sunflower: 2, yinyang: 1, kedama: 3 } },
      { from: 205, to: 232, every: 12, count: 18, cap: 1000, kinds: { phantom: 3, fairy: 3, yinyang: 2, sunflower: 2 } },
    ],
    setPieces: [
      { at: 45, kind: "ring", enemy: "kedama", n: 28, radius: 520, banner: "Surrounded!" },
      { at: 100, kind: "rush", enemy: "phantom", n: 26, banner: "Phantoms incoming" },
      { at: 150, kind: "elite", enemy: "bigfairy", n: 1, banner: "A Great Fairy appears" },
      { at: 190, kind: "ring", enemy: "fairy", n: 40, radius: 560, banner: "Surrounded!" },
      { at: 215, kind: "elite", enemy: "bigfairy", n: 2, banner: "Great Fairies appear" },
    ],
    bossWave: { from: 0, to: 1e9, every: 70, count: 3, cap: 40, kinds: { kedama: 3, fairy: 1 } },
  },
];

export const STAGE_BY_ID: Readonly<Record<string, StageDef>> = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export function stageDef(id: string): StageDef {
  const s = STAGE_BY_ID[id];
  if (!s) throw new Error(`unknown stage "${id}"; stages: ${STAGES.map((x) => x.id).join(", ")}`);
  return s;
}
