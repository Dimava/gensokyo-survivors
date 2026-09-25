// Fairies on the chibi kit (chibi.ts): a bell dress that dominates the
// silhouette, hair that contrasts with it, small translucent wings, and
// options for the bigger ones (butterfly wings, a ponytail, a held
// sunflower). Every piece is a separate layer on the chibi deformers.

import type { Model, Part } from "./rig.ts";
import { bangsArt, grid, ln, SKIN, WHITE, type HairPalette } from "./kit.ts";
import { chibiFace, chibiModel, cMirrorSvg, FROM_PORTRAIT, LW, pair, type ChibiFace } from "./chibi.ts";

export type WingKind = "soft" | "ice" | "leaf" | "dusk" | "butterfly" | "dotted" | "none";

export interface Cloth {
  base: string;
  shade: string;
  line: string;
}

export interface FairyOpts {
  hair: HairPalette;
  dress: Cloth;
  /** Hem and cuff trim. */
  trim: string;
  face: ChibiFace;
  wings: WingKind;
  /** Where the back hair ends (model y). */
  back?: number;
  /** Head ribbon colour (none: no ribbon). */
  ribbon?: string;
  /** Collar bow colour. */
  bow?: string;
  ponytail?: string;
  sunflower?: boolean;
  /** Sleeves: small puffed ones (default), Reimu's detached miko sleeves, or arms spread wide. */
  sleeves?: "puff" | "detached" | "spread";
  /** Sleeve colour when it differs from the dress. */
  sleeve?: Cloth;
  /** A hair tube on each side lock (Reimu), in this colour. */
  sideTube?: string;
  /** A big bow on top of the head, behind the hair. */
  bigBow?: { base: string; shade: string; line: string; frill?: boolean };
  /** A soft glow behind her (Rumia's darkness). */
  aura?: string;
  /** Front hair strand tips in portrait coordinates (kit.ts), default a fairy fringe. */
  tips?: [number, number][];
  extra?: Part[];
}

/** A fringe with a longer strand between the eyes, in portrait coordinates. */
export const FAIRY_TIPS: [number, number][] = [
  [116, 298],
  [138, 232],
  [150, 262],
  [162, 220],
  [178, 250],
  [194, 216],
  [212, 268],
  [224, 218],
  [240, 252],
  [256, 214],
  [270, 250],
  [284, 220],
  [292, 262],
  [304, 232],
  [324, 298],
];

// ---------------------------------------------------------------- wings (left side; the right mirrors)

function crystal(x: number, y: number, a: number, len: number): string {
  const w = len * 0.15;
  return `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 L${len * 0.3} ${-w} L${len} 0 L${len * 0.3} ${w} Z" fill="#c8f4ff" ${ln("#5cc4f4", 2.4)} opacity="0.95"/><path d="M4 0 L${len * 0.8} 0" ${ln("#ffffff", 2)} opacity="0.9"/></g>`;
}

const WINGS: Record<Exclude<WingKind, "none">, string> = {
  soft: `<path d="M98 122 C82 98 52 84 36 94 C28 110 48 128 96 130 Z" fill="#eef9ff" opacity="0.85" ${ln("#7ab8f0", 2.6)}/>
<path d="M96 134 C74 138 52 152 56 166 C68 172 86 156 98 138 Z" fill="#eef9ff" opacity="0.85" ${ln("#7ab8f0", 2.6)}/>
<path d="M92 124 C76 110 58 102 46 102" fill="none" ${ln("#ffffff", 2)} opacity="0.8"/>`,
  ice: [crystal(96, 124, -150, 64), crystal(96, 130, -174, 74), crystal(96, 138, 158, 58)].join(""),
  leaf: `<path d="M98 124 C80 92 40 78 28 96 C22 116 56 132 96 132 Z" fill="#c4f5cc" opacity="0.8" ${ln("#3fa85a", 2.6)}/>
<path d="M96 134 C70 142 46 162 54 176 C70 180 88 160 98 140 Z" fill="#c4f5cc" opacity="0.8" ${ln("#3fa85a", 2.6)}/>
<path d="M94 126 C74 112 50 100 36 100 M94 138 C80 150 66 162 58 172" fill="none" ${ln("#6cc885", 2)}/>`,
  dusk: `<path d="M98 122 C82 90 42 76 26 92 C30 102 22 110 30 116 C40 114 38 126 50 126 C60 122 70 132 96 130 Z" fill="#4a2f7a" opacity="0.9" ${ln("#9a74e0", 2.6)}/>
<path d="M96 134 C72 140 50 156 54 172 C64 168 70 176 78 168 C86 160 92 150 98 140 Z" fill="#4a2f7a" opacity="0.9" ${ln("#9a74e0", 2.6)}/>
<path d="M92 122 C74 104 54 94 38 94" fill="none" ${ln("#b89cf0", 1.8)} opacity="0.7"/>`,
  butterfly: `<defs><radialGradient id="bw" cx="0.85" cy="0.85" r="0.9"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#eaf4ff"/><stop offset="1" stop-color="#8cbaf4"/></radialGradient></defs>
<path d="M98 120 C86 72 42 28 12 40 C0 66 26 108 96 128 Z" fill="url(#bw)" opacity="0.92" ${ln("#5a86c8", 2.8)}/>
<path d="M96 134 C66 140 30 166 40 192 C62 200 88 168 98 140 Z" fill="url(#bw)" opacity="0.92" ${ln("#5a86c8", 2.8)}/>
<path d="M92 118 C76 90 50 60 26 48 M94 138 C76 152 58 170 48 186" fill="none" ${ln("#a8c8f0", 2)}/>
<circle cx="36" cy="62" r="6" fill="#9cc4f8" opacity="0.8"/><circle cx="58" cy="172" r="5" fill="#9cc4f8" opacity="0.8"/>`,
  dotted: `<path d="M98 122 C82 94 50 82 34 92 C26 110 48 128 96 130 Z" fill="#ffc6a6" opacity="0.85" ${ln("#e0805e", 2.6)}/>
<path d="M96 134 C74 138 50 154 54 168 C68 174 86 156 98 138 Z" fill="#ffc6a6" opacity="0.85" ${ln("#e0805e", 2.6)}/>
<g fill="#fff3e4"><circle cx="50" cy="100" r="4"/><circle cx="66" cy="110" r="3"/><circle cx="46" cy="114" r="2.6"/><circle cx="80" cy="118" r="2.4"/><circle cx="66" cy="160" r="3"/><circle cx="78" cy="150" r="2.4"/></g>`,
};

const WING_SCALE: Record<Exclude<WingKind, "none">, number> = { soft: 1.5, ice: 1.3, leaf: 1.45, dusk: 1.45, butterfly: 1.32, dotted: 1.5 };

// ---------------------------------------------------------------- body

function dressArt(d: Cloth, trim: string): string {
  return `<path d="M84 114 C76 118 72 128 70 140 C66 156 60 168 54 180 C70 190 130 190 146 180 C140 168 134 156 130 140 C128 128 124 118 116 114 Z" fill="${d.base}" ${ln(d.line, LW)}/>
<path d="M76 124 C72 136 70 150 64 164 C62 170 58 176 56 180 C62 184 70 186 78 186 C78 168 82 146 86 128 Z" fill="${d.shade}"/>
<path d="M124 124 C128 136 130 150 136 164 C138 170 142 176 144 180 C138 184 132 186 126 186 C124 168 120 146 116 128 Z" fill="${d.shade}"/>
<path d="M57 178 C72 188 128 188 143 178" fill="none" ${ln(trim, 4.5)}/>
<path d="M100 132 L100 176" fill="none" ${ln(d.shade, 2)}/>`;
}

const collar = `<path d="M86 112 C90 122 97 125 100 120 C103 125 110 122 114 112 Z" fill="${WHITE.base}" ${ln(WHITE.line, 2.2)}/>`;
const collarBow = (c: string) =>
  `<path d="M99 123 C92 116 84 118 85 124 C86 130 94 129 99 125 Z M101 123 C108 116 116 118 115 124 C114 130 106 129 101 125 Z" fill="${c}" ${ln("#4a1010", 1.8)}/><circle cx="100" cy="124" r="3" fill="${c}" ${ln("#4a1010", 1.6)}/>`;

function armL(d: Cloth, trim: string): string {
  return `<path d="M78 120 C68 126 62 138 62 150 C66 156 74 154 76 148 L84 126 Z" fill="${d.base}" ${ln(d.line, LW)}/>
<path d="M62 148 C66 154 72 154 76 148" fill="none" ${ln(trim, 3)}/>
<circle cx="67" cy="156" r="5.4" fill="${SKIN.base}" ${ln("#7a4038", 2.4)}/>`;
}

function detachedL(c: Cloth, trim: string): string {
  return `<path d="M76 118 C66 122 60 132 60 142 L78 138 Z" fill="${SKIN.base}" ${ln("#7a4038", 2.4)}/>
<path d="M62 136 L84 132 C88 148 92 164 94 176 L44 180 C48 164 54 150 62 136 Z" fill="${c.base}" ${ln(c.line, LW)}/>
<path d="M62 136 L84 132" fill="none" ${ln(trim, 4)}/>
<path d="M50 168 C60 172 80 172 92 168" fill="none" ${ln(trim, 3)} stroke-dasharray="5 4"/>
<path d="M56 150 C54 160 50 170 48 176" fill="none" ${ln(c.shade, 3)}/>`;
}

function spreadL(c: Cloth): string {
  return `<path d="M82 120 L32 114 C26 120 26 130 32 134 L82 138 Z" fill="${c.base}" ${ln(c.line, LW)}/>
<path d="M36 130 L80 134" fill="none" ${ln(c.shade, 2.4)}/>
<circle cx="25" cy="124" r="7" fill="${SKIN.base}" ${ln("#7a4038", 2.4)}/>`;
}

function tubeArt(h: HairPalette, c: string): string {
  return `<path d="M58 70 C48 96 48 124 52 148 C54 156 60 160 64 150 C68 132 70 112 70 94 C70 86 68 78 66 70 Z" fill="${h.base}" ${ln(h.line, LW)}/>
<path d="M48 112 C54 108 66 108 72 112 L72 126 C66 130 54 130 48 126 Z" fill="${c}" ${ln("#5a0a14", 2.4)}/>
<path d="M48 126 L51 134 L55 127 L59 135 L63 127 L67 135 L72 126 Z" fill="#fff" ${ln("#6d6788", 1.6)}/>`;
}

function bigBowArt(b: { base: string; shade: string; line: string; frill?: boolean }): string {
  const lobe = `<path d="M96 22 C82 6 58 -2 42 6 C36 20 40 40 48 50 C66 46 84 36 96 30 Z" fill="${b.base}" ${ln(b.line, LW)}/>
<path d="M94 28 C80 28 62 34 50 46 C66 42 82 36 94 30 Z" fill="${b.shade}"/>${
    b.frill ? `<path d="M42 6 L36 12 L40 18 L34 24 L40 30 L34 36 L40 42 L36 48 L48 50 C40 40 36 20 42 6 Z" fill="#fff" ${ln("#6d6788", 1.8)}/>` : ""
  }`;
  // Drawn 8 units lower than the head top so the bob never lifts it out of the cell.
  return `<g transform="translate(0 8)">${lobe}${cMirrorSvg(lobe)}<rect x="90" y="14" width="20" height="22" rx="7" fill="${b.base}" ${ln(b.line, LW)}/></g>`;
}

const feet = `<ellipse cx="90" cy="188" rx="7.5" ry="5" fill="#5a3030" ${ln("#2a1010", 2.2)}/><ellipse cx="110" cy="188" rx="7.5" ry="5" fill="#5a3030" ${ln("#2a1010", 2.2)}/>`;

// ---------------------------------------------------------------- hair

function backHairArt(h: HairPalette, b: number): string {
  return `<path d="M100 20 C54 20 40 52 42 86 C42 ${b - 30} 46 ${b - 10} 54 ${b} L62 ${b - 6} L70 ${b + 2} L78 ${b - 6} L100 ${b - 2} L122 ${b - 6} L130 ${b + 2} L138 ${b - 6} L146 ${b} C154 ${b - 10} 158 ${b - 30} 158 86 C160 52 146 20 100 20 Z" fill="${h.base}" ${ln(h.line, LW)}/>
<path d="M66 70 C58 90 58 ${b - 20} 62 ${b - 8} M134 70 C142 90 142 ${b - 20} 138 ${b - 8}" fill="none" ${ln(h.shade, 2.4)}/>`;
}

function sideArt(h: HairPalette): string {
  return `<path d="M60 70 C50 90 50 110 56 124 C60 120 66 116 68 104 C70 94 70 82 68 72 Z" fill="${h.base}" ${ln(h.line, LW)}/>
<path d="M62 80 C58 94 58 106 60 116" fill="none" ${ln(h.light, 2)} opacity="0.8"/>`;
}

const headRibbon = (c: string) =>
  `<path d="M134 34 C140 20 154 18 156 28 C156 38 144 40 136 38 Z M132 36 C122 26 110 30 114 40 C118 48 128 44 132 40 Z" fill="${c}" ${ln("#4a1010", 2.2)}/><circle cx="134" cy="37" r="4" fill="${c}" ${ln("#4a1010", 2)}/>`;

function ponytailArt(h: HairPalette, ribbon: string): string {
  return `<path d="M140 40 C164 42 178 70 174 100 C172 118 176 128 182 136 C166 134 156 120 156 100 C156 80 150 60 138 52 Z" fill="${h.base}" ${ln(h.line, LW)}/>
<path d="M160 60 C166 80 164 104 170 124" fill="none" ${ln(h.shade, 2.4)}/>
<path d="M140 38 L154 28 L156 42 Z M142 44 L156 50 L146 56 Z" fill="${ribbon}" ${ln("#6a4a08", 2)}/>`;
}

const SUNFLOWER = (() => {
  const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="44" cy="${140 - 20}" rx="5.5" ry="11" transform="rotate(${i * 30} 44 140)" fill="#ffd13a" ${ln("#c07a10", 1.8)}/>`).join("");
  return `<path d="M50 150 C58 164 66 176 76 184" fill="none" ${ln("#3a9a3a", 4)}/>
<path d="M62 168 C70 160 80 162 82 166 C76 172 68 172 62 168 Z" fill="#4ab84a" ${ln("#2a7a2a", 1.8)}/>
${petals}<circle cx="44" cy="140" r="11" fill="#7a4a1a" ${ln("#4a2a08", 2)}/>
<g fill="#4a2a08"><circle cx="40" cy="137" r="1.6"/><circle cx="47" cy="136" r="1.6"/><circle cx="44" cy="143" r="1.6"/><circle cx="49" cy="143" r="1.4"/><circle cx="39" cy="144" r="1.4"/></g>`;
})();

// ---------------------------------------------------------------- model

export function fairyParts(o: FairyOpts): Part[] {
  const b = o.back ?? 130;
  const parts: Part[] = [];
  if (o.wings !== "none") {
    // Small wings are drawn tucked in and scaled out about the root so they clear the hair.
    const k = WING_SCALE[o.wings];
    const svg = `<g transform="translate(98 128) scale(${k}) translate(-98 -128)">${WINGS[o.wings]}</g>`;
    parts.push(...pair({ id: "wingL", parent: "wingL", order: 0, rect: { x: -40, y: -16, w: 142, h: 216 }, mesh: grid(4, 4), svg }));
  }
  parts.push(
    { id: "backHair", parent: "back", order: 1, rect: { x: 36, y: 14, w: 128, h: b - 6 }, mesh: grid(4, 5), svg: backHairArt(o.hair, b) },
    { id: "feet", parent: "feet", order: 9, rect: { x: 78, y: 178, w: 44, h: 18 }, mesh: grid(2, 1), svg: feet },
    { id: "dress", parent: "body", order: 12, rect: { x: 48, y: 108, w: 104, h: 86 }, mesh: grid(4, 4), svg: dressArt(o.dress, o.trim) },
    ...pair(
      o.sleeves === "detached"
        ? { id: "armL", parent: "armL", order: 13, rect: { x: 38, y: 112, w: 60, h: 74 }, mesh: grid(2, 3), svg: detachedL(o.sleeve ?? o.dress, o.trim) }
        : o.sleeves === "spread"
          ? { id: "armL", parent: "armL", order: 13, rect: { x: 12, y: 106, w: 76, h: 40 }, mesh: grid(3, 1), svg: spreadL(o.sleeve ?? o.dress) }
          : { id: "armL", parent: "armL", order: 13, rect: { x: 56, y: 114, w: 32, h: 50 }, mesh: grid(2, 2), svg: armL(o.sleeve ?? o.dress, o.trim) },
    ),
    { id: "collar", parent: "body", order: 14, rect: { x: 82, y: 108, w: 36, h: 20 }, mesh: grid(2, 1), svg: collar },
    ...chibiFace(o.face),
    ...pair(
      o.sideTube
        ? { id: "sideL", parent: "side", order: 50, rect: { x: 42, y: 66, w: 34, h: 98 }, mesh: grid(1, 5), svg: tubeArt(o.hair, o.sideTube) }
        : { id: "sideL", parent: "side", order: 50, rect: { x: 46, y: 66, w: 28, h: 62 }, mesh: grid(1, 4), svg: sideArt(o.hair) },
    ),
    { id: "bangs", parent: "bangs", order: 52, rect: { x: 42, y: 14, w: 116, h: 92 }, mesh: grid(6, 5), svg: `<g transform="${FROM_PORTRAIT}">${bangsArt(o.tips ?? FAIRY_TIPS, o.hair, 2.4)}</g>` },
  );
  if (o.bigBow) parts.push({ id: "bigBow", parent: "bow", order: 2, rect: { x: 28, y: 2, w: 144, h: 62 }, mesh: grid(4, 2), svg: bigBowArt(o.bigBow) });
  if (o.aura)
    parts.push({
      id: "aura",
      parent: "bob",
      order: -1,
      rect: { x: 0, y: 0, w: 200, h: 200 },
      mesh: grid(1, 1),
      svg: `<defs><radialGradient id="au" cx="0.5" cy="0.5" r="0.5"><stop offset="0.3" stop-color="${o.aura}" stop-opacity="0.75"/><stop offset="1" stop-color="${o.aura}" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="104" r="96" fill="url(#au)"/>`,
    });
  if (o.bow) parts.push({ id: "collarBow", parent: "body", order: 15, rect: { x: 80, y: 112, w: 40, h: 22 }, mesh: grid(2, 1), svg: collarBow(o.bow) });
  if (o.ribbon) parts.push({ id: "ribbon", parent: "bow", order: 55, rect: { x: 106, y: 14, w: 56, h: 34 }, mesh: grid(2, 2), svg: headRibbon(o.ribbon) });
  if (o.ponytail) parts.push({ id: "ponytail", parent: "side", order: 3, rect: { x: 132, y: 22, w: 56, h: 118 }, mesh: grid(2, 5), svg: ponytailArt(o.hair, o.ponytail) });
  if (o.sunflower) parts.push({ id: "sunflower", parent: "armL", order: 20, rect: { x: 18, y: 112, w: 68, h: 78 }, mesh: grid(3, 3), svg: SUNFLOWER });
  parts.push(...(o.extra ?? []));
  return parts;
}

export function fairy(id: string, o: FairyOpts): Model {
  return chibiModel(id, fairyParts(o));
}

