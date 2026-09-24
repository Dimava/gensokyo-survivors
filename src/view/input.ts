// Raw keyboard and pointer events turned into thin game input (kernel D7):
// a movement vector as small integers, and named actions. The simulation
// never sees a key code; the host decides which scope gets what. Keys come
// through kds (keys.ts), which also owns the bindings the key hints show.
import { kds } from "./keys.ts";

export type Action =
  | "pause"
  | "confirm"
  | "back"
  | "card1"
  | "card2"
  | "card3"
  | "card4"
  | "card5"
  | "pick1"
  | "pick2"
  | "pick3"
  | "reroll"
  | "skip";

/** Held for focus (Touhou's slow mode): movement at this percentage of full speed. */
const FOCUS_SPEED = 45;

const ACTIONS: Action[] = ["pause", "confirm", "back", "card1", "card2", "card3", "card4", "card5", "pick1", "pick2", "pick3", "reroll", "skip"];

export class Input {
  /** Held movement keys (physical code -> direction) and focus keys. */
  private held = new Map<string, [number, number]>();
  private focusHeld = new Set<string>();
  private listeners = new Set<(a: Action, e: KeyboardEvent) => void>();
  /** Pointer steering: screen-space vector from the player to the pointer while held. */
  private pointer: { dx: number; dy: number } | null = null;
  lastDevice: "keyboard" | "pointer" = "keyboard";
  /** Focus held by the on-screen button (touch devices have no Shift). */
  touchFocus = false;

  constructor() {
    // Keys arrive as kds virtual codes (keys.ts). A key pressed while a menu
    // is on top is the menu's, so it does not start moving the player.
    kds.on({ code: "Move", nav: false, mods: undefined }, (e) => {
      const ev = e.event as KeyboardEvent;
      if (!e.mods.inInput) ev.preventDefault();
      this.lastDevice = "keyboard";
      this.held.set(ev.code, [e.x, e.y]);
    });
    kds.on({ code: "Up:Move", mods: undefined }, (e) => {
      this.held.delete((e.event as KeyboardEvent).code);
    });
    kds.on({ code: "Focus", mods: undefined }, (e) => {
      this.focusHeld.add((e.event as KeyboardEvent).code);
    });
    kds.on({ code: "Up:Focus", mods: undefined }, (e) => {
      this.focusHeld.delete((e.event as KeyboardEvent).code);
    });
    // Space and Enter never scroll the page or click a focused button behind the game's back.
    kds.on({ code: "Confirm", mods: undefined }, (e) => e.event.preventDefault());
    for (const a of ACTIONS) {
      kds.on({ code: `Action:${a}`, mods: undefined, event: { repeat: false } }, (e) => {
        this.lastDevice = "keyboard";
        for (const l of this.listeners) l(a, e.event as KeyboardEvent);
      });
    }
    kds.on({ code: "Blur", mods: undefined }, () => {
      this.held.clear();
      this.focusHeld.clear();
      this.pointer = null;
      this.touchFocus = false;
    });
  }

  onAction(fn: (a: Action, e: KeyboardEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Steering by pointer: call with the vector from the player's screen position to the pointer, or null on release. */
  steer(v: { dx: number; dy: number } | null): void {
    this.pointer = v;
    if (v) this.lastDevice = "pointer";
  }

  /** Focus is held: the player moves slowly, her shots gather in and the hitbox shows. */
  get focused(): boolean {
    return this.touchFocus || this.focusHeld.size > 0;
  }

  /**
   * The current movement as the `move` payload: integers in -100..100, 8
   * directions for keys. The sim moves at |move| / 100 of full speed, so focus
   * slows her as a shorter vector; the host also sends a `focus` event on
   * change, which narrows the weapons.
   */
  move(): { x: number; y: number } {
    const m = this.rawMove();
    if (!this.focused) return m;
    return { x: Math.round((m.x * FOCUS_SPEED) / 100), y: Math.round((m.y * FOCUS_SPEED) / 100) };
  }

  private rawMove(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const [dx, dy] of this.held.values()) {
      x += dx;
      y += dy;
    }
    x = Math.sign(x);
    y = Math.sign(y);
    if (x || y) {
      const n = Math.sqrt(x * x + y * y);
      return { x: Math.round((x / n) * 100), y: Math.round((y / n) * 100) };
    }
    if (this.pointer) {
      const { dx, dy } = this.pointer;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 12) return { x: 0, y: 0 };
      // Quantize to 32 directions so a wobbling mouse does not flood the log.
      const a = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * 32) / 32;
      const speed = len > 60 ? 100 : Math.round(50 + ((len - 12) / 48) * 50);
      return { x: Math.round(Math.cos(a * Math.PI * 2) * speed), y: Math.round(Math.sin(a * Math.PI * 2) * speed) };
    }
    return { x: 0, y: 0 };
  }

  clear(): void {
    this.held.clear();
    this.focusHeld.clear();
    this.pointer = null;
    this.touchFocus = false;
  }
}

export const input = new Input();
