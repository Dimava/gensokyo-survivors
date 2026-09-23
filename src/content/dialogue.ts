// VN scripts: who speaks, and what. Speakers are keys of CHARACTERS.

import type { CharacterId } from "./names.ts";

export interface Line {
  speaker: CharacterId;
  text: string;
  /** Which side of the screen the portrait stands on. */
  side: "left" | "right";
}

export const SCRIPTS: Readonly<Record<string, readonly Line[]>> = {
  "cirno-pre": [
    { speaker: "reimu", side: "left", text: "The fog is thicker than usual. And colder. Much colder." },
    { speaker: "cirno", side: "right", text: "Ha! You finally noticed! This whole lake is my territory!" },
    { speaker: "reimu", side: "left", text: "So you're the one sending every fairy in Gensokyo after me." },
    { speaker: "cirno", side: "right", text: "They just follow the strongest. That's me. Obviously." },
    { speaker: "reimu", side: "left", text: "Fine. I'll freeze-dry that ego and get back to my tea." },
    { speaker: "cirno", side: "right", text: "Freeze? You can't out-freeze ME! Get ready to be a shrine-maiden popsicle!" },
  ],
};

export function script(id: string): readonly Line[] {
  const s = SCRIPTS[id];
  if (!s) throw new Error(`unknown dialogue script "${id}"; scripts: ${Object.keys(SCRIPTS).join(", ")}`);
  return s;
}
