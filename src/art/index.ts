// Every character's drawings, by character (or enemy id) and kind ("sprite"
// in the field, "portrait" in dialogue). The atlas and Portrait.vue read
// these; so does the preview tool, `bun scripts/art.ts`. Enemy entries are
// keyed by enemy id (content/enemies.ts), so a new enemy's art is a new row.

import type { Drawing } from "./drawing.ts";
import * as cirno from "./cirno.ts";
import * as reimu from "./reimu.ts";
import * as rumia from "./rumia.ts";
import { bigFairySprite, daiyouseiSprite, duskFairySprite, fairySprite, iceFairySprite } from "./fairies.ts";
import { kedamaSprite, phantomSprite, shadeSprite, sunflowerSprite, yinyangSprite } from "./mobs.ts";

export type ArtKind = "sprite" | "portrait";

export const ART: Record<string, Partial<Record<ArtKind, Drawing>>> = {
  reimu,
  cirno,
  rumia,
  daiyousei: { sprite: daiyouseiSprite },
  duskfairy: { sprite: duskFairySprite },
  bigfairy: { sprite: bigFairySprite },
  fairy: { sprite: fairySprite },
  icefairy: { sprite: iceFairySprite },
  sunflower: { sprite: sunflowerSprite },
  kedama: { sprite: kedamaSprite },
  phantom: { sprite: phantomSprite },
  shade: { sprite: shadeSprite },
  yinyang: { sprite: yinyangSprite },
};
