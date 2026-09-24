// Every key the game reads, as kds rules (src/view/kds). Physical keys are
// mapped to virtual codes ("Move", "Confirm", "Action:pause"...) and
// everything that reacts to keys binds a virtual code, so the key hints are
// read back from the same rules (keysFor) and cannot drift from them.
//
// Every key event is stamped at birth with who owns the keyboard (see
// addStamp): `nav` is true while a keynav scope (a menu, the pause menu, the
// level-up) is on top, `scopeBack` when that scope handles Esc itself. Rules
// match on those fields, so menu keys and run keys never both fire.
import { Kds, type KdsEvent, type KdsMapper } from "./kds/kds";
import { MoveAxes, StateKeys } from "./kds/game-state";

// One per page: a second (a hot update re-ran the game) reloads the page.
if ((window as any).__gsKeys) location.reload();
(window as any).__gsKeys = true;

declare module "./kds/kds" {
  interface KdsEvent {
    /** A keynav scope is on top: arrows and Enter/Space/Z navigate it. */
    nav?: boolean;
    /** The top scope handles Esc itself (closes a modal). */
    scopeBack?: boolean;
    /** The host's current screen. */
    screen?: string;
  }
}

/** Game preset (PRD D30): the rule ignores modifiers entirely (Shift is focus, Ctrl a skip key). */
const ANY = undefined;

/**
 * A key the host swallows before any rule sees it (a death being skipped):
 * listening ahead of kds, which attaches below.
 */
export const keyGate: { fn: ((e: KeyboardEvent) => boolean) | null } = { fn: null };
window.addEventListener(
  "keydown",
  (e) => {
    if (!keyGate.fn?.(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  },
  { capture: true },
);

// Keydown, keyup (`Up:<code>`) and blur, each stamped with the state below.
// The vendored Keydown steps aside for StateKeys, as in the prototype.
export const kds = new Kds().use(MoveAxes).use(StateKeys);
kds.plugins.Keydown?.detach?.();
const source = kds.plugins.StateKeys as StateKeys;

const stampers: (() => Partial<KdsEvent>)[] = [() => ({ nav: false, scopeBack: false, screen: "" })];
source.state = () => Object.assign({}, ...stampers.map((f) => f()));

/** Adds fields stamped onto every key event (later stampers win). */
export function addStamp(fn: () => Partial<KdsEvent>): void {
  stampers.push(fn);
}

/** Movement: each key re-emits as `Move` with its direction, and its release as `Up:Move`. */
const MOVE: [code: string, x: number, y: number][] = [
  ["KeyW", 0, -1],
  ["KeyA", -1, 0],
  ["KeyS", 0, 1],
  ["KeyD", 1, 0],
  ["ArrowUp", 0, -1],
  ["ArrowLeft", -1, 0],
  ["ArrowDown", 0, 1],
  ["ArrowRight", 1, 0],
];
const FOCUS = ["ShiftLeft", "ShiftRight"];

const rules: KdsMapper[] = [];
for (const [code, x, y] of MOVE) {
  rules.push([{ code, mods: ANY }, { code: "Move", x, y }]);
  rules.push([{ code: `Up:${code}`, mods: ANY }, { code: "Up:Move", x, y }]);
}
for (const code of FOCUS) {
  rules.push([{ code, mods: ANY }, { code: "Focus" }]);
  rules.push([{ code: `Up:${code}`, mods: ANY }, { code: "Up:Focus" }]);
}
// Confirm and back are shared: a menu takes them when it is on top, the game otherwise.
for (const code of ["Enter", "Space", "KeyZ"]) rules.push([{ code, mods: ANY }, { code: "Confirm" }]);
rules.push([{ code: "Escape", mods: ANY }, { code: "Back" }]);
// Backspace goes back too, except while typing in a text field.
rules.push([{ code: "Backspace", mods: { inInput: false } }, { code: "Back" }]);

const ACTIONS: [from: object, action: string][] = [
  [{ code: "Back", scopeBack: false }, "pause"],
  [{ code: "KeyP" }, "pause"],
  [{ code: "Back", scopeBack: false }, "back"],
  [{ code: "Confirm", nav: false }, "confirm"],
  [{ code: "KeyR" }, "reroll"],
  [{ code: "KeyX" }, "skip"],
  [{ code: "ControlLeft" }, "skip"],
  [{ code: "Slash" }, "fullscreen"],
];
for (let n = 1; n <= 5; n++) {
  for (const code of [`Digit${n}`, `Numpad${n}`]) {
    ACTIONS.push([{ code }, `card${n}`]);
    if (n <= 3) ACTIONS.push([{ code }, `pick${n}`]);
  }
}
for (const [from, action] of ACTIONS) rules.push([{ ...from, mods: ANY }, { code: `Action:${action}` }]);
kds.addMappers(rules);

/**
 * The physical keys that end up as `code` (a virtual code such as
 * "Action:pause" or "ArrowY"), in registration order: the mapper rules are
 * walked backwards until a code nothing maps to.
 */
export function keysFor(code: string): string[] {
  const out: string[] = [];
  const walk = (target: string, seen: Set<string>): void => {
    for (const [matcher, values] of kds.mappers) {
      if ((values as { code?: string }).code !== target) continue;
      const src = (matcher as { code?: unknown }).code;
      if (typeof src !== "string" || seen.has(src) || src.startsWith("Up:")) continue;
      const next = new Set(seen).add(src);
      const before = out.length;
      walk(src, next);
      if (out.length === before && !out.includes(src)) out.push(src);
    }
  };
  walk(code, new Set([code]));
  return out;
}

const LABELS: Record<string, string> = {
  Escape: "Esc",
  Backspace: "Bksp",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Equal: "+",
  Minus: "−",
};

/** A key code as printed on the key cap. */
export function keyLabel(code: string): string {
  return LABELS[code] ?? code.replace(/^(Key|Digit)/, "").replace(/^Numpad/, "Num ");
}

/** The distinct key-cap labels for a virtual code (Shift once, not Left and Right). */
export function keyLabels(code: string, max = Infinity): string[] {
  return [...new Set(keysFor(code).map(keyLabel))].slice(0, max);
}
