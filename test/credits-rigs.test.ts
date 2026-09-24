// The credits' two rigs. Clawd (src/art-l2d/clawd.ts): the body is the Claude
// Code banner in pixels, every suit is wired to deformers that exist, and the
// idle motion moves the right parts. Dimava's avatar (src/art-l2d/dimava.ts):
// wired, the googly pupils focus on demand and rattle after a jolt.
import { describe, expect, test } from "bun:test";
import { CLAWD_PIXELS, clawdModel, SUITS } from "../src/art-l2d/clawd.ts";
import { Rig, type Model } from "../src/art-l2d/rig.ts";
import { dimavaModel } from "../src/art-l2d/dimava.ts";

/** Top and bottom y of a part's deformed vertices. */
function span(rig: Rig, part: string): [number, number] {
  const f = rig.evaluate().find((p) => p.id === part)!;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 1; i < f.positions.length; i += 2) {
    lo = Math.min(lo, f.positions[i]!);
    hi = Math.max(hi, f.positions[i]!);
  }
  return [lo, hi];
}

test("the body is the banner: 36x20 pixels, two eyes, two arms, four legs", () => {
  expect(CLAWD_PIXELS.length).toBe(20);
  for (const r of CLAWD_PIXELS) expect(r.length).toBe(36);
  expect(CLAWD_PIXELS[4]!.match(/e+/g)).toEqual(["ee", "ee"]);
  expect(CLAWD_PIXELS[8]!.match(/a+/g)).toEqual(["aaaa", "aaaa"]);
  expect(CLAWD_PIXELS[18]!.match(/l+/g)).toEqual(["ll", "ll", "ll", "ll"]);
});

/** Every part hangs from a deformer that exists; masks name real parts; ids are unique. */
function wired(m: Model): void {
  const deformers = new Set(m.deformers.map((d) => d.id));
  const parts = new Set(m.parts.map((p) => p.id));
  expect(parts.size).toBe(m.parts.length);
  for (const d of m.deformers) if (d.parent) expect(deformers.has(d.parent)).toBe(true);
  for (const p of m.parts) {
    if (p.parent) expect(deformers.has(p.parent)).toBe(true);
    if (p.mask) expect(parts.has(p.mask)).toBe(true);
  }
}

describe.each(SUITS.map((s) => [s.id]))("Clawd as %s", (suit) => {
  test("parts hang from deformers that exist; ids are unique", () => wired(clawdModel(suit as (typeof SUITS)[number]["id"])));
});

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

describe("Dimava's avatar", () => {
  test("parts, masks and deformers are all wired", () => wired(dimavaModel));

  test("unfocused, the pupils look different ways; focused, both look where the rig looks", () => {
    const rig = new Rig(dimavaModel);
    const eye = (s: string) => centre(rig, `eye${s}`);
    const off = (s: string): [number, number] => {
      const [px, py] = centre(rig, `pupil${s}`);
      const [ex, ey] = eye(s);
      return [px - ex, py - ey];
    };
    expect(off("L")[1]).toBeLessThan(-3);
    expect(off("R")[1]).toBeGreaterThan(2);
    rig.set("Focus", 1);
    rig.set("EyeBallX", 1);
    for (const s of ["L", "R"]) {
      expect(off(s)[0]).toBeGreaterThan(3);
      expect(Math.abs(off(s)[1]!)).toBeLessThan(1);
    }
  });

  test("a jolt rattles the pupils and flops the ribbon loops, then they settle", () => {
    const rig = new Rig(dimavaModel);
    rig.step(0.016);
    rig.set("AngleX", 30);
    let most = 0;
    for (let i = 0; i < 30; i++) {
      rig.step(1 / 60);
      most = Math.max(most, Math.abs(rig.params.PupilLX!), Math.abs(rig.params.LoopL!));
    }
    expect(most).toBeGreaterThan(0.3);
    for (let i = 0; i < 600; i++) rig.step(1 / 60);
    expect(Math.abs(rig.params.PupilLX!)).toBeLessThan(0.05);
    expect(Math.abs(rig.params.LoopL!)).toBeLessThan(0.05);
  });
});

test("blinking squeezes the eyes; the wave lifts the right claw; the tippy-taps lift a leg", () => {
  const rig = new Rig(clawdModel());
  const [top, bottom] = span(rig, "eyeL");
  rig.set("EyeLOpen", 0);
  const [t2, b2] = span(rig, "eyeL");
  expect(b2 - t2).toBeLessThan((bottom - top) * 0.4);
  const armUp = (f: number) => {
    rig.set("Flap", f);
    return span(rig, "armR")[0];
  };
  expect(armUp(1)).toBeLessThan(armUp(-1));
  rig.set("Flap", 1);
  const lifted = span(rig, "leg0")[1];
  rig.set("Flap", 0);
  expect(lifted).toBeLessThan(span(rig, "leg0")[1]);
});
