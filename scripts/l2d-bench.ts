// Frame timings of live rigs (src/art-l2d/bench.ts) in headless Chrome on the
// machine's own GPU, through the running dev server: every combination of
// the given models, counts and modes, each run `--repeat` times (the fastest
// run is kept), as a table and optionally JSON.
//   bun scripts/l2d-bench.ts [--url http://localhost:5191] [--model reimu.sprite,reimu] [--n 1,8,32]
//     [--modes reference,current] [--group] [--rebuild] [--portraits] [--idle] [--frames 240] [--repeat 3]
//     [--resolution 2] [--cpu] [--json out.json]
//   bun scripts/l2d-bench.ts --diff <dir> [--model reimu.sprite,reimu]   (RigView against the atlas prototype, pixel by pixel)
// Modes: reference, current (RigView), atlas (pixi-atlas.ts: one draw per rig).
// --cpu: software GL (SwiftShader) instead of the GPU. --group, --rebuild, --portraits: bench.ts BenchOptions.
// PW_WS=<ws endpoint>: use a browser already running (playwright launchServer; its own flags apply) instead of launching one.
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AtlasDiff, BenchOptions, BenchResult } from "../src/art-l2d/bench.ts";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? def) : def;
};
const flag = (name: string) => args.includes(`--${name}`);
const url = opt("url", "http://localhost:5191");
const models = opt("model", "reimu.sprite").split(",");
const counts = opt("n", "1,8,32").split(",").map(Number);
const modes = opt("modes", "reference,current").split(",") as BenchOptions["mode"][];
const frames = Number(opt("frames", "240"));
const repeat = Number(opt("repeat", "3"));
const resolution = Number(opt("resolution", "2"));
const json = opt("json", "");
const diffDir = opt("diff", "");

const pwPath = process.env.PW ?? join(tmpdir(), "rec/node_modules/playwright-core/index.mjs");
// playwright-core is not a dependency of the game; it is loaded from outside, untyped.
// oxlint-disable-next-line typescript/no-explicit-any
const { chromium } = (await import(pwPath)) as { chromium: any };
// The GPU: ANGLE on Direct3D 11 (headless Chrome falls back to SwiftShader without these).
const gpuArgs = flag("cpu") ? [] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const ws = process.env.PW_WS;
const browser = ws ? await chromium.connect(ws) : await chromium.launch({ args: gpuArgs });
try {
  const p = await browser.newPage();
  p.on("pageerror", (e: Error) => console.error("pageerror:", e.message));
  await p.goto(`${url}/?screen=menu`);
  await p.waitForTimeout(1500);
  if (diffDir) {
    mkdirSync(diffDir, { recursive: true });
    const looks = [
      { look: { x: 0, y: 0 }, label: "ahead" },
      { look: { x: 1, y: -1 }, label: "look up right" },
      { look: { x: -1, y: 1 }, label: "look down left" },
      { look: { x: 0, y: 0 }, params: { EyeLOpen: 0.5, EyeROpen: 0.5 }, label: "half blink" },
      { look: { x: 0, y: 0 }, params: { EyeLOpen: 0, EyeROpen: 0 }, label: "blink" },
    ];
    for (const model of models) {
      const scale = model.includes("sprite") || !["reimu", "cirno", "rumia"].includes(model) ? 2 : 1;
      const rows: AtlasDiff[] = await p.evaluate(
        async ([id, ls, sc]: [string, typeof looks, number]) => {
          const b = (await import(/* @vite-ignore */ `${"/src/art-l2d/bench.ts"}`)) as typeof import("../src/art-l2d/bench.ts");
          return b.atlasDiff(id, ls, sc);
        },
        [model, looks, scale],
      );
      for (const [i, r] of rows.entries()) {
        for (const k of ["current", "atlas", "diff"] as const) writeFileSync(`${diffDir}/${model}-${i}-${k}.png`, Buffer.from(r[k].split(",")[1]!, "base64"));
        console.log(`${model.padEnd(14)} ${r.label.padEnd(16)} mean |diff| ${r.mean.toFixed(3)} / 255, pixels off by > 16: ${(r.over16 * 100).toFixed(2)}%`);
      }
    }
  }
  const runs: BenchOptions[] = [];
  if (diffDir) counts.length = 0;
  for (const model of models)
    for (const n of counts)
      for (const mode of modes)
        runs.push({ model, n, mode, frames, resolution, group: flag("group"), rebuild: flag("rebuild"), portraits: flag("portraits"), walk: !flag("idle") });
  const best = new Map<number, BenchResult>();
  // Rounds alternate the configurations, so drift (heat, background work) hits them alike.
  for (let round = 0; round < repeat; round++)
    for (const [i, run] of runs.entries()) {
      const r: BenchResult = await p.evaluate(async (o: BenchOptions) => {
        const b = (await import(/* @vite-ignore */ `${"/src/art-l2d/bench.ts"}`)) as typeof import("../src/art-l2d/bench.ts");
        return b.runBench(o);
      }, run);
      const prev = best.get(i);
      if (!prev || r.total < prev.total) best.set(i, r);
    }
  const rows = runs.map((_, i) => best.get(i)!);
  if (rows.length) {
    console.log(`GPU: ${rows[0]?.gpuName}; ${frames} frames, best of ${repeat}; ms per frame (whole scene), and per rig`);
    const f = (v: number, d = 3) => v.toFixed(d).padStart(8);
    console.log(`${"".padEnd(44)}    step  update  render     gpu   total | per rig  draws uploads   KB/f stencil`);
    for (const r of rows)
      console.log(
        `${r.label.padEnd(44)}${f(r.step)}${f(r.update)}${f(r.render)}${f(r.gpu)}${f(r.total)} | ${f((r.total - r.gpu) / r.n, 4)}${f(r.draws, 1)}${f(r.uploads, 1)}${f(r.bytes / 1024, 1)}${f(r.stencil, 1)}`,
      );
  }
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
} finally {
  await browser.close();
}
