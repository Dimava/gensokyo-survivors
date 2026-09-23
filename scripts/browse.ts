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
    case "record": {
      // A Chrome session's log for the cross-engine replay test: the bot plays about a minute.
      await page.goto(base + "?screen=menu&bot=1&turbo=2");
      await wait(1000);
      await clickText("Start Run");
      await wait(300);
      await clickText("Go");
      for (;;) {
        await wait(2000);
        const t = await gs<number>("const p = g.host.path(); return p ? g.host.k.view(p).now('fixed') : -1;");
        if (t < 0 || t > 60 * 60) break;
      }
      await page.keyboard.press("Escape");
      await wait(300);
      const log = await gs<string>("return JSON.stringify(g.host.k.log());");
      mkdirSync("test/fixtures", { recursive: true });
      writeFileSync("test/fixtures/chrome-run.json", log);
      console.log(`log: ${log.length} bytes, engine ${JSON.parse(log).engine}, ${JSON.parse(log).records.length} records`);
      await shot("paused");
      break;
    }
    case "tour": {
      // A guided tour through every screen with a rich profile (scripts/richsave.ts).
      const saveText = (await Bun.file(".tmp/save-rich.json").text()).replaceAll("\\", "\\\\").replaceAll("`", "\`");
      await page.addInitScript(`if (!sessionStorage.getItem("seeded")) { localStorage.setItem("gensokyo-survivors/save", \`${saveText}\`); localStorage.removeItem("gensokyo-survivors/prefs"); sessionStorage.setItem("seeded", "1"); }`);
      await page.goto(base + "?screen=menu&turbo=" + (process.env.TURBO ?? "3"));
      await wait(1200);
      await shot("menu");
      await clickText("Start Run");
      await wait(300);
      await clickText("Go");
      await page.keyboard.down("KeyD");
      await wait(1500);
      await shot("tip");
      await page.keyboard.up("KeyD");
      await gs("g.host.autoplay = true;");
      const until = async (cond: string, ms: number): Promise<boolean> => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
          if (await gs<boolean>(cond)) return true;
          await wait(150);
        }
        return false;
      };
      const phase = "const p = g.host.path(); return p ? g.host.k.view(p).q('run')[0].run";
      await until(`${phase}.overlay === 'none' && g.host.k.view(p).now('action') > 3600 : false;`, 120000);
      await shot("swarm");
      await gs("g.host.autoplay = false;");
      if (await until(`${phase}.overlay === 'levelup' : false;`, 60000)) {
        await wait(400);
        await shot("levelup");
        await page.keyboard.press("Digit1");
        await wait(300);
      }
      await gs("g.host.autoplay = true;");
      await until(`${phase}.phase === 'warning' : false;`, 200000);
      await gs("g.host.autoplay = false;");
      await wait(300);
      await shot("warning");
      await until(`${phase}.overlay === 'vn' : false;`, 30000);
      await wait(900);
      await shot("dialogue");
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Space");
        await wait(150);
      }
      await gs("g.host.autoplay = true;");
      await wait(4000);
      await shot("boss-intro");
      await wait(5000);
      await shot("boss");
      await gs("g.host.autoplay = false;");
      await page.keyboard.press("Digit1");
      await wait(250);
      await shot("card");
      await gs("g.host.autoplay = true;");
      await wait(6000);
      await shot("boss2");
      await until("return g.state.screen === 'results';", 240000);
      await wait(1500);
      await shot("results");
      await clickText("Shrine Upgrades");
      await wait(500);
      const buyable = page.locator(".node.buyable").first();
      if (await buyable.count()) {
        await buyable.click();
        await wait(200);
        await page.locator(".btn.buy").click();
        await wait(250);
      }
      await shot("tree-bought");
      await page.keyboard.press("Escape");
      await wait(300);
      await clickText("Card Packs");
      await wait(400);
      await page.locator(".btn.buy").click();
      await wait(700);
      await shot("pack-dealt");
      await wait(900);
      await shot("pack-charging");
      await page.mouse.click(640, 100);
      await wait(1600);
      await shot("pack-mid");
      await until("return !!document.querySelector('.opening .btn.primary');", 15000);
      await wait(500);
      await shot("pack-done");
      await page.keyboard.press("Space");
      await wait(500);
      await shot("packs-after");
      await page.keyboard.press("Escape");
      await wait(300);
      await clickText("Skill Cards");
      await wait(500);
      await shot("cards");
      await page.keyboard.press("Escape");
      await wait(300);
      // Reload mid-run: the run comes back, paused.
      await clickText("Start Run");
      await wait(300);
      await clickText("Go");
      await wait(3000);
      await page.reload();
      await wait(1500);
      await shot("reloaded");
      await page.keyboard.press("Escape");
      await wait(1500);
      await shot("resumed");
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
