// Delayed input: decisions made now that go out some ticks later, for bots with a reaction
// latency (and for input lag in tests). A host-side queue on whatever tick count the caller
// keeps; it never touches the kernel, so the caller queues what drain() hands back.

export interface DelayOptions<O> {
  /**
   * Orders with a key are state, not actions (a move, a focus toggle): only the latest one
   * matters. Return undefined for one-shots (play a card), which all go out, in order.
   */
  key?: (order: O) => string | undefined;
}

/** A queue's saved form: [due tick, order] in the order they go out. JSON if the orders are. */
export type SavedDelay<O> = [at: number, order: O][];

export interface Delay<O> {
  /**
   * Queues `order` to go out on tick `at`. A keyed order drops the pending orders of its key due
   * on `at` or later: they were decided earlier and would undo it. Ones due before it stay, so
   * with a steady latency every change still goes out.
   */
  push(order: O, at: number): void;
  /**
   * Takes out every order due on `now` or before, earliest first (FIFO within a tick). Of keyed
   * orders only the last due of each key is returned, in its place: the earlier ones were
   * overtaken while nobody drained (a paused bot, an overlay).
   */
  drain(now: number): O[];
  /** The tick the next order is due, or undefined when none is pending: sleep until then. */
  next(): number | undefined;
  /** How many orders are pending. */
  readonly size: number;
  clear(): void;
  save(): SavedDelay<O>;
  /** Replaces what is pending with a saved queue. */
  load(saved: SavedDelay<O>): void;
}

export function delay<O>(opts: DelayOptions<O> = {}): Delay<O> {
  const keyOf = opts.key ?? (() => undefined);
  // Sorted by due tick, then by push order; pushes with a steady latency append at the end.
  let pending: [at: number, order: O][] = [];

  const push = (order: O, at: number): void => {
    const key = keyOf(order);
    if (key !== undefined) pending = pending.filter(([t, o]) => t < at || keyOf(o) !== key);
    let i = pending.length;
    while (i > 0 && pending[i - 1]![0] > at) i--;
    pending.splice(i, 0, [at, order]);
  };

  return {
    push,
    drain(now) {
      let n = 0;
      while (n < pending.length && pending[n]![0] <= now) n++;
      if (!n) return [];
      const due = pending.splice(0, n).map(([, o]) => o);
      const last = new Map<string, number>();
      due.forEach((o, i) => {
        const key = keyOf(o);
        if (key !== undefined) last.set(key, i);
      });
      return due.filter((o, i) => {
        const key = keyOf(o);
        return key === undefined || last.get(key) === i;
      });
    },
    next: () => pending[0]?.[0],
    get size() {
      return pending.length;
    },
    clear() {
      pending = [];
    },
    save: () => pending.map(([at, o]) => [at, structuredClone(o)]),
    load(saved) {
      pending = [];
      for (const [at, o] of saved) push(structuredClone(o), at);
    },
  };
}
