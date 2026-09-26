// The host: owns the kernel and the fixed-step loop, routes input to the
// right scope, feeds traces to the presenter, saves, and keeps the reactive
// screen state the Vue shell renders. It is the only place wall-clock time
// exists; the kernel only ever sees ticks and input events.

import { reactive, markRaw } from "vue";
import type { DispatchResult } from "gamebones";
import { activeRun, runView, type Game, type RunPath } from "../sim/game.ts";
import { botFlush, botPick, botSteer, botThink, SKILL, type BotInputs } from "../sim/bot.ts";
import { navConfirm, navMove, navSelected, navTop } from "./keynav.ts";
import { handSlots, spiritAt } from "../sim/cards.ts";
import { cardDef } from "../content/cards.ts";
import { audio, type Track } from "./audio.ts";
import { musicMood, musicPart } from "./music-mood.ts";
import { input, type Action } from "./input.ts";
import { addStamp, keyGate } from "./keys.ts";
import { eraseSave, freshGame, loadOrCreate, save } from "./persist.ts";
import { Presenter, toast } from "./presenter.ts";
import { Playfield } from "./renderer.ts";
import { prefs } from "./prefs.ts";
import { Vn } from "../sim/vn.ts";

/**
 * The ?bot=1 player's pace on screens a person reads (ms). A level-up: once the
 * guard is over it moves the selection one card per `navStep`, then confirms one step later.
 */
const BOT_PACE = { navStep: 230, typeMs: 28, readMs: 900, readPerChar: 30 };
/**
 * A level-up offer shares the card keys: for `cast` ms after it opens a card key
 * still casts, and until `block` ms no pick is taken (keys, clicks, or the arrows and confirm: LevelUpView).
 */
const LEVELUP_GUARD = { cast: 100, block: 600 };

export type Screen = "title" | "menu" | "run" | "results" | "tree" | "cards" | "packs" | "expeditions" | "records" | "gallery" | "settings" | "help" | "credits";

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
  /** Credits rolls on screen (CreditsRoll.vue): the title theme plays while one is. */
  rolling: 0,
});

// Key events carry the screen, so rules can match on it (keys.ts).
addStamp(() => ({ screen: state.screen }));

const params = new URLSearchParams(location.search);
const CLOCK_KEY = "gensokyo-survivors/clock";

/** Heal autocast casts below this share of max HP. */
const AUTO_HEAL_BELOW = 1 / 3;

class Host {
  k: Game;
  field = markRaw(new Playfield());
  presenter = markRaw(new Presenter(this.field));
  private acc = 0;
  private last = 0;
  private lastMove = { x: 0, y: 0 };
  /** The ?bot=1 player's last sent move. */
  private bot: BotInputs = { move: { x: 0, y: 0 } };
  private sinceSave = 0;
  private tickCost = 0;
  private frames: number[] = [];
  /**
   * When the current level-up offer appeared (wall clock, ms). Its picks share
   * the card keys (1-3), so a key meant as a spell must not pick: see LEVELUP_GUARD.
   */
  private levelUpAt = 0;
  private wasLevelUp = false;
  /** When the bot last moved the level-up selection (wall clock, ms). */
  private botNavAt = 0;
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
    // One per page: a second (a hot update re-ran the game) reloads the page.
    if ((window as any).__gsHost) return location.reload();
    (window as any).__gsHost = true;
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
    } else {
      // Outside a run the screens stand on the night sky (NightSky.vue); the field idles under it.
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
    // Focus is logged input too (it narrows the weapons and locks facing), sent only when it changes. The bot sends its own (botSteer).
    if (!this.autoplay && input.focused !== v.derived("player").ctrl.focus) this.k.queue(path, "focus", { on: input.focused });
    if (!this.autoplay && prefs.autoHeal && overlay === "none") this.autoHeal(path);
    const res = this.k.tick(path, "fixed");
    this.presenter.consume(this.k, path, res);
    if (!this.path()) {
      this.runEnded();
      return;
    }
    const levelUp = runView(this.k, path).derived("state").run.overlay === "levelup";
    if (levelUp && !this.wasLevelUp) this.levelUpAt = performance.now();
    this.wasLevelUp = levelUp;
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
      this.botLevelUp(path);
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
    // A person's hands: it decides every tick, and each move, focus and card goes out half a second later (SKILL.human).
    botFlush(this.k, path, this.bot);
    botThink(this.k, path, this.bot, SKILL.human);
  }

  /**
   * The bot picks a level-up the way a player does with the keys, so a recording shows it:
   * once the guard is over (the arrows come alive) it steps the selection onto its card
   * (botPick), one card per BOT_PACE.navStep, and confirms a step later.
   */
  private botLevelUp(path: RunPath): void {
    const now = performance.now();
    const scope = navTop();
    const cards = scope?.matches(".lvl.live") ? [...scope.querySelectorAll<HTMLElement>(".choice")] : null;
    if (!this.levelUpArmed() || !cards?.length) {
      // No level-up view (hidden tab, a stuck overlay): pick directly after a while.
      if (this.levelUpArmed() && now - this.botNavAt > 2000 / this.turbo) this.dispatchRun(`${path}/levelup`, "levelup:pick", { index: botPick(this.k, path) });
      else if (!this.levelUpArmed()) this.botNavAt = now;
      return;
    }
    if (now - this.botNavAt < BOT_PACE.navStep / this.turbo) return;
    this.botNavAt = now;
    const target = Math.min(botPick(this.k, path), cards.length - 1);
    const sel = cards.indexOf(navSelected() as HTMLElement);
    if (sel === target) return navConfirm();
    if (sel < 0) return navMove(1, 0);
    // Toward the target card on screen (the cards may wrap onto two rows).
    const a = cards[sel]!.getBoundingClientRect();
    const b = cards[target]!.getBoundingClientRect();
    const dy = b.top - a.top;
    if (Math.abs(dy) > a.height / 2) navMove(0, Math.sign(dy));
    else navMove(Math.sign(b.left - a.left), 0);
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
    this.bot = { move: { x: 0, y: 0 } };
    input.clear();
    this.save();
    state.resultsFor = Date.now();
    state.meta++;
    state.screen = "results";
  }

  private music(): void {
    const s = state.screen;
    // The title theme on the title and main menu, the calm theme on the screens between runs.
    let track: Track = s === "title" || s === "menu" || state.rolling > 0 ? "menu" : s === "results" ? "results" : s === "settings" || s === "help" ? "keep" : "shop";
    let stage: string | undefined;
    let part = "";
    if (s === "run") {
      const path = this.path();
      const run = path ? runView(this.k, path).derived("state").run : null;
      const phase = run?.phase ?? "over";
      stage = run?.stage;
      // The boss's winds break the stage theme off at her warning, her theme starts with her dialogue; a clear gets a
      // fanfare that rings on after the run is over, a death a sting.
      track =
        phase === "boss" || phase === "dialogue"
          ? "boss"
          : phase === "warning"
            ? "hush"
            : phase === "cleared"
              ? "clear"
              : phase === "over"
                ? run?.outcome === "dead"
                  ? "over"
                  : run?.outcome === "clear"
                    ? "keep"
                    : null
                : "stage";
      // Intensity layers follow the fight, sampled a few times a second; the song's part (a midboss, the boss's spell cards) every frame.
      if (path && state.frame % 15 === 0) audio.intensity(musicMood(this.k, path));
      if (path) part = musicPart(this.k, path);
    }
    audio.paused(s === "run" && state.paused);
    audio.music(track, stage, part);
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
    this.bot = { move: { x: 0, y: 0 } };
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

  /** Action tick before which heal autocast waits (after a cast, until the card has resolved). */
  private autoHealAt = 0;

  /**
   * Heal autocast (prefs.autoHeal): below a third of her HP, a Heal card in hand plays itself
   * once Spirit allows. It is queued like a key press, so it is logged input and replays exactly.
   */
  private autoHeal(path: RunPath): void {
    const v = runView(this.k, path);
    const t = v.now("action");
    if (t < this.autoHealAt || v.derived("state").run.phase !== "swarm" && v.derived("state").run.phase !== "boss") return;
    const hp = v.derived("player").life.hp;
    if (hp <= 0 || hp > v.derived("stats").maxHp * AUTO_HEAL_BELOW) return;
    const have = spiritAt(v, t);
    const card = handSlots(v).find((c) => c?.card && cardDef(c.card.id).effect === "heal" && cardDef(c.card.id).cost <= have + 1e-9);
    if (!card) return;
    this.k.queue(path, "card:play", { card: card.id });
    this.autoHealAt = t + 30;
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

  /** The level-up offer is past its guard: picks are taken, and its cards are keyboard-navigable (LevelUpView). */
  levelUpArmed(): boolean {
    return performance.now() - this.levelUpAt >= LEVELUP_GUARD.block;
  }

  /** Ignored while the offer is fresh (LEVELUP_GUARD), keys and clicks alike. */
  pickLevelUp(index: number): void {
    const path = this.path();
    if (!path || !this.levelUpArmed()) return;
    this.dispatchRun(`${path}/levelup`, "levelup:pick", { index });
    // A chained level-up opens a fresh offer: it gets its own guard.
    this.levelUpAt = performance.now();
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
      // A card key just as the offer opens was meant for the hand: it still casts (resolving when the run goes on).
      if (a.startsWith("card") && performance.now() - this.levelUpAt < LEVELUP_GUARD.cast) this.playCard(Number(a.slice(4)) - 1);
      else if (a === "pick1" || a === "pick2" || a === "pick3") this.pickLevelUp(Number(a.slice(4)) - 1);
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
