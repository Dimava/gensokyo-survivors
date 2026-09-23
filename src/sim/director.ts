// The stage director (a game-side stand-in for the kernel's missing
// Director/sequencing stdlib): a process on the action clock that reads the
// stage's wave table, spawns groups while under the cap, fires set pieces at
// their times, and calls the boss. It sleeps exactly until the next thing it
// has to do.

import { done, wait, type Ctx, type ProcessDef } from "gamebones";
import { enemyIndex } from "../content/enemies.ts";
import { stageDef, type WaveDef } from "../content/stages.ts";
import type { RS0 } from "./run.ts";
import { sec } from "./tuning.ts";
import { spawnAround, spawnRing, spawnRush } from "./swarm.ts";

type ProcessHelper = <L extends Record<string, unknown>>(def: ProcessDef<RS0, L>) => ProcessDef<RS0, L>;

function spawnWave(ctx: Ctx<RS0>, wave: WaveDef): void {
  const alive = ctx.packed("enemies").count;
  if (alive >= wave.cap) return;
  const kinds = Object.entries(wave.kinds);
  const total = kinds.reduce((s, [, w]) => s + w, 0);
  const r = ctx.rng("spawn");
  const n = Math.min(wave.count, wave.cap - alive);
  for (let i = 0; i < n; i++) {
    let roll = r.float() * total;
    let pick = kinds[0]![0];
    for (const [id, w] of kinds) {
      roll -= w;
      if (roll < 0) {
        pick = id;
        break;
      }
    }
    spawnAround(ctx, enemyIndex(pick), 1);
  }
}

export function directorProcess(process: ProcessHelper) {
  return process({
    clock: "action",
    start: "swarm",
    locals: { piece: 0 },
    states: {
      swarm: (p, ctx) => {
        const run = ctx.derived("state").run;
        if (run.phase !== "swarm") return wait(1, "boss");
        const stage = stageDef(run.stage);
        const t = ctx.now("action");
        if (t >= sec(stage.bossAt)) {
          ctx.emit("boss:approach", {});
          return wait(1, "boss");
        }
        while (p.locals.piece < stage.setPieces.length && sec(stage.setPieces[p.locals.piece]!.at) <= t) {
          const piece = stage.setPieces[p.locals.piece]!;
          const kind = enemyIndex(piece.enemy);
          if (piece.kind === "ring") spawnRing(ctx, kind, piece.n, piece.radius);
          else if (piece.kind === "rush") spawnRush(ctx, kind, piece.n);
          else spawnAround(ctx, kind, piece.n);
          if (piece.banner) ctx.emit("banner", { text: piece.banner, tone: piece.kind === "elite" ? "warn" : "info" });
          p.locals.piece += 1;
        }
        const secs = t / 60;
        const wave = stage.waves.find((w) => secs >= w.from && secs < w.to) ?? stage.waves[stage.waves.length - 1]!;
        spawnWave(ctx, wave);
        let next = wave.every;
        const piece = stage.setPieces[p.locals.piece];
        if (piece) next = Math.min(next, sec(piece.at) - t);
        next = Math.min(next, sec(stage.bossAt) - t);
        return wait(Math.max(1, next));
      },
      // During the boss: a thin trickle, only while the fight is on.
      boss: (_, ctx) => {
        const run = ctx.derived("state").run;
        if (run.phase === "cleared" || run.phase === "over") return done();
        const stage = stageDef(run.stage);
        if (run.phase === "boss") spawnWave(ctx, stage.bossWave);
        return wait(stage.bossWave.every);
      },
    },
  });
}
