// Charts for scripts/balance-power.ts: power curves (damage per second to the
// swarm, level, XP per second) for groups of strategies, and a ranking of all
// of them. Means over the seeds; rates over a trailing 15 s window.
//   bun scripts/balance-chart.ts <outDir> <power.json...>
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

interface Sample { t: number; level: number; xp: number; raw: number; eff: number; boss: number; kills: number; by: Record<string, [number, number, number]> }
interface Run { samples: Sample[]; outcome: string; bossAt: number; end: number; build: string }
const [outDir = ".", ...files] = process.argv.slice(2);
const data: Record<string, Run[]> = {};
for (const f of files) Object.assign(data, JSON.parse(readFileSync(f, "utf8")));

const SWARM_END = 200;
const WIN = 15;
const TS = Array.from({ length: SWARM_END / 5 + 1 }, (_, i) => i * 5);
const at = (r: Run, t: number): Sample | undefined => r.samples.find((s) => s.t === t);
/** Mean over the seeds of f(run, t), skipping runs without the samples. */
const mean = (runs: Run[], f: (r: Run) => number | undefined): number => {
  let s = 0;
  let n = 0;
  for (const r of runs) {
    const v = f(r);
    if (v === undefined || !Number.isFinite(v)) continue;
    s += v;
    n++;
  }
  return n ? s / n : NaN;
};
const rate = (key: "raw" | "eff" | "xp" | "kills") => (r: Run, t: number): number | undefined => {
  const a = at(r, Math.max(0, t - WIN));
  const b = at(r, t);
  return a && b && t > 0 ? (b[key] - a[key]) / Math.min(WIN, t) : undefined;
};
const series = (name: string, f: (r: Run, t: number) => number | undefined) => TS.map((t) => [t, mean(data[name] ?? [], (r) => f(r, t))] as [number, number]);

const PALETTE = ["#e8e8e8", "#8a8a8a", "#ff5470", "#ffb3c1", "#58a6ff", "#b18cff", "#ffd166", "#06d6a0", "#ff9f1c", "#3ddbd9", "#f15bb5", "#9ef01a", "#c0c8e0"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function lineChart(x: number, y: number, w: number, h: number, title: string, lines: { name: string; color: string; pts: [number, number][]; dash?: boolean }[]): string {
  const pad = { l: 56, r: 12, t: 30, b: 28 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const ymax = Math.max(1, ...lines.flatMap((l) => l.pts.map((p) => p[1]).filter(Number.isFinite))) * 1.05;
  const sx = (t: number) => pad.l + (t / SWARM_END) * iw;
  const sy = (v: number) => pad.t + ih - (v / ymax) * ih;
  const step = niceStep(ymax / 5);
  let g = `<g transform="translate(${x},${y})"><rect width="${w}" height="${h}" fill="#141a2e" rx="6"/>`;
  g += `<text x="${pad.l}" y="20" fill="#fff" font-size="15" font-weight="bold">${esc(title)}</text>`;
  for (let v = 0; v <= ymax; v += step) {
    g += `<line x1="${pad.l}" x2="${pad.l + iw}" y1="${sy(v)}" y2="${sy(v)}" stroke="#2a3350"/>`;
    g += `<text x="${pad.l - 6}" y="${sy(v) + 4}" fill="#9aa4c0" font-size="11" text-anchor="end">${fmt(v)}</text>`;
  }
  for (let t = 0; t <= SWARM_END; t += 30) {
    g += `<text x="${sx(t)}" y="${pad.t + ih + 16}" fill="#9aa4c0" font-size="11" text-anchor="middle">${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}</text>`;
  }
  for (const l of lines) {
    const d = l.pts.filter((p) => Number.isFinite(p[1])).map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("");
    g += `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2.2"${l.dash ? ' stroke-dasharray="6 4"' : ""}/>`;
  }
  return g + "</g>";
}
function legend(x: number, y: number, lines: { name: string; color: string; dash?: boolean }[], cols: number, colW: number): string {
  let g = `<g transform="translate(${x},${y})">`;
  lines.forEach((l, i) => {
    const lx = (i % cols) * colW;
    const ly = Math.floor(i / cols) * 20;
    g += `<line x1="${lx}" x2="${lx + 22}" y1="${ly}" y2="${ly}" stroke="${l.color}" stroke-width="3"${l.dash ? ' stroke-dasharray="6 4"' : ""}/>`;
    g += `<text x="${lx + 28}" y="${ly + 4}" fill="#dde3f5" font-size="13">${esc(l.name)}</text>`;
  });
  return g + "</g>";
}
const niceStep = (s: number): number => {
  const p = 10 ** Math.floor(Math.log10(s));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= s)!;
};
const fmt = (v: number): string => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${+v.toFixed(1)}`);

function panel(file: string, title: string, names: string[]): void {
  const lines = names.filter((n) => data[n]).map((name, i) => ({ name, color: PALETTE[i % PALETTE.length]!, dash: name.includes("lucky") || name === "random" }));
  const W = 1500;
  const cw = 480;
  const ch = 330;
  const legendRows = Math.ceil(lines.length / 4);
  const H = 60 + ch * 2 + 30 + legendRows * 20 + 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#0b0f1e"/>`;
  svg += `<text x="20" y="36" fill="#fff" font-size="22" font-weight="bold">${esc(title)}</text>`;
  svg += `<text x="${W - 20}" y="36" fill="#9aa4c0" font-size="13" text-anchor="end">Misty Lake, expert bot, mean of ${data[names[0]!]?.length ?? 0} seeds (same seeds for every strategy); rates over the last ${WIN} s</text>`;
  const charts: [string, (r: Run, t: number) => number | undefined][] = [
    ["Damage per second to the swarm (raw: power)", rate("raw")],
    ["Damage per second that counted (up to HP left)", rate("eff")],
    ["Kills per second", rate("kills")],
    ["Level", (r, t) => at(r, t)?.level],
    ["XP collected per second", rate("xp")],
    ["XP collected (total)", (r, t) => at(r, t)?.xp],
  ];
  charts.forEach(([t, f], i) => {
    svg += lineChart(20 + (i % 3) * (cw + 10), 56 + Math.floor(i / 3) * (ch + 10), cw, ch, t, lines.map((l) => ({ ...l, pts: series(l.name, f) })));
  });
  svg += legend(30, 56 + ch * 2 + 40, lines, 4, 370);
  svg += "</svg>";
  writeFileSync(`${outDir}/${file}.svg`, svg);
  writeFileSync(`${outDir}/${file}.png`, new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng());
}

// A ranking of every strategy: bars of level at 1:40 and 3:20, damage per second at 1:40 and 3:00, boss time.
function ranking(file: string): void {
  const rows = Object.entries(data).map(([name, runs]) => {
    const boss = runs.filter((r) => r.outcome === "clear" && r.bossAt > 0).map((r) => r.end - r.bossAt);
    return {
      name,
      lv100: mean(runs, (r) => at(r, 100)?.level),
      lv200: mean(runs, (r) => at(r, 200)?.level),
      dps100: mean(runs, (r) => rate("raw")(r, 100)),
      dps180: mean(runs, (r) => rate("raw")(r, 180)),
      boss: boss.length ? boss.reduce((a, b) => a + b, 0) / boss.length : NaN,
      clears: runs.filter((r) => r.outcome === "clear").length,
      n: runs.length,
    };
  });
  rows.sort((a, b) => b.dps180 - a.dps180);
  const cols: { key: keyof (typeof rows)[0]; title: string; color: string; better: "high" | "low" }[] = [
    { key: "lv100", title: "level at 1:40", color: "#58a6ff", better: "high" },
    { key: "lv200", title: "level at 3:20", color: "#b18cff", better: "high" },
    { key: "dps100", title: "damage/s at 1:40", color: "#ffb3c1", better: "high" },
    { key: "dps180", title: "damage/s at 3:00", color: "#ff5470", better: "high" },
    { key: "boss", title: "boss fight, s (lower is better)", color: "#ffd166", better: "low" },
  ];
  const nameW = 240;
  const colW = 240;
  const rowH = 24;
  const W = nameW + cols.length * colW + 40;
  const H = 110 + rows.length * rowH + 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#0b0f1e"/>`;
  svg += `<text x="20" y="36" fill="#fff" font-size="22" font-weight="bold">Every level-up strategy, ranked by damage per second at 3:00</text>`;
  svg += `<text x="20" y="60" fill="#9aa4c0" font-size="13">A strategy takes its listed items whenever offered, otherwise the bot's default pick. Mean of ${rows[0]?.n} seeds; clears shown after the name.</text>`;
  cols.forEach((c, ci) => {
    const x0 = nameW + ci * colW;
    const vals = rows.map((r) => r[c.key] as number).filter(Number.isFinite);
    const max = Math.max(...vals);
    const best = c.better === "high" ? max : Math.min(...vals);
    svg += `<text x="${x0}" y="96" fill="#dde3f5" font-size="13" font-weight="bold">${esc(c.title)}</text>`;
    rows.forEach((r, ri) => {
      const v = r[c.key] as number;
      const y = 106 + ri * rowH;
      if (!Number.isFinite(v)) return;
      const bw = (v / max) * (colW - 70);
      svg += `<rect x="${x0}" y="${y}" width="${bw.toFixed(1)}" height="${rowH - 6}" fill="${c.color}" opacity="${v === best ? 1 : 0.55}" rx="3"/>`;
      svg += `<text x="${x0 + bw + 6}" y="${y + 14}" fill="#dde3f5" font-size="12">${fmt(v)}</text>`;
    });
  });
  rows.forEach((r, ri) => {
    const y = 106 + ri * rowH;
    svg += `<text x="20" y="${y + 14}" fill="${r.name.includes("lucky") ? "#ffd166" : "#fff"}" font-size="13">${esc(r.name)}${r.clears < r.n ? `  (${r.clears}/${r.n})` : ""}</text>`;
  });
  svg += "</svg>";
  writeFileSync(`${outDir}/${file}.svg`, svg);
  writeFileSync(`${outDir}/${file}.png`, new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng());
  console.log(["strategy".padEnd(28), ...cols.map((c) => c.key.padStart(8)), "clears"].join(" "));
  for (const r of rows) console.log([r.name.padEnd(28), ...cols.map((c) => fmt(r[c.key] as number).padStart(8)), `${r.clears}/${r.n}`].join(" "));
}

const SOURCE_COLORS: Record<string, string> = {
  amulet: "#ff5470", needle: "#ffb3c1", orbs: "#e8e8e8", border: "#58a6ff", spark: "#ffd166", knives: "#06d6a0",
  "fantasy-seal": "#b18cff", "master-spark": "#fff27a", vengeance: "#ff9f1c",
};
const sourceColor = (s: string, i: number) => SOURCE_COLORS[s] ?? PALETTE[(i + 5) % PALETTE.length]!;

/** Stacked effective damage per second to the swarm by source, one chart per strategy; then the boss's damage by source. */
function sources(file: string, names: string[]): void {
  names = names.filter((n) => data[n]);
  const srcs = [...new Set(names.flatMap((n) => data[n]!.flatMap((r) => Object.keys(r.samples.at(-1)?.by ?? {}))))].sort(
    (a, b) => Object.keys(SOURCE_COLORS).indexOf(a) - Object.keys(SOURCE_COLORS).indexOf(b),
  );
  const cw = 480;
  const ch = 300;
  const W = 1500;
  const rows = Math.ceil(names.length / 3);
  const bossH = 40 + names.length * 30;
  const H = 70 + rows * (ch + 10) + 40 + bossH + 50;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#0b0f1e"/>`;
  svg += `<text x="20" y="36" fill="#fff" font-size="22" font-weight="bold">What does the damage: effective damage per second to the swarm, by source</text>`;
  svg += `<text x="${W - 20}" y="36" fill="#9aa4c0" font-size="13" text-anchor="end">stacked; mean of the seeds; last ${WIN} s</text>`;
  const rateBy = (r: Run, t: number, src: string, k: 0 | 1 | 2): number | undefined => {
    const a = at(r, Math.max(0, t - WIN));
    const b = at(r, t);
    return a && b && t > 0 ? ((b.by[src]?.[k] ?? 0) - (a.by[src]?.[k] ?? 0)) / Math.min(WIN, t) : undefined;
  };
  let ymax = 0;
  const stacks = names.map((n) => {
    const per = srcs.map((src) => TS.map((t) => mean(data[n]!, (r) => rateBy(r, t, src, 1)) || 0));
    const tops = TS.map((_, i) => per.reduce((s, p) => s + p[i]!, 0));
    ymax = Math.max(ymax, ...tops);
    return per;
  });
  ymax *= 1.05;
  names.forEach((n, ni) => {
    const x = 20 + (ni % 3) * (cw + 10);
    const y = 56 + Math.floor(ni / 3) * (ch + 10);
    const pad = { l: 56, r: 12, t: 30, b: 28 };
    const iw = cw - pad.l - pad.r;
    const ih = ch - pad.t - pad.b;
    const sx = (t: number) => pad.l + (t / SWARM_END) * iw;
    const sy = (v: number) => pad.t + ih - (v / ymax) * ih;
    let g = `<g transform="translate(${x},${y})"><rect width="${cw}" height="${ch}" fill="#141a2e" rx="6"/>`;
    g += `<text x="${pad.l}" y="20" fill="#fff" font-size="15" font-weight="bold">${esc(n)}</text>`;
    const step = niceStep(ymax / 5);
    for (let v = 0; v <= ymax; v += step) {
      g += `<line x1="${pad.l}" x2="${pad.l + iw}" y1="${sy(v)}" y2="${sy(v)}" stroke="#2a3350"/>`;
      g += `<text x="${pad.l - 6}" y="${sy(v) + 4}" fill="#9aa4c0" font-size="11" text-anchor="end">${fmt(v)}</text>`;
    }
    for (let t = 0; t <= SWARM_END; t += 30) g += `<text x="${sx(t)}" y="${pad.t + ih + 16}" fill="#9aa4c0" font-size="11" text-anchor="middle">${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}</text>`;
    const base = TS.map(() => 0);
    stacks[ni]!.forEach((per, si) => {
      const top = base.map((b, i) => b + per[i]!);
      const up = TS.map((t, i) => `${sx(t).toFixed(1)},${sy(top[i]!).toFixed(1)}`);
      const down = TS.map((t, i) => `${sx(t).toFixed(1)},${sy(base[i]!).toFixed(1)}`).reverse();
      g += `<polygon points="${[...up, ...down].join(" ")}" fill="${sourceColor(srcs[si]!, si)}" opacity="0.85"/>`;
      top.forEach((v, i) => (base[i] = v));
    });
    svg += g + "</g>";
  });
  // The boss: share of the damage she took, by source (mean over the seeds that reached her).
  const by0 = 56 + rows * (ch + 10) + 20;
  svg += `<text x="20" y="${by0 + 16}" fill="#fff" font-size="17" font-weight="bold">Damage to the boss, by source (share of the fight's total)</text>`;
  names.forEach((n, ni) => {
    const y = by0 + 34 + ni * 30;
    const tot = srcs.map((src) => mean(data[n]!, (r) => r.samples.at(-1)?.by[src]?.[2] ?? 0));
    const sum = tot.reduce((a, b) => a + b, 0) || 1;
    svg += `<text x="20" y="${y + 15}" fill="#dde3f5" font-size="13">${esc(n)}</text>`;
    let bx = 300;
    const bw = W - 340;
    tot.forEach((v, si) => {
      const w = (v / sum) * bw;
      if (w <= 0) return;
      svg += `<rect x="${bx.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="20" fill="${sourceColor(srcs[si]!, si)}"/>`;
      if (w > 60) svg += `<text x="${(bx + 6).toFixed(1)}" y="${y + 15}" fill="#0b0f1e" font-size="12" font-weight="bold">${esc(srcs[si]!)} ${Math.round((100 * v) / sum)}%</text>`;
      bx += w;
    });
  });
  svg += legend(30, H - 30, srcs.map((s, i) => ({ name: s, color: sourceColor(s, i) })), 9, 160);
  svg += "</svg>";
  writeFileSync(`${outDir}/${file}.svg`, svg);
  writeFileSync(`${outDir}/${file}.png`, new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng());
}

panel("power-builds", "Power curves: weapon focus and builds", ["default", "random", "amulet", "needle", "orbs", "border", "needle+tome+clock", "needle+tome+clock (lucky)", "amulet+tome+clock", "amulet+tome+clock (lucky)", "amulet+power+tome"]);
panel("power-passives", "Power curves: one passive first", ["default", "power", "heart", "geta", "clock", "magnet", "grimoire", "ribbon", "gourd", "neko", "tome"]);
ranking("power-ranking");
sources("power-sources", ["default", "needle+tome+clock", "needle+tome+clock (lucky)", "amulet", "amulet+power+tome", "magnet"]);
