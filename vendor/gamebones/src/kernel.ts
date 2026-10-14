// The kernel: scope instances, the entity store with copy-on-write writes,
// indexes, event resolution through ordered rules, clocks, processes,
// derived values, the trace, rollback, saves, the log and replay.
// PRD ids: D12, D13, D14, D16-D23, D25, D30, D32, D36, D51, D52.

import type { z } from "zod";
import { listenable, checkScale } from "./define.ts";
import { canonicalJson, fnv1a, fromBase64, hashValue, toBase64 } from "./hash.ts";
import type { PackedStore } from "./packed.ts";
import { makeRng, seedToState, type Rng } from "./rng.ts";
import type { AnyFn, RelationRT, RuleDef, ScopeRT } from "./runtime.ts";
import type {
  AnyScope,
  Ctx,
  DeepReadonly,
  EventDef,
  ExportsOf,
  Id,
  InputEvent,
  Json,
  PayloadIn,
  Phase,
  SavedScope,
  ScopeData,
  SpecAt,
  TypeAt,
  SpecOf,
  StepResult,
  TriggerRow,
  View,
} from "./types.ts";

// ---------- public result types ----------

/** One row diff in the trace, attributed to the rule that wrote it (D25). */
export interface Change {
  readonly id: Id;
  /** Absent for whole-entity spawns and despawns. */
  readonly comp?: string;
  /** Absent when the component (or entity) was created. */
  readonly before?: unknown;
  /** Absent when the component (or entity) was deleted. */
  readonly after?: unknown;
  /** The rule label, `process:<type>.<state>`, or `setup`. */
  readonly by: string;
}

export interface Rejection {
  readonly scope: string;
  readonly event: string;
  readonly reason: string;
  /** The check rule that refused; absent when a ref did not resolve. */
  readonly rule?: string;
}

export interface StoreNote {
  readonly name: string;
  readonly summary: unknown;
}

/** A trace node: one resolved event (or process step) and everything under it (D25). */
export interface TraceNode {
  readonly scope: string;
  readonly event: string;
  payload: unknown;
  rejected?: Rejection;
  readonly changes: Change[];
  stores: StoreNote[];
  readonly children: TraceNode[];
}

export type DispatchResult =
  | { ok: true; trace: TraceNode; inputs?: DispatchResult[] }
  | { ok: false; rejection: Rejection; trace: TraceNode; inputs?: DispatchResult[] };

/** A probe as listeners get it: `ctx.probe(name, payload)` plus where it came from. */
export interface ProbeEvent {
  /** The root dispatch it happened in (matches `DispatchInfo.seq`). */
  readonly seq: number;
  readonly name: string;
  readonly payload: unknown;
  /** The scope whose rule or process step probed. */
  readonly path: string;
  /** The event node it probed from. */
  readonly event: string;
}

/** The root of a logged dispatch, as dispatch listeners get it. */
export interface DispatchInfo {
  readonly seq: number;
  readonly path: string;
  /** The input event, or `tick:<clock>`. */
  readonly event: string;
  readonly payload: unknown;
}

export interface KernelListener {
  /**
   * After every logged root dispatch, accepted or refused. Input queued for a tick arrives as
   * its own dispatch before the tick (and again in the tick's `inputs`, which listeners skip).
   */
  dispatch?(res: DispatchResult, root: DispatchInfo): void;
  /** Each `ctx.probe`, as it happens (before its dispatch finishes). */
  probe?(p: ProbeEvent): void;
}

export const SAVE_FORMAT = "gamebones-save/1";

/** Default for KernelOptions.checkpointEvery. */
export const CHECKPOINT_EVERY = 1000;
/** Checkpoints kept; undo past the oldest replays from the start. */
const CHECKPOINTS_KEPT = 8;

interface Checkpoint {
  /** Logged dispatches (repeats counted) before it. */
  at: number;
  save: Save;
  hash: string;
  /** Log records then, and the last one's repeat count (later repeats mutate it). */
  records: number;
  lastRepeat: number | undefined;
  lastKey: string;
}
export const LOG_FORMAT = "gamebones-log/1";

export interface Save {
  format: string;
  /** Saved scopes by path, parents before children. */
  scopes: Record<string, SavedScope>;
}

export interface LogRecord {
  path: string;
  event: string;
  payload: unknown;
  /** Chain hash after this record (after the last repetition when `repeat` is set). */
  hash: string;
  /** Consecutive identical records collapse into one with a count. */
  repeat?: number;
}

export interface LogFile {
  format: string;
  /** Scope type name to version (migrations length) when recorded. */
  versions: Record<string, number>;
  initial: Save;
  initialHash: string;
  records: LogRecord[];
}

export interface KernelOptions<Root extends AnyScope> {
  /** Seeds every rng stream (per scope path and stream name). Default 0. */
  seed?: string | number;
  /** Scenario setup (D38): runs once with a full ctx on the root scope before the log starts. */
  setup?: (ctx: Ctx<SpecOf<Root>>) => void;
  /**
   * Keep the log's hash chain (D30): every logged dispatch hashes its changes, so `replay`
   * verifies each step and `hash()` means something. Default false: verification is for
   * tests; records then carry hash "" and replay re-runs them unverified.
   */
  hashChain?: boolean;
  /**
   * Keeps a save every this many logged dispatches (default 1000; 0 turns it off), so `undo`
   * and the recovery of a tick that throws replay from the latest one instead of the start.
   */
  checkpointEvery?: number;
}

// ---------- the typed kernel surface ----------

export interface Kernel<Root extends AnyScope> {
  readonly type: Root;
  /** Resolves an input event and logs it; returns the trace, or the rejection if a check refused the root. */
  dispatch<P extends string, E extends InputEvent<SpecAt<Root, P>>>(
    path: P,
    event: E,
    payload: PayloadIn<SpecAt<Root, P>, E>,
  ): DispatchResult;
  /** Same code path as dispatch, then rolls back: the preview (D25). Nothing is logged. */
  dry<P extends string, E extends InputEvent<SpecAt<Root, P>>>(
    path: P,
    event: E,
    payload: PayloadIn<SpecAt<Root, P>, E>,
  ): DispatchResult;
  /** Queues input to dispatch right before the next `tick` (real-time games, D22). */
  queue<P extends string, E extends InputEvent<SpecAt<Root, P>>>(
    path: P,
    event: E,
    payload: PayloadIn<SpecAt<Root, P>, E>,
  ): void;
  /** Flushes queued input, then ticks a driver clock as a logged root dispatch. */
  tick<P extends string>(path: P, clock: SpecAt<Root, P>["drivers"]): DispatchResult;
  /** A read-only view of a scope, for renderers and tests. */
  view<P extends string = "/">(path?: [TypeAt<Root, P>] extends [never] ? never : P): View<SpecAt<Root, P>>;
  /** A scope's exports, frozen. */
  read<T extends AnyScope>(path: string, type: T): DeepReadonly<ExportsOf<T>>;
  /** Legal payloads of an input event, from the scope's `options` (D21). */
  options<P extends string, E extends InputEvent<SpecAt<Root, P>>>(path: P, event: E): PayloadIn<SpecAt<Root, P>, E>[];
  /** Snapshot of every saved scope (D30). */
  save(): Save;
  /** The log so far: header plus records (D30). */
  log(): LogFile;
  /** Rebuilds from the initial snapshot and replays all but the last n logged dispatches. */
  undo(n?: number): void;
  /** The current chain hash. */
  hash(): string;
  /** Open scope paths, parents first. */
  paths(): string[];
  /** Recent rejections (diagnostics, D20), newest last. */
  readonly rejections: readonly Rejection[];
  /**
   * Observes the run without being part of it: finished dispatches and `ctx.probe` calls
   * (recorders, balance tools, debug overlays). Dry runs and undo's rebuilds stay silent.
   * Returns the function that stops listening.
   */
  listen(listener: KernelListener): () => void;
}

// ---------- internals ----------

interface ClockState {
  now: number;
  acc: number;
  num: number;
  den: number;
}

interface ProcRow {
  id: Id;
  type: string;
  state: string;
  locals: Json;
  clock: string;
  wakeAt: number | null;
  waitEvent: string | null;
}

interface Sys {
  seed: string;
  nextId: number;
  clocks: Record<string, ClockState>;
  rng: Record<string, number>;
  procs: ProcRow[];
}

type Ent = { id: Id } & Record<string, unknown>;

const PHASES: readonly Phase[] = ["check", "modify", "apply", "react"];
const LIFECYCLE = new Set(["spawned", "despawned", "added", "removed"]);

interface Compiled {
  rt: ScopeRT;
  byEvent: Map<string, Record<Phase, RuleDef[]>>;
  /** Global rules as ready-made items (self undefined), so most nodes allocate nothing to order rules. */
  items: Map<string, Record<Phase, Item[]>>;
  named: Map<string, RuleDef>;
  listened: Set<string>;
  relByComp: Map<string, RelationRT>;
  known: Set<string>;
}

const compiledCache = new WeakMap<ScopeRT, Compiled>();

function compile(rt: ScopeRT): Compiled {
  const hit = compiledCache.get(rt);
  if (hit) return hit;
  const byEvent = new Map<string, Record<Phase, RuleDef[]>>();
  const named = new Map<string, RuleDef>();
  const listened = new Set<string>();
  for (const rule of rt.rules) {
    listened.add(rule.event);
    if (rule.named) {
      named.set(rule.named, rule);
      continue;
    }
    let slot = byEvent.get(rule.event);
    if (!slot) {
      slot = { check: [], modify: [], apply: [], react: [] };
      byEvent.set(rule.event, slot);
    }
    slot[rule.phase].push(rule);
  }
  for (const slot of byEvent.values()) {
    for (const p of PHASES) slot[p].sort((a, b) => b.priority - a.priority); // stable: registration order within a priority
  }
  const relByComp = new Map<string, RelationRT>();
  for (const rel of Object.values(rt.relations)) relByComp.set(rel.comp, rel);
  const items = new Map<string, Record<Phase, Item[]>>();
  for (const [ev, slot] of byEvent) {
    items.set(ev, {
      check: slot.check.map((rule) => ({ rule, self: undefined })),
      modify: slot.modify.map((rule) => ({ rule, self: undefined })),
      apply: slot.apply.map((rule) => ({ rule, self: undefined })),
      react: slot.react.map((rule) => ({ rule, self: undefined })),
    });
  }
  const c: Compiled = { rt, byEvent, items, named, listened, relByComp, known: new Set(listenable(rt)) };
  compiledCache.set(rt, c);
  return c;
}

const idNums = new Map<string, number>();
function idNum(id: string): number {
  let n = idNums.get(id);
  if (n === undefined) {
    const i = id.lastIndexOf("#");
    n = i < 0 ? 0 : Number(id.slice(i + 1));
    if (!Number.isFinite(n)) n = 0;
    if (idNums.size > 200_000) idNums.clear();
    idNums.set(id, n);
  }
  return n;
}
function byId(a: string, b: string): number {
  return idNum(a) - idNum(b) || (a < b ? -1 : a > b ? 1 : 0);
}

function jsonClone<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(jsonClone) as T;
  const out: Record<string, unknown> = {};
  for (const k in v) out[k] = jsonClone((v as Record<string, unknown>)[k]);
  return out as T;
}

function deepFreeze<T>(v: T): T {
  if (v === null || typeof v !== "object" || Object.isFrozen(v)) return v;
  Object.freeze(v);
  if (Array.isArray(v)) for (const x of v) deepFreeze(x);
  else for (const k in v) deepFreeze((v as Record<string, unknown>)[k]);
  return v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    if (a.length !== bb.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], bb[i])) return false;
    return true;
  }
  // Keys whose value is undefined count as absent; no key arrays are built.
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  let na = 0;
  for (const k in ra) {
    if (ra[k] === undefined) continue;
    na++;
    if (!deepEqual(ra[k], rb[k])) return false;
  }
  let nb = 0;
  for (const k in rb) if (rb[k] !== undefined) nb++;
  return na === nb;
}

/** Structural literal matching (D18). */
function matchValue(pattern: unknown, value: unknown): boolean {
  if (pattern === null || typeof pattern !== "object") return pattern === value;
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value) || value.length !== pattern.length) return false;
    for (let i = 0; i < pattern.length; i++) if (!matchValue(pattern[i], value[i])) return false;
    return true;
  }
  if (value === null || typeof value !== "object") return false;
  for (const k in pattern) {
    if (!(k in value)) return false;
    if (!matchValue((pattern as Record<string, unknown>)[k], (value as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function zodIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("; ");
}

function childPath(parent: string, slot: string, key: string | undefined): string {
  return `${parent === "/" ? "" : parent}/${slot}${key === undefined ? "" : `:${key}`}`;
}

/** Turns the engine's bare "readonly property" TypeError into a message that names the fix (D11). */
function explainFrozen(e: unknown, label: string): unknown {
  if (e instanceof TypeError && /read.?only|frozen|not extensible|Cannot add property|Cannot delete|Attempted to assign/i.test(e.message)) {
    return new Error(
      `"${label}" wrote to a frozen object (${e.message}): entities, components and payloads are frozen. Write components through ctx.mut(id, "comp"), ctx.add or ctx.remove; change a payload only in a modify rule (D16)`,
      { cause: e },
    );
  }
  return e;
}

// ---------- ambient guards (D12) ----------

function installGuards(): () => void {
  const M = Math as unknown as Record<string, unknown>;
  const saved: [Record<string, unknown>, string, unknown][] = [];
  const swap = (obj: Record<string, unknown>, key: string, fn: unknown): void => {
    saved.push([obj, key, obj[key]]);
    obj[key] = fn;
  };
  swap(M, "random", () => {
    throw new Error(
      "Math.random inside a rule or process step: use ctx.rng(stream) so a replay rolls the same numbers (D12)",
    );
  });
  swap(Date as unknown as Record<string, unknown>, "now", () => {
    throw new Error(
      "Date.now inside a rule or process step: the kernel owns no wall clock; carry elapsed time in an input payload or read ctx.now(clock) (D12, D22)",
    );
  });
  return () => {
    for (let i = saved.length - 1; i >= 0; i--) {
      const [obj, key, v] = saved[i]!;
      obj[key] = v;
    }
  };
}

// ---------- scope instances ----------

const owners = new WeakMap<object, Inst>();

class Inst {
  entities = new Map<Id, Ent>();
  children = new Map<string, Inst>();
  compIdx = new Map<string, Set<Id>>();
  sorted = new Map<string, Id[]>();
  relIdx = new Map<string, Map<Id, Set<Id>>>();
  relFwd = new Map<string, Map<Id, Id>>();
  trigIdx = new Map<string, Set<Id>>();
  trigFwd = new Map<Id, Set<string>>();
  memo = new Map<string, { value: unknown; deps: Map<string, number> }>();
  memoSerial = -1;
  versions = new Map<string, number>();
  tracking: { deps: Map<string, number>; volatile: boolean }[] = [];
  constructor(
    readonly type: AnyScope,
    readonly cp: Compiled,
    readonly path: string,
    readonly parent: Inst | null,
    readonly slot: string,
    public sys: Sys,
    readonly packed: Record<string, PackedStore>,
  ) {}
  get rt(): ScopeRT {
    return this.cp.rt;
  }
}

interface Op {
  kind: "comp" | "spawn" | "despawn";
  id: Id;
  comp: string | undefined;
  before: unknown;
  by: string;
}

interface NodeState {
  inst: Inst;
  node: TraceNode;
  ops: Map<string, Op>;
  copied: Set<Id>;
  spawned: Set<Id>;
  dirtyComp: Map<string, Set<Id>>;
  queue: ((parent: TraceNode) => void)[];
  stores: Set<string>;
}

class Txn {
  /** A logged tick nothing can refuse: packed stores are not snapshotted; a throw recovers by replaying the log. */
  noSnap = false;
  /** Packed stores touched in this dispatch (for the chain hash, snapshotted or not). */
  stores = new Map<Inst, Set<string>>();
  entities = new Map<Inst, Map<Id, Ent | undefined>>();
  sys = new Map<Inst, Sys>();
  packed = new Map<Inst, Map<string, Uint8Array>>();
  children = new Map<Inst, Map<string, Inst>>();
  nodeInst = new Map<TraceNode, Inst>();
}

type Item = { rule: RuleDef; self: unknown };
const NO_ITEMS: Item[] = [];

// ---------- the kernel ----------

class KernelImpl {
  root!: Inst;
  txn: Txn | null = null;
  cur: NodeState | null = null;
  phase: Phase | "process" | "setup" | null = null;
  label = "";
  serial = 0;
  records: LogRecord[] = [];
  lastPayloadKey = "";
  lastHash = "";
  initial!: Save;
  initialHash = "";
  pending: { path: string; event: string; payload: unknown }[] = [];
  rejections: Rejection[] = [];
  hashChain = false;
  /** A save every this many logged dispatches, so undo and a throwing tick replay from it (0: never). */
  checkpointEvery = CHECKPOINT_EVERY;
  /** Logged dispatches so far, repeats counted. */
  flatCount = 0;
  checkpoints: Checkpoint[] = [];
  /** Listeners from kernel.listen; empty arrays keep probes and dispatches free. */
  onProbe: ((p: ProbeEvent) => void)[] = [];
  onDispatch: ((res: DispatchResult, root: DispatchInfo) => void)[] = [];
  /** Root dispatches so far (logged, dry or setup); ties probes to the dispatch they came from. */
  seq = 0;
  mode: "log" | "dry" | "setup" | null = null;
  /** Above zero while undo rebuilds state by replaying: listeners hear nothing twice. */
  rebuilding = 0;

  constructor(readonly type: AnyScope) {}

  // ----- instances -----

  newInst(type: AnyScope, path: string, parent: Inst | null, slot: string, seed: string, sys?: Sys): Inst {
    const cp = compile(type.rt);
    const rt = cp.rt;
    const fresh: Sys = sys ?? { seed, nextId: 0, clocks: {}, rng: {}, procs: [] };
    for (const [name, decl] of Object.entries(rt.clocks)) {
      fresh.clocks[name] ??= { now: 0, acc: 0, num: decl.scale?.[0] ?? 1, den: decl.scale?.[1] ?? 1 };
    }
    for (const stream of rt.rng) fresh.rng[stream] ??= seedToState(`${fresh.seed}#${stream}`);
    const packed: Record<string, PackedStore> = {};
    for (const [name, make] of Object.entries(rt.packed)) packed[name] = make();
    return new Inst(type, cp, path, parent, slot, fresh, packed);
  }

  at(path: string): Inst {
    const inst = this.find(path);
    if (!inst) {
      throw new Error(`no scope at "${path}"; open scopes: ${this.paths().join(", ")}. Open one with ctx.open(slot, key?)`);
    }
    return inst;
  }

  /** Path -> instance lookups; an entry is trusted only while that instance is still attached. */
  pathCache = new Map<string, Inst>();

  find(path: string): Inst | undefined {
    if (path === "/") return this.root;
    const hit = this.pathCache.get(path);
    if (hit && this.attached(hit)) return hit;
    const inst = this.findSlow(path);
    if (inst) this.pathCache.set(path, inst);
    else this.pathCache.delete(path);
    return inst;
  }

  findSlow(path: string): Inst | undefined {
    if (!path.startsWith("/")) return undefined;
    let inst: Inst | undefined = this.root;
    let acc = "";
    for (const seg of path.slice(1).split("/")) {
      acc += `/${seg}`;
      inst = inst?.children.get(acc);
      if (!inst) return undefined;
    }
    return inst;
  }

  /** Walks the parent chain: each link still holds the child at its path, up to the current root. */
  attached(inst: Inst): boolean {
    let s = inst;
    for (let p = s.parent; p; s = p, p = s.parent) if (p.children.get(s.path) !== s) return false;
    return s === this.root;
  }

  paths(): string[] {
    const out: string[] = [];
    const walk = (i: Inst): void => {
      out.push(i.path);
      for (const c of i.children.values()) walk(c);
    };
    walk(this.root);
    return out;
  }

  // ----- journal -----

  journalEntity(inst: Inst, id: Id): void {
    const txn = this.txn!;
    let m = txn.entities.get(inst);
    if (!m) txn.entities.set(inst, (m = new Map()));
    if (!m.has(id)) m.set(id, inst.entities.get(id));
  }

  touchSys(inst: Inst): void {
    const txn = this.txn;
    if (txn && !txn.sys.has(inst)) txn.sys.set(inst, jsonClone(inst.sys));
  }

  touchPacked(inst: Inst, name: string): void {
    const txn = this.txn;
    if (!txn) return;
    let names = txn.stores.get(inst);
    if (!names) txn.stores.set(inst, (names = new Set()));
    if (names.has(name)) return;
    names.add(name);
    if (txn.noSnap) return;
    let m = txn.packed.get(inst);
    if (!m) txn.packed.set(inst, (m = new Map()));
    if (!m.has(name)) m.set(name, inst.packed[name]!.snapshot());
  }

  touchChildren(inst: Inst): void {
    const txn = this.txn!;
    if (!txn.children.has(inst)) txn.children.set(inst, new Map(inst.children));
  }

  rollback(): void {
    const txn = this.txn;
    if (!txn) return;
    const touched = new Set<Inst>();
    for (const [inst, m] of txn.entities) {
      touched.add(inst);
      for (const [id, prev] of m) {
        if (prev === undefined) inst.entities.delete(id);
        else inst.entities.set(id, prev);
      }
    }
    for (const [inst, sys] of txn.sys) {
      touched.add(inst);
      inst.sys = sys;
    }
    for (const [inst, snaps] of txn.packed) {
      for (const [name, bytes] of snaps) inst.packed[name]!.restore(bytes);
    }
    for (const [inst, map] of txn.children) inst.children = map;
    for (const inst of touched) this.rebuildIndexes(inst);
    for (const inst of txn.packed.keys()) inst.memo.clear();
  }

  // ----- indexes (D14): outside state, rebuilt on load and rollback -----

  rebuildIndexes(inst: Inst): void {
    inst.compIdx.clear();
    inst.sorted.clear();
    inst.relIdx.clear();
    inst.relFwd.clear();
    inst.trigIdx.clear();
    inst.trigFwd.clear();
    inst.memo.clear();
    for (const ent of inst.entities.values()) {
      for (const comp in ent) {
        if (comp === "id") continue;
        this.idxAdd(inst, comp, ent.id);
        this.valueIndex(inst, ent.id, comp, ent[comp]);
      }
    }
  }

  idxAdd(inst: Inst, comp: string, id: Id): void {
    let s = inst.compIdx.get(comp);
    if (!s) inst.compIdx.set(comp, (s = new Set()));
    if (!s.has(id)) {
      s.add(id);
      inst.sorted.delete(comp);
      inst.sorted.delete("*");
    }
  }

  idxRemove(inst: Inst, comp: string, id: Id): void {
    const s = inst.compIdx.get(comp);
    if (s?.delete(id)) {
      inst.sorted.delete(comp);
      inst.sorted.delete("*");
    }
  }

  /** Value-level indexes: relation targets and trigger events, updated when a write is finalized. */
  valueIndex(inst: Inst, id: Id, comp: string, value: unknown): void {
    const rel = inst.cp.relByComp.get(comp);
    if (rel) {
      let fwd = inst.relFwd.get(comp);
      if (!fwd) inst.relFwd.set(comp, (fwd = new Map()));
      let idx = inst.relIdx.get(comp);
      if (!idx) inst.relIdx.set(comp, (idx = new Map()));
      const old = fwd.get(id);
      if (old !== undefined) idx.get(old)?.delete(id);
      const target = (value as { of?: Id } | undefined)?.of;
      if (target === undefined) fwd.delete(id);
      else {
        fwd.set(id, target);
        let s = idx.get(target);
        if (!s) idx.set(target, (s = new Set()));
        s.add(id);
      }
    }
    if (comp === "triggers") {
      for (const ev of inst.trigFwd.get(id) ?? []) inst.trigIdx.get(ev)?.delete(id);
      inst.trigFwd.delete(id);
      const rows = value as TriggerRow[] | undefined;
      if (rows && rows.length) {
        const evs = new Set(rows.map((r) => r.on));
        inst.trigFwd.set(id, evs);
        for (const ev of evs) {
          let s = inst.trigIdx.get(ev);
          if (!s) inst.trigIdx.set(ev, (s = new Set()));
          s.add(id);
        }
      }
    }
  }

  sortedIds(inst: Inst, comp: string): Id[] {
    let ids = inst.sorted.get(comp);
    if (!ids) {
      ids = comp === "*" ? [...inst.entities.keys()] : [...(inst.compIdx.get(comp) ?? [])];
      ids.sort(byId);
      inst.sorted.set(comp, ids);
    }
    return ids;
  }

  // ----- derived dependency tracking (D32) -----

  track(inst: Inst, key: string): void {
    const top = inst.tracking[inst.tracking.length - 1];
    if (top && !top.deps.has(key)) top.deps.set(key, inst.versions.get(key) ?? 0);
  }

  volatile(inst: Inst): void {
    for (const t of inst.tracking) t.volatile = true;
  }

  bump(inst: Inst, comp: string): void {
    inst.versions.set(`c:${comp}`, (inst.versions.get(`c:${comp}`) ?? 0) + 1);
    inst.versions.set("*", (inst.versions.get("*") ?? 0) + 1);
  }

  bumpClock(inst: Inst): void {
    inst.versions.set("clock", (inst.versions.get("clock") ?? 0) + 1);
  }

  derived(inst: Inst, name: string, args: unknown[]): unknown {
    const fn = inst.rt.derived[name];
    if (!fn) {
      throw new Error(`unknown derived "${name}" in ${inst.rt.name}; declared: ${Object.keys(inst.rt.derived).join(", ") || "(none)"}`);
    }
    if (inst.memoSerial !== this.serial) {
      inst.memo.clear();
      inst.memoSerial = this.serial;
    }
    const key = args.length ? `${name}${canonicalJson(args)}` : name;
    const hit = inst.memo.get(key);
    if (hit) {
      let fresh = true;
      for (const [k, v] of hit.deps) {
        if ((inst.versions.get(k) ?? 0) !== v) {
          fresh = false;
          break;
        }
      }
      if (fresh) {
        const top = inst.tracking[inst.tracking.length - 1];
        if (top) for (const [k, v] of hit.deps) if (!top.deps.has(k)) top.deps.set(k, v);
        return hit.value;
      }
    }
    const frame = { deps: new Map<string, number>(), volatile: false };
    inst.tracking.push(frame);
    let value: unknown;
    try {
      value = fn(new ViewImpl(this, inst), ...args);
    } finally {
      inst.tracking.pop();
    }
    const top = inst.tracking[inst.tracking.length - 1];
    if (top) {
      for (const [k, v] of frame.deps) if (!top.deps.has(k)) top.deps.set(k, v);
      if (frame.volatile) top.volatile = true;
    }
    if (!frame.volatile) inst.memo.set(key, { value, deps: frame.deps });
    return value;
  }

  exportsOf(inst: Inst): unknown {
    const fn = inst.rt.exports;
    if (!fn) return deepFreeze({});
    return deepFreeze(fn(new ViewImpl(this, inst)));
  }

  // ----- nodes -----

  beginNode(inst: Inst, node: TraceNode, parent: TraceNode | null): NodeState {
    if (parent) parent.children.push(node);
    this.txn?.nodeInst.set(node, inst);
    const ns: NodeState = {
      inst,
      node,
      ops: new Map(),
      copied: new Set(),
      spawned: new Set(),
      dirtyComp: new Map(),
      queue: [],
      stores: new Set(),
    };
    this.cur = ns;
    return ns;
  }

  markDirty(ns: NodeState, comp: string, id: Id): void {
    let s = ns.dirtyComp.get(comp);
    if (!s) ns.dirtyComp.set(comp, (s = new Set()));
    s.add(id);
  }

  validate(inst: Inst, id: Id, comp: string, value: unknown, by: string): unknown {
    const schema = inst.rt.components[comp]!;
    const r = schema.safeParse(value);
    if (!r.success) {
      throw new Error(`${id}.${comp} fails its schema after "${by}" in ${inst.path}: ${zodIssues(r.error)}. Fix the write in "${by}"`);
    }
    const out = r.data as unknown;
    if (comp === "triggers") this.checkTriggers(inst, id, out as TriggerRow[]);
    canonicalJson(out);
    return deepFreeze(out);
  }

  checkTriggers(inst: Inst, id: Id, rows: TriggerRow[]): void {
    for (const [i, row] of rows.entries()) {
      const rule = inst.cp.named.get(row.rule);
      if (!rule) {
        throw new Error(
          `${id}.triggers[${i}] names rule "${row.rule}", which is not registered in ${inst.rt.name}; register it with r.named("${row.rule}").on("${row.on}")... Named rules: ${[...inst.cp.named.keys()].join(", ") || "(none)"}`,
        );
      }
      if (rule.event !== row.on) {
        throw new Error(`${id}.triggers[${i}] listens to "${row.on}" but rule "${row.rule}" is registered on "${rule.event}"; make them agree`);
      }
      if (rule.params) {
        const r = rule.params.safeParse(row.params);
        if (!r.success) throw new Error(`${id}.triggers[${i}] params for rule "${row.rule}" are invalid: ${zodIssues(r.error)}`);
      }
    }
  }

  finalize(ns: NodeState): void {
    const { inst, node } = ns;
    for (const op of ns.ops.values()) {
      if (op.kind === "despawn") {
        node.changes.push({ id: op.id, before: op.before, by: op.by });
        continue;
      }
      const ent = inst.entities.get(op.id);
      if (!ent) continue;
      if (op.kind === "spawn") {
        for (const comp in ent) {
          if (comp === "id") continue;
          ent[comp] = this.validate(inst, op.id, comp, ent[comp], op.by);
          this.valueIndex(inst, op.id, comp, ent[comp]);
          this.bump(inst, comp);
        }
        Object.freeze(ent);
        owners.set(ent, inst);
        node.changes.push({ id: op.id, after: ent, by: op.by });
        continue;
      }
      const comp = op.comp!;
      let after = ent[comp];
      if (after !== undefined) {
        after = this.validate(inst, op.id, comp, after, op.by);
        ent[comp] = after;
      }
      this.bump(inst, comp);
      if (deepEqual(op.before, after)) continue;
      this.valueIndex(inst, op.id, comp, after);
      const change: { id: Id; comp: string; before?: unknown; after?: unknown; by: string } = { id: op.id, comp, by: op.by };
      if (op.before !== undefined) change.before = op.before;
      if (after !== undefined) change.after = after;
      node.changes.push(change);
    }
    for (const id of ns.copied) {
      const ent = inst.entities.get(id);
      if (ent && !Object.isFrozen(ent)) {
        Object.freeze(ent);
        owners.set(ent, inst);
      }
    }
    if (ns.stores.size) {
      node.stores = [...ns.stores].map((name) => ({ name, summary: inst.packed[name]!.describe?.() }));
    }
    if (this.cur === ns) this.cur = null;
  }

  runQueue(ns: NodeState): void {
    for (const run of ns.queue) run(ns.node);
  }

  // ----- event resolution (D17-D20) -----

  checkRefs(inst: Inst, event: string, def: EventDef | undefined, payload: Record<string, unknown>): Rejection | undefined {
    if (!def) return undefined;
    for (const f of def.refFields) {
      const v = payload[f];
      if (v === undefined || v === null) continue;
      if (!inst.entities.has(v as Id)) {
        return { scope: inst.path, event, reason: `${event}.${f}: no entity "${String(v)}" in ${inst.path}` };
      }
    }
    return undefined;
  }

  matches(inst: Inst, when: unknown, payload: Record<string, unknown>): boolean {
    for (const k in when as Record<string, unknown>) {
      const pat = (when as Record<string, unknown>)[k];
      const v = payload[k];
      if (pat !== null && typeof pat === "object" && !Array.isArray(pat) && typeof v === "string") {
        // A ref (or lifecycle id) matches against the entity it points at.
        const ent = inst.entities.get(v);
        if (!ent || !matchValue(pat, ent)) return false;
      } else if (!matchValue(pat, v)) return false;
    }
    return true;
  }

  rulesFor(inst: Inst, event: string, phase: Phase, def: EventDef | undefined, payload: Record<string, unknown>): Item[] {
    const globalItems = inst.cp.items.get(event)?.[phase] ?? NO_ITEMS;
    const trig = inst.trigIdx.get(event);
    const dirtyTrig = this.cur?.inst === inst ? this.cur.dirtyComp.get("triggers") : undefined;
    if (!trig?.size && !dirtyTrig?.size) return globalItems;
    const globals = inst.cp.byEvent.get(event)?.[phase] ?? [];
    const ids = new Set<Id>(trig ?? []);
    for (const id of dirtyTrig ?? []) ids.add(id);
    const subjectField = def?.subject ?? (LIFECYCLE.has(event) ? "id" : undefined);
    const subject = subjectField ? payload[subjectField] : undefined;
    const trigItems: (Item & { n: number })[] = [];
    for (const id of [...ids].sort(byId)) {
      const ent = inst.entities.get(id);
      const rows = ent?.triggers as TriggerRow[] | undefined;
      if (!rows) continue;
      for (const row of rows) {
        if (row.on !== event) continue;
        if (subjectField && !row.any && subject !== id) continue;
        const rule = inst.cp.named.get(row.rule);
        if (!rule) throw new Error(`${id}.triggers names unregistered rule "${row.rule}"`);
        if (rule.phase !== phase) continue;
        trigItems.push({ rule, self: deepFreeze({ id, params: row.params }), n: trigItems.length });
      }
    }
    if (!trigItems.length) return globalItems;
    const all: (Item & { kind: number; n: number })[] = [
      ...globals.map((rule, n) => ({ rule, self: undefined, kind: 0, n })),
      ...trigItems.map((t) => ({ ...t, kind: 1 })),
    ];
    all.sort((a, b) => b.rule.priority - a.rule.priority || a.kind - b.kind || a.n - b.n);
    return all;
  }

  resolve(inst: Inst, event: string, payload: Record<string, unknown>, parent: TraceNode | null): TraceNode {
    if (!this.attached(inst)) {
      throw new Error(`scope ${inst.path} was closed before its queued event "${event}" resolved; close it after the event, or check before sending`);
    }
    const node: TraceNode = { scope: inst.path, event, payload, changes: [], stores: [], children: [] };
    const ns = this.beginNode(inst, node, parent);
    const ctx = new CtxImpl(this, inst, ns);
    const def = inst.rt.events[event];
    let pl = deepFreeze(payload);
    let rejected = this.checkRefs(inst, event, def, pl);
    if (!rejected) {
      for (const phase of PHASES) {
        const list = this.rulesFor(inst, event, phase, def, pl);
        if (!list.length) continue;
        if (phase === "modify") pl = jsonClone(pl);
        this.phase = phase;
        for (const { rule, self } of list) {
          if (rule.when !== undefined && !this.matches(inst, rule.when, pl)) continue;
          this.label = rule.label;
          let out: unknown;
          try {
            out = rule.fn(pl, ctx, self);
          } catch (e) {
            throw explainFrozen(e, rule.label);
          }
          if (phase === "check" && out !== undefined) {
            if (typeof out !== "string") {
              throw new Error(`check rule "${rule.label}" returned ${typeof out}; return a reason string to refuse, or nothing to allow`);
            }
            rejected = { scope: inst.path, event, reason: out, rule: rule.label };
            break;
          }
        }
        if (rejected) break;
        if (phase === "modify") {
          if (def) {
            const r = def.schema.safeParse(pl);
            if (!r.success) {
              throw new Error(`payload of "${event}" is invalid after its modify rules: ${zodIssues(r.error)}. Fix the modify rule`);
            }
            pl = r.data as Record<string, unknown>;
          }
          pl = deepFreeze(pl);
          rejected = this.checkRefs(inst, event, def, pl);
          if (rejected) break;
        }
      }
    }
    this.phase = null;
    node.payload = pl;
    if (rejected) {
      node.rejected = rejected;
      this.note(rejected);
    }
    this.finalize(ns);
    this.runQueue(ns);
    if (!rejected) this.wake(inst, event, pl, node);
    return node;
  }

  note(r: Rejection): void {
    this.rejections.push(r);
    if (this.rejections.length > 100) this.rejections.shift();
  }

  // ----- processes (D36) -----

  wake(inst: Inst, event: string, payload: unknown, parent: TraceNode): void {
    const waiting = inst.sys.procs.filter((p) => p.waitEvent === event).map((p) => p.id);
    if (!waiting.length) return;
    waiting.sort(byId);
    for (const pid of waiting) {
      const row = inst.sys.procs.find((p) => p.id === pid);
      if (row && row.waitEvent === event) this.runStep(inst, pid, parent, { event, payload });
    }
  }

  runStep(inst: Inst, pid: Id, parent: TraceNode, woke?: { event: string; payload: unknown }): void {
    if (!this.attached(inst)) return;
    this.touchSys(inst);
    const idx = inst.sys.procs.findIndex((p) => p.id === pid);
    if (idx < 0) return;
    const row = inst.sys.procs[idx]!;
    if (row.type === "after") {
      inst.sys.procs.splice(idx, 1);
      const { event, payload } = row.locals as { event: string; payload: Record<string, unknown> };
      this.resolve(inst, event, jsonClone(payload), parent);
      return;
    }
    const def = inst.rt.processes[row.type];
    if (!def) throw new Error(`process ${pid} has type "${row.type}", which ${inst.rt.name} does not declare; add a migration for old saves`);
    const stepFn = def.states[row.state];
    if (!stepFn) {
      throw new Error(`process ${pid} is in state "${row.state}", which "${row.type}" does not declare; states: ${Object.keys(def.states).join(", ")}`);
    }
    const node: TraceNode = {
      scope: inst.path,
      event: `process:${row.type}`,
      payload: deepFreeze({ pid, state: row.state }),
      changes: [],
      stores: [],
      children: [],
    };
    const ns = this.beginNode(inst, node, parent);
    const ctx = new CtxImpl(this, inst, ns);
    this.phase = "process";
    this.label = `process:${row.type}.${row.state}`;
    const handle = { id: pid, type: row.type, state: row.state, locals: row.locals, ...(woke ? { woke } : {}) };
    let res: StepResult | undefined;
    try {
      res = stepFn(handle, ctx) as StepResult | undefined;
    } catch (e) {
      throw explainFrozen(e, this.label);
    }
    this.phase = null;
    const where = `process ${pid} (${row.type}.${row.state})`;
    if (!res || typeof res !== "object" || !("kind" in res)) {
      throw new Error(`${where} returned ${String(res)}; return wait(ticks, next?), until(event, next?) or done()`);
    }
    try {
      canonicalJson(handle.locals);
    } catch (e) {
      throw new Error(`${where}: locals must stay plain JSON (${(e as Error).message})`);
    }
    const live = inst.sys.procs.find((p) => p.id === pid);
    if (live) {
      live.locals = jsonClone(handle.locals);
      if (res.kind === "done") inst.sys.procs.splice(inst.sys.procs.indexOf(live), 1);
      else {
        const next = res.next ?? live.state;
        if (!(next in def.states)) {
          throw new Error(`${where} moves to unknown state "${next}"; states: ${Object.keys(def.states).join(", ")}`);
        }
        live.state = next;
        if (res.kind === "wait") {
          if (!Number.isInteger(res.ticks) || res.ticks < 1) {
            throw new Error(`${where}: wait(${res.ticks}) needs a whole number of ticks >= 1`);
          }
          live.wakeAt = inst.sys.clocks[live.clock]!.now + res.ticks;
          live.waitEvent = null;
        } else if (res.kind === "until") {
          if (!inst.cp.known.has(res.event)) {
            throw new Error(`${where}: until("${res.event}") names an event ${inst.rt.name} does not know; events: ${[...inst.cp.known].join(", ")}`);
          }
          live.wakeAt = null;
          live.waitEvent = res.event;
        } else {
          throw new Error(`${where} returned an unknown step kind; use wait, until or done`);
        }
      }
    }
    this.finalize(ns);
    this.runQueue(ns);
  }

  // ----- clocks (D22) -----

  tickClock(inst: Inst, clock: string, parent: TraceNode | null): TraceNode {
    this.touchSys(inst);
    const c = inst.sys.clocks[clock]!;
    c.now += 1;
    this.bumpClock(inst);
    const node = this.resolve(inst, `tick:${clock}`, { tick: c.now }, parent);
    if (node.rejected || !this.attached(inst)) return node;
    const due = inst.sys.procs
      .filter((p) => p.clock === clock && p.wakeAt !== null && p.wakeAt <= c.now)
      .sort((a, b) => a.wakeAt! - b.wakeAt! || byId(a.id, b.id))
      .map((p) => p.id);
    for (const pid of due) {
      const row = inst.sys.procs.find((p) => p.id === pid);
      if (row && row.wakeAt !== null && row.wakeAt <= c.now) this.runStep(inst, pid, node);
    }
    for (const [cinst, cname] of this.childClocks(inst, clock)) {
      this.touchSys(cinst);
      const cc = cinst.sys.clocks[cname]!;
      cc.acc += cc.num;
      const n = Math.floor(cc.acc / cc.den);
      cc.acc -= n * cc.den;
      for (let i = 0; i < n && this.attached(cinst); i++) this.tickClock(cinst, cname, node);
    }
    return node;
  }

  childClocks(inst: Inst, clock: string): [Inst, string][] {
    const out: [Inst, string][] = [];
    const visit = (d: Inst): void => {
      for (const [name, decl] of Object.entries(d.rt.clocks)) {
        if (!decl.parent || decl.parent !== clock) continue;
        if (this.clockOwner(d, decl.parent, name) === inst) out.push([d, name]);
      }
      for (const c of d.children.values()) visit(c);
    };
    visit(inst);
    return out;
  }

  clockOwner(from: Inst, name: string, self: string): Inst | undefined {
    for (let s: Inst | null = from; s; s = s.parent) {
      if (name in s.rt.clocks && !(s === from && name === self)) return s;
    }
    return undefined;
  }

  advanceElapsed(inst: Inst, clock: string, n: number, parent: TraceNode): void {
    this.touchSys(inst);
    const c = inst.sys.clocks[clock]!;
    const target = c.now + n;
    for (;;) {
      const due = inst.sys.procs
        .filter((p) => p.clock === clock && p.wakeAt !== null && p.wakeAt <= target)
        .sort((a, b) => a.wakeAt! - b.wakeAt! || byId(a.id, b.id))[0];
      if (!due) break;
      c.now = Math.max(c.now, due.wakeAt!);
      this.bumpClock(inst);
      this.runStep(inst, due.id, parent);
    }
    c.now = target;
    this.bumpClock(inst);
  }

  // ----- root dispatch -----

  runRoot(inst: Inst, event: string, payload: unknown, mode: "log" | "dry" | "setup", body: () => TraceNode): DispatchResult {
    if (this.txn) {
      throw new Error(
        "kernel.dispatch/tick was called while another dispatch is running; inside rules use ctx.emit, ctx.send or ctx.after",
      );
    }
    const txn = (this.txn = new Txn());
    const seq = ++this.seq;
    this.mode = mode;
    // A logged tick with no check rule or trigger on it cannot be refused, so the packed
    // stores (the bulk of a tick's copying) are not snapshotted; if it throws anyway, the
    // state before it is rebuilt by replaying the log, as undo(0) does.
    txn.noSnap = mode === "log" && event.startsWith("tick:") && !inst.cp.byEvent.get(event)?.check.length && !inst.trigIdx.get(event)?.size;
    this.serial++;
    const restore = installGuards();
    let node: TraceNode;
    try {
      node = body();
    } catch (e) {
      restore();
      this.abort(txn);
      throw e;
    }
    restore();
    if (node.rejected) {
      this.abort(txn);
      return this.heard(seq, inst, event, payload, mode, { ok: false, rejection: node.rejected, trace: node });
    }
    if (mode === "dry") {
      this.rollback();
      this.endRun();
      return { ok: true, trace: node };
    }
    if (mode === "log" && inst.rt.logged) {
      let hash: string;
      try {
        hash = this.hashChain ? this.chainHash(node) : "";
      } catch (e) {
        this.abort(txn);
        throw e;
      }
      this.append({ path: inst.path, event, payload, hash });
    }
    this.endRun();
    if (mode === "log" && this.checkpointEvery && !this.rebuilding && this.flatCount % this.checkpointEvery === 0 && this.flatCount) {
      this.checkpoint();
    }
    return this.heard(seq, inst, event, payload, mode, { ok: true, trace: node });
  }

  /** Hands a finished logged dispatch (accepted or refused) to kernel.listen's dispatch listeners. */
  heard(seq: number, inst: Inst, event: string, payload: unknown, mode: string, res: DispatchResult): DispatchResult {
    if (mode === "log" && this.onDispatch.length && !this.rebuilding) {
      const info: DispatchInfo = { seq, path: inst.path, event, payload };
      for (const fn of this.onDispatch) fn(res, info);
    }
    return res;
  }

  /** Rolls a failed dispatch back; packed stores it did not snapshot come back by replaying the log. */
  abort(txn: Txn): void {
    const replay = txn.noSnap && txn.stores.size > 0;
    this.rollback();
    this.endRun();
    if (replay) this.undo(0);
  }

  endRun(): void {
    this.txn = null;
    this.cur = null;
    this.phase = null;
    this.mode = null;
    this.serial++;
  }

  chainHash(root: TraceNode): string {
    const txn = this.txn!;
    const parts: unknown[] = [];
    const walk = (n: TraceNode): void => {
      const inst = txn.nodeInst.get(n);
      if (inst?.rt.logged) {
        for (const ch of n.changes) parts.push([n.scope, ch.id, ch.comp ?? null, ch.after === undefined ? null : ch.after]);
      }
      for (const c of n.children) walk(c);
    };
    walk(root);
    for (const inst of txn.sys.keys()) if (inst.rt.logged && this.attached(inst)) parts.push(["sys", inst.path, inst.sys]);
    for (const [inst, names] of txn.stores) {
      if (!inst.rt.logged) continue;
      for (const name of names) parts.push(["packed", inst.path, name, inst.packed[name]!.hash()]);
    }
    for (const inst of txn.children.keys()) {
      if (inst.rt.logged) {
        parts.push(["children", inst.path, [...inst.children.values()].filter((c) => c.rt.logged).map((c) => c.path)]);
      }
    }
    const text = this.lastHash + canonicalJson(parts);
    return fnv1a(text) + fnv1a(text, 0x050c5d1f);
  }

  append(rec: LogRecord): void {
    this.flatCount++;
    const key = `${rec.path}\u0000${rec.event}\u0000${canonicalJson(rec.payload)}`;
    const last = this.records[this.records.length - 1];
    this.lastHash = rec.hash;
    if (last && key === this.lastPayloadKey) {
      last.repeat = (last.repeat ?? 1) + 1;
      last.hash = rec.hash;
      return;
    }
    this.lastPayloadKey = key;
    this.records.push({ path: rec.path, event: rec.event, payload: jsonClone(rec.payload), hash: rec.hash });
  }

  // ----- public operations -----

  parseInput(inst: Inst, event: string, payload: unknown, verb: string): Record<string, unknown> {
    if (event.startsWith("tick:")) {
      throw new Error(`${verb}("${inst.path}", "${event}"): ticks go through kernel.tick(path, clock)`);
    }
    const def = inst.rt.events[event];
    if (!def) {
      const inputs = Object.entries(inst.rt.events).filter(([, d]) => d.input).map(([n]) => n);
      throw new Error(`${verb}: unknown event "${event}" in ${inst.rt.name} at ${inst.path}; input events: ${inputs.join(", ") || "(none)"}`);
    }
    if (!def.input) {
      throw new Error(
        `${verb}: "${event}" is not an input event of ${inst.rt.name}; only input events and driver ticks may be dispatched from outside (D52). Declare it with input(...) if it is player input, or dispatch the input that emits it`,
      );
    }
    const r = def.schema.safeParse(payload);
    if (!r.success) throw new Error(`${verb}: bad payload for "${event}": ${zodIssues(r.error)}`);
    return r.data as Record<string, unknown>;
  }

  dispatch(path: string, event: string, payload: unknown, mode: "log" | "dry" = "log"): DispatchResult {
    const inst = this.at(path);
    const parsed = this.parseInput(inst, event, payload, mode === "dry" ? "kernel.dry" : "kernel.dispatch");
    return this.runRoot(inst, event, parsed, mode, () => this.resolve(inst, event, jsonClone(parsed), null));
  }

  queue(path: string, event: string, payload: unknown): void {
    this.parseInput(this.at(path), event, payload, "kernel.queue");
    this.pending.push({ path, event, payload });
  }

  tick(path: string, clock: string): DispatchResult {
    const inputs: DispatchResult[] = [];
    while (this.pending.length) {
      const q = this.pending.shift()!;
      inputs.push(this.dispatch(q.path, q.event, q.payload));
    }
    const inst = this.at(path);
    const decl = inst.rt.clocks[clock];
    if (!decl) {
      throw new Error(`kernel.tick: ${inst.rt.name} at ${path} has no clock "${clock}"; clocks: ${Object.keys(inst.rt.clocks).join(", ") || "(none)"}`);
    }
    if (!decl.driver) {
      throw new Error(
        `kernel.tick: clock "${clock}" of ${inst.rt.name} is not a driver; only driver clocks are ticked from outside (child clocks follow their parent, elapsed clocks use ctx.advance)`,
      );
    }
    const res = this.runRoot(inst, `tick:${clock}`, {}, "log", () => this.tickClock(inst, clock, null));
    if (inputs.length) res.inputs = inputs;
    return res;
  }

  setup(fn: AnyFn): void {
    const inst = this.root;
    this.runRoot(inst, "setup", {}, "setup", () => {
      const node: TraceNode = { scope: "/", event: "setup", payload: {}, changes: [], stores: [], children: [] };
      const ns = this.beginNode(inst, node, null);
      this.phase = "setup";
      this.label = "setup";
      try {
        fn(new CtxImpl(this, inst, ns));
      } catch (e) {
        throw explainFrozen(e, "setup");
      }
      this.phase = null;
      this.finalize(ns);
      this.runQueue(ns);
      return node;
    });
  }

  options(path: string, event: string): unknown[] {
    const inst = this.at(path);
    const fn = inst.rt.options[event];
    if (!fn) throw new Error(`kernel.options: ${inst.rt.name} declares no options for "${event}"; add .options({ "${event}": (v) => [...] })`);
    return fn(new ViewImpl(this, inst)) as unknown[];
  }

  read(path: string, type: AnyScope): unknown {
    const inst = this.at(path);
    if (inst.rt.name !== type.rt.name) throw new Error(`read("${path}"): the scope there is a ${inst.rt.name}, not a ${type.rt.name}`);
    return this.exportsOf(inst);
  }

  // ----- saves (D30) -----

  save(): Save {
    if (this.txn) throw new Error("kernel.save() during a dispatch; save between dispatches");
    const scopes: Record<string, SavedScope> = {};
    const walk = (inst: Inst): void => {
      if (!inst.rt.saved) return;
      const packed: Record<string, unknown> = {};
      for (const [name, store] of Object.entries(inst.packed)) packed[name] = store.save ? store.save() : toBase64(store.snapshot());
      scopes[inst.path] = {
        type: inst.rt.name,
        version: inst.rt.migrations.length,
        entities: this.sortedIds(inst, "*").map((id) => inst.entities.get(id)!),
        sys: jsonClone(inst.sys) as unknown as Json,
        packed,
        children: [...inst.children.values()].filter((c) => c.rt.saved).map((c) => c.path),
      };
      for (const c of inst.children.values()) walk(c);
    };
    walk(this.root);
    return { format: SAVE_FORMAT, scopes };
  }

  loadScope(type: AnyScope, path: string, parent: Inst | null, save: Save): Inst {
    const saved = save.scopes[path];
    if (!saved) throw new Error(`save has no scope at "${path}"`);
    const rt = type.rt;
    if (saved.type !== rt.name) throw new Error(`save: scope at "${path}" is a "${saved.type}", expected "${rt.name}"`);
    const current = rt.migrations.length;
    if (saved.version > current) {
      throw new Error(`save: ${rt.name} at "${path}" is version ${saved.version}, newer than this code's ${current}; load it with the newer code`);
    }
    let data: ScopeData = jsonClone({ entities: saved.entities, sys: saved.sys, packed: saved.packed, children: saved.children });
    for (let v = saved.version; v < current; v++) {
      try {
        data = rt.migrations[v]!(data);
      } catch (e) {
        throw new Error(`save: migration ${v} -> ${v + 1} of ${rt.name} failed at "${path}": ${(e as Error).message}`);
      }
    }
    const sys = data.sys as unknown as Sys;
    if (!sys || typeof sys !== "object" || typeof sys.nextId !== "number" || !Array.isArray(sys.procs)) {
      throw new Error(`save: sys of ${rt.name} at "${path}" is malformed; a migration must keep sys { seed, nextId, clocks, rng, procs }`);
    }
    const seg = path.slice(path.lastIndexOf("/") + 1);
    const slot = parent ? (seg.includes(":") ? seg.slice(0, seg.indexOf(":")) : seg) : "";
    const inst = this.newInst(type, path, parent, slot, sys.seed, sys);
    for (const raw of data.entities) {
      const id = raw.id;
      if (typeof id !== "string") throw new Error(`save: an entity of ${rt.name} at "${path}" has no string id`);
      const ent: Ent = { id };
      for (const [comp, value] of Object.entries(raw)) {
        if (comp === "id") continue;
        if (!(comp in rt.components)) {
          throw new Error(`save: ${id} has component "${comp}", which ${rt.name} does not declare; add a migration that renames or drops it`);
        }
        ent[comp] = this.validate(inst, id, comp, value, "load");
      }
      Object.freeze(ent);
      owners.set(ent, inst);
      inst.entities.set(id, ent);
    }
    for (const [name, saved] of Object.entries(data.packed)) {
      const store = inst.packed[name];
      if (!store) throw new Error(`save: packed store "${name}" is not declared by ${rt.name}; add a migration that drops it`);
      try {
        if (store.load) store.load(saved);
        else if (typeof saved === "string") store.restore(fromBase64(saved));
        else throw new Error("the store has no load(), so its save must be a base64 snapshot");
      } catch (e) {
        throw new Error(`save: packed store "${name}" of ${rt.name} at "${path}": ${(e as Error).message}`);
      }
    }
    this.rebuildIndexes(inst);
    for (const cpath of data.children) {
      const cseg = cpath.slice(cpath.lastIndexOf("/") + 1);
      const cslot = cseg.includes(":") ? cseg.slice(0, cseg.indexOf(":")) : cseg;
      const ctype = rt.children[cslot];
      if (!ctype) throw new Error(`save: child "${cpath}" is in slot "${cslot}", which ${rt.name} does not declare`);
      inst.children.set(cpath, this.loadScope(ctype, cpath, inst, save));
    }
    return inst;
  }

  versions(): Record<string, number> {
    const out: Record<string, number> = {};
    const walk = (t: AnyScope): void => {
      if (t.rt.name in out) return;
      out[t.rt.name] = t.rt.migrations.length;
      for (const c of Object.values(t.rt.children)) walk(c);
    };
    walk(this.type);
    return out;
  }

  startLog(): void {
    this.initial = this.save();
    this.initialHash = hashValue(this.initial);
    this.lastHash = this.initialHash;
    this.records = [];
    this.lastPayloadKey = "";
    this.flatCount = 0;
    this.checkpoints = [];
  }

  /** Saves the state with enough of the log's tail to resume appending from it. */
  checkpoint(): void {
    const last = this.records[this.records.length - 1];
    this.checkpoints.push({
      at: this.flatCount,
      save: this.save(),
      hash: this.lastHash,
      records: this.records.length,
      lastRepeat: last?.repeat,
      lastKey: this.lastPayloadKey,
    });
    if (this.checkpoints.length > CHECKPOINTS_KEPT) this.checkpoints.shift();
  }

  logFile(): LogFile {
    return {
      format: LOG_FORMAT,
      versions: this.versions(),
      initial: this.initial,
      initialHash: this.initialHash,
      records: this.records.map((r) => ({ ...r })),
    };
  }

  apply(rec: LogRecord): DispatchResult {
    if (rec.event.startsWith("tick:")) return this.tick(rec.path, rec.event.slice(5));
    return this.dispatch(rec.path, rec.event, rec.payload);
  }

  undo(n: number): void {
    if (this.txn) throw new Error("kernel.undo during a dispatch");
    if (!Number.isInteger(n) || n < 0) throw new Error(`undo(${n}): n must be a whole number >= 0`);
    const flat: LogRecord[] = [];
    for (const r of this.records) for (let i = 0; i < (r.repeat ?? 1); i++) flat.push(r);
    if (n > flat.length) throw new Error(`undo(${n}): only ${flat.length} logged dispatches to undo`);
    const keepLen = flat.length - n;
    // Rebuild from the latest checkpoint at or before the kept length, else from the start.
    this.checkpoints = this.checkpoints.filter((c) => c.at <= keepLen);
    const cp = this.checkpoints[this.checkpoints.length - 1];
    this.pending = [];
    if (cp) {
      this.root = this.loadScope(this.type, "/", null, cp.save);
      this.lastHash = cp.hash;
      this.records = this.records.slice(0, cp.records);
      const last = this.records[this.records.length - 1];
      if (last) {
        if (cp.lastRepeat === undefined) delete last.repeat;
        else last.repeat = cp.lastRepeat;
        last.hash = cp.hash;
      }
      this.lastPayloadKey = cp.lastKey;
      this.flatCount = cp.at;
    } else {
      this.root = this.loadScope(this.type, "/", null, this.initial);
      this.lastHash = this.initialHash;
      this.records = [];
      this.lastPayloadKey = "";
      this.flatCount = 0;
    }
    const keep = flat.slice(cp?.at ?? 0, keepLen);
    this.rebuilding++;
    try {
      for (const rec of keep) {
        const r = this.apply(rec);
        if (!r.ok) throw new Error(`undo: re-applying ${rec.event} was refused (${r.rejection.reason}); the code changed since it was logged`);
      }
    } finally {
      this.rebuilding--;
    }
  }
}

// ---------- read view and ctx objects ----------

class ViewImpl {
  constructor(
    readonly k: KernelImpl,
    /** A scope instance, or a path resolved on every call (views handed out by kernel.view survive undo). */
    private readonly target: Inst | string,
  ) {}

  get inst(): Inst {
    const t = this.target;
    return typeof t === "string" ? this.k.at(t) : t;
  }

  get path(): string {
    return this.inst.path;
  }

  get(id: Id): Ent | undefined {
    const inst = this.inst;
    this.k.track(inst, "*");
    return inst.entities.get(id);
  }

  req(id: Id, ...comps: string[]): Ent {
    const ent = this.get(id);
    if (!ent) throw new Error(`req("${id}"): no entity "${id}" in ${this.inst.path}`);
    for (const c of comps) {
      if (!(c in ent)) throw new Error(`req("${id}", "${c}"): ${id} has no "${c}" component; it has ${Object.keys(ent).filter((k) => k !== "id").join(", ") || "none"}`);
    }
    return ent;
  }

  has(e: Ent | undefined, comp: string): boolean {
    const inst = this.inst;
    if (inst.tracking.length) this.k.track(inst, `c:${comp}`);
    return e !== undefined && comp in e;
  }

  q(...comps: string[]): Ent[] {
    const { k, inst } = this;
    for (const c of comps) {
      if (!(c in inst.rt.components)) throw new Error(`q("${c}"): ${inst.rt.name} has no component "${c}"; components: ${Object.keys(inst.rt.components).join(", ")}`);
      if (inst.tracking.length) k.track(inst, `c:${c}`);
    }
    if (!comps.length) {
      k.track(inst, "*");
      return k.sortedIds(inst, "*").map((id) => inst.entities.get(id)!);
    }
    let best = comps[0]!;
    for (const c of comps) if ((inst.compIdx.get(c)?.size ?? 0) < (inst.compIdx.get(best)?.size ?? 0)) best = c;
    const out: Ent[] = [];
    for (const id of k.sortedIds(inst, best)) {
      const e = inst.entities.get(id);
      if (!e) continue;
      let ok = true;
      for (const c of comps) {
        if (!(c in e)) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(e);
    }
    return out;
  }

  related(relation: string, target: Id): Ent[] {
    const { k, inst } = this;
    const rel = inst.rt.relations[relation];
    if (!rel) throw new Error(`related("${relation}"): ${inst.rt.name} has no relation "${relation}"; relations: ${Object.keys(inst.rt.relations).join(", ") || "(none)"}`);
    k.track(inst, `c:${rel.comp}`);
    const ids = new Set<Id>(inst.relIdx.get(rel.comp)?.get(target) ?? []);
    if (k.cur?.inst === inst) for (const id of k.cur.dirtyComp.get(rel.comp) ?? []) ids.add(id);
    const out: Ent[] = [];
    for (const id of ids) {
      const e = inst.entities.get(id);
      const v = e?.[rel.comp] as Record<string, unknown> | undefined;
      if (e && v && v.of === target) out.push(e);
    }
    const order = rel.ordered;
    out.sort((a, b) => {
      if (order) {
        const d = ((a[rel.comp] as Record<string, number>)[order] ?? 0) - ((b[rel.comp] as Record<string, number>)[order] ?? 0);
        if (d) return d;
      }
      return byId(a.id, b.id);
    });
    return out;
  }

  derived(name: string, ...args: unknown[]): unknown {
    return this.k.derived(this.inst, name, args);
  }

  now(clock: string): number {
    const c = this.inst.sys.clocks[clock];
    if (!c) throw new Error(`now("${clock}"): ${this.inst.rt.name} has no clock "${clock}"; clocks: ${Object.keys(this.inst.rt.clocks).join(", ") || "(none)"}`);
    this.k.track(this.inst, "clock");
    return c.now;
  }

  packed(name: string): PackedStore {
    const { k, inst } = this;
    const store = inst.packed[name];
    if (!store) throw new Error(`packed("${name}"): ${inst.rt.name} has no packed store "${name}"; stores: ${Object.keys(inst.packed).join(", ") || "(none)"}`);
    k.volatile(inst);
    if (k.txn) {
      k.touchPacked(inst, name);
      if (k.cur?.inst === inst) k.cur.stores.add(name);
    }
    return store;
  }

  read(path: string, type: AnyScope): unknown {
    const { k, inst } = this;
    const target = k.at(path);
    if (target.rt.name !== type.rt.name) throw new Error(`read("${path}"): the scope there is a ${target.rt.name}, not a ${type.rt.name}`);
    if (inst.rt.logged && !target.rt.logged) {
      throw new Error(
        `read("${path}") from ${inst.path}: logged scope ${inst.rt.name} may not read unlogged scope ${target.rt.name} (D52); unlogged state reaches logged scopes only through kernel.dispatch of an input event, which gets logged`,
      );
    }
    k.volatile(inst);
    return k.exportsOf(target);
  }
}

class CtxImpl extends ViewImpl {
  constructor(
    k: KernelImpl,
    inst: Inst,
    readonly ns: NodeState,
  ) {
    super(k, inst);
  }

  private live(method: string): void {
    if (this.k.cur !== this.ns) {
      throw new Error(`ctx.${method}: this ctx belongs to a rule that already finished; use the ctx passed to the current rule or process step`);
    }
  }

  probe(name: string, payload?: unknown): void {
    const k = this.k;
    if (!k.onProbe.length || k.mode !== "log" || k.rebuilding) return;
    this.live("probe");
    const p: ProbeEvent = { seq: k.seq, name, payload, path: this.inst.path, event: this.ns.node.event };
    for (const fn of k.onProbe) fn(p);
  }

  private writable(method: string): NodeState {
    this.live(method);
    const phase = this.k.phase;
    if (phase === "check" || phase === "modify") {
      throw new Error(
        `ctx.${method} in a ${phase} rule ("${this.k.label}"): check and modify rules only read; move the write to an apply or react rule`,
      );
    }
    return this.ns;
  }

  private own(e: Id | Ent, method: string): Ent {
    const { inst, k } = this;
    let id: Id;
    if (typeof e === "object" && e !== null) {
      const owner = owners.get(e);
      if (owner && owner !== inst) {
        throw new Error(
          `ctx.${method}(${e.id}): that entity belongs to scope ${owner.path}; a rule writes only its own scope's stores (D52). Send ${owner.path} an event instead`,
        );
      }
      id = e.id;
    } else id = e;
    const ent = inst.entities.get(id);
    if (!ent) {
      const elsewhere = k.paths().filter((p) => p !== inst.path && k.find(p)?.entities.has(id));
      const hint = elsewhere.length
        ? `; "${id}" exists in ${elsewhere.join(", ")}, and a rule writes only its own scope's stores (D52): send that scope an event instead`
        : "";
      throw new Error(`ctx.${method}: no entity "${id}" in ${inst.path}${hint}`);
    }
    return ent;
  }

  private checkComp(comp: string, method: string): void {
    if (!(comp in this.inst.rt.components)) {
      throw new Error(`ctx.${method}: ${this.inst.rt.name} has no component "${comp}"; components: ${Object.keys(this.inst.rt.components).join(", ")}`);
    }
  }

  private lifecycle(event: string, payload: Record<string, unknown>): void {
    const { k, inst, ns } = this;
    if (!inst.cp.listened.has(event)) return;
    ns.queue.push((parent) => {
      k.resolve(inst, event, payload, parent);
    });
  }

  /** Makes the entity writable in this node: journal once per dispatch, shallow copy once per node. */
  private writableEntity(id: Id): Ent {
    const { k, inst, ns } = this;
    k.journalEntity(inst, id);
    let ent = inst.entities.get(id)!;
    if (!ns.copied.has(id)) {
      ent = { ...ent };
      inst.entities.set(id, ent);
      ns.copied.add(id);
    }
    return ent;
  }

  mut(e: Id | Ent, comp: string): unknown {
    const ns = this.writable("mut");
    const cur = this.own(e, "mut");
    this.checkComp(comp, "mut");
    const id = cur.id;
    if (!(comp in cur)) throw new Error(`ctx.mut(${id}, "${comp}"): ${id} has no "${comp}"; add it with ctx.add(${id}, "${comp}", value)`);
    if (ns.spawned.has(id)) return cur[comp];
    const key = `${id}\u0000${comp}`;
    if (!ns.ops.has(key)) {
      const ent = this.writableEntity(id);
      const before = ent[comp];
      ent[comp] = jsonClone(before);
      ns.ops.set(key, { kind: "comp", id, comp, before, by: this.k.label });
      this.k.markDirty(ns, comp, id);
      this.k.bump(this.inst, comp);
    }
    return this.inst.entities.get(id)![comp];
  }

  add(e: Id | Ent, comp: string, value: unknown): void {
    const ns = this.writable("add");
    const cur = this.own(e, "add");
    this.checkComp(comp, "add");
    const id = cur.id;
    const had = comp in cur;
    if (ns.spawned.has(id)) {
      cur[comp] = jsonClone(value);
    } else {
      const key = `${id}\u0000${comp}`;
      const ent = this.writableEntity(id);
      if (!ns.ops.has(key)) ns.ops.set(key, { kind: "comp", id, comp, before: ent[comp], by: this.k.label });
      ent[comp] = jsonClone(value);
    }
    this.k.markDirty(ns, comp, id);
    this.k.bump(this.inst, comp);
    if (!had) {
      this.k.idxAdd(this.inst, comp, id);
      if (!ns.spawned.has(id)) this.lifecycle("added", { id, component: comp });
    }
  }

  remove(e: Id | Ent, comp: string): void {
    const ns = this.writable("remove");
    const cur = this.own(e, "remove");
    this.checkComp(comp, "remove");
    const id = cur.id;
    if (!(comp in cur)) return;
    if (ns.spawned.has(id)) {
      delete cur[comp];
    } else {
      const key = `${id}\u0000${comp}`;
      const ent = this.writableEntity(id);
      if (!ns.ops.has(key)) ns.ops.set(key, { kind: "comp", id, comp, before: ent[comp], by: this.k.label });
      delete ent[comp];
    }
    this.k.markDirty(ns, comp, id);
    this.k.bump(this.inst, comp);
    this.k.idxRemove(this.inst, comp, id);
    if (!ns.spawned.has(id)) this.lifecycle("removed", { id, component: comp });
  }

  spawn(components: Record<string, unknown>, name?: string): Id {
    const ns = this.writable("spawn");
    const { k, inst } = this;
    if (name !== undefined && (name.includes("#") || name.includes("/") || !name)) {
      throw new Error(`ctx.spawn: name "${name}" may not be empty or contain "#" or "/"`);
    }
    k.touchSys(inst);
    const n = ++inst.sys.nextId;
    const id = `${name ?? "e"}#${n}`;
    const ent: Ent = { id };
    for (const [comp, value] of Object.entries(components)) {
      if (comp === "id") throw new Error(`ctx.spawn: "id" is assigned by the kernel; pass a name instead: spawn({...}, "${String(value)}")`);
      if (value === undefined) continue;
      this.checkComp(comp, "spawn");
      ent[comp] = jsonClone(value);
    }
    k.journalEntity(inst, id);
    inst.entities.set(id, ent);
    ns.spawned.add(id);
    ns.copied.add(id);
    ns.ops.set(`${id}\u0000*`, { kind: "spawn", id, comp: undefined, before: undefined, by: k.label });
    for (const comp in ent) {
      if (comp === "id") continue;
      k.idxAdd(inst, comp, id);
      k.markDirty(ns, comp, id);
      k.bump(inst, comp);
    }
    inst.sorted.delete("*");
    this.lifecycle("spawned", { id });
    return id;
  }

  despawn(e: Id | Ent): void {
    const ns = this.writable("despawn");
    const { k, inst } = this;
    const id = this.own(e, "despawn").id;
    // Relations pointing at this entity clean up first (D14).
    for (const rel of Object.values(inst.rt.relations)) {
      for (const src of this.related(rel.name, id)) {
        if (src.id === id || !inst.entities.has(src.id)) continue;
        if (rel.onDelete === "despawn") this.despawn(src.id);
        else this.remove(src.id, rel.comp);
      }
    }
    const ent = inst.entities.get(id);
    if (!ent) return;
    k.journalEntity(inst, id);
    inst.entities.delete(id);
    inst.sorted.delete("*");
    for (const comp in ent) {
      if (comp === "id") continue;
      k.idxRemove(inst, comp, id);
      k.valueIndex(inst, id, comp, undefined);
      k.bump(inst, comp);
    }
    for (const key of ns.ops.keys()) if (key.startsWith(`${id}\u0000`)) ns.ops.delete(key);
    if (ns.spawned.has(id)) {
      ns.spawned.delete(id);
    } else {
      ns.ops.set(`${id}\u0000*`, { kind: "despawn", id, comp: undefined, before: deepFreeze(ent), by: k.label });
      this.lifecycle("despawned", { id });
    }
  }

  emit(event: string, payload: unknown): void {
    const ns = this.writable("emit");
    const { k, inst } = this;
    const parsed = this.parseEvent(inst, event, payload, "emit");
    ns.queue.push((parent) => {
      k.resolve(inst, event, parsed, parent);
    });
  }

  private parseEvent(target: Inst, event: string, payload: unknown, method: string): Record<string, unknown> {
    const def = target.rt.events[event];
    if (!def) {
      throw new Error(`ctx.${method}: unknown event "${event}" in ${target.rt.name}; declared events: ${Object.keys(target.rt.events).join(", ") || "(none)"}`);
    }
    const r = def.schema.safeParse(payload);
    if (!r.success) throw new Error(`ctx.${method}("${event}"): bad payload: ${zodIssues(r.error)}`);
    return r.data as Record<string, unknown>;
  }

  send(path: string, type: AnyScope, event: string, payload: unknown): void {
    const ns = this.writable("send");
    const { k, inst } = this;
    const target = k.at(path);
    if (target.rt.name !== type.rt.name) throw new Error(`ctx.send("${path}"): the scope there is a ${target.rt.name}, not a ${type.rt.name}`);
    if (inst.rt.logged !== target.rt.logged) {
      const [a, b] = inst.rt.logged ? ["logged", "unlogged"] : ["unlogged", "logged"];
      throw new Error(
        `ctx.send from ${inst.path} (${a}) to ${path} (${b}) crosses the log boundary (D52): logged and unlogged scopes never send to each other. Unlogged state reaches logged scopes only through kernel.dispatch of an input event; logged state reaches unlogged scopes through read() and the trace`,
      );
    }
    const parsed = this.parseEvent(target, event, payload, "send");
    ns.queue.push((parent) => {
      k.resolve(target, event, parsed, parent);
    });
  }

  rng(stream: string): Rng {
    this.live("rng");
    const { k, inst } = this;
    if (k.phase === "check") {
      throw new Error(`ctx.rng in a check rule ("${k.label}"): a roll changes state, and checks only read; roll in modify, apply or react`);
    }
    if (!inst.rt.rng.includes(stream)) {
      throw new Error(`ctx.rng("${stream}"): ${inst.rt.name} declares no rng stream "${stream}"; streams: ${inst.rt.rng.join(", ") || "(none)"}. Add it to rng: [...]`);
    }
    return makeRng(
      () => inst.sys.rng[stream]!,
      (v) => {
        k.touchSys(inst);
        inst.sys.rng[stream] = v;
      },
    );
  }

  private clockDecl(clock: string, method: string) {
    const decl = this.inst.rt.clocks[clock];
    if (!decl) throw new Error(`ctx.${method}: ${this.inst.rt.name} has no clock "${clock}"; clocks: ${Object.keys(this.inst.rt.clocks).join(", ") || "(none)"}`);
    return decl;
  }

  after(clock: string, ticks: number, event: string, payload: unknown): Id {
    this.writable("after");
    const { k, inst } = this;
    this.clockDecl(clock, "after");
    if (!Number.isInteger(ticks) || ticks < 1) throw new Error(`ctx.after: ticks must be a whole number >= 1, got ${ticks}`);
    const parsed = this.parseEvent(inst, event, payload, "after");
    k.touchSys(inst);
    const pid = `after#${++inst.sys.nextId}`;
    inst.sys.procs.push({
      id: pid,
      type: "after",
      state: "deliver",
      locals: jsonClone({ event, payload: parsed }) as Json,
      clock,
      wakeAt: inst.sys.clocks[clock]!.now + ticks,
      waitEvent: null,
    });
    return pid;
  }

  start(process: string, overrides?: unknown): Id {
    const ns = this.writable("start");
    const { k, inst } = this;
    const def = inst.rt.processes[process];
    if (!def) {
      throw new Error(`ctx.start("${process}"): ${inst.rt.name} declares no process "${process}"; processes: ${Object.keys(inst.rt.processes).join(", ") || "(none)"}`);
    }
    const locals = { ...(def.locals as object), ...(overrides as object | undefined) };
    try {
      canonicalJson(locals);
    } catch (e) {
      throw new Error(`ctx.start("${process}"): locals must be plain JSON (${(e as Error).message})`);
    }
    k.touchSys(inst);
    const pid = `${process}#${++inst.sys.nextId}`;
    inst.sys.procs.push({
      id: pid,
      type: process,
      state: def.start,
      locals: jsonClone(locals as Json),
      clock: def.clock,
      wakeAt: null,
      waitEvent: null,
    });
    ns.queue.push((parent) => k.runStep(inst, pid, parent));
    return pid;
  }

  stop(pid: Id): boolean {
    this.writable("stop");
    const { k, inst } = this;
    const i = inst.sys.procs.findIndex((p) => p.id === pid);
    if (i < 0) return false;
    k.touchSys(inst);
    inst.sys.procs.splice(i, 1);
    return true;
  }

  open(slot: string, key?: string): string {
    const ns = this.writable("open");
    const { k, inst } = this;
    const type = inst.rt.children[slot];
    if (!type) throw new Error(`ctx.open("${slot}"): ${inst.rt.name} has no child slot "${slot}"; slots: ${Object.keys(inst.rt.children).join(", ") || "(none)"}`);
    if (key !== undefined && (!key || /[/:]/.test(key))) throw new Error(`ctx.open("${slot}", "${key}"): a key may not be empty or contain "/" or ":"`);
    const path = childPath(inst.path, slot, key);
    if (inst.children.has(path)) throw new Error(`ctx.open: ${path} is already open; close it first, or open with a different key`);
    k.touchChildren(inst);
    const child = k.newInst(type, path, inst, slot, `${inst.sys.seed}/${slot}${key === undefined ? "" : `:${key}`}`);
    inst.children.set(path, child);
    // Structural changes show in the trace as pseudo-rows: id = the scope path, comp "scope".
    ns.node.changes.push({ id: path, comp: "scope", after: type.rt.name, by: k.label });
    if (child.cp.listened.has("opened")) {
      ns.queue.push((parent) => {
        k.resolve(child, "opened", {}, parent);
      });
    }
    return path;
  }

  close(path: string): void {
    this.writable("close");
    const { k, inst } = this;
    const child = inst.children.get(path);
    if (!child) {
      throw new Error(`ctx.close("${path}"): not an open child of ${inst.path}; a scope closes only its own children (children: ${[...inst.children.keys()].join(", ") || "none"})`);
    }
    k.touchChildren(inst);
    inst.children.delete(path);
    this.ns.node.changes.push({ id: path, comp: "scope", before: child.rt.name, by: k.label });
  }

  setScale(clock: string, num: number, den = 1): void {
    this.writable("setScale");
    const { k, inst } = this;
    const decl = this.clockDecl(clock, "setScale");
    if (!decl.parent) throw new Error(`ctx.setScale("${clock}"): only child clocks have a scale; declare a child clock { parent: "..." } and scale that`);
    checkScale(`ctx.setScale("${clock}")`, num, den);
    k.touchSys(inst);
    const c = inst.sys.clocks[clock]!;
    if (c.num !== num || c.den !== den) {
      this.ns.node.changes.push({ id: `clock:${clock}`, comp: "scale", before: `${c.num}/${c.den}`, after: `${num}/${den}`, by: k.label });
    }
    c.num = num;
    c.den = den;
    c.acc = c.acc % den;
    k.bumpClock(inst);
  }

  advance(clock: string, n: number): void {
    const ns = this.writable("advance");
    const { k, inst } = this;
    const decl = this.clockDecl(clock, "advance");
    if (!decl.elapsed) throw new Error(`ctx.advance("${clock}"): only elapsed clocks advance by amount; declare { elapsed: true }`);
    if (!Number.isInteger(n) || n < 0) throw new Error(`ctx.advance("${clock}", ${n}): n must be a whole number >= 0`);
    ns.queue.push((parent) => k.advanceElapsed(inst, clock, n, parent));
  }
}

// ---------- entry points ----------

function wrap<Root extends AnyScope>(k: KernelImpl): Kernel<Root> {
  const api = {
    type: k.type,
    dispatch: (path: string, event: string, payload: unknown) => k.dispatch(path, event, payload, "log"),
    dry: (path: string, event: string, payload: unknown) => k.dispatch(path, event, payload, "dry"),
    queue: (path: string, event: string, payload: unknown) => k.queue(path, event, payload),
    tick: (path: string, clock: string) => k.tick(path, clock),
    view: (path = "/") => (k.at(path), new ViewImpl(k, path)),
    read: (path: string, type: AnyScope) => k.read(path, type),
    options: (path: string, event: string) => k.options(path, event),
    save: () => k.save(),
    log: () => k.logFile(),
    undo: (n = 1) => k.undo(n),
    hash: () => k.lastHash,
    paths: () => k.paths(),
    get rejections() {
      return k.rejections;
    },
    listen: (l: KernelListener) => {
      const d = l.dispatch?.bind(l);
      const p = l.probe?.bind(l);
      if (d) k.onDispatch = [...k.onDispatch, d];
      if (p) k.onProbe = [...k.onProbe, p];
      return () => {
        if (d) k.onDispatch = k.onDispatch.filter((f) => f !== d);
        if (p) k.onProbe = k.onProbe.filter((f) => f !== p);
      };
    },
  };
  return api as unknown as Kernel<Root>;
}

/** What `hashChain` defaults to; `harness()` turns it on while it builds its kernel. */
let chainByDefault = false;

/** Runs `make` with `hashChain` defaulting to true for kernels created or loaded inside it. */
export function withHashChain<T>(make: () => T): T {
  const was = chainByDefault;
  chainByDefault = true;
  try {
    return make();
  } finally {
    chainByDefault = was;
  }
}

/** Creates a kernel with a fresh root scope, runs `setup`, and starts the log. */
export function createKernel<Root extends AnyScope>(root: Root, opts: KernelOptions<Root> = {}): Kernel<Root> {
  const k = new KernelImpl(root);
  k.hashChain = opts.hashChain ?? chainByDefault;
  k.checkpointEvery = opts.checkpointEvery ?? CHECKPOINT_EVERY;
  k.root = k.newInst(root, "/", null, "", String(opts.seed ?? 0));
  if (opts.setup) k.setup(opts.setup as AnyFn);
  k.startLog();
  return wrap(k);
}

/** Loads a save, migrating each scope to its type's current version (D30); the log starts from it. */
export function loadKernel<Root extends AnyScope>(
  root: Root,
  save: Save,
  opts: Pick<KernelOptions<Root>, "hashChain" | "checkpointEvery"> = {},
): Kernel<Root> {
  if (save?.format !== SAVE_FORMAT) throw new Error(`loadKernel: not a gamebones save (format ${String(save?.format)}, expected ${SAVE_FORMAT})`);
  const k = new KernelImpl(root);
  k.hashChain = opts.hashChain ?? chainByDefault;
  k.checkpointEvery = opts.checkpointEvery ?? CHECKPOINT_EVERY;
  k.root = k.loadScope(root, "/", null, save);
  k.startLog();
  return wrap(k);
}

/**
 * Replays a log, verifying the hash chain; throws `replay diverged at step N, <event>` on the first mismatch (D30).
 * A log recorded without the chain (hash "") re-runs unverified; only refusals are caught.
 */
export function replay<Root extends AnyScope>(root: Root, file: LogFile): Kernel<Root> {
  if (file?.format !== LOG_FORMAT) throw new Error(`replay: not a gamebones log (format ${String(file?.format)}, expected ${LOG_FORMAT})`);
  const k = new KernelImpl(root);
  k.hashChain = file.records.some((r) => r.hash !== "");
  const versions = k.versions();
  for (const [name, v] of Object.entries(file.versions)) {
    if (name in versions && versions[name] !== v) {
      throw new Error(`replay: the log was recorded with ${name} version ${v}, this code has version ${versions[name]}; replay needs the code version that recorded it (D30)`);
    }
  }
  k.root = k.loadScope(root, "/", null, file.initial);
  k.startLog();
  if (k.initialHash !== file.initialHash) {
    throw new Error(`replay: the initial snapshot hashes to ${k.initialHash}, the log says ${file.initialHash}; the code changed how it loads this save`);
  }
  let step = 0;
  for (const rec of file.records) {
    const n = rec.repeat ?? 1;
    for (let i = 0; i < n; i++) {
      step++;
      const r = k.apply(rec);
      if (!r.ok) throw new Error(`replay diverged at step ${step}, ${rec.event}: refused (${r.rejection.reason})`);
    }
    if (k.hashChain && k.lastHash !== rec.hash) {
      throw new Error(`replay diverged at step ${step}, ${rec.event}: state hash ${k.lastHash}, the log recorded ${rec.hash}`);
    }
  }
  return wrap(k);
}
