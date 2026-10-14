// The loop a bot or a headless run plays a kernel with: decide, send what a delay queue has due,
// tick, observe, until over. Thin on purpose: overlays, picks and the AI stay in the game.

import type { DispatchResult, Kernel } from "../kernel.ts";
import type { AnyScope } from "../types.ts";
import type { Delay } from "./delay.ts";

export interface DriveOptions<O> {
  /** The scope and driver clock to tick. Default "/" and "fixed". */
  path?: string;
  clock?: string;
  /** Stop after this many ticks. */
  maxTicks: number;
  /** True ends the run (checked before each tick and after it). */
  over?(): boolean;
  /** Before each tick: decide, dispatch overlay choices, push orders onto the queue. */
  before?(i: number): void;
  /**
   * A delay queue drained after `before` and before the tick: each due order goes to `send`,
   * which queues the input. `now` is the queue's tick count (default i; a bot whose latency
   * counts only steered ticks keeps its own).
   */
  delay?: { queue: Delay<O>; send(order: O, i: number): void; now?(i: number): number };
  /** After each tick, with its result. */
  after?(res: DispatchResult, i: number): void;
}

/** Plays `k` tick by tick; returns how many ticks ran. */
export function drive<O = never>(k: Kernel<AnyScope>, opts: DriveOptions<O>): { ticks: number } {
  const path = opts.path ?? "/";
  const clock = opts.clock ?? "fixed";
  let i = 0;
  for (; i < opts.maxTicks; i++) {
    if (opts.over?.()) break;
    opts.before?.(i);
    if (opts.delay) {
      const d = opts.delay;
      for (const o of d.queue.drain(d.now ? d.now(i) : i)) d.send(o, i);
    }
    if (opts.over?.()) break;
    const res = k.tick(path, clock);
    opts.after?.(res, i);
  }
  return { ticks: i };
}
