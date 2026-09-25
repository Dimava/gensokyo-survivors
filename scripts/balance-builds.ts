// Build and card sweep: the same fresh-or-given profile plays one Misty Lake
// run per seed under each configuration, and the configurations are compared
// on what the run came to: the level at each minute, when the boss came,
// cleared or not, how long the boss took, hits taken, level. A configuration
// forces a level-up preference (a weapon or a passive first) or a deck.
//   bun scripts/balance-builds.ts <builds|cards> [seeds=4] [skill=expert] [tree=none|mid|unlock]
// SHARD=i/n runs every n-th configuration (parallel processes); ONLY=a,b filters by name.
import { fixtureGame } from "../test/helpers.ts";
import { activeRun, runView, type Game, type RunPath } from "../src/sim/game.ts";
import { botPick, playRun, SKILL } from "../src/sim/bot.ts";
import { PASSIVES } from "../src/content/passives.ts";
import { WEAPONS } from "../src/content/weapons.ts";
import { STARTER_CARDS } from "../src/content/cards.ts";

const [mode = "builds", nSeeds = "4", skillName = "expert", treeName = "none"] = process.argv.slice(2);
const only = process.env.ONLY?.split(",");
const skill = SKILL[skillName as keyof typeof SKILL];
const TREES: Record<string, Record<string, number>> = {
  none: {},
  mid: { core: 3, magnet1: 3, might1: 3, hp1: 3, spirit1: 3, greed1: 2, growth1: 2, graze1: 2, cooldown1: 2, area1: 2, regen1: 2, armor1: 2, speed1: 2 },
  unlock: { core: 3, magnet1: 3, might1: 3, hp1: 3, spirit1: 3, greed1: 2, growth1: 2, graze1: 2, cooldown1: 3, area1: 3, regen1: 2, armor1: 2, speed1: 2, spark: 1, hand1: 1, knives: 1 },
};
const tree = TREES[treeName]!;
const seeds = Array.from({ length: Number(nSeeds) }, (_, i) => `b${i + 1}`);

type Offer = { kind: string; id: string; level: number };
const offerOf = (k: Game, path: RunPath): Offer[] =>
  ((k.view(`${path}/levelup` as "/").q("offer" as never)[0] as unknown as { offer: { choices: Offer[] } } | undefined)?.offer.choices ?? []);
/** Take `id` (weapon or passive) whenever offered, else the default pick. */
const prefer = (id: string) => (k: Game, path: RunPath): number => {
  const i = offerOf(k, path).findIndex((c) => c.id === id);
  return i >= 0 ? i : botPick(k, path);
};
/** Never take a passive while anything else is offered. */
const noPassives = (k: Game, path: RunPath): number => {
  const o = offerOf(k, path);
  const i = o.findIndex((c) => c.kind !== "passive");
  return i >= 0 ? i : botPick(k, path);
};
/** Only ever level what she has; never a new weapon or passive (a stunted build). */
const stunted = (k: Game, path: RunPath): number => {
  const o = offerOf(k, path);
  const i = o.findIndex((c) => (c.kind === "weapon" || c.kind === "passive") && c.level > 1);
  const j = o.findIndex((c) => c.kind === "heal" || c.kind === "coins");
  return i >= 0 ? i : j >= 0 ? j : botPick(k, path);
};

interface Config { name: string; pick?: (k: Game, path: RunPath) => number; cards?: string[]; only?: string }
const configs: Config[] = [];
if (mode === "builds") {
  configs.push({ name: "default" });
  for (const w of WEAPONS) configs.push({ name: `weapon:${w.id}`, pick: prefer(w.id) });
  for (const p of PASSIVES) configs.push({ name: `passive:${p.id}`, pick: prefer(p.id) });
  configs.push({ name: "no-passives", pick: noPassives });
  configs.push({ name: "stunted", pick: stunted });
} else {
  const extra = ["power-charm", "graze-ribbon", "vengeance", "pocket-watch", "master-spark", "gap", "last-stand"];
  configs.push({ name: "starter" });
  // Each starter card alone (the deck needs one card), then the starter deck plus each other card.
  for (const c of STARTER_CARDS) configs.push({ name: `only:${c}`, only: c });
  for (const c of extra) configs.push({ name: `+${c}`, cards: [c] });
  configs.push({ name: "no-cards(bot)" });
}

// SHARD=i/n runs every n-th configuration from i (parallel processes).
const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];
for (const [ci, cfg] of configs.entries()) {
  if (ci % shards !== shard) continue;
  if (only && !only.some((o) => cfg.name.includes(o))) continue;
  let clears = 0, bossSum = 0, bossN = 0, hitSum = 0, lvSum = 0, secSum = 0, plays = 0, arriveSum = 0, arriveN = 0;
  const lvAt = [0, 0, 0, 0];
  const killsAt = [0, 0, 0, 0];
  for (const seed of seeds) {
    const k = fixtureGame(seed, { tree, cards: cfg.cards, onlyDeck: !!cfg.only });
    if (cfg.only) k.dispatch("/", "deck:toggle", { card: cfg.only });
    k.dispatch("/", "run:start", { stage: "lake" });
    const path = activeRun(k)!;
    let bossAt = -1, hits = 0, lv = 0, played = 0;
    playRun(k, {
      ...skill,
      cards: cfg.name !== "no-cards(bot)",
      pick: cfg.pick,
      onTick: () => {
        if (activeRun(k) !== path) return;
        const v = runView(k, path);
        const pl = v.derived("player");
        hits = pl.life.hits;
        lv = pl.progress.level;
        played = pl.progress.cardsPlayed;
        if (bossAt < 0 && v.derived("state").run.phase === "boss") bossAt = v.now("action");
        const t = v.now("action");
        for (let m = 0; m < 4; m++) if (t === (m + 1) * 3600) {
          lvAt[m]! += pl.progress.level;
          killsAt[m]! += pl.progress.kills;
        }
      },
    });
    const last = k.view().q("lastRun")[0]!.lastRun.summary;
    const won = last.outcome === "clear";
    clears += won ? 1 : 0;
    if (won && bossAt >= 0) {
      bossSum += last.seconds - bossAt / 60;
      bossN++;
    }
    if (bossAt >= 0) {
      arriveSum += bossAt / 60;
      arriveN++;
    }
    hitSum += hits;
    lvSum += lv;
    secSum += last.seconds;
    plays += played;
  }
  const n = seeds.length;
  const growth = `lv@1-4m ${lvAt.map((x) => (x / n).toFixed(0)).join("/")}  kills@4m ${(killsAt[3]! / n).toFixed(0)}  boss@ ${arriveN ? (arriveSum / arriveN).toFixed(0) + "s" : "-"}`;
  const row = `${cfg.name.padEnd(28)} ${growth}  ` + `clears ${clears}/${n}  boss ${bossN ? (bossSum / bossN).toFixed(0).padStart(3) + "s" : "  - "}  run ${(secSum / n).toFixed(0).padStart(3)}s  hits ${(hitSum / n).toFixed(1).padStart(5)}  lv ${(lvSum / n).toFixed(1)}  cards ${(plays / n).toFixed(0)}`;
  console.log(row);
}
