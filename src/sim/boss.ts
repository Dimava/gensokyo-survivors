// The boss: computable movement, and one process per spell card that fires
// the card's emitters on schedule. Breaking, timing out and the next card are
// rules (rules.ts); the process only shoots and moves.

import { wait, done, type Ctx, type EntityOf, type ProcessDef } from "gamebones";
import { bossDef } from "../content/bosses.ts";
import type { RS0 } from "./run.ts";
import { emitPattern } from "./danmaku.ts";
import { BOSS } from "./tuning.ts";

type BossEntity = EntityOf<RS0> & {
  readonly boss: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
    readonly t0: number;
    readonly t1: number;
    readonly sway: boolean;
    readonly hp: number;
    readonly invulnUntil: number;
    readonly spell: number;
    readonly results: readonly string[];
    readonly late: boolean;
  };
};

/** Boss position at tick t (fractional t is fine): an eased move plus an optional sway. */
export function bossPos(boss: BossEntity, t: number, out: { x: number; y: number }): void {
  const b = boss.boss;
  const span = Math.max(1, b.t1 - b.t0);
  let s = (t - b.t0) / span;
  s = s < 0 ? 0 : s > 1 ? 1 : s;
  s = s * s * (3 - 2 * s);
  out.x = b.x0 + (b.x1 - b.x0) * s + (b.sway ? 110 * Math.sin(t * 0.018) : 0);
  out.y = b.y0 + (b.y1 - b.y0) * s;
}

/** The boss takes damage only during a spell card that is not yet broken, after its intro. */
export function bossVulnerable(boss: BossEntity, t: number): boolean {
  const b = boss.boss;
  return b.hp > 0 && t >= b.invulnUntil && b.results.length === b.spell;
}

type ProcessHelper = <L extends Record<string, unknown>>(def: ProcessDef<RS0, L>) => ProcessDef<RS0, L>;

const bp = { x: 0, y: 0 };

/** One spell card: intro, then fire every emitter on its period until the timer ends. */
export function spellProcess(process: ProcessHelper) {
  return process({
    clock: "action",
    start: "intro",
    locals: { index: 0, next: [] as number[], volley: [] as number[], moveAt: 0 },
    states: {
      intro: () => wait(BOSS.intro, "fire"),
      fire: (p, ctx) => {
        const boss = ctx.derived("boss");
        if (!boss) return done();
        const spell = bossDef(boss.boss.id).spells[p.locals.index]!;
        const t = ctx.now("action");
        if (p.locals.next.length === 0) {
          p.locals.next = spell.emitters.map((e) => t + (e.offset ?? 0));
          p.locals.volley = spell.emitters.map(() => 0);
          p.locals.moveAt = t;
        }
        // The bonus timer ran out: the card goes on (it must still be broken), without its bonus.
        if (t >= boss.boss.spellEnd && !boss.boss.late) ctx.emit("spell:late", { index: p.locals.index });
        bossPos(boss, t, bp);
        spell.emitters.forEach((em, k) => {
          while (p.locals.next[k]! <= t) {
            emitPattern(ctx, em, bp.x, bp.y, p.locals.volley[k]!);
            p.locals.volley[k]! += 1;
            // Past the bonus timer the boss grows desperate: every emitter fires a third faster.
            p.locals.next[k]! += boss.boss.late ? Math.max(1, Math.round(em.every * 0.66)) : em.every;
          }
        });
        if (spell.move === "wander" && t >= p.locals.moveAt) {
          wander(ctx, boss, t);
          p.locals.moveAt = t + 160;
        }
        let wake = boss.boss.late || t >= boss.boss.spellEnd ? Infinity : boss.boss.spellEnd;
        for (const n of p.locals.next) wake = Math.min(wake, n);
        if (spell.move === "wander") wake = Math.min(wake, p.locals.moveAt);
        return wait(Math.max(1, wake - t));
      },
    },
  });
}

/** Picks a new point in the upper part of the arena and glides there. */
function wander(ctx: Ctx<RS0>, boss: BossEntity, t: number): void {
  const run = ctx.derived("state").run;
  const r = ctx.rng("boss");
  bossPos(boss, t, bp);
  const b = ctx.mut(boss, "boss");
  b.x0 = bp.x;
  b.y0 = bp.y;
  b.x1 = run.ax + (r.float() * 2 - 1) * 180;
  b.y1 = run.ay - BOSS.hover + (r.float() * 2 - 1) * 60;
  b.t0 = t;
  b.t1 = t + 90;
  b.sway = false;
}

export function bossDefOf(boss: { boss: { id: string } }) {
  return bossDef(boss.boss.id);
}
