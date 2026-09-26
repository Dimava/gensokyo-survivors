// The stage director (a game-side stand-in for the kernel's missing
// Director/sequencing stdlib): a process on the action clock that plays the
// stage's script of formations beat by beat, keeps a thin background of
// chasers under it, waits out the midboss, and calls the boss. Script time is
// action time minus the time the midboss held the stage. It sleeps exactly
// until the next thing it has to do.

import { done, wait, type Ctx, type ProcessDef } from "gamebones";
import { ENEMIES, enemyIndex } from "../content/enemies.ts";
import { stageDef, type Beat, type WaveDef } from "../content/stages.ts";
import type { RS0 } from "./run.ts";
import { FORMATION, sec } from "./tuning.ts";
import { PHASE, spawnAround, spawnFormation } from "./swarm.ts";

type ProcessHelper = <L extends Record<string, unknown>>(def: ProcessDef<RS0, L>) => ProcessDef<RS0, L>;

/** Ticks between checks on whether the midboss is still up. */
const MIDBOSS_POLL = 20;

function countWhere(ctx: Ctx<RS0>, test: (kind: number, phase: number) => boolean): number {
  const e = ctx.packed("enemies");
  const kind = e.col("kind");
  const phase = e.col("phase");
  let n = 0;
  for (let i = 0; i < e.count; i++) if (test(kind[i]!, phase[i]!)) n++;
  return n;
}

const isChaser = (kind: number): boolean => ENEMIES[kind]!.move.kind === "chase";
/** A midboss still holding the stage (one who is retreating no longer does). */
const isMidboss = (kind: number, phase: number): boolean => ENEMIES[kind]!.midboss === true && phase !== PHASE.leaving;

/** The next beat to announce, unless a midboss comes first (the script stops for her, so what follows can't be timed yet). */
function toAnnounce(script: readonly Beat[], beat: number, warned: number): Beat | undefined {
  for (let j = beat; j < warned; j++) if (script[j]!.form === "midboss") return undefined;
  return script[warned];
}

function spawnWave(ctx: Ctx<RS0>, wave: WaveDef): void {
  const alive = countWhere(ctx, isChaser);
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
    start: "script",
    locals: { beat: 0, warned: 0, held: 0, heldFrom: 0, waveAt: 0 },
    states: {
      script: (p, ctx) => {
        const run = ctx.derived("state").run;
        if (run.phase !== "swarm") return done();
        const stage = stageDef(run.stage);
        const t = ctx.now("action");
        const st = t - p.locals.held;
        if (st >= sec(stage.bossAt)) {
          ctx.emit("boss:approach", {});
          return done();
        }
        // Announce each beat a moment before it enters (the view telegraphs it; play is unaffected).
        for (let beat = toAnnounce(stage.script, p.locals.beat, p.locals.warned); beat && sec(beat.at) - FORMATION.warn <= st; beat = toAnnounce(stage.script, p.locals.beat, p.locals.warned)) {
          p.locals.warned += 1;
          ctx.emit("formation:incoming", { enemy: beat.enemy, form: beat.form, side: "side" in beat ? beat.side : "", n: "n" in beat ? beat.n : 1, in: Math.max(0, sec(beat.at) - st) });
        }
        while (p.locals.beat < stage.script.length && sec(stage.script[p.locals.beat]!.at) <= st) {
          const beat = stage.script[p.locals.beat]!;
          p.locals.beat += 1;
          spawnFormation(ctx, beat, enemyIndex(beat.enemy));
          if (beat.banner) ctx.emit("banner", { text: beat.banner, tone: beat.form === "midboss" || beat.enemy === "bigfairy" ? "warn" : "info" });
          if (beat.form === "midboss") {
            ctx.emit("midboss:entered", { kind: enemyIndex(beat.enemy) });
            p.locals.heldFrom = t;
            return wait(MIDBOSS_POLL, "midboss");
          }
        }
        const secs = st / 60;
        const wave = stage.waves.find((w) => secs >= w.from && secs < w.to);
        if (wave && t >= p.locals.waveAt) {
          spawnWave(ctx, wave);
          p.locals.waveAt = t + wave.every;
        }
        let next = sec(stage.bossAt) - st;
        const beat = stage.script[p.locals.beat];
        if (beat) next = Math.min(next, sec(beat.at) - st);
        const warn = toAnnounce(stage.script, p.locals.beat, p.locals.warned);
        if (warn) next = Math.min(next, sec(warn.at) - FORMATION.warn - st);
        if (wave) next = Math.min(next, p.locals.waveAt - t);
        else {
          // Between background waves: wake when the next one starts.
          const upcoming = stage.waves.find((w) => w.from > secs);
          if (upcoming) next = Math.min(next, sec(upcoming.from) - st);
        }
        return wait(Math.max(1, next));
      },
      // The script clock stops while the midboss is up; she is defeated or leaves on her own.
      midboss: (p, ctx) => {
        const run = ctx.derived("state").run;
        if (run.phase !== "swarm") return done();
        if (countWhere(ctx, isMidboss) > 0) return wait(MIDBOSS_POLL);
        p.locals.held += ctx.now("action") - p.locals.heldFrom;
        return wait(1, "script");
      },
    },
  });
}
