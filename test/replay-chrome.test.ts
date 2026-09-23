// Determinism across engines: a session recorded by the bot in headless Chrome
// (scripts/browse.ts record) replays bit for bit under bun. The game runs with
// math: "portable" (D12), so V8 and JavaScriptCore agree on every value.

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { replay, type LogFile } from "gamebones";
import { Meta } from "../src/sim/meta.ts";
import { activeRun, runView } from "../src/sim/game.ts";

test("a Chrome-recorded run replays under bun with every hash matching", () => {
  const log = JSON.parse(readFileSync(new URL("./fixtures/chrome-run.json", import.meta.url), "utf8")) as LogFile;
  expect(log.engine.startsWith("chrome")).toBe(true);
  expect(log.math).toBe("portable");
  const t0 = performance.now();
  const k = replay(Meta, log);
  const ms = performance.now() - t0;
  const path = activeRun(k)!;
  const v = runView(k, path);
  const ticks = v.now("fixed");
  console.log(`chrome replay: ${log.records.length} records, ${ticks} ticks, ${JSON.stringify(log).length} bytes, replayed in ${ms.toFixed(0)} ms`);
  expect(ticks).toBeGreaterThan(3000);
  expect(v.derived("player").progress.kills).toBeGreaterThan(0);
});
