// Keyform generators shared by the models: a head layer turns as if its
// points sat at a depth in front of (or behind) the head's centre, so a
// parameter sweep of AngleX/AngleY becomes parallax between layers — the
// face slides further than the skull, the back hair the other way. The
// forms are computed once at the key angles and blended by the rig.

/** Depth (toward the viewer, model units) of a layer at a point. */
export type Depth = (x: number, y: number) => number;

/** A dome: `base` everywhere plus `bulge` at the centre, falling off like a sphere of radius `r`. */
export function dome(cx: number, cy: number, r: number, base: number, bulge: number): Depth {
  return (x, y) => {
    const q = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
    return base + bulge * Math.sqrt(Math.max(0, 1 - q));
  };
}

export const ANGLE_KEYS = [-30, 0, 30];

/** How much of the parameter angle the drawing really turns (anime turns cheat). */
const YAW = 0.55;
const PITCH = 0.4;
/** How much a turn narrows the layer (1 = true orthographic foreshortening). */
const NARROW = 0.5;

/** The point turned by AngleX (yaw, + = toward screen right) and AngleY (pitch, + = up) about a head centre. */
export function turnPoint(x: number, y: number, cx: number, cy: number, z: number, ax: number, ay: number): [number, number] {
  const t = (ax * YAW * Math.PI) / 180;
  const p = (ay * PITCH * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const x1 = dx * (1 - (1 - Math.cos(t)) * NARROW) + z * Math.sin(t);
  const z1 = z * Math.cos(t) - dx * Math.sin(t);
  const y1 = dy * (1 - (1 - Math.cos(p)) * NARROW) - z1 * Math.sin(p);
  return [cx + x1, cy + y1];
}

/** A warp keyform function for a head layer (keys: [AngleX, AngleY]). */
export function turnFn(cx: number, cy: number, depth: Depth): (x: number, y: number, k: number[]) => [number, number] {
  return (x, y, [ax = 0, ay = 0]) => turnPoint(x, y, cx, cy, depth(x, y), ax, ay);
}
