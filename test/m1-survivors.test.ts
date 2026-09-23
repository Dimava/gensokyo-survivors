// M1: the survivors run. Movement, auto-fire, the swarm and gems as packed
// stores, level-up as an overlay scope that pauses the run clock, the run
// timer, death and the results in the meta scope.

import { describe, expect, test } from "bun:test";
import { harness } from "gamebones";
import { activeRun, newGame, runView, type RunPath } from "../src/sim/game.ts";
import { msPerTick, render, stress } from "./helpers.ts";

describe("M1 survivors run", () => {
  test("scripted playthrough: move, level up through the overlay, die, results", () => {
    const h = harness(() => newGame("m1"), { render, maxChanges: 6 });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as "/run:1";
    expect(path).toBe("/run:1");
    const v = runView(k, path);

    // Walk right for five seconds: the amulets fire on their own.
    k.queue(path, "move", { x: 100, y: 0 });
    h.tick(path, "fixed", 300);
    expect(v.derived("player").body.x).toBeGreaterThan(600);
    expect(v.derived("player").progress.kills).toBeGreaterThan(0);

    // Circle for a while, answering every level-up with the first choice.
    const dirs = [
      { x: 0, y: 100 },
      { x: -100, y: 0 },
      { x: 0, y: -100 },
      { x: 100, y: 0 },
    ];
    let levelUps = 0;
    for (let i = 0; i < 24; i++) {
      if (i % 3 === 0) k.queue(path, "move", dirs[(i / 3) % 4]!);
      const before = v.now("game");
      h.tick(path, "fixed", 60);
      while (v.derived("state").run.overlay === "levelup") {
        // The overlay paused the run's game clock (D22): fixed ticks, game did not.
        const g = v.now("game");
        h.tick(path, "fixed", 5);
        expect(v.now("game")).toBe(g);
        h.play(`${path}/levelup` as "/run:1/levelup", "levelup:pick", { index: 0 });
        levelUps++;
      }
      expect(v.now("game")).toBeGreaterThan(before - 1);
    }
    expect(levelUps).toBeGreaterThan(0);
    expect(v.derived("weapons").length + v.derived("passives").length).toBeGreaterThan(1);
    h.note(`level-ups taken: ${levelUps}`);

    // Stand still and let the swarm win.
    k.queue(path, "move", { x: 0, y: 0 });
    let guard = 0;
    while (activeRun(k) && guard++ < 400) {
      if (runView(k, path).derived("state").run.phase === "over") {
        // The run is over; it closes itself after the ending beat (uncaptured ticks).
        while (activeRun(k)) k.tick(path, "fixed");
        h.note("the run closed and reported to the meta scope");
        break;
      }
      h.tick(path, "fixed", 60);
      while (activeRun(k) && runView(k, path).derived("state").run.overlay === "levelup") {
        h.play(`${path}/levelup` as "/run:1/levelup", "levelup:pick", { index: 0 });
      }
    }
    expect(activeRun(k)).toBeNull();
    const last = k.view().q("lastRun")[0]!.lastRun.summary;
    expect(last.outcome).toBe("dead");
    expect(k.view().derived("wallet").wallet.coins).toBe(last.coins.total);
    expect(h.transcript()).toMatchSnapshot();
    h.verifyReplay();
  });

  test("timing: ms per tick at 1,500 enemies", () => {
    const k = newGame("m1-perf");
    k.dispatch("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    stress(k, path, 1500, 0);
    const ms = msPerTick(k, path, 300);
    console.log(`M1: ${ms.toFixed(3)} ms per tick at ${runView(k, path).packed("enemies").count} enemies`);
    expect(ms).toBeLessThan(16);
  });
});
