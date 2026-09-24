// Vendored from the kds prototype (D:/bag/repos/games/playsoemthing/src/kds @ 9e58cf6, design in
// D:/bag/protoprd/kds/PRD.md). Kept as close to upstream as possible; it will be replaced
// by the standalone kds package in D:/bag/repos/libs (PRD D33).
import type { Kds, KdsPlugin } from "./kds";

const mouseButtons = [
  { button: 0, bit: 1, name: "Left" },
  { button: 1, bit: 4, name: "Middle" },
  { button: 2, bit: 2, name: "Right" },
  { button: 3, bit: 8, name: "Back" },
  { button: 4, bit: 16, name: "Forward" },
] as const;

function mouseBit(button: number): number {
  return mouseButtons.find((candidate) => candidate.button === button)?.bit ?? 0;
}

function mouseName(button: number): string | undefined {
  return mouseButtons.find((candidate) => candidate.button === button)?.name;
}

/**
 * Mouse-button presses as aliases such as `MouseLeft` and
 * `MouseRightToLeft` (right already held, left newly pressed). Opt-in.
 */
export class Mouse implements KdsPlugin {
  static defaultEnabled = false;
  name = "Mouse";
  kds: Kds | undefined;
  detach: (() => void) | undefined;
  consumedButtons = 0;

  attach(kds: Kds, options: AddEventListenerOptions): () => void {
    this.kds = kds;
    this.detach?.();
    const activeOptions: AddEventListenerOptions = { ...options, passive: false };
    addEventListener("mousedown", this.handleMousedown, activeOptions);
    addEventListener("click", this.handleAfterClick, activeOptions);
    addEventListener("auxclick", this.handleAfterClick, activeOptions);
    addEventListener("contextmenu", this.handleContextMenu, activeOptions);
    addEventListener("blur", this.handleBlur, options);
    this.detach = () => {
      removeEventListener("mousedown", this.handleMousedown, activeOptions);
      removeEventListener("click", this.handleAfterClick, activeOptions);
      removeEventListener("auxclick", this.handleAfterClick, activeOptions);
      removeEventListener("contextmenu", this.handleContextMenu, activeOptions);
      removeEventListener("blur", this.handleBlur, options);
      this.consumedButtons = 0;
      this.detach = undefined;
    };
    return this.detach;
  }

  handleMousedown = (event: MouseEvent): void => {
    const kds = this.kds;
    const pressedName = mouseName(event.button);
    const pressedBit = mouseBit(event.button);
    if (!kds || !pressedName || !pressedBit) return;

    const held = event.buttons & ~pressedBit;
    if (!held) this.consumedButtons = 0;
    const heldNames = mouseButtons
      .filter((candidate) => held & candidate.bit)
      .map((candidate) => candidate.name)
      .join("");
    const code = heldNames ? `Mouse${heldNames}To${pressedName}` : `Mouse${pressedName}`;

    const wasPrevented = event.defaultPrevented;
    kds.emit(kds.from(event, { code }));
    if (!wasPrevented && event.defaultPrevented) {
      this.consumedButtons |= event.buttons | pressedBit;
    }
  };

  handleAfterClick = (event: MouseEvent): void => {
    const bit = mouseBit(event.button);
    if (!(this.consumedButtons & bit)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.consumedButtons &= ~bit;
  };

  handleContextMenu = (event: MouseEvent): void => {
    const right = mouseBit(2);
    if (!(this.consumedButtons & right)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.consumedButtons &= ~right;
  };

  handleBlur = (): void => {
    this.consumedButtons = 0;
  };
}

/** Window `keydown` → `kds.from`/`emit`. On by default. */
export class Keydown implements KdsPlugin {
  static defaultEnabled = true;
  name = "Keydown";
  kds: Kds | undefined;
  detach: (() => void) | undefined;

  attach(kds: Kds, options: AddEventListenerOptions): () => void {
    this.kds = kds;
    this.detach?.();
    addEventListener("keydown", this.handleKeydown, options);
    this.detach = () => {
      removeEventListener("keydown", this.handleKeydown, options);
      this.detach = undefined;
    };
    return this.detach;
  }

  handleKeydown = (event: KeyboardEvent): void => {
    this.kds?.emit(this.kds.from(event));
  };
}

/** Axis aliases: ArrowX, KeyWasdX, PageY, PlusMinusX. On by default. */
export class Directional implements KdsPlugin {
  static defaultEnabled = true;
  name = "Directional";

  use(kds: Kds): void {
    kds.addMappers([
      [
        { code: "ArrowLeft", mods: undefined },
        { code: "ArrowX", x: -1 },
      ],
      [
        { code: "ArrowRight", mods: undefined },
        { code: "ArrowX", x: 1 },
      ],
      [
        { code: "KeyA", mods: undefined },
        { code: "KeyWasdX", x: -1 },
      ],
      [
        { code: "KeyD", mods: undefined },
        { code: "KeyWasdX", x: 1 },
      ],
      [
        { code: "PageUp", mods: undefined },
        { code: "PageY", y: -1 },
      ],
      [
        { code: "PageDown", mods: undefined },
        { code: "PageY", y: 1 },
      ],
      [
        { code: "Equal", mods: undefined },
        { code: "PlusMinusX", x: 1 },
      ],
      [
        { code: "Minus", mods: undefined },
        { code: "PlusMinusX", x: -1 },
      ],
    ]);
  }
}

/**
 * Discrete vertical wheel as `WheelY` ±1. Never calls preventDefault; a binding
 * that actually consumes the gesture (e.g. has a next panel) returns `"prevent"`.
 * Opt-in: installs a non-passive window wheel listener.
 */
export class Wheel implements KdsPlugin {
  static defaultEnabled = false;
  static tickPx = 100;
  static idleMs = 300;
  name = "Wheel";
  acc = 0;
  at = 0;
  kds: Kds | undefined;
  detach: (() => void) | undefined;

  attach(kds: Kds, options: AddEventListenerOptions): () => void {
    this.kds = kds;
    this.detach?.();
    const wheelOptions: AddEventListenerOptions = { ...options, passive: false };
    addEventListener("wheel", this.handleWheel, wheelOptions);
    this.detach = () => {
      removeEventListener("wheel", this.handleWheel, wheelOptions);
      this.detach = undefined;
    };
    return this.detach;
  }

  handleWheel = (event: WheelEvent): void => {
    const kds = this.kds;
    if (!kds || event.deltaY === 0) return;

    const ticks = this.consume(event);
    const sign = Math.sign(ticks);
    for (let i = 0; i < Math.abs(ticks); i++) {
      kds.emit(kds.from(event, { code: "WheelY", y: sign }));
    }
  };

  consume(event: WheelEvent): number {
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      this.acc = 0;
      this.at = event.timeStamp;
      return Math.sign(event.deltaY);
    }

    const now = event.timeStamp;
    if (
      now - this.at > Wheel.idleMs ||
      (this.acc !== 0 && Math.sign(event.deltaY) !== Math.sign(this.acc))
    ) {
      this.acc = 0;
    }
    this.at = now;
    this.acc += event.deltaY;

    let ticks = 0;
    const step = Wheel.tickPx;
    while (Math.abs(this.acc) >= step) {
      const sign = Math.sign(this.acc);
      this.acc -= sign * step;
      ticks += sign;
    }
    return ticks;
  }
}
