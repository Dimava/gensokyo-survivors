// Simulation constants. Distances are world pixels, times are ticks at 60 Hz.

export const TPS = 60;
export const sec = (s: number): number => Math.round(s * TPS);

/** Store capacities (memory is allocated up front). */
export const CAP = { enemies: 3000, drops: 4000, shots: 2000, bullets: 8000 } as const;

export const PLAYER = {
  /** Pixels per tick at 100% move speed. */
  speed: 2.4,
  /** Body radius for enemy contact. */
  body: 11,
  /** Danmaku hitbox radius (Touhou style: tiny). */
  hitbox: 3,
  /** Base graze radius (scaled by the graze stat). */
  graze: 20,
  /** Ticks of invulnerability after a hit. */
  invuln: 50,
  /** Bullets erased around the player after a bullet hit, so a hit is not a chain. */
  mercyRadius: 90,
} as const;

export const PICKUP = {
  /** Base magnet radius (scaled by the magnet stat). */
  magnet: 80,
  /** Collected within this distance. */
  collect: 16,
  /** Pulled items start at this speed and accelerate. */
  pullSpeed: 2.5,
  pullAccel: 0.35,
  pullMax: 14,
  /** Beyond this many drops, new experience merges into an existing gem. */
  softCap: 2500,
} as const;

export const SWARM = {
  /** Spawn ring around the player. */
  spawnMin: 720,
  spawnMax: 820,
  /** Enemies further than this are moved to the far side of the player. */
  leash: 1150,
  /** Spatial grid cell size. */
  cell: 48,
  /** Separation push between overlapping enemies (fraction of overlap per tick). */
  separation: 0.35,
  /** Hit flash lasts this many ticks (renderer). */
  flash: 6,
  /** Only enemies this close fire bullets. */
  shootRange: 560,
} as const;

export const XP = {
  /** Experience needed for level n -> n+1. */
  next: (level: number): number => (level < 20 ? 5 + (level - 1) * 10 : 195 + (level - 20) * 30),
} as const;

export const CARDS_TUNING = {
  /** Graze meter units per card. */
  meterPerCard: 100,
  /** Meter units per grazed bullet at 100% graze. */
  perGraze: 9,
  /** Spirit per tick at 100% spirit regen (0.25 per second). */
  spiritPerTick: 1 / 240,
} as const;

export const BOSS = {
  /** Radius of the boss arena around where the player stood when the boss arrived. */
  arena: 330,
  /** The boss hovers this far above the arena centre. */
  hover: 170,
  /** Ticks of the "WARNING" banner before the dialogue opens. */
  warning: 150,
  /** Ticks a spell card spends on its intro (boss invulnerable, no fire). */
  intro: 80,
  /** Pause between spell cards. */
  between: 70,
  /** Ticks from the last spell break to the stage clear. */
  outro: 150,
} as const;

export const HITSTOP = { hurt: 6, spellBreak: 14 } as const;

/** Ticks between the run ending (death or clear) and the results screen. */
export const END_DELAY = 100;

/** Run donations: per this many seconds survived, per this many kills. */
export const REWARD = { perSeconds: 8, perKills: 50 } as const;

/** Bullets further than this from the player (or the arena) are culled when checked. */
export const BULLET_CULL = 900;

/** Slots for weapons and passives in a run. */
export const SLOTS = { weapons: 4, passives: 4 } as const;
