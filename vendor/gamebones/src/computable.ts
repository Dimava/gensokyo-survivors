// Computable state (D32, D48): store parameters, evaluate at any tick.
// Nothing here is updated per tick; a rule that knows when something
// happens schedules it with `ctx.after`.

/** Parameters of a value that changes linearly from `base` at tick `t0`. */
export interface LinearParams {
  base: number;
  rate: number;
  t0: number;
}

export interface Linear extends LinearParams {
  /** The value at tick t. */
  at(t: number): number;
  /** The first integer tick >= t0 at which the value reaches `threshold` (>= when rising, <= when falling); null if never. */
  when(threshold: number): number | null;
}

export function linear(p: LinearParams): Linear {
  const at = (t: number): number => p.base + p.rate * (t - p.t0);
  const reached = (t: number, threshold: number): boolean => (p.rate >= 0 ? at(t) >= threshold : at(t) <= threshold);
  return {
    base: p.base,
    rate: p.rate,
    t0: p.t0,
    at,
    when(threshold) {
      if (reached(p.t0, threshold)) return p.t0;
      if (p.rate === 0) return null;
      // Analytic guess, then nudge by whole ticks so rounding cannot move the answer.
      let t = p.t0 + Math.max(0, Math.ceil((threshold - p.base) / p.rate));
      while (t > p.t0 && reached(t - 1, threshold)) t--;
      while (!reached(t, threshold)) t++;
      return t;
    },
  };
}

/** Parameters of a cooldown or countdown: ready from tick `readyAt` on. */
export interface TimerParams {
  readyAt: number;
}

export interface Timer extends TimerParams {
  ready(t: number): boolean;
  /** Ticks left until ready (0 when ready). */
  remaining(t: number): number;
  /** Fraction of a `total`-tick wait elapsed at t, clamped to [0, 1]; for cooldown rings. */
  progress(t: number, total: number): number;
  /** The tick it becomes ready. */
  when(): number;
}

export function timer(p: TimerParams): Timer {
  return {
    readyAt: p.readyAt,
    ready: (t) => t >= p.readyAt,
    remaining: (t) => Math.max(0, p.readyAt - t),
    progress: (t, total) => (total <= 0 ? 1 : Math.min(1, Math.max(0, 1 - (p.readyAt - t) / total))),
    when: () => p.readyAt,
  };
}

/** One segment of piecewise motion: from tick t0, position (x, y), velocity (vx, vy), acceleration (ax, ay). */
export interface Segment {
  t0: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax?: number;
  ay?: number;
}

export interface Path {
  readonly segments: readonly Segment[];
  /** Position at tick t (fractional t is fine for renderers); before the first segment, its start. */
  at(t: number): { x: number; y: number };
  /** Velocity at tick t. */
  velocity(t: number): { vx: number; vy: number };
}

export function path(segments: readonly Segment[]): Path {
  if (segments.length === 0) throw new Error("path: give at least one segment");
  for (let i = 1; i < segments.length; i++) {
    if (segments[i]!.t0 < segments[i - 1]!.t0) {
      throw new Error(`path: segment ${i} starts at t0=${segments[i]!.t0}, before segment ${i - 1}; sort segments by t0`);
    }
  }
  const segAt = (t: number): Segment => {
    let s = segments[0]!;
    for (const seg of segments) if (seg.t0 <= t) s = seg;
    return s;
  };
  return {
    segments,
    at(t) {
      const s = segAt(t);
      const dt = Math.max(0, t - s.t0);
      const ax = s.ax ?? 0;
      const ay = s.ay ?? 0;
      return { x: s.x + s.vx * dt + 0.5 * ax * dt * dt, y: s.y + s.vy * dt + 0.5 * ay * dt * dt };
    },
    velocity(t) {
      const s = segAt(t);
      const dt = Math.max(0, t - s.t0);
      return { vx: s.vx + (s.ax ?? 0) * dt, vy: s.vy + (s.ay ?? 0) * dt };
    },
  };
}
