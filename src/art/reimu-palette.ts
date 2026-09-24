// Reimu's colours, shared by the portrait and the sprite so they stay one design.

import type { EyeStyle } from "./paint.ts";

// ---------------------------------------------------------------- palette

export const SKIN = { base: "#fff0e6", shade: "#f6c6b8", deep: "#e59f94", blush: "#ff8f9c", line: "#8a4a44" };
export const HAIR = { base: "#4d3027", shade: "#301c17", hi: "#86604f", shine: "#e2c2ae", line: "#1f0f0c", top: "#5e3b30", bottom: "#3b241e" };
export const RED = { base: "#e3263d", shade: "#ae1530", deep: "#7d0b22", hi: "#ff6272", line: "#56091a" };
export const WHITE = { base: "#ffffff", shade: "#dcd8ef", deep: "#b7b0d6", line: "#5e5480" };
export const GOLD = { base: "#ffdf4a", shade: "#eeb02a", deep: "#c9851a", hi: "#fff7b8", line: "#80520e" };
export const EYES: Omit<EyeStyle, "open" | "lashW" | "detail"> = {
  iris: ["#3a0b12", "#8c2431", "#e0704f"],
  rim: "#24060b",
  pupil: "#1a0407",
  lash: "#1c0c0e",
  lower: "#7a3a36",
  white: "#fffdfb",
  lidShade: "#c9a3b4",
};
