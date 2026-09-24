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
  "rumia-pre": [
    { speaker: "reimu", side: "left", text: "It's the middle of the afternoon. Why is it getting dark?" },
    { speaker: "rumia", side: "right", text: "Is that so~? I can't see a thing in here." },
    { speaker: "reimu", side: "left", text: "Then stop walking around inside your own darkness." },
    { speaker: "rumia", side: "right", text: "But you look tasty, shrine maiden. Are you a human I can eat?" },
    { speaker: "reimu", side: "left", text: "The shrine maiden is the one human you cannot eat. Let me show you why." },
    { speaker: "rumia", side: "right", text: "Is that so~? Then I'll just have to try!" },
  ],
};

export function script(id: string): readonly Line[] {
  const s = SCRIPTS[id];
  if (!s) throw new Error(`unknown dialogue script "${id}"; scripts: ${Object.keys(SCRIPTS).join(", ")}`);
  return s;
}
