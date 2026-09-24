// Keyboard navigation for every menu, as one kds layer. `v-keynav` on a
// screen or overlay root makes it a scope; while a scope is on top (the last
// one mounted) key events are stamped `nav: true` (keys.ts) and:
// - the arrows and WASD (kds' ArrowX/ArrowY/KeyWasdX/KeyWasdY) move focus
//   spatially, to the nearest control in that direction, which covers lists,
//   grids and the shrine tree alike; with nothing that way they scroll;
// - on a slider Left/Right adjust it, on a checkbox they toggle it, on a
//   select they step through its options; Up/Down still move on;
// - Confirm (Enter/Space/Z) activates the focused control (a `navactivate`
//   event first, which a control may take over with preventDefault);
// - Tab and Shift+Tab cycle inside the scope; Esc calls the scope's `back`.
// The selected control is the focused one, marked data-nav-sel, which
// style.css draws as the red primary-button look (so the red moves with the
// arrows; the mouse moves it too by hovering). A scope selects its primary
// control when it opens ([data-autofocus], else the first .primary; with
// neither, nothing until the first arrow), so a screen looks as it always
// did until a key is pressed. It remembers the selection by `id` across
// remounts and hands it back to the scope below when it closes. With no scope
// on top (the run) the game gets the keys.
import type { Directive } from "vue";
import type { KdsEvent } from "./kds/kds";
import { addStamp, kds } from "./keys.ts";

export interface NavOptions {
  /** Remembers the focused control across remounts of this scope. */
  id?: string;
  /** Focus a control when the scope opens (default true). */
  autofocus?: boolean;
  /** Esc closes this scope itself instead of going to the host. */
  back?: () => void;
  /** Confirm does this instead of activating the focused control. */
  confirm?: () => void;
  /** Keyboard selection also moves a virtual pointer (a pointermove at the control's centre), for views that follow the mouse. */
  pointer?: boolean;
}

interface Scope {
  el: HTMLElement;
  opts: NavOptions;
  /** When it opened (ms, the key event clock): a confirm pressed at once is for the screen before. */
  born: number;
  last: HTMLElement | null;
  lastRect: DOMRect | null;
  /** The control carrying data-nav-sel. */
  sel: HTMLElement | null;
}

/** Confirm is ignored this long after a scope opens, so one press never both closes a screen and picks on the next. */
const GRACE_MS = 200;
const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]";

const stack: Scope[] = [];
const memory = new Map<string, number>();

const top = (): Scope | undefined => stack[stack.length - 1];

addStamp(() => {
  const s = top();
  return { nav: !!s, scopeBack: !!s?.opts.back };
});

function focusables(s: Scope): HTMLElement[] {
  return [...s.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if ((el as HTMLButtonElement).disabled || el.tabIndex < 0) return false;
    if (el.closest("[inert]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });
}

function focusEl(el: HTMLElement | undefined | null): void {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function initial(s: Scope): HTMLElement | undefined {
  const list = focusables(s);
  const remembered = s.opts.id !== undefined ? memory.get(s.opts.id) : undefined;
  if (remembered !== undefined && list[remembered]) return list[remembered];
  return list.find((el) => el.hasAttribute("data-autofocus")) ?? list.find((el) => el.classList.contains("primary"));
}

/** The mouse is what just moved the selection (so no virtual pointer is sent). */
let byMouse = false;

/** Where the first arrow goes on a screen that opened with nothing selected: the first control past the header. */
function first(s: Scope): HTMLElement | undefined {
  const list = focusables(s);
  return list.find((el) => !el.closest(".screen-head")) ?? list[0];
}

function select(s: Scope, el: HTMLElement): void {
  if (s.sel !== el) s.sel?.removeAttribute("data-nav-sel");
  s.sel = el;
  el.setAttribute("data-nav-sel", "");
  if (s.opts.pointer && !byMouse) {
    // After focusEl has scrolled it into view.
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    });
  }
}

/** The focused control, if it is in the scope. */
function current(s: Scope): HTMLElement | null {
  const a = document.activeElement;
  // A control disabled under the focus (a sent companion) still holds it for a moment in Chrome: it no longer counts.
  return a instanceof HTMLElement && a !== s.el && s.el.contains(a) && !(a as HTMLButtonElement).disabled ? a : null;
}

/** Puts focus where it belongs in the top scope, or nowhere when the game has the keys. */
function settle(): void {
  const s = top();
  if (!s) {
    const a = document.activeElement;
    if (a instanceof HTMLElement && a !== document.body) a.blur();
    return;
  }
  if (current(s)) return;
  if (s.opts.autofocus === false) {
    (document.activeElement as HTMLElement | null)?.blur?.();
    return;
  }
  focusEl(s.last?.isConnected && focusables(s).includes(s.last) ? s.last : initial(s));
}

function schedule(): void {
  requestAnimationFrame(settle);
}

document.addEventListener("focusin", (e) => {
  const s = top();
  const t = e.target;
  if (!s || !(t instanceof HTMLElement) || !s.el.contains(t)) return;
  s.last = t;
  s.lastRect = t.getBoundingClientRect();
  select(s, t);
  if (s.opts.id !== undefined) {
    const i = focusables(s).indexOf(t);
    if (i >= 0) memory.set(s.opts.id, i);
  }
});

// The mouse selects what it points at, so keys and mouse agree on the selection.
document.addEventListener("pointerover", (e) => {
  const s = top();
  if (!s || e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
  const t = e.target.closest<HTMLElement>(FOCUSABLE);
  if (!t || t === document.activeElement || !s.el.contains(t) || !focusables(s).includes(t)) return;
  byMouse = true;
  t.focus({ preventScroll: true });
  byMouse = false;
});

// ---------- moving ----------

/** The control nearest to `from` in direction (dx, dy), by edge distance plus twice the sideways offset. */
function nearest(list: HTMLElement[], from: DOMRect, dx: number, dy: number, skip: HTMLElement | null): HTMLElement | undefined {
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best: HTMLElement | undefined;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === skip) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // Must lie that way: its centre past ours, and not behind our far edge.
    const along = dx ? (cx - fx) * dx : (cy - fy) * dy;
    if (along <= 1) continue;
    const gap = dx ? Math.max(0, dx > 0 ? r.left - from.right : from.left - r.right) : Math.max(0, dy > 0 ? r.top - from.bottom : from.top - r.bottom);
    // Sideways: zero while the two overlap on the other axis, else the distance between centres.
    const overlap = dx ? r.bottom > from.top && r.top < from.bottom : r.right > from.left && r.left < from.right;
    const side = overlap ? Math.abs(dx ? cy - fy : cx - fx) * 0.25 : Math.abs(dx ? cy - fy : cx - fx);
    const score = gap + along * 0.1 + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

function move(s: Scope, dx: number, dy: number): void {
  const a = current(s);
  const from = a?.getBoundingClientRect() ?? (s.last?.isConnected ? s.last.getBoundingClientRect() : s.lastRect);
  if (!from) {
    focusEl(initial(s) ?? first(s));
    return;
  }
  const next = nearest(focusables(s), from, dx, dy, a);
  if (next) {
    focusEl(next);
    return;
  }
  // Nothing that way: scroll the text instead (help, records).
  if (!a) focusEl(initial(s) ?? first(s));
  const sc = scrollerOf(a ?? s.el);
  if (sc) sc.scrollBy({ top: dy * 140, left: dx * 140, behavior: "smooth" });
}

function stepSelect(el: HTMLSelectElement, d: number): void {
  const n = el.options.length;
  if (!n) return;
  el.selectedIndex = (el.selectedIndex + d + n) % n;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function stepRange(el: HTMLInputElement, d: number): void {
  if (d > 0) el.stepUp();
  else el.stepDown();
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function onDirection(e: KdsEvent, dx: number, dy: number): void {
  const s = top();
  if (!s) return;
  e.event.preventDefault();
  const a = current(s);
  const repeat = (e.event as KeyboardEvent).repeat;
  if (dx && a instanceof HTMLInputElement && a.type === "range") return stepRange(a, dx);
  if (dx && a instanceof HTMLInputElement && a.type === "checkbox") {
    if (!repeat) a.click();
    return;
  }
  if (dx && a instanceof HTMLSelectElement) return stepSelect(a, dx);
  move(s, dx, dy);
}

// ---------- activating ----------

function activate(e: KdsEvent): void {
  const s = top();
  if (!s || e.event.timeStamp - s.born < GRACE_MS) return;
  confirm(s);
}

function confirm(s: Scope): void {
  if (s.opts.confirm) return s.opts.confirm();
  const a = current(s);
  if (!a) return;
  if (a instanceof HTMLSelectElement) return stepSelect(a, 1);
  if (a instanceof HTMLInputElement && a.type === "range") return;
  if (a.dispatchEvent(new CustomEvent("navactivate", { cancelable: true }))) a.click();
  // The control may have gone (a claimed trip) or been disabled (a sent companion): focus what took its place.
  requestAnimationFrame(() => {
    if (top() !== s || current(s)) return;
    const list = focusables(s);
    const fresh = list.find((el) => el.hasAttribute("data-autofocus"));
    focusEl(fresh ?? (s.lastRect ? (nearestTo(list, s.lastRect) ?? initial(s)) : initial(s)));
  });
}

function nearestTo(list: HTMLElement[], r: DOMRect): HTMLElement | undefined {
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  let best: HTMLElement | undefined;
  let d = Infinity;
  for (const el of list) {
    const q = el.getBoundingClientRect();
    const dd = Math.hypot(q.left + q.width / 2 - x, q.top + q.height / 2 - y);
    if (dd < d) {
      d = dd;
      best = el;
    }
  }
  return best;
}

function tab(e: KdsEvent): void {
  const s = top();
  if (!s) return;
  e.event.preventDefault();
  const list = focusables(s);
  if (!list.length) return;
  const a = current(s);
  const i = a ? list.indexOf(a) : -1;
  const d = e.mods.shift ? -1 : 1;
  focusEl(list[(i + d + list.length) % list.length] ?? list[0]);
}

// Menu keys: any modifiers but Ctrl/Alt/Meta, and also inside a slider or checkbox.
const NAV = { mods: { inInput: undefined, shift: undefined } };
for (const code of ["ArrowX", "KeyWasdX"]) kds.on({ code, nav: true, ...NAV }, (e) => onDirection(e, e.x, 0));
for (const code of ["ArrowY", "KeyWasdY"]) kds.on({ code, nav: true, ...NAV }, (e) => onDirection(e, 0, e.y));
kds.on({ code: "Confirm", nav: true, event: { repeat: false }, ...NAV }, activate);
kds.on({ code: "Tab", nav: true, ...NAV }, tab);
kds.on({ code: "Back", scopeBack: true, mods: undefined, event: { repeat: false } }, (e) => {
  e.event.preventDefault();
  top()?.opts.back?.();
});

// ---------- driving it from code (the ?bot=1 player) ----------

/** The top scope's element, or null when the game has the keys. */
export function navTop(): HTMLElement | null {
  return top()?.el ?? null;
}

/** The selected (focused) control in the top scope. */
export function navSelected(): HTMLElement | null {
  const s = top();
  return s ? current(s) : null;
}

/** An arrow press in the top scope: moves the selection (the first press on a scope with none selects its first control). */
export function navMove(dx: number, dy: number): void {
  const s = top();
  if (s) move(s, dx, dy);
}

/** A confirm press in the top scope (the open grace applies). */
export function navConfirm(): void {
  const s = top();
  if (s && performance.now() - s.born >= GRACE_MS) confirm(s);
}

// ---------- the directive ----------

type Value = NavOptions | false | undefined;

function open(el: HTMLElement, opts: NavOptions): void {
  el.setAttribute("data-keynav", "");
  stack.push({ el, opts, born: performance.now(), last: null, lastRect: null, sel: null });
  schedule();
}

function close(el: HTMLElement): void {
  const i = stack.findIndex((x) => x.el === el);
  if (i < 0) return;
  stack[i]!.sel?.removeAttribute("data-nav-sel");
  stack.splice(i, 1);
  el.removeAttribute("data-keynav");
  // Its focused control may outlive it for a leave transition, inside the scope below: let go of it now.
  const a = document.activeElement;
  if (a instanceof HTMLElement && el.contains(a)) a.blur();
  schedule();
}

/**
 * `v-keynav` / `v-keynav="{ id, back }"`: the element is a keyboard scope while mounted. `false` opts out;
 * a value turning false or back closes or opens the scope (it opens on top, as if just mounted).
 */
export const vKeynav: Directive<HTMLElement, Value> = {
  mounted(el, b) {
    if (b.value !== false) open(el, b.value ?? {});
  },
  updated(el, b) {
    const s = stack.find((x) => x.el === el);
    if (b.value === false) {
      if (s) close(el);
    } else if (!s) open(el, b.value ?? {});
    else if (b.value) s.opts = b.value;
  },
  beforeUnmount(el) {
    close(el);
  },
};

declare module "vue" {
  interface GlobalDirectives {
    vKeynav: typeof vKeynav;
  }
}
