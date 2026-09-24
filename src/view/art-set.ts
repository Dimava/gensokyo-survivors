// Which art set the UI shows: the drawn SVG art (src/art) or the rigged
// models (src/art-l2d), by the "Art style" preference. Rigged models exist
// for portraits only; field sprites and characters without a model always
// use the drawn art.

import { ART_L2D } from "../art-l2d/index.ts";
import type { Model } from "../art-l2d/rig.ts";
import { prefs, type ArtStyle } from "./prefs.ts";

/** The rigged portrait to show for a character, or null for the drawn one. */
export function livePortrait(who: string, style: ArtStyle = prefs.artStyle): Model | null {
  return style === "live2d" ? (ART_L2D[who]?.portrait ?? null) : null;
}
