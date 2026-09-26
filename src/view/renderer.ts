// The playfield renderer (Pixi v8, WebGL). It reads kernel state and
// never writes it: packed stores are read directly (computable bullets and
// shots are evaluated at the current tick), entities through a view. Effects
// (sparks, rings, beams, flashes, floaters) are fed by the presenter from
// trace events and live only here.

import {
  AlphaFilter,
  Application,
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Sprite,
  Text,
  TilingSprite,
  type Texture,
} from "pixi.js";
import { ENEMIES } from "../content/enemies.ts";
import { BULLET_STYLES } from "../content/patterns.ts";
import { stageDef } from "../content/stages.ts";
import { groundTexture } from "./ground.ts";
import { weaponDef } from "../content/weapons.ts";
import { bossDef } from "../content/bosses.ts";
import { bossPos } from "../sim/boss.ts";
import { focusAmount, orbitRadius, weaponStats } from "../sim/weapons.ts";
import { PHASE } from "../sim/swarm.ts";
import { runView, type Game, type RunPath } from "../sim/game.ts";
import { BOSS, PLAYER, SWARM } from "../sim/tuning.ts";
import { buildAtlas, type Atlas } from "./atlas.ts";
import { frameAt, loadSpriteArt, lookTexture, type SpriteArt } from "./art-textures.ts";
import { prefs, type ArtStyle } from "./prefs.ts";
import { ART_L2D, type SpriteRig } from "../art-l2d/index.ts";
import { HITBOX_PART } from "../art-l2d/chibis.ts";
import { Rig } from "../art-l2d/rig.ts";
import { partImages, RigView } from "../art-l2d/pixi-model.ts";
import { Animator } from "../art-l2d/animator.ts";
import { CHARACTERS } from "../content/names.ts";

/** A character drawn by its live rig (the player and the bosses in the Live2D style). */
interface LiveSprite {
  sr: SpriteRig;
  view: RigView;
  anim: Animator;
  /** Holds the rig at game size; positioned so the cell's anchor sits on the entity. */
  holder: Container;
}

interface Fx {
  kind: "ring" | "beam" | "wave";
  x: number;
  y: number;
  r0: number;
  r1: number;
  color: number;
  age: number;
  dur: number;
  dx?: number;
  dy?: number;
  len?: number;
  width?: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  dur: number;
  size: number;
  color: number;
  star: boolean;
}

interface Floater {
  text: Text;
  x: number;
  y: number;
  age: number;
  dur: number;
}

const pos = { x: 0, y: 0 };
/** Reimu watches the nearest enemy within this range (the Homing Amulets' reach, sim/weapons.ts). */
const AIM_RANGE = 520;
/** Reimu switches her gaze to a new nearest enemy only when it is this many times closer than her current one. */
const FOCUS_SWITCH = 1.5;
/** A moving mob leans this many radians into its horizontal heading (its look frame is toward the player). */
const MOB_LEAN = 0.16;

/**
 * See-through for a layered rig as one picture: container alpha would fade
 * each mesh on its own, so overlapping parts (hair over face, sleeves over
 * dress) would show through each other. An AlphaFilter flattens it first; it
 * is only attached while the alpha is below 1.
 */
function groupAlpha(c: Container, alpha: number): void {
  if (alpha >= 0.999) {
    if (c.filters) c.filters = null;
    return;
  }
  let f = (c.filters as AlphaFilter[] | null)?.[0];
  // At the screen's resolution and antialiased: the default (1x) would blur her on hi-DPI screens while she blinks.
  if (!(f instanceof AlphaFilter)) c.filters = [(f = new AlphaFilter({ alpha, resolution: "inherit", antialias: "inherit" }))];
  f.alpha = alpha;
}
/**
 * The graze ring's three modes: hidden; circle, a plain steady ring (a UI cue,
 * not an effect: no easing) while a grazeable bullet is within `near` px
 * outside the graze radius; flash, on each actual graze the ring jumps bright
 * and lerps back to the circle (or to hidden) over `flash` seconds.
 */
const GRAZE_RING = { near: 40, circleAlpha: 0.3, width: 1.5, flash: 0.35, flashAlpha: 0.95, flashWidth: 3 };

function pool(pc: ParticleContainer, n: number, tex: Texture): Particle[] {
  const kids = pc.particleChildren as Particle[];
  if (kids.length !== n) {
    while (kids.length < n) kids.push(new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 }));
    kids.length = n;
    pc.update();
  }
  return kids;
}

export class Playfield {
  app = new Application();
  atlas!: Atlas;
  /** Character art by ART key (src/art); kinds without art use the atlas. */
  private art: Record<string, SpriteArt> = {};
  /**
   * Enemies draw from the art sheet only when every kind has a drawing: a
   * particle container reads one texture source, so drawn and procedural
   * enemies can't mix in it.
   */
  private enemyArt = false;
  /** The art style the sheet was built for; a change of preference rebuilds it. */
  private style: ArtStyle = "drawn";
  private reloading = false;
  /** Live rigs by character id (Live2D style only). */
  private live: Record<string, LiveSprite> = {};
  private playerLive = new Container();
  /**
   * Over the world, in its space: the live player moves here while she is
   * knocked out (playerKO), so the death's grey and darkening (on the world)
   * leave her bright and its burst stays under her.
   */
  private playerTop = new Container();
  private bossLive = new Container();
  ready = false;
  private world = new Container();
  private ground!: TilingSprite;
  private spellBg!: Sprite;
  private arena = new Graphics();
  private under = new Graphics();
  private dropPC!: ParticleContainer;
  private enemyPC!: ParticleContainer;
  private shotPC!: ParticleContainer;
  private bulletPC!: ParticleContainer;
  private sparkPC!: ParticleContainer;
  private player!: Sprite;
  private hitbox!: Sprite;
  /** ?hitdebug=1: the true hitbox circle drawn over everything. */
  private hitDebug = new Graphics();
  private readonly debugHit = new URLSearchParams(location.search).has("hitdebug");
  private boss!: Sprite;
  private bossCircle!: Sprite;
  private orbs: Sprite[] = [];
  private fxG = new Graphics();
  private over = new Graphics();
  private screenG = new Graphics();
  private floatLayer = new Container();
  private fx: Fx[] = [];
  private sparks: Spark[] = [];
  private floaters: Floater[] = [];
  private shakeAmt = 0;
  private flashColor = 0xffffff;
  private flashAlpha = 0;
  private time = 0;
  /** The glow behind Reimu's brooch, in her rig's layer order (under her face); lit by grazes. */
  private broochGlow: Sprite | null = null;
  /** Graze ring strength: 1 on a graze, decaying to 0 (grazeFlash). */
  private grazeA = 0;
  /** Seconds since the last graze flash (Infinity: none playing). */
  private grazeFlashT = Infinity;
  /** Time of the rigged art's idle cycles: runs at the animation-speed setting. */
  private artTime = 0;
  private zoom = 1;
  /** Screen position of the player, for pointer steering. */
  playerScreen = { x: 0, y: 0 };
  /** Screen position of the boss (or a midboss holding the stage) for the enemy marker (EnemyMark.vue); null when none. */
  enemyMark: { x: number; y: number } | null = null;
  /** The player's alpha while fx-death.ts plays (null: the renderer's own). */
  playerAlpha: number | null = null;
  /**
   * Death and revive on the Live2D player (fx-death.ts): `down` 0..1 knocks
   * her over (the rig's slack pose, the whole rig tipping about her feet),
   * `recoil` 0..1 is the flinch of the hit. Null: standing as usual.
   * Optional, for a knock-back: `turn` the rig's tilt in radians toward the
   * side she falls to (default from down and recoil), `lift` and `slide`
   * world px up and toward that side, `rate` her rig's time scale (0 freezes
   * her, a hit-stop; under 1 is slow motion).
   */
  playerKO: { down: number; recoil: number; turn?: number; lift?: number; slide?: number; rate?: number } | null = null;
  /** Camera punch-in while fx-death.ts plays (1: none); the camera also leans toward where she was knocked. */
  koZoom = 1;
  /** Which way she falls (+1 to her right), picked when she goes down. */
  private koSide = 1;
  /** The side a knock-out sends her toward (+1: +x). */
  get knockSide(): number {
    return this.koSide;
  }
  /** The player is a live rig (it can act a death instead of vanishing). */
  get livePlayer(): boolean {
    return !!this.live.reimu;
  }
  /** What fx-death.ts dresses: the field (ground, world) and the player (sprite, live rig). */
  get fxNodes(): { world: Container; scene: Container[]; player: Container[] } {
    return { world: this.world, scene: [this.ground, this.world], player: [this.player, this.playerTop] };
  }

  async init(host: HTMLElement): Promise<void> {
    // One per page: a second (a hot update re-ran the game) reloads the page.
    if ((window as any).__gsPixi) return location.reload();
    (window as any).__gsPixi = true;
    await this.app.init({
      background: "#0b1020",
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      preference: "webgl",
    });
    host.appendChild(this.app.canvas);
    this.atlas = buildAtlas(this.app.renderer);
    await this.loadArt(prefs.artStyle);
    const a = this.atlas;
    this.ground = new TilingSprite({ texture: this.groundFor("lake"), width: 100, height: 100 });
    this.spellBg = new Sprite(a.circle);
    this.spellBg.anchor.set(0.5);
    this.spellBg.visible = false;
    const props = { position: true, rotation: true, color: true, uvs: true, vertex: true };
    this.dropPC = new ParticleContainer({ texture: a.spark, dynamicProperties: props });
    this.enemyPC = new ParticleContainer({ texture: this.enemyArt ? this.art[ENEMIES[0]!.id]!.white : a.spark, dynamicProperties: props });
    this.shotPC = new ParticleContainer({ texture: a.spark, dynamicProperties: props });
    this.bulletPC = new ParticleContainer({ texture: a.spark, dynamicProperties: props });
    this.sparkPC = new ParticleContainer({ texture: a.spark, dynamicProperties: props });
    this.player = new Sprite(a.player);
    this.player.anchor.set(0.5, 0.55);
    this.hitbox = new Sprite(a.hitbox);
    this.hitbox.anchor.set(0.5);
    this.boss = new Sprite(a.boss.cirno);
    this.boss.anchor.set(0.5);
    this.bossCircle = new Sprite(a.circle);
    this.bossCircle.anchor.set(0.5);
    this.bossCircle.tint = 0x6fd3ff;
    this.world.addChild(
      this.spellBg,
      this.arena,
      this.under,
      this.dropPC,
      this.bossCircle,
      this.enemyPC,
      this.shotPC,
      this.boss,
      this.bossLive,
      this.player,
      this.playerLive,
      this.fxG,
      this.bulletPC,
      this.hitbox,
      this.sparkPC,
      this.over,
      this.floatLayer,
      this.hitDebug,
    );
    this.app.stage.addChild(this.ground, this.world, this.playerTop, this.screenG);
    this.ready = true;
  }

  /** The ground tile of each stage (ground.ts), made when first shown. */
  private groundTex: Record<string, Texture> = {};
  private groundFor(stage: string): Texture {
    return (this.groundTex[stage] ??= groundTexture(this.app.renderer, stage));
  }

  // ---------- effects API (the presenter calls these) ----------

  burst(x: number, y: number, color: number, n: number, speed = 3, size = 1, star = false): void {
    for (let i = 0; i < n && this.sparks.length < 2400; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, dur: 0.35 + Math.random() * 0.3, size, color, star });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: number, dur = 0.35): void {
    this.fx.push({ kind: "ring", x, y, r0, r1, color, age: 0, dur });
  }

  wave(x: number, y: number, r: number, color: number, dur = 0.3): void {
    this.fx.push({ kind: "wave", x, y, r0: r * 0.2, r1: r, color, age: 0, dur });
  }

  beam(x: number, y: number, dx: number, dy: number, len: number, width: number, color: number, dur = 0.45): void {
    this.fx.push({ kind: "beam", x, y, r0: 0, r1: 0, color, age: 0, dur, dx, dy, len, width });
  }

  flash(color: number, alpha: number): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  /** A graze happened: the graze ring lights up and fades. */
  private glowTex: Texture | null = null;
  /** A soft rose-white glow in rig units (the brooch orb is 11.5 across its radius), made once. */
  private glowTexture(): Texture {
    if (this.glowTex) return this.glowTex;
    const g = new Graphics();
    for (let r = 44; r > 10; r -= 2) g.circle(0, 0, r).fill({ color: 0xff7a9c, alpha: 0.1 });
    for (let r = 22; r > 8; r -= 2) g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.16 });
    this.glowTex = this.app.renderer.generateTexture({ target: g, resolution: 2, antialias: true });
    g.destroy();
    return this.glowTex;
  }

  grazeFlash(): void {
    this.grazeA = 1;
    this.grazeFlashT = 0;
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount * prefs.shake);
  }

  floater(x: number, y: number, text: string, color: number, size = 18): void {
    if (this.floaters.length > 40) return;
    const t = new Text({ text, style: { fontFamily: '"Shippori Mincho B1", "Yu Mincho", Georgia, serif', fontSize: size, fontWeight: "700", fill: color, stroke: { color: 0x120d0a, width: 4, join: "round" } } });
    t.anchor.set(0.5);
    this.floatLayer.addChild(t);
    this.floaters.push({ text: t, x, y, age: 0, dur: 0.9 });
  }

  clearFx(): void {
    this.fx = [];
    this.sparks = [];
    for (const f of this.floaters) f.text.destroy();
    this.floaters = [];
    this.flashAlpha = 0;
    this.shakeAmt = 0;
  }

  // ---------- art ----------

  /** Build the sprite sheet and the live rigs for an art style. */
  private async loadArt(style: ArtStyle): Promise<void> {
    const art = await loadSpriteArt(this.app.renderer, style);
    const live: Record<string, LiveSprite> = {};
    if (style === "live2d") {
      for (const [id, set] of Object.entries(ART_L2D)) {
        const sr = set.sprite;
        if (!sr || ENEMIES.some((e) => e.id === id)) continue;
        const rig = new Rig(sr.model);
        const view = new RigView(rig, await partImages(sr.model));
        view.scale.set(Math.min(sr.w / sr.model.w, sr.h / sr.model.h));
        const holder = new Container();
        holder.addChild(view);
        const anim = new Animator(rig);
        anim.rate = sr.rate;
        anim.snap();
        live[id] = { sr, view, anim, holder };
      }
    }
    for (const l of Object.values(this.live)) l.holder.destroy({ children: true });
    // A graze lights the brooch: the glow sits in the rig just over the brooch mesh (under her face).
    this.broochGlow = null;
    if (live.reimu) {
      const glow = new Sprite(this.glowTexture());
      glow.anchor.set(0.5);
      glow.blendMode = "add";
      glow.alpha = 0;
      if (live.reimu.view.addOver(HITBOX_PART, glow)) this.broochGlow = glow;
      else glow.destroy();
    }
    this.playerLive.removeChildren();
    this.bossLive.removeChildren();
    if (live.reimu) this.playerLive.addChild(live.reimu.holder);
    for (const [id, l] of Object.entries(live)) if (id !== "reimu") this.bossLive.addChild(l.holder);
    this.live = live;
    this.art = art;
    this.style = style;
    this.enemyArt = ENEMIES.every((e) => art[e.id]);
    if (this.enemyPC) this.enemyPC.texture = this.enemyArt ? art[ENEMIES[0]!.id]!.white : this.atlas.spark;
  }

  /**
   * Step a live rig toward a look and place it with its cell anchor at (x, y).
   * `move` is its motion (length = speed fraction; zero: standing), `slow` a careful walk.
   */
  /**
   * Down: the rig tips over about her feet onto her side (about 83 degrees)
   * and jolts on the recoil; standing: upright.
   */
  private tipOver(l: LiveSprite, ko: Playfield["playerKO"]): void {
    const h = l.holder;
    if (!ko || (ko.down <= 0 && ko.recoil <= 0 && !ko.turn && !ko.lift && !ko.slide)) {
      if (h.rotation !== 0 || h.pivot.x !== 0 || h.pivot.y !== 0) {
        h.rotation = 0;
        h.pivot.set(0, 0);
      }
      return;
    }
    // She turns about her middle (so a knock-back tumbles her), placed so her
    // feet (model space: chibis are 200x200, feet at y 188) stay on the ground
    // unless lifted: lying down is a turn about the feet.
    const s = l.view.scale.x;
    const cx = 100 * s;
    const cy = 120 * s;
    const leg = (188 - 120) * s;
    const side = this.koSide;
    const turn = side * (ko.turn ?? ko.down * 1.45 - ko.recoil * 0.12);
    // By default the hit lifts her a little off her feet.
    const lift = ko.lift ?? ko.recoil * 24 * s;
    const fx = h.position.x + cx;
    const fy = h.position.y + 188 * s;
    h.pivot.set(cx, cy);
    h.rotation = turn;
    h.position.set(fx + side * (ko.slide ?? 0) + leg * Math.sin(turn), fy - lift - leg * Math.cos(turn));
  }

  private drawLive(l: LiveSprite, x: number, y: number, lx: number, ly: number, ax: number, ay: number, dt: number, move = { x: 0, y: 0 }, slow = false, pin?: string): void {
    const len = Math.hypot(lx, ly);
    const k = len > 1 ? 1 / len : 1;
    l.anim.target = { x: lx * k, y: ly * k };
    l.anim.move = move;
    l.anim.slow = slow;
    l.anim.step(dt);
    l.view.update();
    // Pinned: the part's centre (as the rig drew it this frame) lands exactly on (x, y).
    const c = pin ? l.view.partCenter(pin) : null;
    if (c) l.holder.position.set(x - c[0] * l.view.scale.x, y - c[1] * l.view.scale.y);
    else l.holder.position.set(x - l.sr.w * ax, y - l.sr.h * ay);
  }

  /** The enemy Reimu is watching (uid; -1 none). */
  private focusUid = -1;
  private bossLast = { x: 0, y: 0, v: { x: 0, y: 0 } };
  /** The boss's velocity as a speed fraction, smoothed (bosses glide; frame jitter must not read as steps). */
  private bossVel(x: number, y: number, dt: number): { x: number; y: number } {
    const b = this.bossLast;
    const k = dt > 0 ? 1 / (dt * 120) : 0;
    const vx = Math.abs(x - b.x) > 200 ? 0 : (x - b.x) * k;
    const vy = Math.abs(y - b.y) > 200 ? 0 : (y - b.y) * k;
    const e = 1 - Math.exp(-dt * 6);
    b.v.x += (vx - b.v.x) * e;
    b.v.y += (vy - b.v.y) * e;
    b.x = x;
    b.y = y;
    return b.v;
  }

  // ---------- the frame ----------

  /** Draws the run at `path` of kernel `k` (or an empty field). dt in seconds of wall time. */
  draw(k: Game | null, path: RunPath | null, dt: number, opts: { dim?: number } = {}): void {
    if (!this.ready) return;
    const fdt = dt * prefs.animSpeed;
    this.time += dt;
    this.artTime += fdt;
    if (prefs.artStyle !== this.style && !this.reloading) {
      this.reloading = true;
      void this.loadArt(prefs.artStyle).finally(() => (this.reloading = false));
    }
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    this.zoom = Math.max(0.55, Math.min(1.6, Math.min(W / 1280, H / 760)));
    this.ground.width = W;
    this.ground.height = H;
    const v = k && path && k.paths().includes(path) ? runView(k, path) : null;
    if (!v || !v.q("run")[0]) {
      this.ground.tilePosition.set(-this.time * 20, -this.time * 12);
      this.world.visible = false;
      this.playerTop.visible = false;
      this.ground.tint = 0xffffff;
      this.enemyMark = null;
      this.drawScreen(W, H, fdt, opts.dim ?? 0);
      return;
    }
    this.world.visible = true;
    const run = v.derived("state").run;
    const p = v.derived("player");
    const t = v.now("action");
    const td = v.now("danmaku");
    const stage = stageDef(run.stage);
    // Each stage has its own meadow and tints it (the tile is drawn in the lake's colours).
    const tex = this.groundFor(run.stage);
    if (this.ground.texture !== tex) this.ground.texture = tex;
    this.ground.tint = stage.tint;

    // Camera, with shake.
    this.shakeAmt = Math.max(0, this.shakeAmt - fdt * 30);
    const sx = (Math.random() * 2 - 1) * this.shakeAmt;
    const sy = (Math.random() * 2 - 1) * this.shakeAmt;
    // Knocked out: the camera punches in and leans toward where she flies.
    const kc = this.playerKO && this.live.reimu ? this.playerKO : null;
    this.zoom *= this.koZoom;
    const camX = p.body.x + (kc ? this.koSide * (kc.slide ?? 0) * 1.1 : 0);
    const camY = p.body.y - (kc ? (kc.lift ?? 0) * 0.6 : 0);
    this.world.scale.set(this.zoom);
    this.world.position.set(W / 2 - camX * this.zoom + sx, H / 2 - camY * this.zoom + sy);
    this.playerTop.visible = true;
    this.playerTop.scale.set(this.zoom);
    this.playerTop.position.copyFrom(this.world.position);
    this.ground.tileScale.set(this.zoom);
    this.ground.tilePosition.set(-camX * this.zoom + sx + W / 2, -camY * this.zoom + sy + H / 2);
    this.playerScreen = { x: W / 2 + (p.body.x - camX) * this.zoom, y: H / 2 + (p.body.y - camY) * this.zoom };
    const viewR = Math.sqrt(W * W + H * H) / 2 / this.zoom + 40;
    const mark = (x: number, y: number) => (this.enemyMark = { x: this.world.position.x + x * this.zoom, y: this.world.position.y + y * this.zoom });
    this.enemyMark = null;

    // Boss arena and the spell-card background.
    this.arena.clear();
    this.under.clear();
    if (run.arena) {
      // A Hakurei barrier: a torii-vermilion line, a straw hairline outside it and shimenawa
      // ties across both every 15 degrees, steady (a border, not an alarm), on a darker floor.
      const R = BOSS.arena;
      this.arena.circle(run.ax, run.ay, R).fill({ color: 0x0c0a10, alpha: 0.45 });
      this.arena.circle(run.ax, run.ay, R).stroke({ width: 4, color: 0xe5532d, alpha: 0.9 });
      this.arena.circle(run.ax, run.ay, R + 8).stroke({ width: 1.5, color: 0xd6c48c, alpha: 0.55 });
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        this.arena.moveTo(run.ax + c * (R - 5), run.ay + s * (R - 5)).lineTo(run.ax + c * (R + 9), run.ay + s * (R + 9)).stroke({ width: 3, color: 0xd6c48c, alpha: 0.8 });
      }
    }
    const boss = v.derived("boss");
    // Where Reimu looks (her focus, apart from where she walks): what her amulets aim at, the boss or the nearest enemy.
    let focusX = 0;
    let focusY = 0;
    let focusD = AIM_RANGE * AIM_RANGE;
    let focused = false;
    let focusUid = -1;
    /** Her current target, if it is still in range: she keeps watching it until another is clearly closer. */
    let stickyX = 0;
    let stickyY = 0;
    let stickyD = -1;
    this.spellBg.visible = !!boss;
    this.boss.visible = !!boss;
    this.bossLive.visible = !!boss;
    this.bossCircle.visible = !!boss;
    if (boss) {
      const def = bossDef(boss.boss.id);
      bossPos(boss, t, pos);
      mark(pos.x, pos.y);
      focusX = pos.x;
      focusY = pos.y;
      focused = true;
      const bossArt = this.art[def.character];
      const bossLive = this.live[def.character];
      for (const [id, l] of Object.entries(this.live)) if (id !== "reimu") l.holder.visible = l === bossLive;
      this.boss.visible = !bossLive;
      if (bossLive) {
        // Hover or move: the boss's speed (full at 120 px/s) from its last drawn position.
        const bv = this.bossVel(pos.x, pos.y, dt);
        this.drawLive(bossLive, pos.x, pos.y, (p.body.x - pos.x) / 200, (p.body.y - pos.y) / 200, 0.5, 0.5, fdt, bv);
      }
      else this.boss.texture = bossArt ? lookTexture(bossArt, p.body.x - pos.x, p.body.y - pos.y) : (this.atlas.boss[boss.boss.id] ?? this.atlas.boss.cirno!);
      this.bossCircle.tint = CHARACTERS[def.character].color === 0x2b2238 ? 0xb9a6ff : CHARACTERS[def.character].color;
      this.boss.position.set(pos.x, pos.y + Math.sin(this.time * 2.5) * 3);
      this.bossCircle.position.set(pos.x, pos.y);
      this.bossCircle.rotation = this.time * 1.2;
      const intro = Math.max(0, Math.min(1, (t - boss.boss.spellStart) / BOSS.intro));
      this.bossCircle.scale.set(0.9 + intro * 0.4);
      this.bossCircle.alpha = 0.7;
      this.spellBg.position.set(run.ax, run.ay);
      this.spellBg.rotation = -this.time * 0.15;
      this.spellBg.scale.set(6.5);
      this.spellBg.alpha = 0.12 * intro;
      this.spellBg.tint = this.bossCircle.tint;
      // Spell HP as a ring around the boss (Touhou style): washi, like the bar at the top, on a dark track.
      const frac = boss.boss.max > 0 ? boss.boss.hp / boss.boss.max : 0;
      if (frac > 0) {
        const hr = def.radius + 26;
        this.under.circle(pos.x, pos.y, hr).stroke({ width: 5, color: 0x120d0a, alpha: 0.45 });
        this.under.moveTo(pos.x, pos.y - hr).arc(pos.x, pos.y, hr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac).stroke({ width: 3, color: 0xf0e6cc, alpha: 0.9 });
      }
    }

    // Drops. Gems lie still and now and then catch the light, each on its own beat (from where it lies);
    // coins and hearts bob.
    const d = v.packed("drops");
    const dp = pool(this.dropPC, d.count, this.atlas.drop.gems[0]!);
    const dkind = d.col("kind");
    const dval = d.col("value");
    const dx0 = d.col("x");
    const dy0 = d.col("y");
    const bob = Math.sin(this.time * 4) * 0.08;
    for (let i = 0; i < d.count; i++) {
      const q = dp[i]!;
      const x = dx0[i]!;
      const y = dy0[i]!;
      q.x = x;
      q.y = y;
      const kind = dkind[i]!;
      let s = 1 + bob;
      if (kind === 0) {
        const tier = dval[i]! >= 20 ? 2 : dval[i]! >= 5 ? 1 : 0;
        const beat = (this.time * 0.45 + ((x * 0.0137 + y * 0.0291) % 1) + 1) % 1;
        q.texture = (beat < 0.035 ? this.atlas.drop.glints : this.atlas.drop.gems)[tier]!;
        s = Math.min(1.8, 0.8 + Math.sqrt(dval[i]!) * 0.12);
      } else q.texture = kind === 1 ? this.atlas.drop.coin : this.atlas.drop.heart;
      q.scaleX = s;
      q.scaleY = s;
    }

    // Enemies.
    const e = v.packed("enemies");
    const ep = pool(this.enemyPC, e.count, this.enemyArt ? this.art[ENEMIES[0]!.id]!.white : this.atlas.enemy[0]!);
    const ex = e.col("x");
    const ey = e.col("y");
    const ek = e.col("kind");
    const ehit = e.col("hitAt");
    const euid = e.col("uid");
    const evx = e.col("vx");
    const evy = e.col("vy");
    const ephase = e.col("phase");
    for (let i = 0; i < e.count; i++) {
      const q = ep[i]!;
      q.x = ex[i]!;
      q.y = ey[i]!;
      const kind = ek[i]!;
      const flash = t - ehit[i]! < SWARM.flash;
      const def = ENEMIES[kind]!;
      if (def.midboss && !boss && ephase[i] !== PHASE.leaving) mark(ex[i]!, ey[i]!);
      if (!boss) {
        const fdx = ex[i]! - p.body.x;
        const fdy = ey[i]! - p.body.y;
        const fd = fdx * fdx + fdy * fdy;
        if (fd < focusD) {
          focusD = fd;
          focusX = ex[i]!;
          focusY = ey[i]!;
          focusUid = euid[i]!;
          focused = true;
        }
        if (euid[i] === this.focusUid && fd < AIM_RANGE * AIM_RANGE) {
          stickyX = ex[i]!;
          stickyY = ey[i]!;
          stickyD = fd;
        }
      }
      // Focus and direction apart: a mob watches the player while it moves (only a leaving one looks
      // away, where it flies). The sheet bakes look x gait frames, so the body's heading is a lean.
      const heading = ephase[i] === PHASE.leaving;
      const art = this.enemyArt ? this.art[def.id] : undefined;
      if (art) {
        // Rigged art animates: each enemy runs the idle cycle at its own phase and blinks now and then.
        const uid = euid[i]!;
        // Mobs on the move flap faster (1.6x); a held post keeps the calm rate.
        const moving = def.speed > 0 && ephase[i] !== PHASE.holding;
        const frame = frameAt(art, this.artTime * (moving ? 1.6 : 1), (uid * 0.618034) % 1);
        const blink = !!art.blink && (this.artTime * 0.9 + uid * 0.7131) % 4.4 < 0.16;
        q.texture = flash
          ? art.white
          : heading
            ? lookTexture(art, evx[i]!, evy[i]!, frame, blink)
            : lookTexture(art, p.body.x - q.x, p.body.y - q.y, frame, blink);
      }
      else q.texture = flash ? this.atlas.enemyWhite[kind]! : this.atlas.enemy[kind]!;
      // The procedural blobs squash; rigged art already bobs in its frames.
      const wob = art ? 0 : Math.sin(this.time * 6 + euid[i]!) * 0.06;
      const sc = flash ? 1.12 : 1;
      q.scaleX = sc + wob;
      q.scaleY = sc - wob;
      q.rotation = def.shape === "orb" && !art ? this.time * 2 + euid[i]! : art && def.speed > 0 && ephase[i] !== PHASE.holding ? evx[i]! * MOB_LEAN : 0;
      // Procedural sprites only face left or right; drawn ones look the way they face.
      if (!art && (heading ? evx[i]! < 0 : q.x > p.body.x)) q.scaleX = -q.scaleX;
    }

    // Player shots (computable: evaluated at t).
    const s = v.packed("shots");
    const sp = pool(this.shotPC, s.count, this.atlas.shot[0]!);
    for (let i = 0; i < s.count; i++) {
      const q = sp[i]!;
      const dt2 = t - s.col("t0")[i]!;
      const vx = s.col("vx")[i]!;
      const vy = s.col("vy")[i]!;
      q.x = s.col("x0")[i]! + vx * dt2;
      q.y = s.col("y0")[i]! + vy * dt2;
      q.texture = this.atlas.shot[s.col("weapon")[i]!]!;
      q.rotation = Math.atan2(vy, vx);
      const sc = s.col("radius")[i]! / 8;
      q.scaleX = sc;
      q.scaleY = sc;
    }

    // Enemy bullets (computable: position from spawn parameters at the danmaku tick).
    const b = v.packed("bullets");
    const bp = pool(this.bulletPC, b.count, this.atlas.bullet[0]!);
    const frozen = v.has(v.derived("state"), "timestop");
    const grazed = b.col("grazed");
    let nearest = 1e9;
    /** The nearest bullet that can still be grazed (squared distance). */
    let nearestFresh = 1e9;
    let shown = 0;
    for (let i = 0; i < b.count; i++) {
      const q = bp[i]!;
      if (!b.pos(i, td, pos)) {
        q.alpha = 0;
        continue;
      }
      q.x = pos.x;
      q.y = pos.y;
      const ddx = pos.x - p.body.x;
      const ddy = pos.y - p.body.y;
      const dd = ddx * ddx + ddy * ddy;
      if (dd < nearest) nearest = dd;
      if (dd < nearestFresh && !grazed[i]) nearestFresh = dd;
      // Bullets with a life fade out over their last half second.
      q.alpha = dd < viewR * viewR ? Math.min(1, (b.endsAt(i) - td) / 30) : 0;
      if (q.alpha) shown++;
      const style = b.styleAt(i, td);
      // Grazed bullets are drawn spent (dark core): they still hit, but can't be grazed again.
      q.texture = (grazed[i] ? this.atlas.bulletSpent : this.atlas.bullet)[style]!;
      const shape = BULLET_STYLES[style]!.shape;
      if (shape === "star") q.rotation = this.time * 4;
      else if (shape === "orb" || shape === "big") q.rotation = 0;
      else {
        const turn = b.col("turnAt")[i]!;
        const after = turn > 0 && td - b.col("t0")[i]! > turn;
        q.rotation = after ? Math.atan2(b.col("dy2")[i]!, b.col("dx2")[i]!) : Math.atan2(b.col("dy")[i]!, b.col("dx")[i]!);
      }
      q.tint = frozen ? 0x9aa7c7 : 0xffffff;
    }
    void shown;

    // Player, hitbox, graze ring, orbiting orbs.
    // Keep the old target unless the new nearest is clearly closer (FOCUS_SWITCH), so her head doesn't twitch between enemies.
    if (!boss && stickyD >= 0 && stickyD < focusD * FOCUS_SWITCH * FOCUS_SWITCH) {
      focusX = stickyX;
      focusY = stickyY;
    } else if (!boss) this.focusUid = focusUid;
    const invuln = t < p.life.invulnUntil && run.phase !== "over";
    this.player.position.set(p.body.x, p.body.y);
    // Drawn Reimu looks where she moves (ahead when still); the procedural one only flips.
    const reimu = this.art.reimu;
    const liveReimu = this.live.reimu;
    // Her head and eyes follow her focus (full turn at 200 px); her body, lean and gait follow her movement,
    // except that with focus held her facing is locked (the sim's strafe): she turns and leans that way and backpedals.
    // No target: she looks where she walks (her locked facing while focused), else ahead.
    const strafe = p.ctrl.focus;
    const look = focused ? { x: (focusX - p.body.x) / 200, y: (focusY - p.body.y) / 200 } : strafe ? { x: p.body.fx, y: p.body.fy } : { x: p.ctrl.mx / 100, y: p.ctrl.my / 100 };
    this.player.visible = !liveReimu;
    // Standing, walking, or walking slowly with focus held: the rig blends between them.
    if (liveReimu) {
      const ko = this.playerKO;
      // A hit knocks her back: away from where she was heading (or facing, standing still).
      if (!ko) this.koSide = (p.ctrl.mx || look.x) > 0 ? -1 : 1;
      liveReimu.anim.down = ko?.down ?? 0;
      liveReimu.anim.recoil = ko?.recoil ?? 0;
      liveReimu.anim.knock = ko ? this.koSide : 0;
      // Knocked out she lies over the world, out of the death's grey (playerTop).
      const top = ko ? this.playerTop : this.world;
      if (this.playerLive.parent !== top) {
        if (ko) top.addChild(this.playerLive);
        else top.addChildAt(this.playerLive, top.getChildIndex(this.player) + 1);
      }
      const move = ko ? { x: 0, y: 0 } : { x: p.ctrl.mx / 100, y: p.ctrl.my / 100 };
      liveReimu.anim.face = strafe && !ko ? { x: p.body.fx, y: p.body.fy } : null;
      this.drawLive(liveReimu, p.body.x, p.body.y, look.x, look.y, 0.5, 0.55, fdt * (ko?.rate ?? 1), move, p.ctrl.focus && !ko, HITBOX_PART);
      this.tipOver(liveReimu, ko);
    }
    else if (reimu) {
      this.player.texture = lookTexture(reimu, look.x, look.y);
      this.player.scale.set(1, 1);
    } else this.player.scale.set(p.body.fx < -0.1 ? -1 : 1, 1);
    this.player.alpha = run.phase === "over" && run.outcome === "dead" ? Math.max(0, 1 - (t - run.endedAt) / 30) : invuln ? (Math.floor(this.time * 20) % 2 ? 0.35 : 0.9) : 1;
    if (this.playerAlpha !== null) this.player.alpha = this.playerAlpha;
    groupAlpha(this.playerLive, this.player.alpha);
    this.hitbox.position.set(p.body.x, p.body.y);
    // The hitbox and graze ring show near bullets, and always while focused (Shift).
    const near = nearest < 170 * 170 || p.ctrl.focus;
    // Live2D: the brooch she wears on her dress is the hitbox (the rig pins it to the body).
    // Drawn: the classic dot, shown near bullets or focused.
    this.hitbox.visible = near && !liveReimu;
    this.hitDebug.clear();
    if (this.debugHit) {
      const hx = p.body.x;
      const hy = p.body.y;
      this.hitDebug.circle(hx, hy, PLAYER.hitbox).stroke({ width: 0.35, color: 0x00ffff });
      this.hitDebug.moveTo(hx - 6, hy).lineTo(hx + 6, hy).moveTo(hx, hy - 6).lineTo(hx, hy + 6).stroke({ width: 0.25, color: 0x00ffff });
    }
    this.hitbox.rotation = this.time * 3;
    this.fxG.clear();
    // The graze ring (GRAZE_RING): hidden; a plain circle while a grazeable bullet is near
    // (never while invulnerable: no grazing then); a flash on each graze, lerping back.
    this.grazeA *= Math.exp(-dt * 7);
    const nearR = PLAYER.graze + GRAZE_RING.near;
    this.grazeFlashT += fdt;
    if (this.broochGlow && liveReimu) {
      const c = liveReimu.view.partCenter(HITBOX_PART);
      if (c) this.broochGlow.position.set(c[0], c[1]);
      this.broochGlow.alpha = this.grazeA;
      this.broochGlow.scale.set(0.8 + 0.4 * this.grazeA);
    }
    const circle = !invuln && nearestFresh < nearR * nearR;
    const flash = Math.max(0, 1 - this.grazeFlashT / GRAZE_RING.flash) ** 2;
    const baseA = circle ? GRAZE_RING.circleAlpha : 0;
    const ringA = baseA + (GRAZE_RING.flashAlpha - baseA) * flash;
    if (ringA > 0.01) {
      const width = GRAZE_RING.width + (GRAZE_RING.flashWidth - GRAZE_RING.width) * flash;
      this.fxG.circle(p.body.x, p.body.y, PLAYER.graze).stroke({ width, color: 0xffffff, alpha: ringA });
    }
    let orbN = 0;
    const stats = v.derived("stats");
    for (const w of v.derived("weapons")) {
      if (weaponDef(w.weapon.id).behaviour !== "orbit") continue;
      const ws = weaponStats(w.weapon.id, w.weapon.level);
      const count = (ws.count ?? 1) + stats.amount;
      const dist = orbitRadius(ws, stats.area, focusAmount(p.ctrl, t));
      for (let k2 = 0; k2 < count; k2++) {
        let o = this.orbs[orbN];
        if (!o) {
          o = new Sprite(this.atlas.yinyang);
          o.anchor.set(0.5);
          this.world.addChildAt(o, this.world.getChildIndex(this.player));
          this.orbs.push(o);
        }
        const ang = t * (ws.spin ?? 0.06) + (Math.PI * 2 * k2) / count;
        o.visible = true;
        o.position.set(p.body.x + Math.cos(ang) * dist, p.body.y + Math.sin(ang) * dist);
        o.rotation = this.time * 6;
        o.scale.set(((ws.size ?? 12) * stats.area) / 12);
        orbN++;
      }
    }
    for (let i = orbN; i < this.orbs.length; i++) this.orbs[i]!.visible = false;

    this.drawFx(fdt);
    this.drawScreen(W, H, fdt, opts.dim ?? 0);
  }

  private drawFx(fdt: number): void {
    const g = this.over;
    g.clear();
    this.fx = this.fx.filter((f) => (f.age += fdt) < f.dur);
    for (const f of this.fx) {
      const k = f.age / f.dur;
      if (f.kind === "ring") {
        const r = f.r0 + (f.r1 - f.r0) * (1 - (1 - k) * (1 - k));
        g.circle(f.x, f.y, r).stroke({ width: 6 * (1 - k) + 1, color: f.color, alpha: 1 - k });
      } else if (f.kind === "wave") {
        const r = f.r0 + (f.r1 - f.r0) * k;
        g.circle(f.x, f.y, r).fill({ color: f.color, alpha: 0.18 * (1 - k) });
        g.circle(f.x, f.y, r).stroke({ width: 3, color: f.color, alpha: 0.7 * (1 - k) });
      } else if (f.kind === "beam") {
        const dx = f.dx!;
        const dy = f.dy!;
        const w = f.width! * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        const nx = -dy;
        const ny = dx;
        const x2 = f.x + dx * f.len!;
        const y2 = f.y + dy * f.len!;
        const quad = (width: number, color: number, alpha: number): void => {
          const hw = width / 2;
          g.poly([f.x + nx * hw, f.y + ny * hw, x2 + nx * hw, y2 + ny * hw, x2 - nx * hw, y2 - ny * hw, f.x - nx * hw, f.y - ny * hw]).fill({ color, alpha });
        };
        quad(w * 1.4, f.color, 0.35);
        quad(w, f.color, 0.8);
        quad(w * 0.45, 0xffffff, 0.95);
      }
    }
    // Sparks.
    this.sparks = this.sparks.filter((s) => (s.age += fdt) < s.dur);
    const kids = pool(this.sparkPC, this.sparks.length, this.atlas.spark);
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]!;
      s.x += s.vx * fdt * 60;
      s.y += s.vy * fdt * 60;
      s.vx *= 0.92;
      s.vy *= 0.92;
      const q = kids[i]!;
      q.texture = s.star ? this.atlas.star : this.atlas.spark;
      q.x = s.x;
      q.y = s.y;
      const k = 1 - s.age / s.dur;
      q.scaleX = s.size * (0.4 + k * 0.8);
      q.scaleY = q.scaleX;
      q.alpha = k;
      q.tint = s.color;
      q.rotation = s.age * 8;
    }
    // Floaters.
    this.floaters = this.floaters.filter((f) => {
      f.age += fdt;
      if (f.age >= f.dur) {
        f.text.destroy();
        return false;
      }
      const k = f.age / f.dur;
      f.text.position.set(f.x, f.y - 30 * k);
      f.text.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      f.text.scale.set(k < 0.1 ? 0.6 + k * 4 : 1);
      return true;
    });
  }

  private drawScreen(W: number, H: number, fdt: number, dim: number): void {
    const g = this.screenG;
    g.clear();
    this.flashAlpha = Math.max(0, this.flashAlpha - fdt * 2.5);
    if (this.flashAlpha > 0.01) g.rect(0, 0, W, H).fill({ color: this.flashColor, alpha: this.flashAlpha });
    if (dim > 0) g.rect(0, 0, W, H).fill({ color: 0x05070f, alpha: dim });
  }

  /** World position to screen position (for DOM overlays that follow the field). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.world.position.x + x * this.zoom, y: this.world.position.y + y * this.zoom };
  }
}
