// Vendored from the kds prototype (D:/bag/repos/games/playsoemthing/src/kds @ 9e58cf6, design in
// D:/bag/protoprd/kds/PRD.md). Kept as close to upstream as possible; it will be replaced
// by the standalone kds package in D:/bag/repos/libs (PRD D33).
// kds ships Keydown, Directional, Mouse and Wheel -- no keyup, and a
// platformer needs held keys. Keyup mirrors Keydown and emits the same code
// with an `Up:` prefix, which is how kds already distinguishes aliases (see
// the Directional mappers). Blur emits `Blur` so held keys cannot stick.
import type { Kds, KdsEvent, KdsPlugin } from "./kds";

function bareEvent(event: Event): KdsEvent {
  return {
    event: event as unknown as KeyboardEvent, // kds reads only code/mods from it
    code: event.type === "blur" ? "Blur" : "",
    x: 0,
    y: 0,
    n: 0,
    mods: { alt: false, ctrl: false, meta: false, shift: false, inInput: false, isComposing: false },
  };
}

export class Keyup implements KdsPlugin {
  static defaultEnabled = false;
  name = "Keyup";
  kds: Kds | undefined;
  detach: (() => void) | undefined;

  attach(kds: Kds, options: AddEventListenerOptions): () => void {
    this.kds = kds;
    this.detach?.();
    addEventListener("keyup", this.handleKeyup, options);
    addEventListener("blur", this.handleBlur, options);
    this.detach = () => {
      removeEventListener("keyup", this.handleKeyup, options);
      removeEventListener("blur", this.handleBlur, options);
      this.detach = undefined;
    };
    return this.detach;
  }

  handleKeyup = (event: KeyboardEvent): void => {
    this.kds?.emit(this.kds.from(event, { code: `Up:${event.code}` }));
  };

  handleBlur = (event: Event): void => {
    this.kds?.emit(bareEvent(event));
  };
}
