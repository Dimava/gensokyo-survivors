// Rumia as a rigged model on the kit (kit.ts): a blonde bob with a red
// talisman ribbon on one side, red eyes, a white long-sleeved shirt under a
// black vest, and a red necktie.

import type { Part } from "./rig.ts";
import { bangsArt, faceParts, grid, ln, mirror, model, SKIN, WHITE } from "./kit.ts";

const HAIR = { base: "#f6dc6a", shade: "#d9b640", light: "#fff6c4", line: "#7a5a10", top: "#ffeb96", bottom: "#e6c24c" };
const BLACK = { base: "#2a2534", shade: "#1a1622", light: "#4a4258", line: "#0c0a10" };
const RED = { base: "#e0314b", shade: "#a9172b", light: "#ff7080", line: "#5a0a14" };
const EYE = { dark: "#5a0810", mid: "#b8182e", light: "#ff6464", pupil: "#2a0206", lash: "#1c0a0c" };

// ---------------------------------------------------------------- body

const neck = `
<path d="M202 312 L202 396 L238 396 L238 312 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M202 312 C208 336 232 336 238 312 L238 350 C226 358 214 358 202 350 Z" fill="${SKIN.shade}"/>`;

/** The shirt: body and long sleeves in one piece, under the vest. */
const shirt = `
<path d="M204 384 C186 392 150 396 132 408 C112 420 106 444 104 470 L96 646 L344 646 L336 470 C334 444 328 420 308 408 C290 396 254 392 236 384 Z" fill="${WHITE.base}" ${ln(WHITE.line)}/>
<path d="M150 440 C154 500 156 580 156 646 L134 646 C138 580 144 500 150 440 Z" fill="${WHITE.shade}"/>
<path d="M290 440 C286 500 284 580 284 646 L306 646 C302 580 296 500 290 440 Z" fill="${WHITE.shade}"/>
<path d="M120 430 C116 470 112 540 112 600 M320 430 C324 470 328 540 328 600" fill="none" ${ln(WHITE.shade, 2)}/>`;

const vestL = `
<path d="M204 392 C184 400 164 406 156 420 C150 470 154 560 150 646 L214 646 L214 520 C212 480 210 440 204 392 Z" fill="${BLACK.base}" ${ln(BLACK.line)}/>
<path d="M156 420 C150 470 154 560 150 646 L168 646 C170 570 168 480 170 430 Z" fill="${BLACK.shade}"/>
<path d="M200 404 C196 440 200 490 204 540" fill="none" ${ln(BLACK.light, 2.5)} opacity="0.8"/>`;

const collar = `
<path d="M198 378 L220 400 L242 378 L252 398 L234 414 L220 404 L206 414 L188 398 Z" fill="${WHITE.base}" ${ln(WHITE.line, 2)}/>`;

const tie = `
<path d="M213 404 L227 404 L224 416 L216 416 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<path d="M216 416 L224 416 L230 470 L220 484 L210 470 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<path d="M220 418 L222 470" fill="none" ${ln(RED.shade, 2)}/>`;

// ---------------------------------------------------------------- hair

const backHair = `
<path d="M220 130 C132 130 100 196 104 270 C106 306 112 336 124 360 C132 350 140 356 146 366 C154 356 160 360 170 370 C190 380 250 380 270 370 C280 360 286 356 294 366 C300 356 308 350 316 360 C328 336 334 306 336 270 C340 196 308 130 220 130 Z" fill="${HAIR.base}" ${ln(HAIR.line, 2.6)}/>
<path d="M150 250 C170 236 270 236 290 250 L286 364 C260 378 180 378 154 364 Z" fill="${HAIR.shade}"/>
<path d="M134 250 C128 290 130 330 138 356 M306 250 C312 290 310 330 302 356" fill="none" ${ln(HAIR.shade, 2.5)}/>`;

/** Side hair curls in toward the jaw (a bob). */
const sideL = `
<path d="M124 230 C110 272 112 316 126 346 C132 356 146 356 152 346 C146 336 142 324 146 300 C150 280 150 258 148 236 Z" fill="${HAIR.base}" ${ln(HAIR.line, 2.4)}/>
<path d="M138 250 C136 290 134 318 140 340" fill="none" ${ln(HAIR.shade, 2.2)}/>
<path d="M126 262 C122 290 124 312 130 330" fill="none" ${ln(HAIR.light, 2)} opacity="0.8"/>`;

const TIPS: [number, number][] = [
  [114, 300],
  [138, 234],
  [150, 262],
  [162, 220],
  [178, 250],
  [194, 216],
  [212, 268],
  [224, 218],
  [240, 254],
  [256, 214],
  [270, 250],
  [284, 220],
  [294, 262],
  [304, 234],
  [326, 300],
];

/** The talisman ribbon on her left (the viewer's right), above the ear. */
const charm = `
<path d="M312 176 C326 158 344 156 350 166 C354 178 336 188 316 184 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<path d="M308 180 C300 158 304 142 316 140 C328 142 324 164 312 182 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<path d="M312 184 L322 222 L314 218 L308 226 L306 186 Z" fill="${RED.shade}" ${ln(RED.line, 2)}/>
<circle cx="311" cy="181" r="6" fill="${RED.shade}" ${ln(RED.line, 2)}/>
<path d="M320 168 C330 164 340 164 344 168" fill="none" ${ln(RED.light, 2)} opacity="0.7"/>`;

// ---------------------------------------------------------------- parts

const parts: Part[] = [
  { id: "backHair", parent: "back", order: 1, rect: { x: 96, y: 122, w: 248, h: 256 }, mesh: grid(8, 8), svg: backHair },
  { id: "neck", parent: "neckTop", order: 11, rect: { x: 196, y: 306, w: 48, h: 96 }, mesh: grid(2, 4), svg: neck },
  { id: "shirt", parent: "body", order: 12, rect: { x: 90, y: 378, w: 260, h: 268 }, mesh: grid(8, 6), svg: shirt },
  { id: "vestL", parent: "body", order: 13, rect: { x: 144, y: 386, w: 76, h: 260 }, mesh: grid(3, 6), svg: vestL },
  { id: "collar", parent: "body", order: 15, rect: { x: 182, y: 372, w: 76, h: 48 }, mesh: grid(3, 2), svg: collar },
  { id: "tie", parent: "body", order: 16, rect: { x: 204, y: 398, w: 32, h: 90 }, mesh: grid(1, 3), svg: tie },
  ...faceParts({ eye: EYE, brow: HAIR.shade }),
  { id: "sideL", parent: "side", order: 50, rect: { x: 104, y: 224, w: 54, h: 138 }, mesh: grid(2, 6), svg: sideL },
  { id: "bangs", parent: "bangs", order: 52, rect: { x: 98, y: 118, w: 244, h: 192 }, mesh: grid(10, 8), svg: bangsArt(TIPS, HAIR) },
  { id: "charm", parent: "bow", order: 54, rect: { x: 296, y: 134, w: 62, h: 98 }, mesh: grid(2, 3), svg: charm },
];
parts.push(...["vestL", "sideL"].map((id) => mirror(parts.find((p) => p.id === id)!)));

export const rumia = model("rumia", parts);
