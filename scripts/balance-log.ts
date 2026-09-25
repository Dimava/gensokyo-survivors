// Records the full, filtered event log (lib/runlog.ts) of Misty Lake runs:
// each level-up strategy (lib/strategies.ts) on each seed, played to its end
// by the expert bot, one JSON file per run. scripts/balance-report.ts reads them.
//   bun scripts/balance-log.ts <outdir> [seeds=6]   (ONLY=a,b  TREE=none|mid|full  SHARD=i/n  STAGE=lake)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtureGame } from "../test/helpers.ts";
import { activeRun } from "../src/sim/game.ts";
import { SKILL } from "../src/sim/bot.ts";
import { recordRun } from "./lib/runlog.ts";
import { STRATEGIES, TREES } from "./lib/strategies.ts";

const [outDir = "runlogs", nSeeds = "6"] = process.argv.slice(2);
const only = process.env.ONLY?.split(",");
const treeName = process.env.TREE ?? "none";
const tree = TREES[treeName]!;
const stage = process.env.STAGE ?? "lake";
const seeds = process.env.SEEDS?.split(",") ?? Array.from({ length: Number(nSeeds) }, (_, i) => `c${i + 1}`);
const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];

for (const [si, st] of STRATEGIES.entries()) {
  if (si % shards !== shard || (only && !only.includes(st.name))) continue;
  const dir = join(outDir, st.name.replace(/[^\w+-]+/g, "_"));
  mkdirSync(dir, { recursive: true });
  for (const seed of seeds) {
    const k = fixtureGame(seed, { tree: { ...tree, reroll: 30 } });
    k.dispatch("/", "run:start", { stage });
    if (!activeRun(k)) throw new Error("no run");
    const t0 = performance.now();
    const { log, ticks } = recordRun(k, { ...SKILL.expert, pick: st.make(seed)() });
    writeFileSync(join(dir, `${seed}.json`), JSON.stringify({ strategy: st.name, seed, stage, tree: treeName, ticks, log }));
    console.log(`${st.name} ${seed}: ${log.length} entries, ${ticks} ticks, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
