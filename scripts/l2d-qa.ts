// Animation QA of the chibi rigs, headless: plays the lab's film (standing,
// walking, stopping, turning, focus, the hit, down, up again) at 60 fps on
// every sprite rig with arms and prints, per state, what an animator would
// object to in the arms, sleeves and hair:
//   range   the values a parameter takes;
//   PIN     how long it sits at its limit (|v| >= 0.98): a limb stuck there;
//   POP     its biggest change of speed in one frame (|v[i+1] - 2 v[i] + v[i-1]|):
//           a fast swing is smooth, a pop is not (above about 0.1 it reads as a jerk);
//   sw      how many times it turns back (swings; a stop should leave few);
//   lag     frames the forearm trails its arm (overlap; 0 is one stiff piece);
//   L~R     how alike the two arms move (1: mirror twins, the stiff look).
// Frames of a hit-stop (no time passing) are left out: the pose holds there on purpose.
//   bun scripts/l2d-qa.ts [reimu,cirno,...] [--span 2]
import { ART_L2D } from "../src/art-l2d/index.ts";
import { Animator } from "../src/art-l2d/animator.ts";
import { Rig } from "../src/art-l2d/rig.ts";
import { playFilm } from "../src/art-l2d/film.ts";

const args = process.argv.slice(2);
const spanAt = args.indexOf("--span");
const span = spanAt >= 0 ? Number(args.splice(spanAt, 2)[1]) : 2;
const ids = args[0]?.split(",") ?? Object.keys(ART_L2D).filter((id) => ART_L2D[id]!.sprite?.model.parts.some((p) => p.id === "armL"));
const P = ["ArmL", "ArmR", "ArmLBend", "ArmRBend", "ArmLFall", "ArmRFall", "Sleeve", "HairSide", "HairBack", "Ribbon", "Hem", "HemLift"];

function corr(a: number[], b: number[]): number {
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
}

/** Frames by which b trails a (the cross-correlation's peak, 0..max). */
function lagOf(a: number[], b: number[], max = 40): number {
  let best = 0;
  let bestC = -2;
  for (let L = 0; L <= max; L++) {
    const c = corr(a.slice(0, a.length - L), b.slice(L));
    if (c > bestC) {
      bestC = c;
      best = L;
    }
  }
  return best;
}

/** Turning points of v, each at least `min` past the last extreme. */
function swings(v: number[], min = 0.04): number {
  let n = 0;
  let dir = 0;
  let ext = v[0] ?? 0;
  for (const x of v) {
    if (dir === 0) {
      if (Math.abs(x - ext) > min) {
        dir = x > ext ? 1 : -1;
        ext = x;
      }
    } else if ((x - ext) * dir > 0) ext = x;
    else if (Math.abs(x - ext) > min) {
      n++;
      dir = -dir;
      ext = x;
    }
  }
  return n;
}

for (const id of ids) {
  const sr = ART_L2D[id]?.sprite;
  if (!sr) continue;
  const rig = new Rig(sr.model);
  const anim = new Animator(rig, () => 0.99);
  anim.rate = sr.rate;
  anim.snap();
  const rows = new Map<string, Record<string, number[]>>();
  playFilm(anim, span, (row, _i, u) => {
    if (row.dt?.(u) === 0) return;
    let v = rows.get(row.name);
    if (!v) rows.set(row.name, (v = Object.fromEntries(P.map((p) => [p, []]))));
    for (const p of P) v[p]!.push(rig.params[p] ?? 0);
  });
  console.log(`\n== ${id}`);
  for (const [name, v] of rows) {
    const cells = P.map((p) => {
      const xs = v[p]!;
      const pin = xs.filter((x) => Math.abs(x) >= 0.98).length / xs.length;
      let pop = 0;
      for (let i = 1; i + 1 < xs.length; i++) pop = Math.max(pop, Math.abs(xs[i + 1]! - 2 * xs[i]! + xs[i - 1]!));
      const r = `${p.replace("Arm", "")} [${Math.min(...xs).toFixed(2)},${Math.max(...xs).toFixed(2)}]`;
      return `${r}${pin > 0 ? ` PIN ${(pin * 100).toFixed(0)}%` : ""}${pop > 0.1 ? ` POP ${pop.toFixed(2)}` : ""} sw${swings(xs)}`;
    });
    console.log(`${name.padEnd(18)} lag ${String(lagOf(v.ArmL!, v.ArmLBend!)).padStart(2)}f  L~R ${corr(v.ArmL!, v.ArmR!).toFixed(2).padStart(5)} | ${cells.join(" | ")}`);
  }
}
