// Bullet styles and emitter definitions: the data half of danmaku. The code
// half (one function per pattern kind) is src/sim/patterns.ts. A new spell
// card built from existing kinds is rows only.

export interface BulletStyle {
  id: string;
  /** Collision radius against the player's hitbox. */
  radius: number;
  /** Drawn size (pixels across) and colours. */
  size: number;
  color: number;
  core: number;
  shape: "orb" | "rice" | "star" | "ice" | "knife" | "big";
}

export const BULLET_STYLES: readonly BulletStyle[] = [
  { id: "orb", radius: 4.5, size: 12, color: 0xff4d6d, core: 0xffffff, shape: "orb" },
  { id: "rice", radius: 3.5, size: 12, color: 0xffd23f, core: 0xffffff, shape: "rice" },
  { id: "star", radius: 4, size: 13, color: 0x7bd88f, core: 0xffffff, shape: "star" },
  { id: "ice", radius: 3.5, size: 13, color: 0x6fd3ff, core: 0xffffff, shape: "ice" },
  { id: "knife", radius: 3, size: 14, color: 0xc0c8e0, core: 0xffffff, shape: "knife" },
  { id: "big", radius: 9, size: 24, color: 0x4d7bff, core: 0xdfe8ff, shape: "big" },
  { id: "frozen", radius: 4, size: 12, color: 0xe8fbff, core: 0x6fd3ff, shape: "orb" },
];

export const STYLE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(BULLET_STYLES.map((s, i) => [s.id, i]));

export function styleIndex(id: string): number {
  const i = STYLE_INDEX[id];
  if (i === undefined) throw new Error(`unknown bullet style "${id}"; styles: ${BULLET_STYLES.map((s) => s.id).join(", ")}`);
  return i;
}

/** Speed profile shared by every pattern: start at `speed`, accelerate by `accel` per tick until `vEnd`. */
interface Motion {
  speed: number;
  accel?: number;
  vEnd?: number;
  style: string;
}

export interface RingParams extends Motion {
  n: number;
  /** Radians added to the ring's rotation each volley. */
  spin?: number;
  /** Aim the first bullet of the ring at the player. */
  aim?: boolean;
}
export interface AimedParams extends Motion {
  n: number;
  /** Total fan width in radians. */
  spread: number;
}
export interface SpiralParams extends Motion {
  arms: number;
  /** Radians the arms advance each volley. */
  step: number;
}
export interface BurstParams {
  n: number;
  speedMin: number;
  speedMax: number;
  style: string;
}
export interface RainParams {
  n: number;
  speedMin: number;
  speedMax: number;
  /** Half-width of the band the drops fall in, around the arena centre. */
  width: number;
  /** How far above the arena centre the drops start. */
  height: number;
  /** Sideways drift per tick. */
  drift?: number;
  style: string;
}
export interface FreezeParams {
  n: number;
  speedMin: number;
  speedMax: number;
  /** Ticks after spawn when the bullets stop, and when they start again in a new random direction. */
  stopAt: number;
  turnAt: number;
  v2: number;
  style: string;
  /** Style the bullets turn into while frozen (drawn), e.g. "frozen". */
  frozenStyle?: string;
}

export type EmitterDef = { every: number; offset?: number } & (
  | { pattern: "ring"; params: RingParams }
  | { pattern: "aimed"; params: AimedParams }
  | { pattern: "spiral"; params: SpiralParams }
  | { pattern: "burst"; params: BurstParams }
  | { pattern: "rain"; params: RainParams }
  | { pattern: "freeze"; params: FreezeParams }
);

export type PatternKind = EmitterDef["pattern"];
