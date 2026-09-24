// Builds refs/index.html: every reference image under refs/ (git-ignored,
// copyrighted, local only) on one page, grouped by folder, with each
// folder's SOURCES.md and STYLE.md shown above its images.
// bun scripts/refs-index.ts [--open]

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..", "refs");
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Just enough markdown for the notes: headings, bullets, links, code. */
function md(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => {
      let l = esc(line)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/(https?:\/\/[^\s)<]+)/g, '<a href="$1">$1</a>');
      const h = /^(#{1,3}) (.*)$/.exec(l);
      if (h) return `<h${h[1]!.length + 2}>${h[2]}</h${h[1]!.length + 2}>`;
      if (/^\s*- /.test(l)) l = "&bull; " + l.replace(/^\s*- /, "");
      return l ? `<div>${l}</div>` : "";
    })
    .join("\n");
}

function walk(dir: string): string[] {
  const dirs = [dir];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) dirs.push(...walk(p));
  }
  return dirs;
}

let body = "";
let total = 0;
for (const dir of walk(root)) {
  const images = readdirSync(dir).filter((f) => IMAGE.test(f)).sort();
  const notes = ["SOURCES.md", "STYLE.md"].filter((f) => existsSync(join(dir, f)));
  if (!images.length && !notes.length) continue;
  total += images.length;
  const rel = relative(root, dir).replace(/\\/g, "/") || "(top)";
  body += `<section><h2>${esc(rel)} <small>${images.length} images</small></h2>`;
  for (const n of notes) body += `<details><summary>${n}</summary><div class="md">${md(readFileSync(join(dir, n), "utf8"))}</div></details>`;
  body += `<div class="grid">`;
  for (const f of images) {
    const src = encodeURI(relative(root, join(dir, f)).replace(/\\/g, "/"));
    body += `<figure><a href="${src}" target="_blank"><img src="${src}" loading="lazy"></a><figcaption>${esc(f)}</figcaption></figure>`;
  }
  body += `</div></section>`;
}

const html = `<!doctype html><meta charset="utf-8"><title>Gensokyo Survivors refs (${total})</title>
<style>
body { margin: 0; padding: 16px 24px; background: #0b1020; color: #eef1ff; font: 14px "Segoe UI", system-ui, sans-serif; }
h1 { margin: 0 0 8px; } h2 { border-bottom: 1px solid #2a3560; padding-bottom: 4px; margin-top: 28px; }
small { color: #9aa6c8; font-weight: normal; font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
figure { margin: 0; background: #141a2e; border: 1px solid #2a3560; border-radius: 10px; padding: 8px; }
img { width: 100%; height: 220px; object-fit: contain; image-rendering: auto; background: repeating-conic-gradient(#1b2340 0 25%, #151c33 0 50%) 0 0 / 16px 16px; border-radius: 6px; }
figcaption { margin-top: 6px; font-size: 12px; color: #9aa6c8; word-break: break-all; }
details { margin: 6px 0 12px; } summary { cursor: pointer; color: #ffc94d; }
.md { background: #141a2e; border-radius: 8px; padding: 10px 14px; margin-top: 6px; line-height: 1.5; }
a { color: #6fd3ff; } code { background: #1f2748; padding: 0 4px; border-radius: 4px; }
</style>
<h1>Reference images <small>${total} total · local only, never committed · regenerate: bun scripts/refs-index.ts</small></h1>
${body}`;

writeFileSync(join(root, "index.html"), html);
console.log(`refs/index.html: ${total} images`);
if (process.argv.includes("--open")) Bun.spawn(["cmd", "/c", "start", "", join(root, "index.html")]);
