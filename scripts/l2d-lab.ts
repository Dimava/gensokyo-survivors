// Pose sheet of a rigged model (src/art-l2d), rendered by the real Pixi
// renderer in headless Chrome through the running dev server (it imports
// src/art-l2d/lab.ts), laid out on dark and light tiles with labels.
//   bun scripts/l2d-lab.ts [reimu | fairy.sprite | reimu,cirno,fairy] [--scale 1] [--crop x,y,w,h] [--only 0,9,11] [--cols 5]
//     [--gait | --film [--span 1] [--rows hit,down] | --arcs [--span 1] [--rows hit] [--every 6]] [--out lab.png]
// Several models (comma-separated) are drawn in one browser, one sheet each
// (lab-reimu.png, lab-cirno.png, ...). PW_WS=<ws endpoint> uses a browser
// already running (playwright launchServer) instead of launching one.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1] ?? def;
  args.splice(i, 2);
  return v;
};
const url = opt("url", "http://localhost:5191");
const scale = Number(opt("scale", "1"));
const out = opt("out", "lab.png");
mkdirSync(dirname(out), { recursive: true });
const cropArg = opt("crop", "").split(",").filter(Boolean).map(Number);
const only = opt("only", "").split(",").filter(Boolean).map(Number);
const cols = Number(opt("cols", "5"));
/** --film: seconds each row covers, and which rows (by name prefix; default all). */
const span = Number(opt("span", "1"));
const filmRows = opt("rows", "").split(",").filter(Boolean);
const light = opt("bg", "dark") === "light";
/** --gait: stand / walk / slow-walk rows of a sprite rig instead of the pose sheet. */
const gait = args.includes("--gait");
if (gait) args.splice(args.indexOf("--gait"), 1);
/** --film: a sprite rig through stand, walk, focus backpedal, the hit, down and up again (lab.ts renderFilm). */
const film = args.includes("--film");
if (film) args.splice(args.indexOf("--film"), 1);
/**
 * --arcs: the film's motion as an animator checks it (lab.ts traceFilm), a row
 * per film row: onion skins with the paths of the hands (orange left, blue
 * right; a dot a frame, so the spacing shows the easing), elbows, head and
 * hem, and beside them the arm and body parameters over the row's time.
 */
const arcs = args.includes("--arcs");
if (arcs) args.splice(args.indexOf("--arcs"), 1);
const every = Number(opt("every", "6"));
const ids = (args[0] ?? "reimu").split(",");
const crop = cropArg.length === 4 ? { x: cropArg[0]!, y: cropArg[1]!, w: cropArg[2]!, h: cropArg[3]! } : undefined;

type Trace = Awaited<ReturnType<typeof import("../src/art-l2d/lab.ts").traceFilm>>;

/** The --arcs sheet: per row, onion skins under the traced paths, and the parameter curves. */
function arcSheet(id: string, tr: Trace): string {
  const { w, h } = tr;
  const CW = 460;
  const L = 22;
  const pad = 8;
  const rowH = h + L + pad;
  const width = pad + w + pad + CW + pad;
  const paths: [string, string, number][] = [
    ["handL", "#ff9a3c", 1.6],
    ["handR", "#4cc9ff", 1.6],
    ["elbowL", "#ffc890", 1],
    ["elbowR", "#a8e4ff", 1],
    ["face", "#ffffff", 1],
    ["dress", "#9aa0b4", 1],
  ];
  const curves: [string, string, number, string][] = [
    ["ArmL", "#ff9a3c", 1, ""],
    ["ArmR", "#4cc9ff", 1, ""],
    ["ArmLBend", "#ff9a3c", 1, "4 3"],
    ["ArmRBend", "#4cc9ff", 1, "4 3"],
    ["Bob", "#c8c8d0", 1, ""],
    ["Step", "#707888", 1, "2 2"],
    ["Sleeve", "#7ee07e", 1, ""],
    ["AngleZ", "#e070e0", 1 / 30, "1 2"],
  ];
  const out: string[] = [];
  tr.rows.forEach((row, r) => {
    const y0 = pad + r * rowH;
    out.push(`<text x="${pad}" y="${y0 + 15}" fill="#dde" font-size="14" font-family="sans-serif">${row.name}</text>`);
    const fy = y0 + L;
    out.push(`<rect x="${pad}" y="${fy}" width="${w}" height="${h}" fill="#141a2e"/>`);
    row.frames.forEach((u, i) => {
      const last = i === row.frames.length - 1;
      out.push(`<image x="${pad}" y="${fy}" width="${w}" height="${h}" opacity="${last ? 0.5 : 0.16}" href="${u}"/>`);
    });
    for (const [name, color, sw] of paths) {
      const pts = row.pts[name];
      if (!pts?.length) continue;
      const xy: string[] = [];
      for (let i = 0; i < pts.length; i += 2) xy.push(`${(pad + pts[i]!).toFixed(1)},${(fy + pts[i + 1]!).toFixed(1)}`);
      out.push(`<polyline points="${xy.join(" ")}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="0.9"/>`);
      if (name.startsWith("hand")) for (const p of xy) out.push(`<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="1.3" fill="${color}"/>`);
    }
    // The curves: -1..1 across the panel's height (AngleZ in degrees / 30).
    const cx = pad + w + pad;
    out.push(`<rect x="${cx}" y="${fy}" width="${CW}" height="${h}" fill="#10152a"/>`);
    const mid = fy + h / 2;
    const amp = h / 2 - 10;
    for (const v of [-1, -0.5, 0, 0.5, 1]) out.push(`<line x1="${cx}" x2="${cx + CW}" y1="${mid - v * amp}" y2="${mid - v * amp}" stroke="${v ? "#262c44" : "#3a4260"}" stroke-width="1"/>`);
    for (const [name, color, k, dash] of curves) {
      const vs = row.params[name];
      if (!vs?.length) continue;
      const xy = vs.map((v, i) => `${(cx + (i / Math.max(1, vs.length - 1)) * CW).toFixed(1)},${(mid - Math.max(-1.1, Math.min(1.1, v * k)) * amp).toFixed(1)}`);
      out.push(`<polyline points="${xy.join(" ")}" fill="none" stroke="${color}" stroke-width="1.4" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`);
    }
  });
  const legend = curves.map(([n, c, k, d], i) => `<line x1="${pad + i * 118}" x2="${pad + i * 118 + 22}" y1="${pad + tr.rows.length * rowH + 10}" y2="${pad + tr.rows.length * rowH + 10}" stroke="${c}" stroke-width="2" ${d ? `stroke-dasharray="${d}"` : ""}/><text x="${pad + i * 118 + 26}" y="${pad + tr.rows.length * rowH + 14}" fill="#cdd" font-size="12" font-family="sans-serif">${n}${k !== 1 ? " /30" : ""}</text>`);
  const height = pad + tr.rows.length * rowH + 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0b1020"/><text x="${width - 8}" y="16" text-anchor="end" fill="#8890a8" font-size="12" font-family="sans-serif">${id}: hand paths (dot = 1/60 s), elbows, head, hem; params over the row</text>${out.join("")}${legend.join("")}</svg>`;
}

const pwPath = process.env.PW ?? join(tmpdir(), "rec/node_modules/playwright-core/index.mjs");
// playwright-core is not a dependency of the game; it is loaded from outside, untyped.
// oxlint-disable-next-line typescript/no-explicit-any
const { chromium } = (await import(pwPath)) as { chromium: any };
const ws = process.env.PW_WS;
const browser = ws ? await chromium.connect(ws) : await chromium.launch();
try {
  const p = await browser.newPage();
  p.on("pageerror", (e: Error) => console.error("pageerror:", e.message));
  p.on("console", (m: { type(): string; text(): string }) => m.type() === "error" && console.error("console:", m.text()));
  await p.goto(`${url}/?screen=menu`);
  for (const id of ids) {
    if (arcs) {
      const tr = await p.evaluate(
        async ([id, scale, span, filmRows, every]: readonly [string, number, number, string[], number]) => {
          const lab = (await import(/* @vite-ignore */ `${"/src/art-l2d/lab.ts"}`)) as typeof import("../src/art-l2d/lab.ts");
          return lab.traceFilm(id.split(".")[0]!, scale, span, filmRows, every);
        },
        [id, scale, span, filmRows, every] as const,
      );
      const file = ids.length > 1 ? out.replace(/(\.png)?$/, `-${id}.png`) : out;
      writeFileSync(file, new Resvg(arcSheet(id, tr), { font: { loadSystemFonts: true } }).render().asPng());
      console.log(`wrote ${file}: ${tr.rows.length} rows traced`);
      continue;
    }
    const res: { urls: string[]; labels: string[] } = await p.evaluate(
      async ([id, scale, crop, only, gait, film, cols, span, filmRows]: readonly [string, number, unknown, number[], boolean, boolean, number, number, string[]]) => {
        const lab = (await import(/* @vite-ignore */ `${"/src/art-l2d/lab.ts"}`)) as typeof import("../src/art-l2d/lab.ts");
        if (gait) return lab.renderGait(id.split(".")[0]!, cols, scale);
        if (film) return lab.renderFilm(id.split(".")[0]!, cols, scale, span, filmRows);
        const poses = only.length ? only.map((i: number) => lab.SHEET[i]!) : lab.SHEET;
        const urls = await lab.renderPoses(id, poses, scale, crop as { x: number; y: number; w: number; h: number } | undefined);
        return { urls, labels: poses.map((q) => q.label ?? "") };
      },
      [id, scale, crop, only, gait, film, cols, span, filmRows] as const,
    );
    const first = res.urls[0]!;
    const png = Buffer.from(first.split(",")[1]!, "base64");
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const L = 20;
    const rows = Math.ceil(res.urls.length / cols);
    const tiles = res.urls.map((u, i) => {
      const x = (i % cols) * (w + 8) + 8;
      const y = Math.floor(i / cols) * (h + L + 8) + 8;
      return `<rect x="${x}" y="${y + L}" width="${w}" height="${h}" fill="${light ? "#e8e4dc" : "#141a2e"}"/><text x="${x + 4}" y="${y + 15}" fill="#cdd" font-size="14" font-family="sans-serif">${res.labels[i]}</text><image x="${x}" y="${y + L}" width="${w}" height="${h}" href="${u}"/>`;
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * (w + 8) + 8}" height="${rows * (h + L + 8) + 8}"><rect width="100%" height="100%" fill="#0b1020"/>${tiles.join("")}</svg>`;
    const file = ids.length > 1 ? out.replace(/(\.png)?$/, `-${id}.png`) : out;
    writeFileSync(file, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
    console.log(`wrote ${file}: ${res.urls.length} poses of ${w}x${h}`);
  }
} finally {
  await browser.close();
}
