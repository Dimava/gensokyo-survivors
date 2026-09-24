// Screenshots of the rigged portraits (src/art-l2d) in the running dev
// server: opens the gallery in headless Chrome with the given art style,
// moves the cursor around the Reimu card and packs the shots into one sheet.
//   bun scripts/l2d-shot.ts [--url http://localhost:5191] [--style live2d|drawn|both] [--who reimu] [--size 1280x1000] [--out l2d.png] [--page page.png]
// Needs playwright-core (PW env var, default the /tmp/rec install) and Chrome.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? def) : def;
};
const url = opt("url", "http://localhost:5191");
const style = opt("style", "live2d");
const out = opt("out", "l2d.png");
const page = opt("page", "");
const who = opt("who", "reimu");
const [vw, vh] = opt("size", "1280x1000").split("x").map(Number) as [number, number];

const pwPath = process.env.PW ?? join(tmpdir(), "rec/node_modules/playwright-core/index.mjs");
// playwright-core is not a dependency of the game; it is loaded from outside, untyped.
// oxlint-disable-next-line typescript/no-explicit-any
const { chromium } = (await import(pwPath)) as { chromium: any };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  await ctx.addInitScript((s: string) => localStorage.setItem("gensokyo-survivors/prefs", JSON.stringify({ artStyle: s === "drawn" ? "drawn" : "live2d" })), style);
  const p = await ctx.newPage();
  p.on("pageerror", (e: Error) => console.error("pageerror:", e.message));
  p.on("console", (m: { type(): string; text(): string }) => m.type() === "error" && console.error("console:", m.text()));
  await p.goto(`${url}/?screen=menu`);
  await p.getByRole("button", { name: "Gallery" }).click();
  if (style === "both" || style === "drawn") await p.getByRole("button", { name: style === "both" ? "Both" : "Drawn", exact: true }).click();
  const card = p.locator(".item", { has: p.locator(".name", { hasText: new RegExp(who, "i") }) }).first();
  if (style !== "drawn") await card.locator("canvas.live").first().waitFor();
  await p.waitForTimeout(600);
  if (page) {
    // The cursor up and to the left of the characters, so every portrait looks somewhere.
    await p.mouse.move(20, 20);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: page });
    console.log(`wrote ${page}`);
  }
  const box = (await card.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.35;
  // Ahead (cursor far below: small look), then 8 directions.
  const spots: [number, number][] = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as [number, number])];
  const shots: Buffer[] = [];
  for (const [dx, dy] of spots) {
    await p.mouse.move(cx + dx * 420, cy + dy * 420);
    await p.waitForTimeout(1300);
    shots.push(await p.screenshot({ clip: box }));
  }
  const cols = 3;
  const w = Math.ceil(box.width);
  const h = Math.ceil(box.height);
  const tiles = shots.map((b, i) => `<image x="${(i % cols) * w}" y="${Math.floor(i / cols) * h}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString("base64")}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * cols}" height="${h * Math.ceil(shots.length / cols)}"><rect width="100%" height="100%" fill="#0b1020"/>${tiles.join("")}</svg>`;
  writeFileSync(out, new Resvg(svg).render().asPng());
  console.log(`wrote ${out} (${shots.length} looks)`);
} finally {
  await browser.close();
}
