// Pose sheet of a rigged model (src/art-l2d), rendered by the real Pixi
// renderer in headless Chrome through the running dev server (it imports
// src/art-l2d/lab.ts), laid out on dark and light tiles with labels.
//   bun scripts/l2d-lab.ts [reimu | fairy.sprite] [--scale 1] [--crop x,y,w,h] [--only 0,9,11] [--cols 5] [--gait | --film] [--out lab.png]
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
const cropArg = opt("crop", "").split(",").filter(Boolean).map(Number);
const only = opt("only", "").split(",").filter(Boolean).map(Number);
const cols = Number(opt("cols", "5"));
const light = opt("bg", "dark") === "light";
/** --gait: stand / walk / slow-walk rows of a sprite rig instead of the pose sheet. */
const gait = args.includes("--gait");
if (gait) args.splice(args.indexOf("--gait"), 1);
/** --film: a sprite rig through stand, walk, focus backpedal, the hit, down and up again (lab.ts renderFilm). */
const film = args.includes("--film");
if (film) args.splice(args.indexOf("--film"), 1);
const id = args[0] ?? "reimu";
const crop = cropArg.length === 4 ? { x: cropArg[0]!, y: cropArg[1]!, w: cropArg[2]!, h: cropArg[3]! } : undefined;

const pwPath = process.env.PW ?? join(tmpdir(), "rec/node_modules/playwright-core/index.mjs");
// playwright-core is not a dependency of the game; it is loaded from outside, untyped.
// oxlint-disable-next-line typescript/no-explicit-any
const { chromium } = (await import(pwPath)) as { chromium: any };
const browser = await chromium.launch();
try {
  const p = await browser.newPage();
  p.on("pageerror", (e: Error) => console.error("pageerror:", e.message));
  p.on("console", (m: { type(): string; text(): string }) => m.type() === "error" && console.error("console:", m.text()));
  await p.goto(`${url}/?screen=menu`);
  const res: { urls: string[]; labels: string[] } = await p.evaluate(
    async ([id, scale, crop, only, gait, film, cols]: readonly [string, number, unknown, number[], boolean, boolean, number]) => {
      const lab = (await import(/* @vite-ignore */ `${"/src/art-l2d/lab.ts"}`)) as typeof import("../src/art-l2d/lab.ts");
      if (gait) return lab.renderGait(id.split(".")[0]!, cols, scale);
      if (film) return lab.renderFilm(id.split(".")[0]!, cols, scale);
      const poses = only.length ? only.map((i: number) => lab.SHEET[i]!) : lab.SHEET;
      const urls = await lab.renderPoses(id, poses, scale, crop as { x: number; y: number; w: number; h: number } | undefined);
      return { urls, labels: poses.map((q) => q.label ?? "") };
    },
    [id, scale, crop, only, gait, film, cols] as const,
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
  writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
  console.log(`wrote ${out}: ${res.urls.length} poses of ${w}x${h}`);
} finally {
  await browser.close();
}
