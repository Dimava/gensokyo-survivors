// Vendored from the kds prototype (D:/bag/repos/games/playsoemthing/src/kds @ 9e58cf6, design in
// D:/bag/protoprd/kds/PRD.md). Kept as close to upstream as possible; it will be replaced
// by the standalone kds package in D:/bag/repos/libs (PRD D33).
// Game state and movement axes as kds rules, so the whole control system lives
// in the dispatcher: bindings can match on the player's state (`{ code: "KeyZ",
// onGround: false }`) and keys alias into axes (`KeyA` re-emits as `KeyWasdX`,
// `KeyW` as `KeyWasdY`) instead of the game hand-rolling either.
import type { Kds, KdsEvent, KdsPlugin } from "./kds";

// Extends the vendored event rather than forking it, so states stamped by the
// game type-check in matchers.
declare module "./kds" {
  interface KdsEvent {
    onGround?: boolean;
    facing?: 1 | -1;
    dashes?: number;
    hp?: number;
    room?: string;
    mode?: string;
  }
}

/** What the game knows about itself, stamped onto every key event. */
export type KeyState = () => Partial<KdsEvent>;

/**
 * Keydown/Keyup that carry the game's state. It replaces the vendored Keydown
 * plugin (see InputDevice), because an event has to be born with the state for
 * a matcher to read it.
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

/**
 * Movement axes as codes: KeyWasdX/KeyWasdY for WASD and ArrowX/ArrowY for the
 * arrow keys, each with x/y set to the direction. The vendored Directional
 * plugin covers KeyWasdX and ArrowX; the vertical halves are here.
 */
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
