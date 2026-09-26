// Frame timings of live rigs (src/art-l2d/bench.ts) in headless Chrome on the
// machine's own GPU, through the running dev server: every combination of
// the given models, counts and modes, each run `--repeat` times (the fastest
// run is kept), as a table and optionally JSON.
//   bun scripts/l2d-bench.ts [--url http://localhost:5191] [--model reimu.sprite,reimu] [--n 1,8,32]
//     [--modes reference,current] [--group] [--rebuild] [--portraits] [--idle] [--frames 240] [--repeat 3]
//     [--resolution 2] [--cpu] [--json out.json]
// --cpu: software GL (SwiftShader) instead of the GPU. --group, --rebuild, --portraits: bench.ts BenchOptions.
// PW_WS=<ws endpoint>: use a browser already running (playwright launchServer; its own flags apply) instead of launching one.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BenchOptions, BenchResult } from "../src/art-l2d/bench.ts";

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
  const runs: BenchOptions[] = [];
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
  console.log(`GPU: ${rows[0]?.gpuName}; ${frames} frames, best of ${repeat}; ms per frame (whole scene), and per rig`);
  const f = (v: number, d = 3) => v.toFixed(d).padStart(8);
  console.log(`${"".padEnd(44)}    step  update  render     gpu   total | per rig  draws uploads   KB/f stencil`);
  for (const r of rows)
    console.log(
      `${r.label.padEnd(44)}${f(r.step)}${f(r.update)}${f(r.render)}${f(r.gpu)}${f(r.total)} | ${f((r.total - r.gpu) / r.n, 4)}${f(r.draws, 1)}${f(r.uploads, 1)}${f(r.bytes / 1024, 1)}${f(r.stencil, 1)}`,
    );
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
} finally {
  await browser.close();
}
