// Cirno as a rigged model on the kit (kit.ts): short light-blue hair, a big
// blue bow, blue eyes, a white blouse with puffed sleeves under a blue
// pinafore, a red ribbon, and six ice wings fanned behind her back.

import type { Part } from "./rig.ts";
import { bangsArt, faceParts, grid, ln, mirror, mirrorSvg, model, SKIN, WHITE } from "./kit.ts";

const HAIR = { base: "#7cc8ff", shade: "#4f9fe0", light: "#d2f0ff", line: "#1d4a88", top: "#a4dcff", bottom: "#5eaaf0" };
const BLUE = { base: "#3d7cf0", shade: "#2556b8", light: "#79a8ff", line: "#12306e" };
const BOW = { base: "#2f6fe0", shade: "#1d4aa8", light: "#6d9cff", line: "#0e2a66" };
const RED = { base: "#e0314b", shade: "#a9172b", line: "#5a0a14" };
const ICE = { base: "#c8f4ff", edge: "#6fd2ff", light: "#ffffff" };
const EYE = { dark: "#0d2c6a", mid: "#2f6fd0", light: "#86ccff", pupil: "#081838", lash: "#101a30" };

// ---------------------------------------------------------------- body

/** One ice crystal from the root, at an angle (degrees, 180 = straight left) and length. */
function crystal(x: number, y: number, a: number, len: number): string {
  const w = len * 0.13;
  return `<g transform="translate(${x} ${y}) rotate(${a})">
<path d="M0 0 L${len * 0.3} ${-w} L${len} 0 L${len * 0.3} ${w} Z" fill="${ICE.base}" ${ln(ICE.edge, 2.2)} opacity="0.93"/>
<path d="M${len * 0.3} ${-w} L${len * 0.3} ${w} M6 0 L${len * 0.85} 0" fill="none" ${ln(ICE.light, 2)} opacity="0.85"/>
<path d="M${len * 0.3} ${-w} L${len} 0 L${len * 0.3} 0 Z" fill="${ICE.edge}" opacity="0.25"/></g>`;
}
const wingsL = [crystal(188, 440, -148, 150), crystal(188, 452, -174, 172), crystal(188, 466, 160, 136)].join("");

const skinArms = `
<path d="M114 436 C108 480 104 540 100 646 L150 646 C152 560 156 500 160 446 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M326 436 C332 480 336 540 340 646 L290 646 C288 560 284 500 280 446 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M150 470 C150 540 148 600 146 646 L134 646 C138 590 142 530 150 470 Z" fill="${SKIN.shade}"/>
<path d="M290 470 C290 540 292 600 294 646 L306 646 C302 590 298 530 290 470 Z" fill="${SKIN.shade}"/>`;

const neck = `
<path d="M202 312 L202 396 L238 396 L238 312 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M202 312 C208 336 232 336 238 312 L238 350 C226 358 214 358 202 350 Z" fill="${SKIN.shade}"/>`;

const blouse = `
<path d="M196 382 C176 392 152 398 140 414 L150 470 L290 470 L300 414 C288 398 264 392 244 382 Z" fill="${WHITE.base}" ${ln(WHITE.line)}/>
<path d="M160 420 C170 440 180 456 190 470 L150 470 Z M280 420 C270 440 260 456 250 470 L290 470 Z" fill="${WHITE.shade}"/>`;

const dress = `
<path d="M166 440 C190 448 250 448 274 440 C278 470 282 500 280 520 L298 646 L142 646 L160 520 C158 500 162 470 166 440 Z" fill="${BLUE.base}" ${ln(BLUE.line)}/>
<path d="M166 440 C162 470 158 500 160 520 L142 646 L176 646 C176 580 180 520 184 470 C182 456 176 446 166 440 Z" fill="${BLUE.shade}"/>
<path d="M274 440 C278 470 282 500 280 520 L298 646 L276 646 C272 580 264 520 262 470 C264 456 268 446 274 440 Z" fill="${BLUE.shade}"/>
<path d="M170 446 C194 454 246 454 270 446" fill="none" ${ln(BLUE.light, 3)} opacity="0.8"/>
<path d="M212 480 C210 540 206 600 204 646 M232 500 C234 560 236 600 238 646" fill="none" ${ln(BLUE.shade, 2.5)}/>`;

const puffL = `
<path d="M188 392 C150 390 112 404 106 436 C104 452 120 462 140 460 C160 458 176 452 184 440 Z" fill="${WHITE.base}" ${ln(WHITE.line)}/>
<path d="M112 440 C126 452 150 454 176 444 L180 452 C160 462 128 464 110 452 Z" fill="${WHITE.shade}"/>
<path d="M150 400 C144 414 142 428 146 444 M128 412 C124 424 124 436 128 448" fill="none" ${ln(WHITE.shade, 2)}/>
<path d="M112 452 C128 466 158 466 180 454" fill="none" ${ln(BLUE.base, 5)}/>`;

const collar = `
<path d="M198 378 C184 392 176 404 184 414 C198 416 212 404 220 392 C228 404 242 416 256 414 C264 404 256 392 242 378 Z" fill="${WHITE.base}" ${ln(WHITE.line, 2)}/>`;

const ribbon = `
<path d="M218 402 C204 390 186 390 184 402 C184 414 204 416 218 408 Z M222 402 C236 390 254 390 256 402 C256 414 236 416 222 408 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<path d="M214 408 L204 440 L214 436 L218 410 Z M226 408 L236 440 L226 436 L222 410 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<rect x="212" y="398" width="16" height="14" rx="5" fill="${RED.shade}" ${ln(RED.line, 2)}/>`;

// ---------------------------------------------------------------- hair

const backHair = `
<path d="M220 130 C132 130 100 196 104 270 C106 310 110 340 116 370 L128 356 L138 378 L152 360 L166 384 L182 366 L200 388 L220 372 L240 388 L258 366 L274 384 L288 360 L302 378 L312 356 L324 370 C330 340 334 310 336 270 C340 196 308 130 220 130 Z" fill="${HAIR.base}" ${ln(HAIR.line, 2.6)}/>
<path d="M150 250 C170 236 270 236 290 250 L288 356 L274 376 L258 360 L240 380 L220 366 L200 380 L182 360 L166 376 L152 356 Z" fill="${HAIR.shade}"/>
<path d="M132 240 C126 290 126 330 130 360 M308 240 C314 290 314 330 310 360" fill="none" ${ln(HAIR.shade, 2.5)}/>`;

const sideL = `
<path d="M124 230 C110 272 112 312 120 348 C124 340 128 336 132 344 C140 316 148 280 148 236 Z" fill="${HAIR.base}" ${ln(HAIR.line, 2.4)}/>
<path d="M138 250 C138 290 136 316 130 336" fill="none" ${ln(HAIR.shade, 2.2)}/>
<path d="M128 256 C124 286 124 306 126 322" fill="none" ${ln(HAIR.light, 2)} opacity="0.8"/>`;

const TIPS: [number, number][] = [
  [114, 300],
  [136, 232],
  [148, 264],
  [160, 218],
  [176, 248],
  [192, 214],
  [210, 272],
  [222, 216],
  [240, 250],
  [254, 212],
  [268, 246],
  [284, 218],
  [294, 262],
  [304, 232],
  [326, 300],
];

const bowLobe = `<path d="M208 110 C184 78 146 62 118 72 C108 96 112 132 126 150 C156 144 186 130 208 124 Z" fill="${BOW.base}" ${ln(BOW.line, 2.4)}/>
<path d="M206 118 C184 116 154 124 128 144 C156 140 184 130 206 124 Z" fill="${BOW.shade}"/>
<path d="M196 100 C176 84 152 76 132 78" fill="none" ${ln(BOW.light, 3)} opacity="0.6"/>`;
const bow = `${bowLobe}${mirrorSvg(bowLobe)}
<path d="M210 124 L196 160 L208 156 L216 128 Z M230 124 L244 160 L232 156 L224 128 Z" fill="${BOW.shade}" ${ln(BOW.line, 2)}/>
<rect x="204" y="98" width="32" height="34" rx="10" fill="${BOW.base}" ${ln(BOW.line, 2.4)}/>
<path d="M210 106 Q220 102 230 106" fill="none" ${ln("#fff", 2)} opacity="0.45"/>`;

// ---------------------------------------------------------------- parts

const parts: Part[] = [
  { id: "wingsL", parent: "body", order: 0, rect: { x: 10, y: 330, w: 190, h: 220 }, mesh: grid(4, 4), svg: wingsL },
  { id: "backHair", parent: "back", order: 1, rect: { x: 96, y: 122, w: 248, h: 272 }, mesh: grid(8, 8), svg: backHair },
  { id: "bow", parent: "bow", order: 2, rect: { x: 100, y: 56, w: 240, h: 112 }, mesh: grid(8, 4), svg: bow },
  { id: "skin", parent: "body", order: 10, rect: { x: 94, y: 430, w: 252, h: 216 }, mesh: grid(8, 4), svg: skinArms },
  { id: "neck", parent: "neckTop", order: 11, rect: { x: 196, y: 306, w: 48, h: 96 }, mesh: grid(2, 4), svg: neck },
  { id: "blouse", parent: "body", order: 12, rect: { x: 134, y: 376, w: 172, h: 100 }, mesh: grid(6, 3), svg: blouse },
  { id: "dress", parent: "body", order: 13, rect: { x: 136, y: 434, w: 168, h: 212 }, mesh: grid(6, 6), svg: dress },
  { id: "puffL", parent: "body", order: 14, rect: { x: 98, y: 384, w: 92, h: 90 }, mesh: grid(3, 3), svg: puffL },
  { id: "collar", parent: "body", order: 15, rect: { x: 174, y: 372, w: 92, h: 48 }, mesh: grid(3, 2), svg: collar },
  { id: "ribbon", parent: "body", order: 16, rect: { x: 180, y: 386, w: 80, h: 58 }, mesh: grid(3, 2), svg: ribbon },
  ...faceParts({ eye: EYE, brow: HAIR.shade }),
  { id: "sideL", parent: "side", order: 50, rect: { x: 104, y: 224, w: 50, h: 128 }, mesh: grid(2, 6), svg: sideL },
  { id: "bangs", parent: "bangs", order: 52, rect: { x: 98, y: 118, w: 244, h: 192 }, mesh: grid(10, 8), svg: bangsArt(TIPS, HAIR) },
];
parts.push(...["wingsL", "puffL", "sideL"].map((id) => mirror(parts.find((p) => p.id === id)!)));

export const cirno = model("cirno", parts);
