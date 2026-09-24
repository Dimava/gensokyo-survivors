// Entry point of the simulation: creating and loading the kernel, and the
// typed helpers the adapters use to reach the current run. The text render
// used by tests lives in src/view/text-renderer.ts.
//
// Import order matters: this module imports meta.ts first, which pulls in the
// run and its overlays in an order where every scope type is defined before a
// parent's `children` needs it (see NOTES.md, module cycles).

import { createKernel, loadKernel, type Kernel, type Save, type View } from "gamebones";
import { Meta, newProfile } from "./meta.ts";
import type { RS0 } from "./run.ts";
import { Run } from "./rules.ts";

export type Game = Kernel<typeof Meta>;
export type RunPath = `/run:${string}`;

export function newGame(seed: string | number): Game {
  return createKernel(Meta, { seed, setup: (ctx) => newProfile(ctx) });
}

export function loadGame(save: Save): Game {
  return loadKernel(Meta, save);
}

export function activeRun(k: Game): RunPath | null {
  const p = k.view().derived("profile").profile.activeRun;
  return p ? (p as RunPath) : null;
}

export function runView(k: Game, path: RunPath): View<RS0> {
  return k.view(path) as unknown as View<RS0>;
}

export { Meta, Run };
