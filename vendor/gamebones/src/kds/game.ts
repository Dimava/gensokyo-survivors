// Game presets: key events stamped with the game's state, movement axes, and createGameKeys, a
// whole keyboard layer for a game (virtual codes, actions, rebindable slots, key-cap labels).

import { Bindings, QUAD, type Bind, type Bindable, type Overrides, type Slot } from "./bindings.ts";
import { Kds, type KdsEvent, type KdsMapper, type KdsPlugin } from "./kds.ts";

declare module "./kds.ts" {
  interface KdsEvent {
    /** A menu (keynav scope) is on top: arrows and Confirm navigate it. */
    nav?: boolean;
    /** The top menu handles Back itself (closes a modal). */
    scopeBack?: boolean;
    /** The game's current screen, if it stamps one. */
    screen?: string;
  }
}

/** What the game knows about itself, stamped onto every key event. */
export type KeyState = () => Partial<KdsEvent>;

/**
 * Keydown, keyup (`Up:<code>`) and blur (`Blur`), each born with the game's state, so matchers
 * can read it (`{ code: "Confirm", nav: false }`). Replaces the Keydown plugin.
 */
export class StateKeys implements KdsPlugin {
  static defaultEnabled = false;
  name = "StateKeys";
  kds: Kds | undefined;
  detach: (() => void) | undefined;
  state: KeyState = () => ({});

  attach(kds: Kds, options: AddEventListenerOptions): () => void {
    this.kds = kds;
    this.detach?.();
    addEventListener("keydown", this.handleKeydown, options);
    addEventListener("keyup", this.handleKeyup, options);
    addEventListener("blur", this.handleBlur, options);
    this.detach = () => {
      removeEventListener("keydown", this.handleKeydown, options);
      removeEventListener("keyup", this.handleKeyup, options);
      removeEventListener("blur", this.handleBlur, options);
      this.detach = undefined;
    };
    return this.detach;
  }

  handleKeydown = (event: KeyboardEvent): void => {
    this.kds?.emit(this.kds.from(event, this.state()));
  };

  handleKeyup = (event: KeyboardEvent): void => {
    this.kds?.emit(this.kds.from(event, { ...this.state(), code: `Up:${event.code}` }));
  };

  handleBlur = (event: Event): void => {
    this.kds?.emit({
      event: event as unknown as KeyboardEvent, // kds reads only code/mods from it
      code: "Blur",
      x: 0,
      y: 0,
      n: 0,
      mods: { alt: false, ctrl: false, meta: false, shift: false, inInput: false, isComposing: false },
      ...this.state(),
    });
  };
}

/** The vertical halves of the Directional axes: KeyWasdY and ArrowY with y = ∓1. */
export class MoveAxes implements KdsPlugin {
  static defaultEnabled = false;
  name = "MoveAxes";

  use(kds: Kds): void {
    kds.addMappers([
      [{ code: "KeyW", mods: undefined }, { code: "KeyWasdY", y: -1 }],
      [{ code: "KeyS", mods: undefined }, { code: "KeyWasdY", y: 1 }],
      [{ code: "ArrowUp", mods: undefined }, { code: "ArrowY", y: -1 }],
      [{ code: "ArrowDown", mods: undefined }, { code: "ArrowY", y: 1 }],
    ]);
  }
}

export interface GameKeysOptions {
  /**
   * Quads that move (up, left, down, right), as `Move` with x/y (and `Up:Move` on release): a
   * composite's name or its four keys. Default WASD and the arrows.
   */
  move?: readonly Bindable[];
  /** Keys that confirm. Default Enter, Space, Z. */
  confirm?: readonly string[];
  /** Keys that go back. Default Escape and Backspace. */
  back?: readonly string[];
  /**
   * Actions, re-emitted as `Action:<name>`: a physical key (`["KeyP", "pause"]`: rebindable, one
   * slot per action) or a matcher on a virtual code and state (`[{ code: "Back", scopeBack: false },
   * "pause"]`: follows Back's keys).
   */
  actions?: readonly (readonly [from: string | object, action: string])[];
  /** Key-cap labels beyond the defaults (Esc, arrows, Shift...). */
  labels?: Record<string, string>;
  /** Controls-screen names by slot id (`{ "Action:bomb": "Spell card" }`). */
  names?: Record<string, string>;
  /** Extra rebindable slots. */
  slots?: readonly Slot[];
  /** Named sets, for a game whose conventions clash (see Bindings). */
  sets?: Record<string, Overrides>;
}

export interface GameKeys {
  kds: Kds;
  /** The rebindable slots: Move, Confirm, Back, Action:<name>, and `slots`. */
  bindings: Bindings;
  /** Adds fields stamped onto every key event (later stampers win). */
  addStamp(fn: () => Partial<KdsEvent>): void;
  /** The physical keys that end up as a virtual code, in registration order. */
  keysFor(code: string): string[];
  /** A key code as printed on the key cap (in the player's layout once loadLayout ran). */
  keyLabel(code: string): string;
  /** A bind as printed on the key caps: "P", or a composite's keys run together ("WASD", "↑←↓→"). */
  bindLabel(bind: Bind): string;
  /** The distinct key-cap labels for a virtual code (Shift once, not Left and Right; WASD as one). */
  keyLabels(code: string, max?: number): string[];
  /** Reads the keyboard layout (navigator.keyboard, Chromium) so labels match the key caps; QWERTY without it. */
  loadLayout(): Promise<void>;
}

const LABELS: Record<string, string> = {
  Escape: "Esc",
  Backspace: "Bksp",
  Enter: "Enter",
  Space: "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Equal: "+",
  Minus: "−",
};

const title = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A game's keyboard as one kds instance: `Move` (and `Up:Move`), `Confirm`, `Back` and
 * `Action:<name>` virtual codes, keys stamped with `nav`/`scopeBack` (see createKeynav) and
 * whatever the game stamps, and hint labels read back from the same rules, so they cannot drift.
 * The physical keys sit in rebindable slots (`bindings`). Modifiers are ignored (a game treats
 * Shift and Ctrl as keys, not chords); keys that type text act only outside text fields.
 */
export function createGameKeys(opts: GameKeysOptions = {}): GameKeys {
  const kds = new Kds().use(StateKeys);
  // StateKeys replaces the default keydown source.
  kds.plugins.Keydown?.detach?.();
  const source = kds.plugins.StateKeys as StateKeys;
  const stampers: (() => Partial<KdsEvent>)[] = [() => ({ nav: false, scopeBack: false })];
  source.state = () => Object.assign({}, ...stampers.map((f) => f()));

  const names = opts.names ?? {};
  const slots: (Slot & { binds: Bindable[] })[] = [];
  const slotFor = (slot: Slot & { label: string }) => {
    let s = slots.find((x) => x.id === slot.id);
    if (!s) slots.push((s = { ...slot, binds: [...slot.binds], label: names[slot.id] ?? slot.label }));
    return s;
  };
  slotFor({ id: "Move", to: { code: "Move" }, parts: QUAD, binds: opts.move ?? ["KeyWASD", "ArrowXY"], label: "Move" });
  // The way through the menus: never left without a key.
  slotFor({ id: "Confirm", to: { code: "Confirm" }, binds: opts.confirm ?? ["Enter", "Space", "KeyZ"], group: "menu", keep: true, label: "Confirm" });
  slotFor({ id: "Back", to: { code: "Back" }, binds: opts.back ?? ["Escape", "Backspace"], group: "menu", keep: true, label: "Back" });

  // Actions on virtual codes and state are fixed rules, ahead of the slots so hints list them first.
  const fixed: KdsMapper[] = [];
  for (const [from, action] of opts.actions ?? []) {
    if (typeof from === "string") slotFor({ id: `Action:${action}`, to: { code: `Action:${action}` }, binds: [], label: title(action) }).binds.push(from);
    else fixed.push([{ ...from, mods: undefined }, { code: `Action:${action}` }]);
  }
  kds.addMappers(fixed);
  const bindings = new Bindings([...slots, ...(opts.slots ?? [])], { sets: opts.sets });
  kds.use(bindings);

  const labels = { ...LABELS, ...opts.labels };
  let layout: Map<string, string> | undefined;
  const keysFor = (code: string): string[] => {
    const out: string[] = [];
    const walk = (target: string, seen: Set<string>): void => {
      for (const [matcher, values] of kds.mappers) {
        if ((values as { code?: string }).code !== target) continue;
        const src = (matcher as { code?: unknown }).code;
        if (typeof src !== "string" || seen.has(src) || src.startsWith("Up:")) continue;
        const before = out.length;
        walk(src, new Set(seen).add(src));
        if (out.length === before && !out.includes(src)) out.push(src);
      }
    };
    walk(code, new Set([code]));
    return out;
  };
  const keyLabel = (code: string): string =>
    labels[code] ?? layout?.get(code)?.toUpperCase() ?? code.replace(/^(Key|Digit)/, "").replace(/^Numpad/, "Num ");
  const bindLabel = (bind: Bind): string => (bind.length === 1 ? keyLabel(bind[0]!) : bind.map(keyLabel).join(""));
  return {
    kds,
    bindings,
    addStamp: (fn) => void stampers.push(fn),
    keysFor,
    keyLabel,
    bindLabel,
    keyLabels(code, max = Infinity) {
      const out = keysFor(code).map((key) => {
        const bind = bindings.compositeOf(key, code);
        return bind ? bindLabel(bind) : keyLabel(key);
      });
      return [...new Set(out)].slice(0, max);
    },
    async loadLayout() {
      const kb = (globalThis.navigator as { keyboard?: { getLayoutMap?(): Promise<Map<string, string>> } } | undefined)?.keyboard;
      if (!kb?.getLayoutMap) return;
      layout = new Map(await kb.getLayoutMap());
      bindings.changed();
    },
  };
}
