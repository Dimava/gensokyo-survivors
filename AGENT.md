# Brief: build Gensokyo Survivors on the gamebones kernel

You are building a game in this folder (`D:\bag\repos\games\gensokyo-survivors`)
on the gamebones v2 kernel. The game is also the kernel's stress test: what
you find hard is as valuable as what you ship. Work from this brief, the
design logs and the kernel's README; nobody will answer questions
mid-task, so make reasonable calls, write them down, and keep going.

## Precondition

The kernel must exist first: `D:\bag\repos\games\gamebones`, branch `v2`,
built from that repo's `AGENT.md`. Check that its `bun test` passes and its
README.md is written. If it is not there yet, stop and say so.

## Read first

1. `D:\bag\protoprd\gensokyo-survivors\PRD.md` — the game. D1 is the
   owner's pitch and binding; `(waved)` entries are recommendations.
2. `D:\bag\repos\games\gamebones\README.md` — the kernel manual. This is
   how you use the engine; read its source only when the README is silent,
   and note every such time as friction.
3. `D:\bag\protoprd\gamebones\PRD.md` — the kernel's design, for the
   concepts (scopes, packed stores, computable state, clocks, processes)
   and the renderer direction (D26, D41, D53).
4. `D:\bag\protoprd\gamebones\REPORTS.md`, section "The hodgepodge stress
   test": how this game was expected to map onto the kernel, including the
   per-tick budget.

## Constraints

- A new git repo in this folder (`git init`), bun, TypeScript strict. Depend
  on the kernel as `"gamebones": "file:../gamebones"`. Commit as you go,
  message style `gensokyo: <what>`, each ending with the trailer line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- **Do not modify the kernel.** If it lacks something, build the smallest
  workaround inside this repo and log it under "Kernel friction" in
  `NOTES.md` (what you needed, which PRD id it touches, the workaround).
  The kernel v1 has no renderer, Director, spatial index, controller or
  pattern-bullet store: you will build game-side versions of the ones you
  need, and those are exactly the stdlib the owner wants evidence for.
- Rendering: Pixi v8 (WebGL) for the playfield, a thin Vue 3 shell for
  menus, the upgrade tree, the collection and the VN text (kernel D41).
  Vite for the dev server. The renderer reads kernel state and traces; the
  simulation never reads the renderer.
- Input: your own small keyboard and pointer handling that turns raw
  events into thin input events (kernel D7). The owner's `kds` library at
  `D:\bag\repos\tools\browser-real-extension\examples\vault\lib\kds.ts` may
  be copied in if it helps; it is optional.
- Placeholder art only: shapes, colours, text. Bosses and characters are
  Touhou-style (it is a private fan project); keep names in one content
  file so they can change.
- Determinism: the simulation replays exactly from its log. Tests run under
  bun and the game runs in Chrome; per the kernel's math dial, pick
  `portable` if you want Chrome-recorded runs to replay in `bun test`, and
  say which you chose and why in NOTES.md.

## Milestones, in order

Finish each (playable, tested, committed) before starting the next. Later
milestones are worth less than a polished earlier one.

**M1. The survivors run.** Player movement at 60 Hz, auto-firing weapons,
enemies as a packed store (columns) chasing the player, experience gems as
a packed store with a magnet radius, level-up choice as an overlay scope
that pauses the run clock and offers 3 upgrades (`options()`), a run timer,
death and a results screen. Target: 1,500 enemies on screen at 60 fps.

**M2. A Touhou boss.** At a set time the stage spawns a boss with 3 spell
cards, each a process driving bullet patterns. Bullets are computable state
(position as a function of time from their spawn parameters, never
integrated per tick), in a packed store you write; collision and graze are
checked only near the player. A hitstop child clock on hits. A short
pre-fight dialogue as a VN overlay scope. Target: 3,000 bullets plus the M1
swarm at 60 fps.

**M3. Skill cards in the fight.** A deck and a hand as an ordered relation,
cards drawn by filling a graze meter, played by input, with costs and
effects written as rules (at least one card whose effect is a `modify`
rule on damage, and one stored as a trigger on the player).

**M4. Meta progression.** A meta scope that survives runs: currency earned
per run, a NodeBuster-style upgrade tree (content: nodes, costs,
prerequisites, stat effects) whose purchases change the next run's loadout,
and gacha card packs (rarity, pity counter on its own rng stream) whose
cards join the M3 deck. The pack opening is the polish showcase: cards come
in face-down, glow builds by rarity, a tap speeds up the rest rather than
skipping. Save and load across page reloads.

**M5. Stretch, only if M1 to M4 are solid.** Pick from the PRD's D3 list,
smallest first: route map between stages, fishing minigame, idle
expeditions (real time as input payload), bonds unlocking a VN scene,
automation garden, metroidvania hub.

## Tests

Use the kernel's harness. For each milestone: a scripted playthrough with a
transcript snapshot (the game writes a text render of its state), a replay
verification of that session, and a timing print (ms per tick at the
milestone's target load). Bots driven by `options()` are welcome.

## Done means

- `bun test` and `tsc --noEmit` pass; `bun run dev` serves a playable game.
- The milestones you reached are playable in Chrome end to end.
- `NOTES.md` holds your reporting.
- Everything is committed.

## Reporting

`NOTES.md` at the repo root, four sections:
- **Kernel friction**: every missing piece, confusing API, bad error
  message or README gap, with the PRD id it touches and your workaround.
  This is the most important output.
- **Game-side stdlib**: what you built that belongs in the kernel's stdlib
  (renderer glue, Director-like sequencing, spatial checks, bullet store),
  with file paths.
- **Numbers**: ms per tick and fps at each milestone's target load, save
  size, log size per minute of play.
- **Deviations**: where you departed from this brief or the game PRD, and
  why.
