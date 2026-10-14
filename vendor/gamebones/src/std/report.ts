// The report of one or more sweeps: per metric, each strategy's mean over its seeds for each sweep
// directory, how far it is from the best strategy, and per-seed values; as JSON and one HTML page.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/** What analyse() makes of a run: numbers, maps of numbers (shown as `name.key`), series (drawn as lines). */
export type Metrics = Record<string, number | Record<string, number> | readonly number[]>;

export interface ReportOptions<R> {
  /** Sweep directories, each a column group labelled by its name. */
  dirs: readonly string[];
  /** A run file (its header `{ strategy, seed, opts, ms }` and the run's result) to metrics. */
  analyse(run: R): Metrics;
  title?: string;
  /** The HTML page (the JSON summary goes beside it). Default `<first dir>/report.html`. */
  out?: string;
  /** Which way is better, per metric (a map's keys inherit its name's). Default "high". */
  better?: Record<string, "high" | "low">;
  /** A strategy further than this from the best (× best) is marked. Default 1.5. */
  spread?: number;
}

export interface Cell {
  /** Mean over the seeds with a finite value; NaN when none has. */
  mean: number;
  n: number;
  seeds: Record<string, number>;
  /** The best strategy's mean over this one's (or the reverse for "low"): 1 is the best, bigger is worse. */
  xBest: number;
}

export interface ReportSummary {
  title: string;
  dirs: { label: string; runs: number; options: Record<string, unknown[]> }[];
  strategies: string[];
  /** metric → strategy → dir label → cell. */
  table: Record<string, Record<string, Record<string, Cell>>>;
  /** metric → dir label → strategy → the mean series. */
  series: Record<string, Record<string, Record<string, number[]>>>;
}

type Run = Record<string, unknown> & { strategy: string; seed: string; opts?: Record<string, unknown> };

export function report<R>(o: ReportOptions<R>): ReportSummary {
  const title = o.title ?? "Sweep report";
  const spread = o.spread ?? 1.5;
  const strategies: string[] = [];
  const table: ReportSummary["table"] = {};
  const seriesAcc: Record<string, Record<string, Record<string, number[][]>>> = {};
  const dirs: ReportSummary["dirs"] = [];
  const better = (metric: string): "high" | "low" => o.better?.[metric] ?? o.better?.[metric.split(".")[0]!] ?? "high";

  for (const dir of o.dirs) {
    const label = basename(resolve(dir));
    const runs = readRuns(dir) as Run[];
    const options: Record<string, unknown[]> = {};
    for (const r of runs) {
      for (const [k, v] of Object.entries(r.opts ?? {})) {
        const seen = (options[k] ??= []);
        if (!seen.some((x) => JSON.stringify(x) === JSON.stringify(v))) seen.push(v);
      }
    }
    dirs.push({ label, runs: runs.length, options });
    for (const r of runs) {
      if (!strategies.includes(r.strategy)) strategies.push(r.strategy);
      const put = (metric: string, v: number): void => {
        const cell = (((table[metric] ??= {})[r.strategy] ??= {})[label] ??= { mean: NaN, n: 0, seeds: {}, xBest: NaN });
        cell.seeds[r.seed] = v;
      };
      for (const [name, v] of Object.entries(o.analyse(r as R))) {
        if (typeof v === "number") put(name, v);
        else if (Array.isArray(v)) (((seriesAcc[name] ??= {})[label] ??= {})[r.strategy] ??= []).push(v as number[]);
        else for (const [k, x] of Object.entries(v as Record<string, number>)) put(`${name}.${k}`, x);
      }
    }
  }

  for (const [metric, rows] of Object.entries(table)) {
    for (const { label } of dirs) {
      const cells = Object.values(rows).flatMap((byDir) => (byDir[label] ? [byDir[label]] : []));
      for (const c of cells) {
        const vals = Object.values(c.seeds).filter(Number.isFinite);
        c.n = vals.length;
        c.mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
      }
      const means = cells.map((c) => c.mean).filter(Number.isFinite);
      if (!means.length) continue;
      const high = better(metric) === "high";
      const best = high ? Math.max(...means) : Math.min(...means);
      for (const c of cells) c.xBest = ratio(c.mean, best, high);
    }
  }

  const series: ReportSummary["series"] = {};
  for (const [metric, byDir] of Object.entries(seriesAcc)) {
    for (const [label, byStrat] of Object.entries(byDir)) {
      for (const [s, list] of Object.entries(byStrat)) {
        const len = Math.max(...list.map((l) => l.length));
        const mean = Array.from({ length: len }, (_, i) => {
          const vals = list.map((l) => l[i]).filter((x): x is number => Number.isFinite(x));
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
        });
        ((series[metric] ??= {})[label] ??= {})[s] = mean;
      }
    }
  }

  const summary: ReportSummary = { title, dirs, strategies, table, series };
  const out = o.out ?? join(o.dirs[0]!, "report.html");
  writeFileSync(out.replace(/\.html?$/, "") + ".json", JSON.stringify(summary, null, 1));
  writeFileSync(out, html(summary, spread));
  return summary;
}

/**
 * How many times worse than the best: 1 for the best, Infinity past a best of 0 (lower is
 * better) or a mean of 0 or less (higher is better), NaN where a ratio means nothing (a
 * negative best, no value).
 */
function ratio(mean: number, best: number, high: boolean): number {
  if (!Number.isFinite(mean)) return NaN;
  if (mean === best) return 1;
  if (high) return best > 0 ? (mean > 0 ? best / mean : Infinity) : NaN;
  return best >= 0 && mean >= 0 ? (best === 0 ? Infinity : mean / best) : NaN;
}

/** report() from the command line: `<dir>... [--out file.html] [--title text]`. */
export function reportMain<R>(o: Omit<ReportOptions<R>, "dirs" | "out" | "title">, argv = process.argv.slice(2)): ReportSummary {
  const args = [...argv];
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args.splice(i, 2)[1];
  };
  const out = flag("--out");
  const title = flag("--title");
  if (!args.length) throw new Error("report: usage: <sweep dir>... [--out report.html] [--title text]");
  const s = report({ ...o, dirs: args, out, title });
  console.log(`report: ${s.dirs.map((d) => `${d.label} (${d.runs} runs)`).join(", ")} → ${out ?? join(args[0]!, "report.html")}`);
  return s;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
const fmt = (v: number): string => (!Number.isFinite(v) ? (Number.isNaN(v) ? "–" : "∞") : Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
const COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#9a6324", "#808000", "#000075", "#469990", "#a9a9a9"];

function html(s: ReportSummary, spread: number): string {
  const head = s.dirs
    .map((d) => {
      const opts = Object.entries(d.options)
        .map(([k, vs]) => `<code>${esc(k)}=${esc(vs.map((v) => JSON.stringify(v)).join(" | "))}</code>`)
        .join(" ");
      return `<li><b>${esc(d.label)}</b>: ${d.runs} runs ${opts}</li>`;
    })
    .join("");
  const tables = Object.entries(s.table)
    .map(([metric, rows]) => {
      const max = Math.max(...Object.values(rows).flatMap((byDir) => Object.values(byDir).map((c) => Math.abs(c.mean)).filter(Number.isFinite)), 0);
      const body = s.strategies
        .filter((st) => rows[st])
        .map((st) => {
          const cells = s.dirs
            .map(({ label }) => {
              const c = rows[st]![label];
              if (!c) return `<td></td><td></td>`;
              const seeds = Object.entries(c.seeds)
                .map(([seed, v]) => `${seed}: ${fmt(v)}`)
                .join("\n");
              const w = max && Number.isFinite(c.mean) ? (100 * Math.abs(c.mean)) / max : 0;
              const bad = c.xBest > spread;
              return `<td title="${esc(seeds)}"><span class="bar" style="width:${w.toFixed(1)}%"></span>${fmt(c.mean)}${c.n < Object.keys(c.seeds).length ? ` <small>(${c.n}/${Object.keys(c.seeds).length})</small>` : ""}</td><td class="x${bad ? " bad" : ""}">${Number.isNaN(c.xBest) ? "–" : `×${Number.isFinite(c.xBest) ? c.xBest.toFixed(2) : "∞"}`}</td>`;
            })
            .join("");
          return `<tr><th>${esc(st)}</th>${cells}</tr>`;
        })
        .join("");
      const cols = s.dirs.map((d) => `<th colspan="2">${esc(d.label)}</th>`).join("");
      return `<section><h2>${esc(metric)}</h2><table><tr><th></th>${cols}</tr>${body}</table></section>`;
    })
    .join("");
  const charts = Object.entries(s.series)
    .map(([metric, byDir]) =>
      Object.entries(byDir)
        .map(([label, byStrat]) => `<figure><figcaption>${esc(metric)}: ${esc(label)}</figcaption>${lineChart(byStrat, s.strategies)}</figure>`)
        .join(""),
    )
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>${esc(s.title)}</title>
<style>
body{font:14px system-ui,sans-serif;margin:24px;background:#fafafa;color:#222}
table{border-collapse:collapse;margin:4px 0 20px}td,th{padding:3px 8px;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap}
th:first-child{text-align:left}td{position:relative}td[title]{cursor:help}
.bar{position:absolute;left:0;top:3px;bottom:3px;background:#4363d822;z-index:0}
.x{color:#888}.bad{color:#c00;font-weight:600}h2{font-size:15px;margin:16px 0 2px}
figure{display:inline-block;margin:8px 16px 8px 0}figcaption{font-weight:600}code{background:#eee;padding:1px 4px;margin-right:4px}
.legend span{margin-right:10px}
</style>
<h1>${esc(s.title)}</h1><ul>${head}</ul>
<p>Mean over seeds (hover for each seed). ×best: the best strategy over this one, marked past ×${spread}.</p>
<p class="legend">${s.strategies.map((st, i) => `<span style="color:${COLORS[i % COLORS.length]}">■ ${esc(st)}</span>`).join("")}</p>
${charts}${tables}`;
}

function lineChart(byStrat: Record<string, number[]>, order: string[]): string {
  const W = 420;
  const H = 160;
  const all = Object.values(byStrat).flat().filter(Number.isFinite);
  const len = Math.max(...Object.values(byStrat).map((l) => l.length), 2);
  const top = Math.max(...all, 0);
  const bottom = Math.min(...all, 0);
  const span = top - bottom || 1;
  const x = (i: number): number => 30 + (i / (len - 1)) * (W - 40);
  const y = (v: number): number => H - 20 - ((v - bottom) / span) * (H - 30);
  const lines = Object.entries(byStrat)
    .map(([st, l]) => {
      const d = l.map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : "")).filter(Boolean);
      return `<polyline fill="none" stroke="${COLORS[order.indexOf(st) % COLORS.length]}" stroke-width="1.5" points="${d.join(" ")}"><title>${esc(st)}</title></polyline>`;
    })
    .join("");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><line x1="30" y1="${y(0)}" x2="${W - 10}" y2="${y(0)}" stroke="#999"/><text x="2" y="14" font-size="11">${fmt(top)}</text><text x="2" y="${y(0) + 4}" font-size="11">0</text>${bottom < 0 ? `<text x="2" y="${H - 16}" font-size="11">${fmt(bottom)}</text>` : ""}<text x="${W - 30}" y="${H - 4}" font-size="11">${len - 1}</text>${lines}</svg>`;
}

/** Every run file of a sweep directory: `<dir>/<strategy>/<seed>.json`. */
export function readRuns(dir: string): Record<string, unknown>[] {
  const runs: Record<string, unknown>[] = [];
  for (const sub of readdirSync(dir)) {
    const p = join(dir, sub);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p).sort()) if (f.endsWith(".json")) runs.push({ ...JSON.parse(readFileSync(join(p, f), "utf8")), file: join(basename(dir), sub, f) });
  }
  return runs;
}
