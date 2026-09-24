# How Gensokyo Survivors started

The game began as a stress test. On 2026-09-23, Dimava and Claude were redesigning
**gamebones**, a deterministic game kernel, and testing the design against
"gate games": a card battler, a Vampire Survivors–style swarm and a Dead
Cells–style room. Then came the final test, the "Ultimate Hodgepodge" game.

What follows is a cut of that conversation, from the Claude Code session in
`D:\bag\repos\games\gamebones`. It keeps the messages as they were written
(typos included) and leaves out tool calls, which are marked *(N tool calls)*.
Times are UTC.

- The game brief this led to is [AGENT.md](../AGENT.md) (first commit `be75a29`).
- The kernel's notes on building it are in `../gamebones` (branch `v2`).
- What the game agent learned is in [NOTES.md](../NOTES.md).

---

### 2026-09-23 17:07 · Dimava

And for the final test, consiter the Ultimate Hodgepodge (or whatever tahts iin english) Game
A Vampire Surviwor game with Touhou bosses, Touhou figher style skill cards, gacha CCG style card pack drawing, nodebuster style upgrade tree, and five more games that fit well taht I forgot about. Maybe somehow metroidvania and VN and whatever else you come up with

**Claude:** # The ultimate hodgepodge, as a kernel test

Working title: **Gensokyo Survivors**. You listed four parts (Vampire Survivors, Touhou bosses, fighter-style skill cards, gacha packs), and I read your "Nodebuster" as NodeBuster, the upgrade-tree game. On top of your five I add the metroidvania hub and the VN you mentioned, and five more that fit this kind of game:

| # | Part | What it stresses |
|---|---|---|
| 1 | **Survivors run**: auto-weapons, evolutions, 2k enemies, experience gems | systems, swarms, attributes, 60 Hz |
| 2 | **Touhou bosses**: spell cards, 3k bullets, tiny hitbox, grazing | pattern-driven bullets, tasks, timelines, replays |
| 3 | **Fighter skill cards** (Hisoutensoku): a deck drawn *during* real-time combat | rules and triggers in the middle of a 60 Hz sim |
| 4 | **Gacha card packs**: rarity, pity counter, duplicates → shards, collection | meta scope, separate RNG streams, polished reveal |
| 5 | **NodeBuster upgrade tree**: hundreds of nodes, costs, prerequisites | content, attributes, stat previews |
| 6 | **Metroidvania hub**: rooms, ability gates, map fog | controller, regions with persistent changes |
| 7 | **VN**: story, choices, pre-boss dialogue in the middle of a stage | tasks, text beats that hold, overlays on top of combat |
| 8 | **Route map between stages** (Slay the Spire style) | turn-based rules inside a real-time game |
| 9 | **Automation garden** in the hub (Factorio-lite, makes currency) | belt/lane systems, offline catch-up |
| 10 | **Idle expeditions**: send gacha characters away for real hours | real-world time as input |
| 11 | **Fishing minigame**: a tiny game polished to the bone | the Part 1 UX defaults inside a big game |
| 12 | **Bond/affinity**: gifts, affinity unlocking VN scenes and passive skills | rules over meta that cross modules |

Bonus: **daily seeded challenges with a leaderboard**, where the server replays the submitted log to verify the score. That's anti-cheat for free from determinism.

## Walkthrough: one tick of a boss fight

Stage 4, the boss's third spell card, 1,800 enemies, 3,000 bullets, and you play a skill card.

```
input (thin, quantized to tick 18231): move {x:1,y:0}, card:use {slot:2}
pipeline "fixed":
  1. rules    card:use → check cost → modify (passives: "+20% damage while grazing")
              → apply (spawn skill entity, timeline "master-spark") → react
  2. timelines advance: player dash frames, boss attack frames, master-spark hitbox frame 6
  3. tasks    boss spell card script: pc=14 "every 6 ticks fire ring(32, speed 2.1)"
              → command bullets.fire(pattern params)            ← no bullet entities
  4. systems  swarm.step (columns: 1,800 enemies chase the player, spatial hash)
              bullets.step (bullets move by formula; only cells near the player are tested)
              weapons.step (reads the player's derived stats, snapshotted at tick start)
  5. sync     swarm emits killed×37 (aggregated), bullets emits grazed×4 and hit×0
              → rules: xp gems into the gems system, graze meter, card-draw triggers
trace: 1 input node, 3 rule nodes, 4 aggregate system nodes → Director → Pixi
```

**Budget:** the swarm in columns takes about 1 ms. Formula bullets need about 0.3 ms, since positions are computed and only nearby ones are collision-tested. The rules layer handles a handful of events per tick. That's roughly 2–3 ms of the 16 ms frame, which is feasible in TypeScript. That's "particles are not objects" at its limit, and it holds. The whole boss fight is a replay, exactly like Touhou's `.rpy` files.

## Walkthrough: opening one card pack

`pack:open` happens once. A rule uses the `gacha` RNG stream in the `meta` scope, so runs never shift your pulls, and updates the pity counter. It then emits `card:pulled` ten times, each carrying its rarity.

The Director does the drama:
- Cards come in face-down one after another.
- The glow builds by rarity, with a pause before an SSR.
- Duplicates turn into shards on screen.
- Tapping speeds up the rest instead of skipping it.

That's one event in the kernel and all the polish in presenters, which is the Part 1 model working inside a huge game.

## Verdict

### What held
- **The two layers.** The boss fight is the ultimate test of them, and they pass.
- **Run vs. meta scopes.** This is the most scope-heavy genre there is, and the split maps onto it cleanly.
- **Events and phases.** Skill cards, passives, evolutions and gacha pity are all triggers and modifiers.
- **Tasks, timelines, the Director, and module ownership.** With 12 modules, ownership isn't optional; it's what keeps the code from turning into spaghetti.
- **Replays.** They give you bug reports, leaderboard verification and Touhou-style replay files.

### What broke: three missing core primitives

**1. A mode stack.** The game constantly switches between:
- hub (platformer)
- route map (turn-based)
- run (VS)
- boss (bullet hell)
- VN overlay in the middle of a boss
- pack opening
- fishing
- pause menu over everything

The PRD only has clock pause groups (D22) and regions (D29); nothing decides *what's running*. A mode stack is state that controls four things:
- which modules, systems and clocks are active
- which input events are accepted
- which renderer layer shows (Pixi for combat, Vue/DOM for VN, the upgrade tree and the collection)
- how the Director transitions between modes

Pushing the VN on top of a boss pauses the boss's clock, and popping it resumes. It's a core primitive, and every game with a menu needs it.

**2. Sessions.** A run has its own seed, its own starting snapshot and its own log. It begins from a loadout derived from meta, and at the end it produces rewards that flow back into meta. Meta is a longer-lived session with its own log of purchases and pulls.
- Replaying a run = the meta snapshot at run start + the run log.
- The leaderboard verifies exactly that.
- A mid-run suspend is a save of the run session.

The PRD currently assumes one log and one lifetime, which is wrong for any roguelite.

**3. Real-world time and offline progress.**
- Expeditions and the garden keep going while the game is closed.
- Formalize a `realtime` clock that thin events advance (`resumed {elapsedMs}`), consistent with the chess-clock rule.
- A system may declare an analytic `fastForward(ticks)` ("12 hours of garden = rate × time, capped"). If it doesn't, the kernel fast-simulates it in a worker.

### New stock systems
- **Pattern bullets:** bullets as formula parameters plus a start time, with collision and graze tested only near the player. Every bullet-hell and bullet-heaven game needs it.
- **Pickups:** gems, coins and experience with magnet behaviour, as a system, never as entities.

### A rule that needs spelling out
**Systems read derived stats from a snapshot taken at tick start.** Rules change attributes and effects between sync points; systems never read rule state mid-step. Without this rule, weapon damage in the middle of a tick depends on pipeline order in ways nobody designed.

## Bottom line
The kernel survives the ultimate hodgepodge. It exposed three missing core primitives: **mode stack, sessions, and real-world time with offline catch-up**. Two new stock systems and the snapshot-at-tick-start rule round it out. None of these needs a redesign; they're the pieces a real game shell needs, and this test found them where smaller gate games wouldn't have.

Should I add all of this to the PRD in one pass? That would be:
- the Director and UX items
- modules, ownership and contract tests
- the golden replay corpus with trace diffs
- mode stack, sessions, real-world time and offline catch-up
- pattern bullets and pickups
- the snapshot-at-tick-start rule

I'd tier it in the same pass, with kernel v1 as the mode stack, sessions and the core I listed before, and add Gensokyo Survivors to REPORTS as the stress-test record.

### 2026-09-23 17:13 · Dimava

Okay so I see you have noticed missing pieces like:
- clock is not unique, you may make yout own clocks, e.g. a FixedUpdate for physics and a RAF one for rendering
- scoping which allows you to have many mostly separated systems still easily acessible from each other
Consider those, and consider how your points could be decomposed into missing primitives rather then hijacket on top

**Claude:** Agreed. My last few answers kept adding special cases: pause groups, hitstop, four hard-coded scopes, a mode stack, sessions, and a Director separate from tasks. Each one patched a symptom. The test I should have applied: **nothing in the core may be named after a genre or a use case.** Here's the decomposition.

# The primitives

Nine concepts, and everything else is built from them:

| # | Primitive | What it is |
|---|---|---|
| 1 | **Scope** | A node in a tree. It owns stores, clocks, processes, rules and child scopes. It has *policies*: logged or not, hashed or not, saved where, hosted where (page, worker, server), and a lifetime. It has *exports*: what other scopes may read. |
| 2 | **Store** | State inside a scope. Two kinds: an **entity store** (duck-typed objects, where `'foo' in e` means it has `foo`) and a **packed store** (custom layout behind a contract: snapshot, restore, hash, diff, and optionally fast-forward). |
| 3 | **Index** | A derived lookup over a store: by component, by value, ordered, spatial, tag prefix. |
| 4 | **Clock** | A node in a tree of counters. It has a *source*: a driver (fixed step, RAF), a parent clock (scaled, paused, offset), or elapsed time carried in input events. |
| 5 | **Event** | A typed message sent to a scope. Input, clock ticks, lifecycle changes and cross-scope requests are all events. |
| 6 | **Rule** | A reaction to an event, in phases, with a literal matcher as its condition and code as its body. A bulk rule on a tick works over a packed store. |
| 7 | **Process** | Something that runs over time, is bound to a clock, and can be saved: a program plus its position plus its locals. |
| 8 | **Derived** | A memoized computation with tracked dependencies, consistent within a tick. |
| 9 | **Trace** | The tree each dispatch returns, filtered to whatever a subscriber is watching. |

Content (static data and prefabs) and RNG streams are data held by a scope, not concepts of their own. The journal is how writes are implemented, not a concept either.

## Your two points, in depth

**Clocks are a tree, and anyone can make one.**
```ts
const fixed  = game.clock("fixed", { driver: fixedStep(60) })   // FixedUpdate
const frame  = view.clock("frame", { driver: raf() })            // rendering, never logged
const combat = run.clock("combat", { parent: fixed })            // pause = scale 0
const hitstop = run.clock("hitstop", { parent: combat })         // entities bind to it via a component
const wall   = meta.clock("wall", { source: "elapsed" })         // advanced by resumed {elapsedMs}
```
All of the following are clocks, with no special mechanism for any of them:
- pause groups, time scale, slow motion
- hitstop (bind the entity to a clock whose scale is 0 for N parent ticks)
- the VN pausing the boss
- chess clocks and idle expeditions (`wall`)
- offline catch-up: `wall` jumps 12 h, and packed stores that support fast-forward use it; the rest are simulated in a worker
- the render clock and the Director's timing

The determinism rule becomes structural: **a logged scope's clocks may only have logged sources.** A fixed-step driver produces tick events that are thin input and get logged. A RAF clock can only exist in an unlogged scope.

**Scopes keep things mostly separate but easy to reach.**
```
game ─┬─ meta      (save: profile, log: own)      upgrade tree, collection, gacha, bonds
      ├─ run       (log: own, lifetime: manual)   ← a session: seed + start snapshot + log
      │   ├─ stage (regions load/unload, save: deltas)
      │   ├─ bullets (packed store)   swarm (packed)   pickups (packed)
      │   └─ boss
      ├─ hub ── garden (host: worker, packed belts)
      ├─ vn / fishing / packOpening   (pushed and popped)
      └─ view      (log: none, save: none)         selection, hover, Director, presenters
```
Access follows four laws:
1. **One writer.** A scope writes only its own stores.
2. **Free reads, through exports.** Any visible scope (ancestors, plus declared siblings) can be read synchronously, typed from its scope type: `ctx.scope("meta").derived.loadout`.
3. **Change elsewhere only by events.** Changing another scope's state means sending an event to it.
4. **Information enters logged scopes only through logged events.** A logged scope can't read an unlogged one, so the renderer can read everything and the simulation can never read the renderer.

# Earlier features, rebuilt from primitives

| Earlier feature | Composed from |
|---|---|
| run / meta / view / settings | scopes with different policies |
| sessions (runs, leaderboard replay, mid-run suspend) | a scope with `log: own`, its own seed and start snapshot |
| mode stack, overlays, pause menu | a child scope pushed on the tree, its parent's clock paused, input going to the focused scope first and then bubbling up |
| modules, ownership | scope *types* (code) and scope *instances* (runtime) |
| stubs, contract tests | another scope type with the same events and exports |
| systems | a scope with a packed store, bulk rules on a tick, and its events as its commands |
| levels / regions with persistent changes | scopes that load and unload, with a save policy of "deltas" |
| worker / server / Factorio-scale client | a scope's `host` policy, plus trace subscriptions per scope |
| pause groups, time scale, hitstop, real-world time, offline catch-up | clocks |
| schedules, tasks, timelines, behaviour trees, VN scripts, boss spell cards | processes |
| tweens, Director timing, idle hints | processes on the RAF clock in `view` |
| presenters | rules in `view` that react to trace events |
| relations, spatial hash, hierarchical tags | indexes |
| stats with modifiers, world transforms, "in check", snapshot-at-tick-start | derived values (consistent within a tick by definition) |
| lifecycle hooks | events |
| previews | a dry run of an event |
| autosave | a save policy |
| input quantized to ticks | an event entering a logged scope is stamped to that scope's clock |
| gacha pity not affected by runs | an RNG stream belonging to `meta` |
| triggers as data | store rows that name rules, which are addressable by name |
| rejected moves presented | trace nodes for rejections |

**One thing changed as a result: the renderer is not a special layer.** It's an unlogged scope built from the same primitives: clocks, processes (tweens), rules (presenters) and derived values. The same concepts run the deterministic simulation and the free-running presentation; only policy differs.

# What stays out of the core

These are stdlib built on the primitives, and each should be replaceable by a game:
- the kinematic controller, pathing, and the physics adapter
- attributes and effects
- pattern bullets, swarm, pickups, tile grid and lanes, as packed store types
- the conformance suites
- the harness, the inspector, and replay-corpus diffing
- Pixi, three.js and Vue adapters
- kds

# What it does to the PRD

This is a good change for the log. About 25 of the waved entries become **one entry per primitive plus the four access laws**, with the table above as a REPORTS note ("how earlier features compose"). It follows R1 better: primitives are decisions, and compositions can be worked out from them. Kernel v1 is then simply "the nine primitives, the laws, and the harness." The first gate (a card battler plus a swarm game) exercises all nine.

Should I rewrite the PRD around the primitives in one pass? I'd keep D1–D9, D43 and D44 as your decisions, replace the waved middle with the primitives and laws, move the compositions and the stdlib into REPORTS as a list, and keep the Gensokyo Survivors test as the stress record. Old ids stay stable: superseded entries go to Rejected, each pointing to its primitive.

### 2026-09-23 17:15 · Dimava

And yes, the "animation" concept (which is actually just "computable state" which data does not have to be updated over time) fits well with danmaku

**Claude:** Yes. "Computable state" is the better name, and it decomposes cleanly: it isn't a new primitive. **It's a derived value whose dependencies include a clock.** The data stored is only the parameters, `{origin, vel, curve, t0, clock}`. The value at any moment is `derived(params, clock.now)`. Nothing is written per tick; state changes only when the parameters change, such as a bullet turning, a crop being harvested, or a buff being refreshed.

## Danmaku, the extreme case

- **A spell card's bullets become piecewise formulas.** A typical Touhou bullet: fly out, stop at t=60, aim at the player, accelerate. That's a list of segments with breakpoints, all known when the bullet is fired. A 3,000-bullet pattern is 3,000 rows of parameters that are **never written again** until the bullet dies.
- **Rendering is free at any frame rate.** The renderer evaluates the formula at fractional render time, so interpolation stops being a separate problem. Bullets can even be evaluated in a vertex shader from their parameters, costing zero CPU per frame.
- **The pause, hitstop and slow-motion clocks work automatically.** Freeze the boss's clock and every bullet bound to it freezes, with no per-bullet code. Clocks and computable state reinforce each other.
- **Saves, diffs and the trace are tiny,** because only parameter changes are recorded.

## The same idea elsewhere

Once the pattern is named, it's everywhere:

| Thing | Stored | Instead of |
|---|---|---|
| cooldown | `readyAt` | decrementing a counter every tick |
| buff | `expiresAt` | a timer process |
| crop, expedition, construction | `start`, `duration` | growth ticks |
| idle production | `rate`, `t0`, `base` | adding income every tick |
| tweens, timelines, keyframe tracks | keys + `t0` | stepped animation |
| motion segments, projectiles, platforms | a curve + `t0` | per-tick integration |
| chess clock display | `remaining`, `since` | a ticking value |

**Offline catch-up mostly disappears as a problem.** When the `wall` clock jumps 12 hours, computable values are just correct when read. The remaining work is **discontinuities**: the moment storage fills up, a crop finishes, or a bullet reaches the player's area.

## The one capability it needs

**Computing when something happens.** A computable value can answer "when does this cross X?"
- If it can answer analytically (linear production reaching a cap, a buff expiring, a timeline reaching a frame event), the kernel **schedules an event at exactly that tick**.
- If not (a curved bullet near a moving player), the kernel checks it each tick, only for candidates.

That turns the sim from "update everything every tick" into **discrete-event simulation**: cost scales with how much *happens*, not with how much *exists*. It's also how a Factorio-scale sim stays cheap. It isn't a primitive either: it's a process waiting on a derived condition, with an analytic solve when one is available.

## Caveats

1. **Collision needs sampling.** Bullets are evaluated per tick near the player (grazing is a distance band). At 3,000 cheap formula evaluations per tick that's trivial, but indexes over computable positions must rebuild per tick or use swept bounds.
2. **Determinism:** logged rules evaluate at integer ticks only; fractional time is for renderers. Formulas in logged scopes use the deterministic math module (bun vs. V8 again).
3. **Processes still exist** for things with branching state: VN scripts, behaviour trees, boss phase logic. Anything that is a pure function of time moves to computable state, which shrinks processes to "programs with decisions".

This fits the primitive set without growing it. **Derived** gains clock dependencies and a "when" solver, and **Process** gets smaller. I'll put it in the PRD rewrite as part of Derived, with danmaku, idle production and tweens as the examples in REPORTS.

Should I do the full rewrite now? It would cover the nine primitives, the four access laws, computable state under Derived, and your decisions kept verbatim, with superseded entries moved to Rejected, and compositions and the stdlib moved to REPORTS.


---

*[…] The thread then goes back to kernel work (clocks, Bun-vs-Chrome math, committing, and wiping the old gamebones implementation for a fresh v2).*

---

### 2026-09-23 18:48 · Dimava

sooo please write a md for the agent who will make the new game in ../<> ?

*(1 tool call)*

**Claude:** The interrupted agent did finish its work before the session ended:
- **protoprd:** the PRD rewrite and the new `gensokyo-survivors` folder are committed (`955ed03`).
- **gamebones:** your uncommitted work is snapshotted on `master` (`2a1d5c9`). The `v2` branch is checked out, with the old implementation cleared (`501772d`).

Before I write the brief, one question, because "the new game in `../<>`" has two readings:

1. **An agent that builds the new gamebones kernel.** In that case, where should it work: the `v2` branch of `D:\bag\repos\games\gamebones` (already cleared), or a fresh sibling folder like `D:\bag\repos\games\bones`?
2. **An agent that builds Gensokyo Survivors** in `D:\bag\repos\games\gensokyo-survivors`. The kernel doesn't exist yet, so that agent would have to build the D54 kernel first and then the game on top of it.

My default is option 1 on the `v2` branch. The brief would go in the repo root as `AGENT.md` and cover:
- the PRD to follow
- the v1 cut
- the API shape I sketched
- which old code is still worth reusing (the rng, hash and harness ideas)
- the tests to write
- what counts as done

Which one do you mean, and which folder?

### 2026-09-23 19:17 · Dimava

First the kernel, second the game please

*(1 tool call)*

**Claude:** Now the game brief:

*(2 tool calls)*

**Claude:** I wrote both briefs, one for the kernel and one for the game. Neither file is committed.

**1. Kernel: `D:\bag\repos\games\gamebones\AGENT.md`** (on the `v2` branch)
- **Reading list:** the PRD, the relevant REPORTS sections, and the protoprd format rules. Unwaved entries are binding; waved ones are recommendations the agent may depart from, as long as it records why.
- **Scope:** exactly D54's v1 cut, with an explicit out-of-scope list: no renderers, Director, spatial, physics, sessions, netcode, and so on.
- **The concrete design:**
  - the scope builder API, with a minesweeper example
  - the `ctx` surface
  - copy-on-write writes and the journal
  - the four phases and their order (a check rejects by returning a string, so there's no throw trick)
  - the clock tree, processes, and the packed store contract with `columns`
  - computable helpers, the trace, the access laws
  - saves and migrations, the log with its engine stamp, replay, undo
  - the `portable` math module
- **What to reuse from `master`:** only the rng, hash and harness ideas; the rest is the replaced design.
- **Tests:** five small games (minesweeper, a card battler slice, a swarm, scopes, persistence), a types check file, and the README written as the manual for the next agent.
- **Rules:** commit on `v2` only, never touch `master`, never edit the PRD.
- **Reporting:** a `NOTES.md` with deviations, friction and performance numbers.

**2. Game: `D:\bag\repos\games\gensokyo-survivors\AGENT.md`** (new folder)
- **Precondition:** the kernel is done. The game depends on it as `file:../gamebones`, and the agent may not modify it.
- **Stack:** Pixi v8 for the playfield, a thin Vue shell, its own thin input handling (kds is optional to copy), placeholder art.
- **Milestones, in order,** each with a load target:
  1. Survivors run: 1,500 enemies at 60 fps.
  2. Touhou boss: 3,000 bullets computed from their spawn parameters, graze, hitstop, a VN dialogue overlay.
  3. Skill cards: drawn from a graze meter.
  4. Meta progression: upgrade tree, gacha with pity, the pack-opening showcase, saves across reloads.
  5. Stretch goals from the concept PRD's extra-games list, smallest first.
- **Reporting:** a `NOTES.md` with four sections. The most important is kernel friction, alongside game-side code that belongs in the stdlib, numbers, and deviations. That makes the game the evidence for the next PRD revision.

Would you like me to commit the kernel brief on `v2` and `git init` the game folder so both agents start from a clean state?

### 2026-09-23 19:21 · Dimava

yes proceed until done, beep me and open in chrome when done

*(2 tool calls)*

**Claude:** Both briefs are committed (`f5dc7d4` on gamebones `v2`, and `be75a29` in the new `gensokyo-survivors` repo). The kernel agent is now building gamebones v2 in the background.

The plan from here:
1. When the kernel agent reports back, I'll check its work myself: `bun test`, `tsc` and `oxlint`, plus a read of its NOTES.
2. Then I launch the game agent on `gensokyo-survivors`.
3. When that finishes, I'll check the game, start the dev server, open it in Chrome and send you a notification.

### 2026-09-23 19:22 · Dimava

oh and please a note for the game agent - don

**Claude:** Your message got cut off at "a note for the game agent - don…". What should the note say? The game agent hasn't started yet; it launches only after the kernel is done, so I'll add your note to its brief before then.

### 2026-09-23 19:22 · Dimava

t cut corners, the game may be not large but it should be whole and feel complete or a synonim for not missing a thing but could ggrow

*(3 tool calls)*

**Claude:** I added your note to the game brief (commit `e73757c`), under a new section at the top titled "The bar, from the owner". It quotes you, then spells out what "whole" means:
- **Every screen exists:** title, main menu, pause, settings (volume, reduced motion, animation speed), results and restart. No dead buttons, no "coming soon" screens, no placeholder text.
- **The player is never lost:** the first run teaches the controls in the game, every number on screen is labeled, and every choice shows its effect before you commit to it.
- **Every action has feedback:** motion and sound on each one. With no audio files, it synthesizes short sounds in the browser.
- **Tuned by playing and by bot runs:** a first run lasts a few minutes, the boss can be beaten after a few meta upgrades, and progression never stalls.
- **Nothing breaks:** progress survives a page reload, and the console stays free of errors through a full playthrough.
- **Room to grow:** enemies, weapons, cards, upgrade nodes and bosses live in data tables, so adding one means adding a row.

The milestone rules now say each milestone must meet that bar before the next one starts. M1–M4 together make the whole game, and M5 is growth on top of it.

The kernel agent is still running. The game agent will start from this updated brief once the kernel passes my checks.

### 2026-09-23 19:23 · Dimava

hmm please no reducedmotion, ban that in non-released titels

*(2 tool calls)*

**Claude:** Done. No reduced motion anywhere:
- **Game brief:** settings are now just volume and animation speed, and the brief states the rule outright: no reduced-motion setting, because you ban it in unreleased titles. Committed as `cf87fee`.
- **Kernel PRD:** your rule is recorded as **D55: "Reduced motion is banned in non-released titles."** I also removed reduced motion from the Director's settings in D53. Committed in protoprd.

The kernel agent is still running and doesn't touch this; the Director isn't part of v1.

*(1 tool call)*

**Claude:** The kernel checks out: 19 tests pass, `tsc` and `oxlint` are clean, and the working tree is clean. I'm launching the game agent now.

*(1 tool call)*

**Claude:** The kernel is done and verified, and the game agent is now building Gensokyo Survivors.

**Kernel (gamebones `v2`, 12 commits):**
- **Checks:** 19 tests across 6 files pass, `tsc` is strict and clean, and `oxlint` is clean. I re-ran all three myself.
- **Size:** about 2,000 lines in `src/kernel.ts`. `README.md` is the manual for the game agent; `NOTES.md` has the deviations, friction and numbers.
- **Numbers:**
  - The swarm runs at 0.11 ms per tick with 2,000 bodies.
  - A 463-cell minesweeper flood fill is one dispatch of 9–14 ms.
  - Replay verifies 300 ticks in 40 ms.
  - The portable math gives bit-identical results in bun and Node.
- **The two friction items that matter most:**
  - Scope types that reference each other hit a TypeScript cycle. There's a workaround; the real fix is probably a separate "contract" type per scope.
  - Emits run only after the emitting event finishes. That surprised the agent twice: duplicate cells in the flood fill, and a card counting its own status effect.

  I passed both to the game agent up front.

When the game agent finishes, I'll verify the build, open it in Chrome and send you a notification.
