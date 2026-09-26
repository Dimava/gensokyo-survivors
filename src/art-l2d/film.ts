// The film: a sprite rig driven through the states the field puts it in,
// one row after another (standing, walking, stopping, turning, walking with
// focus, the hit, lying down, getting up), for the lab's film strips and arc
// traces (lab.ts), the animation checks (test/l2d-rig.test.ts) and the QA
// table (scripts/l2d-qa.ts). Pure: no DOM.

import type { Animator } from "./animator.ts";

/** A row of the film: its name, how to drive the animator at u (0..1 across the row), and its time step at u. */
export interface FilmRow {
  name: string;
  set: (a: Animator, u: number) => void;
  /** Seconds per step at u (default 1/60; 0 is a hit-stop). */
  dt?: (u: number) => number;
  /** Seconds run before the row is sampled. */
  settle?: number;
  /** How far the field tips her over at u (radians, + clockwise), as renderer.ts does when she is knocked out. */
  tip?: (a: Animator, u: number) => number;
}

const STILL = { x: 0, y: 0 };
/** The knock-out tip: onto her side about her feet (renderer.ts tipOver), 1.45 rad when down, jolted back on the recoil. */
const tipOver = (a: Animator) => (a.knock || 1) * (a.down * 1.45 - a.recoil * 0.12);

/**
 * The film's rows, run on one after another (the springs carry over, as in
 * a run): standing, walking right, stopping, turning round to walk left,
 * walking down, backpedalling with focus (facing right, moving left), the
 * hit (a hit-stop, then flung back), lying down, and getting up again.
 */
export const FILM: FilmRow[] = [
  { name: "stand", set: (a) => ((a.move = STILL), (a.target = { x: 0.2, y: 0.3 })), settle: 1 },
  { name: "walk right", set: (a) => ((a.move = { x: 1, y: 0 }), (a.target = { x: 0.8, y: 0 })), settle: 1 },
  { name: "stop", set: (a) => ((a.move = STILL), (a.target = { x: 0.3, y: 0.2 })) },
  { name: "turn to walk left", set: (a) => ((a.move = { x: -1, y: 0 }), (a.target = { x: -0.8, y: 0 })) },
  { name: "walk down", set: (a) => ((a.move = { x: 0, y: 1 }), (a.target = { x: 0, y: 0.8 })), settle: 0.5 },
  {
    name: "focus backpedal",
    set: (a) => {
      a.move = { x: -1, y: 0 };
      a.slow = true;
      a.face = { x: 1, y: 0 };
      a.target = { x: 0.8, y: 0 };
    },
    settle: 1,
  },
  {
    name: "hit",
    set: (a, u) => {
      a.move = STILL;
      a.slow = false;
      a.face = null;
      a.knock = 1;
      const w = Math.max(0, (u - 0.3) / 0.7);
      a.recoil = u < 0.3 ? 1 : 1 - 0.6 * w;
      a.down = 0.55 * w;
    },
    // The snap into the recoil, then the hit-stop (time frozen), as fx-death.ts plays it.
    dt: (u) => (u < 0.05 || u >= 0.3 ? 1 / 60 : 0),
    tip: tipOver,
  },
  { name: "down", set: (a, u) => ((a.recoil = 0.3 * Math.max(0, 1 - u * 4)), (a.down = Math.min(1, 0.55 + u * 3))), tip: tipOver },
  { name: "up again", set: (a, u) => ((a.recoil = 0), (a.down = Math.max(0, 1 - u * 2.2)), (a.knock = a.down > 0 ? 1 : 0), (a.target = { x: 0, y: 0.2 })), tip: tipOver },
];

/**
 * Step `anim` through `rows` at 60 fps, `span` seconds a row (after the row's
 * settling), calling `frame` after every step with the row, the step and u
 * (0..1 across the row).
 */
export function playFilm(anim: Animator, span: number, frame: (row: FilmRow, i: number, u: number) => void, rows: FilmRow[] = FILM): void {
  const steps = Math.max(1, Math.round(span * 60));
  for (const row of rows) {
    row.set(anim, 0);
    for (let i = 0; i < Math.round((row.settle ?? 0) * 60); i++) anim.step(1 / 60);
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      row.set(anim, u);
      anim.step(row.dt ? row.dt(u) : 1 / 60);
      frame(row, i, u);
    }
  }
}
