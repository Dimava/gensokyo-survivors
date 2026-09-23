// Balance sweep: one profile plays run after run with the bot, spending its
// donations between runs (cheapest affordable shrine node first, a pack when
// nothing else is affordable). Prints a few lines per run.
//   bun scripts/balance.ts [runs=8] [seed=bal]      (DODGE=0..1 weakens the bot)
import { newGame, activeRun, renderRun } from "../src/sim/game.ts";
import { playRun, SKILL } from "../src/sim/bot.ts";
import { TREE } from "../src/content/tree.ts";

const runs = Number(process.argv[2] ?? 8);
const seed = process.argv[3] ?? "bal";
const skill = SKILL[(process.env.SKILL ?? "novice") as keyof typeof SKILL];
const k = newGame(seed);
for (let r = 1; r <= runs; r++) {
  k.dispatch("/", "run:start", { stage: "lake" });
  const path = activeRun(k)!;
  let snap = "";
  let atBoss = "";
  let results = "";
  const t0 = performance.now();
  const res = playRun(k, {
    ...skill,
    onTick: () => {
      if (!activeRun(k)) return;
      snap = renderRun(k, path);
      const v = k.view(path as "/run:1");
      if (v.derived("state").run.phase === "boss" && !atBoss) atBoss = snap.split("\n")[0]!;
      const b = v.derived("boss");
      if (b) results = b.boss.results.join(",");
    },
  });
  const ms = (performance.now() - t0) / res.ticks;
  const last = k.view().q("lastRun")[0]!.lastRun.summary;
  console.log(`run ${r}: ${last.outcome} ${last.seconds}s lv${last.level} kills ${last.kills} +${last.coins.total} caps ${last.spellsCaptured} | ${ms.toFixed(2)} ms/tick`);
  console.log(`   ${snap.split("\n")[1]}`);
  console.log(`   at boss: ${atBoss || "-"} | spells: ${results || "-"}`);
  for (;;) {
    const opts = k.options("/", "tree:buy").map((o) => o.node);
    if (!opts.length) break;
    const lv = k.view().derived("tree").tree.levels;
    const cost = (id: string): number => TREE.find((n) => n.id === id)!.costs[lv[id] ?? 0]!;
    opts.sort((a, b) => cost(a) - cost(b));
    k.dispatch("/", "tree:buy", { node: opts[0]! });
  }
  if (k.options("/", "pack:buy").length) {
    k.dispatch("/", "pack:buy", { pack: "omikuji" });
    k.dispatch("/pack", "pack:close", {});
  }
  console.log(`   tree: ${JSON.stringify(k.view().derived("tree").tree.levels)} coins left ${k.view().derived("wallet").wallet.coins}`);
}
