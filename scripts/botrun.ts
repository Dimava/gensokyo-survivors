import { newGame, activeRun, renderRun, renderMeta } from "../src/sim/game.ts";
import { playRun } from "../src/sim/bot.ts";
const seed = process.argv[2] ?? "bot";
const k = newGame(seed);
k.dispatch("/", "run:start", { stage: "lake" });
const path = activeRun(k)!;
const t0 = performance.now();
let maxE = 0, maxB = 0;
const res = playRun(k, { onTick: (i) => {
  if (!activeRun(k)) return;
  const v = k.view(path as "/run:1");
  maxE = Math.max(maxE, v.packed("enemies").count); maxB = Math.max(maxB, v.packed("bullets").count);
  if (i % 1800 === 0) console.log(renderRun(k, path));
}});
console.log("ticks", res.ticks, "ms/tick", ((performance.now() - t0) / res.ticks).toFixed(3), "maxEnemies", maxE, "maxBullets", maxB);
console.log(renderMeta(k));
console.log("log records", k.log().records.length, "log bytes", JSON.stringify(k.log()).length);
