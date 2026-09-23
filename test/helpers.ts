// Shared fixtures for the milestone tests.

import { createKernel, type Kernel } from "gamebones";
import { Meta, newProfile } from "../src/sim/meta.ts";
import { MATH, activeRun, renderMeta, renderRun, runView, type Game, type RunPath } from "../src/sim/game.ts";
import { cardDef } from "../src/content/cards.ts";
import { styleIndex } from "../src/content/patterns.ts";
import { enemyIndex } from "../src/content/enemies.ts";

/** A profile with extra cards in the deck (scenario fixture, D38). */
export function fixtureGame(seed: string, opts: { cards?: string[]; coins?: number; tree?: Record<string, number>; onlyDeck?: boolean; sinceHigh?: number } = {}): Game {
  return createKernel(Meta, {
    seed,
    math: MATH,
    setup: (ctx) => {
      newProfile(ctx);
      if (opts.onlyDeck) for (const o of ctx.q("owned")) ctx.mut(o, "owned").inDeck = false;
      for (const id of opts.cards ?? []) {
        cardDef(id);
        ctx.spawn({ owned: { card: id, level: 1, copies: 1, inDeck: true, fresh: false } }, "owned");
      }
      if (opts.coins) ctx.mut(ctx.q("wallet")[0]!, "wallet").coins = opts.coins;
      if (opts.sinceHigh) ctx.mut(ctx.q("gacha")[0]!, "gacha").sinceHigh = opts.sinceHigh;
      if (opts.tree) ctx.mut(ctx.q("tree")[0]!, "tree").levels = { ...opts.tree };
    },
  });
}

/** Meta render plus the active run's render: what transcripts show after each step. */
export function render(k: Kernel<typeof Meta>): string {
  const path = activeRun(k);
  return path ? `${renderMeta(k)}\n${renderRun(k, path)}` : renderMeta(k);
}

/** Loads the run's stores up to a target load, outside any dispatch (perf fixtures only: not replayable). */
export function stress(k: Game, path: RunPath, enemies: number, bullets: number): void {
  const v = runView(k, path);
  const e = v.packed("enemies");
  const b = v.packed("bullets");
  const { body } = v.derived("player");
  const t = v.now("danmaku");
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = e.count; i < enemies; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 120 + rnd() * 600;
    e.add({ x: body.x + Math.cos(a) * d, y: body.y + Math.sin(a) * d, hp: 1e9, kind: enemyIndex("fairy"), uid: 1e6 + i, hitAt: -100, orbAt: -100, fireAt: 1e9 });
  }
  for (let i = b.count; i < bullets; i++) {
    const a = rnd() * Math.PI * 2;
    // Bullets circling at a distance, slowly: they stay on screen for the whole measurement.
    b.add({ x: body.x + Math.cos(a) * (200 + rnd() * 500), y: body.y + Math.sin(a) * (200 + rnd() * 500), t0: t, dx: Math.cos(a + 1.6), dy: Math.sin(a + 1.6), speed: 0.3, style: styleIndex("orb") });
  }
}

export function msPerTick(k: Game, path: RunPath, n: number): number {
  const p = path as "/run:1";
  for (let i = 0; i < 30; i++) k.tick(p, "fixed");
  const t0 = performance.now();
  for (let i = 0; i < n; i++) k.tick(p, "fixed");
  return (performance.now() - t0) / n;
}
