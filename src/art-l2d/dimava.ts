// Dimava's avatar as a rig (rig.ts), for the credits: Ononoki Yotsugi's hat
// from Monogatari, seen close up on top of her head, recoloured for New Year.
// The hat is the character: a soft orange blob with two googly eyes, a ribbon
// tied on top in a knot with two pointed loops. Under it, her crimson hair and
// the pale parting, drawn as the avatar draws them (src/view/ui/credits/dimava.png).
//
// Motion: the hat bobs and squishes like a blob, the ribbon loops lag and flop
// on springs, and the pupils wobble loosely in their eyes (springs, each eye its own, a
// wobble that settles), drifting different ways. Focus (0..1, driven by
// the view: the pointer just moved) pulls both pupils in to look at it
// together; let go, they wander back to their googly selves. The head stays still.

import { rotation, warp, type Model, type ParamDef, type Part, type Pendulum } from "./rig.ts";
import { grid } from "./kit.ts";

const W = 200;
const H = 200;
/** Where the hat meets the hair (the hat squishes about it) and the knot. */
const BASE: [number, number] = [100, 158];
const KNOT: [number, number] = [98, 91];

const C = {
  bg: "#eaecbb",
  hat: "#eea866",
  hatShade: "#dc8f52",
  hatLight: "#f6c08a",
  crinkle: "#c9783e",
  white: "#ffffff",
  eyeLine: "#b8b0a8",
  pupil: "#7a1a2c",
  hair: "#ae374b",
  hairLine: "#8e2a3c",
  parting: "#f8f4ee",
};

const PARAMS: ParamDef[] = [
  { id: "AngleX", min: -30, max: 30, def: 0 },
  { id: "AngleY", min: -30, max: 30, def: 0 },
  { id: "EyeBallX", min: -1, max: 1, def: 0 },
  { id: "EyeBallY", min: -1, max: 1, def: 0 },
  { id: "Breath", min: 0, max: 1, def: 0 },
  { id: "Bob", min: -1, max: 1, def: 0 },
  { id: "Flap", min: -1, max: 1, def: 0 },
  { id: "LoopL", min: -1, max: 1, def: 0 },
  { id: "LoopR", min: -1, max: 1, def: 0 },
  { id: "PupilLX", min: -1, max: 1, def: 0 },
  { id: "PupilLY", min: -1, max: 1, def: 0 },
  { id: "PupilRX", min: -1, max: 1, def: 0 },
  { id: "PupilRY", min: -1, max: 1, def: 0 },
  { id: "HairSide", min: -1, max: 1, def: 0 },
  { id: "Focus", min: 0, max: 1, def: 0 },
];

/** Springs: the loops trail the hat (a little out of step with each other); the pupils loose enough to wobble, damped enough to settle. */
const PHYSICS: Pendulum[] = [
  { output: "LoopL", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "Bob", weight: 0.8 }], stiffness: 26, damping: 3.4, gain: 2.2 },
  { output: "LoopR", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "Bob", weight: 0.8 }], stiffness: 31, damping: 3.8, gain: 2.2 },
  { output: "PupilLX", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "EyeBallX", weight: 0.6 }], stiffness: 60, damping: 5, gain: 1.7 },
  { output: "PupilLY", inputs: [{ param: "AngleY", weight: 1 / 30 }, { param: "Bob", weight: 0.9 }], stiffness: 55, damping: 4.6, gain: 1.7 },
  { output: "PupilRX", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "EyeBallY", weight: 0.6 }], stiffness: 48, damping: 4.2, gain: 1.7 },
  { output: "PupilRY", inputs: [{ param: "AngleY", weight: 1 / 30 }, { param: "Bob", weight: 1 }], stiffness: 66, damping: 5.2, gain: 1.7 },
  { output: "HairSide", inputs: [{ param: "AngleX", weight: 1 / 30 }], stiffness: 18, damping: 5, gain: 0.8 },
];

const SWAY = [-1, 0, 1];
/** Eye centres, and where each pupil rests when unfocused: the left looks up, the right down and aside. */
const EYE = { L: [82, 127], R: [116, 128] } as const;
const PUPIL_REST = { L: [82, 121], R: [118, 132] } as const;

function deformers() {
  return [
    // The hat bobs (Bob +1: down) and turns a little with the look; the head below does not.
    rotation("hat", undefined, BASE, [
      ["Bob", SWAY],
      ["AngleX", [-30, 0, 30]],
    ], ([b = 0, ax = 0]) => ({ y: b * 2.5, x: (ax / 30) * 3, angle: (ax / 30) * 4 })),
    // A soft blob: sinking squashes it wide, rising stretches it tall; breathing swells it a hair.
    warp("squish", "hat", { x: 0, y: 0, w: W, h: H }, 2, 2, [
      ["Bob", SWAY],
      ["Breath", [0, 1]],
    ], (x, y, [b = 0, br = 0]) => [BASE[0] + (x - BASE[0]) * (1 + 0.05 * b + 0.01 * br), BASE[1] + (y - BASE[1]) * (1 - 0.06 * b + 0.015 * br)]),
    // The eyes turn with the look; each pupil hangs loose in its eye.
    rotation("face", "squish", [100, 127], [["AngleX", [-30, 0, 30]]], ([ax = 0]) => ({ x: (ax / 30) * 5 })),
    ...(["L", "R"] as const).flatMap((s) => {
      const [rx, ry] = PUPIL_REST[s];
      const [cx, cy] = EYE[s];
      return [
        // Focused, the pupil leaves its googly spot for the middle, then looks where the rig looks.
        rotation(`gaze${s}`, "face", [cx, cy], [
          ["Focus", [0, 1]],
          ["EyeBallX", SWAY],
          ["EyeBallY", SWAY],
        ], ([f = 0, ex = 0, ey = 0]) => ({ x: f * (cx - rx + ex * 5), y: f * (cy - ry - ey * 5) })),
        rotation(`pupil${s}`, `gaze${s}`, [cx, cy], [
          [`Pupil${s}X`, SWAY],
          [`Pupil${s}Y`, SWAY],
        ], ([px = 0, py = 0]) => ({ x: px * 4.5, y: py * 4.5 })),
      ];
    }),
    // The ribbon loops swing about the knot, flopping on the idle beat and trailing on their springs.
    rotation("loopL", "squish", KNOT, [
      ["Flap", SWAY],
      ["LoopL", SWAY],
    ], ([f = 0, s = 0]) => ({ angle: -f * 5 + s * 16 })),
    rotation("loopR", "squish", KNOT, [
      ["Flap", SWAY],
      ["LoopR", SWAY],
    ], ([f = 0, s = 0]) => ({ angle: f * 5 + s * 16 })),
    // Her hair sways the smallest bit.
    warp("hair", undefined, { x: 0, y: 140, w: W, h: 60 }, 4, 2, [["HairSide", SWAY]], (x, y, [s = 0]) => [x + s * 2.5 * Math.min(1, (y - 150) / 50), y]),
  ];
}

const ln = (c: string, w: number) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

function parts(): Part[] {
  const bg = `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg}"/>`;
  // Hair: two crimson masses sloping down from under the hat, the pale parting between them.
  const hair = `<path d="M-4 172 C10 160 30 154 52 152 L150 152 C172 154 192 162 206 174 L206 206 L-4 206 Z" fill="${C.hair}"/>
<path d="M78 206 C80 186 90 176 100 175 C112 176 120 186 122 206 Z" fill="${C.parting}"/>
<path d="M18 176 C28 184 34 194 36 206 M40 166 C50 178 56 190 58 206 M160 166 C152 178 146 190 144 206 M184 176 C174 184 168 194 166 206" fill="none" ${ln(C.hairLine, 1.2)} opacity="0.7"/>`;
  const dome = `<defs><radialGradient id="dh" cx="0.42" cy="0.3" r="0.8"><stop offset="0" stop-color="${C.hatLight}"/><stop offset="0.45" stop-color="${C.hat}"/><stop offset="1" stop-color="${C.hatShade}"/></radialGradient></defs>
<path d="M48 158 C42 124 64 94 100 92 C138 94 160 124 152 158 C128 166 72 166 48 158 Z" fill="url(#dh)"/>`;
  const loop = (s: 1 | -1) => {
    const m = (x: number) => (s < 0 ? 196 - x : x);
    const tip = [m(24), 44];
    return `<path d="M${m(96)} 90 C${m(84)} 70 ${m(54)} 52 ${tip[0]} ${tip[1]} C${m(40)} 66 ${m(64)} 90 ${m(92)} 97 Z" fill="${C.hat}"/>
<path d="M${m(92)} 92 C${m(76)} 80 ${m(56)} 66 ${m(34)} 52" fill="none" ${ln(C.hatShade, 1.4)} opacity="0.8"/>
<path d="M${m(88)} 84 L${m(80)} 90 M${m(86)} 94 L${m(78)} 92" fill="none" ${ln(C.crinkle, 1.2)}/>`;
  };
  const knot = `<path d="M88 96 C88 86 94 84 98 84 C104 84 110 86 110 96 C104 100 94 100 88 96 Z" fill="${C.hat}"/>
<path d="M92 88 L96 95 M104 87 L101 95 M98 85 L99 92" fill="none" ${ln(C.crinkle, 1.1)}/>`;
  const eye = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.white}" ${ln(C.eyeLine, 0.9)}/>`;
  const pupil = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="3.8" fill="${C.pupil}"/><circle cx="${cx - 1.2}" cy="${cy - 1.2}" r="0.9" fill="#ffffff" opacity="0.6"/>`;
  return [
    { id: "bg", order: 0, rect: { x: 0, y: 0, w: W, h: H }, mesh: grid(1, 1), svg: bg },
    { id: "hair", parent: "hair", order: 2, rect: { x: -4, y: 150, w: 210, h: 56 }, mesh: grid(4, 2), svg: hair },
    { id: "loopL", parent: "loopL", order: 4, rect: { x: 18, y: 38, w: 84, h: 64 }, mesh: grid(3, 2), svg: loop(1) },
    { id: "loopR", parent: "loopR", order: 4, rect: { x: 94, y: 38, w: 84, h: 64 }, mesh: grid(3, 2), svg: loop(-1) },
    { id: "dome", parent: "squish", order: 6, rect: { x: 40, y: 88, w: 120, h: 76 }, mesh: grid(4, 3), svg: dome },
    { id: "knot", parent: "squish", order: 7, rect: { x: 84, y: 80, w: 30, h: 22 }, mesh: grid(1, 1), svg: knot },
    { id: "eyeL", parent: "face", order: 8, rect: { x: 69, y: 114, w: 26, h: 26 }, mesh: grid(1, 1), svg: eye(82, 127, 11, 11) },
    { id: "eyeR", parent: "face", order: 8, rect: { x: 103, y: 115, w: 26, h: 26 }, mesh: grid(1, 1), svg: eye(116, 128, 11.5, 10.5) },
    // Left looks up, right looks down and aside; the springs rattle them from there.
    ...(["L", "R"] as const).map((s): Part => {
      const [x, y] = PUPIL_REST[s];
      return { id: `pupil${s}`, parent: `pupil${s}`, order: 9, rect: { x: x - 6, y: y - 6, w: 12, h: 12 }, mesh: grid(1, 1), svg: pupil(x, y), mask: `eye${s}` };
    }),
  ];
}

/** The avatar rig (one per page). */
export const dimavaModel: Model = { id: "dimava", w: W, h: H, params: PARAMS, deformers: deformers(), parts: parts(), physics: PHYSICS };

/** Idle cycles per second: the hat's bob and the loops' flop. */
export const DIMAVA_RATE = 0.55;
