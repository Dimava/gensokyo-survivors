// The director: a process that plays a stage's script beat by beat, keeps background waves going
// under it, stops the script while a holding beat (a midboss) is up, and calls the end (the boss).
// Script time is clock time minus the time held; starting partway in holds a negative amount.
// It sleeps exactly until the next thing it has to do; only a hold is polled. All of it is process
// locals and the game's own rng, so a run replays identically.

import { done, wait } from "../define.ts";
import type { Ctx, ProcessDef, Spec } from "../types.ts";

/** A scripted moment, `at` ticks of script time from the start. */
export interface Beat {
  at: number;
}

/** Background waves every `every` ticks while script time is in [from, to). */
export interface Wave {
  from: number;
  to: number;
  every: number;
}

/** A stage's plan in ticks of the director's clock. Beats sorted by `at`. */
export interface DirectorPlan<B extends Beat, W extends Wave> {
  beats: readonly B[];
  waves?: readonly W[];
  /** Script time the end fires at (then the director is done). */
  end: number;
}

export interface DirectorLocals extends Record<string, unknown> {
  /** Next beat to play. */
  beat: number;
  /** Next beat to announce. */
  warned: number;
  /** Clock ticks the script has been held (negative after a skip). */
  held: number;
  /** When the current hold began. */
  heldFrom: number;
  /** Clock tick the next background wave is due. */
  waveAt: number;
}

export interface DirectorOptions<S extends Spec, B extends Beat, W extends Wave> {
  clock: S["clocks"];
  /** The stage's plan. Read on every wake, so keep it cheap (a table lookup). */
  plan(ctx: Ctx<S>): DirectorPlan<B, W>;
  /** Plays a beat (spawn a formation, show a banner). */
  beat(ctx: Ctx<S>, beat: B, index: number): void;
  /** Spawns one background wave (the game applies caps and weights; see `weighted`). */
  wave?(ctx: Ctx<S>, wave: W): void;
  /** Script time reached the plan's end (call the boss). */
  end(ctx: Ctx<S>): void;
  /** Stops the director quietly when false (the run is over). Checked on every wake. */
  running?(ctx: Ctx<S>): boolean;
  /**
   * Holding beats stop the script until `holding` turns false. Beats after one are not
   * announced until it is over, since their time is not known yet.
   */
  holds?(beat: B): boolean;
  holding?(ctx: Ctx<S>): boolean;
  /** Ticks between checks on `holding`. Default 20. */
  poll?: number;
  /** Announces each beat `ahead` ticks before it plays (`in`: ticks left, less after a skip). */
  warn?: { ahead: number; on(ctx: Ctx<S>, beat: B, inTicks: number): void };
}

/** Pass to `ctx.start(name, ...)` to start `skip` ticks into the script: the beats before it never play. */
export function skipTo(beats: readonly Beat[], skip: number): Partial<DirectorLocals> {
  const n = beats.filter((b) => b.at < skip).length;
  return { held: -skip, beat: n, warned: n };
}

/** Picks a key by weight with `roll` in [0, 1) (`ctx.rng(stream).float()`), in the object's key order. */
export function weighted<K extends string>(weights: Readonly<Record<K, number>>, roll: number): K {
  const entries = Object.entries(weights) as [K, number][];
  let left = roll * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) {
    left -= w;
    if (left < 0) return k;
  }
  return entries[0]![0];
}

export function director<S extends Spec, B extends Beat, W extends Wave = Wave>(opts: DirectorOptions<S, B, W>): ProcessDef<S, DirectorLocals> {
  const poll = opts.poll ?? 20;
  const holds = opts.holds ?? (() => false);
  const ahead = opts.warn?.ahead ?? 0;
  /** The next beat to announce, unless a holding beat comes first. */
  const toAnnounce = (beats: readonly B[], l: DirectorLocals): B | undefined => {
    for (let j = l.beat; j < l.warned; j++) if (holds(beats[j]!)) return undefined;
    return beats[l.warned];
  };

  return {
    clock: opts.clock,
    start: "script",
    locals: { beat: 0, warned: 0, held: 0, heldFrom: 0, waveAt: 0 },
    states: {
      script: (p, ctx) => {
        if (opts.running && !opts.running(ctx)) return done();
        const l = p.locals;
        const plan = opts.plan(ctx);
        const t = ctx.now(opts.clock);
        const st = t - l.held;
        if (st >= plan.end) {
          opts.end(ctx);
          return done();
        }
        if (opts.warn) {
          for (let b = toAnnounce(plan.beats, l); b && b.at - ahead <= st; b = toAnnounce(plan.beats, l)) {
            l.warned += 1;
            opts.warn.on(ctx, b, Math.max(0, b.at - st));
          }
        }
        while (l.beat < plan.beats.length && plan.beats[l.beat]!.at <= st) {
          const b = plan.beats[l.beat]!;
          const index = l.beat;
          l.beat += 1;
          if (l.warned < l.beat) l.warned = l.beat;
          opts.beat(ctx, b, index);
          if (holds(b)) {
            l.heldFrom = t;
            return wait(poll, "hold");
          }
        }
        const waves = plan.waves ?? [];
        const wave = waves.find((w) => st >= w.from && st < w.to);
        if (wave && t >= l.waveAt) {
          opts.wave?.(ctx, wave);
          l.waveAt = t + wave.every;
        }
        let next = plan.end - st;
        const b = plan.beats[l.beat];
        if (b) next = Math.min(next, b.at - st);
        const w = opts.warn && toAnnounce(plan.beats, l);
        if (w) next = Math.min(next, w.at - ahead - st);
        if (wave) next = Math.min(next, l.waveAt - t);
        else {
          // Between background waves: wake when the next one starts.
          const upcoming = waves.find((x) => x.from > st);
          if (upcoming) next = Math.min(next, upcoming.from - st);
        }
        return wait(Math.max(1, next));
      },
      // The script stops while a holding beat is up.
      hold: (p, ctx) => {
        if (opts.running && !opts.running(ctx)) return done();
        if (opts.holding?.(ctx)) return wait(poll);
        p.locals.held += ctx.now(opts.clock) - p.locals.heldFrom;
        return wait(1, "script");
      },
    },
  };
}
