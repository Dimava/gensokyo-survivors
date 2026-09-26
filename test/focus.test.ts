// Focus (Shift) as logged input: the `focus` event reaches the sim, gathers
// the weapons in (a narrower fan), replays from the log, and a save from
// before focus existed still loads.

import { describe, expect, test } from "bun:test";
import { harness } from "gamebones";
import { WEAPON_INDEX, weaponDef } from "../src/content/weapons.ts";
import { activeRun, runView, type Game, type RunPath } from "../src/sim/game.ts";
import { FOCUS } from "../src/sim/tuning.ts";
import { focusAmount, orbitRadius, weaponStats } from "../src/sim/weapons.ts";
import { fixtureGame, render } from "./helpers.ts";

/** One extra projectile per volley, so Reimu's amulets fly as a fan of two. */
const TREE = { core: 3, amount1: 1, hp1: 3 };

/** Ticks until the amulet fires its next volley; returns the angle between that volley's outermost shots. */
function nextVolleySpread(k: Game, path: RunPath): number {
  const p = path as "/run:1";
  const v = runView(k, path);
  const amulet = WEAPON_INDEX.amulet!;
  const newest = (): number => {
    const s = v.packed("shots");
    let t = -1;
    for (let i = 0; i < s.count; i++) if (s.col("weapon")[i] === amulet) t = Math.max(t, s.col("t0")[i]!);
    return t;
  };
  const before = newest();
  for (let i = 0; i < 120 && newest() === before; i++) k.tick(p, "fixed");
  const t0 = newest();
  expect(t0).toBeGreaterThan(before);
  const s = v.packed("shots");
  const angles: number[] = [];
  for (let i = 0; i < s.count; i++) {
    if (s.col("weapon")[i] !== amulet || s.col("t0")[i] !== t0) continue;
    angles.push(Math.atan2(s.col("vy")[i]!, s.col("vx")[i]!));
  }
  expect(angles.length).toBe(2);
  let d = Math.abs(angles[0]! - angles[1]!);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

describe("focus", () => {
  test("a focused volley's fan is narrower, and focus replays from the log", () => {
    const h = harness(() => fixtureGame("focus", { tree: TREE }), { render });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    const p = path as "/run:1";
    const v = runView(k, path);
    expect(v.derived("player").ctrl.focus).toBe(false);

    const open = nextVolleySpread(k, path);
    expect(open).toBeCloseTo(weaponStats("amulet", 1).spread!, 5);

    k.queue(p, "focus", { on: true });
    k.tick(p, "fixed");
    expect(v.derived("player").ctrl.focus).toBe(true);
    const focused = nextVolleySpread(k, path);
    expect(focused).toBeCloseTo(open * FOCUS.spread, 5);
    expect(focused).toBeLessThan(open / 2);

    k.queue(p, "focus", { on: false });
    k.tick(p, "fixed");
    expect(v.derived("player").ctrl.focus).toBe(false);
    expect(nextVolleySpread(k, path)).toBeCloseTo(open, 5);

    h.verifyReplay();
  });

  test("focus pulls orbiting orbs in, easing both ways without jumps, and replays", () => {
    const s = weaponStats("orbs", 1);
    expect(weaponDef("orbs").behaviour).toBe("orbit");
    const open = orbitRadius(s, 1, 0);
    const closed = orbitRadius(s, 1, 1);
    expect(closed).toBeCloseTo(open * FOCUS.orbitRadius, 5);

    const h = harness(() => fixtureGame("focus-ease", { tree: TREE }), { render });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    const p = path as "/run:1";
    const v = runView(k, path);
    const radius = (): number => orbitRadius(s, 1, focusAmount(v.derived("player").ctrl, v.now("action")));
    for (let i = 0; i < 30; i++) k.tick(p, "fixed");
    expect(radius()).toBe(open);

    // Focus in: partway through the ease the orbs are strictly between the two radii, closing in.
    k.queue(p, "focus", { on: true });
    k.tick(p, "fixed");
    const r1 = radius();
    for (let i = 0; i < 3; i++) k.tick(p, "fixed");
    const r2 = radius();
    expect(r1).toBeLessThan(open);
    expect(r2).toBeLessThan(r1);
    expect(r2).toBeGreaterThan(closed);

    // Released mid-ease: the ease turns around from where it was, with no jump.
    const beforeToggle = focusAmount(v.derived("player").ctrl, v.now("action"));
    k.queue(p, "focus", { on: false });
    k.tick(p, "fixed");
    const ctrl = v.derived("player").ctrl;
    expect(ctrl.focusFrom).toBeCloseTo(beforeToggle, 9);
    expect(radius()).toBeGreaterThan(r2);
    expect(radius()).toBeLessThan(open);

    // Settled after the ease, both ways.
    for (let i = 0; i < FOCUS.ease; i++) k.tick(p, "fixed");
    expect(radius()).toBeCloseTo(open, 9);
    k.queue(p, "focus", { on: true });
    for (let i = 0; i < FOCUS.ease + 1; i++) k.tick(p, "fixed");
    expect(radius()).toBeCloseTo(closed, 9);

    h.verifyReplay();
  });

  test("focus locks her facing: she strafes and backpedals facing the same way, and it replays", () => {
    const h = harness(() => fixtureGame("focus-strafe", { tree: TREE }), { render });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as RunPath;
    const p = path as "/run:1";
    const v = runView(k, path);
    const body = () => v.derived("player").body;
    const walk = (x: number, y: number, n = 10): void => {
      k.queue(p, "move", { x, y });
      for (let i = 0; i < n; i++) k.tick(p, "fixed");
    };
    walk(0, -100);
    expect(body().fx).toBeCloseTo(0, 9);
    expect(body().fy).toBeCloseTo(-1, 9);

    // Focused: sidestepping and backpedalling move her, not her facing.
    k.queue(p, "focus", { on: true });
    const x0 = body().x;
    walk(100, 0);
    expect(body().x).toBeGreaterThan(x0);
    const y0 = body().y;
    walk(0, 100);
    expect(body().y).toBeGreaterThan(y0);
    expect(body().fx).toBeCloseTo(0, 9);
    expect(body().fy).toBeCloseTo(-1, 9);
    walk(0, 0);
    expect(body().fy).toBeCloseTo(-1, 9);

    // Released: facing follows movement again.
    k.queue(p, "focus", { on: false });
    walk(-100, 0);
    expect(body().fx).toBeCloseTo(-1, 9);
    expect(body().fy).toBeCloseTo(0, 9);

    h.verifyReplay();
  });

  test("focus strengthens the border's pushback, not its radius or damage", () => {
    expect(weaponDef("border").behaviour).toBe("aura");
    expect(weaponStats("border", 1).knock).toBeGreaterThan(0);
    expect(FOCUS.auraKnock).toBeGreaterThanOrEqual(2);
    expect(Object.keys(FOCUS).filter((key) => key.startsWith("aura"))).toEqual(["auraKnock"]);
  });
});
