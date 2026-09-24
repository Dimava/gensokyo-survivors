// Shared fixtures for the milestone tests.

import { createKernel, type Kernel } from "gamebones";
import { Meta, newProfile } from "../src/sim/meta.ts";
import { MATH, activeRun, renderMeta, renderRun, type Game, type RunPath } from "../src/sim/game.ts";
import { cardDef } from "../src/content/cards.ts";
export { stress } from "../src/sim/stress.ts";

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

export function msPerTick(k: Game, path: RunPath, n: number): number {
  const p = path as "/run:1";
  for (let i = 0; i < 30; i++) k.tick(p, "fixed");
  const t0 = performance.now();
  for (let i = 0; i < n; i++) k.tick(p, "fixed");
  return (performance.now() - t0) / n;
}
