// How hard a run is going, for the music's intensity layers (music.ts
// Song.layers): a dense wave, a midboss, a boss low on health or the player
// low on health push it up. Read-only, view side; the host samples it a few
// times a second.

import { ENEMIES } from "../content/enemies.ts";
import { runView, type Game, type RunPath } from "../sim/game.ts";

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
