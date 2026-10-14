// Seeded RNG whose entire state is one uint32 stored in a scope's sys record,
// one per named stream (D12).
// mulberry32: tiny, fast, good enough for game logic; not cryptographic.

export function seedToState(seed: string | number): number {
  const str = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h >>>= 0;
  return h === 0 ? 0x9e3779b9 : h;
}

/** One mulberry32 step: returns a float in [0, 1) and the next state. */
export function nextFloat(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

export interface Rng {
  float(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(probability: number): boolean;
  /** In-place Fisher-Yates. */
  shuffle<T>(arr: T[]): void;
}

/** Rng facade over externally held state (a draft field, typically). */
export function makeRng(get: () => number, set: (state: number) => void): Rng {
  const float = (): number => {
    const [value, next] = nextFloat(get());
    set(next);
    return value;
  };
  return {
    float,
    int: (maxExclusive) => {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`rng.int: maxExclusive must be a positive integer, got ${maxExclusive}`);
      }
      return Math.floor(float() * maxExclusive);
    },
    pick: (arr) => {
      if (arr.length === 0) throw new Error("rng.pick: empty array");
      return arr[Math.floor(float() * arr.length)]!;
    },
    chance: (p) => float() < p,
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(float() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
    },
  };
}
