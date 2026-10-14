// Runtime shapes behind the typed builder. Authors never touch these; the
// kernel reads them. Kept apart from types.ts so the public types stay
// readable.

import type { z } from "zod";
import type { PackedStore } from "./packed.ts";
import type { AnyScope, ClockDecl, EventDef, Migration, Phase } from "./types.ts";

// oxlint-disable-next-line no-explicit-any -- rule bodies are stored untyped and called by the kernel
export type AnyFn = (...args: any[]) => any;

/** One rule, as returned by the `r` builder. Opaque to authors. */
export interface RuleDef {
  readonly kind: "rule";
  readonly event: string;
  readonly phase: Phase;
  readonly priority: number;
  readonly when: unknown;
  readonly fn: AnyFn;
  readonly label: string;
  /** Set for rules registered with `r.named(...)`: they run only through triggers. */
  readonly named: string | undefined;
  readonly params: z.ZodType | undefined;
}

export interface ProcessRT {
  readonly clock: string;
  readonly start: string;
  readonly locals: unknown;
  readonly states: Record<string, AnyFn>;
}

export interface RelationRT {
  readonly name: string;
  readonly comp: string;
  readonly ordered: string | undefined;
  readonly onDelete: "remove" | "despawn";
}

export interface ScopeRT {
  readonly name: string;
  readonly components: Record<string, z.ZodType>;
  readonly events: Record<string, EventDef>;
  readonly clocks: Record<string, ClockDecl>;
  readonly rng: readonly string[];
  readonly packed: Record<string, () => PackedStore>;
  readonly relations: Record<string, RelationRT>;
  readonly children: Record<string, AnyScope>;
  readonly logged: boolean;
  readonly saved: boolean;
  readonly derived: Record<string, AnyFn>;
  readonly exports: AnyFn | undefined;
  readonly options: Record<string, AnyFn>;
  readonly processes: Record<string, ProcessRT>;
  readonly rules: readonly RuleDef[];
  readonly migrations: readonly Migration[];
}
