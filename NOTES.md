# NOTES: Gensokyo Survivors on gamebones v2

Reporting per AGENT.md. PRD ids point into `D:\bag\protoprd\gamebones\PRD.md`
(kernel) unless marked "game PRD". Measured on the owner's Windows machine
with bun 1.4.0.

Milestones reached: **M1, M2, M3, M4**, and from M5: **idle expeditions** and
a **second stage** (Forest of Magic, boss Rumia) that opens once the first is
cleared.

Verification follows kernel PRD D56: Chrome is only a renderer. Every test
runs under bun and reads the game through the test renderer
(`src/view/text-renderer.ts`: ASCII playfield, a picture of the shrine tree,
trimmed JSON for overlays and menus). Playing in Chrome end to end is the
owner's manual check.

## Kernel friction

Most important first. "Workaround" is what this repo does; nothing in the
kernel was modified.

1. **Two copies of zod make `tsc` run out of memory, with no error pointing at
   the cause** (D13, packaging). The kernel imports `zod` from its own
   `node_modules` (4.4.3); the game's first `package.json` pulled zod 4.6.5.
   Every component schema then crossed two structurally-compared zod type
   trees: `tsc --noEmit` spent 2.5 minutes and died with "JavaScript heap out
   of memory" at 4 GB; `tsgo` hung as well. A 10-line probe finally showed
   `Type 'ZodObject<...>' is not assignable to type 'ZodType<unknown, ...>'`
   plus TS2589 "excessively deep". Workaround: no zod dependency of our own;
   `tsconfig.json` paths and a Vite alias map `zod` to
   `../gamebones/node_modules/zod`. Fix in the kernel: re-export `z` from
   `gamebones` (or declare zod a peer dependency) and say so in the README's
   first lines. This cost more time than any gameplay feature.
2. **`"gamebones": "file:../gamebones"` does not install on Windows** (D10).
   bun copies the whole kernel folder, `.git` included, and fails with
   `EPERM ... COMMIT_EDITMSG`. The dependency is declared as the brief asks
   (bun prints the failure on every `bun install`), and resolution goes
   through a tsconfig path and a Vite alias to `../gamebones/src/index.ts`.
   Also the kernel's package is named `@dimava/gamebones`, not `gamebones`.
   A `files` list (or `"exports"` without the repo root) would fix both.
3. **Scope types that talk to each other form ES-module cycles, not only TS
   cycles** (D51, D52). The README's split-chain fixes the TS7022 cycle, but
   `Meta` needs `Run` at module evaluation (`children: { run: Run }`) while
   `Run`'s rules need `Meta` for `ctx.send("/", Meta, ...)`; the same for
   `Run` and its overlays. Importing the child module first throws a TDZ
   `ReferenceError`. Workaround: children import their parent's *base* type
   and only use it inside rule bodies; shared schemas moved to
   `src/sim/schemas.ts`; one entry module (`src/sim/game.ts`) fixes the
   import order, documented at its top. Suggestion: let `send`/`read` take a
   scope *name* or a separately declared contract (events + exports) so no
   module needs the other's builder value.
4. **`req()` after `mut()` in the same node returns the live writable copy**
   (D16). The pack opening read `cur = ctx.req(id, "owned").owned`, wrote
   `level: cur.level + 1` through `ctx.mut`, then recorded `cur.level + 1` for
   the reveal: on the second duplicate in one pack `cur` was the mutated
   copy, so the reveal said "Level up to 4" (max is 3) while the save said 3.
   The M4 transcript showed it and I missed it until I saw it while playing.
   Workaround: copy numbers out before writing (`src/sim/meta.ts`). The
   README documents the `related()` version of this trap; `req/get/q` have it
   too and it deserves the same line in section 16.
5. **A trigger that writes nothing leaves no mark in the trace** (D19, D25).
   Graze Ribbon healed a player already at full HP: the write equalled the old
   value, so no change was recorded and a test could not tell the trigger had
   fired at all. Workaround: the card also grants Spirit (always a write).
   A trace note per rule that ran (even with no changes) would fix it.
6. **`.as(label)` is ignored for named (trigger) rules** (D19, D25): changes
   are attributed to the rule's registered name (`grazeHeal`), while the
   README says `as()` sets the `by` label. Harmless once known; the README
   should say it, or `as()` should be refused on named rules.
7. **The harness cannot tick through a scope that closes** (D38).
   `h.tick("/run:1", "fixed", 60)` throws `no scope at "/run:1"` if the run
   ends (and closes itself) inside the batch. Workaround: tests switch to
   uncaptured single `k.tick` calls once the run's phase is "over". A
   `tick` that stops when its scope is gone, reporting it, would help.
8. **No helper for "my parent's path"** (D51). A child reports back with
   `ctx.send(parentPath(ctx.path), RunBase, ...)`; `parentPath` slices the
   string (`src/sim/levelup.ts`). A `ctx.parentPath` (or sending to `".."`)
   would remove the string handling.
9. **Keyed child paths lose their typing** (D51). The run lives at
   `/run:<n>`, so paths are `` `/run:${string}` `` (which does type
   correctly), but `${path}/levelup` does not; views, dispatches and reads
   below the run need `as "/run:1/levelup"` casts (`src/sim/bot.ts`,
   tests). A `k.at(path).child("levelup")` style API, or accepting
   template-literal paths, would keep the types.
10. **Timed effects need their pids kept in state by hand** (D22, D34, D36).
    Hitstop (`hitstop` component with the pid of the `after` that ends it),
    Power Charm (`empowered.pid`), time stop (`timestop.pid`) and card
    statuses (`timed.pids`) all store an `after` pid so a refresh can
    `stop` the old one. The attributes/effects stdlib (D34) would absorb
    this; a `ctx.after(..., { key })` that replaces a pending timer with the
    same key would already remove most of it.
11. **Perf fixtures have no replay-safe way in** (D23, D38). Loading 1,500
    enemies and 3,000 bullets for timings writes the packed stores outside
    any dispatch (`test/stress.ts`); that works but silently makes the log
    unreplayable. A harness "fixture dispatch" for packed stores, or a store
    `seed()` hook that runs inside `setup`, would keep timing runs honest.
12. **The log grows about 180 KB per minute of real play** (D30). Every
    change of held direction is an input record, and it also breaks the
    collapsing of identical tick records, so a record is roughly an input
    plus a tick with a 16-character hash each; an expert-bot run logs about
    190 KB per minute. Fine for bug reports, heavy for a leaderboard. Suggestions: delta-encode
    records, store hashes every N records, or let a scope declare "sticky"
    inputs.
13. **Missing stdlib, built game-side** (D14, D24, D26, D53): a spatial index,
    a pattern-bullet store, a director, a renderer and presenter layer. See
    "Game-side stdlib". None of them fought the kernel; they are just absent.
14. **README gaps I had to read source for** (D30, D51, D22): how child rng
    streams are seeded (parent seed + slot + key; needed to know that
    reopening `/run` would replay the same run, hence `/run:<n>`), whether
    the tick payload is `{}` (it is, which is why tick records collapse),
    and the `TypeAt` rules for keyed paths.
15. **Smaller notes.** `PackedStore` has no way to say "I am big": the
    rollback snapshot copies the whole enemy and bullet stores every tick
    (about 0.2 ms of the 1.6 ms at the M2 load). Dispatching to a path that
    does not exist throws instead of refusing, so UI code checks
    `k.paths()` first. `z.strictObject` for every component caught two typos
    early; strict-by-default (as the kernel NOTES suggest) would be right.

## Game-side stdlib

Pieces the kernel's stdlib should own, with where they live here:

- **Pattern-bullet packed store** (D24, D32, D48): `src/sim/bullets.ts`. The
  D23 contract (snapshot, restore, hash, describe, text) over typed arrays;
  bullets store spawn parameters only; position is closed-form (speed ramp
  to a limit, then an optional turn), evaluated by the sim at integer ticks
  and by the renderer at the current tick. `pos()`, `maxSpeed()`, `styleAt()`.
- **Conservative-advancement broadphase** ("checked only near the player"):
  `stepBullets` in `src/sim/danmaku.ts` and `stepDrops` in
  `src/sim/drops.ts`. Each row stores the first tick it could possibly
  matter (`(distance - reach) / (its speed + the player's speed)`); rows are
  skipped with one comparison until then.
- **Uniform bucket grid** (D14, D35): `src/sim/spatial.ts`. Counting-sort
  rebuild around a moving centre, `query(x, y, r)` into a scratch array,
  `nearest()`. Scratch, not state: rebuilt from the store whenever a rule
  needs it, so it never needs saving or rollback.
- **Emitters as data** (D27-ish): `src/content/patterns.ts` (rows) and
  `emitPattern` in `src/sim/danmaku.ts` (six pattern kinds).
- **Director-like sequencing**: the stage director process
  (`src/sim/director.ts`: wave table, set pieces, boss call, sleeping exactly
  until the next event) and the spell-card process (`src/sim/boss.ts`).
- **Presenter** (D26, D53): `src/view/presenter.ts` walks each dispatch's
  trace (including the queued inputs' traces) and maps event names to
  effects, sounds and UI banners; rejections become toasts with the check
  rule's reason. `src/view/renderer.ts` reads packed stores directly into
  Pixi `ParticleContainer`s from one generated atlas (`src/view/atlas.ts`).
- **Fixed-step host** (D22): `src/view/host.ts` (accumulator, catch-up cap,
  queueing thin input between ticks, autosave, pause as "stop ticking").
- **Thin input** (D7): `src/view/input.ts` (keys and pointer to a quantized
  `move {x, y}` and named actions).
- **Test renderer** (D25, D38, D56): `src/view/text-renderer.ts`, a second
  renderer beside the Pixi one reading the same state: `renderField` (ASCII
  playfield centred on the player, glyphs from the enemy table),
  `renderTree` (the board as a picture), `renderLevelUp`, `renderHand`,
  `renderBoss`, `renderDialogue`, `renderPack`, `renderExpeditions`
  (trimmed JSON). The milestone snapshots show it at the key moments.
- **Bots over options()** (D21, D38): `src/sim/bot.ts`, a lookahead steering
  bot that evaluates future bullet positions exactly (computable state makes
  this cheap), with novice and expert settings for balance sweeps.

## Numbers

| Measure | Result |
|---|---|
| M1: ms per tick, 1,500 enemies (`test/m1-survivors.test.ts`) | **1.0-1.3 ms** |
| M2: ms per tick, 3,000 bullets + 1,500 enemies (`test/m2-boss.test.ts`) | **1.5-3.2 ms** (varies with machine load) |
| Normal play, whole run (bot) | 0.5-0.8 ms per tick (lake), 1.2-1.6 ms (forest, denser) |
| Frame rate | not measured by the tests: rendering is Chrome's job and outside what bun can verify; at the numbers above the simulation leaves more than 13 ms of each 16.7 ms frame to Pixi |
| Save, fresh profile | 825 bytes |
| Save, profile after a run (meta only) | about 1.2 KB |
| Save, mid-run at its largest (4:00, 998 enemies, 2,357 bullets, 1,298 drops) | 672 KB (packed stores as base64) |
| Log per minute of play | about 190 KB (expert bot, `bun scripts/numbers.ts`: 1.63 MB, 19,447 records over a 7.5-minute clear) |
| Whole test suite | 9 tests, about 45 s (M2's playthrough and its replay dominate) |

Balance (bot runs, `bun scripts/balance.ts`): the novice bot dies at 3:00-3:50
on its first runs and clears the boss on the third run after two or three
shrine purchases (seed `s1`); on a lucky seed it clears the first run. The
expert bot clears its first run. A run pays 50-120 donations when lost and
700-2,000 when cleared; the tree totals 9,140.

## Deviations

- **Spell cards do not end on timeout.** In Touhou a timed-out spell simply
  ends. Here the timer is the *bonus* timer: when it runs out the bonus is
  lost, the boss fires a third faster, and the card must still be broken by
  damage. With Touhou's rule every run that survived the boss "cleared" the
  stage, so meta upgrades did not matter for the clear. Recorded in the help
  screen and the HUD ("Bonus failed").
- **Pause is not a scope.** Pausing stops the host from ticking; the
  simulation never knows. The level-up and dialogue overlays *are* child
  scopes that pause the run's `game` clock, as the brief asks.
- **Settings and tutorial progress live outside the kernel** (localStorage
  `gensokyo-survivors/prefs`): they never affect a run, so they stay out of
  the log and the save.
- **The run is `/run:<n>`,** keyed by a run counter, so each run's rng
  streams differ (a child's streams are seeded from parent seed + slot +
  key).
- **Two stages, two bosses** (Cirno and Rumia, three spell cards each). The
  second stage was data (a stage row, a boss row, a dialogue script, one
  enemy row) plus the unlock rule and a save migration for per-stage clears.
- **M5 taken so far:** idle expeditions (the smallest D3 item that fits the
  kernel's elapsed clocks) and the second stage. Not done: route map,
  fishing, bonds, automation garden, metroidvania hub.
- **Placeholder art** is generated shapes (Pixi Graphics into one atlas) and
  SVG busts for the dialogue; all names are in `src/content/names.ts`.
- **Debug hooks kept in the build:** `window.__gs` (host and state, for the
  browser console), `?bot=1` (the bot plays), `?turbo=N`, `?screen=menu`.
