// Raw keyboard and pointer events turned into thin game input (kernel D7):
// a movement vector as small integers, and named actions. The simulation
// never sees a key code; the host decides which scope gets what.

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

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const ACTION_KEYS: Record<string, Action[]> = {
  Escape: ["pause", "back"],
  KeyP: ["pause"],
  Enter: ["confirm"],
  Space: ["confirm"],
  KeyZ: ["confirm"],
  Digit1: ["card1", "pick1"],
  Digit2: ["card2", "pick2"],
  Digit3: ["card3", "pick3"],
  Digit4: ["card4"],
  Digit5: ["card5"],
  Numpad1: ["card1", "pick1"],
  Numpad2: ["card2", "pick2"],
  Numpad3: ["card3", "pick3"],
  Numpad4: ["card4"],
  Numpad5: ["card5"],
  KeyR: ["reroll"],
  KeyX: ["skip"],
  ControlLeft: ["skip"],
};

export class Input {
  private held = new Set<string>();
  private listeners = new Set<(a: Action, e: KeyboardEvent) => void>();
  /** Pointer steering: screen-space vector from the player to the pointer while held. */
  private pointer: { dx: number; dy: number } | null = null;
  lastDevice: "keyboard" | "pointer" = "keyboard";

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code in MOVE_KEYS || e.code === "Space") e.preventDefault();
      this.lastDevice = "keyboard";
      if (e.code in MOVE_KEYS) this.held.add(e.code);
      if (e.repeat) return;
      for (const a of ACTION_KEYS[e.code] ?? []) for (const l of this.listeners) l(a, e);
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.code));
    window.addEventListener("blur", () => {
      this.held.clear();
      this.pointer = null;
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

  /** The current movement as the `move` payload: integers in -100..100, 8 directions for keys. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const code of this.held) {
      const d = MOVE_KEYS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
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
    this.pointer = null;
  }
}

export const input = new Input();
