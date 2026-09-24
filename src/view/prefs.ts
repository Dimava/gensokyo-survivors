// Player preferences and tutorial progress: device-local UI state, kept out
// of the simulation (it never affects a run) and out of the kernel save, in
// its own localStorage key.

import { reactive, watch } from "vue";

/** Character art: the drawn SVG art or the rigged, animated models (the default). */
export type ArtStyle = "drawn" | "live2d";

export interface Prefs {
  master: number;
  sfx: number;
  music: number;
  /** Speed of UI and effect animations: 0.5 (slow) to 2 (fast). */
  animSpeed: number;
  /** Screen shake strength 0..1. */
  shake: number;
  /** Show the hint bar during runs. */
  hints: boolean;
  /** Tutorial hints already completed. */
  seen: string[];
  /** Show the frame-time readout in the corner. */
  fps: boolean;
  artStyle: ArtStyle;
}

const KEY = "gensokyo-survivors/prefs";

const DEFAULTS: Prefs = { master: 0.8, sfx: 0.8, music: 0.5, animSpeed: 1, shake: 1, hints: true, seen: [], fps: false, artStyle: "live2d" };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, seen: [] };
    const data = JSON.parse(raw) as Partial<Prefs>;
    // A stored choice stands; no (or an unknown) choice gets the default.
    const artStyle: ArtStyle = data.artStyle === "drawn" || data.artStyle === "live2d" ? data.artStyle : DEFAULTS.artStyle;
    return { ...DEFAULTS, ...data, artStyle, seen: Array.isArray(data.seen) ? data.seen.filter((s) => typeof s === "string") : [] };
  } catch {
    return { ...DEFAULTS, seen: [] };
  }
}

export const prefs = reactive<Prefs>(load());

watch(
  prefs,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Storage full or blocked: preferences just do not persist.
    }
  },
  { deep: true },
);

export function markSeen(hint: string): void {
  if (!prefs.seen.includes(hint)) prefs.seen.push(hint);
}

export function resetPrefs(): void {
  Object.assign(prefs, { ...DEFAULTS, seen: [] });
}

/** Seconds scaled by the animation speed setting. */
export function anim(seconds: number): number {
  return seconds / prefs.animSpeed;
}
