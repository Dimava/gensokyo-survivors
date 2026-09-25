// The compiled rig evaluator (rig.ts: deformInto, with its cached cells and
// skipped re-blends) against the plain one (reference.ts), on every model the
// game has: the same positions and opacities to the bit, over random poses,
// poses where only some parameters move (the re-blend skip), and the same pose
// evaluated twice.
import { describe, expect, test } from "bun:test";
import { ART_L2D } from "../src/art-l2d/index.ts";
import { Rig, type Model } from "../src/art-l2d/rig.ts";
import { referenceEvaluate } from "../src/art-l2d/reference.ts";
import { clawdModel, SUITS } from "../src/art-l2d/clawd.ts";
import { dimavaModel } from "../src/art-l2d/dimava.ts";

const models: [string, Model][] = [
  ...Object.entries(ART_L2D).flatMap(([id, set]) => [
    ...(set.portrait ? [[`${id} portrait`, set.portrait] as [string, Model]] : []),
    ...(set.sprite ? [[`${id} sprite`, set.sprite.model] as [string, Model]] : []),
  ]),
  ...SUITS.map((s) => [`clawd ${s.id}`, clawdModel(s.id)] as [string, Model]),
  ["dimava", dimavaModel],
];

/** A small deterministic generator (the test must not flake). */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Every value the same, bit for bit (a NaN would fail too). */
function same(rig: Rig, out: Float32Array[], opacity: Float64Array): number {
  const ref = referenceEvaluate(rig.model, rig.params, rig.meshes);
  let bad = 0;
  ref.forEach((f, i) => {
    if (!Object.is(f.opacity, opacity[i])) bad++;
    for (let k = 0; k < f.positions.length; k++) if (!Object.is(f.positions[k], out[i]![k])) bad++;
  });
  return bad;
}

describe.each(models)("%s", (_id, model) => {
  test("the compiled evaluator matches the plain one to the bit", () => {
    const rig = new Rig(model);
    const out = model.parts.map((p) => new Float32Array(rig.meshes[p.id]!.rest.length));
    const opacity = new Float64Array(model.parts.length);
    const rnd = lcg(model.id.length * 7919 + model.parts.length);
    let bad = 0;
    // The rest pose, then random poses (a tenth past the ends: set clamps them), every other one moving only a few parameters.
    rig.deformInto(out, opacity);
    bad += same(rig, out, opacity);
    for (let it = 0; it < 60; it++) {
      for (const p of model.params) {
        if (it % 2 && rnd() > 0.2) continue;
        rig.set(p.id, p.min + (p.max - p.min) * (rnd() * 1.2 - 0.1));
      }
      rig.deformInto(out, opacity);
      bad += same(rig, out, opacity);
      // Unchanged parameters: every blend is skipped, the result is the same.
      rig.deformInto(out, opacity);
      bad += same(rig, out, opacity);
    }
    expect(bad).toBe(0);
  });

  test("evaluate() gives the same frames as deformInto", () => {
    const rig = new Rig(model);
    for (const p of model.params) rig.set(p.id, (p.min + p.max) / 2 + (p.max - p.min) * 0.3);
    const frames = rig.evaluate();
    const ref = referenceEvaluate(model, rig.params, rig.meshes);
    expect(frames.map((f) => f.id)).toEqual(ref.map((f) => f.id));
    frames.forEach((f, i) => {
      expect(f.opacity).toBe(ref[i]!.opacity);
      expect([...f.positions]).toEqual([...ref[i]!.positions]);
    });
  });
});
