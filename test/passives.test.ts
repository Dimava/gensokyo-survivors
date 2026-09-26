// The defensive passives (Q28): items that list their totals by level
// (front-loaded) and raise more than one stat, the Heart Charm's ward and the
// Tengu Geta's longer recovery after a hit.

import { describe, expect, test } from "bun:test";
import { record } from "gamebones/std";
import { activeRun, runView, type Game } from "../src/sim/game.ts";
import { playRun, SKILL } from "../src/sim/bot.ts";
import { PASSIVES, passiveBonus, passiveDef, passiveGains } from "../src/content/passives.ts";
import { PLAYER, sec } from "../src/sim/tuning.ts";
import { fixtureGame } from "./helpers.ts";

const P = "/run:1" as const;
type Offer = { offer: { choices: { id: string; level: number }[]; rerolls: number } };
const offer = (k: Game) => (k.view(`${P}/levelup` as "/").q("offer" as never)[0] as unknown as Offer).offer;

/** A run in which the bot plays until it has taken `id` (rerolling offers for it); then the caller takes over. */
function takeItem(id: string, seed: string): Game {
  const k = fixtureGame(seed, { tree: { reroll: 30 } });
  k.dispatch("/", "run:start", { stage: "lake" });
  let taken = false;
  const pick = (k2: Game): number => {
    if (taken) return 0;
    while (!offer(k2).choices.some((c) => c.id === id) && offer(k2).rerolls > 0) k2.dispatch(`${P}/levelup` as "/run:1/levelup", "levelup:reroll", {});
    const i = offer(k2).choices.findIndex((c) => c.id === id);
    taken = i >= 0;
    return Math.max(0, i);
  };
  for (let i = 0; i < 180 && !taken && activeRun(k); i++) playRun(k, { ...SKILL.expert, maxTicks: 60, pick });
  expect(taken).toBe(true);
  expect(activeRun(k)).toBe(P);
  return k;
}

/** Stands still in the swarm for `ticks`, answering level-ups with the first choice; `each` runs after every tick. */
function stand(k: Game, ticks: number, each: () => void): void {
  k.queue(P, "move", { x: 0, y: 0 });
  for (let i = 0; i < ticks && activeRun(k); i++) {
    if (runView(k, P).derived("state").run.overlay === "levelup") k.dispatch(`${P}/levelup` as "/run:1/levelup", "levelup:pick", { index: 0 });
    k.tick(P, "fixed");
    if (activeRun(k)) each();
  }
}

describe("defensive passives", () => {
  test("levels are totals, front-loaded, and `also` raises more stats; the offer shows each gain", () => {
    for (const def of PASSIVES) {
      expect(passiveBonus(def, 0)).toEqual([]);
      for (let l = 1; l <= def.max; l++) {
        const bonus = new Map(passiveBonus(def, l));
        expect(bonus.get(def.stat)!).toBeCloseTo(def.levels ? def.levels[l - 1]! : def.per * l);
        for (const [k, levels] of Object.entries(def.also ?? {})) expect(bonus.get(k as never)).toBe(levels![l - 1]!);
        expect(passiveGains(def, l).length).toBe(bonus.size);
      }
      // Front-loaded: no later level adds more than the first.
      if (def.levels) for (let l = 2; l <= def.max; l++) expect(def.levels[l - 1]! - def.levels[l - 2]!).toBeLessThanOrEqual(def.levels[0]! + 1e-9);
    }
    expect(passiveDef("heart").also?.ward).toBeDefined();
    expect(passiveDef("geta").also?.invuln).toBeDefined();
  });

  test("the Heart Charm: more max HP, filled as it is taken, and a ward that takes a whole hit, then recharges", () => {
    const k = takeItem("heart", "ward");
    const v = runView(k, P);
    const stats = v.derived("stats");
    expect(stats.maxHp).toBe(100 + passiveDef("heart").levels![0]!);
    expect(stats.ward).toBe(passiveDef("heart").also!.ward![0]!);
    const rec = record(k, { keep: ["player:hurt", "ward:block"], stamp: () => ({ at: activeRun(k) ? runView(k, P).now("action") : -1 }) });
    const hits: number[] = [];
    let last = v.derived("player").life.hits;
    let wardAt = -1;
    stand(k, sec(stats.ward + 5), () => {
      const now = v.derived("player").life.hits;
      if (now > last) hits.push(v.now("action"));
      last = now;
      if (wardAt < 0 && v.derived("player").life.wardAt > 0) wardAt = v.derived("player").life.wardAt;
    });
    rec.stop();
    const at = (e: unknown) => (e as { at: number }).at;
    const blocks = rec.entries.filter((e) => e.event === "ward:block").map(at);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // A blocked hit costs no HP: every block is a hurt that did not count as a hit.
    expect(rec.entries.filter((e) => e.event === "player:hurt").length).toBe(blocks.length + hits.length);
    // The first hit standing in the swarm is blocked; the charm then recharges for its period, and hits land meanwhile.
    expect(hits[0] ?? Infinity).toBeGreaterThan(blocks[0]!);
    expect(wardAt).toBe(blocks[0]! + sec(stats.ward));
    expect(hits.filter((t) => t < wardAt).length).toBeGreaterThan(1);
    // Never two blocks within the recharge.
    for (let i = 1; i < blocks.length; i++) expect(blocks[i]! - blocks[i - 1]!).toBeGreaterThanOrEqual(sec(stats.ward));
  });

  test("the Tengu Geta: faster, and untouchable longer after a hit", () => {
    const k = takeItem("geta", "geta");
    const v = runView(k, P);
    const stats = v.derived("stats");
    expect(stats.speed).toBeCloseTo(1 + passiveDef("geta").levels![0]!);
    expect(stats.invuln).toBe(passiveDef("geta").also!.invuln![0]!);
    const recovery = PLAYER.invuln + sec(stats.invuln);
    let last = v.derived("player").life.hits;
    const gaps: number[] = [];
    let prev = -1;
    stand(k, sec(20), () => {
      const p = v.derived("player");
      if (p.life.hits > last) {
        const t = v.now("action");
        // The hit landed this tick: untouchable for the base recovery plus the Geta's.
        expect(p.life.invulnUntil - t).toBeGreaterThan(recovery - 2);
        expect(p.life.invulnUntil - t).toBeLessThanOrEqual(recovery);
        if (prev >= 0) gaps.push(t - prev);
        prev = t;
      }
      last = p.life.hits;
    });
    expect(gaps.length).toBeGreaterThan(2);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(recovery - 1);
  });
});
