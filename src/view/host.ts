// The host: owns the kernel and the fixed-step loop, routes input to the
// right scope, feeds traces to the presenter, saves, and keeps the reactive
// screen state the Vue shell renders. It is the only place wall-clock time
// exists; the kernel only ever sees ticks and input events.

import { reactive, markRaw } from "vue";
import type { DispatchResult } from "gamebones";
import { activeRun, newGame, runView, type Game, type RunPath } from "../sim/game.ts";
import { botCard, botMove, botPick } from "../sim/bot.ts";
import { handSlots } from "../sim/cards.ts";
import { audio, type Track } from "./audio.ts";
import { input, type Action } from "./input.ts";
import { addStamp, keyGate } from "./keys.ts";
import { eraseSave, freshGame, loadOrCreate, save } from "./persist.ts";
import { Presenter, toast } from "./presenter.ts";
import { Playfield } from "./renderer.ts";
import { prefs } from "./prefs.ts";
import { Vn } from "../sim/vn.ts";

/** The ?bot=1 player's pace on screens a person reads (ms). */
const BOT_PACE = { levelUp: 1600, typeMs: 28, readMs: 900, readPerChar: 30 };

export type Screen = "title" | "menu" | "run" | "results" | "tree" | "cards" | "packs" | "expeditions" | "records" | "gallery" | "settings" | "help";

export const state = reactive({
  screen: "title" as Screen,
  /** The screen a settings/help page returns to. */
  back: "menu" as Screen,
  paused: false,
  /** Pause-menu subpage. */
  pausePage: "main" as "main" | "settings" | "help" | "quit",
  /** Bumped every frame and after every dispatch: Vue computeds read it to follow the kernel. */
  frame: 0,
  /** Bumped after every meta change (menus follow this, not every frame). */
  meta: 0,
  loadError: "",
  fps: 0,
  msPerTick: 0,
  ready: false,
  /** When the last run ended (for the results screen). */
  resultsFor: 0,
});

// Key events carry the screen, so rules can match on it (keys.ts).
addStamp(() => ({ screen: state.screen }));

const params = new URLSearchParams(location.search);
const CLOCK_KEY = "gensokyo-survivors/clock";

class Host {
  k: Game;
  field = markRaw(new Playfield());
  presenter = markRaw(new Presenter(this.field));
  private acc = 0;
  private last = 0;
  private lastMove = { x: 0, y: 0 };
  private sinceSave = 0;
  private demo: { k: Game; presenter: Presenter; last: { x: number; y: number } } | null = null;
  private tickCost = 0;
  private frames: number[] = [];
  /** Level-ups the bot has picked (keys its wait per level-up). */
  private levelups = 0;
  /** Debug: the bot plays the run (?bot=1). */
  autoplay = params.get("bot") === "1";
  /** Debug: ticks per frame multiplier (?turbo=4). */
  turbo = Math.max(1, Number(params.get("turbo") ?? 1) || 1);
  /** The dialogue view finishes its typewriter on confirm before advancing. */
  vnConfirm: (() => void) | null = null;

  constructor() {
    const loaded = loadOrCreate();
    this.k = markRaw(loaded.game) as Game;
    if (loaded.error) state.loadError = loaded.error;
  }

  async start(el: HTMLElement): Promise<void> {
    await this.field.init(el);
    input.onAction((a) => this.action(a));
    // A death plays slowly; any fresh key, click or tap skips it, and does nothing else.
    const MODS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn"]);
    const dying = (): boolean => state.screen === "run" && !state.paused && this.presenter.deathSkippable();
    keyGate.fn = (e) => !e.repeat && !MODS.has(e.key) && dying() && this.skipDeath();
    let swallowClickUntil = 0;
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (!dying() || !this.skipDeath()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        // The click that ends this press lands on the results screen: it is the skip's too.
        swallowClickUntil = performance.now() + 1000;
      },
      { capture: true },
    );
    window.addEventListener(
      "click",
      (e) => {
        if (performance.now() > swallowClickUntil) return;
        swallowClickUntil = 0;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      { capture: true },
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (state.screen === "run" && this.path()) state.paused = true;
        this.save();
      }
    });
    window.addEventListener("pagehide", () => {
      this.resumeTime();
      this.save();
    });
    // Real time for expeditions: reported to the kernel as input on load and every 10 seconds.
    this.resumeTime();
    window.setInterval(() => this.resumeTime(), 10_000);
    const canvas = this.field.app.canvas;
    // A mouse steers toward the pointer; a finger is a floating joystick
    // anchored where it touched down, so it never covers the player.
    let anchor: { x: number; y: number } | null = null;
    const steer = (e: PointerEvent): void => {
      if (anchor) {
        input.steer({ dx: e.clientX - anchor.x, dy: e.clientY - anchor.y });
        return;
      }
      const r = canvas.getBoundingClientRect();
      input.steer({ dx: e.clientX - r.left - this.field.playerScreen.x, dy: e.clientY - r.top - this.field.playerScreen.y });
    };
    canvas.addEventListener("pointerdown", (e) => {
      audio.unlock();
      if (state.screen !== "run" || state.paused) return;
      // A second finger does not take over the joystick.
      if (anchor && e.pointerType !== "mouse") return;
      canvas.setPointerCapture(e.pointerId);
      anchor = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
      steer(e);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (canvas.hasPointerCapture(e.pointerId)) steer(e);
    });
    const release = (e: PointerEvent): void => {
      if (!canvas.hasPointerCapture(e.pointerId)) return;
      canvas.releasePointerCapture(e.pointerId);
      anchor = null;
      input.steer(null);
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    window.addEventListener("pointerdown", () => audio.unlock(), { capture: true });
    window.addEventListener("keydown", () => audio.unlock(), { capture: true });
    // Resume where the player was: a run in progress opens paused; an open pack resumes its reveal.
    if (this.path()) {
      state.screen = "run";
      state.paused = true;
    } else if (this.k.paths().includes("/pack")) {
      state.screen = "packs";
    }
    if (params.get("screen") === "menu" && state.screen === "title") state.screen = "menu";
    state.ready = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Wall-clock ms already reported to the kernel's idle clock. */
  private wallSeen = 0;

  /**
   * Tells the meta scope how many whole seconds passed since the last report
   * (the only way wall time reaches the simulation, D22). Skipped while no
   * companion is away, so idle play does not fill the log.
   */
  resumeTime(): void {
    const now = Date.now();
    if (!this.wallSeen) this.wallSeen = Number(localStorage.getItem(CLOCK_KEY)) || now;
    const away = this.k.view().derived("trips").some((t) => !t.expedition.back);
    const elapsed = Math.floor((now - this.wallSeen) / 1000);
    if (elapsed < 0 || !away) {
      this.wallSeen = now;
    } else if (elapsed > 0) {
      // Not saved here: the next save picks it up, and the wall clock is kept separately below.
      const res = this.k.dispatch("/", "time:resumed", { elapsed });
      this.presenter.consume(this.k, this.path(), res);
      state.meta++;
      if (res.ok) this.wallSeen += elapsed * 1000;
      if (state.screen !== "run") this.save();
    }
    // The wall clock is written only with the save (save()), so the two never disagree.
    if (!away) this.writeClock();
  }

  private writeClock(): void {
    try {
      localStorage.setItem(CLOCK_KEY, String(this.wallSeen));
    } catch {
      // Storage blocked: expeditions then only count time while the page is open.
    }
  }

  /** The idle clock now, with the seconds not yet reported added (for countdowns). */
  idleNow(): number {
    return this.k.view().now("idle") + Math.max(0, (Date.now() - this.wallSeen) / 1000);
  }

  path(): RunPath | null {
    return activeRun(this.k);
  }

  // ---------- the loop ----------

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.frames.push(dt);
    if (this.frames.length > 60) this.frames.shift();
    const path = this.path();
    let dim = 0;
    if (state.screen === "run" && path && !state.paused) {
      this.acc += dt * 60 * this.turbo;
      let steps = 0;
      const cap = 4 * this.turbo;
      const t0 = performance.now();
      // The death animation holds the dead run's last tick (view time only).
      while (this.acc >= 1 && steps < cap && !this.presenter.holds(this.k, path)) {
        this.step(path);
        this.acc -= 1;
        steps++;
        if (!this.path()) break;
      }
      if (steps >= cap) this.acc = 0;
      if (steps) this.tickCost = this.tickCost * 0.9 + ((performance.now() - t0) / steps) * 0.1;
    } else {
      this.acc = 0;
    }
    if (state.screen === "run") {
      this.field.draw(this.k, this.path(), dt, { dim: state.paused ? 0.45 : 0 });
    } else if (state.screen === "title" || state.screen === "menu") {
      this.stepDemo();
      this.field.draw(this.demo?.k ?? null, this.demo ? activeRun(this.demo.k) : null, dt, { dim: 0.55 });
    } else {
      this.field.draw(null, null, dt, { dim: 0.3 });
    }
    void dim;
    this.music();
    const avg = this.frames.reduce((s, x) => s + x, 0) / this.frames.length;
    state.fps = avg > 0 ? Math.round(1 / avg) : 0;
    state.msPerTick = Math.round(this.tickCost * 100) / 100;
    state.frame++;
    requestAnimationFrame((t) => this.frame(t));
  }

  private step(path: RunPath): void {
    const v = runView(this.k, path);
    const overlay = v.derived("state").run.overlay;
    if (this.autoplay) this.botStep(path, overlay);
    else {
      const m = overlay === "none" ? input.move() : { x: 0, y: 0 };
      if (m.x !== this.lastMove.x || m.y !== this.lastMove.y) {
        this.k.queue(path, "move", m);
        this.lastMove = m;
      }
    }
    // Focus is logged input too (it narrows the weapons), sent only when it changes. The bot leaves it off.
    const focus = !this.autoplay && input.focused;
    if (focus !== v.derived("player").ctrl.focus) this.k.queue(path, "focus", { on: focus });
    const res = this.k.tick(path, "fixed");
    this.presenter.consume(this.k, path, res);
    if (!this.path()) {
      this.runEnded();
      return;
    }
    if (++this.sinceSave >= 600) this.save();
  }

  /** What the bot is waiting on (an overlay or a dialogue line) and since when (wall clock, ms). */
  private botWait = { key: "", since: 0 };

  /** True once the bot has looked at `key` for `ms` (a person's pace, so recordings show choices and dialogue). */
  private botWaited(key: string, ms: number): boolean {
    const now = performance.now();
    if (this.botWait.key !== key) this.botWait = { key, since: now };
    return now - this.botWait.since >= ms / this.turbo;
  }

  private botStep(path: RunPath, overlay: string): void {
    if (overlay === "levelup") {
      // Look at the three choices before picking one.
      if (this.botWaited(`levelup:${this.levelups}`, BOT_PACE.levelUp)) {
        this.dispatchRun(`${path}/levelup`, "levelup:pick", { index: botPick(this.k, path) });
        this.levelups++;
      }
      return;
    }
    if (overlay === "vn") {
      // Let the line type out, then read it.
      const vn = `${path}/vn`;
      const scene = this.k.paths().includes(vn) ? this.k.read(vn as "/run:1/vn", Vn) : null;
      const len = scene?.line.text.length ?? 0;
      const ms = (len * BOT_PACE.typeMs) / prefs.animSpeed + BOT_PACE.readMs + len * BOT_PACE.readPerChar;
      if (this.botWaited(`vn:${scene?.script}:${scene?.index}`, ms)) this.dispatchRun(vn, "vn:next", {});
      return;
    }
    const m = botMove(this.k, path);
    if (m.x !== this.lastMove.x || m.y !== this.lastMove.y) {
      this.k.queue(path, "move", m);
      this.lastMove = m;
    }
    if (runView(this.k, path).now("fixed") % 20 === 0) {
      const c = botCard(this.k, path);
      if (c) this.k.queue(path, "card:play", { card: c });
    }
  }

  /** Skips a playing death: the animation jumps to its end and the run plays out its last ticks at once. */
  private skipDeath(): boolean {
    const path = this.path();
    if (!path || !this.presenter.skipDeath()) return false;
    input.clear();
    for (let i = 0; i < 600 && this.path(); i++) this.step(path);
    return true;
  }

  private runEnded(): void {
    this.lastMove = { x: 0, y: 0 };
    input.clear();
    this.save();
    state.resultsFor = Date.now();
    state.meta++;
    state.screen = "results";
  }

  /** The title screen's attract mode: a bot plays a throwaway kernel behind the menu. */
  private stepDemo(): void {
    if (!this.demo) {
      const k = newGame(`attract-${Math.floor(Math.random() * 1e6)}`);
      k.dispatch("/", "run:start", { stage: "lake" });
      this.demo = { k: markRaw(k) as Game, presenter: new Presenter(this.field, true), last: { x: 0, y: 0 } };
    }
    const d = this.demo;
    const path = activeRun(d.k);
    if (!path) {
      this.demo = null;
      return;
    }
    const v = runView(d.k, path);
    const overlay = v.derived("state").run.overlay;
    if (overlay === "levelup") d.k.dispatch(`${path}/levelup` as "/run:1/levelup", "levelup:pick", { index: botPick(d.k, path) });
    else if (overlay === "vn") d.k.dispatch(`${path}/vn` as "/run:1/vn", "vn:skip", {});
    else {
      const m = botMove(d.k, path);
      if (m.x !== d.last.x || m.y !== d.last.y) {
        d.k.queue(path, "move", m);
        d.last = m;
      }
    }
    const res = d.k.tick(path, "fixed");
    d.presenter.consume(d.k, path, res);
    // Keep the demo's memory flat: its log is never needed.
    if (v.now("fixed") > 60 * 150) this.demo = null;
  }

  private music(): void {
    let track: Track = "menu";
    let stage: string | undefined;
    if (state.screen === "run") {
      const path = this.path();
      const run = path ? runView(this.k, path).derived("state").run : null;
      const phase = run?.phase ?? "over";
      stage = run?.stage;
      // The boss theme starts with her dialogue; a clear gets a fanfare, a death silence.
      track = phase === "boss" || phase === "dialogue" ? "boss" : phase === "cleared" ? "clear" : phase === "over" ? null : "stage";
    }
    audio.music(track, stage);
  }

  // ---------- dispatching ----------

  /** A meta input: dispatched now, presented, saved. */
  meta<
    E extends
      | "run:start"
      | "run:abandon"
      | "tree:buy"
      | "pack:buy"
      | "deck:toggle"
      | "cards:seen"
      | "time:resumed"
      | "expedition:send"
      | "expedition:claim"
      | "expedition:recall",
  >(
    event: E,
    payload: Parameters<Game["dispatch"]>[2],
  ): DispatchResult {
    const res = (this.k.dispatch as (p: string, e: string, pl: unknown) => DispatchResult)("/", event, payload);
    this.presenter.consume(this.k, this.path(), res);
    this.save();
    state.frame++;
    state.meta++;
    return res;
  }

  /** An input to a scope under the run (overlays), dispatched now. */
  dispatchRun(path: string, event: string, payload: unknown): DispatchResult {
    const res = (this.k.dispatch as (p: string, e: string, pl: unknown) => DispatchResult)(path, event, payload);
    this.presenter.consume(this.k, this.path(), res);
    state.frame++;
    state.meta++;
    return res;
  }

  closePack(): void {
    if (!this.k.paths().includes("/pack")) return;
    this.dispatchRun("/pack", "pack:close", {});
    this.save();
  }

  startRun(stage: string): void {
    audio.unlock();
    const res = this.meta("run:start", { stage });
    if (!res.ok) return;
    this.field.clearFx();
    this.lastMove = { x: 0, y: 0 };
    input.clear();
    state.paused = false;
    state.pausePage = "main";
    state.screen = "run";
  }

  abandonRun(): void {
    const res = this.meta("run:abandon", {});
    if (!res.ok) return;
    state.paused = false;
    // The run ends on the next tick (run:over -> run:finish).
    const path = this.path();
    if (path) {
      for (let i = 0; i < 5 && this.path(); i++) this.presenter.consume(this.k, path, this.k.tick(path, "fixed"));
    }
    if (!this.path()) this.runEnded();
  }

  /** Plays the hand card in slot i (queued: it resolves at the next tick). */
  playCard(slot: number): void {
    const path = this.path();
    if (!path || state.paused) return;
    const v = runView(this.k, path);
    const card = handSlots(v)[slot];
    if (!card) return;
    this.k.queue(path, "card:play", { card: card.id });
  }

  pickLevelUp(index: number): void {
    const path = this.path();
    if (!path) return;
    this.dispatchRun(`${path}/levelup`, "levelup:pick", { index });
  }

  reroll(): void {
    const path = this.path();
    if (!path) return;
    this.dispatchRun(`${path}/levelup`, "levelup:reroll", {});
  }

  vnNext(skip = false): void {
    const path = this.path();
    if (!path) return;
    this.dispatchRun(`${path}/vn`, skip ? "vn:skip" : "vn:next", {});
  }

  save(): void {
    this.sinceSave = 0;
    save(this.k);
    if (this.wallSeen) this.writeClock();
  }

  eraseEverything(): void {
    eraseSave();
    this.k = markRaw(freshGame()) as Game;
    this.wallSeen = Date.now();
    this.save();
    state.screen = "menu";
    state.frame++;
    state.meta++;
  }

  go(screen: Screen): void {
    audio.unlock();
    if (screen === "settings" || screen === "help") state.back = state.screen === "results" ? "results" : "menu";
    state.screen = screen;
  }

  // ---------- input actions ----------

  private action(a: Action): void {
    const s = state.screen;
    if (s === "title") {
      if (a === "confirm" || a === "back" || a === "pause") this.go("menu");
      return;
    }
    if (s !== "run") {
      if (a === "back") {
        if (s === "packs" && this.k.paths().includes("/pack")) return;
        if (s === "settings" || s === "help") state.screen = state.back;
        else if (s !== "menu") state.screen = "menu";
        audio.play("back");
      }
      return;
    }
    const path = this.path();
    if (!path) return;
    const overlay = runView(this.k, path).derived("state").run.overlay;
    if (a === "pause") {
      if (state.paused && state.pausePage !== "main") state.pausePage = "main";
      else {
        state.paused = !state.paused;
        state.pausePage = "main";
        if (state.paused) this.save();
      }
      audio.play(state.paused ? "back" : "ui");
      return;
    }
    if (state.paused) return;
    if (overlay === "levelup") {
      if (a === "pick1" || a === "pick2" || a === "pick3") this.pickLevelUp(Number(a.slice(4)) - 1);
      if (a === "reroll") this.reroll();
      return;
    }
    if (overlay === "vn") {
      if (a === "confirm") (this.vnConfirm ?? (() => this.vnNext()))();
      if (a === "skip") this.vnNext(true);
      return;
    }
    if (a.startsWith("card")) this.playCard(Number(a.slice(4)) - 1);
  }
}

export const host = new Host();

// A debug handle for the browser console.
(window as unknown as { __gs: unknown }).__gs = { host, state, prefs, toast };
