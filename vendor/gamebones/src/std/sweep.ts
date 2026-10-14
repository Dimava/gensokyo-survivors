// Sweeps and their reports, for scripts (Node/Bun only: this entry reads and writes files and
// spawns processes, so it is `gamebones/std/sweep`, apart from the browser-safe `gamebones/std`).
//
// sweep() plays every strategy on every seed, one JSON file per run, in parallel shard processes;
// report() reads the run files of one or more sweeps into a JSON summary and an HTML page.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { availableParallelism, freemem } from "node:os";
import { join } from "node:path";

export { readRuns, report, reportMain } from "./report.ts";
export type { Metrics, ReportOptions, ReportSummary } from "./report.ts";

type Env = Record<string, string | undefined>;

export interface SweepOptions<S extends { name: string }, O> {
  strategies: readonly S[];
  /** Seeds when SEEDS is not set: `count` from the command line (default 6). Default `c1..cN`. */
  seeds?(count: number): string[];
  /** The run options from the environment (LATENCY, TREE, HARD ...): written into every run file, shown by report(). JSON. */
  options(env: Env): O;
  /** Runs once in each process that plays runs, before the first: content overrides (HARD). */
  before?(opts: O): void;
  /** Plays one run; its result (JSON) is written with the header `{ strategy, seed, opts, ms }`. */
  run(seed: string, strategy: S, opts: O): object | Promise<object>;
  /** A short line for the progress log (default: the tick count if the result has `ticks`). */
  line?(result: object): string;
  /** Default: process.argv[2] ?? "runs". */
  out?: string;
  /** Default: process.env. */
  env?: Env;
}

/** A strategy name as a directory name. */
export const safeName = (name: string): string => name.replace(/[^\w+-]+/g, "_");

/**
 * Plays the sweep. The command line is `<out> [seeds]`; the environment:
 * - ONLY=a,b: these strategies; SEEDS=s1,s2: these seeds.
 * - JOBS=n: shard processes (default cores − 2, fewer when memory is short or runs are few).
 * - SHARD=i/n: only this share of the runs (for several machines); JOBS splits it further.
 * - FORCE=1: redo runs whose file exists (by default an interrupted sweep resumes).
 * Runs are dealt round-robin over strategy × seed after ONLY and SEEDS, so shards stay even.
 */
export async function sweep<S extends { name: string }, O>(o: SweepOptions<S, O>): Promise<void> {
  const env = o.env ?? process.env;
  const out = o.out ?? process.argv[2] ?? "runs";
  const count = Number(process.argv[3] ?? 6);
  const only = env.ONLY?.split(",");
  const seeds = env.SEEDS?.split(",") ?? (o.seeds ? o.seeds(count) : Array.from({ length: count }, (_, i) => `c${i + 1}`));
  const strategies = o.strategies.filter((s) => !only || only.includes(s.name));
  if (only) for (const n of only) if (!o.strategies.some((s) => s.name === n)) throw new Error(`sweep: ONLY names "${n}"; strategies: ${o.strategies.map((s) => s.name).join(", ")}`);
  const [shard, shards] = (env.SHARD ?? "0/1").split("/").map(Number) as [number, number];
  const force = env.FORCE === "1";

  const all = strategies.flatMap((s) => seeds.map((seed) => ({ s, seed, file: join(out, safeName(s.name), `${seed}.json`) })));
  const mine = all.filter((_, i) => i % shards === shard);
  const todo = mine.filter((r) => force || !existsSync(r.file));
  const opts = o.options(env);

  if (env.SWEEP_WORKER !== "1") {
    const cores = Math.max(1, availableParallelism() - 2);
    const byMemory = Math.max(1, Math.floor(freemem() / 400e6));
    const jobs = Math.max(1, Math.min(env.JOBS ? Number(env.JOBS) : Math.min(cores, byMemory), todo.length));
    console.log(`sweep ${out}: ${strategies.length} strategies × ${seeds.length} seeds = ${all.length} runs; this shard ${mine.length}, ${mine.length - todo.length} done already, ${todo.length} to play on ${jobs} job${jobs === 1 ? "" : "s"}`);
    console.log(`  options ${JSON.stringify(opts)}`);
    if (!todo.length) return;
    if (jobs > 1) return spawnJobs(jobs, shard, shards, todo.length);
  }

  o.before?.(opts);
  for (const r of todo) {
    const t0 = performance.now();
    const result = await o.run(r.seed, r.s, opts);
    const ms = Math.round(performance.now() - t0);
    mkdirSync(join(out, safeName(r.s.name)), { recursive: true });
    const tmp = `${r.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ strategy: r.s.name, seed: r.seed, opts, ms, ...result }));
    renameSync(tmp, r.file);
    const extra = o.line ? o.line(result) : "ticks" in result ? `${(result as { ticks: unknown }).ticks} ticks` : "";
    console.log(`run ${r.s.name} ${r.seed}: ${extra ? `${extra}, ` : ""}${(ms / 1000).toFixed(1)} s`);
  }
}

/** Re-runs this script as `jobs` workers, each a sub-shard of this shard, merging their output. */
function spawnJobs(jobs: number, shard: number, shards: number, total: number): Promise<void> {
  const t0 = performance.now();
  let done = 0;
  let failed = 0;
  const pad = String(total).length;
  const one = (j: number): Promise<void> =>
    new Promise((resolve) => {
      // Run i belongs to this shard when i % shards == shard; job j takes those with i % (shards·jobs) == shard + shards·j.
      const child = spawn(process.execPath, process.argv.slice(1), {
        env: { ...process.env, SWEEP_WORKER: "1", SHARD: `${shard + shards * j}/${shards * jobs}` },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const lines = (stream: NodeJS.ReadableStream, err: boolean): void => {
        let buf = "";
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => {
          buf += chunk;
          let n: number;
          while ((n = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, n).trimEnd();
            buf = buf.slice(n + 1);
            if (!line) continue;
            if (!err && line.startsWith("run ")) console.log(`[${String(++done).padStart(pad)}/${total}] j${j} ${line.slice(4)}`);
            else (err ? console.error : console.log)(`  j${j}| ${line}`);
          }
        });
      };
      lines(child.stdout!, false);
      lines(child.stderr!, true);
      child.on("close", (code) => {
        if (code !== 0) {
          failed++;
          console.error(`  j${j} exited with ${code}`);
        }
        resolve();
      });
    });
  return Promise.all(Array.from({ length: jobs }, (_, j) => one(j))).then(() => {
    console.log(`sweep: ${done}/${total} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s${failed ? `, ${failed} job(s) failed` : ""}`);
    if (failed) process.exitCode = 1;
  });
}
