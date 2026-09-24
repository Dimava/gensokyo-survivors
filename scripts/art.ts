// The drawing tool: renders character drawings (src/art) to one PNG sheet,
// without a browser. Each drawing is shown at game size and zoomed, on the
// game's dark background and on a light checker, so small sprites can be
// judged as the player sees them and detail can be checked up close.
//   bun scripts/art.ts [name ...] [--zoom 4] [--out art.png]
// Names match drawing keys ("reimu.sprite") or prefixes ("reimu", "sprite").
// --dirs shows each drawing in all 9 looks the game pre-renders (ahead, then E, SE, S, ... clockwise).
// --bones overlays the construction (head, face lines, eye boxes, body landmarks) on a dimmed drawing.
// --crop x,y,w,h shows only that region (in drawing pixels); --cols 3 wraps the --dirs looks into rows.
// --ref a.png,b.png puts reference images at the end of the sheet (--refh sets their height, default 480).
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { ART } from "../src/art/index.ts";
import { AHEAD, LOOKS, type Drawing, type Look } from "../src/art/drawing.ts";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1] ?? def;
  args.splice(i, 2);
  return v;
};
const flag = (name: string): boolean => {
  const i = args.indexOf(`--${name}`);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const dirs = flag("dirs");
const bones = flag("bones");
const refs = opt("ref", "").split(",").filter(Boolean);
const refH = Number(opt("refh", "480"));
const cropArg = opt("crop", "").split(",").filter(Boolean).map(Number);
const cols = Number(opt("cols", "9"));
const zoomArg = Number(opt("zoom", "0"));
const out = opt("out", "art.png");
const names = args;

const all: [string, Drawing][] = Object.entries(ART).flatMap(([who, set]) => Object.entries(set).map(([kind, d]) => [`${who}.${kind}`, d] as [string, Drawing]));
/** With --bones: the drawing dimmed, its construction on top. */
const withBones = (d: Drawing): Drawing => (bones && d.bones ? { ...d, body: (look) => `<g opacity="0.45">${d.body(look)}</g>${d.bones!(look)}` } : d);
const picked = names.length ? all.filter(([key]) => names.some((n) => key === n || key.startsWith(`${n}.`) || key.endsWith(`.${n}`))) : all;
if (!picked.length) throw new Error(`no drawings match ${names.join(", ")}; drawings: ${all.map(([k]) => k).join(", ")}`);

const PAD = 16;
const LABEL = 22;
const rows: string[] = [];
let y = PAD;
let width = 0;
for (const [key, d] of picked) {
  // Sprites are small: zoom them more. Portraits are big already.
  const zoom = zoomArg || (d.w <= 128 ? 4 : 1);
  const [cx, cy, cw, ch] = cropArg.length === 4 ? cropArg : [0, 0, d.w, d.h];
  // A cropped tile is rendered whole first, then clipped as an image: resvg panics on masked or
  // filtered shapes that fall entirely outside a cropped viewport.
  const whole = (px: number, look: Look) => `<svg xmlns="http://www.w3.org/2000/svg" width="${d.w * px}" height="${d.h * px}" viewBox="0 0 ${d.w * d.scale} ${d.h * d.scale}">${withBones(d).body(look)}</svg>`;
  const inner = (px: number, look: Look = AHEAD, ty = y + LABEL) =>
    cropArg.length === 4
      ? `<svg x="{X}" y="${ty}" width="${cw! * px}" height="${ch! * px}"><image x="${-cx! * px}" y="${-cy! * px}" width="${d.w * px}" height="${d.h * px}" href="data:image/png;base64,${Buffer.from(new Resvg(whole(px, look)).render().asPng()).toString("base64")}"/></svg>`
      : whole(px, look).replace("<svg ", `<svg x="{X}" y="${ty}" `);
  const tile = (x: number, px: number, light: boolean, look: Look = AHEAD, ty = y + LABEL) => {
    const w = cw! * px;
    const h = ch! * px;
    const bg = light
      ? `<rect x="${x}" y="${ty}" width="${w}" height="${h}" fill="url(#checker)"/>`
      : `<rect x="${x}" y="${ty}" width="${w}" height="${h}" fill="#141a2e"/>`;
    return bg + inner(px, look, ty).replace("{X}", String(x));
  };
  let x = PAD;
  if (dirs) {
    // One row of the 9 looks at a readable zoom.
    const z = Math.max(2, Math.floor(zoom / 2));
    const parts = [`<text x="${PAD}" y="${y + 15}" font-family="Segoe UI, sans-serif" font-size="14" fill="#cfd6ea">${key}: ahead, E, SE, S, SW, W, NW, N, NE</text>`];
    let ty = y + LABEL;
    LOOKS.forEach((look, i) => {
      if (i > 0 && i % cols === 0) {
        width = Math.max(width, x + PAD);
        x = PAD;
        ty += ch! * z + 8;
      }
      parts.push(tile(x, z, false, look, ty));
      x += cw! * z + 8;
    });
    rows.push(parts.join(""));
    width = Math.max(width, x + PAD);
    y = ty + ch! * z + PAD;
    continue;
  }
  const parts = [`<text x="${PAD}" y="${y + 15}" font-family="Segoe UI, sans-serif" font-size="14" fill="#cfd6ea">${key}  (${d.w}x${d.h}, shown at 1x and ${zoom}x)</text>`];
  parts.push(tile(x, 1, false));
  x += cw! + PAD;
  if (zoom > 1) {
    parts.push(tile(x, zoom, false));
    x += cw! * zoom + PAD;
  }
  parts.push(tile(x, zoom, true));
  x += cw! * zoom + PAD;
  rows.push(parts.join(""));
  width = Math.max(width, x);
  y += LABEL + ch! * zoom + PAD;
}
if (refs.length) {
  // Reference images, side by side at one height, for judging a drawing against them.
  let x = PAD;
  const parts: string[] = [];
  for (const file of refs) {
    const png = readFileSync(file);
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const rw = Math.round((w * refH) / h);
    parts.push(`<rect x="${x}" y="${y}" width="${rw}" height="${refH}" fill="#ffffff"/><image href="data:image/png;base64,${png.toString("base64")}" x="${x}" y="${y}" width="${rw}" height="${refH}"/>`);
    x += rw + PAD;
  }
  rows.push(parts.join(""));
  width = Math.max(width, x);
  y += refH + PAD;
}
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}">
<defs><pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#e8e8ee"/><rect width="8" height="8" fill="#d0d0da"/><rect x="8" y="8" width="8" height="8" fill="#d0d0da"/></pattern></defs>
<rect width="100%" height="100%" fill="#0b1020"/>${rows.join("\n")}</svg>`;
writeFileSync(out, new Resvg(sheet, { font: { loadSystemFonts: true } }).render().asPng());
console.log(`${picked.length} drawing(s) -> ${out}: ${picked.map(([k]) => k).join(", ")}`);
