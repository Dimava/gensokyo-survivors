// Stage formations (a rework after M5): fairies no longer chase. They enter
// in authored formations (lines, streams, V's), take up posts, or circle the
// player; they fire and leave. A midboss stops the script until she is
// defeated or retreats, and the boss's arrival turns the field into points.

import { describe, expect, test } from "bun:test";
import { harness } from "gamebones";
import { ENEMIES, enemyIndex } from "../src/content/enemies.ts";
import { stageDef } from "../src/content/stages.ts";
import { activeRun, loadGame, runView, type Game, type RunPath } from "../src/sim/game.ts";
import { botCard, botSteer, botPick, SKILL, type BotInputs } from "../src/sim/bot.ts";
import { PHASE } from "../src/sim/swarm.ts";
import { FORMATION } from "../src/sim/tuning.ts";
import { renderField } from "../src/view/text-renderer.ts";
import { fixtureGame, render } from "./helpers.ts";

/** A shrine tree a few runs in: enough to live through the stage while the bot steers. */
const TREE = { core: 3, dmg1: 2, hp1: 3, spirit1: 2, greed1: 2, regen1: 2, armor1: 2, speed1: 2, reroll: 2 };

/** Plays uncaptured ticks with the expert bot steering (inputs still go to the log) until `stop` or `max` ticks. */
function advance(k: Game, path: RunPath, max: number, stop: () => boolean = () => false): void {
  const p = path as "/run:1";
  const last: BotInputs = { move: { x: 0, y: 0 } };
  for (let i = 0; i < max && !stop(); i++) {
    const run = runView(k, path).derived("state").run;
    if (run.overlay === "levelup") {
      k.dispatch(`${p}/levelup` as "/run:1/levelup", "levelup:pick", { index: botPick(k, path) });
      continue;
    }
    if (run.overlay === "vn") {
      k.dispatch(`${p}/vn` as "/run:1/vn", "vn:next", {});
      continue;
    }
    if (i % 6 === 0) {
      botSteer(k, path, last, SKILL.expert);
    }
    if (i % 20 === 0) {
      const c = botCard(k, path);
      if (c) k.queue(p, "card:play", { card: c });
    }
    k.tick(p, "fixed");
  }
}

function rows(k: Game, path: RunPath, id: string) {
  const e = runView(k, path).packed("enemies");
  const kind = enemyIndex(id);
  const out: { x: number; y: number; vx: number; vy: number; ax: number; ay: number; phase: number }[] = [];
  for (let i = 0; i < e.count; i++) {
    if (e.col("kind")[i] !== kind) continue;
    const r = e.row(i);
    out.push({ x: r.x, y: r.y, vx: r.vx, vy: r.vy, ax: r.ax, ay: r.ay, phase: r.phase });
  }
  return out;
}

describe("M6 stage formations", () => {
  test("scripted: formations fly in, fire and leave; the midboss holds the stage; the boss clears the field", () => {
    const h = harness(() => fixtureGame("m6", { tree: TREE }), { render, maxChanges: 4 });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    const v = runView(k, path);
    const t = (): number => v.now("action");
    const stage = stageDef("lake");

    // 3 s in: the first beat, a stream of lake fairies from the left, flying right in single file.
    advance(k, path, 180);
    const stream = rows(k, path, "fairy");
    expect(stream.length).toBe(7);
    expect(stream.every((f) => f.vx === 1 && f.vy === 0 && Math.abs(f.y - stream[0]!.y) < 2)).toBe(true);
    // The first formation to come into view, as the player sees it.
    const inView = (): number => {
      const { body } = v.derived("player");
      return rows(k, path, "fairy").filter((f) => Math.abs(f.x - body.x) < 600 && Math.abs(f.y - body.y) < 360).length;
    };
    advance(k, path, 15 * 60 - t(), () => inView() >= 6);
    expect(inView()).toBeGreaterThanOrEqual(6);
    h.tick(path, "fixed");
    h.note(`${(t() / 60).toFixed(1)} s: the first formation of fairies (f) in view:
${renderField(k, path)}`);

    // Fairies that are not shot down leave the field: spawned = killed + alive + gone.
    advance(k, path, 20 * 60 - t());
    const spawned = v.derived("state").run.nextUid - 1;
    const alive = v.packed("enemies").count;
    const killed = v.derived("player").progress.kills;
    expect(spawned - killed - alive).toBeGreaterThan(0);
    h.note(`20 s: ${spawned} spawned, ${killed} shot down, ${alive} on the field, ${spawned - killed - alive} flew away`);

    // 24 s: sunflower fairies fly to posts above the player, hold them, and fire fans from there.
    // They trail a moving player, so arrival time depends on the bot's path: wait for it (at most 5 s).
    advance(k, path, 24 * 60 + 150 - t());
    const holding = (): boolean => {
      const s = rows(k, path, "sunflower");
      return s.length > 0 && s.every((r) => r.phase === PHASE.holding);
    };
    advance(k, path, 300, holding);
    const posts = rows(k, path, "sunflower");
    expect(posts.length).toBeGreaterThan(0);
    const { body } = v.derived("player");
    for (const s of posts) {
      expect(s.phase).toBe(PHASE.holding);
      expect(s.ay).toBeLessThan(0);
      // A post keeps station loosely: it drifts after the player, slower than she moves, so it stays on screen.
      expect(Math.hypot(body.x - s.x, body.y - s.y)).toBeLessThan(FORMATION.postRadius * 2);
    }
    h.tick(path, "fixed");
    h.note(`${(t() / 60).toFixed(1)} s: sunflower fairies (s) holding their posts above the player:
${renderField(k, path)}`);

    // 100 s: Daiyousei arrives, and nothing else spawns while she holds the stage.
    const midboss = enemyIndex("daiyousei");
    const midbossUp = (): boolean => {
      const e = v.packed("enemies");
      for (let i = 0; i < e.count; i++) if (e.col("kind")[i] === midboss && e.col("phase")[i] !== PHASE.leaving) return true;
      return false;
    };
    advance(k, path, 101 * 60 - t(), midbossUp);
    expect(midbossUp()).toBe(true);
    const arrivedAt = t();
    const uid = v.derived("state").run.nextUid;
    advance(k, path, 60 * 60, () => !midbossUp());
    expect(midbossUp()).toBe(false);
    const heldFor = t() - arrivedAt;
    const move = ENEMIES[midboss]!.move;
    expect(move.kind === "hover" && heldFor <= move.stay).toBe(true);
    expect(v.derived("state").run.nextUid).toBe(uid);
    const defeated = rows(k, path, "daiyousei").length === 0;
    if (defeated) expect(v.packed("bullets").count).toBe(0);
    h.tick(path, "fixed");
    h.note(`Daiyousei held the stage for ${(heldFor / 60).toFixed(1)} s and was ${defeated ? "defeated (every bullet turned into points)" : "left to retreat"}:
${renderField(k, path)}`);

    // The script resumes where it stopped, so the boss comes that much later.
    advance(k, path, 200 * 60, () => v.derived("state").run.phase !== "swarm");
    expect(v.derived("state").run.phase).toBe("warning");
    expect(t()).toBeGreaterThanOrEqual(stage.bossAt * 60 + heldFor);
    // The winds blow the swarm away (worth nothing) and the bullets with it; nearby drops spiral in.
    const e = v.packed("enemies");
    expect([...e.col("phase").subarray(0, e.count)].every((ph) => ph === PHASE.blown)).toBe(true);
    expect([...e.col("xp").subarray(0, e.count)].every((xp) => xp === 0)).toBe(true);
    expect(v.packed("bullets").count).toBe(0);
    const d = v.packed("drops");
    expect([...d.col("pulled").subarray(0, d.count)].every((p) => p === 2)).toBe(true);
    h.tick(path, "fixed");
    h.note(`the boss approaches at ${(t() / 60).toFixed(1)} s: strong winds blow the swarm away and spiral the nearby drops in:
${renderField(k, path)}`);

    h.play("/", "run:abandon", {});
    while (activeRun(k)) k.tick(path as "/run:1", "fixed");
    expect(h.transcript()).toMatchSnapshot();
    h.verifyReplay();
  }, 120_000);

  test("a mid-run save from before formations loads: old fairies fly off and the script resumes", () => {
    const k = fixtureGame("m6-save", { tree: TREE });
    k.dispatch("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    advance(k, path, 30 * 60);
    const save = JSON.parse(JSON.stringify(k.save()));
    const scope = save.scopes[path];

    // Make it a version-0 save: enemy rows without the job columns, the director in its old state.
    const bytes = Uint8Array.from(atob(scope.packed.enemies), (c) => c.charCodeAt(0));
    const n = new DataView(bytes.buffer).getUint32(0, true);
    const cut = bytes.slice(0, 8 + n * 8 * 11);
    scope.packed.enemies = btoa(String.fromCharCode(...cut));
    scope.version = 0;
    const director = scope.sys.procs.find((p: { type: string }) => p.type === "director");
    director.state = "swarm";
    director.locals = { piece: 1 };

    const k2 = loadGame(save);
    const v2 = runView(k2, path);
    const e = v2.packed("enemies");
    for (let i = 0; i < e.count; i++) {
      const def = ENEMIES[e.col("kind")[i]!]!;
      expect(e.col("phase")[i]).toBe(def.move.kind === "chase" ? PHASE.active : PHASE.leaving);
    }
    const before = v2.derived("state").run.nextUid;
    advance(k2, path, 10 * 60);
    expect(v2.derived("state").run.nextUid).toBeGreaterThan(before);
  });
});
