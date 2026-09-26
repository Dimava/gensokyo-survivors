// Records the full, filtered event log (lib/runlog.ts) of Misty Lake runs:
// each level-up strategy (lib/strategies.ts) on each seed, played to its end
// by a bot (BOT: a SKILL preset, default "player", the human-like balance
// reference), one JSON file per run. scripts/balance-report.ts reads them.
//   bun scripts/balance-log.ts <outdir> [seeds=6]   (ONLY=a,b  TREE=none|mid|full  SHARD=i/n  STAGE=lake  BOT=player|expert)
// Cards: CARDS=0 plays none (no dives either), AUTOHEAL=1 adds the game's heal
// autocast (host.ts), DECK=a,b,c makes the run's deck exactly these cards (default: the starter deck).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixtureGame } from "../test/helpers.ts";
import { activeRun, runView } from "../src/sim/game.ts";
import { SKILL, type BotOptions } from "../src/sim/bot.ts";
import { recordRun } from "./lib/runlog.ts";
import { ENEMIES } from "../src/content/enemies.ts";
import { STAGES } from "../src/content/stages.ts";
import { BOSSES } from "../src/content/bosses.ts";
import { STRATEGIES, TREES } from "./lib/strategies.ts";

const [outDir = "runlogs", nSeeds = "6"] = process.argv.slice(2);
const only = process.env.ONLY?.split(",");
const treeName = process.env.TREE ?? "none";
const tree = TREES[treeName]!;
const stage = process.env.STAGE ?? "lake";
const bot = (process.env.BOT ?? "player") as keyof typeof SKILL;
// CAUTION=px, LATENCY=ticks, SETTLE=ticks override the preset's.
const skill: BotOptions = { ...SKILL[bot] };
for (const [env, key] of [["CAUTION", "caution"], ["LATENCY", "latency"], ["SETTLE", "settle"]] as const) if (process.env[env]) skill[key] = Number(process.env[env]);
if (process.env.CARDS) skill.cards = process.env.CARDS !== "0";
if (process.env.RECKLESS) skill.reckless = process.env.RECKLESS !== "0";
if (process.env.AUTOHEAL) skill.autoHeal = process.env.AUTOHEAL !== "0";
const deck = process.env.DECK?.split(",").filter(Boolean);
const seeds = process.env.SEEDS?.split(",") ?? Array.from({ length: Number(nSeeds) }, (_, i) => `c${i + 1}`);
// HARD=x multiplies the damage enemies and bullets deal (contact, stage bullets, boss bullets): a difficulty probe.
const hard = Number(process.env.HARD ?? 1);
if (hard !== 1) {
  for (const e of ENEMIES) (e as { dmg: number }).dmg = e.dmg * hard;
  for (const st of STAGES) (st as { bulletDmg: number }).bulletDmg = st.bulletDmg * hard;
  for (const b of BOSSES) Object.assign(b, { dmg: b.dmg * hard, bulletDmg: b.bulletDmg * hard });
}
const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];

for (const [si, st] of STRATEGIES.entries()) {
  if (si % shards !== shard || (only && !only.includes(st.name))) continue;
  const dir = join(outDir, st.name.replace(/[^\w+-]+/g, "_"));
  mkdirSync(dir, { recursive: true });
  for (const seed of seeds) {
    const k = fixtureGame(seed, { tree: { ...tree, reroll: 30 }, ...(deck ? { cards: deck, onlyDeck: true } : {}) });
    k.dispatch("/", "run:start", { stage });
    if (!activeRun(k)) throw new Error("no run");
    // card:played names the card's entity: which card each one is.
    const cards = Object.fromEntries(runView(k, activeRun(k)!).q("card").map((c) => [c.id, c.card.id]));
    const t0 = performance.now();
    const { log, ticks } = recordRun(k, { ...skill, pick: st.make(seed)() });
    writeFileSync(join(dir, `${seed}.json`), JSON.stringify({ strategy: st.name, seed, stage, tree: treeName, bot, skill, hard, deck: deck ?? "starter", cards, ticks, log }));
    console.log(`${st.name} ${seed}: ${log.length} entries, ${ticks} ticks, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
