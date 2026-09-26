// The full, filtered event log of one bot run, to post-process rather than
// sample: every kernel event named in `keep`, every enemy spawned (the sim's
// "spawn" probe), and each tick's hits summed by source (its "hit" probe),
// recorded by gamebones/std's `record`. Each entry carries the run's fixed
// tick and the action tick it happened on.
import { record } from "gamebones/std";
import { activeRun, runView, type Game } from "../../src/sim/game.ts";
import { playRun } from "../../src/sim/bot.ts";
import type { Probes } from "../../src/sim/swarm.ts";

export interface Entry {
  /** The run's fixed tick. */
  tick: number;
  /** Action tick (the run's clock: paused under overlays, stopped by hitstop). */
  at: number;
  ev: string;
  p?: unknown;
}

/** The events a balance log keeps by default. */
export const KEEP = [
  "enemies:died",
  "drops:collected",
  "bullets:erase",
  "level:up",
  "levelup:show",
  "levelup:picked",
  "player:hurt",
  "player:downed",
  "player:revived",
  "ward:block",
  "card:played",
  "boss:approach",
  "vn:closed",
  "spell:start",
  "spell:break",
  "boss:defeated",
  "run:over",
  "run:ended",
] as const;

/** Hits in one tick by source: [raw to the swarm, effective to the swarm, to the boss]. */
export type Hits = Record<string, [number, number, number]>;

export function recordRun(k: Game, opts: Parameters<typeof playRun>[1] = {}, keep: readonly string[] = KEEP): { log: Entry[]; ticks: number } {
  const path = activeRun(k)!;
  const clock = (c: "fixed" | "action"): number => (activeRun(k) === path ? runView(k, path).now(c) : -1);
  const rec = record(k, {
    keep,
    probes: ["spawn"],
    sum: { hit: (p: Probes["hit"]) => [p.src, p.boss ? 0 : p.dmg, p.boss ? 0 : p.eff, p.boss ? p.dmg : 0] },
    stamp: () => ({ tick: clock("fixed"), at: clock("action") }),
  });
  try {
    const res = playRun(k, opts);
    const log = rec.entries.map((e): Entry => {
      const { tick, at } = e as unknown as { tick: number; at: number };
      if (e.event !== "hit") return { tick, at, ev: e.event, ...(e.payload === undefined ? {} : { p: e.payload }) };
      // Sums come as [count, ...sums]; the log keeps the sums.
      const hits: Hits = {};
      for (const [src, [, raw, eff, boss]] of Object.entries(e.payload as Record<string, number[]>)) hits[src] = [raw!, eff!, boss!];
      return { tick, at, ev: "hits", p: hits };
    });
    return { log, ticks: res.ticks };
  } finally {
    rec.stop();
  }
}
