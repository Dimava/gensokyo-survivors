// Rebinding (kds I3): actions (slots) bound to keys, each slot mapping its keys to one virtual
// event ({ code: "Move", x: 0, y: -1 }, { code: "Action:pause" }). A bind is a key for a button,
// or a composite for a slot with parts: WASD is one bind of Move (a quad: up, left, down, right),
// not four. The player's rebinds are overrides layered on the defaults, saved as JSON by the game.
// The binds become ordinary kds mappers, so hints (keysFor) and handlers see the rebinds with
// nothing else to update.

import type { Kds, KdsEvent, KdsPlugin } from "./kds.ts";

/** One key of a composite: its name on a controls screen and what it adds to the slot's event. */
export interface Part {
  name: string;
  to: Record<string, unknown>;
}

/** Up, left, down, right: a 2D axis (x, y). */
export const QUAD: readonly Part[] = [
  { name: "up", to: { x: 0, y: -1 } },
  { name: "left", to: { x: -1, y: 0 } },
  { name: "down", to: { x: 0, y: 1 } },
  { name: "right", to: { x: 1, y: 0 } },
];

/** Negative, positive: a 1D axis (x). */
export const PAIR: readonly Part[] = [
  { name: "−", to: { x: -1 } },
  { name: "+", to: { x: 1 } },
];

/**
 * Known composites by name, their keys in part order. A composite captured key by key is named
 * after the one it matches, in saves and on screen. Games may add their own.
 */
export const composites: Record<string, readonly string[]> = {
  KeyWASD: ["KeyW", "KeyA", "KeyS", "KeyD"],
  ArrowXY: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
  KeyESDF: ["KeyE", "KeyS", "KeyD", "KeyF"],
  KeyIJKL: ["KeyI", "KeyJ", "KeyK", "KeyL"],
  Numpad8456: ["Numpad8", "Numpad4", "Numpad5", "Numpad6"],
  KeyQE: ["KeyQ", "KeyE"],
  KeyAD: ["KeyA", "KeyD"],
  KeyWS: ["KeyW", "KeyS"],
  ArrowX: ["ArrowLeft", "ArrowRight"],
  ArrowY: ["ArrowUp", "ArrowDown"],
};

/** A bind as written: a key, a composite's name, or a composite's keys. */
export type Bindable = string | readonly string[];
/** A bind resolved: its keys, one for a button. */
export type Bind = readonly string[];

/** The name of a known composite with these keys, if any. */
export function compositeName(keys: Bind): string | undefined {
  if (keys.length < 2) return undefined;
  return Object.keys(composites).find((name) => same(composites[name]!, keys));
}

export interface Slot {
  /** Stable id, the key in saved overrides: "Move", "Confirm", "Action:pause". */
  id: string;
  /** What its keys become: at least a code; extra fields are assigned too. */
  to: { code: string } & Record<string, unknown>;
  /** A composite slot's parts (QUAD, PAIR); each bind then has one key per part. Absent: a button. */
  parts?: readonly Part[];
  /** Default binds, the first being the one hints show first. */
  binds: readonly Bindable[];
  /** For a controls screen. Default the id. */
  label?: string;
  /** A key is taken from other slots of the same group when rebound. Default "game". */
  group?: string;
  /** Shown, not rebindable. */
  fixed?: boolean;
  /** Never left without a bind (Confirm, Back: the way through the menus). */
  keep?: boolean;
}

/** Slot id to its binds, for the slots that differ; also the shape of a named set. */
export type Overrides = Record<string, Bindable[]>;

/** A bind a rebind took from another slot. */
export interface Taken {
  slot: string;
  bind: Bind;
}

/** Why a rebind was refused: a key inside another slot's composite, or a slot's last bind. */
export interface Blocked {
  slot: string;
  bind: Bind;
  reason: "composite" | "last";
}

/** What a rebind did: the binds it took, or why nothing changed. */
export interface Rebound {
  taken: Taken[];
  blocked?: Blocked;
}

export interface CaptureOptions {
  /** Keys that cancel instead of binding (resolve null). Default ["Escape"]. */
  cancel?: readonly string[];
  /** Presses to collect: a composite's part count. Default 1. */
  count?: number;
  /** Keys that end the capture at once when pressed first (a Delete that removes a bind). */
  single?: readonly string[];
  /** After each press, with the keys so far. */
  onPress?(keys: readonly string[]): void;
}

export interface BindingsOptions {
  /** Named sets for games whose conventions clash (Celeste's Z grabs, Hollow Knight's Z jumps). */
  sets?: Record<string, Overrides>;
}

/** Keys that type text: they act only outside text fields, so typing a name does not move the player. */
export function typesText(code: string): boolean {
  return /^(Key[A-Z]|Digit\d|Numpad\d|Space|Backspace|Minus|Equal|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Backquote|IntlBackslash)$/.test(code);
}

// Any modifiers (a game holds Shift while moving), but not inside a text field.
const OUTSIDE_TEXT = { alt: undefined, ctrl: undefined, meta: undefined, shift: undefined, isComposing: undefined, inInput: false };

export class Bindings implements KdsPlugin {
  static defaultEnabled = false;
  name = "Bindings";
  kds: Kds | undefined;
  readonly slots: readonly Slot[];
  readonly sets: Record<string, Overrides>;
  /** True while capture() waits for keys. */
  capturing = false;
  private defaults = new Map<string, Bind[]>();
  private current = new Map<string, Bind[]>();
  /** The mapper entries this plugin owns in kds.mappers, to replace them in place. */
  private owned: Kds["mappers"] = [];
  private listeners = new Set<() => void>();

  constructor(slots: readonly Slot[], opts: BindingsOptions = {}) {
    const ids = new Set<string>();
    for (const s of slots) {
      if (ids.has(s.id)) throw new Error(`kds Bindings: two slots are "${s.id}"`);
      ids.add(s.id);
    }
    this.slots = slots;
    this.sets = opts.sets ?? {};
    for (const s of slots) this.defaults.set(s.id, s.binds.map((b) => this.resolve(s, b)));
    this.reset();
    this.warnClashes("the defaults");
    for (const name of Object.keys(this.sets)) {
      this.pick(name);
      this.warnClashes(`set "${name}"`);
    }
    this.reset();
  }

  use(kds: Kds): void {
    this.kds = kds;
    this.owned = [];
    this.apply();
  }

  slot(id: string): Slot {
    const s = this.slots.find((x) => x.id === id);
    if (!s) throw new Error(`kds Bindings: no slot "${id}"; slots: ${this.slots.map((x) => x.id).join(", ")}`);
    return s;
  }

  /** The binds of a slot now. */
  binds(id: string): readonly Bind[] {
    this.slot(id);
    return this.current.get(id)!;
  }

  /** Every key bound to a slot now. */
  keys(id: string): string[] {
    return this.binds(id).flat();
  }

  isDefault(id: string): boolean {
    return sameBinds(this.binds(id), this.defaults.get(id)!);
  }

  /** The slots holding `key`, in one group or all. */
  holders(key: string, group?: string): string[] {
    return this.slots.filter((s) => (group === undefined || groupOf(s) === group) && this.keys(s.id).includes(key)).map((s) => s.id);
  }

  /** The composite bind holding `key`, in slots emitting `code` (or any slot). */
  compositeOf(key: string, code?: string): Bind | undefined {
    for (const s of this.slots) {
      if (!s.parts || (code !== undefined && s.to.code !== code)) continue;
      const bind = this.current.get(s.id)!.find((b) => b.includes(key));
      if (bind) return bind;
    }
    return undefined;
  }

  /**
   * Binds a slot to `binds`. A key bound elsewhere in the slot's group is taken from there (a
   * composite whole); refused when a key would come out of another slot's composite, or when a
   * `keep` slot would be left with nothing.
   */
  set(id: string, binds: readonly Bindable[]): Rebound {
    const s = this.slot(id);
    if (s.fixed) throw new Error(`kds Bindings: slot "${id}" is fixed`);
    const next: Bind[] = [];
    for (const b of binds.map((x) => this.resolve(s, x))) {
      if (!next.some((n) => n.some((k) => b.includes(k)))) next.push(b);
    }
    if (s.keep && !next.length) return { taken: [], blocked: { slot: id, bind: this.binds(id)[0] ?? [], reason: "last" } };
    const after = new Map<string, Bind[]>();
    const taken: Taken[] = [];
    for (const other of this.slots) {
      if (other.id === id || other.fixed || groupOf(other) !== groupOf(s)) continue;
      const kept: Bind[] = [];
      for (const ob of after.get(other.id) ?? this.current.get(other.id)!) {
        const shared = ob.find((k) => next.some((b) => b.includes(k)));
        if (shared === undefined) kept.push(ob);
        else if (ob.length > 1 && !s.parts) return { taken: [], blocked: { slot: other.id, bind: ob, reason: "composite" } };
        else taken.push({ slot: other.id, bind: ob });
      }
      if (other.keep && !kept.length) return { taken: [], blocked: { slot: other.id, bind: this.binds(other.id)[0] ?? [], reason: "last" } };
      after.set(other.id, kept);
    }
    for (const [oid, kept] of after) this.current.set(oid, kept);
    this.current.set(id, next);
    this.apply();
    return { taken };
  }

  /** Puts a bind into a slot at `index` (default: replaces the first; past the end: adds one). */
  bind(id: string, bind: Bindable, index = 0): Rebound {
    const b = this.resolve(this.slot(id), bind);
    const binds = [...this.binds(id)];
    if (index < binds.length) binds[index] = b;
    else binds.push(b);
    // Another bind of this slot sharing a key with the new one goes.
    return this.set(id, binds.filter((x) => x === b || !x.some((k) => b.includes(k))));
  }

  /** Removes the bind at `index`. */
  unbind(id: string, index: number): Rebound {
    return this.set(id, this.binds(id).filter((_, i) => i !== index));
  }

  /** Back to the defaults: one slot, or all. */
  reset(id?: string): void {
    for (const s of id === undefined ? this.slots : [this.slot(id)]) this.current.set(s.id, [...this.defaults.get(s.id)!]);
    this.apply();
  }

  /** The overrides to save: slots that differ from their defaults, composites by name when known. */
  save(): Overrides {
    const out: Overrides = {};
    for (const s of this.slots) if (!this.isDefault(s.id)) out[s.id] = this.binds(s.id).map(written);
    return out;
  }

  /** Loads saved overrides over the defaults; unknown slots and malformed entries are skipped. */
  load(saved: unknown): void {
    this.current = this.layered(saved);
    this.apply();
  }

  /** Replaces every bind with a named set (layered on the defaults). */
  pick(name: string): void {
    const set = this.sets[name];
    if (!set) throw new Error(`kds Bindings: no set "${name}"; sets: ${Object.keys(this.sets).join(", ")}`);
    this.load(set);
  }

  /** The set the binds match now: a set's name, "default", or undefined when the player's own. */
  matching(): string | undefined {
    if (this.slots.every((s) => this.isDefault(s.id))) return "default";
    return Object.keys(this.sets).find((name) => {
      const set = this.layered(this.sets[name]);
      return this.slots.every((s) => sameBinds(set.get(s.id)!, this.current.get(s.id)!));
    });
  }

  /** Calls `fn` after every change. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Tells subscribers something they show changed (key labels after a layout loads). */
  changed(): void {
    for (const fn of this.listeners) fn();
  }

  /**
   * Waits for `count` distinct key presses and resolves their codes (null on a cancel key or a
   * second call). While it waits no slot maps, so the presses confirm nothing and move nothing;
   * they and their releases have their default actions prevented (a focused button is not
   * clicked again).
   */
  capture(opts: CaptureOptions = {}): Promise<string[] | null> {
    const kds = this.kds;
    if (!kds) return Promise.reject(new Error("kds Bindings: capture before use"));
    const cancel = opts.cancel ?? ["Escape"];
    const count = opts.count ?? 1;
    this.stop?.();
    return new Promise((resolve) => {
      let off: (() => void) | undefined;
      let done = false;
      const got: string[] = [];
      // Pressed during the capture and not yet released: their releases are swallowed too.
      const held = new Set<string>();
      const finish = (keys: string[] | null): void => {
        done = true;
        this.stop = undefined;
        this.capturing = false;
        // Mapping resumes after this press has dispatched: kds reads the mappers after the
        // handlers, so restoring them now would map the captured key (Escape would go Back).
        queueMicrotask(() => this.apply());
        if (!held.size) off?.();
        resolve(keys);
      };
      this.stop = () => {
        off?.();
        finish(null);
      };
      this.capturing = true;
      this.apply();
      // After the press that started the capture has finished dispatching.
      queueMicrotask(() => {
        if (done) return;
        off = kds.on({ mods: undefined }, (e: KdsEvent) => {
          if (e.code === "Blur") {
            if (done) off?.();
            return;
          }
          const ev = e.event as Partial<KeyboardEvent>;
          if (typeof ev.code !== "string" || (e.code !== ev.code && e.code !== `Up:${ev.code}`)) return;
          if (e.code.startsWith("Up:")) {
            if (held.delete(ev.code)) {
              e.event.preventDefault();
              if (done && !held.size) off?.();
            }
            return;
          }
          if (done) return;
          e.event.preventDefault();
          if (ev.repeat || got.includes(e.code)) return;
          held.add(e.code);
          if (cancel.includes(e.code)) return finish(null);
          got.push(e.code);
          opts.onPress?.(got);
          if (got.length === count || (got.length === 1 && opts.single?.includes(e.code))) finish(got);
        });
      });
    });
  }

  private stop: (() => void) | undefined;

  /** Ends a waiting capture (it resolves null). */
  stopCapture(): void {
    this.stop?.();
  }

  /** The defaults with saved overrides over them, skipping what does not fit. */
  private layered(saved: unknown): Map<string, Bind[]> {
    const out = new Map([...this.defaults].map(([id, binds]) => [id, [...binds]]));
    if (!saved || typeof saved !== "object") return out;
    for (const [id, binds] of Object.entries(saved)) {
      const s = this.slots.find((x) => x.id === id);
      if (!s || s.fixed || !Array.isArray(binds)) continue;
      try {
        const next = binds.map((b) => this.resolve(s, b));
        if (!(s.keep && !next.length)) out.set(id, next);
      } catch {
        // A bind that no longer fits the slot leaves its defaults.
      }
    }
    return out;
  }

  /** A written bind as keys for slot `s`; throws when it does not fit. */
  private resolve(s: Slot, b: unknown): Bind {
    const n = s.parts?.length ?? 1;
    const keys = typeof b === "string" && n > 1 ? composites[b] : typeof b === "string" ? [b] : b;
    if (!Array.isArray(keys) || keys.length !== n || !keys.every((k) => typeof k === "string") || new Set(keys).size !== n) {
      throw new Error(`kds Bindings: ${JSON.stringify(b)} is not a bind of "${s.id}" (${n === 1 ? "a key" : `${n} keys or a composite's name`})`);
    }
    return [...keys];
  }

  private warnClashes(what: string): void {
    const seen = new Map<string, string>();
    for (const s of this.slots) {
      for (const key of this.keys(s.id)) {
        const at = `${groupOf(s)}:${key}`;
        const other = seen.get(at);
        if (other !== undefined && other !== s.id) console.warn(`kds Bindings: in ${what}, ${key} is both "${other}" and "${s.id}"`);
        seen.set(at, s.id);
      }
    }
  }

  /** Rebuilds this plugin's mappers in place, and notifies. */
  private apply(): void {
    const kds = this.kds;
    if (kds) {
      const rules: Kds["mappers"] = [];
      if (!this.capturing) {
        // Rank order: every slot's first bind, then every second...: hints list the primary binds first.
        const depth = Math.max(0, ...this.slots.map((s) => this.current.get(s.id)!.length));
        for (let r = 0; r < depth; r++) {
          for (const s of this.slots) {
            const bind = this.current.get(s.id)![r];
            bind?.forEach((key, i) => {
              const to = { ...s.to, ...s.parts?.[i]?.to };
              rules.push([kds.normalizeMatcher({ code: key, mods: typesText(key) ? OUTSIDE_TEXT : undefined }, "matcher"), to]);
              // Releases map anywhere, so a key let go inside a text field does not stay held.
              rules.push([kds.normalizeMatcher({ code: `Up:${key}`, mods: undefined }, "matcher"), { ...to, code: `Up:${s.to.code}` }]);
            });
          }
        }
      }
      const at = this.owned.length ? kds.mappers.indexOf(this.owned[0]!) : -1;
      kds.mappers = kds.mappers.filter((m) => !this.owned.includes(m));
      kds.mappers.splice(at < 0 ? kds.mappers.length : at, 0, ...rules);
      this.owned = rules;
    }
    this.changed();
  }
}

const groupOf = (s: Slot): string => s.group ?? "game";
const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const sameBinds = (a: readonly Bind[], b: readonly Bind[]): boolean => a.length === b.length && a.every((x, i) => same(x, b[i]!));
/** A bind as saved: a key, a known composite's name, or the composite's keys. */
const written = (b: Bind): Bindable => (b.length === 1 ? b[0]! : (compositeName(b) ?? [...b]));

/**
 * Keeps a player's rebinds in localStorage under `key`: loads them now, saves on every change.
 * Returns the function that stops saving.
 */
export function keepBindings(bindings: Bindings, key: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): () => void {
  try {
    const raw = storage.getItem(key);
    if (raw) bindings.load(JSON.parse(raw));
  } catch {
    // A bad entry leaves the defaults; the next change overwrites it.
  }
  let last = JSON.stringify(bindings.save());
  return bindings.subscribe(() => {
    const next = JSON.stringify(bindings.save());
    if (next === last) return;
    last = next;
    try {
      storage.setItem(key, next);
    } catch {
      // Storage full or denied: the rebinds last until reload.
    }
  });
}
