// Clawd, Claude Code's mascot, as a small rig (rig.ts) for the credits: the
// blocky terracotta critter of the Claude Code banner, drawn as pixel art in
// SVG rects, that hops, taps its four little legs, blinks, looks around and
// waves its right claw. It can wear the cast's outfits (SUITS): each suit is
// a few more pixel-art parts hung from the same deformers, so a gohei or a
// parasol waves along with the claw that holds it.
//
// The body follows the banner's block glyphs (▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝):
// each glyph quadrant is one cell, drawn 1 wide and 2 tall so the proportions
// match the terminal. Cells are 2x2 "pixels" (P model units each), so the
// outfits can be drawn at twice the body's resolution.

import { rotation, warp, type Model, type ParamDef, type Part, type Rect } from "./rig.ts";
import { grid } from "./kit.ts";

/** One pixel of the art, in model units. */
export const P = 6;
/** Model size, and where the body grid's origin (0, 0) lies. */
const W = 60 * P;
const H = 48 * P;
const OX = 12 * P;
const OY = 26 * P;

export const CLAWD = { body: "#d77757", light: "#e8906f", shade: "#b85f43", leg: "#a9563c", eye: "#1a1414" };

/**
 * The body in pixels (x 0..36, y 0..20): the banner's glyphs as cells of 2x2.
 * `#` body, `+` highlight, `-` shade, `e` eye, `a` arm, `l` leg.
 */
export const CLAWD_PIXELS: readonly string[] = buildBody();

function buildBody(): string[] {
  const rows: string[] = [];
  // Quadrant rows of the banner (x in cells 0..17):
  // q0: body 3..14; q1: body 3..14 with eyes at 5 and 12; q2: arms 1..16; q3: body 3..14; q4: legs 4, 6, 11, 13.
  const q = (fill: (x: number) => string) => Array.from({ length: 18 }, (_, x) => fill(x)).join("");
  const body = (x: number) => x >= 3 && x <= 14;
  const qrows = [
    q((x) => (body(x) ? "+" : ".")),
    q((x) => (x === 5 || x === 12 ? "e" : body(x) ? "#" : ".")),
    q((x) => (body(x) ? "#" : x >= 1 && x <= 16 ? "a" : ".")),
    q((x) => (body(x) ? "-" : ".")),
    q((x) => ([4, 6, 11, 13].includes(x) ? "l" : ".")),
  ];
  // A quadrant is 1 cell wide and 2 tall; a cell is 2x2 pixels: each quadrant is 2 px wide and 4 px tall.
  for (const r of qrows) {
    const line = [...r].map((c) => c + c).join("");
    for (let i = 0; i < 4; i++) rows.push(line);
  }
  // The top row of the body is the highlight, only its upper half; the bottom row shades only its lower half.
  for (let y = 2; y < 4; y++) rows[y] = rows[y]!.replace(/\+/g, "#");
  for (let y = 12; y < 14; y++) rows[y] = rows[y]!.replace(/-/g, "#");
  return rows;
}

// ---------------------------------------------------------------- pixel art

/**
 * Pixel art as SVG rects: `rows` of characters, one per pixel, `.` or space
 * empty; each other character takes its colour from `pal`. Runs on a row
 * merge into one rect. (x, y) is the top-left pixel in body-grid pixels.
 */
export function pixels(rows: readonly string[], pal: Record<string, string>, x = 0, y = 0, unit = P, ox = OX, oy = OY): string {
  let out = "";
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const c = row[i]!;
      if (c === "." || c === " " || !pal[c]) {
        i++;
        continue;
      }
      let n = 1;
      while (row[i + n] === c) n++;
      out += `<rect x="${ox + (x + i) * unit}" y="${oy + (y + j) * unit}" width="${n * unit}" height="${unit}" fill="${pal[c]}"/>`;
      i += n;
    }
  });
  return `<g shape-rendering="crispEdges">${out}</g>`;
}

/** The part of the body grid a set of pixel rows covers, in model units (padded by a pixel). */
function box(rows: readonly string[], x: number, y: number): Rect {
  const w = Math.max(...rows.map((r) => r.length));
  return { x: OX + (x - 1) * P, y: OY + (y - 1) * P, w: (w + 2) * P, h: (rows.length + 2) * P };
}

/** Rows keeping only the characters in `keep` (the rest become empty). */
const only = (rows: readonly string[], keep: string) => rows.map((r) => [...r].map((c) => (keep.includes(c) ? c : ".")).join(""));
/** Rows mirrored left to right. */
export const flipRows = (rows: readonly string[]) => {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r.padEnd(w, ".")].reverse().join(""));
};

const BODY_PAL = { "#": CLAWD.body, "+": CLAWD.light, "-": CLAWD.shade, a: CLAWD.body, l: CLAWD.leg, e: CLAWD.eye };

// ---------------------------------------------------------------- the rig

const PARAMS: ParamDef[] = [
  { id: "AngleX", min: -30, max: 30, def: 0 },
  { id: "AngleY", min: -30, max: 30, def: 0 },
  { id: "EyeBallX", min: -1, max: 1, def: 0 },
  { id: "EyeBallY", min: -1, max: 1, def: 0 },
  { id: "EyeLOpen", min: 0, max: 1, def: 1 },
  { id: "EyeROpen", min: 0, max: 1, def: 1 },
  { id: "Breath", min: 0, max: 1, def: 0 },
  { id: "Bob", min: -1, max: 1, def: 0 },
  { id: "Flap", min: -1, max: 1, def: 0 },
];

const SWAY = [-1, 0, 1];
/** Body-grid pixel -> model units. */
const mx = (x: number) => OX + x * P;
const my = (y: number) => OY + y * P;
const FEET = my(20);
const MID = mx(18);

function deformers() {
  return [
    // A little hop: Bob +1 is down (the animator's float), so the body rises on -1.
    rotation("bob", undefined, [MID, FEET], [["Bob", SWAY]], ([b = 0]) => ({ y: b * 5 })),
    // Breathing: the body swells a touch, about its feet.
    warp("body", "bob", { x: 0, y: 0, w: W, h: H }, 2, 2, [["Breath", [0, 1]]], (x, y, [br = 0]) => [MID + (x - MID) * (1 + 0.012 * br), FEET + (y - FEET) * (1 + 0.035 * br)]),
    // The face turns with the look (the eyes lead a little further).
    rotation("face", "body", [MID, my(6)], [
      ["AngleX", [-30, 0, 30]],
      ["AngleY", [-30, 0, 30]],
    ], ([ax = 0, ay = 0]) => ({ x: (ax / 30) * 1.2 * P, y: (-ay / 30) * 0.8 * P })),
    rotation("look", "face", [MID, my(6)], [
      ["EyeBallX", SWAY],
      ["EyeBallY", SWAY],
    ], ([ex = 0, ey = 0]) => ({ x: ex * 0.6 * P, y: -ey * 0.5 * P })),
    ...(["L", "R"] as const).map((s) =>
      warp(`eye${s}`, "look", { x: mx(s === "L" ? 9 : 23), y: my(3), w: 4 * P, h: 6 * P }, 1, 2, [[`Eye${s}Open`, [0, 1]]], (x, y, [o = 1]) => {
        // Closing squeezes the eye down to its lower quarter: a line.
        const lid = my(7);
        return [x, lid + (y - lid) * (0.18 + 0.82 * o)];
      }),
    ),
    // Hats follow the look, tipping a little.
    rotation("top", "body", [MID, my(0)], [["AngleX", [-30, 0, 30]]], ([ax = 0]) => ({ x: (ax / 30) * 1.5 * P, angle: (ax / 30) * 3 })),
    // The right claw waves (Flap), the left one wiggles; things held in the right claw hang from armR.
    rotation("armR", "body", [mx(30), my(10)], [["Flap", SWAY]], ([f = 0]) => ({ angle: -(14 + 16 * f) })),
    rotation("armL", "body", [mx(6), my(10)], [["Flap", SWAY]], ([f = 0]) => ({ angle: 4 * f })),
    // Wings (fairy suits) beat about the back.
    rotation("wingL", "body", [mx(9), my(6)], [["Flap", SWAY]], ([f = 0]) => ({ angle: 10 * f })),
    rotation("wingR", "body", [mx(27), my(6)], [["Flap", SWAY]], ([f = 0]) => ({ angle: -10 * f })),
    // Tippy-taps: the outer and inner legs of each pair lift in turn.
    ...[0, 1, 2, 3].map((i) =>
      rotation(`leg${i}`, "bob", [mx([8, 12, 22, 26][i]!), my(16)], [["Flap", SWAY]], ([f = 0]) => ({ y: -1.5 * P * Math.max(0, (i % 2 ? -1 : 1) * f) })),
    ),
  ];
}

function bodyParts(): Part[] {
  const rows = CLAWD_PIXELS;
  // The eyes are their own parts (they blink): the body is whole under them.
  const torso = only(rows.map((r) => r.replace(/e/g, "#")), "#+-").slice(0, 16);
  const eyeL = rows.slice(4, 8).map((r) => r.slice(10, 12));
  const eyeR = rows.slice(4, 8).map((r) => r.slice(24, 26));
  // Arms: two cells out from the body, drawn a pixel into it so a turned claw never shows a gap.
  const arm = ["aaaaa", "aaaaa", "aaaaa", "aaaaa"];
  const legs = [8, 12, 22, 26];
  return [
    { id: "armL", parent: "armL", order: 8, rect: box(arm, 2, 8), mesh: grid(1, 1), svg: pixels(arm, BODY_PAL, 2, 8) },
    { id: "armR", parent: "armR", order: 8, rect: box(arm, 29, 8), mesh: grid(1, 1), svg: pixels(arm, BODY_PAL, 29, 8) },
    ...legs.map((x, i): Part => {
      const leg = ["ll", "ll", "ll", "ll", "ll"];
      return { id: `leg${i}`, parent: `leg${i}`, order: 9, rect: box(leg, x, 15), mesh: grid(1, 1), svg: pixels(leg, BODY_PAL, x, 15) };
    }),
    { id: "torso", parent: "body", order: 10, rect: box(torso, 0, 0), mesh: grid(2, 2), svg: pixels(torso, BODY_PAL) },
    { id: "eyeL", parent: "eyeL", order: 12, rect: box(eyeL, 10, 4), mesh: grid(1, 2), svg: pixels(eyeL, BODY_PAL, 10, 4) },
    { id: "eyeR", parent: "eyeR", order: 12, rect: box(eyeR, 24, 4), mesh: grid(1, 2), svg: pixels(eyeR, BODY_PAL, 24, 4) },
  ];
}

// ---------------------------------------------------------------- suits

/** One outfit piece: pixel rows placed at (x, y) in body-grid pixels, hung from a deformer, drawn at `order`. */
interface Piece {
  id: string;
  parent: string;
  order: number;
  at: readonly [number, number];
  rows: readonly string[];
  pal: Record<string, string>;
  /** Extra SVG under the pixels (a soft glow), in model units. */
  under?: string;
  /** Override the texture's rect (for `under` art larger than the pixels). */
  rect?: Rect;
}

const BOW = [
  ".WWWW............WWWW.",
  "WrrrrW..........WrrrrW",
  "WrrrrrWW......WWrrrrrW",
  "WrrrrrrrWWKKWWrrrrrrrW",
  "WrRrrrrrrKKKKrrrrrrRrW",
  "WrRRrrrrrKKKKrrrrrRRrW",
  "WrrrrrrrWWKKWWrrrrrrrW",
  "WrrrrrWW.rKKr.WWrrrrrW",
  ".WWWW...rr..rr...WWWW.",
];

const GOHEI = [
  "...Y...",
  "..WYW..",
  ".WWYWW.",
  ".W.Y.W.",
  "WW.Y.WW",
  ".W.Y.W.",
  "WW.Y.WW",
  "...Y...",
  ...Array.from({ length: 16 }, () => "...y..."),
];

const WITCH_HAT = [
  "......................kK......",
  "....................kKKK......",
  "..................kKKKKK......",
  "................kKKKKKK.......",
  "...............kKKKKKK........",
  "..............kKKKKKKK........",
  ".............kKKKKKKKKK.......",
  "............kKKKKKKKKKKK......",
  "...........kKKKKKKKKKKKKK.....",
  "..........WWWWWWWWWWWWWWWW....",
  "..........WWWWWWWWWWWWWWBWBW..",
  "..........kKKKKKKKKKKKKKKBWB..",
  "kKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  ".KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.",
  "...KKKKKKKKKKKKKKKKKKKKKKKKKKKKK...",
];

const BROOM = [
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "...b.",
  "..rrr",
  ".sssss",
  ".sSsSs",
  "ssSsSss",
  "sSsSsSs",
  "sSsSsSs",
  "ssssss.",
];

const HEADDRESS = [
  ".W.W.W.W.W.W.W.W.W.",
  "WWWWWWWWWWWWWWWWWWW",
  "WgWWgWWgWWgWWgWWgWW",
  ".gggggggggggggggggg.",
];

const KNIVES = [
  "S.....S.....S",
  "sS....S....Ss",
  ".sS...S...Ss.",
  "..sS..S..Ss..",
  "...sS.s.Ss...",
  "....H.H.H....",
  ".....HHH.....",
];

const ICE_BOW = BOW.map((r) => r.replace(/r/g, "b").replace(/R/g, "B").replace(/K/g, "k"));

const ICE_WING = [
  "c.........",
  "Cc........",
  ".CCc......",
  "..CCCc....",
  "...CCCCc..",
  "..........",
  "cCCCCCCCCc",
  "..........",
  "...CCCCc..",
  "..CCCc....",
  ".CCc......",
  "Cc........",
  "c.........",
];

const RIBBON = ["RR...RR", "RrR.RrR", ".RrKrR.", "..KKK..", ".RrKrR.", "RrR.RrR", "RR...RR"];

const MOB_CAP = [
  "........WWWWWWWWWWWW........",
  ".....WWWWWWWWWWWWWWWWWW.....",
  "...WWWWWWpWWWWWWWWpWWWWWW...",
  "..WWWWWWWWWWWWWWWWWWWWWWWW..",
  ".RRRRRRRRRRRRRRRRRRRRRRRRRR.",
  "WpWpWpWpWpWpWpWpWpWpWpWpWpWp",
];

const CAP_BOW = ["RR..RR", "RrRRrR", ".RKKR.", "RrRRrR", "RR..RR"];

const PARASOL = [
  "........PPPP........",
  ".....PPPPpPPPPP.....",
  "...PPPpPPPpPPPpPPP..",
  "..PPPpPPPPpPPPPpPPP.",
  ".PPPpPPPPPpPPPPPpPPP",
  "WPWPWPWPWPWPWPWPWPWP",
  "W.W.W.W.W.W.W.W.W.W.",
  ...Array.from({ length: 22 }, () => ".........D.........."),
];

const PONYTAIL = ["..YY.YY", "..YYYYY", "...YY..", "..GGG..", ".GGGGG.", ".GGgGG.", "..GGgG.", "...GGG.", "....GG.", ".....G."];

const LEAF_WING = [
  "...LLL....",
  ".LLlLLL...",
  "LLlLLLLL..",
  "LLLlLLLLL.",
  ".LLLlLLLLL",
  "..LLLLlLLL",
  "....LLLLL.",
  ".........",
  "..LLLL....",
  ".LLlLLLL..",
  "..LLLlLLL.",
  "....LLLL..",
];

const DARK = "#1a0f2a";

/** The outfits: an id, the name on its toggle, a line for the caption, and its pieces. */
export const SUITS = [
  { id: "clawd", label: "Clawd", as: "", pieces: [] as Piece[] },
  {
    id: "reimu",
    label: "Reimu",
    as: "as the shrine maiden",
    pieces: [
      { id: "bow", parent: "top", order: 20, at: [7, -7], rows: BOW, pal: { W: "#ffffff", r: "#e0314b", R: "#b01e36", K: "#8a1428" } },
      { id: "gohei", parent: "armR", order: 9, at: [29, -14], rows: GOHEI, pal: { Y: "#e8c050", y: "#c89a38", W: "#ffffff" } },
    ],
  },
  {
    id: "marisa",
    label: "Marisa",
    as: "as the ordinary magician",
    pieces: [
      { id: "hat", parent: "top", order: 20, at: [1, -13], rows: WITCH_HAT, pal: { K: "#2a2438", k: "#4a4064", W: "#f4f4f4", B: "#ffffff" } },
      { id: "broom", parent: "armR", order: 7, at: [30, -4], rows: BROOM, pal: { b: "#8a5a2e", r: "#c0303a", s: "#d8b060", S: "#b08838" } },
    ],
  },
  {
    id: "sakuya",
    label: "Sakuya",
    as: "as the perfect maid",
    pieces: [
      { id: "headdress", parent: "top", order: 20, at: [8, -3], rows: HEADDRESS, pal: { W: "#ffffff", g: "#c8cce0" } },
      { id: "knives", parent: "armR", order: 13, at: [28, 1], rows: KNIVES, pal: { S: "#eef2fa", s: "#a8b2c8", H: "#4a3a60" } },
    ],
  },
  {
    id: "cirno",
    label: "Cirno",
    as: "as the strongest",
    pieces: [
      { id: "wingL", parent: "wingL", order: 2, at: [-3, -4], rows: ICE_WING, pal: { C: "#9fe8ff", c: "#e4faff" } },
      { id: "wingR", parent: "wingR", order: 2, at: [29, -4], rows: flipRows(ICE_WING), pal: { C: "#9fe8ff", c: "#e4faff" } },
      { id: "bow", parent: "top", order: 20, at: [7, -7], rows: ICE_BOW, pal: { W: "#ffffff", b: "#3a7fe8", B: "#1f56b8", k: "#163e8a" } },
    ],
  },
  {
    id: "rumia",
    label: "Rumia",
    as: "as the youkai of the dusk",
    pieces: [
      {
        id: "dark",
        parent: "bob",
        order: 1,
        at: [0, 0],
        rows: [],
        pal: {},
        rect: { x: MID - 26 * P, y: my(8) - 16 * P, w: 52 * P, h: 32 * P },
        under: `<defs><radialGradient id="cd" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${DARK}" stop-opacity="0.95"/><stop offset="0.62" stop-color="${DARK}" stop-opacity="0.8"/><stop offset="0.8" stop-color="#6a3aa0" stop-opacity="0.45"/><stop offset="1" stop-color="#6a3aa0" stop-opacity="0"/></radialGradient></defs><ellipse cx="${MID}" cy="${my(8)}" rx="${26 * P}" ry="${16 * P}" fill="url(#cd)"/>`,
      },
      { id: "ribbon", parent: "top", order: 20, at: [5, -4], rows: RIBBON, pal: { R: "#b01e36", r: "#e0314b", K: "#8a1428" } },
    ],
  },
  {
    id: "yukari",
    label: "Yukari",
    as: "as the youkai of boundaries",
    pieces: [
      { id: "cap", parent: "top", order: 20, at: [4, -5], rows: MOB_CAP, pal: { W: "#ffffff", p: "#f4c8dc", R: "#d0304a" } },
      { id: "capBow", parent: "top", order: 21, at: [27, -6], rows: CAP_BOW, pal: { R: "#b01e36", r: "#e0314b", K: "#8a1428" } },
      { id: "parasol", parent: "armR", order: 7, at: [23, -18], rows: PARASOL, pal: { P: "#f4c8dc", p: "#d898b8", W: "#ffffff", D: "#6a4a80" } },
    ],
  },
  {
    id: "daiyousei",
    label: "Daiyousei",
    as: "as the great fairy",
    pieces: [
      { id: "wingL", parent: "wingL", order: 2, at: [-2, -3], rows: LEAF_WING, pal: { L: "#a8f0bc", l: "#6fd88a" } },
      { id: "wingR", parent: "wingR", order: 2, at: [28, -3], rows: flipRows(LEAF_WING), pal: { L: "#a8f0bc", l: "#6fd88a" } },
      { id: "ponytail", parent: "top", order: 20, at: [28, -4], rows: PONYTAIL, pal: { Y: "#ffd84d", G: "#6fd88a", g: "#3fa85a" } },
    ],
  },
] as const satisfies readonly { id: string; label: string; as: string; pieces: readonly Piece[] }[];

export type SuitId = (typeof SUITS)[number]["id"];

const cache = new Map<SuitId, Model>();

/** Clawd wearing a suit (one model per suit, kept: the part images are cached per model). */
export function clawdModel(suit: SuitId = "clawd"): Model {
  let m = cache.get(suit);
  if (m) return m;
  const def = SUITS.find((s) => s.id === suit) ?? SUITS[0];
  const extra = (def.pieces as readonly Piece[]).map(
    (p): Part => ({
      id: `${suit}:${p.id}`,
      parent: p.parent,
      order: p.order,
      rect: p.rect ?? box(p.rows, p.at[0], p.at[1]),
      mesh: grid(2, 2),
      svg: (p.under ?? "") + (p.rows.length ? pixels(p.rows, p.pal, p.at[0], p.at[1]) : ""),
    }),
  );
  m = { id: "clawd", w: W, h: H, params: PARAMS, deformers: deformers(), parts: [...bodyParts(), ...extra], physics: [] };
  cache.set(suit, m);
  return m;
}

/** Idle cycles per second: the wave and the tippy-taps. */
export const CLAWD_RATE = 0.8;

/** A static SVG of Clawd (no rig): for the small ones, with extra pixel art over it in the same grid. */
export function clawdSvg(extra = "", pad: { l: number; t: number; r: number; b: number } = { l: 2, t: 2, r: 2, b: 1 }): string {
  const body = pixels(CLAWD_PIXELS, BODY_PAL, 0, 0, 1, 0, 0);
  const w = 36 + pad.l + pad.r;
  const h = 20 + pad.t + pad.b;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad.l} ${-pad.t} ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${body}${extra}</svg>`;
}

/** Pixel rows at (x, y) in the small-Clawd grid (1 unit per pixel). */
export function clawdExtra(rows: readonly string[], pal: Record<string, string>, x: number, y: number): string {
  return pixels(rows, pal, x, y, 1, 0, 0);
}
