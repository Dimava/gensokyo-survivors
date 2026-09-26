// The key art, drawn from the rigs (src/art-l2d/keyart.ts) in headless Chrome
// through the running dev server, each picture at twice its size and brought
// down (supersampled):
//   public/preview.jpg          1200x630  the link preview (index.html's og:image), shipped with the build
//   docs/preview.png            1280x640  the README banner (the dist branch's readme/preview.png) and GitHub's social preview
//   docs/preview-500x300.png    500x300   the thumbnail for game sites (galaxy.click)
//
//   bun scripts/key-art.ts [--url http://localhost:5191] [--out dir] [--only wide,banner,thumb]
// --out writes the three into one folder instead, to look at before shipping.
// Needs ffmpeg on PATH: it writes the JPEG (4:4:4, so the reds keep their
// edges) and repacks the PNGs smaller (RGB, per-row filters).
// PW_WS=<ws endpoint> uses a browser already running instead of launching one.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : (args[i + 1] ?? def);
};
const url = opt("url", "http://localhost:5191");
const out = opt("out", "");
const only = opt("only", "").split(",").filter(Boolean);

const JOBS = [
  { name: "wide", layout: "wide", w: 1200, h: 630, file: "public/preview.jpg" },
  { name: "banner", layout: "wide", w: 1280, h: 640, file: "docs/preview.png" },
  { name: "thumb", layout: "thumb", w: 500, h: 300, file: "docs/preview-500x300.png" },
].filter((j) => !only.length || only.includes(j.name));

/** The page the picture is drawn on, served at the dev server's origin so it can import the game's modules. */
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html, body { margin: 0; background: #000; } #stage * { box-sizing: border-box; }</style></head><body><div id="stage"></div></body></html>`;

function ffmpeg(input: string, output: string, codec: string[]): boolean {
  const p = Bun.spawnSync(["ffmpeg", "-y", "-v", "error", "-i", input, ...codec, output]);
  if (p.exitCode !== 0) console.error(`ffmpeg: ${p.stderr.toString()}`);
  return p.exitCode === 0;
}

const pwPath = process.env.PW ?? join(tmpdir(), "rec/node_modules/playwright-core/index.mjs");
// playwright-core is not a dependency of the game; it is loaded from outside, untyped.
// oxlint-disable-next-line typescript/no-explicit-any
const { chromium } = (await import(pwPath)) as { chromium: any };
const ws = process.env.PW_WS;
const browser = ws ? await chromium.connect(ws) : await chromium.launch();
const scratch = join(tmpdir(), `key-art-${process.pid}`);
mkdirSync(scratch, { recursive: true });
try {
  for (const job of JOBS) {
    const ctx = await browser.newContext({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 2 });
    await ctx.route(`${url}/__key-art.html`, (route: { fulfill(r: object): Promise<void> }) => route.fulfill({ body: PAGE, contentType: "text/html" }));
    const p = await ctx.newPage();
    p.on("pageerror", (e: Error) => console.error("pageerror:", e.message));
    p.on("console", (m: { type(): string; text(): string }) => m.type() === "error" && !m.text().includes("WebSocket") && console.error("console:", m.text()));
    await p.goto(`${url}/__key-art.html`);
    await p.evaluate(
      async ([w, h, layout]: readonly [number, number, string]) => {
        const art = (await import(/* @vite-ignore */ `${"/src/art-l2d/keyart.ts"}`)) as typeof import("../src/art-l2d/keyart.ts");
        await art.drawKeyArt(document.getElementById("stage")!, { w, h, dpr: 2, layout });
      },
      [job.w, job.h, job.layout] as const,
    );
    await p.waitForTimeout(200);
    const big: Buffer = await p.locator("#stage").screenshot();
    // Down to 1x in the page: a canvas with high-quality smoothing averages the 2x picture.
    const small: string = await p.evaluate(
      async ([data, w, h]: readonly [string, number, number]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, w, h);
        return c.toDataURL("image/png");
      },
      [big.toString("base64"), job.w, job.h] as const,
    );
    await ctx.close();
    const raw = join(scratch, `${job.name}.png`);
    writeFileSync(raw, Buffer.from(small.split(",")[1]!, "base64"));
    const file = out ? join(out, job.file.split("/").pop()!) : job.file;
    mkdirSync(dirname(file), { recursive: true });
    const jpg = file.endsWith(".jpg");
    const ok = ffmpeg(raw, file, jpg ? ["-pix_fmt", "yuvj444p", "-q:v", "2"] : ["-pix_fmt", "rgb24", "-pred", "mixed"]);
    if (!ok) {
      if (jpg) throw new Error(`no ffmpeg on PATH: can't write ${file}`);
      writeFileSync(file, Buffer.from(small.split(",")[1]!, "base64"));
    }
    console.log(`wrote ${file} (${job.w}x${job.h}, ${Math.round(Bun.file(file).size / 1024)} KB)`);
  }
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}
