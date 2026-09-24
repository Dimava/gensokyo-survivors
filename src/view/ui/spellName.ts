// Spell names the Touhou way: `Spirit Sign “Fantasy Seal”` is 霊符「夢想封印」,
// a sign and a name. Card faces and the boss declaration set the sign small
// above the name and draw the name inside 「 」; the kanji go on seals and
// watermarks (see refs/spellcards/STYLE.md).

import type { CharacterId } from "../../content/names.ts";

export interface SpellName {
  /** "Spirit Sign", or "" for names without a sign ("Barrier Talisman"). */
  sign: string;
  /** "Fantasy Seal", or the whole name when there is no sign. */
  name: string;
}

export function splitSpell(full: string): SpellName {
  const m = /^(.*?)\s*[“"](.+)[”"]\s*$/.exec(full);
  return m ? { sign: m[1]!, name: m[2]! } : { sign: "", name: full };
}

/** The sign's kanji (Spirit Sign → 霊符), for the watermark. */
const SIGN_KANJI: Record<string, string> = {
  spirit: "霊符",
  love: "恋符",
  time: "時符",
  boundary: "境符",
  ice: "氷符",
  freeze: "凍符",
  snow: "雪符",
  night: "夜符",
  darkness: "闇符",
  moon: "月符",
};

export function signKanji(sign: string): string {
  return SIGN_KANJI[sign.split(" ")[0]!.toLowerCase()] ?? "符";
}

/** The one kanji on each character's seal stamp. */
export const SEAL_KANJI: Record<CharacterId, string> = {
  reimu: "霊",
  marisa: "魔",
  sakuya: "時",
  yukari: "境",
  cirno: "氷",
  rumia: "闇",
  daiyousei: "妖",
};
