// Reimu as a rigged model: her hair, bow, clothes and eye colour, each part
// its own SVG layer on the kit's construction (kit.ts) and hung on the
// standard deformers. Right-hand parts mirror the left ones about x = 220.

import type { Part } from "./rig.ts";
import { bangsArt, brooch, faceParts, grid, ln, mirror, mirrorSvg, model, SKIN, WHITE } from "./kit.ts";

const HAIR = { base: "#3d251a", shade: "#26150f", light: "#6b4634", line: "#140806", top: "#4f3223", bottom: "#2e1b13" };
const RED = { base: "#e0283c", shade: "#a9172b", light: "#ff6470", line: "#5a0a14" };
const GOLD = { base: "#ffd93d", shade: "#e3a51c", light: "#fff3a8", line: "#8a5a08" };
const EYE = { dark: "#4e0f0c", mid: "#9a2c20", light: "#e0633e", pupil: "#250404", lash: "#1c0b0c" };

// ---------------------------------------------------------------- body

const skinArms = `
<path d="M204 384 C186 392 150 396 132 408 C112 420 106 444 104 470 L100 530 L160 530 L162 452 C166 426 180 404 204 396 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M236 384 C254 392 290 396 308 408 C328 420 334 444 336 470 L340 530 L280 530 L278 452 C274 426 260 404 236 396 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M150 440 C154 470 156 500 158 530 L140 530 C142 500 146 468 150 440 Z" fill="${SKIN.shade}"/>
<path d="M290 440 C286 470 284 500 282 530 L300 530 C298 500 294 468 290 440 Z" fill="${SKIN.shade}"/>`;

const neck = `
<path d="M202 312 L202 396 L238 396 L238 312 Z" fill="${SKIN.base}" ${ln(SKIN.line)}/>
<path d="M202 312 C208 336 232 336 238 312 L238 350 C226 358 214 358 202 350 Z" fill="${SKIN.shade}"/>`;

const top = `
<path d="M194 382 C180 398 164 408 160 432 C156 462 162 486 156 506 L148 646 L292 646 L284 506 C278 486 284 462 280 432 C276 408 260 398 246 382 Z" fill="${RED.base}" ${ln(RED.line)}/>
<path d="M160 432 C156 462 162 486 156 506 L148 646 L178 646 C174 580 176 520 182 480 C184 456 176 440 160 432 Z" fill="${RED.shade}"/>
<path d="M280 432 C284 462 278 486 284 506 L292 646 L270 646 C272 590 268 530 266 490 C266 462 270 444 280 432 Z" fill="${RED.shade}"/>
<path d="M214 470 C212 530 214 590 210 646" fill="none" ${ln(RED.shade, 3)}/>
<path d="M232 500 C234 550 232 600 236 646" fill="none" ${ln(RED.shade, 2.5)}/>
<path d="M194 382 C180 398 164 408 160 432 C156 462 162 486 156 506" fill="none" ${ln(WHITE.base, 5)}/>
<path d="M246 382 C260 398 276 408 280 432 C284 462 278 486 284 506" fill="none" ${ln(WHITE.base, 5)}/>
<path d="M194 382 C180 398 164 408 160 432 C156 462 162 486 156 506" fill="none" ${ln(RED.line, 1.5)} stroke-dasharray="5 4" transform="translate(3 1)"/>
<path d="M246 382 C260 398 276 408 280 432 C284 462 278 486 284 506" fill="none" ${ln(RED.line, 1.5)} stroke-dasharray="5 4" transform="translate(-3 1)"/>`;

const collar = `
<path d="M194 374 L220 404 L246 374 L256 390 L220 420 L184 390 Z" fill="${RED.base}" ${ln(RED.line)}/>
<path d="M190 382 L220 414 L250 382" fill="none" ${ln(WHITE.base, 3)}/>
<path d="M202 372 L220 398 L238 372" fill="none" ${ln(RED.shade, 2)}/>`;

const ascot = `
<path d="M214 420 C200 452 196 478 190 500 L208 494 L216 470 Z" fill="${GOLD.base}" ${ln(GOLD.line, 2)}/>
<path d="M226 420 C240 452 244 478 250 500 L232 494 L224 470 Z" fill="${GOLD.base}" ${ln(GOLD.line, 2)}/>
<path d="M210 418 C190 400 172 404 170 418 C170 434 190 440 210 428 Z" fill="${GOLD.base}" ${ln(GOLD.line, 2)}/>
<path d="M230 418 C250 400 268 404 270 418 C270 434 250 440 230 428 Z" fill="${GOLD.base}" ${ln(GOLD.line, 2)}/>
<path d="M176 420 C186 428 198 428 208 424" fill="none" ${ln(GOLD.shade, 2.5)}/>
<path d="M264 420 C254 428 242 428 232 424" fill="none" ${ln(GOLD.shade, 2.5)}/>
<path d="M178 412 C186 406 196 408 204 414" fill="none" ${ln(GOLD.light, 2.5)}/>
<ellipse cx="220" cy="422" rx="13" ry="11" fill="${GOLD.base}" ${ln(GOLD.line, 2)}/>
<ellipse cx="216" cy="418" rx="5" ry="3.5" fill="${GOLD.light}"/>
<path d="M210 470 L196 494 M230 470 L244 494" fill="none" ${ln(GOLD.shade, 2)}/>`;

const sleeveL = `
<path d="M98 468 L164 468 C168 520 176 580 186 646 L58 646 C70 590 86 530 98 468 Z" fill="${WHITE.base}" ${ln(WHITE.line)}/>
<path d="M98 468 C86 530 70 590 58 646 L92 646 C96 590 104 530 112 470 Z" fill="${WHITE.shade}"/>
<path d="M150 470 C156 530 162 590 168 646 L186 646 C176 580 168 520 164 468 Z" fill="${WHITE.shade}"/>
<path d="M98 468 L164 468" fill="none" ${ln(RED.base, 6)}/>
<path d="M100 476 L163 476" fill="none" ${ln(RED.base, 2)} stroke-dasharray="7 5"/>
<path d="M130 470 L112 458 L108 474 Z M130 470 L148 458 L152 474 Z" fill="${RED.base}" ${ln(RED.line, 1.5)}/>
<path d="M130 470 L120 490 M130 470 L140 490" fill="none" ${ln(RED.base, 3)}/>
<circle cx="130" cy="470" r="4" fill="${RED.shade}"/>`;

// ---------------------------------------------------------------- hair

/** Front hair: skull cap and bangs in one layer. Strand tips left to right, with the valleys between them. */
const TIPS: [number, number][] = [
  [114, 306],
  [138, 232],
  [148, 268],
  [160, 216],
  [177, 244],
  [192, 212],
  [206, 280],
  [219, 218],
  [236, 248],
  [250, 212],
  [264, 242],
  [280, 216],
  [293, 268],
  [304, 232],
  [326, 306],
];
const bangs = bangsArt(TIPS, HAIR);

const sideL = `
<path d="M126 232 C112 290 114 350 118 400 C120 440 114 478 128 504 C138 474 150 432 152 392 C154 340 152 290 148 236 Z" fill="${HAIR.base}" ${ln(HAIR.line, 2.4)}/>
<path d="M140 250 C142 300 142 350 138 400 C136 440 132 470 130 492" fill="none" ${ln(HAIR.shade, 2.4)}/>
<path d="M130 260 C126 300 126 340 128 370" fill="none" ${ln(HAIR.light, 2)} opacity="0.7"/>
<path d="M114 380 C124 376 144 376 156 380 L156 408 C144 412 124 412 114 408 Z" fill="${RED.base}" ${ln(RED.line, 2)}/>
<path d="M116 386 L154 386" ${ln(RED.light, 2)} opacity="0.8"/>
<path d="M114 408 L118 420 L124 410 L130 422 L136 410 L142 422 L148 410 L152 420 L156 408 Z" fill="#fff" ${ln(WHITE.line, 1.5)}/>`;

const backHair = `
<path d="M220 130 C132 130 96 196 102 280 C106 350 98 420 84 506 C96 512 108 504 118 516 C128 504 140 512 152 502 L160 400 L280 400 L288 502 C300 512 312 504 322 516 C332 504 344 512 356 506 C342 420 334 350 338 280 C344 196 308 130 220 130 Z" fill="${HAIR.base}" ${ln(HAIR.line, 2.6)}/>
<path d="M150 240 C140 320 146 420 130 500 M290 240 C300 320 294 420 310 500" fill="none" ${ln(HAIR.shade, 3)}/>
<path d="M150 250 C170 236 270 236 290 250 L290 404 L150 404 Z" fill="${HAIR.shade}"/>`;

const tail = `<path d="M206 128 C170 136 130 160 104 196 L80 244 L100 232 L106 254 C120 214 152 170 212 142 Z" fill="${RED.shade}" ${ln(RED.line, 2)}/>
<path d="M200 136 C168 150 138 180 116 214" fill="none" ${ln(RED.base, 3)} opacity="0.8"/>`;
const bow = `
${tail}${mirrorSvg(tail)}
<defs><radialGradient id="wg" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="${RED.light}"/><stop offset="0.5" stop-color="${RED.base}"/><stop offset="1" stop-color="${RED.shade}"/></radialGradient></defs>
<path d="M208 118 C180 94 140 72 110 80 C100 104 102 150 114 170 C146 162 184 146 208 132 Z" fill="${RED.base}" ${ln(RED.line, 2.4)}/>
<path d="M232 118 C260 94 300 72 330 80 C340 104 338 150 326 170 C294 162 256 146 232 132 Z" fill="${RED.base}" ${ln(RED.line, 2.4)}/>
<path d="M206 128 C184 124 150 132 118 162 C148 156 180 144 206 134 Z M234 128 C256 124 290 132 322 162 C292 156 260 144 234 134 Z" fill="${RED.shade}"/>
<path d="M204 116 C186 102 160 90 132 86 M236 116 C254 102 280 90 308 86" fill="none" ${ln(RED.light, 3)} opacity="0.55"/>
<path d="M160 88 C150 108 148 132 152 152 M280 88 C290 108 292 132 288 152" fill="none" ${ln(RED.shade, 2)} opacity="0.7"/>
<path d="M110 80 L100 88 L106 96 L98 106 L106 114 L98 124 L106 132 L98 142 L106 150 L100 160 L114 170 C104 150 102 104 110 80 Z" fill="#fff" ${ln(WHITE.line, 1.6)}/>
<path d="M330 80 L340 88 L334 96 L342 106 L334 114 L342 124 L334 132 L342 142 L334 150 L340 160 L326 170 C336 150 338 104 330 80 Z" fill="#fff" ${ln(WHITE.line, 1.6)}/>
<rect x="204" y="104" width="32" height="38" rx="10" fill="url(#wg)" ${ln(RED.line, 2.4)}/>
<path d="M210 112 Q220 108 230 112" fill="none" ${ln("#fff", 2)} opacity="0.5"/>`;

// ---------------------------------------------------------------- parts

const parts: Part[] = [
  { id: "backHair", parent: "back", order: 1, rect: { x: 76, y: 122, w: 288, h: 402 }, mesh: grid(8, 10), svg: backHair },
  { id: "bow", parent: "bow", order: 2, rect: { x: 90, y: 66, w: 260, h: 180 }, mesh: grid(10, 6), svg: bow },
  { id: "skin", parent: "body", order: 10, rect: { x: 94, y: 376, w: 252, h: 160 }, mesh: grid(8, 4), svg: skinArms },
  { id: "neck", parent: "neckTop", order: 11, rect: { x: 196, y: 306, w: 48, h: 96 }, mesh: grid(2, 4), svg: neck },
  { id: "top", parent: "body", order: 12, rect: { x: 140, y: 370, w: 160, h: 272 }, mesh: grid(6, 8), svg: top },
  { id: "sleeveL", parent: "body", order: 13, rect: { x: 50, y: 450, w: 142, h: 192 }, mesh: grid(4, 4), svg: sleeveL },
  { id: "collar", parent: "body", order: 14, rect: { x: 176, y: 366, w: 88, h: 60 }, mesh: grid(3, 2), svg: collar },
  { id: "ascot", parent: "body", order: 15, rect: { x: 164, y: 396, w: 112, h: 110 }, mesh: grid(4, 4), svg: ascot },
  // The yin-yang brooch on the knot: the item her field sprite wears as its hitbox.
  { id: "charm", parent: "body", order: 16, rect: { x: 176, y: 379, w: 88, h: 88 }, mesh: grid(2, 2), svg: brooch(220, 423, 16) },
  ...faceParts({ eye: EYE, brow: HAIR.base }),
  { id: "sideL", parent: "side", order: 50, rect: { x: 104, y: 226, w: 56, h: 284 }, mesh: grid(2, 10), svg: sideL },
  { id: "bangs", parent: "bangs", order: 52, rect: { x: 98, y: 118, w: 244, h: 192 }, mesh: grid(10, 8), svg: bangs },
];
parts.push(mirror(parts.find((p) => p.id === "sleeveL")!), mirror(parts.find((p) => p.id === "sideL")!));

export const reimu = model("reimu", parts);
