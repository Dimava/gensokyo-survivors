// Level-up strategies and shrine trees shared by the balance scripts: the same
// seeds played with different choices (the swarm's spawns have their own rng
// stream, so every strategy meets the same waves until its choices change what
// dies). "(lucky)" strategies reroll the first four offers (a profile with 30
// rerolls) until one brings a piece of the build not yet owned.
import type { Game, RunPath } from "../../src/sim/game.ts";
import { botPick } from "../../src/sim/bot.ts";
import { PASSIVES } from "../../src/content/passives.ts";
import { TREE } from "../../src/content/tree.ts";

type Offer = { kind: string; id: string; level: number };
type Pick = (k: Game, path: RunPath) => number;
const offerOf = (k: Game, path: RunPath): Offer[] =>
  ((k.view(`${path}/levelup` as "/").q("offer" as never)[0] as unknown as { offer: { choices: Offer[]; rerolls: number } } | undefined)?.offer.choices ?? []);
const rerollsLeft = (k: Game, path: RunPath): number =>
  ((k.view(`${path}/levelup` as "/").q("offer" as never)[0] as unknown as { offer: { rerolls: number } } | undefined)?.offer.rerolls ?? 0);
/** The first of `ids` offered, else the default pick; `lucky` rerolls the first four offers for a missing piece. */
const priority = (ids: string[], lucky = false) => (): Pick => {
  let picks = 0;
  return (k, path) => {
    if (lucky && picks < 4) {
      const missing = (o: Offer[]) => o.some((c) => ids.includes(c.id) && c.level === 1);
      while (!missing(offerOf(k, path)) && rerollsLeft(k, path) > 0) k.dispatch(`${path}/levelup` as "/run:1/levelup", "levelup:reroll", {});
    }
    picks++;
    const o = offerOf(k, path);
    for (const id of ids) {
      const i = o.findIndex((c) => c.id === id);
      if (i >= 0) return i;
    }
    return botPick(k, path);
  };
};
/** Uniformly random picks (a fixed stream per seed, not the game's rng). */
const random = (seed: string) => (): Pick => {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (k, path) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % Math.max(1, offerOf(k, path).length);
  };
};

export interface Strategy { name: string; make: (seed: string) => () => Pick }
const S = (name: string, ids: string[], lucky = false): Strategy => ({ name, make: () => priority(ids, lucky) });
export const STRATEGIES: Strategy[] = [
  { name: "default", make: () => () => botPick },
  { name: "random", make: random },
  S("amulet", ["amulet"]),
  S("needle", ["needle"]),
  S("orbs", ["orbs"]),
  S("border", ["border"]),
  ...PASSIVES.map((p) => S(p.id, [p.id])),
  S("needle+tome+clock", ["needle", "tome", "clock"]),
  S("needle+tome+clock (lucky)", ["needle", "tome", "clock"], true),
  S("amulet+tome+clock", ["amulet", "tome", "clock"]),
  S("amulet+tome+clock (lucky)", ["amulet", "tome", "clock"], true),
  S("amulet+power+tome", ["amulet", "power", "tome"]),
];

/** Shrine trees bought for a sweep (TREE=none|mid|full; full: every node at its last level). Rerolls come on top. */
export const TREES: Record<string, Record<string, number>> = {
  none: {},
  mid: { core: 3, dmg1: 2, hp1: 3, headStart: 1, spirit1: 2, regen1: 1, armor1: 1, reroll: 1, speed1: 1 },
  full: Object.fromEntries(TREE.map((n) => [n.id, n.costs.length])),
};
