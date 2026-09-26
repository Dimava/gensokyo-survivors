// Life for a rig: it eases toward where it is told to look (a Look, as the
// drawn art uses), blinks at random intervals, breathes, sways a little on
// its own, talks when asked, and runs the hair physics. Pure: no DOM, so the
// same motion can be stepped in tests or pre-rendered.

import type { Look } from "../art/drawing.ts";
import { soft, type Rig } from "./rig.ts";
import { BLINK, RATE } from "./tempo.ts";

/** Look (-1..1) to parameter scale. */
const ANGLE = 30;
const BODY = 8;

/**
 * The chibi arms (Animator.arms), in parameter units: ArmL ±1 turns an arm
 * ±18 degrees about its shoulder, ArmLBend ±1 curls its far end ±24.
 */
const ARM = {
  /** Walking (and walking slowly), each arm swings in turn with the stride, this far behind the feet (radians of the stride). */
  swing: 0.42,
  slowSwing: 0.2,
  swingLag: 0.35,
  /** Moving, the hands trail a little behind, per unit of speed. */
  drag: 0.12,
  slowDrag: 0.05,
  /** Walking slowly (focus), they are drawn in close and the forearms tucked. */
  tuck: -0.28,
  tuckBend: -0.22,
  /**
   * A hit flings them out, and throws them up past the swing (ArmLFall: ±1 is
   * ±60 degrees), the arm away from the hit more than the one toward it (the
   * body is driven out from under them): `skew` of it one way and the other.
   */
  fling: 0.85,
  flingFall: 0.35,
  flingSkew: 0.25,
  flingFallSkew: 0.45,
  /**
   * Down, gravity has them: the arm on the ground side flops open onto it,
   * the other falls across her (ArmLFall), on a loose spring that lets them
   * bounce once as she lands; the forearms go limp.
   */
  ground: 0.45,
  over: -0.75,
  fallK: 55,
  fallC: 4.8,
  groundBend: 0.15,
  overBend: -0.4,
  /** Standing, the breath lifts them (the right a beat after the left) and each drifts on a slow sway of its own. */
  breath: [0.06, 0.05],
  breathLag: 0.9,
  drift: 0.05,
  bendDrift: 0.07,
  /** The forearm spring (about 2.6 swings a second, damped to one clear overshoot) and how much of its lag shows as bend. */
  foreK: 260,
  foreC: 13.5,
  foreGain: 1.6,
  /** An arm that jumps more than `snap` in one frame (a hit) takes its forearm `carry` of the rest of the way at once: the hand trails without the arm kinking. */
  snap: 0.1,
  carry: 0.85,
  /** Standing, now and then one arm lifts a touch on its own and settles back: how high, for how long, and the wait between. */
  fidget: 0.2,
  fidgetTime: 1.1,
  fidgetWait: [4, 9],
};

/** The span of `down` over which a chibi's wince gives way to swirls (she lands at 0.55). */
const DIZZY = [0.56, 0.64] as const;

/** Standing (field sprites), every few seconds she shifts her weight the other way: a slight lean, degrees of head tilt and body turn, eased at `ease`/s. */
const SHIFT = { tilt: 3, turn: 2.5, ease: 2.2, wait: [4, 8] };

/**
 * The trail of the loose things as she moves: how far each streams back per
 * unit of speed (`w`), carried by a spring of its own (stiffness `k`, damping
 * `c`: all damped to one clear overshoot), the short locks quicker than the
 * long ones. Setting off they stream back over a moment; stopping, each
 * swings on past and settles, the long back hair last.
 */
const TRAIL: [string, { w: number; k: number; c: number }][] = [
  ["HairFront", { w: 0.4, k: 45, c: 5.4 }],
  ["HairSide", { w: 1, k: 22, c: 3.8 }],
  ["HairBack", { w: 0.9, k: 16, c: 3.2 }],
  ["Ribbon", { w: 1.1, k: 30, c: 4.4 }],
  ["Sleeve", { w: 0.9, k: 40, c: 5.1 }],
];

export class Animator {
  /** Where the character should look; the head eases toward it. */
  target: Look = { x: 0, y: 0 };
  /** Open and close the mouth as if speaking. */
  talking = false;
  /** Idle motion (breath, blinks, drift); off gives a still pose for snapshots. */
  idle = true;
  /** Idle cycles per second (wing flaps, bobbing, orb spin); 0 for portraits. */
  rate = 0;
  /**
   * How it moves: the move vector (its length is the speed fraction, 0 = standing)
   * and whether slowly (focus). Standing, walking and slow walking blend in over
   * a few frames: the stride cadence, bob, lean and trailing hair follow the mix.
   */
  move: Look = { x: 0, y: 0 };
  slow = false;
  /** A held facing (a unit vector; focus strafing): the body turns and leans this way while moving, not along the move. */
  face: Look | null = null;
  /**
   * Knocked out (0..1): eyes shut, head drooping, the body sinking, arms and
   * hair hanging slack. `recoil` (0..1) is the flinch of being hit: eyes
   * squeezed, head snapped back, mouth open. The field tips the whole rig over
   * itself (renderer.ts); the springs keep swinging with the fall.
   */
  down = 0;
  recoil = 0;
  /** The side a hit knocks her toward (+1: +x; 0: none): on the recoil her sleeves, ribbon and hair fly the other way. */
  knock = 0;
  /** Blend weights of walking and slow walking (standing is the rest), and the eased move direction. */
  private walkW = 0;
  private slowW = 0;
  private dir: Look = { x: 0, y: 0 };
  /** The eased direction of the motion itself (what hair and sleeves trail from, even while the facing is held). */
  private vel: Look = { x: 0, y: 0 };
  /** The forearm springs, left and right: each trails its arm's swing and overshoots it (`last`: the arm as of the last frame). */
  private readonly forearm = [
    { pos: 0, vel: 0, last: 0 },
    { pos: 0, vel: 0, last: 0 },
  ];
  /** The arms' fall under gravity when she is down (ArmLFall, ArmRFall), left and right. */
  private readonly fall = [
    { pos: 0, vel: 0 },
    { pos: 0, vel: 0 },
  ];
  /** The springs that carry the trail of the hair, ribbon and sleeves (TRAIL order). */
  private readonly trails = TRAIL.map(() => ({ pos: 0, vel: 0 }));
  /** Set by snap: the forearms and trails start at rest where they belong instead of swinging in. */
  private settle = true;
  /** The fidget under way (start time, which arm, how high) and when the next may come. */
  private fidgetAt = -10;
  private fidgetSide = 0;
  private fidgetAmp = 0;
  private fidgetNext = 3;
  /** The weight shift: where it is, where it is going, and when it next changes. */
  private shift = 0;
  private shiftTo = 0;
  private shiftNext = 2;
  private phase = 0;
  private look: Look = { x: 0, y: 0 };
  private eyes: Look = { x: 0, y: 0 };
  private t = 0;
  private nextBlink = 1.5;
  private blinkAt = -10;
  private mouth = 0;

  /** The parameters the rig's own pendulums drive (their outputs are the base the trail is added to; any other starts from rest each frame). */
  private readonly swung: Set<string>;

  constructor(
    readonly rig: Rig,
    private readonly random: () => number = Math.random,
  ) {
    this.swung = new Set(rig.model.physics.map((p) => p.output));
  }

  /** Jump straight to the target (no easing, no physics swing). */
  snap(): void {
    this.look = { ...this.target };
    this.eyes = { ...this.target };
    this.settle = true;
    this.rig.settle();
    this.apply(0);
  }

  step(dt: number): void {
    this.t += dt;
    // Eyes lead, the head follows (critically damped-ish exponential easing).
    const head = 1 - Math.exp(-dt * RATE.headFollow);
    const eye = 1 - Math.exp(-dt * RATE.eyeFollow);
    this.look.x += (this.target.x - this.look.x) * head;
    this.look.y += (this.target.y - this.look.y) * head;
    this.eyes.x += (this.target.x - this.eyes.x) * eye;
    this.eyes.y += (this.target.y - this.eyes.y) * eye;
    // Gait weights and direction ease in and out, never snapping.
    const speed = Math.min(1, Math.hypot(this.move.x, this.move.y));
    const moving = speed > 0.05 && this.down < 0.05;
    const ease = 1 - Math.exp(-dt * RATE.gaitBlend);
    this.walkW += ((moving && !this.slow ? speed : 0) - this.walkW) * ease;
    this.slowW += ((moving && this.slow ? speed : 0) - this.slowW) * ease;
    const heading = this.face ?? this.move;
    const len = Math.hypot(heading.x, heading.y) || 1;
    this.dir.x += ((moving ? heading.x / len : 0) - this.dir.x) * ease;
    this.dir.y += ((moving ? heading.y / len : 0) - this.dir.y) * ease;
    const mlen = Math.hypot(this.move.x, this.move.y) || 1;
    this.vel.x += ((moving ? this.move.x / mlen : 0) - this.vel.x) * ease;
    this.vel.y += ((moving ? this.move.y / mlen : 0) - this.vel.y) * ease;
    const stand = Math.max(0, 1 - this.walkW - this.slowW);
    // Strides per second: brisk walking, a deliberate slow walk, or the idle cycle.
    this.phase += dt * (stand * this.rate + this.walkW * RATE.walk + this.slowW * RATE.slowWalk);
    const hurt = Math.max(this.down, this.recoil);
    const talk = this.talking ? 0.5 + 0.5 * Math.sin(this.t * RATE.talkA) * Math.sin(this.t * RATE.talkB) : 0;
    this.mouth += (Math.max(0, talk, this.recoil * 0.9, this.down * 0.25) - this.mouth) * (1 - Math.exp(-dt * (hurt > 0 ? 30 : 20)));
    this.apply(dt);
  }

  private apply(dt: number): void {
    const r = this.rig;
    const drift = this.idle ? { x: Math.sin(this.t * RATE.driftX) * 0.05, y: Math.sin(this.t * RATE.driftY) * 0.04 } : { x: 0, y: 0 };
    const lx = this.look.x + drift.x;
    const ly = this.look.y + drift.y;
    r.set("AngleX", lx * ANGLE);
    r.set("AngleY", -ly * ANGLE);
    r.set("AngleZ", -lx * ly * 12 + (this.idle ? Math.sin(this.t * RATE.tilt) * 2 : 0));
    r.set("BodyAngleX", lx * BODY);
    r.set("EyeBallX", this.eyes.x);
    r.set("EyeBallY", -this.eyes.y);
    r.set("Breath", this.idle ? 0.5 + 0.5 * Math.sin(this.t * RATE.breath) : 0);
    r.set("MouthOpen", this.mouth);
    let open = 1;
    if (this.idle) {
      if (this.t >= this.nextBlink) {
        this.blinkAt = this.t;
        this.nextBlink = this.t + BLINK.minWait + this.random() * (BLINK.maxWait - BLINK.minWait);
      }
      // Close fast, open a little slower.
      const s = this.t - this.blinkAt;
      open = s < BLINK.close ? 1 - s / BLINK.close : s < BLINK.close + BLINK.open ? (s - BLINK.close) / BLINK.open : 1;
    }
    // Hurt faces (chibis): squeezed "> <" while the hit lasts and she flies,
    // then, as she lands (down past 0.55, fx-death.ts), swirls for eyes,
    // slowly turning: swapped in five frames or so, as a drawn change of
    // expression, rather than the two faint over each other through the fall.
    const dizzy = smooth((this.down - DIZZY[0]) / (DIZZY[1] - DIZZY[0]));
    // Hurt: the eyes squeeze shut and stay shut while she is down (and behind the swirls).
    open = Math.min(open, 1 - Math.min(1, Math.max(this.recoil * 1.6, this.down * 1.4, dizzy)));
    r.set("EyeLOpen", open);
    r.set("EyeROpen", open);
    if ("Wince" in r.params) {
      r.set("Wince", this.recoil * (1 - dizzy));
      r.set("Dizzy", dizzy);
      r.set("DizzySpin", (this.t * 0.6) % 1);
    }
    const walk = this.walkW;
    const slow = this.slowW;
    const stand = Math.max(0, 1 - walk - slow);
    const a = this.phase * Math.PI * 2;
    if (this.idle && (this.rate > 0 || walk + slow > 0.01)) {
      cycle(r, this.phase, false);
      // Walking bobs twice a stride (once per step); standing floats gently.
      r.set("Bob", stand * 0.9 * Math.sin(a - 0.4) + walk * 0.9 * Math.sin(2 * a) + slow * 0.35 * Math.sin(2 * a));
      r.set("Step", (walk + slow * 0.7) * Math.sin(a));
    }
    // Lean into the move: the body turns and tilts toward it, more at full speed; standing, the weight shifts now and then.
    const lean = this.dir.x;
    const w = this.weight(dt, stand);
    r.set("AngleZ", (r.params.AngleZ ?? 0) - lean * (12 * walk + 5 * slow) + w * SHIFT.tilt);
    // (Looking far to one side while walking that way would turn the body past its range: it eases into it.)
    r.set("BodyAngleX", 10 * soft((lx * BODY + lean * (7 * walk + 3 * slow) + w * SHIFT.turn) / 10));
    const down = this.down;
    const recoil = this.recoil;
    // The ground is the side she was knocked to (+x for knock +1, the side the field tips her onto).
    const g = this.knock < 0 ? -1 : 1;
    if (down > 0 || recoil > 0) {
      // The head snaps back on the hit (tilting away from it), then droops; the body sinks and goes still.
      r.set("AngleY", (r.params.AngleY ?? 0) * (1 - down) + recoil * ANGLE * 0.9 - down * ANGLE * 0.8);
      r.set("AngleZ", (r.params.AngleZ ?? 0) * (1 - down) + down * 14 - recoil * 6 * g);
      r.set("BodyAngleX", (r.params.BodyAngleX ?? 0) * (1 - down));
      r.set("Bob", (r.params.Bob ?? 0) * (1 - down) - down + recoil * 0.6);
      r.set("Step", (r.params.Step ?? 0) * (1 - down));
      r.set("Breath", (r.params.Breath ?? 0) * (1 - down * 0.8));
    }
    // The move across, eased: the physics' input for all that trails (chibis).
    if ("MoveX" in r.params) r.set("MoveX", this.vel.x * (walk + slow * 0.5));
    // The springs. A frame with no time passing (a hit-stop) holds them where
    // they are, lagging the pose that jumped, so the additions below land on
    // the same base however many times it is drawn.
    r.step(dt);
    // Hair, ribbons and sleeves trail opposite the motion (not the held facing),
    // each on a spring of its own, and swing with the stride.
    const p = r.params;
    const trail = -this.vel.x * (0.75 * walk + 0.3 * slow);
    const h = Math.max(0, Math.min(dt, 0.05)) / 2;
    const lag = this.trails;
    for (let i = 0; i < TRAIL.length; i++) {
      const { w, k, c } = TRAIL[i]![1];
      const s = lag[i]!;
      const to = trail * w;
      if (this.settle) {
        s.pos = to;
        s.vel = 0;
      }
      if (h > 0)
        for (let j = 0; j < 2; j++) {
          s.vel += (k * (to - s.pos) - c * s.vel) * h;
          s.pos += s.vel * h;
        }
    }
    const swing = (k: number, lag: number) => (walk + slow * 0.5) * k * Math.sin(a - lag);
    const base = (id: string) => (this.swung.has(id) ? (p[id] ?? 0) : 0);
    let front = base("HairFront") + lag[0]!.pos;
    let side = base("HairSide") + lag[1]!.pos + swing(0.2, 1.2);
    let back = base("HairBack") + lag[2]!.pos + swing(0.15, 1.5);
    let ribbon = base("Ribbon") + lag[3]!.pos + swing(0.25, 1.1);
    let sleeve = base("Sleeve") + lag[4]!.pos + swing(0.35, 0.9);
    // The hit flings her sleeves, ribbon and hair back from where she is knocked.
    if (recoil > 0 && this.knock) {
      const k = -this.knock * recoil;
      sleeve += k * 0.95;
      ribbon += k * 0.8;
      side += k * 0.6;
      back += k * 0.5;
      front += k * 0.3;
    }
    // Down: sleeves, ribbon and hair hang slack toward the ground she fell to.
    if (down > 0) {
      sleeve += g * down * 0.7 - sleeve * down * 0.5;
      ribbon += g * down * 0.5;
      side += g * down * 0.45;
      back += g * down * 0.3;
    }
    // All of it eases into its limits rather than pinning there.
    r.set("HairSide", soft(side));
    r.set("HairBack", soft(back));
    r.set("HairFront", soft(front));
    r.set("Ribbon", soft(ribbon));
    r.set("Sleeve", soft(sleeve));
    if ("ArmL" in p) this.arms(dt, stand, walk, slow, a, g);
    this.settle = false;
  }

  /**
   * Standing (field sprites only: portraits keep still), every few seconds
   * she shifts her weight the other way: a slight lean, eased in, that the
   * arms and hair follow through their springs. Returns the lean (-1..1).
   */
  private weight(dt: number, stand: number): number {
    if (!this.idle || this.rate <= 0) return 0;
    const still = stand * (1 - this.down);
    if (still < 0.9) this.shiftNext = Math.max(this.shiftNext, this.t + 1.5);
    else if (this.t >= this.shiftNext) {
      this.shiftTo = (this.shiftTo > 0 ? -1 : 1) * (0.5 + 0.5 * this.random());
      this.shiftNext = this.t + SHIFT.wait[0]! + this.random() * (SHIFT.wait[1]! - SHIFT.wait[0]!);
    }
    this.shift += (this.shiftTo * still - this.shift) * (1 - Math.exp(-dt * SHIFT.ease));
    return this.shift;
  }

  /**
   * Standing, now and then one arm lifts a touch on its own (quickly) and
   * settles back (slowly, the forearm swinging on past): a small fidget, so
   * the arms are never still for long and never move as mirror twins.
   * Returns each arm's lift.
   */
  private fidget(still: number): [number, number] {
    const t = this.t;
    if (still < 0.9) this.fidgetNext = Math.max(this.fidgetNext, t + 1.5);
    else if (t >= this.fidgetNext) {
      this.fidgetAt = t;
      this.fidgetSide = this.random() < 0.5 ? 0 : 1;
      this.fidgetAmp = ARM.fidget * (0.7 + 0.6 * this.random());
      this.fidgetNext = t + ARM.fidgetWait[0]! + this.random() * (ARM.fidgetWait[1]! - ARM.fidgetWait[0]!);
    }
    const u = (t - this.fidgetAt) / ARM.fidgetTime;
    if (u <= 0 || u >= 1) return [0, 0];
    // Up in the first third (easing out), down over the rest (easing in and out).
    const q = u < 0.35 ? 1 - (1 - u / 0.35) ** 2 : 1 - smooth((u - 0.35) / 0.65);
    const v = this.fidgetAmp * q;
    return this.fidgetSide ? [0, v] : [v, 0];
  }

  /**
   * The arms (chibis: ArmL, ArmR, +1 out from the body), on top of their
   * springs (the bob, the body's turn and the move across): standing, each
   * rises a touch with the breath, the right a beat after the left, drifts on
   * a slow sway of its own and now and then fidgets, so the two are never
   * mirror images; walking, they swing in turn with the stride, a beat behind
   * the feet, and trail the motion; walking slowly (focus) they are drawn in
   * close; a hit flings them out; down, the arm on the ground side lies open
   * on the ground and the other drapes over her. The forearms (ArmLBend,
   * ArmRBend) ride stiffer springs on their arms, so every swing ends in a
   * hand that trails and then overshoots once: the overlap and follow-through
   * that keep an arm from moving as one stiff piece. Everything eases into
   * its limits instead of pinning there.
   */
  private arms(dt: number, stand: number, walk: number, slow: number, a: number, g: number): void {
    const r = this.rig;
    const t = this.t;
    const idle = this.idle ? stand * (1 - this.down) : 0;
    const stride = (walk * ARM.swing + slow * ARM.slowSwing) * Math.sin(a - ARM.swingLag);
    const drag = this.vel.x * (walk * ARM.drag + slow * ARM.slowDrag);
    // The flinch of a hit overrides the careful tuck of focus.
    const tuck = slow * (1 - this.recoil);
    const both = tuck * ARM.tuck;
    // Flung by a hit toward +x (g = 1) the body goes out from under the left arm, which flies out the more.
    const fling = (k: number) => this.recoil * ARM.fling * (1 + (k ? -g : g) * ARM.flingSkew);
    const [fl, fr] = this.fidget(idle);
    const breath = (k: number) => ARM.breath[k]! * Math.sin(t * RATE.breath - k * ARM.breathLag);
    const left = both + fling(0) + stride + drag + idle * (breath(0) + ARM.drift * Math.sin(t * 0.83 + 0.5) + fl);
    const right = both + fling(1) - stride - drag + idle * (breath(1) + ARM.drift * Math.sin(t * 0.61 + 2.1) + fr);
    r.set("ArmL", soft((r.params.ArmL ?? 0) + left));
    r.set("ArmR", soft((r.params.ArmR ?? 0) + right));
    const h = Math.max(0, Math.min(dt, 0.05)) / 2;
    // Lying down, gravity: the ground-side arm flops open (+), the upper one falls across her (-), on a loose spring.
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1;
      const to = (side === g ? ARM.ground : ARM.over) * this.down;
      const f = this.fall[k]!;
      if (this.settle) {
        f.pos = to;
        f.vel = 0;
      }
      if (h > 0)
        for (let i = 0; i < 2; i++) {
          f.vel += (ARM.fallK * (to - f.pos) - ARM.fallC * f.vel) * h;
          f.pos += f.vel * h;
        }
      r.set(k ? "ArmRFall" : "ArmLFall", soft(f.pos + this.recoil * ARM.flingFall * (1 - side * g * ARM.flingFallSkew)));
    }
    for (let k = 0; k < 2; k++) {
      const arm = r.params[k ? "ArmR" : "ArmL"] ?? 0;
      const f = this.forearm[k]!;
      if (this.settle) {
        f.pos = arm;
        f.vel = 0;
        f.last = arm;
      }
      // A jump of the arm in one frame (a hit) takes the forearm most of the way at once: the hand trails without the arm kinking.
      const jump = arm - f.last;
      const over = Math.abs(jump) - ARM.snap;
      if (over > 0) f.pos += (jump < 0 ? -over : over) * ARM.carry;
      f.last = arm;
      // Two substeps, as the rig's pendulums (stable at low frame rates); no time passing holds it.
      if (h > 0)
        for (let i = 0; i < 2; i++) {
          f.vel += (ARM.foreK * (arm - f.pos) - ARM.foreC * f.vel) * h;
          f.pos += f.vel * h;
        }
      const side = k ? 1 : -1;
      const own = idle * ARM.bendDrift * Math.sin(t * (k ? 1.23 : 1.07) + k * 1.9);
      const limp = this.down * (side === g ? ARM.groundBend : ARM.overBend);
      r.set(k ? "ArmRBend" : "ArmLBend", soft((f.pos - arm) * ARM.foreGain + tuck * ARM.tuckBend + own + limp));
    }
  }
}

/** Smoothstep on 0..1. */
function smooth(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

/**
 * One idle cycle at `phase` (0..1, wraps): wings up while the body sinks,
 * the hair and ribbons trailing a little behind, orbs turning one step.
 * The field bakes a few phases per look; live rigs run it continuously.
 */
export function cycle(rig: Rig, phase: number, sway = true): void {
  const a = phase * Math.PI * 2;
  rig.set("Flap", Math.sin(a));
  rig.set("Bob", Math.sin(a - 0.4) * 0.9);
  rig.set("Spin", ((phase % 1) + 1) % 1);
  if (!sway) return;
  rig.set("HairFront", Math.sin(a - 1) * 0.25);
  rig.set("HairSide", Math.sin(a - 1.2) * 0.4);
  rig.set("HairBack", Math.sin(a - 1.5) * 0.35);
  rig.set("Ribbon", Math.sin(a - 1.1) * 0.45);
  // The arms flare out as the body sinks and in as it rises, a little behind it, the hands behind them.
  rig.set("ArmL", Math.sin(a - 1) * 0.3);
  rig.set("ArmR", Math.sin(a - 1) * 0.3);
  rig.set("ArmLBend", Math.sin(a - 1.9) * 0.3);
  rig.set("ArmRBend", Math.sin(a - 1.9) * 0.3);
}

/** Default rig parameters for a still pose looking toward `look` (for pre-renders). */
export function pose(rig: Rig, look: Look): void {
  const a = new Animator(rig);
  a.idle = false;
  a.target = look;
  a.snap();
}
