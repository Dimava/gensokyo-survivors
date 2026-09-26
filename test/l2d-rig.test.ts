// The rig math (src/art-l2d/rig.ts) on the real models: rest pose is the
// painted pose, parameters move the right layers the right way, physics
// settles, and every part hangs from a deformer that exists. Sprite rigs
// (chibis and mobs): wired, painted at rest, the gait and the hitbox charm;
// the chibi arms played through the lab's film (film.ts) and checked as an
// animator would: swinging in turn with overlap, never stuck at a limit,
// never popping, settling, not twins, and the hit, the fall and the faces.
import { describe, expect, test } from "bun:test";
import { ART_L2D, type SpriteRig } from "../src/art-l2d/index.ts";
import { Rig, type Model } from "../src/art-l2d/rig.ts";
import { Animator } from "../src/art-l2d/animator.ts";
import { HITBOX_PART } from "../src/art-l2d/chibis.ts";
import { SHOULDER } from "../src/art-l2d/chibi.ts";
import { playFilm } from "../src/art-l2d/film.ts";
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

describe("chibi arms", () => {
  const armed = Object.entries(ART_L2D).flatMap(([id, set]) => (set.sprite?.model.parts.some((p) => p.id === "armL") ? [[id, set.sprite] as [string, SpriteRig]] : []));
  const LIMBS = ["ArmL", "ArmR", "ArmLBend", "ArmRBend", "ArmLFall", "ArmRFall"];
  const LOOSE = ["Sleeve", "HairSide", "HairBack", "HairFront", "Ribbon"];

  /** A rig of `sprite` and its animator as the field runs it (idle, at the rig's rate), snapped to rest. */
  const make = (sprite: SpriteRig, idle = true) => {
    const rig = new Rig(sprite.model);
    const anim = new Animator(rig, () => 0.99);
    anim.rate = sprite.rate;
    anim.idle = idle;
    anim.snap();
    return { rig, anim };
  };

  /** The film (film.ts) at 60 fps: each parameter's values per row, hit-stop frames left out (the pose holds there on purpose). */
  const film = (sprite: SpriteRig, params: string[], span = 2) => {
    const { rig, anim } = make(sprite);
    const rows = new Map<string, Record<string, number[]>>();
    playFilm(anim, span, (row, _i, u) => {
      if (row.dt?.(u) === 0) return;
      let v = rows.get(row.name);
      if (!v) rows.set(row.name, (v = Object.fromEntries(params.map((p) => [p, []]))));
      for (const p of params) v[p]!.push(rig.params[p] ?? 0);
    });
    return rows;
  };

  /** Pearson correlation of a and b. */
  const corr = (a: number[], b: number[]) => {
    const n = a.length;
    const ma = a.reduce((s, x) => s + x, 0) / n;
    const mb = b.reduce((s, x) => s + x, 0) / n;
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < n; i++) {
      ab += (a[i]! - ma) * (b[i]! - mb);
      aa += (a[i]! - ma) ** 2;
      bb += (b[i]! - mb) ** 2;
    }
    return ab / Math.sqrt(aa * bb || 1);
  };

  /** The vertex of the left arm's mesh farthest from the shoulder at rest (the hand), as an index into its positions. */
  const handOf = (rig: Rig) => {
    const rest = rig.meshes.armL!.rest;
    const d = (i: number) => Math.hypot(rest[i]! - SHOULDER[0], rest[i + 1]! - SHOULDER[1]);
    let far = 0;
    for (let i = 0; i < rest.length; i += 2) if (d(i) > d(far)) far = i;
    return far;
  };

  test.each(armed)("%s: walking, the hands swing in turn, each forearm a few frames behind its arm", (_id, sprite) => {
    const { rig, anim } = make(sprite);
    anim.move = { x: 0, y: 1 };
    for (let i = 0; i < 120; i++) anim.step(1 / 60);
    const hand = handOf(rig);
    const lo = [Infinity, Infinity];
    const hi = [-Infinity, -Infinity];
    const arm: number[] = [];
    const bend: number[] = [];
    const turn: number[] = [];
    for (let i = 0; i < Math.round(120 / RATE.walk); i++) {
      anim.step(1 / 60);
      arm.push(rig.params.ArmL!);
      bend.push(rig.params.ArmLBend!);
      turn.push(rig.params.ArmL! - rig.params.ArmR!);
      // The hand, relative to the dress.
      const [dx, dy] = centre(rig, "dress");
      const f = rig.evaluate().find((p) => p.id === "armL")!;
      const x = f.positions[hand]! - dx;
      const y = f.positions[hand + 1]! - dy;
      lo[0] = Math.min(lo[0]!, x);
      lo[1] = Math.min(lo[1]!, y);
      hi[0] = Math.max(hi[0]!, x);
      hi[1] = Math.max(hi[1]!, y);
    }
    expect(Math.hypot(hi[0]! - lo[0]!, hi[1]! - lo[1]!)).toBeGreaterThan(8);
    // One out as the other comes in.
    expect(Math.min(...turn)).toBeLessThan(-0.6);
    expect(Math.max(...turn)).toBeGreaterThan(0.6);
    // Overlap: the forearm swings too, and matches the arm best a few frames late (not in step with it, as one stiff piece).
    expect(Math.max(...bend) - Math.min(...bend)).toBeGreaterThan(0.3);
    const at = (L: number) => corr(arm.slice(0, arm.length - L), bend.slice(L));
    let lag = 0;
    for (let L = 1; L <= 30; L++) if (at(L) > at(lag)) lag = L;
    expect(lag).toBeGreaterThanOrEqual(3);
    expect(lag).toBeLessThanOrEqual(20);
    expect(at(lag)).toBeGreaterThan(0.7);
  });

  test.each(armed)("%s: through the film no limb sticks at its limit, nothing pops, and the loose things hold at theirs only briefly", (_id, sprite) => {
    const stuck: string[] = [];
    const pops: string[] = [];
    for (const [row, v] of film(sprite, [...LIMBS, ...LOOSE])) {
      for (const p of [...LIMBS, ...LOOSE]) {
        const xs = v[p]!;
        // Arms and forearms ease into their limits and never sit there; hair, ribbon and sleeves may touch theirs on a quick turn.
        const pinned = xs.filter((x) => Math.abs(x) >= 0.98).length / xs.length;
        if (pinned > (LIMBS.includes(p) ? 0 : 0.1)) stuck.push(`${row} ${p} ${(pinned * 100).toFixed(0)}%`);
        // A pop is a change of speed within one frame (a swing, however fast, changes speed smoothly). The hit's first frame snaps by design.
        for (let i = row === "hit" ? 2 : 1; i + 1 < xs.length; i++) {
          const pop = Math.abs(xs[i + 1]! - 2 * xs[i]! + xs[i - 1]!);
          if (pop > 0.08) pops.push(`${row} ${p} frame ${i}: ${pop.toFixed(3)}`);
        }
      }
    }
    expect(stuck).toEqual([]);
    expect(pops).toEqual([]);
  });

  test.each(armed)("%s: stopping, the arms swing on past and settle; standing, the two never move as twins", (_id, sprite) => {
    const { rig, anim } = make(sprite, false);
    anim.move = { x: 1, y: 0 };
    for (let i = 0; i < 120; i++) anim.step(1 / 60);
    anim.move = { x: 0, y: 0 };
    const hand: number[] = [];
    for (let i = 0; i < 180; i++) {
      anim.step(1 / 60);
      hand.push(rig.params.ArmLBend!);
    }
    // The hand swings past and back a few times at most, then is still.
    let turns = 0;
    for (let i = 1; i + 1 < hand.length; i++) if ((hand[i]! - hand[i - 1]!) * (hand[i + 1]! - hand[i]!) < 0 && Math.abs(hand[i]!) > 0.02) turns++;
    expect(turns).toBeLessThanOrEqual(6);
    for (const id of ["ArmL", "ArmR", "ArmLBend", "ArmRBend"]) expect(Math.abs(rig.params[id]!)).toBeLessThan(0.02);
    // Twenty seconds standing (idle, as the field runs it): both arms move, and not in step.
    const idle = make(sprite);
    const l: number[] = [];
    const r: number[] = [];
    for (let i = 0; i < 1200; i++) {
      idle.anim.step(1 / 60);
      l.push(idle.rig.params.ArmL!);
      r.push(idle.rig.params.ArmR!);
    }
    expect(Math.max(...l) - Math.min(...l)).toBeGreaterThan(0.1);
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(0.1);
    expect(corr(l, r)).toBeLessThan(0.9);
  });

  test.each([1, -1])(
    "knocked to %p: flung out (the far arm the more), the hands trailing, wincing; down, the arm on that side lies open, the other drapes over her, swirls for eyes; up again, all at rest",
    (knock) => {
      const { rig, anim } = make(ART_L2D.reimu!.sprite!, false);
      for (let i = 0; i < 30; i++) anim.step(1 / 60);
      anim.knock = knock;
      anim.recoil = 1;
      anim.step(1 / 60);
      // The arm the body is driven out from under flies out the more; its hand trails without kinking.
      const [far, near] = knock > 0 ? ["ArmL", "ArmR"] : ["ArmR", "ArmL"];
      expect(rig.params[far]!).toBeGreaterThan(0.6);
      expect(rig.params[far]!).toBeGreaterThan(rig.params[near]! + 0.1);
      expect(rig.params[`${far}Bend`]!).toBeLessThan(-0.1);
      expect(rig.params[`${far}Bend`]!).toBeGreaterThan(-0.6);
      expect(rig.params.Wince!).toBe(1);
      expect(rig.params.EyeLOpen!).toBe(0);
      for (let i = 0; i < 10; i++) anim.step(1 / 60);
      expect(rig.params[near]!).toBeGreaterThan(0.45);
      // Launched (the hit wearing off as she tips over): still wincing, no swirls yet.
      anim.recoil = 0.4;
      anim.down = 0.55;
      for (let i = 0; i < 30; i++) anim.step(1 / 60);
      expect(rig.params.Wince!).toBeCloseTo(0.4, 6);
      expect(rig.params.Dizzy!).toBe(0);
      // Down.
      anim.recoil = 0;
      anim.down = 1;
      for (let i = 0; i < 120; i++) anim.step(1 / 60);
      const [ground, over] = knock > 0 ? ["ArmRFall", "ArmLFall"] : ["ArmLFall", "ArmRFall"];
      expect(rig.params[ground]!).toBeGreaterThan(0.3);
      expect(rig.params[over]!).toBeLessThan(-0.5);
      expect(rig.params.Sleeve! * knock).toBeGreaterThan(0.2);
      expect(rig.params.Dizzy!).toBe(1);
      expect(rig.params.Wince!).toBe(0);
      anim.down = 0;
      anim.knock = 0;
      for (let i = 0; i < 300; i++) anim.step(1 / 60);
      for (const id of [...LIMBS, "Wince", "Dizzy"]) expect(Math.abs(rig.params[id]!)).toBeLessThan(0.02);
    },
  );

  test.each(armed)("%s: the wince gives way to the swirls in a few frames, not faintly over each other", (_id, sprite) => {
    const { rig, anim } = make(sprite);
    let both = 0;
    playFilm(anim, 2, (row) => {
      if (row.name !== "hit" && row.name !== "down" && row.name !== "up again") return;
      const f = rig.evaluate();
      const shown = (id: string) => f.find((p) => p.id === id)!.opacity > 0.1;
      if (shown("winceL") && shown("dizzyL")) both++;
    });
    expect(both).toBeLessThanOrEqual(6);
  });

  test("a hit-stop (frames with no time passing) holds the springs instead of piling onto them", () => {
    const rig = new Rig(ART_L2D.reimu!.sprite!.model);
    const anim = new Animator(rig, () => 0.99);
    anim.move = { x: 1, y: 0 };
    for (let i = 0; i < 60; i++) anim.step(1 / 60);
    anim.recoil = 1;
    anim.knock = -1;
    anim.step(0);
    const held = { ...rig.params };
    for (let i = 0; i < 20; i++) anim.step(0);
    for (const id of [...LIMBS, ...LOOSE]) expect(rig.params[id]!).toBeCloseTo(held[id]!, 9);
  });

  test("backpedalling with the facing held, the hair trails the way she moves, not the way she faces", () => {
    const rig = new Rig(ART_L2D.reimu!.sprite!.model);
    const anim = new Animator(rig, () => 0.99);
    anim.idle = false;
    anim.face = { x: 1, y: 0 };
    anim.move = { x: -1, y: 0 };
    anim.slow = true;
    let sleeve = 0;
    for (let i = 0; i < 240; i++) {
      anim.step(1 / 60);
      if (i >= 120) sleeve += rig.params.Sleeve! / 120;
    }
    expect(sleeve).toBeGreaterThan(0);
  });
});
