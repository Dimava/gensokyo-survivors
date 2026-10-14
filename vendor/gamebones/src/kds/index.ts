// gamebones/kds: the input dispatcher and its game presets. See kds.ts for the design notes.

export { Kds, matches } from "./kds.ts";
export type { KdsEvent, KdsHandler, KdsMapper, KdsPlugin, KdsPluginClass, KdsPluginInit, KdsRule } from "./kds.ts";
export { Directional, Keydown, Keyup, Mouse, Wheel } from "./plugins.ts";
export { createGameKeys, MoveAxes, StateKeys } from "./game.ts";
export type { GameKeys, GameKeysOptions, KeyState } from "./game.ts";
export { Bindings, compositeName, composites, keepBindings, PAIR, QUAD, typesText } from "./bindings.ts";
export type { Bind, Bindable, BindingsOptions, Blocked, CaptureOptions, Overrides, Part, Rebound, Slot, Taken } from "./bindings.ts";
export { createKeynav } from "./nav.ts";
export type { Keynav, KeynavDirective, NavOptions } from "./nav.ts";
