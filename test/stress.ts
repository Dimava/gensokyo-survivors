// Load fixtures for timing: fills a run's stores to a target size directly,
// outside any dispatch. Only for timing tests: a run touched this way no
// longer replays from its log.

import { styleIndex } from "../src/content/patterns.ts";
import { enemyIndex } from "../src/content/enemies.ts";
import { runView, type Game, type RunPath } from "../src/sim/game.ts";

/** Loads the run's stores up to a target load, outside any dispatch (perf fixtures only: not replayable). */
export function stress(k: Game, path: RunPath, enemies: number, bullets: number): void {
  const v = runView(k, path);
  const e = v.packed("enemies");
  const b = v.packed("bullets");
  const { body } = v.derived("player");
  const t = v.now("danmaku");
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = e.count; i < enemies; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 120 + rnd() * 600;
    e.add({ x: body.x + Math.cos(a) * d, y: body.y + Math.sin(a) * d, hp: 1e9, kind: enemyIndex("fairy"), uid: 1e6 + i, hitAt: -100, orbAt: -100, fireAt: 1e9 });
  }
  for (let i = b.count; i < bullets; i++) {
    const a = rnd() * Math.PI * 2;
    // Bullets circling at a distance, slowly: they stay on screen for the whole measurement.
    b.add({ x: body.x + Math.cos(a) * (200 + rnd() * 500), y: body.y + Math.sin(a) * (200 + rnd() * 500), t0: t, dx: Math.cos(a + 1.6), dy: Math.sin(a + 1.6), speed: 0.3, style: styleIndex("orb") });
  }
}

