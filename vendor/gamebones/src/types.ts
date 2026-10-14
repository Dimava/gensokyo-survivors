// The type machinery, in one file (brief: "Types"). A scope type carries a
// Spec: its components, events, clocks, rng streams, packed stores,
// relations, child slots, derived values, exports and processes. Every
// ctx method is typed against it, so names and payloads are checked.
// test/types.check.ts pins the mistakes that must not compile.

import type { z } from "zod";
import type { PackedStore } from "./packed.ts";
import type { Rng } from "./rng.ts";
import type { RuleDef, ScopeRT, ProcessRT } from "./runtime.ts";

export type Id = string;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Phase = "check" | "modify" | "apply" | "react";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type DeepPartial<T> = T extends readonly (infer U)[]
  ? readonly DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

declare const REF: unique symbol;
/** A zod string registered as an entity reference; see `ref()`. */
export type RefSchema = z.ZodString & { readonly [REF]: true };

export type Shape = Record<string, z.ZodType>;

/** An event declaration: `input(...)` (dispatchable from outside, logged) or `event(...)` (internal). */
export interface EventDef<Sh extends Shape = Shape, In extends boolean = boolean> {
  readonly kind: "event";
  readonly input: In;
  readonly shape: Sh;
  readonly schema: z.ZodType;
  /** Payload field naming the event's subject entity; subject triggers fire only on it. */
  readonly subject: string | undefined;
  /** Payload fields declared with `ref()`. */
  readonly refFields: readonly string[];
}

export interface ClockDecl {
  /** A root clock ticked from outside with `kernel.tick(path, name)`; its ticks are logged. */
  driver?: boolean;
  /** Parent clock name, looked up in this scope and then its ancestors. */
  parent?: string;
  /** Rational scale `[num, den]` against the parent; default [1, 1]. `ctx.setScale` changes it; 0 pauses. */
  scale?: readonly [number, number];
  /** Advanced only by `ctx.advance(clock, n)` from an input event carrying elapsed time; no tick events. */
  elapsed?: boolean;
}

export interface RelationDef<Comp extends string = string, Order extends string = string> {
  readonly kind: "relation";
  readonly comp: Comp;
  readonly ordered: Order | undefined;
  /** What happens to sources when the target despawns: drop their relation component (default) or despawn them. */
  readonly onDelete: "remove" | "despawn";
}

export type RelationValue<R> = R extends RelationDef<string, infer O> ? { of: Id } & { [K in O]: number } : never;

export interface TriggerRow {
  /** The event this row listens to. */
  on: string;
  /** A rule registered with `r.named(rule, ...)`. */
  rule: string;
  /** Data handed to the rule as `self.params`, validated by the rule's params schema. */
  params?: unknown;
  /** Fire for any occurrence, not only when this entity is the event's subject. */
  any?: boolean;
}

export type TriggersSchema = z.ZodType<TriggerRow[]>;

export type DeriveFn = (v: never, ...args: never[]) => unknown;

/** Everything the types know about one scope type. */
export interface Spec {
  name: string;
  c: Record<string, z.ZodType>;
  e: Record<string, EventDef>;
  clocks: string;
  drivers: string;
  rng: string;
  packed: Record<string, PackedStore>;
  rel: Record<string, string>;
  children: Record<string, AnyScope>;
  derived: Record<string, DeriveFn>;
  exports: unknown;
  procs: Record<string, unknown>;
}

// ---------- entities ----------

export type CompName<S extends Spec> = keyof S["c"] & string;
export type CompValue<S extends Spec, K extends keyof S["c"]> = z.output<S["c"][K]>;

/** An entity: an id plus whichever components it currently has. Frozen. */
export type Entity<C extends Record<string, z.ZodType>> = { readonly id: Id } & {
  readonly [K in keyof C]?: DeepReadonly<z.output<C[K]>>;
};

/** An entity known to have components K (from `has`, `q`, `req(id, ...K)`). */
export type With<C extends Record<string, z.ZodType>, K extends keyof C> = Entity<C> & {
  readonly [P in K]-?: DeepReadonly<z.output<C[P]>>;
};

export type EntityOf<S extends Spec> = Entity<S["c"]>;

/** The value you pass to `spawn`: any subset of the components. */
export type SpawnValue<S extends Spec> = { [K in keyof S["c"]]?: z.input<S["c"][K]> };

// ---------- events ----------

export interface LifecyclePayload {
  id: Id;
  component?: string;
}

type Lifecycle = "spawned" | "despawned" | "added" | "removed";

type Implicit<S extends Spec> = { [K in `tick:${S["clocks"]}`]: { tick: number } } & {
  [K in Lifecycle]: LifecyclePayload;
} & { opened: Record<string, never> };

/** Declared events of the scope (the ones `emit`, `after` and `send` take). */
export type UserEvent<S extends Spec> = keyof S["e"] & string;
/** Every event a rule may listen to: declared, `tick:<clock>`, lifecycle, `opened`. */
export type EventName<S extends Spec> = UserEvent<S> | (keyof Implicit<S> & string);
export type InputEvent<S extends Spec> = {
  [K in keyof S["e"]]: S["e"][K] extends EventDef<Shape, true> ? K : never;
}[keyof S["e"]] &
  string;

type ObjOut<D> = D extends EventDef<infer Sh, boolean> ? z.output<z.ZodObject<Sh>> : never;
type ObjIn<D> = D extends EventDef<infer Sh, boolean> ? z.input<z.ZodObject<Sh>> : never;

/** A resolved payload as rules see it. */
export type Payload<S extends Spec, E extends string> = E extends keyof S["e"]
  ? ObjOut<S["e"][E]>
  : E extends keyof Implicit<S>
    ? Implicit<S>[E]
    : never;

/** A payload as you pass it to `emit`, `dispatch`, `after`. */
export type PayloadIn<S extends Spec, E extends string> = E extends keyof S["e"] ? ObjIn<S["e"][E]> : never;

type EntityMatch<C extends Record<string, z.ZodType>> = { id?: Id } & {
  [K in keyof C]?: DeepPartial<z.output<C[K]>>;
};

/**
 * A structural literal matcher over the payload (D18). A ref field matches
 * against the entity it points at: `{ at: { cell: { near: 0 } } }`.
 */
export type Matcher<S extends Spec, E extends string> = E extends keyof S["e"]
  ? S["e"][E] extends EventDef<infer Sh, boolean>
    ? { [K in keyof Sh]?: Sh[K] extends RefSchema ? EntityMatch<S["c"]> : DeepPartial<z.output<Sh[K]>> }
    : never
  : E extends Lifecycle
    ? { id?: Id | EntityMatch<S["c"]>; component?: string }
    : DeepPartial<Payload<S, E>>;

// ---------- scope types and paths ----------

/** What every scope type has; builder methods live on ScopeType. */
export interface ScopeBase<S extends Spec> {
  readonly kind: "scope";
  readonly name: S["name"];
  /** @internal runtime definition */
  readonly rt: ScopeRT;
  /** Phantom carrier of the spec; never present at runtime. */
  readonly __spec: S;
}
// oxlint-disable-next-line no-explicit-any -- the universal scope type needs `any` for variance
export type AnyScope = ScopeBase<any>;
export type SpecOf<T> = T extends { readonly __spec: infer S } ? (S extends Spec ? S : never) : never;
export type ExportsOf<T> = SpecOf<T>["exports"];

type SlotOf<Seg extends string> = Seg extends `${infer Slot}:${string}` ? Slot : Seg;
type ChildOf<T, Seg extends string> =
  SpecOf<T>["children"] extends infer Ch ? (SlotOf<Seg> extends keyof Ch ? Ch[SlotOf<Seg>] : never) : never;
type Walk<T, Rest extends string> = Rest extends `${infer Seg}/${infer More}`
  ? Walk<ChildOf<T, Seg>, More>
  : ChildOf<T, Rest>;

/** The scope type at a literal path under Root (`"/"`, `"/vn"`, `"/level:3/boss"`); loose for non-literal strings. */
export type TypeAt<Root, P extends string> = string extends P
  ? AnyScope
  : P extends "/"
    ? Root
    : P extends `/${infer Rest}`
      ? Walk<Root, Rest>
      : never;

export type SpecAt<Root, P extends string> = SpecOf<TypeAt<Root, P>>;

// ---------- read view and ctx ----------

type DerivedArgs<F> = F extends (v: never, ...args: infer A) => unknown ? A : never;
type DerivedResult<F> = F extends (...args: never[]) => infer R ? R : never;

/** Read-only access to one scope: what derive, exports, options and check rules get. */
export interface View<S extends Spec> {
  /** This scope's path, e.g. "/" or "/vn". */
  readonly path: string;
  /** The entity, or undefined. */
  get(id: Id): EntityOf<S> | undefined;
  /** The entity; throws naming the id if it is missing. */
  req(id: Id): EntityOf<S>;
  /** The entity, known to have these components; throws naming the missing one. */
  req<K extends CompName<S>>(id: Id, ...comps: K[]): With<S["c"], K>;
  /** `comp in e`, typed as a guard. */
  has<K extends CompName<S>>(e: EntityOf<S> | undefined, comp: K): e is With<S["c"], K>;
  /** Entities having all these components, in id order. */
  q<K extends CompName<S>>(...comps: K[]): With<S["c"], K>[];
  /** Sources of a relation pointing at `target`, ordered by the relation's order field, then id. */
  related<R extends keyof S["rel"] & string>(relation: R, target: Id): With<S["c"], S["rel"][R] & CompName<S>>[];
  /** A declared derived value (memoized). */
  derived<K extends keyof S["derived"] & string>(
    name: K,
    ...args: DerivedArgs<S["derived"][K]>
  ): DerivedResult<S["derived"][K]>;
  /** Current tick of one of this scope's clocks. */
  now(clock: S["clocks"]): number;
  /** A packed store of this scope. */
  packed<K extends keyof S["packed"] & string>(name: K): S["packed"][K];
  /** Another scope's exports, frozen. A logged scope may not read an unlogged one (D52). */
  read<T extends AnyScope>(path: string, type: T): DeepReadonly<ExportsOf<T>>;
}

/** What `modify` rules get: reads plus rng. */
export interface ModifyCtx<S extends Spec> extends View<S> {
  /** A named rng stream of this scope (`float`, `int`, `pick`, `chance`, `shuffle`). */
  rng(stream: S["rng"]): Rng;
  /**
   * Tells whoever listens (`kernel.listen({ probe })`, e.g. a run recorder) that something
   * happened which is not an event: a hit inside a bulk loop, a spawn. Free when nobody
   * listens, never part of state, the log or the hash; silent in dry runs and while the kernel
   * rebuilds state (undo). Pass plain data; a listener must copy what it keeps.
   */
  probe(name: string, payload?: unknown): void;
}

/** The whole authoring surface inside `apply`/`react` rules and process steps. */
export interface Ctx<S extends Spec> extends ModifyCtx<S> {
  /** A writable copy of a component; the write is validated and recorded at the end of the event node. */
  mut<K extends CompName<S>>(e: Id | EntityOf<S>, comp: K): CompValue<S, K>;
  /** Adds (or replaces) a component. */
  add<K extends CompName<S>>(e: Id | EntityOf<S>, comp: K, value: z.input<S["c"][K]>): void;
  /** Removes a component. */
  remove(e: Id | EntityOf<S>, comp: CompName<S>): void;
  /** Creates an entity and returns its id, `${name ?? "e"}#${n}`. */
  spawn(components: SpawnValue<S>, name?: string): Id;
  /** Deletes an entity; relations pointing at it are cleaned up. */
  despawn(e: Id | EntityOf<S>): void;
  /** Queues an event in this scope; it resolves after the current event finishes, depth-first. */
  emit<E extends UserEvent<S>>(event: E, payload: PayloadIn<S, E>): void;
  /** Queues an event in another scope (by absolute path), like `emit`. Logged and unlogged scopes may not send to each other. */
  send<T extends AnyScope, E extends UserEvent<SpecOf<T>>>(
    path: string,
    type: T,
    event: E,
    payload: PayloadIn<SpecOf<T>, E>,
  ): void;
  /** Emits `event` after `ticks` ticks of `clock` (a built-in process); returns its pid for `stop`. */
  after<E extends UserEvent<S>>(clock: S["clocks"], ticks: number, event: E, payload: PayloadIn<S, E>): Id;
  /** Starts a declared process (locals default to its declared ones); its first step runs after the current event. */
  start<K extends keyof S["procs"] & string>(process: K, locals?: Partial<S["procs"][K]>): Id;
  /** Stops a process (or a pending `after`); false if it had already finished. */
  stop(pid: Id): boolean;
  /** Opens a child scope in a declared slot; returns its path. Its `opened` event resolves after the current event. */
  open(slot: keyof S["children"] & string, key?: string): string;
  /** Closes a descendant scope. */
  close(path: string): void;
  /** Sets a child clock's rational scale; `setScale(clock, 0, 1)` pauses it. */
  setScale(clock: S["clocks"], num: number, den?: number): void;
  /** Advances an `elapsed` clock by n; due processes run in order, each seeing its own wake tick. */
  advance(clock: S["clocks"], n: number): void;
}

// ---------- rules ----------

export interface TriggerSelf<P> {
  /** The entity whose `triggers` row fired this rule. */
  readonly id: Id;
  readonly params: DeepReadonly<P>;
}

export type CheckFn<S extends Spec, E extends string, Self> = (
  ev: DeepReadonly<Payload<S, E>>,
  ctx: View<S>,
  self: Self,
) => string | undefined | void;
export type ModifyFn<S extends Spec, E extends string, Self> = (ev: Payload<S, E>, ctx: ModifyCtx<S>, self: Self) => void;
export type ApplyFn<S extends Spec, E extends string, Self> = (
  ev: DeepReadonly<Payload<S, E>>,
  ctx: Ctx<S>,
  self: Self,
) => void;

export interface RuleChain<S extends Spec, E extends string, Self> {
  /** Runs only when the payload matches (D18); a ref field matches against its entity. */
  when(matcher: Matcher<S, E>): RuleChain<S, E, Self>;
  /** Higher runs first within a phase; default 0. */
  priority(n: number): RuleChain<S, E, Self>;
  /** A label for the trace's write attribution; default `<phase> <event>`. */
  as(label: string): RuleChain<S, E, Self>;
  /** Return a reason string to refuse the event. Read-only. */
  check(fn: CheckFn<S, E, Self>): RuleDef;
  /** Change the payload in place; it is re-validated afterwards. May roll rng, may not write state. */
  modify(fn: ModifyFn<S, E, Self>): RuleDef;
  /** Write state; may emit. */
  apply(fn: ApplyFn<S, E, Self>): RuleDef;
  /** Runs after every apply rule; may write and emit. */
  react(fn: ApplyFn<S, E, Self>): RuleDef;
}

export interface RuleBuilder<S extends Spec> {
  /** A global rule on an event; `r.on(event, fn)` is an apply rule. */
  on<E extends EventName<S>>(event: E): RuleChain<S, E, undefined>;
  on<E extends EventName<S>>(event: E, apply: ApplyFn<S, E, undefined>): RuleDef;
  /** A rule that runs only through `triggers` rows naming it (D19). */
  named<P = undefined>(
    name: string,
    params?: z.ZodType<P>,
  ): { on<E extends EventName<S>>(event: E): RuleChain<S, E, TriggerSelf<P>> };
}

// ---------- processes ----------

export type StepResult =
  | { readonly kind: "wait"; readonly ticks: number; readonly next?: string }
  | { readonly kind: "until"; readonly event: string; readonly next?: string }
  | { readonly kind: "done" };

export interface ProcHandle<L> {
  readonly id: Id;
  readonly type: string;
  readonly state: string;
  /** Saved with the process; mutate freely. Must stay plain JSON. */
  locals: L;
  /** When woken by `until(event)`, that event and its payload. */
  readonly woke?: { readonly event: string; readonly payload: unknown };
}

export interface ProcessDef<S extends Spec, L> {
  readonly clock: S["clocks"];
  readonly start: string;
  /** Initial locals; `ctx.start(name, overrides?)` merges overrides over them. Plain JSON. */
  readonly locals: L;
  readonly states: Record<string, (p: ProcHandle<L>, ctx: Ctx<S>) => StepResult>;
  /** @internal */
  readonly rt?: ProcessRT;
}

export type ProcessHelper<S extends Spec> = <L extends Record<string, unknown>>(def: ProcessDef<S, L>) => ProcessDef<S, L>;

// ---------- saves ----------

export interface SavedScope {
  type: string;
  version: number;
  entities: Record<string, unknown>[];
  sys: Json;
  /**
   * Packed stores by name: what the store's `save()` wrote (for `columns`, `SavedColumns`:
   * `{ count, <field>: [...] }`), or the snapshot as base64 for a store without `save`.
   * Migrations edit it as plain JSON: `(data.packed.enemies as SavedColumns).xp = ...`.
   */
  packed: Record<string, unknown>;
  children: string[];
}

/** The data a migration transforms: one saved scope without its type and version. */
export type ScopeData = Omit<SavedScope, "type" | "version">;
export type Migration = (data: ScopeData) => ScopeData;

// ---------- the builder ----------

type Replace<S, K extends keyof Spec, V> = Omit<S, K> & { [P in K]: V };

export interface ScopeType<S extends Spec> extends ScopeBase<S> {
  /** Declares derived values: memoized functions of a read view (D32). */
  derive<D extends Record<string, (v: View<S>, ...args: never[]) => unknown>>(
    derived: D,
  ): ScopeType<Replace<S, "derived", S["derived"] & D>>;
  /** Declares what other scopes may read with `ctx.read(path, Type)`. */
  exports<X>(fn: (v: View<S>) => X): ScopeType<Replace<S, "exports", X>>;
  /** Enumerates legal payloads of input events (D21); `kernel.options(path, event)` calls it. */
  options(map: { [E in InputEvent<S>]?: (v: View<S>) => PayloadIn<S, E>[] }): ScopeType<S>;
  /** Declares processes: saved state machines bound to a clock (D36). */
  // oxlint-disable-next-line no-explicit-any -- each process infers its own locals type
  processes<P extends Record<string, ProcessDef<S, any>>>(
    fn: (process: ProcessHelper<S>) => P,
  ): ScopeType<Replace<S, "procs", { [K in keyof P]: P[K] extends ProcessDef<S, infer L> ? L : never }>>;
  /** Declares the rules. */
  rules(fn: (r: RuleBuilder<S>) => readonly RuleDef[]): ScopeType<S>;
  /** Save migrations: entry i turns version i into i+1; the current version is the list's length. */
  migrations(list: readonly Migration[]): ScopeType<S>;
}

export type DriverNames<K> = { [N in keyof K]: K[N] extends { driver: true } ? N : never }[keyof K] & string;
