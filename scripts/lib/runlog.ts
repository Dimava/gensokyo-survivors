// The full, filtered event log of one bot run, to post-process rather than
// sample: every kernel event named in `keep` (read from the dispatch and tick
// traces), every enemy spawned (SPAWN_PROBE), and every tick's hits summed by
// source (DAMAGE_PROBE). Each entry carries the fixed tick of the bot's loop
// and the action tick it happened on.
import type { DispatchResult, TraceNode } from "gamebones";
import { activeRun, runView, type Game } from "../../src/sim/game.ts";
import { playRun } from "../../src/sim/bot.ts";
import { DAMAGE_PROBE, SPAWN_PROBE } from "../../src/sim/swarm.ts";

export interface Entry {
  /** The bot loop's fixed tick. */
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
  const want = new Set(keep);
  const log: Entry[] = [];
  let tick = 0;
  let hits: Hits = {};
  const at = (): number => (activeRun(k) === path ? runView(k, path).now("action") : -1);
  const walk = (n: TraceNode, t: number): void => {
    if (want.has(n.event)) log.push({ tick, at: t, ev: n.event, ...(n.payload && Object.keys(n.payload).length ? { p: n.payload } : {}) });
    for (const c of n.children) walk(c, t);
  };
  const onResult = (res: DispatchResult, i: number): void => {
    tick = i;
    const t = at();
    for (const r of res.inputs ?? []) walk(r.trace, t);
    walk(res.trace, t);
    if (Object.keys(hits).length) {
      log.push({ tick, at: t, ev: "hits", p: hits });
      hits = {};
    }
  };
  SPAWN_PROBE.on = (kind, hp, xp, t) => log.push({ tick, at: t, ev: "spawn", p: { kind, hp, xp } });
  DAMAGE_PROBE.on = (src, target, dmg, eff, _t) => {
    const h = (hits[src] ??= [0, 0, 0]);
    if (target === "boss") h[2] += dmg;
    else {
      h[0] += dmg;
      h[1] += eff;
    }
  };
  try {
    const res = playRun(k, { ...opts, onResult: (r, i) => (onResult(r, i), opts.onResult?.(r, i)) });
    return { log, ticks: res.ticks };
  } finally {
    SPAWN_PROBE.on = null;
    DAMAGE_PROBE.on = null;
  }
}
