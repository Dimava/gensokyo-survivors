// Saving the kernel to localStorage. The save is the kernel's own snapshot
// (D30): meta progress, and the run in progress if there is one, so a reload
// resumes mid-run. A save that fails to load is kept aside, never silently
// overwritten.

import type { Save } from "gamebones";
import { loadGame, newGame, type Game } from "../sim/game.ts";

const KEY = "gensokyo-survivors/save";
const BROKEN = "gensokyo-survivors/save.broken";

export interface Loaded {
  game: Game;
  /** Set when a save existed but could not be loaded. */
  error?: string;
  fresh: boolean;
}

function randomSeed(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${a[0]!.toString(36)}${a[1]!.toString(36)}`;
}

export function loadOrCreate(): Loaded {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (!raw) return { game: newGame(randomSeed()), fresh: true };
  try {
    return { game: loadGame(JSON.parse(raw) as Save), fresh: false };
  } catch (e) {
    try {
      localStorage.setItem(BROKEN, raw);
    } catch {
      // nothing more we can do
    }
    return { game: newGame(randomSeed()), fresh: true, error: (e as Error).message };
  }
}

export function freshGame(): Game {
  return newGame(randomSeed());
}

let lastSize = 0;

export function save(k: Game): number {
  try {
    const text = JSON.stringify(k.save());
    localStorage.setItem(KEY, text);
    lastSize = text.length;
    return text.length;
  } catch {
    return -1;
  }
}

export function lastSaveSize(): number {
  return lastSize;
}

export function eraseSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
