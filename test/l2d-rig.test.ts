// The rig math (src/art-l2d/rig.ts) on the real models: rest pose is the
// painted pose, parameters move the right layers the right way, physics
// settles, and every part hangs from a deformer that exists. Sprite rigs
// (chibis and mobs): wired, painted at rest, the gait and the hitbox charm.
import { describe, expect, test } from "bun:test";
import { ART_L2D } from "../src/art-l2d/index.ts";
import { Rig, type Model } from "../src/art-l2d/rig.ts";
import { Animator } from "../src/art-l2d/animator.ts";
import { HITBOX_PART } from "../src/art-l2d/chibis.ts";
import { RATE } from "../src/art-l2d/tempo.ts";

const models = Object.entries(ART_L2D).flatMap(([id, set]) => (set.portrait ? [[id, set.portrait] as [string, Model]] : []));
const sprites = Object.entries(ART_L2D).flatMap(([id, set]) => (set.sprite ? [[id, set.sprite.model] as [string, Model]] : []));

/** Mean x, y of a part's deformed vertices. */
function centre(rig: Rig, part: string): [number, number] {
  const f = rig.evaluate().find((p) => p.id === part)!;
  let x = 0;
  let y = 0;
  const n = f.positions.length / 2;
  for (let i = 0; i < f.positions.length; i += 2) {
    x += f.positions[i]! / n;
    y += f.positions[i + 1]! / n;
  }
  return [x, y];
}

/** Every part hangs from a deformer that exists; masks name real parts; ids are unique. */
function wired(model: Model): void {
  const deformers = new Set(model.deformers.map((d) => d.id));
  const parts = new Set(model.parts.map((p) => p.id));
  expect(parts.size).toBe(model.parts.length);
  for (const d of model.deformers) if (d.parent) expect(deformers.has(d.parent)).toBe(true);
  for (const p of model.parts) {
    if (p.parent) expect(deformers.has(p.parent)).toBe(true);
    if (p.mask) expect(parts.has(p.mask)).toBe(true);
  }
}

/**
 * With every parameter at its default, the visible parts sit where they were
 * painted. `skip`: parts whose rest is off-paint by design (fairy wings rest
 * mid-flap, folded to 0.86 of their painted spread).
 */
function restIsPainted(model: Model, skip: (id: string) => boolean = () => false): void {
  const rig = new Rig(model);
  for (const f of rig.evaluate()) {
    if (f.opacity === 0 || skip(f.id)) continue;
    const rest = rig.meshes[f.id]!.rest;
    for (let i = 0; i < rest.length; i++) expect(Math.abs(f.positions[i]! - rest[i]!)).toBeLessThan(1e-3);
  }
}

describe.each(models)("%s portrait", (_id, model) => {
  test("parts, masks and deformers are all wired", () => wired(model));
  test("the default pose is the painted pose (for every visible part)", () => restIsPainted(model));

  test("turning right moves the face right, and more than the back hair", () => {
    const rig = new Rig(model);
    const [irisX] = centre(rig, "irisL");
    const [backX] = centre(rig, "backHair");
    rig.set("AngleX", 30);
    expect(centre(rig, "irisL")[0] - irisX).toBeGreaterThan(10);
    expect(centre(rig, "backHair")[0] - backX).toBeLessThan(0);
  });

  test("closing the eyes hides the irises and lowers the lashes", () => {
    const rig = new Rig(model);
    const [, lashY] = centre(rig, "lashL");
    rig.set("EyeLOpen", 0);
    const frame = rig.evaluate();
    expect(frame.find((p) => p.id === "irisL")!.opacity).toBe(0);
    expect(centre(rig, "lashL")[1] - lashY).toBeGreaterThan(15);
  });

  test("hair swings after a turn and settles", () => {
    const rig = new Rig(model);
    const anim = new Animator(rig, () => 0.5);
    anim.idle = false;
    anim.target = { x: 1, y: 0 };
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      anim.step(1 / 60);
      peak = Math.max(peak, Math.abs(rig.params.HairSide!));
    }
    expect(peak).toBeGreaterThan(0.05);
    for (let i = 0; i < 600; i++) anim.step(1 / 60);
    expect(Math.abs(rig.params.HairSide!)).toBeLessThan(0.01);
  });
});

describe.each(sprites)("%s sprite", (_id, model) => {
  test("parts, masks and deformers are all wired", () => wired(model));
  test("the default pose is the painted pose (visible parts but the wings)", () => restIsPainted(model, (id) => /^wing[LR]$/.test(id)));

  test("the idle cycle moves something and comes back", () => {
    const rig = new Rig(model);
    const anim = new Animator(rig, () => 0.99);
    anim.rate = 1;
    const at = () => rig.evaluate().flatMap((f) => [...f.positions]);
    const a = at();
    for (let i = 0; i < 15; i++) anim.step(1 / 60);
    const b = at();
    expect(Math.max(...a.map((v, i) => Math.abs(v - b[i]!)))).toBeGreaterThan(0.5);
  });
});

describe("Reimu's chibi", () => {
  const model = ART_L2D.reimu!.sprite!.model;
  /** The hitbox charm's centre: the middle vertex of its 2x2 grid. */
  const charm = (rig: Rig): [number, number] => {
    const f = rig.evaluate().find((p) => p.id === HITBOX_PART)!;
    return [f.positions[8]!, f.positions[9]!];
  };

  test("the charm is a 2x2 grid centred on its rect (the pin point is its exact middle)", () => {
    const part = model.parts.find((p) => p.id === HITBOX_PART)!;
    expect(part.mesh).toEqual({ kind: "grid", nx: 2, ny: 2 });
    const [x, y] = charm(new Rig(model));
    expect(x).toBeCloseTo(part.rect.x + part.rect.w / 2, 6);
    expect(y).toBeCloseTo(part.rect.y + part.rect.h / 2, 6);
  });

  test("walking leans into the move and bobs; slow walk is calmer; standing settles", () => {
    const run = (move: { x: number; y: number }, slow: boolean) => {
      const rig = new Rig(model);
      const anim = new Animator(rig, () => 0.99);
      anim.move = move;
      anim.slow = slow;
      for (let i = 0; i < 120; i++) anim.step(1 / 60);
      let bob = 0;
      let lean = 0;
      const steps = Math.round(60 / RATE.slowWalk);
      for (let i = 0; i < steps; i++) {
        anim.step(1 / 60);
        bob = Math.max(bob, Math.abs(rig.params.Bob!));
        lean += rig.params.BodyAngleX! / steps;
      }
      return { bob, lean };
    };
    const walk = run({ x: 1, y: 0 }, false);
    const slow = run({ x: 1, y: 0 }, true);
    const left = run({ x: -1, y: 0 }, false);
    expect(walk.lean).toBeGreaterThan(1);
    expect(left.lean).toBeLessThan(-1);
    expect(slow.lean).toBeGreaterThan(0);
    expect(slow.lean).toBeLessThan(walk.lean);
    expect(slow.bob).toBeLessThan(walk.bob);
  });

  test("the tempo is calm: a stride takes most of a second, a slow one longer", () => {
    expect(1 / RATE.walk).toBeGreaterThan(0.8);
    expect(RATE.slowWalk).toBeLessThan(RATE.walk);
  });
});
