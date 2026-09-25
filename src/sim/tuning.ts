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
  /** Graze radius. Fixed: the graze stat speeds up the card meter instead. */
  graze: 32,
  /** Ticks of invulnerability after a hit. */
  invuln: 50,
  /** Bullets erased around the player after a bullet hit, so a hit is not a chain. */
  mercyRadius: 90,
} as const;

/**
 * Focus (Shift), Touhou's slow mode: the sim hears it as the `focus` input
 * and gathers the weapons in. (The slow movement is the view's shorter `move`
 * vector, input.ts.) It also locks her facing (rules.ts movePlayer), so the
 * facing weapons stay on target while she strafes. Each factor multiplies the unfocused value.
 */
export const FOCUS = {
  /** Fans (amulets, needles): the spread between shots. */
  spread: 0.3,
  /** A ring (knives) folds into a fan of this width (radians) along the facing direction. */
  ringArc: 0.7,
  /** Fans and rings: shots fly faster, so they reach the aim line sooner. */
  shotSpeed: 1.15,
  /** Fans and rings: damage per shot, so gathering in is not strictly worse at clearing. */
  shotDmg: 1.15,
  /** Orbs circle this much closer, easing in and out over this many ticks (an ease-out). */
  orbitRadius: 0.55,
  ease: 16,
  /** Auras keep their radius and damage but shove enemies back this much harder. */
  auraKnock: 2.5,
  /** Beams: narrower, longer and harder. */
  beamWidth: 0.5,
  beamLength: 1.2,
  beamDmg: 1.25,
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

/**
 * The winds at the boss's approach: the swarm is blown away (no experience), and
 * the drops within `reach` of the player spiral in over `spiral` ticks; the rest blow away.
 */
export const WIND = {
  reach: 700,
  spiral: 90,
  /** Radians per tick the cyclone turns. */
  spin: 0.07,
  /** Blown enemies fly off at this speed (px per tick), growing by `accel` per tick. */
  speed: 3,
  accel: 0.3,
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

/** Formations (stages.ts beats) and enemy jobs (enemies.ts `move`). */
export const FORMATION = {
  /** Formations enter this far from the player: just outside a 1280x760 view. */
  edgeX: 700,
  edgeY: 440,
  /** Spacing in a line, nose to tail in a stream, and between the steps of a V. */
  lineGap: 70,
  streamGap: 72,
  veeGap: 52,
  /** Snipers' posts: distance from the player and the angle between neighbours. */
  postRadius: 250,
  postSpread: 0.42,
  /** A sniper is at its post within this distance; its first shot comes this many ticks later. */
  arrived: 14,
  firstShot: 20,
  /** Everyone else's first volley comes this many ticks after spawning: about when a formation enters the view. The whole formation fires together. */
  enterShot: 30,
  /** A sniper stops this many ticks before a salvo and stands still until its last volley. */
  windup: 20,
  /** In lines, streams and circles every this many enemies shoots; in a V, every this many ranks. */
  shooterEvery: 2,
  /** Mobs' slow bullets fade out after this many ticks (a midboss's live until they leave the field). */
  bulletLife: 270,
  /** Holding snipers drift after the player at this fraction of their speed. */
  holdDrift: 0.5,
  /** Orbit rings start at this radius. Orbiters, and snipers flying to their posts, may move this many times their speed to keep up. */
  circleRadius: 640,
  orbitCatchUp: 2.2,
  /** A midboss keeps station this far above the player, swaying this far sideways; she fires within this range. */
  hoverHeight: 210,
  hoverSway: 140,
  hoverFireRange: 420,
  /** Leaving enemies speed up by this factor and are gone past this distance; any non-chaser this far away is lost. */
  leaveSpeed: 1.4,
  gone: 900,
  lost: 2400,
} as const;

export const XP = {
  /** Experience per HP of an enemy's gem (EnemyDef.xpPerHp overrides it): tough enemies are worth their HP. */
  perHp: 0.3,
  /**
   * Experience needed for level n -> n+1: cheap at first, steeper as gems grow
   * with the enemies' HP (fitted so levels come at about the old times).
   */
  next: (level: number): number => Math.round(5 + 1.8 * (level - 1) ** 1.85),
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
  /**
   * Against a boss every upgrade keeps only this share of what it adds (a
   * weapon or passive may set its own `bossMulti`): weapon levels, might,
   * cooldown and amount for the damage she takes, max HP and armor for the
   * damage she deals. A strong build still beats her faster, not 10x faster.
   */
  upgradeShare: 0.4,
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

/**
 * Run donations: the swarm pays about 1 coin a second (time, kills and coin drops
 * together), a second of the boss fight 2, and each spell card its bonus (twice when captured).
 */
export const REWARD = {
  /** Swarm seconds per coin. */
  perSeconds: 2,
  /** Kills per coin. */
  perKills: 60,
  /** Coins per second of the boss fight. */
  bossPerSecond: 2,
} as const;

/** Bullets further than this from the player (or the arena) are culled when checked. */
export const BULLET_CULL = 900;
/** Bullets slower than this (px per tick) are "slow": given a life, they fade out (danmaku.ts). */
export const SLOW_BULLET = 2;

/** Slots for weapons and passives in a run. */
export const SLOTS = { weapons: 4, passives: 4 } as const;
