// Every animation tempo of the rigged art in one table, calm and
// pixel-game-like: slow cycles, frames held long. All rates are per second
// and scale with TEMPO; on top of that the view multiplies time by the
// player's "animation speed" setting (prefs.animSpeed), live.

/** One knob for the whole set. */
export const TEMPO = 1;

const t = (v: number) => v * TEMPO;

export const RATE = {
  /** Strides per second: walking, and walking slowly (focus). The bob is twice per stride. */
  walk: t(1.1),
  slowWalk: t(0.6),
  /** Exponential easing rates: head and eyes toward the look, gait weights between stand/walk/slow. */
  headFollow: t(3),
  eyeFollow: t(9),
  gaitBlend: t(5),
  /** Breathing (rad/s: a 4.5 s breath). */
  breath: t(1.4),
  /** Idle drift of the look and the head tilt (rad/s). */
  driftX: t(0.7),
  driftY: t(0.53),
  tilt: t(0.9),
  /** Talking mouth: two sines multiplied (rad/s), about 3.5 flaps a second. */
  talkA: t(11),
  talkB: t(3.4),
};

/** Blinks: seconds to close and to open, and the random wait between blinks. */
export const BLINK = {
  close: 0.09 / TEMPO,
  open: 0.18 / TEMPO,
  minWait: 3 / TEMPO,
  maxWait: 7 / TEMPO,
};

/** Idle cycles per second of each field sprite (wing flaps and bobbing; the orb's spin). */
export const IDLE: Record<string, number> = {
  reimu: t(0.6),
  cirno: t(0.8),
  rumia: t(0.5),
  fairy: t(1),
  icefairy: t(1),
  sunflower: t(0.9),
  kedama: t(1),
  phantom: t(0.7),
  shade: t(0.7),
  duskfairy: t(0.8),
  daiyousei: t(0.8),
  bigfairy: t(0.7),
  yinyang: t(0.35),
};
