// gamebones v2: a deterministic game kernel. See README.md for the manual.

export { defineScope, input, event, ref, relation, trigger, wait, until, done, isRef } from "./define.ts";
export type { ScopeConfig } from "./define.ts";
export {
  createKernel,
  loadKernel,
  replay,
  withHashChain,
  SAVE_FORMAT,
  LOG_FORMAT,
  CHECKPOINT_EVERY,
} from "./kernel.ts";
export type {
  Kernel,
  KernelOptions,
  DispatchResult,
  TraceNode,
  Change,
  Rejection,
  StoreNote,
  Save,
  LogFile,
  LogRecord,
  KernelListener,
  DispatchInfo,
  ProbeEvent,
} from "./kernel.ts";
export { harness, formatTrace, fmtChange, fmtPayload } from "./harness.ts";
export type { Harness, HarnessOptions } from "./harness.ts";
export { columns } from "./packed.ts";
export type { PackedStore, Columns, ColumnsOptions, SavedColumn, SavedColumns } from "./packed.ts";
export { linear, timer, path } from "./computable.ts";
export type { Linear, LinearParams, Timer, TimerParams, Path, Segment } from "./computable.ts";
export { canonicalJson, fnv1a, fnv1aBytes, hashValue, toBase64, fromBase64 } from "./hash.ts";
export type { Rng } from "./rng.ts";
export type {
  AnyScope,
  ClockDecl,
  Ctx,
  DeepReadonly,
  Entity,
  EntityOf,
  EventDef,
  EventName,
  ExportsOf,
  Id,
  InputEvent,
  Json,
  Matcher,
  Migration,
  ModifyCtx,
  Payload,
  PayloadIn,
  Phase,
  ProcHandle,
  ProcessDef,
  RefSchema,
  RelationDef,
  RuleBuilder,
  RuleChain,
  SavedScope,
  ScopeData,
  ScopeType,
  Spec,
  SpecAt,
  SpecOf,
  StepResult,
  TriggerRow,
  TriggerSelf,
  TypeAt,
  UserEvent,
  View,
  With,
} from "./types.ts";
export type { RuleDef } from "./runtime.ts";
