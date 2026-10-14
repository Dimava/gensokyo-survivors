// gamebones/kds/vue: createGameKeys in Vue templates. Key hints that follow rebinds and the
// keyboard layout, and what a controls screen needs (rows, capture, notices, sets); the
// starter's Controls.vue is the example screen. The only kds module that imports Vue.

import { computed, getCurrentScope, onScopeDispose, shallowRef, type ComputedRef, type Ref } from "vue";
import type { Bind, Blocked, CaptureOptions, Rebound, Taken } from "./bindings.ts";
import type { GameKeys } from "./game.ts";

export interface BindingRow {
  id: string;
  label: string;
  group: string;
  fixed: boolean;
  /** Part names of a composite slot ("up", "left"...); empty for a button. */
  parts: string[];
  /** Bound binds (their keys) and their key-cap labels ("WASD", "P"). */
  binds: Bind[];
  labels: string[];
  isDefault: boolean;
}

export interface Capturing {
  id: string;
  index: number;
  /** Keys pressed so far (a composite takes one per part). */
  keys: string[];
  /** The part the next press is for ("up"), or undefined for a button. */
  part: string | undefined;
}

export interface UseGameKeys {
  /** Key-cap labels for a virtual code (`hint("Action:pause")`); re-renders on rebinds. */
  hint(code: string, max?: number): string[];
  /** A bind's key-cap label ("WASD"). */
  label(bind: Bind): string;
  /** One row per slot, for a controls screen. */
  rows: ComputedRef<BindingRow[]>;
  /** The rebind waiting for presses, or null. */
  capturing: Ref<Capturing | null>;
  /** What the last rebind took from other slots, for a notice. */
  taken: Ref<Taken[]>;
  /** Why the last rebind changed nothing, for a notice. */
  blocked: Ref<Blocked | null>;
  /** The game's named sets, and the one the binds match ("default", a name, or undefined: the player's own). */
  sets: string[];
  matching: ComputedRef<string | undefined>;
  /**
   * Waits for presses (one per part) and binds them at `index` (default: replaces the first bind;
   * past the end: adds one). A `clear` key (default Delete) pressed first removes the bind at
   * `index` instead; Back's keys cancel. Null when cancelled.
   */
  rebind(id: string, index?: number, opts?: CaptureOptions & { clear?: readonly string[] }): Promise<Rebound | null>;
  /** Stops a waiting rebind. */
  cancel(): void;
  unbind(id: string, index: number): Rebound;
  reset(id?: string): void;
  pick(set: string): void;
}

/** Call in setup (or at module level for app-wide hints). */
export function useGameKeys(keys: GameKeys): UseGameKeys {
  const b = keys.bindings;
  // Bumped on every change; reading it makes a computed or render depend on the bindings.
  const version = shallowRef(0);
  const off = b.subscribe(() => void version.value++);
  if (getCurrentScope()) onScopeDispose(off);

  const capturing = shallowRef<Capturing | null>(null);
  const taken = shallowRef<Taken[]>([]);
  const blocked = shallowRef<Blocked | null>(null);
  const report = (r: Rebound): Rebound => {
    taken.value = r.taken;
    blocked.value = r.blocked ?? null;
    return r;
  };

  const rows = computed(() => {
    void version.value;
    return b.slots.map(
      (s): BindingRow => ({
        id: s.id,
        label: s.label ?? s.id,
        group: s.group ?? "game",
        fixed: !!s.fixed,
        parts: s.parts?.map((p) => p.name) ?? [],
        binds: [...b.binds(s.id)],
        labels: b.binds(s.id).map(keys.bindLabel),
        isDefault: b.isDefault(s.id),
      }),
    );
  });

  return {
    hint(code, max) {
      void version.value;
      return keys.keyLabels(code, max);
    },
    label(bind) {
      void version.value;
      return keys.bindLabel(bind);
    },
    rows,
    capturing,
    taken,
    blocked,
    sets: Object.keys(b.sets),
    matching: computed(() => {
      void version.value;
      return b.matching();
    }),
    async rebind(id, index = 0, opts) {
      const parts = b.slot(id).parts?.map((p) => p.name);
      // By identity: a rebind started before this one ends must not clear this one's state.
      let mine: Capturing = { id, index, keys: [], part: parts?.[0] };
      capturing.value = mine;
      taken.value = [];
      blocked.value = null;
      const clear = opts?.clear ?? ["Delete"];
      try {
        const got = await b.capture({
          cancel: b.slots.some((s) => s.id === "Back") ? b.keys("Back") : undefined,
          ...opts,
          count: parts?.length ?? 1,
          single: clear,
          onPress(pressed) {
            if (capturing.value !== mine) return;
            capturing.value = mine = { ...mine, keys: [...pressed], part: parts?.[pressed.length] };
          },
        });
        if (got === null) return null;
        if (got.length === 1 && clear.includes(got[0]!)) return report(index < b.binds(id).length ? b.unbind(id, index) : { taken: [] });
        return report(b.bind(id, got, index));
      } finally {
        if (capturing.value === mine) capturing.value = null;
      }
    },
    cancel: () => b.stopCapture(),
    unbind: (id, index) => report(b.unbind(id, index)),
    reset: (id) => {
      b.reset(id);
      report({ taken: [] });
    },
    pick: (set) => {
      b.pick(set);
      report({ taken: [] });
    },
  };
}
