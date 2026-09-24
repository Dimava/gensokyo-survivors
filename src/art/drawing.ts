// Drawings: character art as SVG markup, so a character is a data file the
// game and the preview tool (scripts/art.ts) both render. A drawing is
// authored at `scale` times its size in the game, which gives the renderer
// crisp pixels at 2x resolution and leaves room for detail.

/** Where a character looks: a direction with length up to 1 (0, 0 is straight at the viewer). */
export interface Look {
  x: number;
  y: number;
}

export const AHEAD: Look = { x: 0, y: 0 };

/** The 9 looks the game pre-renders: ahead, then 8 directions starting east, clockwise (y down). */
export const LOOKS: readonly Look[] = [AHEAD, ...Array.from({ length: 8 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 4), y: Math.sin((i * Math.PI) / 4) }))];

/** The index into LOOKS for a facing vector (ahead when it is short). */
export function lookIndex(x: number, y: number): number {
  if (x * x + y * y < 0.04) return 0;
  const a = Math.atan2(y, x);
  return 1 + (((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8);
}

export interface Drawing {
  /** Size in game pixels (sprites) or CSS pixels (portraits). */
  w: number;
  h: number;
  /** Authoring units per game pixel: the markup's coordinates run 0..w*scale, 0..h*scale. */
  scale: number;
  /** SVG markup inside the root element (defs, shapes), looking toward `look`. */
  body: (look: Look) => string;
  /** Optional construction guides (head, face lines, body landmarks) in the same coordinates, for `bun scripts/art.ts --bones`. */
  bones?: (look: Look) => string;
}

/** The head's shift toward where the character looks, in the 96-unit character frame. */
export function headShift(look: Look): string {
  return `translate(${(look.x * 3).toFixed(2)} ${(look.y * 2).toFixed(2)})`;
}

/** A standalone SVG document for a drawing, rendered at `px` device pixels per game pixel. */
export function svgOf(d: Drawing, px = 1, look: Look = AHEAD): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d.w * px}" height="${d.h * px}" viewBox="0 0 ${d.w * d.scale} ${d.h * d.scale}">${d.body(look)}</svg>`;
}
