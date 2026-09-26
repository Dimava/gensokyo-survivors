// How a run is going, for the music (music.ts): the intensity layers
// (Song.layers) follow how thick the swarm is, a midboss, a boss low on
// health or the player low on health; the part (Song.parts) names the
// moment: a midboss holding the stage, the boss's dialogue, her spell cards.
// Read-only, view side; the host samples it a few times a second.

import { bossDef } from "../content/bosses.ts";
import { ENEMIES } from "../content/enemies.ts";
import { runView, type Game, type RunPath } from "../sim/game.ts";
import { PHASE } from "../sim/swarm.ts";

/** Enemies on the field that count as a full-intensity wave. */
const DENSE = 140;

export function musicMood(k: Game, path: RunPath): number {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const p = v.derived("player");
  const hp = p.life.hp / Math.max(1, v.derived("stats").maxHp);
  if (hp < 0.3) return 1;
  if (run.phase === "boss") {
    const boss = v.derived("boss");
    // A boss fight starts busy and gets busier as her health runs down.
    return boss ? 0.5 + 0.5 * (1 - boss.boss.hp / Math.max(1, boss.boss.max)) : 0.6;
  }
  const e = v.packed("enemies");
  const kinds = e.col("kind");
  for (let i = 0; i < e.count; i++) if (ENEMIES[kinds[i]!]?.midboss) return 1;
  return Math.min(1, e.count / DENSE);
}

/**
 * The run's moment, as the songs name their parts: "midboss" while one
 * holds the stage (not once she is leaving), "intro" through the boss's
 * dialogue, then "spell0", "spell1" ... for her spell cards and "last" for
 * the final one; "" otherwise.
 */
export function musicPart(k: Game, path: RunPath): string {
  const v = runView(k, path);
  const run = v.derived("state").run;
  if (run.phase === "dialogue") return "intro";
  if (run.phase === "boss") {
    const boss = v.derived("boss");
    if (!boss) return "intro";
    const n = bossDef(boss.boss.id).spells.length;
    return boss.boss.spell >= n - 1 ? "last" : `spell${boss.boss.spell}`;
  }
  if (run.phase !== "swarm") return "";
  const e = v.packed("enemies");
  const kinds = e.col("kind");
  const phase = e.col("phase");
  for (let i = 0; i < e.count; i++) if (ENEMIES[kinds[i]!]?.midboss && phase[i] !== PHASE.leaving) return "midboss";
  return "";
}
