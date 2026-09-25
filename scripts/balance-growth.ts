// Growth-rate sweep: how fast each build gains XP in the middle of a run.
// Each build plays Misty Lake with its level-up priority from the start (so
// a snowball compounds as it would), and three 15 s windows are measured:
// XP collected per second, kills per second, and the XP left lying on the
// floor at the window's end (what a bigger magnet would pick up). Growth is
// what decides a survivors run: a build that levels 3x as fast wins at
// everything else too.
//   bun scripts/balance-growth.ts [seeds=6] [skill=expert] [tree=none|mid]
import { fixtureGame } from "../test/helpers.ts";
import { activeRun, runView, type Game, type RunPath } from "../src/sim/game.ts";
import { botPick, playRun, SKILL } from "../src/sim/bot.ts";
import { XP } from "../src/sim/tuning.ts";
import { DROP } from "../src/sim/drops.ts";

const [nSeeds = "6", skillName = "expert", treeName = "none"] = process.argv.slice(2);
const only = process.env.ONLY?.split(",");
const skill = SKILL[skillName as keyof typeof SKILL];
const TREES: Record<string, Record<string, number>> = {
  none: {},
  mid: { core: 3, magnet1: 3, might1: 3, hp1: 3, spirit1: 3, greed1: 2, growth1: 2, graze1: 2, cooldown1: 2, area1: 2, regen1: 2, armor1: 2, speed1: 2 },
};
const tree = TREES[treeName]!;
const seeds = Array.from({ length: Number(nSeeds) }, (_, i) => `g${i + 1}`);
/** Window starts, in seconds of action time (the boss comes at 200 s). */
const WINDOWS = [60, 100, 140];
const LEN = 15;

type Offer = { kind: string; id: string; level: number };
const offerOf = (k: Game, path: RunPath): Offer[] =>
  ((k.view(`${path}/levelup` as "/").q("offer" as never)[0] as unknown as { offer: { choices: Offer[] } } | undefined)?.offer.choices ?? []);
/** Take the first of `ids` offered (weapons or passives, in priority order), else the default pick. */
const priority = (ids: string[]) => (k: Game, path: RunPath): number => {
  const o = offerOf(k, path);
  for (const id of ids) {
    const i = o.findIndex((c) => c.id === id);
    if (i >= 0) return i;
  }
  return botPick(k, path);
};

interface Build { name: string; ids?: string[]; cards?: string[] }
const builds: Build[] = [
  { name: "default" },
  { name: "needle+clock+magnet", ids: ["needle", "clock", "magnet"] },
  { name: "needle+clock+magnet+gap", ids: ["needle", "clock", "magnet"], cards: ["gap"] },
  { name: "needle+clock", ids: ["needle", "clock"] },
  { name: "needle+magnet", ids: ["needle", "magnet"] },
  { name: "needle", ids: ["needle"] },
  { name: "magnet", ids: ["magnet"] },
  { name: "clock", ids: ["clock"] },
  { name: "amulet+clock+magnet", ids: ["amulet", "clock", "magnet"] },
  { name: "orbs+clock+magnet", ids: ["orbs", "clock", "magnet"] },
  { name: "border+clock+magnet", ids: ["border", "clock", "magnet"] },
  { name: "amulet+power+tome", ids: ["amulet", "power", "tome"] },
  { name: "orbs+grimoire+power", ids: ["orbs", "grimoire", "power"] },
  { name: "border+grimoire+clock", ids: ["border", "grimoire", "clock"] },
  { name: "needle+power+tome", ids: ["needle", "power", "tome"] },
  { name: "neko+magnet", ids: ["neko", "magnet"] },
];

/** All XP ever gained: the levels' costs plus what is toward the next. */
const totalXp = (level: number, xp: number): number => {
  let s = xp;
  for (let l = 1; l < level; l++) s += XP.next(l);
  return s;
};

const STOP = Symbol("stop");
const fmt = (x: number, d = 1, w = 5) => x.toFixed(d).padStart(w);
console.log(`${"build".padEnd(26)} ${WINDOWS.map((w) => `@${w}s: lv   xp/s kill/s floor`.padEnd(30)).join("")}  lv@${WINDOWS.at(-1)! + LEN}`);
// SHARD=i/n runs every n-th build from i (parallel processes).
const [shard, shards] = (process.env.SHARD ?? "0/1").split("/").map(Number) as [number, number];
for (const [bi, b] of builds.entries()) {
  if (bi % shards !== shard) continue;
  if (only && !only.some((o) => b.name === o)) continue;
  const acc = WINDOWS.map(() => ({ lv: 0, xp: 0, kills: 0, floor: 0 }));
  let endLv = 0;
  for (const seed of seeds) {
    const k = fixtureGame(seed, { tree, cards: b.cards });
    k.dispatch("/", "run:start", { stage: "lake" });
    const path = activeRun(k)!;
    const start = WINDOWS.map(() => ({ xp: 0, kills: 0, lv: 0 }));
    const end = WINDOWS.at(-1)! + LEN;
    try {
      playRun(k, {
        ...skill,
        pick: b.ids ? priority(b.ids) : botPick,
        onTick: () => {
          if (activeRun(k) !== path) return;
          const v = runView(k, path);
          const t = v.now("action");
          if (t % 60) return;
          const s = t / 60;
          const pr = v.derived("player").progress;
          for (const [wi, w] of WINDOWS.entries()) {
            if (s === w) start[wi] = { xp: totalXp(pr.level, pr.xp), kills: pr.kills, lv: pr.level };
            if (s === w + LEN) {
              const a = acc[wi]!;
              a.lv += start[wi]!.lv;
              a.xp += (totalXp(pr.level, pr.xp) - start[wi]!.xp) / LEN;
              a.kills += (pr.kills - start[wi]!.kills) / LEN;
              const d = v.packed("drops");
              for (let i = 0; i < d.count; i++) if (d.col("kind")[i] === DROP.xp) a.floor += d.col("value")[i]!;
            }
          }
          if (s === end) {
            endLv += pr.level;
            throw STOP;
          }
        },
      });
    } catch (e) {
      if (e !== STOP) throw e;
    }
  }
  const n = seeds.length;
  const cols = acc.map((a) => `${fmt(a.lv / n, 0, 9)} ${fmt(a.xp / n)} ${fmt(a.kills / n, 1, 6)} ${fmt(a.floor / n, 0, 5)}`.padEnd(30));
  console.log(`${b.name.padEnd(26)} ${cols.join("")}  ${fmt(endLv / n, 1, 4)}`);
}
