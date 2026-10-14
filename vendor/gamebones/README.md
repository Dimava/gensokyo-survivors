# gamebones

A deterministic game kernel in TypeScript. You declare **scope types**
(components, events, clocks, rng streams, packed stores, relations, child
slots, derived values, processes, rules); the kernel resolves every change
as a typed **event** through ordered **rules**, returns a **trace tree** for
each dispatch, logs input so a run **replays** bit for bit, and saves
snapshots with per-type **migrations**. It touches no DOM and owns no wall
clock: renderers, input and bots are adapters around it.

This file is the whole manual. The design log it implements is
`D:\bag\protoprd\gamebones\PRD.md`; decision ids (D13, D52 ...) below point
into it. Five small games in `games/` with tests in `test/` show every
feature in use.

```sh
bun test              # all games, transcripts are snapshots in test/__snapshots__
bunx tsc --noEmit     # strict types, includes test/types.check.ts
bunx oxlint
```

Import everything from `@gamebones` (a tsconfig path to `src/index.ts`) and
schemas from `zod` (v4).

---

## 1. Concepts

| Concept | What it is | PRD |
|---|---|---|
| **Scope** | A runtime instance of a scope type: its own entity store, packed stores, clocks, rng streams, processes and child scopes, at a path (`/`, `/vn`, `/level:3`). Policies: `logged` (input logged and state hashed) and `saved`. | D51 |
| **Entity** | A frozen plain object `{ id, pos: {...}, hp: {...} }`. It *has* component `hp` when the key is present. Every component has a zod schema. | D2, D13 |
| **Packed store** | Bulk data in typed arrays (a swarm, particles) behind a small contract; not entities. `columns` ships in v1. | D6, D23 |
| **Index** | Every component has one (queries are by index, in id order). A **relation** is a component `{ of: ref, at? }` plus an ordered index from target to sources. Indexes live outside state. | D14 |
| **Event** | A declared, typed payload sent to a scope. **Input** events come from outside and are logged; the rest are emitted by rules and re-derived on replay. Clock ticks and lifecycle changes are events too. | D7, D17 |
| **Rule** | Code attached to an event in a phase (`check`, `modify`, `apply`, `react`), optionally with a literal matcher, a priority and a label. | D17, D18 |
| **Trigger** | A `triggers` row stored on an entity that names a registered rule plus params: relics, statuses, card text as data. | D19 |
| **Rejection** | A `check` rule returning a string refuses the event. Returned, recorded, and shown in the trace. | D20 |
| **Options** | A function listing the legal payloads of an input event, for UI, hints, bots. `check` stays the authority. | D21 |
| **Clock** | Integer time. Drivers are ticked from outside; child clocks follow a parent at a rational scale (0 pauses); elapsed clocks jump by amounts carried in input. | D22, D46 |
| **Process** | A saved state machine bound to a clock: state name, locals, wake time or awaited event. Delayed events are a built-in process. | D36 |
| **Derived / computable** | Memoized functions of state. Computable state stores parameters (`readyAt`, `{base, rate, t0}`, motion segments) and is evaluated at any tick, never updated per tick. | D32, D48 |
| **Trace** | The tree of event nodes a dispatch produced, with every row change attributed to the rule that wrote it. It is the test transcript, the renderer's script and the "why is this 7". | D25 |
| **Log, save, replay** | The log is the initial snapshot plus the input records with a hash chain; replay re-runs and verifies. Saves are snapshots, migrated per scope type. | D12, D30 |
| **Access laws** | A rule writes only its own scope; other scopes are read through exports and changed by sending events; logged and unlogged scopes never exchange events. | D52 |

---

## 2. A complete game: minesweeper

`games/minesweeper.ts`, whole. First click is safe (mines are laid inside
the first reveal from the `board` rng stream), the flood fill is a tree of
emitted `cell:opened` nodes, and a win check runs after the cascade.

```ts
import { z } from "zod";
import { createKernel, defineScope, event, input, ref, type SpecOf, type View } from "@gamebones";

const BoardBase = defineScope("board", {
  components: {
    pos: z.object({ x: z.int(), y: z.int() }),
    cell: z.object({ mine: z.boolean(), open: z.boolean(), near: z.int().min(0).max(8) }),
    flag: z.object({}),
    game: z.object({ state: z.enum(["fresh", "playing", "won", "lost"]), w: z.int(), h: z.int(), mines: z.int() }),
  },
  events: {
    "cell:reveal": input({ at: ref() }, { subject: "at" }),
    "cell:flag": input({ at: ref() }, { subject: "at" }),
    "cell:opened": event({ at: ref(), from: ref() }, { subject: "at" }),
    "board:settled": event(),
    "game:lost": event({ at: ref() }),
    "game:won": event(),
  },
  rng: ["board"],
}).derive({
  game: (v) => v.q("game")[0]!,
  // Depends only on `pos`, so it stays memoized while the flood fill writes `cell`.
  grid: (v) => {
    const m = new Map<string, string>();
    for (const e of v.q("pos")) m.set(`${e.pos.x},${e.pos.y}`, e.id);
    return m;
  },
  closedSafe: (v) => v.q("cell").filter((e) => !e.cell.open && !e.cell.mine).length,
});

type B = SpecOf<typeof BoardBase>;

export function neighbours(v: View<B>, id: string): string[] {
  const { pos } = v.req(id, "pos");
  const grid = v.derived("grid");
  const out: string[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const n = grid.get(`${pos.x + dx},${pos.y + dy}`);
      if ((dx || dy) && n) out.push(n);
    }
  }
  return out;
}

export const Board = BoardBase.exports((v) => ({
  state: v.derived("game").game.state,
  closedSafe: v.derived("closedSafe"),
}))
  .options({
    "cell:reveal": (v) => v.q("cell").filter((e) => !e.cell.open && !v.has(e, "flag")).map((e) => ({ at: e.id })),
  })
  .rules((r) => [
    r.on("cell:reveal").check((_, ctx) => {
      const s = ctx.derived("game").game.state;
      return s === "won" || s === "lost" ? `the game is ${s}` : undefined;
    }),
    r.on("cell:reveal").check((ev, ctx) => (ctx.req(ev.at, "cell").cell.open ? "already open" : undefined)),
    r.on("cell:reveal").check((ev, ctx) => (ctx.has(ctx.get(ev.at), "flag") ? "flagged; unflag it first" : undefined)),

    // First click: lay the mines away from the clicked cell and its neighbours.
    r.on("cell:reveal").priority(10).as("lay mines").apply((ev, ctx) => {
      const game = ctx.derived("game");
      if (game.game.state !== "fresh") return;
      const safe = new Set([ev.at, ...neighbours(ctx, ev.at)]);
      const spots = ctx.q("cell").filter((e) => !safe.has(e.id)).map((e) => e.id);
      ctx.rng("board").shuffle(spots);
      const mines = new Set(spots.slice(0, game.game.mines));
      for (const id of mines) ctx.mut(id, "cell").mine = true;
      for (const e of ctx.q("cell", "pos")) {
        const near = neighbours(ctx, e.id).filter((n) => mines.has(n)).length;
        if (near) ctx.mut(e.id, "cell").near = near;
      }
      ctx.mut(game, "game").state = "playing";
    }),

    r.on("cell:reveal", (ev, ctx) => {
      ctx.mut(ev.at, "cell").open = true;
      ctx.emit("cell:opened", { at: ev.at, from: ev.at });
      ctx.emit("board:settled", {});
    }),

    // The flood fill: an opened empty cell opens its closed neighbours, then emits
    // cell:opened for each so the cascade continues depth-first. Opening before
    // emitting keeps a cell from being queued twice.
    r.on("cell:opened").when({ at: { cell: { near: 0, mine: false } } }).as("flood").react((ev, ctx) => {
      const next = neighbours(ctx, ev.at).filter((n) => {
        const e = ctx.req(n, "cell");
        return !e.cell.open && !ctx.has(e, "flag");
      });
      for (const n of next) ctx.mut(n, "cell").open = true;
      for (const n of next) ctx.emit("cell:opened", { at: n, from: ev.at });
    }),

    r.on("cell:opened").when({ at: { cell: { mine: true } } }).apply((ev, ctx) => ctx.emit("game:lost", { at: ev.at })),
    r.on("game:lost", (_, ctx) => {
      ctx.mut(ctx.derived("game"), "game").state = "lost";
      for (const e of ctx.q("cell")) if (e.cell.mine && !e.cell.open) ctx.mut(e, "cell").open = true;
    }),
    r.on("board:settled", (_, ctx) => {
      const game = ctx.derived("game");
      if (game.game.state === "playing" && ctx.derived("closedSafe") === 0) ctx.emit("game:won", {});
    }),
    r.on("game:won", (_, ctx) => {
      ctx.mut(ctx.derived("game"), "game").state = "won";
    }),

    r.on("cell:flag").check((ev, ctx) => (ctx.req(ev.at, "cell").cell.open ? "open cells cannot be flagged" : undefined)),
    r.on("cell:flag", (ev, ctx) => {
      if (ctx.has(ctx.get(ev.at), "flag")) ctx.remove(ev.at, "flag");
      else ctx.add(ev.at, "flag", {});
    }),
  ]);

/** A fresh board: scenario setup spawns the game entity and one entity per cell. */
export function newBoard(seed: string | number, w = 9, h = 9, mines = 10) {
  return createKernel(Board, {
    seed,
    setup: (ctx) => {
      ctx.spawn({ game: { state: "fresh", w, h, mines } }, "game");
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) ctx.spawn({ pos: { x, y }, cell: { mine: false, open: false, near: 0 } }, "cell");
      }
    },
  });
}

export function cellAt(v: View<B>, x: number, y: number): string {
  const id = v.derived("grid").get(`${x},${y}`);
  if (!id) throw new Error(`no cell at ${x},${y}`);
  return id;
}

/** Text render: `#` closed, `F` flag, `*` mine, `.` empty, digits. */
export function renderBoard(v: View<B>): string {
  const { game } = v.derived("game");
  const rows: string[] = [];
  for (let y = 0; y < game.h; y++) {
    let row = "";
    for (let x = 0; x < game.w; x++) {
      const e = v.req(cellAt(v, x, y), "cell");
      if (!e.cell.open) row += v.has(e, "flag") ? "F" : "#";
      else if (e.cell.mine) row += "*";
      else row += e.cell.near ? String(e.cell.near) : ".";
    }
    rows.push(row);
  }
  return `${rows.join("\n")}\nstate: ${game.state}, closed safe cells: ${v.derived("closedSafe")}`;
}
```

Its test (`test/minesweeper.test.ts`, abridged):

```ts
import { expect, test } from "bun:test";
import { harness } from "@gamebones";
import { cellAt, newBoard, renderBoard } from "../games/minesweeper.ts";

test("first click is safe, flood fill cascades, an open cell refuses", () => {
  const h = harness(() => newBoard("sweep-1"), { render: (k) => renderBoard(k.view()) });
  const v = h.kernel.view();
  const first = cellAt(v, 4, 4);
  h.play("/", "cell:reveal", { at: first });
  expect(v.req(first, "cell").cell.mine).toBe(false);
  h.play("/", "cell:reveal", { at: first });                 // refused: "already open"
  expect(h.kernel.rejections.at(-1)?.reason).toBe("already open");
  expect(h.transcript()).toMatchSnapshot();                  // trace trees + renders as text
  h.verifyReplay();                                          // the JSON log replays to the same save
});
```

A piece of the transcript it snapshots:

```
== play / cell:reveal at=cell#42
cell:reveal at=cell#42
  . cell#45.cell mine false -> true, near 0 -> 2 (lay mines)
  . ... 47 more changes
  cell:opened at=cell#42 from=cell#42
    . cell#32.cell open false -> true (flood)
    ...
    cell:opened at=cell#33 from=cell#42
      . cell#23.cell open false -> true (flood)
      cell:opened at=cell#23 from=cell#33
  board:settled
#########
###112###
...
state: playing, closed safe cells: 25
== play / cell:reveal at=cell#42
!! cell:reveal at=cell#42: already open (check cell:reveal#2)
-- refused: already open
```

---

## 3. Declaring a scope type

```ts
const Base = defineScope("name", {
  components: { hp: z.object({ hp: z.int() }), flag: z.object({}) },   // D13
  events: { "card:play": input({ card: ref(), target: ref() }), hit: event({ target: ref(), dmg: z.int() }, { subject: "target" }) },
  clocks: { fixed: { driver: true }, action: { parent: "fixed" }, slow: { parent: "fixed", scale: [1, 2] }, idle: { elapsed: true } },
  rng: ["loot", "deck"],                                                 // named streams
  packed: { bodies: () => columns({ fields: ["x", "y", "vx", "vy"], capacity: 4096 }) },
  relations: { inPile: relation("in", { ordered: "at" }) },              // adds component `in: { of, at }`
  children: { vn: VnScene },                                              // child slots
  logged: true,                                                           // default true
  saved: true,                                                            // default = logged
})
  .derive({ total: (v) => v.q("hp").reduce((s, e) => s + e.hp.hp, 0), hpOf: (v, id: string) => v.get(id)?.hp?.hp ?? 0 })
  .exports((v) => ({ total: v.derived("total") }))
  .options({ "card:play": (v) => [...] })
  .processes((process) => ({ spawner: process({ clock: "fixed", start: "wave", locals: { waves: 0 }, states: { wave: (p, ctx) => wait(30) } }) }));

type S = SpecOf<typeof Base>;                    // for helper functions: View<S>, Ctx<S>
export const Name: typeof Base = Base.rules((r) => [ ... ]).migrations([ ... ]);
```

- Every name is type-checked: event names and payloads, component names in
  `q/has/mut/add/remove/req/spawn`, clocks, rng streams, packed stores,
  derived names and their arguments, child slots, processes, relations,
  matcher fields, and the path you dispatch to (`"/vn"` is typed as the
  `vn` slot's scope). `test/types.check.ts` lists the mistakes that do not
  compile.
- **Split the chain in two** when helper functions or other scope types
  need the type: declare `Base` with everything except `.rules(...)`,
  type helpers with `View<SpecOf<typeof Base>>`, then
  `export const X: typeof Base = Base.rules(...)`. `rules` and
  `migrations` do not change the type, so the annotation is exact, and it
  breaks the type cycle when two scope types send to each other
  (`World -> children -> VnScene -> rules -> World`).
- `derive` functions see a read-only view; later `.derive` calls may use
  earlier ones. Process steps see the ctx of the spec *before*
  `.processes`, so a process cannot `start` another process by name.
- `version` of a scope type = `migrations.length`.
- Component name `id` and the built-in `triggers` are reserved. Event
  names starting `tick:` or `process:` and the lifecycle names are
  reserved.
- Component schemas are zod: `z.object` strips unknown keys silently; use
  `z.strictObject` when you want typos to throw. Payload schemas are strict:
  an unknown payload key throws.

---

## 4. Events

- `input(shape?, { subject? })`: may be dispatched from outside
  (`kernel.dispatch`, `kernel.queue`) and is logged.
- `event(shape?, { subject? })`: internal; emitted by rules, sent between
  scopes, delivered by `ctx.after`. Dispatching it from outside throws.
- `ref()` marks a payload (or component) field as an entity id. **Before any
  rule runs**, every ref field of the payload must resolve in the receiving
  scope; if not, the node is rejected with
  `<event>.<field>: no entity "<id>" in <path>` (so a delayed event whose
  target died rejects loudly). Refs inside components are not checked.
- `subject` names the ref field whose entity's `triggers` fire (see 5.4).
- Implicit events, listenable without declaring:
  - `tick:<clock>` with `{ tick }` (the clock's new `now`) for every
    declared clock (it never fires for elapsed clocks).
  - `spawned`, `despawned`, `added`, `removed` with `{ id, component? }`.
    They are emitted only if some rule of the scope listens (bulk code stays
    cheap). `spawned` is one event per entity, not per component; no
    `added`/`removed` for an entity spawned in the same node.
  - `opened` with `{}` in a child scope right after `ctx.open`.

---

## 5. Rules

```ts
.rules((r) => [
  r.on("hit").check((ev, ctx) => (ctx.req(ev.target, "hp").hp.hp <= 0 ? "already dead" : undefined)),
  r.on("hit").priority(10).when({ target: { vulnerable: {} } }).as("vulnerable").modify((ev) => { ev.dmg = Math.floor(ev.dmg * 1.5); }),
  r.on("hit").apply((ev, ctx) => { ctx.mut(ev.target, "hp").hp -= ev.dmg; }),
  r.on("hit").react((ev, ctx) => { if (ctx.req(ev.target, "hp").hp.hp <= 0) ctx.emit("die", { who: ev.target }); }),
  r.on("die", (ev, ctx) => ctx.despawn(ev.who)),                       // shorthand: apply
  r.named("thorns", z.object({ dmg: z.int() })).on("hit").react((ev, ctx, self) => { ... self.id, self.params.dmg }),
])
```

### 5.1 Phases

| Phase | Gets | May | Use for |
|---|---|---|---|
| `check` | frozen payload, read view | return a string to refuse | legality |
| `modify` | a writable copy of the payload, view + `rng` | change the payload (re-validated after the phase, refs re-resolved) | interception: armor, vulnerable, crits |
| `apply` | frozen payload, full ctx | write state, emit | the event's effect |
| `react` | frozen payload, full ctx | write state, emit | consequences that need the applied state (death checks) |

Writes in `check`/`modify` throw
`ctx.mut in a check rule ("<label>"): check and modify rules only read; move the write to an apply or react rule`.
`ctx.rng` throws in `check`. A check that returns anything but a string or
`undefined` throws.

### 5.2 Order within an event

1. Phase: check, modify, apply, react.
2. `priority(n)`: higher first (default 0).
3. Registration order.
4. Trigger rules (5.4) come after the global rules of the same phase and
   priority, ordered by entity id, then row order.

### 5.3 Emits resolve after, depth-first

`ctx.emit`, `ctx.send`, `ctx.start`'s first step, `ctx.open`'s `opened`, and
lifecycle events are **queued**. They resolve after the current event node
has finished all four phases (and its writes are validated), in queue
order, each fully (with its own children) before the next. So:

- An emitted child sees everything its parent wrote, including writes made
  after the `emit` call.
- A rule cannot see the effect of its own emit.
- Siblings run in emit order; a "settle" check after a cascade is just an
  event emitted last (minesweeper's `board:settled`).
- In a flood fill, a cell may be queued twice before either copy runs;
  write first, then emit a past-tense event (`cell:opened`).
- A rejected child is recorded in the trace and its siblings continue. A
  rejected **root** refuses the whole dispatch: everything rolls back and
  `dispatch` returns `{ ok: false, rejection, trace }`.
- After a node and its children, processes waiting on that event in that
  scope (`until`) wake, in pid order, as further children.

### 5.4 Matchers, labels, named rules and triggers

- `when(matcher)`: a structural literal match against the payload (D18).
  A ref field (or a lifecycle `id`) matched with an object matches the
  **entity**: `{ at: { cell: { near: 0 } } }`, `{ target: { armor: {} } }`
  ("has armor"). Arrays match by length and element.
- `as(label)`: the name written into each change's `by`; default
  `<phase> <event>`, with `#2`, `#3` for duplicates.
- `r.named(name, paramsSchema?).on(event).<phase>(fn)` registers a rule that
  runs **only** through `triggers` rows. The built-in `triggers` component
  is an array of `{ on, rule, params?, any? }` (build rows with
  `trigger(on, rule, params?, { any? })`). A row's `on` must equal the
  named rule's event and `params` must pass its schema, checked when the
  component is written. The rule gets `self = { id, params }`.
- If the event declares a `subject`, a row fires only on the subject
  entity unless it has `any: true`. Without a subject, every row naming
  the event fires. Lifecycle events use `id` as the subject.

---

## 6. The ctx

Reads (every view: `derive`, `exports`, `options`, `check`, `kernel.view()`):

| Method | One line |
|---|---|
| `path` | This scope's path. |
| `get(id)` | The frozen entity or `undefined`. |
| `req(id)` / `req(id, ...comps)` | The entity, or throw naming the id; with comps, typed as having them (throws naming the missing one). |
| `has(e, comp)` | `comp in e`, as a type guard; `e` may be `undefined`. |
| `q(...comps)` | Entities having all comps, in id order, typed as having them. `q()` is every entity. |
| `related(relation, target)` | Sources pointing at `target`, sorted by the order field then id. Sees the current node's writes. |
| `derived(name, ...args)` | A derived value, memoized (section 10). |
| `now(clock)` | The clock's tick. |
| `packed(name)` | A packed store of this scope (the live object). |
| `read(path, Type)` | Another scope's exports, frozen. |

Plus in `modify`: `rng(stream)` returning `{ float(), int(max), pick(arr), chance(p), shuffle(arr) }`,
and `probe(name, payload?)`: tells listeners (`k.listen`, a run recorder)
about something that is not an event, such as a hit inside a bulk loop. It
is free when nobody listens and never part of state, the log or the hash.

Plus in `apply`, `react`, process steps and `setup`:

| Method | One line |
|---|---|
| `mut(idOrEntity, comp)` | A writable copy of the component; validated, frozen and recorded at the end of the node. |
| `add(e, comp, value)` | Adds or replaces a component. |
| `remove(e, comp)` | Deletes a component (no-op if absent). |
| `spawn(components, name?)` | Creates an entity; returns `${name ?? "e"}#${n}`. |
| `despawn(e)` | Deletes an entity; relations pointing at it clean up first. |
| `emit(event, payload)` | Queues an event in this scope (payload validated now). |
| `send(path, Type, event, payload)` | Queues an event in another scope. |
| `after(clock, ticks, event, payload)` | Emits the event `ticks` ticks from now on `clock`; returns a pid. |
| `start(process, locals?)` | Starts a declared process (locals merge over its declared ones); returns a pid; the first step runs after this node. |
| `stop(pid)` | Cancels a process or pending `after`; `false` if already gone. |
| `open(slot, key?)` | Opens a child scope; returns its path (`/vn`, `/level:3`). |
| `close(path)` | Closes a direct child. |
| `setScale(clock, num, den = 1)` | Rescales a child clock; `0` pauses. |
| `advance(clock, n)` | Advances an elapsed clock by n (after this node); due processes run at their own wake ticks. |

Every error names the id, the scope, the valid alternatives or the fix.

---

## 7. Entities and writes (D13, D14, D16)

- Entities and their components are deep-frozen. `ctx.mut(id, "hp")`
  journals the entity once per dispatch, shallow-copies it once per event
  node, deep-copies the component once per node, and returns the copy. Write
  to it freely during the node.
- At the end of the node every touched component is validated with its
  schema (the parsed value is stored, so zod defaults apply), frozen, and
  recorded as a change `{ id, comp, before, after, by }`. A failing schema
  throws `cell#3.cell fails its schema after "apply hit" in /: near: ... Fix the write in "apply hit"`.
  Writes that end equal to the old value are not recorded.
- Ids are `name#n` with `n` counting per scope. Queries and saves order by
  `n`, never by insertion, so a loaded save iterates exactly like the live
  run. Don't parse ids for meaning.
- Relations: `relation("in", { ordered: "at", onDelete? })` declares the
  component `in: { of: ref, at: number }` and an index. Deleting a target
  removes the relation component from its sources (or despawns them with
  `onDelete: "despawn"`); deleting a source just drops it from the index.
  `related()` sees writes made earlier in the same node, so read the next
  slot *before* moving a card into the pile.
- Any programmer error (throw) inside a dispatch rolls back every entity,
  sys record, packed store and child scope it touched, then rethrows.

---

## 8. Clocks, ticks and processes (D22, D36)

- `kernel.tick(path, clock)` works only on **driver** clocks. One tick: the
  clock's `now` += 1; `tick:<clock>` resolves (with its emitted children);
  then processes due on this clock run in `(wakeAt, pid)` order; then child
  clocks (in this scope, then descendants, whose `parent` resolves to this
  clock) advance by their scale: `acc += num; ticks = floor(acc / den)`, each
  child tick recursively the same way, as children of this tick's node.
- A child clock's `parent` is looked up in its own scope, then ancestors, so
  an overlay's `vn: { parent: "fixed" }` keeps running while the world's
  `game: { parent: "fixed" }` is paused with `setScale("game", 0, 1)`.
  Hitstop and slow motion are child clocks.
- `elapsed` clocks have no ticks; `ctx.advance(clock, n)` from an input
  payload (`resumed { elapsed }`) runs each due process with `now` set to its
  wake tick, so offline catch-up of a crop farm is exact.
- Real-time input: `kernel.queue(path, event, payload)` stores input; the
  next `kernel.tick` dispatches queued input first, each as its own logged
  root, then the tick. The log records the quantization.
- Processes: declared with `process({ clock, start, locals, states })`.
  A step `(p, ctx) => StepResult` runs as its own trace node
  `process:<type>` with apply semantics. `p.locals` is saved (plain JSON;
  mutate it), `p.state`, `p.id`, and `p.woke` (the event that woke it).
  Return `wait(ticks, next?)` (ticks >= 1), `until(event, next?)` (wake after
  that event resolves in this scope) or `done()`. `next` defaults to the
  same state.
- `ctx.after(clock, ticks, event, payload)` is a built-in process (pid
  `after#n`): at delivery the event resolves as a normal node; a dead ref
  rejects it (`!!` in the trace).

---

## 9. Packed stores (D6, D23)

```ts
interface PackedStore {
  snapshot(): Uint8Array; restore(bytes: Uint8Array): void; hash(): string;
  save?(): unknown;       // the store in saves, as plain JSON (else base64 of snapshot())
  load?(data: unknown): void;
  describe?(): unknown;   // aggregate shown on the trace node that touched it
  text?(): string;        // for renders and transcripts
}
```

`columns({ fields, capacity?, defaults? })`: one `Float64Array` per field;
`count`, `add(values) -> index` (missing fields take `defaults`, else 0),
`remove(i)` (swap-remove: row indexes move), `clear()`, `col(field)` (write
it directly), `row(i)`, `text()`. There is no size limit: `capacity` is the
rows allocated up front (default 64), and the store doubles when it fills.
Growing replaces the columns and empties the old arrays (length 0), so take
`col()` again after an `add` instead of keeping one from before it.

In saves a columns store is named columns, `{ "count": 2, "x": [1.5, 2],
"y": ["NaN", "-0"] }` (NaN, the infinities and -0 as strings). Loading
matches by name: a column the save lacks takes its default and one the
store lacks is ignored, so adding or dropping a field needs no migration.
`count` is reserved as a field name.

Bulk work is an ordinary rule on a tick event:

```ts
r.on("tick:action").as("step bodies").apply((_, ctx) => {
  const b = ctx.packed("bodies");
  const x = b.col("x"), vx = b.col("vx");
  for (let i = 0; i < b.count; i++) x[i] = x[i]! + vx[i]!;
}),
```

The store is snapshotted lazily on its first `ctx.packed()` access in a
dispatch (for rollback) and hashed into the log at the end. Commands to a
store are ordinary events of its scope. Custom stores implement the
interface; `snapshot`/`restore` must round-trip exactly and `hash` must be a
function of the data only.

---

## 10. Derived values, exports and computable state (D32)

- `derived(name, ...args)` is memoized per dispatch. Each value records the
  components it queried (`q`, `has`, `related`, `req(id, comps)`); a write to
  one of those components recomputes it, other writes do not. `get`/`req`
  depend on every component; `now` on the clocks; a derived that touches
  `packed()` or `read()` is recomputed on every call. A derived value first
  computed *between* `ctx.mut()` and the assignment into the copy stays
  stale until the node ends; read derived values before `mut` or after the
  node (in a child event).
- Derived results are not frozen and not saved; treat them as read-only.
- `exports(fn)`: what other scopes see through `ctx.read(path, Type)` and
  what `kernel.read` returns. Exported values are deep-frozen. Exporting an
  entity is fine for reading; writing it from another scope throws (D52).
- Computable helpers (`linear`, `timer`, `path`) evaluate stored parameters:

```ts
weapon: z.object({ readyAt: z.int(), cooldown: z.int() })        // the component stores only parameters
if (timer(e.weapon).ready(ev.tick)) { ctx.mut(e, "weapon").readyAt = ev.tick + e.weapon.cooldown; ... }
linear({ base: 0, rate: 0.5, t0: 100 }).when(40)                 // first tick the value reaches 40
path([{ t0: 0, x: 0, y: 0, vx: 2, vy: 0, ay: 0.1 }]).at(12.5)    // renderers may use fractional ticks
```

  When a rule knows when something happens, schedule it with `ctx.after`
  instead of checking every tick.

---

## 11. Scopes (D51)

- A child is opened into a declared slot: `const path = ctx.open("vn")` (or
  `ctx.open("level", "3")` for `/level:3`), closed by its parent with
  `ctx.close(path)`. Opening and closing, and clock rescales, appear in the
  trace as pseudo-changes: `+/vn.scope "vn"`, `clock:game.scale 1/1 -> 0/1`.
- A child's rng streams are seeded from the parent's seed plus the slot, so
  replays open identical children.
- Pass data to a new child by sending it an event right after opening
  (`ctx.send(path, VnScene, "vn:start", {...})`); `opened` resolves first.
- A child reports back by sending its parent an event; the parent then
  closes it (a scope cannot close itself or anything but its own children).
- Unlogged scopes (views, hover, selection) are not logged, hashed or saved.
  After `loadKernel` or `replay` they are absent; reopen them.
- `kernel.dispatch("/vn", "vn:next", {})` targets a scope by path. D17's
  focus and bubbling of input is not implemented: the adapter picks the
  path.

---

## 12. Access laws (D52)

| Law | Broken by | Message |
|---|---|---|
| A rule writes only its own scope's stores. | `ctx.mut(entityFromAnotherScope, ...)` | `ctx.mut(line#2): that entity belongs to scope /vn; a rule writes only its own scope's stores (D52). Send /vn an event instead` |
| | `ctx.mut("line#2", ...)` where the id lives elsewhere | `ctx.mut: no entity "line#2" in /; "line#2" exists in /vn, and a rule writes only its own scope's stores (D52): send that scope an event instead` |
| Other scopes are read through exports only; a logged scope may not read an unlogged one. | `ctx.read("/view", ViewScope)` from a logged scope | `read("/view") from /: logged scope world may not read unlogged scope view (D52); unlogged state reaches logged scopes only through kernel.dispatch of an input event, which gets logged` |
| Logged and unlogged scopes never send to each other. | `ctx.send` across the boundary, either way | `ctx.send from / (logged) to /view (unlogged) crosses the log boundary (D52): ...` |
| A logged scope may not live under an unlogged one. | `defineScope("hud", { logged: false, children: { vn: VnScene } })` | `defineScope("hud"): slot "vn" holds logged scope "vn" under an unlogged scope; a logged scope may not live under an unlogged one (D52). ...` |
| Only input events and driver ticks come from outside. | `kernel.dispatch("/", "vn:closed", ...)` | `kernel.dispatch: "vn:closed" is not an input event of world; only input events and driver ticks may be dispatched from outside (D52). ...` |
| | `kernel.tick("/", "game")` on a child clock | `kernel.tick: clock "game" of world is not a driver; only driver clocks are ticked from outside ...` |
| A scope closes only its own children. | `ctx.close("/vn/deeper")` | `ctx.close("/vn/deeper"): not an open child of /; a scope closes only its own children ...` |

A renderer or view scope may read everything; the simulation reads nothing
of it. Visibility (reading only ancestors and declared siblings) is not
enforced in v1.

---

## 13. The kernel API

```ts
const k = createKernel(Root, { seed: "run-7", setup: (ctx) => { /* spawn, open, start */ } });
```

`hashChain: true` keeps the log's hash chain (tests, replay checks). It is
off by default: records carry `hash: ""`, `k.hash()` stays at the initial
snapshot's hash, and `replay` re-runs such a log unverified (refusals still
throw). The chain is most of a headless tick's cost after the game's own work.
`harness()` turns it on for the kernels it builds.

`checkpointEvery` (default 1000, 0 turns it off) keeps a save every that many
logged dispatches (the last 8). `undo` and the recovery of a tick that throws
replay from the latest one instead of from the start of a long run.

| Call | Returns / does |
|---|---|
| `k.dispatch(path, event, payload)` | Resolves an input event; logs it when the scope is logged. `{ ok: true, trace }` or `{ ok: false, rejection, trace }`. Throws on programmer errors after rolling back. |
| `k.dry(path, event, payload)` | Same code path, then rolls back: the preview. Nothing is logged, hashed or kept. |
| `k.queue(path, event, payload)` | Holds input for the next `tick`. |
| `k.tick(path, clock)` | Flushes the queue (results in `.inputs`), then ticks a driver clock as a logged root. |
| `k.view(path = "/")` | A read view of a scope for renders and tests; typed by the path; survives `undo`. |
| `k.read(path, Type)` | A scope's exports. |
| `k.options(path, event)` | The scope's `options` for an input event. |
| `k.save()` | `{ format, scopes }`: every saved scope by path, parents first, each `{ type, version, entities (id order), sys, packed, children }`; `packed` holds each store's `save()` (named columns for `columns`), or base64 for a store without one. |
| `k.log()` | `{ format, versions, initial, initialHash, records }`; records `{ path, event, payload, hash, repeat? }`, identical consecutive records collapsed. |
| `k.undo(n = 1)` | Reloads the latest checkpoint (or the initial snapshot) and replays up to all but the last n logged dispatches. |
| `k.hash()` | The current chain hash (with `hashChain: true`). |
| `k.paths()` | Open scope paths. |
| `k.rejections` | The last 100 rejections (diagnostics). |
| `k.listen({ dispatch?, probe? })` | Observes without taking part: `dispatch(res, { seq, path, event, payload })` after every logged root dispatch (accepted or refused), `probe({ seq, name, payload, path, event })` on each `ctx.probe`. Dry runs and undo's rebuilds stay silent. Returns the stop function. |
| `loadKernel(Root, save, { hashChain?, checkpointEvery? })` | A kernel from a save, migrating each scope; its log starts at that save. |
| `replay(Root, logFile)` | Rebuilds from `initial`, re-applies every record, verifies each hash (when the log has them); throws `replay diverged at step N, <event>: ...`. |

`setup` runs once as an unlogged dispatch with a full ctx on the root scope
(scenario fixtures, D38); the log's `initial` is the snapshot after it.

Trace nodes: `{ scope, event, payload, rejected?, changes, stores, children }`;
changes `{ id, comp?, before?, after?, by }` (no `comp` = whole-entity
spawn/despawn; no `before` = created; no `after` = deleted). Process steps
are nodes `process:<type>` with `{ pid, state }`.

---

## 14. Testing with the harness (D38)

```ts
const h = harness(() => newBoard("seed"), { render: (k) => renderBoard(k.view()), maxChanges: 8 });
h.play("/", "cell:reveal", { at });   // dispatch, capture trace tree + render; returns the text
h.quiet("/", "cell:flag", { at });    // dispatch without capture; throws if refused
h.tick("/", "fixed", 60);             // 60 ticks, then one frame; queued inputs and rejections on the way are listed
h.note("after the boss");             // a free line
expect(h.transcript()).toMatchSnapshot();
h.verifyReplay();                     // JSON round trip of the log, replay, compare saves (the chain is on by default in a harness)
h.kernel                              // the kernel, for direct asserts
```

Transcript legend: `== play <path> <event> <payload>` starts a capture; each
trace node is a line (`event k=v ... @<scope>` when it changes scope,
`[store: summary]` when it touched a packed store), its changes indented
under it with `.` (`id.comp field a -> b (by)`, `+id {comps}` spawn, `-id`
despawn, `+id.comp {...}` add, `-id.comp` remove); `!!` marks a rejected
node with its reason and rule; `-- refused:` when the root was refused;
`> before tick N:` lists queued input; then your render.

Tips: keep renders small and stable (they are snapshots); drive real-time
games with `h.tick(path, clock, n)` and assert on `k.view()`; use `k.dry` to
assert on a preview's payloads (`res.trace.children`); a render should call
only views (never dispatch).

---

## 15. Saves, the log, replay, undo (D12, D30)

- **Save** with `k.save()`; it is plain JSON (packed `columns` as named
  columns, other stores as their `save()` or base64). Load with
  `loadKernel(Root, save)`.
- **Migrations**: `.migrations([v0to1, v1to2])`, each `(data) => data` over
  `{ entities, sys, packed, children }` of one saved scope; packed stores are
  plain JSON there, e.g. `(data.packed.foes as SavedColumns).xp = ...`
  (a new column needs no migration at all). After migrating,
  every component is validated; a leftover unknown component throws
  `save: c#1 has component "count", which counter does not declare; add a migration that renames or drops it`.
  A save from newer code throws.
- **The log is replay, not the save**: `initial` snapshot plus input
  records. Each record's `hash` chains over the canonical JSON of the
  dispatch's changes, the touched scopes' sys records (clocks, rng,
  processes), logged children, and the hashes of touched packed stores
  (only with `hashChain: true`; otherwise `hash` is "").
  Replay needs the code version that recorded it (`versions` are checked).
- **Undo** is replay minus the last n records, from the latest checkpoint.
- Inside any rule or process step `Math.random` and `Date.now` throw: use
  `ctx.rng(stream)` and time carried in input payloads or `ctx.now(clock)`.

---

## 16. Traps and their messages

| You wrote | You get | Fix |
|---|---|---|
| `e.hp.hp -= 1` on an entity from `get/q/req` | `"apply hit" wrote to a frozen object (...): entities, components and payloads are frozen. Write components through ctx.mut(id, "comp") ...` | `ctx.mut(e, "hp").hp -= 1` |
| `ctx.req(id).hp.hp` | TS: `hp` is possibly undefined | `ctx.req(id, "hp").hp.hp`, or `has()`/`q()` |
| a write in `check`/`modify` | `ctx.mut in a check rule ("..."): check and modify rules only read; move the write to an apply or react rule` | move it |
| `ctx.rng` in `check` | `ctx.rng in a check rule (...): a roll changes state, and checks only read` | roll in modify/apply |
| `Math.random()` / `Date.now()` in a rule | `Math.random inside a rule or process step: use ctx.rng(stream) ...` / `Date.now inside a rule ...: the kernel owns no wall clock ...` | rng streams; time in payloads |
| a check returning `false`/`true` | `check rule "..." returned boolean; return a reason string to refuse, or nothing to allow` | return a string or `undefined` |
| reading the result of your own `emit` | nothing happened yet | emits resolve after the node (5.3) |
| moving a card then asking `related()` for the pile's top slot | the card counts itself | read the slot before `mut` |
| a delayed event whose target died | `!! enemy:burn target=enemy#3: enemy:burn.target: no entity "enemy#3" in /` in the trace | expected: it is loud by design; `ctx.stop(pid)` to cancel |
| a ref to a missing entity in a dispatched payload | `{ ok: false }` with reason `cell:reveal.at: no entity "cell#999" in /` | pass a live id |
| unknown or extra payload key | `kernel.dispatch: bad payload for "go": (root): Unrecognized key: "bad"` | match the declared shape |
| `wait(0)` | `process p#3 (spawner.wave): wait(0) needs a whole number of ticks >= 1` | wait at least 1 |
| a `Map`/class in a component or locals | `non-plain object in state: Map; state holds plain JSON only` | plain JSON; packed stores for binary |
| `kernel.dispatch` inside a rule | `kernel.dispatch/tick was called while another dispatch is running; inside rules use ctx.emit, ctx.send or ctx.after` | emit |
| type cycle between scope types (TS7022 "implicitly has type any") | | annotate: `export const X: typeof XBase = XBase.rules(...)` |
| a ctx captured and used after its rule | `ctx.mut: this ctx belongs to a rule that already finished; use the ctx passed to the current rule or process step` | use the current ctx |
| an unlogged scope expected after load | `no scope at "/view"; open scopes: /` | reopen views after `loadKernel`/`replay` |

---

## 17. What v1 does not have

Renderers, Vue/Pixi adapters, kernel spatial (std has a
scratch Grid), by-value or prefix indexes, the attributes/effects stdlib, controllers, pathing,
physics, pattern bullets, the inspector, stubs and contract suites, the
replay corpus, edit-and-replay, worker/server hosting, sessions as separate
logs (use a separate kernel per run), rollback netcode, input bubbling by
focus, filtered trace subscriptions (`k.listen` hands over whole
dispatches), hash sampling. See `NOTES.md` for every deviation from the PRD
and the brief.

---

## 18. gamebones/std

Game-agnostic helpers built only on the public kernel surface; import from
`gamebones/std` (`@gamebones/std` in this repo's tests).

**Run recorder**: the full, filtered event log of a run, for balance reports
and bug hunts. It listens through `k.listen`, so a recorded run replays and
hashes exactly like an unrecorded one.

```ts
const rec = record(k, {
  keep: ["enemy:died", "player:hurt"],                    // trace events (names or a predicate)
  probes: ["spawn"],                                       // ctx.probe names kept one entry each (default: all)
  sum: { hit: (p: Hit) => [p.source, p.dmg] },             // bulk probes: one entry per dispatch, { [key]: [count, ...sums] }
  stamp: () => ({ tick: k.view().now("fixed") }),          // fields added to every entry of a dispatch
});
// ... play ...
rec.entries;   // [{ tick, event, path, payload? }, ...]: per dispatch its probes, kept events, then sums
rec.jsonl();   // one JSON object per line
rec.stop();
```

Refused dispatches and dry runs record nothing.

**Delayed input**: decisions made now that go out later, for bots with a
reaction latency. Host-side, on whatever tick count the caller keeps; the
caller queues what `drain` returns.

```ts
const q = delay<Order>({ key: (o) => (o.move ? "move" : undefined) });  // keyed: state; unkeyed: one-shots
q.push({ move: { x: 1, y: 0 } }, clock + latency);
q.push({ card: "c3" }, clock + latency);
for (const o of q.drain(clock)) ...;   // due orders, FIFO within a tick
q.next();                              // tick of the next due order, to sleep until
q.save(); q.load(saved);               // [at, order][]
```

A keyed order drops pending orders of its key due at or after it (they
would undo the newer decision); ones due before it stay, so with a steady
latency every change goes out. A late drain returns only the last due
order of each key. One-shots all go out, in order.

**Spatial grid**: a uniform bucket grid over a square window around a
moving centre, rebuilt from packed columns when a rule needs it. Scratch,
not state: deterministic (a counting sort, rows ascending per bucket) and
never saved. Queries allocate nothing.

```ts
const grid = new Grid(32, 800);              // cell size, window reach from the centre (capacity grows)
grid.build(foes.col("x"), foes.col("y"), foes.count, player.x, player.y);
const n = grid.query(x, y, r);               // broad phase: rows in cells touching the square, in grid.hits[0..n)
grid.nearest(x, y, r, xs, ys, skip?);        // nearest row closer than r, or -1
```

Rows outside the window (or with NaN coordinates) are not indexed.

**Director**: a process that plays a stage's script beat by beat, keeps
background waves going under it, stops the script while a holding beat (a
midboss) is up, and calls the end. Script time is clock time minus the time
held. It sleeps until the next thing it has to do; only a hold is polled.
Everything lives in process locals and the game's rng, so runs replay.

```ts
.processes(() => ({
  director: director<S, Beat, Wave>({
    clock: "action",
    plan: (ctx) => STAGES[ctx.derived("run").stage],   // { beats: [{ at, ... }], waves?: [{ from, to, every, ... }], end }, in ticks
    beat: (ctx, beat, i) => spawnFormation(ctx, beat),
    wave: (ctx, wave) => spawnKind(ctx, weighted(wave.kinds, ctx.rng("spawn").float())),
    end: (ctx) => ctx.emit("boss:approach", {}),
    running: (ctx) => ctx.derived("run").phase === "swarm",   // false: done, no end
    holds: (beat) => beat.midboss === true,
    holding: (ctx) => midbossUp(ctx),                          // polled every `poll` ticks (20)
    warn: { ahead: 90, on: (ctx, beat, inTicks) => ctx.emit("incoming", { ... }) },
  }),
}))
ctx.start("director");                                         // or ctx.start("director", skipTo(beats, 30 * 60))
```

`skipTo` starts partway in (the held time is negative): beats before the
skip never play and the next one is announced with less warning. Beats after
a holding beat are not announced until the hold ends, since their time is
not known yet.

**persist**: saves any JSON value (a kernel save) in the browser, in tiers
by size: up to `jsonMax` characters (2048) plain JSON in localStorage, up to
`zipMax` base64 characters (10240) gzipped in localStorage, larger gzipped in
IndexedDB with a pointer left in localStorage.

```ts
const store = persist({ key: "my-game/save" });   // tier: "json" forces one tier; storage/indexedDB injectable
let data: unknown;
try {
  data = await store.load();                       // null when there is none; a plain JSON value from before loads as is
  k = data ? loadKernel(Game, data as Save) : newGame(seed);
} catch (e) {
  await store.setAside();                          // kept as <key>.broken, never overwritten
  k = newGame(seed);
}
await store.save(k.save());                        // { tier, size }
addEventListener("pagehide", () => store.saveSync(k.save()));
```

`saveSync` writes to localStorage at once whatever the size (gzipped past
`jsonMax`), for `pagehide` and `visibilitychange`; the next `save` moves a
large save back to IndexedDB. An IndexedDB write that finishes after a later
save never replaces it. Storage refusing a write (quota) throws and leaves
the previous save.

**drive**: the loop a bot plays a kernel with. Overlays, picks and the AI
stay in the game.

```ts
drive(k, {
  maxTicks: 60 * 60 * 10,                          // path "/" and clock "fixed" by default
  over: () => runOver(k),
  before: (i) => think(k, i),                      // decide; push orders onto a delay queue
  delay: { queue, send: (o) => k.queue(path, o.event, o.payload), now: () => steered },
  after: (res, i) => onResult(res, i),
});                                                // { ticks }
```

Due orders are sent after `before` and before the tick, so a latency of 0
acts on the same tick.

**Sweeps and reports** (`gamebones/std/sweep`, Node/Bun only): every
strategy on every seed, one JSON file per run, in parallel shard processes.

```ts
// scripts/sweep.ts: bun scripts/sweep.ts <out> [seeds=6]
await sweep({
  strategies: STRATEGIES,                          // [{ name, ... }]
  options: (env) => ({ latency: Number(env.LATENCY ?? 30), hard: Number(env.HARD ?? 1) }),
  before: (opts) => scaleDamage(opts.hard),        // once per process: content overrides
  run: (seed, strategy, opts) => playAndRecord(seed, strategy, opts),   // JSON; `ticks` shows in the progress line
});
// scripts/report.ts: bun scripts/report.ts <sweep dir>... [--out report.html] [--title text]
reportMain({ analyse: (run) => ({ clears: ..., coins: { drops, kills }, xpRate: [...] }), better: { dmgTaken: "low" } });
```

The environment: `ONLY=a,b`, `SEEDS=s1,s2` (else `c1..cN`), `JOBS=n` (default
cores − 2, fewer when free memory is short or runs are few), `SHARD=i/n` (a
share of the runs, for several machines; JOBS splits it further), `FORCE=1`
(redo runs whose file exists; by default an interrupted sweep resumes).
Runs are dealt round-robin over strategy × seed after ONLY and SEEDS. Each
file, `<out>/<strategy>/<seed>.json`, holds `{ strategy, seed, opts, ms,
...result }` and is written to a temporary name and renamed, so a killed job
leaves no half file. A failing run fails its job and the sweep's exit code.

`report` reads one or more sweep directories (the columns) and writes
`report.json` and `report.html`: per metric (maps as `name.key`), each
strategy's mean over its seeds (per-seed values on hover), `×best` (the best
strategy over this one; marked past `spread`, 1.5), a line chart per series
metric, and each directory's options at the top.

---

## 19. gamebones/kds

The keyboard layer (the kds PRD, nested here until a standalone libs repo
exists). Import from `gamebones/kds` (`@gamebones/kds` in this repo). The
core is `Kds`: plugins turn DOM events into kds events, **mappers** rewrite
an event into another code (`KeyW` becomes `Move` with `y: -1`), handlers
bind by matcher (`{ code, mods, ...fields }`). It never touches the kernel;
the host turns key state into logged input.

For a game, `createGameKeys` builds one instance with virtual codes:

```ts
const keys = createGameKeys({
  actions: [
    [{ code: "Back", scopeBack: false }, "pause"],   // Back pauses when no menu takes it
    ["KeyP", "pause"],
  ],
  // move / confirm / back / labels override the defaults (WASD+arrows, Enter/Space/Z, Esc/Backspace)
});
keys.kds.on({ code: "Move", nav: false }, (e) => ...);     // also Up:Move, Blur
keys.kds.on({ code: "Action:pause" }, () => ...);
keys.addStamp(() => ({ screen: ui.screen }));               // fields every key event carries
keys.keyLabels("Action:pause");                             // ["Esc", "Bksp", "P"], for on-screen hints
```

Hints are read back from the same rules that bind the keys, so they cannot
drift. `createKeynav(keys)` adds menu navigation: `vKeynav` is a Vue
directive (typed structurally; kds does not import Vue), each element with
it is a scope, the top scope takes the arrows, Confirm and Back
(`nav: true` on the events it sees), and the game sees keys only when no
scope is open. `open(el, opts)` does the same without Vue. Options: `id`
(remember the selection), `back` (Back closes this scope: sets
`scopeBack`), `confirm`, `autofocus`, `pointer`. Controls under
`[data-nav-skip]` are skipped by the first arrow press. The selected
control carries `data-nav-sel`.

One `createGameKeys` per page: a second one listens to the same keys.

**Rebinding.** Actions sit in slots on `keys.bindings` (the `Bindings`
plugin): `Move`, `Confirm`, `Back`, and one `Action:<name>` per action given
as a physical key (`["KeyP", "pause"]`). Actions given as a matcher on a
virtual code (`{ code: "Back", scopeBack: false }`) are fixed and follow
that code's keys. keynav moves on `Move`, so rebinding movement rebinds the
menus too.

A bind is a key for a button, and a composite for a slot with parts: WASD
is one bind of `Move` (a `QUAD`: up, left, down, right), not four, and the
arrows are another. Known composites have names (`KeyWASD`, `ArrowXY`,
`KeyESDF`, `KeyIJKL`, `Numpad8456`, pairs such as `KeyQE`; games may add to
`composites`); a quad is changed whole, by four presses in part order.

```ts
keys.bindings.bind("Move", ["KeyI", "KeyJ", "KeyK", "KeyL"]); // replaces the first bind
keys.bindings.bind("Action:pause", "KeyX");     // { taken: [{ slot: "Action:bomb", bind: ["KeyX"] }] }
keys.bindings.bind("Action:pause", "KeyW");     // { taken: [], blocked: { slot: "Move", reason: "composite", ... } }
keys.bindings.save();                           // { Move: ["KeyIJKL", "ArrowXY"], ... }: only what differs
keepBindings(keys.bindings, "my-game/keys");    // load from localStorage now, save on every change
await keys.bindings.capture({ count: 4 });      // the next four presses (null on Escape); nothing maps meanwhile
void keys.loadLayout();                         // key caps in the player's layout (Chromium)
```

A key rebound onto a button is taken from other buttons of its group
(`game` for movement and actions, `menu` for Confirm and Back), so Z can
confirm in menus and bomb in play; a button may not take a key out of a
composite, and Confirm and Back (`keep`) never lose their last bind. The
defaults should bind every convention that does not clash (WASD and the
arrows both move; clashing defaults warn). A game whose conventions clash
(Celeste's Z grabs, Hollow Knight's Z jumps) ships named `sets`; `pick`
replaces every bind with one, and `matching()` says which set the binds are.
Keys that type text act only outside text fields; releases act anywhere.

`gamebones/kds/vue` (the one kds module importing Vue, an optional peer
dependency) has `useGameKeys(keys)`: `hint(code, max)` for key hints that
follow rebinds ("WASD", "↑←↓→"), and for a controls screen `rows`,
`capturing` (with the part it waits for), `taken`, `blocked`, `sets`,
`matching`, `rebind(id, index)` (Delete removes the bind, Back's keys
cancel), `cancel`, `unbind`, `reset`, `pick`. The starter's `Controls.vue`
is the example screen to copy and restyle. A game must resolve `vue` to its
own copy (`resolve.dedupe: ["vue"]`, as the starter's vite config does).

---

## 20. Starting a game

```sh
bun scripts/new-game.ts <slug> [--title "Title"] [--dir <path>] [--port <n>] [--no-install]
```

Copies `starter/template` beside this repo (`../<slug>`; the game reaches
the kernel as `../gamebones`), fills in the title, slug and a stable dev
port, runs `git init`, `bun install` and `bun test`, and commits. The
template is a small playable game (dodge the drifters) with the split every
game keeps: `src/sim` on the kernel (content table, a spawner process,
probes, derived values; transcript, replay and recorder tests), `src/view`
with the host loop, a Pixi renderer reading `kernel.view()`, and a Vue shell
whose menus use `v-keynav` from `gamebones/kds`. It also brings the agent
team (`.claude/agents`: slopus, artist, composer, recorder, ui), each
carrying `starter/HOUSE_RULES.md`, `docs/` (BRIEF, ART, NOTES) and the
screenshot gallery script.
