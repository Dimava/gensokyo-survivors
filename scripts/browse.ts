// Drives the game in real headless Chrome (playwright-core + the installed
// Chrome): collects console errors and page errors, runs a named scenario,
// and writes screenshots to .shots/. Usage:
//   bun scripts/browse.ts <scenario> [url]
// Scenarios: menu, run, full (bot plays a whole run with turbo), meta.

import { chromium, type Page } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const scenario = process.argv[2] ?? "menu";
const base = process.argv[3] ?? "http://localhost:5190/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

mkdirSync(".shots", { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`[console.${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}\n${e.stack ?? ""}`));

async function shot(name: string): Promise<void> {
  await page.screenshot({ path: `.shots/${scenario}-${name}.png` });
  console.log(`shot ${name}`);
}
async function wait(ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}
async function gs<T>(fn: string): Promise<T> {
  return page.evaluate(`(() => { const g = window.__gs; ${fn} })()`) as Promise<T>;
}
async function clickText(text: string): Promise<void> {
  await page.getByText(text, { exact: false }).first().click();
}

async function run(p: Page): Promise<void> {
  void p;
  switch (scenario) {
    case "menu": {
      await page.goto(base);
      await wait(1500);
      await shot("title");
      await page.keyboard.press("Enter");
      await wait(800);
      await shot("menu");
      for (const [btn, name] of [
        ["Shrine Upgrades", "tree"],
        ["Skill Cards", "cards"],
        ["Card Packs", "packs"],
        ["Records", "records"],
        ["Settings", "settings"],
        ["How to Play", "help"],
      ] as const) {
        await clickText(btn);
        await wait(600);
        await shot(name);
        await page.keyboard.press("Escape");
        await wait(500);
      }
      break;
    }
    case "run": {
      await page.goto(base + "?screen=menu");
      await wait(1200);
      await clickText("Start Run");
      await wait(400);
      await shot("stagepick");
      await clickText("Go");
      await wait(500);
      await page.keyboard.down("KeyD");
      await wait(2500);
      await page.keyboard.up("KeyD");
      await page.keyboard.down("KeyS");
      await wait(2000);
      await page.keyboard.up("KeyS");
      await shot("early");
      await page.keyboard.press("Escape");
      await wait(400);
      await shot("pause");
      await page.keyboard.press("Escape");
      await wait(4000);
      await shot("later");
      break;
    }
    case "full": {
      await page.goto(base + "?screen=menu&bot=1&turbo=" + (process.env.TURBO ?? "8"));
      await wait(1200);
      await clickText("Start Run");
      await wait(300);
      await clickText("Go");
      const t0 = Date.now();
      let n = 0;
      while (Date.now() - t0 < Number(process.env.LIMIT ?? 240000)) {
        await wait(5000);
        const screen = await gs<string>("return g.state.screen;");
        n++;
        if (n % 4 === 0) await shot(`t${n}`);
        if (screen === "results") break;
      }
      await shot("results");
      break;
    }
    case "meta": {
      await page.goto(base + "?screen=menu");
      await wait(1000);
      // Give the profile donations through a real run is slow; use the debug handle to read state only.
      await clickText("Card Packs");
      await wait(500);
      await shot("packs");
      break;
    }
  }
}

try {
  await run(page);
} catch (e) {
  errors.push(`[script] ${(e as Error).message}`);
}
writeFileSync(`.shots/${scenario}-errors.txt`, errors.join("\n"));
console.log(errors.length ? `ERRORS (${errors.length}):\n${errors.slice(0, 20).join("\n")}` : "no console errors");
await browser.close();
