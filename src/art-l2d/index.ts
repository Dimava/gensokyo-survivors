// The rigged ("Live2D-style") art set, shaped like ART (src/art/index.ts):
// portraits (live busts for dialogue) and sprites (full-body chibis for the
// field and the gallery) by character or enemy id. Ids without a rig keep
// the drawn art; src/view/art-set.ts picks between the sets by preference.

import type { Model } from "./rig.ts";
import { IDLE } from "./tempo.ts";
import { cirnoChibi, reimuChibi, rumiaChibi } from "./chibis.ts";
import { cirno } from "./cirno.ts";
import { reimu } from "./reimu.ts";
import { rumia } from "./rumia.ts";
import { bigFairyRig, daiyouseiRig, duskFairyRig, fairyRig, iceFairyRig, kedamaRig, phantomRig, shadeRig, sunflowerRig, yinyangRig } from "./mobs.ts";

/** A field sprite rig: its game size, and how the field bakes its idle cycle. */
export interface SpriteRig {
  model: Model;
  /** Size in game pixels. */
  w: number;
  h: number;
  /** Frames baked per idle cycle, and cycles per second. */
  frames: number;
  rate: number;
  /** False: the same from every side (orbs), baked once instead of 9 looks. */
  looks: boolean;
}

export interface L2dSet {
  portrait?: Model;
  sprite?: SpriteRig;
}

/** A sprite rig: 4 frames per idle cycle (pixel-game pacing), at its idle rate (tempo.ts). */
const sprite = (model: Model, size: number, h = size): SpriteRig => ({ model, w: size, h, frames: 4, rate: IDLE[model.id] ?? 1, looks: true });

export const ART_L2D: Record<string, L2dSet> = {
  reimu: { portrait: reimu, sprite: sprite(reimuChibi, 52) },
  cirno: { portrait: cirno, sprite: sprite(cirnoChibi, 80) },
  rumia: { portrait: rumia, sprite: sprite(rumiaChibi, 80) },
  fairy: { sprite: sprite(fairyRig, 42) },
  icefairy: { sprite: sprite(iceFairyRig, 42) },
  duskfairy: { sprite: sprite(duskFairyRig, 81) },
  daiyousei: { sprite: sprite(daiyouseiRig, 81) },
  bigfairy: { sprite: sprite(bigFairyRig, 76) },
  sunflower: { sprite: sprite(sunflowerRig, 50) },
  kedama: { sprite: sprite(kedamaRig, 36) },
  phantom: { sprite: sprite(phantomRig, 39) },
  shade: { sprite: sprite(shadeRig, 45) },
  yinyang: { sprite: { model: yinyangRig, w: 64, h: 64, frames: 6, rate: IDLE.yinyang!, looks: false } },
};
