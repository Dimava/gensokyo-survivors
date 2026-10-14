// kds: an input dispatcher. Physical events (keys, mouse, wheel) become kds events that rules
// match by partial objects; mappers re-emit them under virtual codes ("ArrowX", "Move",
// "Action:pause"), so bindings name intentions and key hints read back from the same rules.
// From the kds prototype (playsoemthing src/kds @ 9e58cf6, then gensokyo-survivors), design in
// protoprd/kds/PRD.md. Nested in gamebones as `gamebones/kds` until it moves to its own package
// in D:/bag/repos/libs (kds D33); it depends on nothing and the kernel imports nothing from it.
// Not yet host-free (kds D32): the core reads DOM event classes.
import { Directional, Keydown, Keyup, Mouse, Wheel } from "./plugins.ts";

export interface KdsEvent {
  event: KeyboardEvent | MouseEvent | WheelEvent;
  code: string;
  x: number;
  y: number;
  n: number;
  mods: {
    alt: boolean;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    inInput: boolean;
    isComposing: boolean;
  };
}

function inInput(event: Event): boolean {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.matches(
            '[role="textbox"],[role="combobox"],[role="listbox"],[role="slider"],[role="spinbutton"]',
          )),
    );
}

export function matches(matcher: unknown, value: unknown): boolean {
  if (matcher === undefined) return true;
  if (Object.is(matcher, value)) return true;
  if (matcher === null || typeof matcher !== "object") return false;
  if (value === null || typeof value !== "object") return false;

  return Object.entries(matcher).every(([key, expected]) =>
    matches(expected, Reflect.get(value, key)),
  );
}

type DeepPartial<T> = T extends Event
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

type KdsValues = DeepPartial<KdsEvent>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone<T>(value: T): T {
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)])) as T;
}

function withDefaults(defaults: object, specified: object): object {
  const result = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(specified)) {
    const fallback = Reflect.get(defaults, key);
    result[key] =
      isPlainObject(fallback) && isPlainObject(value) ? withDefaults(fallback, value) : value;
  }
  return result;
}

export type KdsRule = [matcher: object, values: KdsValues];
export type KdsMapper = [matcher: object | string, values: KdsValues | string];
export type KdsHandler = (event: KdsEvent) => void | readonly string[];

type NormalizedKdsMapper = [matcher: object, values: KdsValues];

function assign(target: object, values: object): void {
  for (const [key, value] of Object.entries(values)) {
    const current = Reflect.get(target, key);
    if (isPlainObject(current) && isPlainObject(value)) assign(current, value);
    else Reflect.set(target, key, value);
  }
}

export type KdsPlugin = {
  name: string;
  use?(kds: Kds): void;
  attach?(kds: Kds, options: AddEventListenerOptions): () => void;
  detach?: () => void;
};

export type KdsPluginClass = (new () => KdsPlugin) & { defaultEnabled?: boolean };
export type KdsPluginInit = KdsPlugin | KdsPluginClass;

export class Kds {
  static readonly plugins = { Keydown, Keyup, Mouse, Wheel, Directional };

  assigners: KdsRule[] = [];
  mappers: NormalizedKdsMapper[] = [];
  bindings: Array<{ matcher: object; handler: KdsHandler }> = [];
  plugins: Record<string, KdsPlugin> = {};
  detach: (() => void) | undefined;
  listenerOptions: AddEventListenerOptions | undefined;

  readonly defaultMatcher = {
    mods: {
      alt: false,
      ctrl: false,
      meta: false,
      shift: false,
      inInput: false,
      isComposing: false,
    },
  };
  readonly proxy: Record<string, KdsHandler>;

  constructor() {
    this.proxy = new Proxy({} as Record<string, KdsHandler>, {
      set: (_target, code, handler): boolean => {
        if (typeof code !== "string" || typeof handler !== "function") return false;

        this.on(code, handler);
        return true;
      },
    });

    this.on({ code: "prevent", mods: undefined }, ({ event }) => event.preventDefault());
    this.on({ code: "stop", mods: undefined }, ({ event }) => event.stopImmediatePropagation());
    for (const plugin of Object.values(Kds.plugins)) {
      if (plugin.defaultEnabled) this.use(plugin);
    }
    this.attach();
  }

  use(plugin: keyof typeof Kds.plugins | KdsPluginInit): this {
    if (typeof plugin === "string") {
      const found = Kds.plugins[plugin];
      if (!found) throw new Error(`Unknown kds plugin: ${plugin}`);
      plugin = found;
    }
    const instance = typeof plugin === "function" ? new plugin() : plugin;
    this.plugins[instance.name]?.detach?.();
    this.plugins[instance.name] = instance;
    instance.use?.(this);
    if (this.detach) {
      const detach = instance.attach?.(this, this.listenerOptions ?? { capture: true });
      if (detach) instance.detach = detach;
    }
    return this;
  }

  on(code: string, handler: KdsHandler): () => void;
  on(matcher: object, handler: KdsHandler): () => void;
  on(codeOrMatcher: string | object, handler: KdsHandler): () => void {
    const binding = { matcher: this.normalizeMatcher(codeOrMatcher, "matcher"), handler };
    this.bindings.push(binding);

    return () => {
      const index = this.bindings.indexOf(binding);
      if (index !== -1) this.bindings.splice(index, 1);
    };
  }

  addAssigners(rules: KdsRule[]): void {
    for (const [matcher, values] of rules) {
      this.assigners.push([this.normalizeMatcher(matcher, "matcher"), values]);
    }
  }

  addMappers(rules: KdsMapper[]): void {
    for (const [matcher, values] of rules) {
      this.mappers.push([
        this.normalizeMatcher(matcher, "matcher"),
        this.normalizeMatcher(values, "value") as KdsValues,
      ]);
    }
  }

  from(event: KeyboardEvent | MouseEvent | WheelEvent, values: KdsValues = {}): KdsEvent {
    const next: KdsEvent = {
      event,
      code: event instanceof KeyboardEvent ? event.code : "",
      x: -0,
      y: -0,
      n: -0,
      mods: {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        inInput: inInput(event),
        isComposing: event instanceof KeyboardEvent && event.isComposing,
      },
    };
    assign(next, values);
    return next;
  }

  emit(event: KdsEvent): void {
    this.dispatch(event, new Set(), new Set([event.code]));
  }

  normalizeMatcher(value: object | string, target: "matcher" | "value"): object {
    const normalized = typeof value === "string" ? { code: value } : value;
    return target === "matcher" ? withDefaults(this.defaultMatcher, normalized) : normalized;
  }

  dispatch(
    event: KdsEvent,
    usedMappers: Set<NormalizedKdsMapper>,
    emittedCodes: Set<string>,
  ): void {
    for (const [matcher, values] of this.assigners) {
      if (matches(matcher, event)) assign(event, values);
    }

    for (const binding of this.bindings) {
      if (!matches(binding.matcher, event)) continue;
      const emitted = binding.handler(event);
      for (const code of emitted ?? []) {
        if (emittedCodes.has(code)) continue;
        const nextCodes = new Set(emittedCodes);
        nextCodes.add(code);
        const next = clone(event);
        assign(next, { code });
        this.dispatch(next, new Set(usedMappers), nextCodes);
      }
    }

    for (const rule of this.mappers) {
      if (usedMappers.has(rule)) continue;

      const [matcher, values] = rule;
      if (!matches(matcher, event)) continue;

      const next = clone(event);
      assign(next, values);

      const nextMappers = new Set(usedMappers);
      nextMappers.add(rule);
      this.dispatch(next, nextMappers, emittedCodes);
    }
  }

  attach(options: AddEventListenerOptions = { capture: true }): () => void {
    if (this.detach) return this.detach;

    this.listenerOptions = options;
    for (const plugin of Object.values(this.plugins)) {
      const detach = plugin.attach?.(this, options);
      if (detach) plugin.detach = detach;
    }
    const detach = (): void => {
      if (this.detach !== detach) return;
      for (const plugin of Object.values(this.plugins)) plugin.detach?.();
      this.detach = undefined;
      this.listenerOptions = undefined;
    };
    this.detach = detach;
    return detach;
  }
}

export { Directional, Keydown, Keyup, Mouse, Wheel };
