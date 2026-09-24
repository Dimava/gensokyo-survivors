// M2: a Touhou boss. At 4:00 the stage calls the boss: a warning, a VN
// dialogue overlay, then three spell cards, each a process firing computable
// bullets from a packed store. Hitstop is a child clock.

import { describe, expect, test } from "bun:test";
import { harness, type TraceNode } from "gamebones";
import { activeRun, runView, type RunPath } from "../src/sim/game.ts";
import { botCard, botSteer, botPick, SKILL, type BotInputs } from "../src/sim/bot.ts";
import { fixtureGame, msPerTick, render, stress } from "./helpers.ts";
import { renderBoss, renderDialogue, renderField } from "../src/view/text-renderer.ts";

function has(n: TraceNode, event: string): boolean {
  return n.event === event || n.children.some((c) => has(c, event));
}

describe("M2 boss", () => {
  test("scripted playthrough: warning, dialogue overlay, three spell cards, stage clear", () => {
    // A strong shrine so the fight is short and decisive.
    const tree = { core: 3, might1: 4, cooldown1: 3, area1: 3, hp1: 4, armor1: 3, regen1: 3, magnet1: 3, growth1: 3, spark: 1, amount1: 1, might2: 3 };
    const h = harness(() => fixtureGame("m2", { tree }), { render, maxChanges: 6 });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as "/run:1";
    const v = runView(k, path);

    // The bot plays the swarm (every decision is logged input); the transcript samples it.
    const last: BotInputs = { move: { x: 0, y: 0 } };
    const step = (): void => {
      const overlay = v.derived("state").run.overlay;
      if (overlay === "levelup") {
        k.dispatch(`${path}/levelup` as "/run:1/levelup", "levelup:pick", { index: botPick(k, path) });
        return;
      }
      botSteer(k, path, last, SKILL.expert);
      if (v.now("fixed") % 30 === 0) {
        const c = botCard(k, path);
        if (c) k.queue(path, "card:play", { card: c });
      }
    };
    let sawHitstop = false;
    const tickAndWatch = (): void => {
      const res = k.tick(path, "fixed");
      if (!sawHitstop && has(res.trace, "hitstop:start")) {
        // Hitstop (a hit taken, or a spell card breaking) pauses the action clock
        // while the fixed driver keeps counting (D22).
        sawHitstop = true;
        const a = v.now("action");
        const f = v.now("fixed");
        for (let i = 0; i < 3; i++) k.tick(path, "fixed");
        expect(v.now("fixed")).toBe(f + 3);
        expect(v.now("action")).toBe(a);
      }
    };
    while (v.derived("state").run.phase === "swarm") {
      step();
      tickAndWatch();
      if (v.now("fixed") % 3600 === 0) h.note(`minute ${v.now("fixed") / 3600}\n${render(k)}`);
    }
    h.note("the boss approaches");
    h.tick(path, "fixed", 1);
    expect(v.derived("state").run.phase).toBe("warning");
    h.note(`the swarm at the warning:\n${renderField(k, path)}`);
    while (v.derived("state").run.phase === "warning") {
      step();
      k.tick(path, "fixed");
    }
    expect(v.derived("state").run.overlay).toBe("vn");
    // The dialogue: game clock paused, one input per line.
    const vnPath = `${path}/vn` as "/run:1/vn";
    const game = v.now("game");
    h.tick(path, "fixed", 10);
    expect(v.now("game")).toBe(game);
    h.note(renderDialogue(k, path));
    while (k.paths().includes(vnPath)) h.play(vnPath, "vn:next", {});
    expect(v.derived("state").run.phase).toBe("boss");
    expect(v.derived("boss")).toBeDefined();

    // The fight: sample the transcript at each spell card.
    let spell = -1;
    let maxBullets = 0;
    let shotAt = -1;
    let guard = 0;
    while (activeRun(k) && v.derived("state").run.phase !== "over" && guard++ < 60 * 60 * 6) {
      step();
      tickAndWatch();
      const b = v.derived("boss");
      if (b && b.boss.spell !== spell) {
        spell = b.boss.spell;
        h.note(`spell card ${spell + 1}; bullets on the field: ${v.packed("bullets").count}\n${render(k)}\n${renderBoss(k, path)}`);
        shotAt = v.now("action") + 400;
      }
      if (b && v.now("action") === shotAt) {
        h.note(`spell card ${spell + 1}, a few seconds in:\n${renderBoss(k, path)}\n${renderField(k, path)}`);
      }
      if (b) maxBullets = Math.max(maxBullets, v.packed("bullets").count);
    }
    expect(v.derived("state").run.outcome).toBe("clear");
    expect(maxBullets).toBeGreaterThan(100);
    h.note(`most bullets on the field during the fight: ${maxBullets}`);
    h.note(`cleared\n${render(k)}`);
    while (activeRun(k)) k.tick(path, "fixed");
    const summary = k.view().q("lastRun")[0]!.lastRun.summary;
    expect(summary.bossDefeated).toBe(true);
    expect(sawHitstop).toBe(true);
    h.note(render(k));
    expect(h.transcript()).toMatchSnapshot();
    h.verifyReplay();
  }, 120_000);

  test("timing: ms per tick at 3,000 bullets plus 1,500 enemies", () => {
    const k = fixtureGame("m2-perf");
    k.dispatch("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    stress(k, path, 1500, 3000);
    const ms = msPerTick(k, path, 300);
    const v = runView(k, path);
    console.log(`M2: ${ms.toFixed(3)} ms per tick at ${v.packed("bullets").count} bullets + ${v.packed("enemies").count} enemies`);
    expect(ms).toBeLessThan(16);
  });
});
