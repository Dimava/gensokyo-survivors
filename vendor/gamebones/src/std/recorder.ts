// Run recorder: the full, filtered event log of a run, to post-process rather than sample.
// Reads finished dispatch traces and ctx.probe calls through kernel.listen, so it never touches
// state: a recorded run replays and hashes exactly like an unrecorded one.

import type { DispatchInfo, Kernel, ProbeEvent, TraceNode } from "../kernel.ts";
import type { AnyScope } from "../types.ts";

/** One recorded thing: a trace event, a probe, or a per-dispatch probe sum; plus the stamp. */
export type RunEntry = Record<string, unknown> & {
  /** Event name, probe name, or summed probe name. */
  event: string;
  /** The scope it happened in. */
  path: string;
  /** Omitted when empty. */
  payload?: unknown;
};

/** A summed probe's key and the numbers to add up, e.g. `(p) => [p.source, p.dmg, p.effective]`. */
export type SumProbe = (payload: never) => readonly [key: string, ...values: number[]];

export interface RecorderOptions {
  /** Trace events to keep: names, or a predicate. Refused nodes (and what is under them) never count. Default none. */
  keep?: readonly string[] | ((node: TraceNode, root: DispatchInfo) => boolean);
  /** Probes kept one entry each: names, or true for every probe not summed. Default true. */
  probes?: readonly string[] | boolean;
  /**
   * Probes summed per root dispatch instead: one entry per name and dispatch, its payload
   * `{ [key]: [count, ...sums] }`. For hits in a bulk loop, where one entry each would be too many.
   */
  sum?: Record<string, SumProbe>;
  /**
   * Fields added to every entry of a root dispatch, read once after it finishes: clock ticks,
   * the bot loop's step. E.g. `() => ({ tick: k.view().now("fixed") })`.
   */
  stamp?: (root: DispatchInfo) => Record<string, unknown>;
}

export interface Recorder {
  /** Everything recorded so far, in order: per dispatch its probes, its kept events, then its sums. */
  readonly entries: RunEntry[];
  /** One JSON object per line. */
  jsonl(): string;
  /** Drops what was recorded so far; keeps recording. */
  clear(): void;
  /** Stops listening. */
  stop(): void;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "object" && Object.keys(v).length === 0);
}

/** Records a kernel's run from now on (until `stop`). */
export function record<Root extends AnyScope>(k: Kernel<Root>, opts: RecorderOptions = {}): Recorder {
  const entries: RunEntry[] = [];
  const keep = opts.keep ?? [];
  const wanted = typeof keep === "function" ? keep : ((names) => (n: TraceNode) => names.has(n.event))(new Set(keep));
  const sum = opts.sum ?? {};
  const probeNames = opts.probes ?? true;
  const probeWanted =
    probeNames === true ? (name: string) => !(name in sum) : probeNames === false ? () => false : ((s) => (name: string) => s.has(name))(new Set(probeNames));

  // Probes arrive while their dispatch runs; they are held until it finishes (and dropped if it is refused).
  let heldSeq = -1;
  let held: { event: string; path: string; payload?: unknown }[] = [];
  let sums: Record<string, Record<string, number[]>> = {};
  let sumPaths: Record<string, string> = {};

  const reset = (seq: number) => {
    heldSeq = seq;
    held = [];
    sums = {};
    sumPaths = {};
  };

  const stop = k.listen({
    probe(p: ProbeEvent) {
      if (p.seq !== heldSeq) reset(p.seq);
      const fn = sum[p.name];
      if (fn) {
        const [key, ...values] = fn(p.payload as never);
        const byKey = (sums[p.name] ??= {});
        const row = (byKey[key] ??= [0, ...values.map(() => 0)]);
        row[0]!++;
        for (let i = 0; i < values.length; i++) row[i + 1]! += values[i]!;
        sumPaths[p.name] ??= p.path;
        return;
      }
      if (!probeWanted(p.name)) return;
      held.push({ event: p.name, path: p.path, ...(isEmpty(p.payload) ? {} : { payload: structuredClone(p.payload) }) });
    },
    dispatch(res, root) {
      const mine = heldSeq === root.seq;
      if (!res.ok) {
        if (mine) reset(-1);
        return;
      }
      const stamp = opts.stamp?.(root) ?? {};
      if (mine) for (const h of held) entries.push({ ...stamp, ...h });
      const walk = (n: TraceNode): void => {
        if (n.rejected) return;
        if (wanted(n, root)) entries.push({ ...stamp, event: n.event, path: n.scope, ...(isEmpty(n.payload) ? {} : { payload: n.payload }) });
        for (const c of n.children) walk(c);
      };
      walk(res.trace);
      if (mine) for (const [name, byKey] of Object.entries(sums)) entries.push({ ...stamp, event: name, path: sumPaths[name]!, payload: byKey });
      if (mine) reset(-1);
    },
  });

  return {
    entries,
    jsonl: () => toJsonl(entries),
    clear: () => void (entries.length = 0),
    stop,
  };
}

/** Entries as JSON lines, for files that stream and grep well. */
export function toJsonl(entries: readonly RunEntry[]): string {
  return entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");
}
