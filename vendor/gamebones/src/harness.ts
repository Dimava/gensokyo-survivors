// Test harness (D38, harness part): scripted play against a kernel, text
// transcripts of each trace tree plus the game's own render, and replay
// verification through the JSON log.

import { canonicalJson } from "./hash.ts";
import { replay, withHashChain, type Change, type DispatchResult, type Kernel, type TraceNode } from "./kernel.ts";
import type { AnyScope, InputEvent, PayloadIn, SpecAt } from "./types.ts";

export interface HarnessOptions<Root extends AnyScope> {
  /** The game's text view of the kernel; called after every captured step. */
  render?: (k: Kernel<Root>) => string;
  /** Changes printed per trace node before eliding; default 8. */
  maxChanges?: number;
  /**
   * Default for `hashChain` in kernels `make` creates, so `verifyReplay` checks every step.
   * Default true; an explicit `hashChain` passed to createKernel inside `make` still wins.
   */
  hashChain?: boolean;
}

export interface Harness<Root extends AnyScope> {
  readonly kernel: Kernel<Root>;
  /** Dispatches an input and captures its trace tree and the render. Returns the captured text. */
  play<P extends string, E extends InputEvent<SpecAt<Root, P>>>(
    path: P,
    event: E,
    payload: PayloadIn<SpecAt<Root, P>, E>,
  ): string;
  /** Dispatches without capturing; throws if refused. For warm-up moves. */
  quiet<P extends string, E extends InputEvent<SpecAt<Root, P>>>(
    path: P,
    event: E,
    payload: PayloadIn<SpecAt<Root, P>, E>,
  ): DispatchResult;
  /** Ticks a driver clock n times (default 1), then captures one frame plus any rejections on the way. */
  tick<P extends string>(path: P, clock: SpecAt<Root, P>["drivers"], n?: number): string;
  /** Adds a free-text line to the transcript. */
  note(text: string): void;
  /** Everything captured so far; feed it to `expect(...).toMatchSnapshot()`. */
  transcript(): string;
  /** Replays the JSON-round-tripped log and checks the replayed save equals the live one; returns the replayed kernel. */
  verifyReplay(): Kernel<Root>;
}

function fmtValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  return JSON.stringify(v);
}

export function fmtPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") return fmtValue(payload);
  return Object.entries(payload as Record<string, unknown>)
    .map(([k, v]) => `${k}=${fmtValue(v)}`)
    .join(" ");
}

export function fmtChange(ch: Change): string {
  const by = ` (${ch.by})`;
  if (ch.comp === undefined) {
    if (ch.after !== undefined) {
      const comps = Object.keys(ch.after as object).filter((k) => k !== "id");
      return `+${ch.id} {${comps.join(", ")}}${by}`;
    }
    return `-${ch.id}${by}`;
  }
  if (ch.before === undefined) return `+${ch.id}.${ch.comp} ${JSON.stringify(ch.after)}${by}`;
  if (ch.after === undefined) return `-${ch.id}.${ch.comp}${by}`;
  const b = ch.before;
  const a = ch.after;
  if (b && a && typeof b === "object" && typeof a === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    const diffs = keys
      .filter((k) => canonicalJson((b as Record<string, unknown>)[k] ?? null) !== canonicalJson((a as Record<string, unknown>)[k] ?? null))
      .map((k) => `${k} ${fmtValue((b as Record<string, unknown>)[k])} -> ${fmtValue((a as Record<string, unknown>)[k])}`);
    return `${ch.id}.${ch.comp} ${diffs.join(", ")}${by}`;
  }
  return `${ch.id}.${ch.comp} ${fmtValue(b)} -> ${fmtValue(a)}${by}`;
}

/** The trace tree as indented text: one line per node, `!!` for rejections, changes underneath. */
export function formatTrace(root: TraceNode, maxChanges = 8): string {
  const lines: string[] = [];
  const walk = (n: TraceNode, depth: number, parentScope: string): void => {
    const pad = "  ".repeat(depth);
    const payload = fmtPayload(n.payload);
    const at = n.scope !== parentScope ? ` @${n.scope}` : "";
    const stores = n.stores.map((s) => ` [${s.name}: ${fmtPayload(s.summary)}]`).join("");
    if (n.rejected) {
      lines.push(`${pad}!! ${n.event}${payload ? ` ${payload}` : ""}${at}: ${n.rejected.reason}${n.rejected.rule ? ` (${n.rejected.rule})` : ""}`);
    } else {
      lines.push(`${pad}${n.event}${payload ? ` ${payload}` : ""}${at}${stores}`);
    }
    const shown = n.changes.slice(0, maxChanges);
    for (const ch of shown) lines.push(`${pad}  . ${fmtChange(ch)}`);
    if (n.changes.length > shown.length) lines.push(`${pad}  . ... ${n.changes.length - shown.length} more changes`);
    for (const c of n.children) walk(c, depth + 1, n.scope);
  };
  walk(root, 0, root.scope);
  return lines.join("\n");
}

function collectRejections(n: TraceNode, out: TraceNode[]): void {
  if (n.rejected) out.push(n);
  for (const c of n.children) collectRejections(c, out);
}

export function harness<Root extends AnyScope>(make: () => Kernel<Root>, opts: HarnessOptions<Root> = {}): Harness<Root> {
  const kernel = opts.hashChain === false ? make() : withHashChain(make);
  const render = (): string => (opts.render ? opts.render(kernel) : "");
  const captured: string[] = [];
  const frame = (header: string, body: string[]): string => {
    const r = render();
    const text = [header, ...body, ...(r ? [r] : [])].join("\n");
    captured.push(text);
    return text;
  };
  frame("== initial", []);
  const loose = kernel as unknown as {
    dispatch(p: string, e: string, pl: unknown): DispatchResult;
    tick(p: string, c: string): DispatchResult;
  };
  return {
    kernel,
    play(path, event, payload) {
      const res = loose.dispatch(path, event, payload);
      const body = [formatTrace(res.trace, opts.maxChanges)];
      if (!res.ok) body.push(`-- refused: ${res.rejection.reason}`);
      return frame(`== play ${path} ${event}${fmtPayload(payload) ? ` ${fmtPayload(payload)}` : ""}`, body);
    },
    quiet(path, event, payload) {
      const res = loose.dispatch(path, event, payload);
      if (!res.ok) throw new Error(`quiet ${event} was refused: ${res.rejection.reason}`);
      return res;
    },
    tick(path, clock, n = 1) {
      const body: string[] = [];
      for (let i = 0; i < n; i++) {
        const res = loose.tick(path, clock as string);
        const rej: TraceNode[] = [];
        const tick = (res.trace.payload as { tick?: number }).tick;
        for (const input of res.inputs ?? []) {
          body.push(`> before tick ${tick}: ${input.trace.event} ${fmtPayload(input.trace.payload)}`);
          collectRejections(input.trace, rej);
        }
        collectRejections(res.trace, rej);
        for (const r of rej) {
          body.push(`!! tick ${tick}: ${r.event} ${fmtPayload(r.payload)}: ${r.rejected!.reason}`);
        }
      }
      return frame(`== tick ${path} ${String(clock)} x${n}`, body);
    },
    note(text) {
      captured.push(`-- ${text}`);
    },
    transcript: () => `${captured.join("\n")}\n`,
    verifyReplay() {
      const file = JSON.parse(JSON.stringify(kernel.log()));
      const replayed = replay(kernel.type, file);
      const a = canonicalJson(JSON.parse(JSON.stringify(replayed.save())));
      const b = canonicalJson(JSON.parse(JSON.stringify(kernel.save())));
      if (a !== b) throw new Error("verifyReplay: the replayed save differs from the live one although every hash matched");
      return replayed;
    },
  };
}
