// Stages: a script of formations (fairies that fly in, fire and leave), a
// thin background of chasers, a midboss, and the boss that ends it. Times are
// seconds of script time; the director (src/sim/director.ts) reads these
// rows, so a new stage is a new row.

import { PLACES } from "./names.ts";
import { ENEMIES, enemyIndex, type EnemyMove } from "./enemies.ts";

export interface WaveDef {
  /** Active from..to seconds. */
  from: number;
  to: number;
  /** Ticks between spawn groups, and enemies per group. */
  every: number;
  count: number;
  /** No spawns while this many chasers are alive. */
  cap: number;
  /** Enemy id to relative weight. */
  kinds: Readonly<Record<string, number>>;
}

/** Which edge of the view a formation enters from. */
export type Side = "left" | "right" | "top" | "bottom";

/**
 * One beat of a stage's script: a formation that enters at `at` seconds of
 * script time (the script clock stops while a midboss is up).
 * - line: n crossers abreast, sweeping across the field.
 * - vee: n crossers in a V, point first.
 * - stream: n crossers nose to tail, passing `lane` px to one side of the player.
 * - posts: n snipers fly to posts on an arc on that side of the player, fire, and leave.
 * - circle: n orbiters in a ring around the player that closes, then breaks up.
 * - ring: n chasers in a ring at `radius` that walks in.
 * - rush: a clump of n chasers from one side.
 * - midboss: the stage's midboss; the script waits until she is defeated or leaves.
 */
export type Beat = { at: number; enemy: string; banner?: string } & (
  | { form: "line" | "vee" | "stream"; n: number; side: Side; lane?: number }
  | { form: "posts"; n: number; side: Side }
  | { form: "circle"; n: number; spin?: 1 | -1 }
  | { form: "ring"; n: number; radius: number }
  | { form: "rush"; n: number; side: Side }
  | { form: "midboss" }
);
export type Form = Beat["form"];
type BeatBody = Beat extends infer B ? (B extends Beat ? Omit<B, "at"> : never) : never;

/** `beats` in turn, one every `period` seconds from `from` (inclusive) to `to` (exclusive). */
function cycle(from: number, to: number, period: number, beats: readonly BeatBody[]): Beat[] {
  const out: Beat[] = [];
  for (let i = 0; from + period * i < to; i++) out.push({ ...beats[i % beats.length]!, at: Math.round((from + period * i) * 10) / 10 } as Beat);
  return out;
}

const byTime = (beats: Beat[]): Beat[] => beats.sort((a, b) => a.at - b.at);

/** The movement each formation needs its enemy to have. */
export const FORM_MOVE: Readonly<Record<Form, EnemyMove["kind"]>> = {
  line: "cross",
  vee: "cross",
  stream: "cross",
  posts: "snipe",
  circle: "orbit",
  ring: "chase",
  rush: "chase",
  midboss: "hover",
};

export interface StageDef {
  id: string;
  name: string;
  blurb: string;
  /** A stage opens once this stage has been cleared (undefined: open from the start). */
  requires?: string;
  /** Script seconds until the boss appears (the field is cleared first). */
  bossAt: number;
  boss: string;
  /** Dialogue script played before the boss (dialogue.ts). */
  dialogue: string;
  /** The stage's formations, in order of `at`. */
  script: readonly Beat[];
  /** A thin background of chasers under the script (chasers only). */
  waves: readonly WaveDef[];
  /** Enemy HP grows by this fraction per minute of run time. */
  hpPerMinute: number;
  /** Damage of a stage enemy's bullet (armor applies); the boss's bullets use the boss's own number. */
  bulletDmg: number;
  /** Tint the renderer multiplies over the ground tiles (0xffffff: as drawn). */
  tint: number;
}

export const STAGES: readonly StageDef[] = [
  {
    id: "lake",
    name: PLACES.lake,
    blurb: "Fog, fairies, and an ice fairy who thinks she is the strongest.",
    bossAt: 200,
    boss: "cirno",
    dialogue: "cirno-pre",
    hpPerMinute: 0.8,
    bulletDmg: 14,
    tint: 0xffffff,
    waves: [
      { from: 0, to: 40, every: 40, count: 5, cap: 40, kinds: { kedama: 1 } },
      { from: 40, to: 100, every: 30, count: 8, cap: 110, kinds: { kedama: 1 } },
      { from: 100, to: 200, every: 22, count: 10, cap: 200, kinds: { kedama: 1 } },
    ],
    script: byTime([
      // Opening: fairies only, streaming past from alternate sides.
      ...cycle(2, 40, 3, [
        { form: "stream", enemy: "fairy", n: 7, side: "left", lane: -150 },
        { form: "stream", enemy: "fairy", n: 7, side: "right", lane: 150 },
        { form: "line", enemy: "fairy", n: 7, side: "top" },
        { form: "vee", enemy: "fairy", n: 9, side: "left" },
        { form: "stream", enemy: "fairy", n: 7, side: "bottom", lane: 150 },
        { form: "vee", enemy: "fairy", n: 9, side: "right" },
      ]),
      { at: 24, form: "posts", enemy: "sunflower", n: 2, side: "top", banner: "Sunflower fairies take aim" },
      // Build-up: bigger formations, snipers on posts, the first phantom ring.
      ...cycle(40, 100, 2.5, [
        { form: "line", enemy: "fairy", n: 9, side: "left" },
        { form: "stream", enemy: "fairy", n: 9, side: "top", lane: 170 },
        { form: "vee", enemy: "fairy", n: 11, side: "right" },
        { form: "stream", enemy: "fairy", n: 9, side: "bottom", lane: -170 },
        { form: "line", enemy: "fairy", n: 9, side: "right" },
        { form: "vee", enemy: "fairy", n: 11, side: "top" },
      ]),
      ...cycle(44, 100, 9, [
        { form: "posts", enemy: "sunflower", n: 3, side: "top" },
        { form: "posts", enemy: "sunflower", n: 3, side: "bottom" },
        { form: "posts", enemy: "sunflower", n: 4, side: "left" },
        { form: "posts", enemy: "sunflower", n: 4, side: "right" },
      ]),
      { at: 50, form: "ring", enemy: "kedama", n: 30, radius: 520, banner: "Surrounded!" },
      { at: 66, form: "circle", enemy: "phantom", n: 16, banner: "Phantoms circle in" },
      { at: 72, form: "stream", enemy: "icefairy", n: 8, side: "top", lane: -120, banner: "Ice fairies!" },
      { at: 84, form: "posts", enemy: "bigfairy", n: 1, side: "top", banner: "A Great Fairy appears" },
      { at: 100, form: "midboss", enemy: "daiyousei", banner: "Daiyousei bars the way" },
      // After the midboss: dense crossings, orbs drifting through, snipers and rings.
      ...cycle(101, 197, 1.7, [
        { form: "vee", enemy: "fairy", n: 13, side: "left" },
        { form: "line", enemy: "icefairy", n: 9, side: "top" },
        { form: "stream", enemy: "fairy", n: 11, side: "right", lane: 130 },
        { form: "vee", enemy: "icefairy", n: 11, side: "bottom" },
        { form: "line", enemy: "fairy", n: 11, side: "right" },
        { form: "stream", enemy: "icefairy", n: 9, side: "left", lane: -130 },
      ]),
      ...cycle(103, 197, 5, [
        { form: "posts", enemy: "sunflower", n: 5, side: "top" },
        { form: "line", enemy: "yinyang", n: 4, side: "left" },
        { form: "circle", enemy: "phantom", n: 20, spin: -1 },
        { form: "posts", enemy: "sunflower", n: 6, side: "bottom" },
        { form: "line", enemy: "yinyang", n: 4, side: "right" },
        { form: "posts", enemy: "sunflower", n: 5, side: "left" },
      ]),
      { at: 150, form: "ring", enemy: "kedama", n: 44, radius: 560, banner: "Surrounded!" },
      { at: 172, form: "posts", enemy: "bigfairy", n: 2, side: "top", banner: "Great Fairies appear" },
      { at: 186, form: "rush", enemy: "kedama", n: 36, side: "bottom", banner: "A kedama stampede" },
    ]),
  },
  {
    id: "forest",
    name: PLACES.forest,
    blurb: "Mushroom spores, phantoms and the youkai of the dusk. Harder than the lake.",
    requires: "lake",
    bossAt: 200,
    boss: "rumia",
    dialogue: "rumia-pre",
    hpPerMinute: 1.8,
    bulletDmg: 17,
    tint: 0xb0e8b4,
    waves: [
      { from: 0, to: 60, every: 34, count: 7, cap: 70, kinds: { kedama: 1 } },
      { from: 60, to: 200, every: 20, count: 12, cap: 300, kinds: { kedama: 1 } },
    ],
    script: byTime([
      ...cycle(2, 45, 2.2, [
        { form: "stream", enemy: "fairy", n: 8, side: "right", lane: 150 },
        { form: "vee", enemy: "fairy", n: 9, side: "top" },
        { form: "stream", enemy: "fairy", n: 8, side: "left", lane: -150 },
        { form: "line", enemy: "fairy", n: 8, side: "bottom" },
      ]),
      { at: 12, form: "posts", enemy: "shade", n: 3, side: "left", banner: "The dusk closes in" },
      ...cycle(18, 100, 6, [
        { form: "posts", enemy: "shade", n: 3, side: "right" },
        { form: "posts", enemy: "shade", n: 4, side: "top" },
        { form: "posts", enemy: "shade", n: 4, side: "bottom" },
        { form: "posts", enemy: "shade", n: 3, side: "left" },
      ]),
      ...cycle(45, 100, 1.9, [
        { form: "vee", enemy: "fairy", n: 11, side: "left" },
        { form: "line", enemy: "fairy", n: 10, side: "top" },
        { form: "stream", enemy: "fairy", n: 10, side: "right", lane: 140 },
        { form: "vee", enemy: "fairy", n: 11, side: "bottom" },
      ]),
      { at: 40, form: "circle", enemy: "phantom", n: 18, banner: "Phantoms circle in" },
      { at: 64, form: "line", enemy: "yinyang", n: 3, side: "top" },
      { at: 76, form: "circle", enemy: "phantom", n: 20, spin: -1 },
      { at: 88, form: "posts", enemy: "bigfairy", n: 2, side: "top", banner: "Great Fairies appear" },
      { at: 100, form: "midboss", enemy: "duskfairy", banner: "A Great Dusk Fairy bars the way" },
      ...cycle(101, 197, 1.5, [
        { form: "vee", enemy: "fairy", n: 13, side: "right" },
        { form: "stream", enemy: "fairy", n: 12, side: "top", lane: -140 },
        { form: "line", enemy: "icefairy", n: 10, side: "left" },
        { form: "vee", enemy: "fairy", n: 13, side: "top" },
        { form: "stream", enemy: "fairy", n: 12, side: "bottom", lane: 140 },
        { form: "line", enemy: "icefairy", n: 10, side: "right" },
      ]),
      ...cycle(103, 197, 4, [
        { form: "posts", enemy: "shade", n: 5, side: "top" },
        { form: "circle", enemy: "phantom", n: 20 },
        { form: "posts", enemy: "shade", n: 5, side: "bottom" },
        { form: "line", enemy: "yinyang", n: 4, side: "left" },
        { form: "posts", enemy: "shade", n: 5, side: "left" },
        { form: "circle", enemy: "phantom", n: 22, spin: -1 },
        { form: "posts", enemy: "shade", n: 5, side: "right" },
        { form: "line", enemy: "yinyang", n: 4, side: "right" },
      ]),
      { at: 140, form: "ring", enemy: "kedama", n: 48, radius: 560, banner: "Surrounded!" },
      { at: 160, form: "posts", enemy: "bigfairy", n: 3, side: "top", banner: "Great Fairies appear" },
      { at: 184, form: "rush", enemy: "kedama", n: 40, side: "left", banner: "A kedama stampede" },
    ]),
  },
];

// Every beat names an enemy whose movement fits its formation, and background waves are chasers only.
for (const st of STAGES) {
  for (const b of st.script) {
    const move = ENEMIES[enemyIndex(b.enemy)]!.move.kind;
    if (move !== FORM_MOVE[b.form]) {
      throw new Error(`stage ${st.id}: the ${b.form} at ${b.at}s is made of ${b.enemy}, which moves "${move}"; a ${b.form} needs "${FORM_MOVE[b.form]}"`);
    }
  }
  for (const w of st.waves) {
    for (const id of Object.keys(w.kinds)) {
      if (ENEMIES[enemyIndex(id)]!.move.kind !== "chase") throw new Error(`stage ${st.id}: the background wave at ${w.from}-${w.to}s names ${id}, which does not chase`);
    }
  }
}

export const STAGE_BY_ID: Readonly<Record<string, StageDef>> = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export function stageDef(id: string): StageDef {
  const s = STAGE_BY_ID[id];
  if (!s) throw new Error(`unknown stage "${id}"; stages: ${STAGES.map((x) => x.id).join(", ")}`);
  return s;
}
