// Post-processes the run logs of scripts/balance-log.ts into one HTML page:
// per strategy (mean over seeds) the boss's arrival, the level then, experience
// per second of the swarm, the boss fight's length, the outcome and the coins;
// the experience dropped by source; and experience per second over the run.
//   bun scripts/balance-report.ts <logdir>... [--out report.html] [--title text]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ENEMIES } from "../src/content/enemies.ts";
import type { Entry } from "./lib/runlog.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const out = flag("--out") ?? join(args[0]!, "report.html");
const title = flag("--title") ?? "Balance report";
const WINDOW = 10;

interface RunLog { strategy: string; seed: string; tree: string; ticks: number; log: Entry[] }
interface RunStats {
  seed: string;
  outcome: string;
  bossAt: number;
  levelAtBoss: number;
  swarmXpPerSec: number;
  bossFight: number;
  /** Experience dropped by enemy id; "(uncollected)" is minus what never reached the player. */
  xpBySource: Record<string, number>;
  killsBy: Record<string, number>;
  spawnedXp: Record<string, number>;
  /** Experience collected per second, in WINDOW-second windows of action time (raw, before growth). */
  xpRate: number[];
  coins: Record<string, number>;
  end: number;
}

function analyse(r: RunLog): RunStats {
  const s: RunStats = { seed: r.seed, outcome: "?", bossAt: NaN, levelAtBoss: NaN, swarmXpPerSec: NaN, bossFight: NaN, xpBySource: {}, killsBy: {}, spawnedXp: {}, xpRate: [], coins: {}, end: 0 };
  let level = 1;
  let swarmXp = 0;
  let collected = 0;
  let fightFrom = NaN;
  for (const e of r.log) {
    const p = e.p as Record<string, unknown> | undefined;
    const sec = e.at / 60;
    switch (e.ev) {
      case "spawn": {
        const { kind, xp } = p as { kind: number; xp: number };
        const id = ENEMIES[kind]!.id;
        s.spawnedXp[id] = (s.spawnedXp[id] ?? 0) + xp;
        break;
      }
      case "enemies:died": {
        const { kinds, xp } = p as { kinds: number[]; xp: number[] };
        kinds.forEach((k, i) => {
          const id = ENEMIES[k]!.id;
          s.killsBy[id] = (s.killsBy[id] ?? 0) + 1;
          s.xpBySource[id] = (s.xpBySource[id] ?? 0) + (xp[i] ?? 0);
        });
        break;
      }
      case "drops:collected": {
        const xp = (p as { xp: number }).xp;
        collected += xp;
        if (Number.isNaN(s.bossAt)) swarmXp += xp;
        const w = Math.floor(sec / WINDOW);
        while (s.xpRate.length <= w) s.xpRate.push(0);
        s.xpRate[w]! += xp / WINDOW;
        break;
      }
      // One level:up can cover several levels (and the tree's head start several more); each is one pick.
      case "levelup:picked":
        level++;
        break;
      case "boss:approach":
        s.bossAt = sec;
        s.levelAtBoss = level;
        s.swarmXpPerSec = swarmXp / sec;
        break;
      case "vn:closed":
        fightFrom = sec;
        break;
      case "boss:defeated":
        s.bossFight = sec - fightFrom;
        break;
      case "run:ended": {
        const sum = p as { outcome: string; seconds: number; coins: Record<string, number> };
        s.outcome = sum.outcome;
        s.end = sum.seconds;
        s.coins = sum.coins;
        break;
      }
    }
  }
  // Died before the boss: the swarm's rate over the whole run.
  if (Number.isNaN(s.swarmXpPerSec)) s.swarmXpPerSec = swarmXp / Math.max(1, s.end);
  const fromEnemies = Object.values(s.xpBySource).reduce((a, b) => a + b, 0);
  s.xpBySource["(uncollected)"] = collected - fromEnemies;
  return s;
}

const runs = new Map<string, RunStats[]>();
const walk = (p: string, root = p): void => {
  if (statSync(p).isDirectory()) return readdirSync(p).forEach((n) => walk(join(p, n), root));
  if (!p.endsWith(".json") || basename(p).startsWith("report")) return;
  const r = JSON.parse(readFileSync(p, "utf8")) as RunLog;
  const key = args.length > 1 ? `${r.strategy} [${basename(root)}]` : r.strategy;
  if (!runs.has(key)) runs.set(key, []);
  runs.get(key)!.push(analyse(r));
};
args.forEach((a) => walk(a));

const mean = (xs: number[]): number => {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};
const f = (x: number, d = 0): string => (Number.isFinite(x) ? x.toFixed(d) : "–");
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

interface Row { name: string; n: number; clears: number; bossAt: number; level: number; xps: number; fight: number; coins: number; coinParts: Record<string, number>; bySource: Record<string, number>; kills: Record<string, number>; rate: number[] }
const rows: Row[] = [...runs].map(([name, rs]) => {
  const sources = new Set(rs.flatMap((r) => Object.keys(r.xpBySource)));
  const killed = new Set(rs.flatMap((r) => Object.keys(r.killsBy)));
  const parts = new Set(rs.flatMap((r) => Object.keys(r.coins)));
  const w = Math.max(...rs.map((r) => r.xpRate.length));
  return {
    name,
    n: rs.length,
    clears: rs.filter((r) => r.outcome === "clear").length,
    bossAt: mean(rs.map((r) => r.bossAt)),
    level: mean(rs.map((r) => r.levelAtBoss)),
    xps: mean(rs.map((r) => r.swarmXpPerSec)),
    fight: mean(rs.map((r) => r.bossFight)),
    coins: mean(rs.map((r) => r.coins.total ?? NaN)),
    coinParts: Object.fromEntries([...parts].map((k) => [k, mean(rs.map((r) => r.coins[k] ?? 0))])),
    bySource: Object.fromEntries([...sources].map((k) => [k, mean(rs.map((r) => r.xpBySource[k] ?? 0))])),
    kills: Object.fromEntries([...killed].map((k) => [k, mean(rs.map((r) => r.killsBy[k] ?? 0))])),
    rate: Array.from({ length: w }, (_, i) => mean(rs.map((r) => r.xpRate[i] ?? NaN))),
  };
});
rows.sort((a, b) => (Number.isFinite(a.fight) ? a.fight : 1e9) - (Number.isFinite(b.fight) ? b.fight : 1e9));
const best = { fight: Math.min(...rows.map((r) => r.fight).filter(Number.isFinite)), xps: Math.max(...rows.map((r) => r.xps).filter(Number.isFinite)) };

const COLORS = ["#e05d44", "#e8c15a", "#6fb3d2", "#8bc34a", "#b58ad8", "#f39c6b", "#5fc9a8", "#d06d9b", "#9aa4b1", "#c7b198", "#7d8fe0", "#ff8a80", "#a5d6a7"];
const legendOf = (names: string[]): string => `<div class="legend">${names.map((k, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(k)}</span>`).join("")}</div>`;

// Experience dropped by source, as stacked bars (one per strategy).
const kinds = [...new Set(rows.flatMap((r) => Object.keys(r.bySource)))].filter((k) => k !== "(uncollected)");
kinds.sort((a, b) => mean(rows.map((r) => r.bySource[b] ?? 0)) - mean(rows.map((r) => r.bySource[a] ?? 0)));
const barW = 700;
const dropped = (r: Row): number => kinds.reduce((a, k) => a + (r.bySource[k] ?? 0), 0);
const maxDrop = Math.max(...rows.map(dropped));
const bars = rows
  .map((r, i) => {
    let x = 250;
    const y = 10 + i * 22;
    const segs = kinds
      .map((k, ki) => {
        const w = ((r.bySource[k] ?? 0) / maxDrop) * barW;
        const seg = `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="16" fill="${COLORS[ki % COLORS.length]}"><title>${esc(k)}: ${f(r.bySource[k] ?? 0)} XP, ${f(r.kills[k] ?? 0)} kills</title></rect>`;
        x += w;
        return seg;
      })
      .join("");
    return `<text x="242" y="${y + 12}" text-anchor="end">${esc(r.name)}</text>${segs}<text x="${x + 6}" y="${y + 12}">${f(dropped(r))}</text>`;
  })
  .join("");
const barsSvg = `<svg viewBox="0 0 1060 ${20 + rows.length * 22}" width="1060">${bars}</svg>`;

// Experience per second over the run, one line per strategy.
const maxT = Math.max(...rows.map((r) => r.rate.length)) * WINDOW;
const maxR = Math.max(...rows.flatMap((r) => r.rate.filter(Number.isFinite)));
const W = 1000;
const H = 320;
const px = (t: number): number => 50 + (t / maxT) * (W - 70);
const py = (v: number): number => H - 30 - (v / maxR) * (H - 50);
const lines = rows
  .map((r, i) => {
    const pts = r.rate.map((v, j) => (Number.isFinite(v) ? `${px((j + 0.5) * WINDOW).toFixed(1)},${py(v).toFixed(1)}` : "")).filter(Boolean);
    return `<polyline fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="1.6" points="${pts.join(" ")}"><title>${esc(r.name)}</title></polyline>`;
  })
  .join("");
const xaxis = Array.from({ length: Math.floor(maxT / 30) + 1 }, (_, i) => `<text x="${px(i * 30)}" y="${H - 10}" text-anchor="middle">${i * 30}s</text>`).join("");
const yaxis = [0, 0.25, 0.5, 0.75, 1].map((q) => `<text x="44" y="${py(q * maxR) + 4}" text-anchor="end">${f(q * maxR)}</text><line x1="50" x2="${W - 20}" y1="${py(q * maxR)}" y2="${py(q * maxR)}" stroke="#333"/>`).join("");
const rateSvg = `<svg viewBox="0 0 ${W} ${H}" width="${W}">${yaxis}${xaxis}${lines}</svg>`;

const coinKeys = ["drops", "survival", "kills", "boss", "spells"];
const table = `<table><tr><th>strategy</th><th>runs</th><th>clears</th><th>boss at</th><th>level then</th><th>XP/s (swarm)</th><th>best ÷</th><th>boss fight</th><th>÷ best</th><th>coins</th><th>${coinKeys.join(" / ")}</th><th>kedama share</th></tr>${rows
  .map(
    (r) =>
      `<tr><td>${esc(r.name)}</td><td>${r.n}</td><td>${r.clears}</td><td>${f(r.bossAt)}s</td><td>${f(r.level, 1)}</td><td>${f(r.xps, 1)}</td><td>${f(best.xps / r.xps, 2)}</td><td>${f(r.fight, 1)}s</td><td>${f(r.fight / best.fight, 2)}</td><td>${f(r.coins)}</td><td>${coinKeys.map((k) => f(r.coinParts[k] ?? NaN)).join(" / ")}</td><td>${f(((r.bySource.kedama ?? 0) / dropped(r)) * 100)}%</td></tr>`,
  )
  .join("")}</table>`;

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{margin:0;background:#111;color:#ddd;font:14px/1.4 "Segoe UI",Arial,sans-serif;padding:16px 24px}
h1{font-size:22px;color:#fff;margin:0 0 4px} h2{font-size:16px;color:#fff;margin:22px 0 8px}
table{border-collapse:collapse} td,th{padding:3px 10px;border-bottom:1px solid #2a2a2a;text-align:right} td:first-child,th:first-child{text-align:left}
th{color:#999;font-weight:normal} svg text{fill:#bbb;font-size:12px} .legend{margin-bottom:6px} .legend span{margin-right:14px;white-space:nowrap} .legend i{display:inline-block;width:10px;height:10px;margin-right:4px;border-radius:2px}
p{color:#888}
</style>
<h1>${esc(title)}</h1><p>${rows.reduce((a, r) => a + r.n, 0)} runs. Means over seeds; the boss fight counts clears only. XP/s: experience collected before the boss arrives, per second of action time.</p>
<h2>Strategies</h2>${table}
<h2>Experience dropped, by source</h2>${legendOf(kinds)}${barsSvg}
<h2>Experience collected per second (${WINDOW} s windows)</h2>${legendOf(rows.map((r) => r.name))}${rateSvg}
</html>`;
writeFileSync(out, html);
writeFileSync(out.replace(/\.html$/, ".json"), JSON.stringify(rows, null, 1));
console.log(out);
