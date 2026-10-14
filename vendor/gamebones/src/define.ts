// Declaring scope types (D51): `defineScope(name, config)` plus the builder
// chain `.derive .exports .options .processes .rules .migrations`, and the
// declaration helpers `input`, `event`, `ref`, `relation`, `wait`, `until`,
// `done`.

import { z } from "zod";
import type { PackedStore } from "./packed.ts";
import type { AnyFn, ProcessRT, RelationRT, RuleDef, ScopeRT } from "./runtime.ts";
import type {
  AnyScope,
  ClockDecl,
  DriverNames,
  EventDef,
  Id,
  Phase,
  RefSchema,
  RelationDef,
  RelationValue,
  RuleBuilder,
  RuleChain,
  ScopeType,
  Shape,
  StepResult,
  TriggerRow,
  TriggersSchema,
} from "./types.ts";

const refRegistry = z.registry<{ ref: true }>();

/** A payload or component field holding an entity id. Event refs are resolved before any rule runs. */
export function ref(): RefSchema {
  return z.string().register(refRegistry, { ref: true }) as unknown as RefSchema;
}

/** True when the schema (through optional/nullable/default wrappers) was made by `ref()`. */
export function isRef(schema: z.ZodType): boolean {
  let s: z.ZodType = schema;
  for (let i = 0; i < 8; i++) {
    if (refRegistry.has(s)) return true;
    const def = s._zod.def as { type: string; innerType?: z.ZodType };
    if ((def.type === "optional" || def.type === "nullable" || def.type === "default") && def.innerType) {
      s = def.innerType;
    } else return false;
  }
  return false;
}

function makeEvent<Sh extends Shape, In extends boolean>(
  shape: Sh,
  isInput: In,
  opts: { subject?: string },
): EventDef<Sh, In> {
  const refFields = Object.keys(shape).filter((k) => isRef(shape[k]!));
  if (opts.subject !== undefined && !refFields.includes(opts.subject)) {
    throw new Error(`event subject "${opts.subject}" must be a ref() field of the payload; ref fields: ${refFields.join(", ") || "(none)"}`);
  }
  return { kind: "event", input: isInput, shape, schema: z.strictObject(shape), subject: opts.subject, refFields };
}

/** An input event: may be dispatched from outside the kernel, and gets logged (D7, D17). */
export function input<Sh extends Shape = Record<never, never>>(
  shape?: Sh,
  opts: { subject?: keyof Sh & string } = {},
): EventDef<Sh, true> {
  return makeEvent(shape ?? ({} as Sh), true, opts);
}

/** An internal event: emitted by rules, never dispatched from outside, re-derived on replay. */
export function event<Sh extends Shape = Record<never, never>>(
  shape?: Sh,
  opts: { subject?: keyof Sh & string } = {},
): EventDef<Sh, false> {
  return makeEvent(shape ?? ({} as Sh), false, opts);
}

/**
 * A relation (D14): a component `{ of: ref, [ordered]: number }` plus an index
 * from target to sources. `related(name, target)` lists sources in order.
 */
export function relation<const Comp extends string, const O extends string = never>(
  comp: Comp,
  opts: { ordered?: O; onDelete?: "remove" | "despawn" } = {},
): RelationDef<Comp, O> {
  return { kind: "relation", comp, ordered: opts.ordered, onDelete: opts.onDelete ?? "remove" };
}

/** Process step result: sleep `ticks` ticks of the process's clock, then run state `next` (default: same state). */
export function wait(ticks: number, next?: string): StepResult {
  return next === undefined ? { kind: "wait", ticks } : { kind: "wait", ticks, next };
}

/** Process step result: sleep until `event` resolves in this scope, then run `next` (default: same state). */
export function until(event: string, next?: string): StepResult {
  return next === undefined ? { kind: "until", event } : { kind: "until", event, next };
}

/** Process step result: the process ends and its row is removed. */
export function done(): StepResult {
  return { kind: "done" };
}

const triggerRow = z.object({
  on: z.string(),
  rule: z.string(),
  params: z.unknown().optional(),
  any: z.boolean().optional(),
});
const triggersSchema = z.array(triggerRow) as unknown as TriggersSchema;

const LIFECYCLE = ["spawned", "despawned", "added", "removed"] as const;

export interface ScopeConfig<C, E, K, R extends readonly string[], P, Rl, Ch> {
  /** Component name to zod schema (D13). */
  components?: C;
  /** Event name to `input(...)` or `event(...)` (D17). */
  events?: E;
  /** Clock name to declaration (D22). */
  clocks?: K;
  /** Named rng streams owned by this scope (D12). */
  rng?: R;
  /** Packed store name to factory (D23). */
  packed?: P;
  /** Relation name to `relation(comp, ...)` (D14). */
  relations?: Rl;
  /** Child slot name to scope type; opened with `ctx.open(slot)` (D51). */
  children?: Ch;
  /** Logged scopes record input and hash state; `false` for view-like scopes. Default true. */
  logged?: boolean;
  /** Whether `kernel.save()` includes the scope. Default: same as `logged`. */
  saved?: boolean;
}

type RelComps<Rl> = {
  [K in keyof Rl as Rl[K] extends RelationDef<infer Cm, string> ? Cm : never]: z.ZodType<RelationValue<Rl[K]>>;
};

// oxlint-disable-next-line typescript/no-empty-object-type -- `{}` is the neutral element for these intersections
type Empty = {};

export function defineScope<
  const N extends string,
  C extends Record<string, z.ZodType> = Empty,
  E extends Record<string, EventDef> = Empty,
  const K extends Record<string, ClockDecl> = Empty,
  const R extends readonly string[] = [],
  P extends Record<string, () => PackedStore> = Empty,
  Rl extends Record<string, RelationDef> = Empty,
  Ch extends Record<string, AnyScope> = Empty,
>(
  name: N,
  config: ScopeConfig<C, E, K, R, P, Rl, Ch>,
): ScopeType<{
  name: N;
  c: C & RelComps<Rl> & { triggers: TriggersSchema };
  e: E;
  clocks: keyof K & string;
  drivers: DriverNames<K>;
  rng: R[number];
  packed: { [X in keyof P]: ReturnType<P[X]> };
  rel: { [X in keyof Rl]: Rl[X]["comp"] };
  children: Ch;
  derived: Empty;
  exports: Empty;
  procs: Empty;
}> {
  const where = `defineScope("${name}")`;
  const components: Record<string, z.ZodType> = { ...(config.components as Record<string, z.ZodType> | undefined) };
  for (const key of Object.keys(components)) {
    if (key === "id") throw new Error(`${where}: "id" is not a component name; every entity already has an id`);
    if (key === "triggers") throw new Error(`${where}: "triggers" is the built-in trigger component (D19); pick another name`);
  }
  components.triggers = triggersSchema;
  const relations: Record<string, RelationRT> = {};
  const userComponents = (config.components ?? {}) as Record<string, z.ZodType>;
  for (const [relName, rel] of Object.entries((config.relations ?? {}) as Record<string, RelationDef>)) {
    if (rel.comp in userComponents || rel.comp === "triggers" || rel.comp === "id") {
      throw new Error(`${where}: relation "${relName}" uses component "${rel.comp}", which is already declared; the relation declares it for you`);
    }
    const existing = Object.values(relations).find((r) => r.comp === rel.comp);
    if (existing && existing.ordered !== rel.ordered) {
      throw new Error(`${where}: relations "${existing.name}" and "${relName}" share component "${rel.comp}" with different order fields`);
    }
    const shape: Record<string, z.ZodType> = { of: ref() };
    if (rel.ordered) shape[rel.ordered] = z.number();
    components[rel.comp] = z.object(shape);
    relations[relName] = { name: relName, comp: rel.comp, ordered: rel.ordered, onDelete: rel.onDelete };
  }
  const events = { ...(config.events as Record<string, EventDef> | undefined) };
  for (const ev of Object.keys(events)) {
    if (ev.startsWith("tick:")) throw new Error(`${where}: event "${ev}" uses the reserved "tick:" prefix; declare a clock instead`);
    if ((LIFECYCLE as readonly string[]).includes(ev) || ev === "opened") {
      throw new Error(`${where}: event "${ev}" is a built-in lifecycle event; listen to it without declaring it`);
    }
    if (ev.startsWith("process:")) throw new Error(`${where}: event "${ev}" uses the reserved "process:" prefix`);
  }
  const clocks = { ...(config.clocks as Record<string, ClockDecl> | undefined) };
  for (const [cn, decl] of Object.entries(clocks)) {
    const kinds = [decl.driver ? "driver" : "", decl.parent ? "parent" : "", decl.elapsed ? "elapsed" : ""].filter(Boolean);
    if (kinds.length !== 1) {
      throw new Error(`${where}: clock "${cn}" needs exactly one source: { driver: true }, { parent: "<clock>" } or { elapsed: true }`);
    }
    if (decl.parent === cn) throw new Error(`${where}: clock "${cn}" cannot be its own parent`);
    if (decl.scale) checkScale(`${where}: clock "${cn}"`, decl.scale[0], decl.scale[1]);
  }
  const children = { ...(config.children as Record<string, AnyScope> | undefined) };
  const logged = config.logged ?? true;
  if (!logged) {
    for (const [slot, child] of Object.entries(children)) {
      if (child.rt.logged) {
        throw new Error(
          `${where}: slot "${slot}" holds logged scope "${child.name}" under an unlogged scope; a logged scope may not live under an unlogged one (D52). Mark "${child.name}" logged: false or move the slot to a logged parent`,
        );
      }
    }
  }
  const rt: ScopeRT = {
    name,
    components,
    events,
    clocks,
    rng: [...((config.rng ?? []) as readonly string[])],
    packed: { ...(config.packed as Record<string, () => PackedStore> | undefined) },
    relations,
    children,
    logged,
    saved: config.saved ?? logged,
    derived: {},
    exports: undefined,
    options: {},
    processes: {},
    rules: [],
    migrations: [],
  };
  return makeType(rt) as never;
}

export function checkScale(where: string, num: number, den: number): void {
  if (!Number.isInteger(num) || num < 0 || !Number.isInteger(den) || den < 1) {
    throw new Error(`${where}: scale must be integers num >= 0, den >= 1 (got ${num}/${den}); use 0/1 to pause`);
  }
}

/** Every event name a rule of this scope type may listen to. */
export function listenable(rt: ScopeRT): string[] {
  return [...Object.keys(rt.events), ...Object.keys(rt.clocks).map((c) => `tick:${c}`), ...LIFECYCLE, "opened"];
}

function makeType(rt: ScopeRT): ScopeType<never> {
  const next = (patch: Partial<ScopeRT>): ScopeType<never> => makeType({ ...rt, ...patch });
  const type = {
    kind: "scope" as const,
    name: rt.name,
    rt,
    derive(derived: Record<string, AnyFn>) {
      for (const k of Object.keys(derived)) {
        if (k in rt.derived) throw new Error(`${rt.name}.derive: "${k}" is already declared`);
      }
      return next({ derived: { ...rt.derived, ...derived } });
    },
    exports(fn: AnyFn) {
      return next({ exports: fn });
    },
    options(map: Record<string, AnyFn>) {
      for (const ev of Object.keys(map)) {
        if (!rt.events[ev]?.input) throw new Error(`${rt.name}.options: "${ev}" is not a declared input event`);
      }
      return next({ options: { ...rt.options, ...map } });
    },
    processes(fn: (helper: AnyFn) => Record<string, { clock: string; start: string; locals: unknown; states: Record<string, AnyFn> }>) {
      const defs = fn((d: unknown) => d);
      const processes: Record<string, ProcessRT> = { ...rt.processes };
      for (const [pn, def] of Object.entries(defs)) {
        if (pn === "after") throw new Error(`${rt.name}.processes: "after" is the built-in delayed-event process; pick another name`);
        if (!(def.clock in rt.clocks)) {
          throw new Error(`${rt.name}.processes: process "${pn}" binds to unknown clock "${def.clock}"; clocks: ${Object.keys(rt.clocks).join(", ") || "(none)"}`);
        }
        if (!(def.start in def.states)) {
          throw new Error(`${rt.name}.processes: process "${pn}" starts in unknown state "${def.start}"; states: ${Object.keys(def.states).join(", ")}`);
        }
        processes[pn] = { clock: def.clock, start: def.start, locals: def.locals ?? {}, states: def.states };
      }
      return next({ processes });
    },
    rules(fn: (r: RuleBuilder<never>) => readonly RuleDef[]) {
      const known = new Set(listenable(rt));
      const list = fn(ruleBuilder(rt.name, known) as never);
      if (!Array.isArray(list)) throw new Error(`${rt.name}.rules: the callback must return an array of rules`);
      const rules = [...rt.rules];
      const seenLabels = new Map<string, number>();
      for (const r of rt.rules) seenLabels.set(r.label, 1);
      for (const rule of list as readonly unknown[]) {
        if (!rule || (rule as RuleDef).kind !== "rule") {
          throw new Error(
            `${rt.name}.rules: item ${rules.length} is not a finished rule; end each chain with .check/.modify/.apply/.react`,
          );
        }
        const rd = rule as RuleDef;
        if (rd.named && rules.some((x) => x.named === rd.named)) {
          throw new Error(`${rt.name}.rules: named rule "${rd.named}" is registered twice`);
        }
        let label = rd.label;
        const n = seenLabels.get(label) ?? 0;
        seenLabels.set(label, n + 1);
        if (n > 0 && !rd.named) label = `${label}#${n + 1}`;
        rules.push({ ...rd, label });
      }
      return next({ rules });
    },
    migrations(list: readonly ((d: never) => never)[]) {
      return next({ migrations: [...list] as never });
    },
  };
  return type as unknown as ScopeType<never>;
}

function ruleBuilder(scopeName: string, known: Set<string>) {
  const chain = (event: string, named: string | undefined, params: z.ZodType | undefined): RuleChain<never, never, never> => {
    if (!known.has(event)) {
      throw new Error(`${scopeName}.rules: unknown event "${event}"; events: ${[...known].join(", ")}`);
    }
    let when: unknown;
    let priority = 0;
    let label: string | undefined;
    const finish = (phase: Phase, fn: AnyFn): RuleDef => {
      if (typeof fn !== "function") throw new Error(`${scopeName}.rules: ${phase} on "${event}" needs a function`);
      return {
        kind: "rule",
        event,
        phase,
        priority,
        when,
        fn,
        label: named ?? label ?? `${phase} ${event}`,
        named,
        params,
      };
    };
    const c: RuleChain<never, never, never> = {
      when(m) {
        when = m;
        return c;
      },
      priority(n) {
        if (!Number.isFinite(n)) throw new Error(`${scopeName}.rules: priority must be a finite number`);
        priority = n;
        return c;
      },
      as(l) {
        label = l;
        return c;
      },
      check: (fn) => finish("check", fn),
      modify: (fn) => finish("modify", fn),
      apply: (fn) => finish("apply", fn),
      react: (fn) => finish("react", fn),
    };
    return c;
  };
  return {
    on(event: string, apply?: AnyFn) {
      const c = chain(event, undefined, undefined);
      return apply ? c.apply(apply) : c;
    },
    named(name: string, params?: z.ZodType) {
      if (!name) throw new Error(`${scopeName}.rules: r.named needs a name`);
      return { on: (event: string) => chain(event, name, params) };
    },
  };
}

/** Builds a trigger row for the `triggers` component. */
export function trigger(on: string, rule: string, params?: unknown, opts: { any?: boolean } = {}): TriggerRow {
  const row: TriggerRow = { on, rule };
  if (params !== undefined) row.params = params;
  if (opts.any) row.any = true;
  return row;
}

export type { Id };
