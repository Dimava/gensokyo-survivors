// Power curves: the same seeds played with different level-up strategies
// (the swarm's spawns have their own rng stream, so every strategy meets the
// same waves until its choices change what dies). Each run goes to its end;
// every 5 s of action time: level, XP collected, damage dealt to the swarm
// (raw, and effective: only up to what the target had left), kills, damage to
// the boss, and the same damage split by source (weapon or card id), all from
// the sim's "hit" probe (ctx.probe, heard through k.listen). HITLOG=file.csv writes every hit of the first
// run (tick, source, target, damage, effective). "(lucky)" strategies reroll the first four offers (a profile with
// 30 rerolls) until one brings a piece of the build not yet owned, so the
// build is complete by level 5. Written as JSON for scripts/balance-chart.ts.
//   bun scripts/balance-power.ts <out.json> [seeds=6]   (SHARD=i/n, ONLY=a,b)
import { appendFileSync, writeFileSync } from "node:fs";
import { fixtureGame } from "../test/helpers.ts";
import { activeRun, runView } from "../src/sim/game.ts";
import { playRun, SKILL } from "../src/sim/bot.ts";
import { XP } from "../src/sim/tuning.ts";
import type { Probes } from "../src/sim/swarm.ts";
import { STRATEGIES, TREES } from "./lib/strategies.ts";

const [out = "power.json", nSeeds = "6"] = process.argv.slice(2);
const only = process.env.ONLY?.split(",");
// TREE=none|mid|full: the shrine tree bought (lib/strategies.ts).
const tree = TREES[process.env.TREE ?? "none"]!;
const seeds = process.env.SEEDS?.split(",") ?? Array.from({ length: Number(nSeeds) }, (_, i) => `c${i + 1}`);
const STEP = 5;
let logged = false;

const totalXp = (level: number, xp: number): number => {
  let s = xp;
  for (let l = 1; l < level; l++) s += XP.next(l);
  return s;
};

/** Cumulative damage by source: [raw to the swarm, effective to the swarm, to the boss]. */
type BySource = Record<string, [number, number, number]>;
interface Sample { t: number; level: number; xp: number; raw: number; eff: number; boss: number; kills: number; by: BySource }
interface Run { samples: Sample[]; outcome: string; bossAt: number; end: number; build: string }
const result: Record<string, Run[]> = {};
const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];
for (const [si, st] of STRATEGIES.entries()) {
  if (si % shards !== shard || (only && !only.includes(st.name))) continue;
  result[st.name] = [];
  for (const seed of seeds) {
    const k = fixtureGame(seed, { tree: { ...tree, reroll: 30 } });
    k.dispatch("/", "run:start", { stage: "lake" });
    const path = activeRun(k)!;
    const tally = { raw: 0, eff: 0, boss: 0 };
    const by: BySource = {};
    const log = process.env.HITLOG && !logged ? process.env.HITLOG : "";
    let lines: string[] = [];
    if (log) {
      writeFileSync(log, "tick,source,target,dmg,eff\n");
      logged = true;
    }
    const stop = k.listen({
      probe: ({ name, payload }) => {
        if (name !== "hit") return;
        const { src, boss, dmg, eff, t } = payload as Probes["hit"];
        const b = (by[src] ??= [0, 0, 0]);
        if (boss) {
          tally.boss += dmg;
          b[2] += dmg;
        } else {
          tally.raw += dmg;
          tally.eff += eff;
          b[0] += dmg;
          b[1] += eff;
        }
        if (log) {
          lines.push(`${t},${src},${boss ? "boss" : "swarm"},${+dmg.toFixed(2)},${+eff.toFixed(2)}`);
          if (lines.length >= 5000) {
            appendFileSync(log, lines.join("\n") + "\n");
            lines = [];
          }
        }
      },
    });
    const run: Run = { samples: [], outcome: "", bossAt: -1, end: 0, build: "" };
    let last = -1;
    playRun(k, {
      ...SKILL.expert,
      pick: st.make(seed)(),
      onTick: () => {
        if (activeRun(k) !== path) return;
        const v = runView(k, path);
        const t = v.now("action");
        if (run.bossAt < 0 && v.derived("state").run.phase === "boss") run.bossAt = t / 60;
        if (t % (STEP * 60) || t === last) return;
        last = t;
        const pr = v.derived("player").progress;
        run.samples.push({ t: t / 60, level: pr.level, xp: totalXp(pr.level, pr.xp) / v.derived("stats").growth, ...tally, kills: pr.kills, by: structuredClone(by) });
        run.build = [
          ...v.derived("weapons").map((w) => `${w.weapon.id}${w.weapon.level}`),
          ...v.derived("passives").map((p) => `${p.passive.id}${p.passive.level}`),
        ].join(" ");
      },
    });
    stop();
    if (log && lines.length) appendFileSync(log, lines.join("\n") + "\n");
    const summary = k.view().q("lastRun")[0]!.lastRun.summary;
    run.outcome = summary.outcome;
    run.end = summary.seconds;
    result[st.name]!.push(run);
  }
  console.log(`${st.name} done`);
}
writeFileSync(out, JSON.stringify(result));
