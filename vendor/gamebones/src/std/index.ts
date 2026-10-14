// gamebones/std: game-agnostic helpers built on the kernel's public surface only.
// Each module is optional; a game imports what it uses.

export { record, toJsonl } from "./recorder.ts";
export type { Recorder, RecorderOptions, RunEntry, SumProbe } from "./recorder.ts";
export { delay } from "./delay.ts";
export type { Delay, DelayOptions, SavedDelay } from "./delay.ts";
export { Grid } from "./spatial.ts";
export { director, skipTo, weighted } from "./director.ts";
export type { Beat, DirectorLocals, DirectorOptions, DirectorPlan, Wave } from "./director.ts";
export { persist } from "./persist.ts";
export type { Persist, PersistOptions, SaveInfo, Tier } from "./persist.ts";
export { drive } from "./drive.ts";
export type { DriveOptions } from "./drive.ts";
