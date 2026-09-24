// Fairies: one chibi body, dressed per kind. Drawn in the 96-unit character
// frame and shown at the enemy's cell size (radius * 2.8 + 8 in the atlas).

import { headShift, type Drawing, type Look } from "./drawing.ts";
import { face, type FaceOpts } from "./face.ts";

interface FairyOpts {
  /** Cell size in game pixels. */
  size: number;
  hair: string;
  hairDark: string;
  dress: string;
  dressDark: string;
  ribbon: string;
  wings: "soft" | "ice" | "leaf" | "dusk";
  eyes: Pick<FaceOpts, "iris" | "pupil">;
  mouth?: FaceOpts["mouth"];
  /** A side ponytail (Daiyousei). */
  ponytail?: boolean;
}

function wings(kind: FairyOpts["wings"]): string {
  switch (kind) {
    case "soft":
      return `
  <ellipse cx="26" cy="54" rx="20" ry="11" transform="rotate(-25 26 54)" fill="#e8f6ff" stroke="#a8d8ff" stroke-width="1.5" opacity="0.8"/>
  <ellipse cx="70" cy="54" rx="20" ry="11" transform="rotate(25 70 54)" fill="#e8f6ff" stroke="#a8d8ff" stroke-width="1.5" opacity="0.8"/>
  <ellipse cx="30" cy="70" rx="13" ry="7" transform="rotate(20 30 70)" fill="#e8f6ff" stroke="#a8d8ff" stroke-width="1.5" opacity="0.7"/>
  <ellipse cx="66" cy="70" rx="13" ry="7" transform="rotate(-20 66 70)" fill="#e8f6ff" stroke="#a8d8ff" stroke-width="1.5" opacity="0.7"/>`;
    case "ice": {
      const c = (x: number, y: number, a: number, len: number) =>
        `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 L${len * 0.25} -4.5 L${len} 0 L${len * 0.25} 4.5 Z" fill="#d4f7ff" stroke="#7fdcff" stroke-width="1.4"/></g>`;
      return c(40, 62, -150, 34) + c(40, 62, -175, 30) + c(56, 62, -30, 34) + c(56, 62, -5, 30);
    }
    case "leaf":
      return `
  <path d="M44 58 C30 30 6 30 4 44 C4 58 26 62 44 60 Z" fill="#c9ffd9" stroke="#5fcf86" stroke-width="1.6" opacity="0.85"/>
  <path d="M52 58 C66 30 90 30 92 44 C92 58 70 62 52 60 Z" fill="#c9ffd9" stroke="#5fcf86" stroke-width="1.6" opacity="0.85"/>
  <path d="M44 62 C30 70 14 82 18 88 C24 92 38 80 44 66 Z" fill="#c9ffd9" stroke="#5fcf86" stroke-width="1.6" opacity="0.75"/>
  <path d="M52 62 C66 70 82 82 78 88 C72 92 58 80 52 66 Z" fill="#c9ffd9" stroke="#5fcf86" stroke-width="1.6" opacity="0.75"/>
  <path d="M44 58 C30 44 16 42 8 44 M52 58 C66 44 80 42 88 44" fill="none" stroke="#5fcf86" stroke-width="1" opacity="0.8"/>`;
    case "dusk":
      return `
  <path d="M44 58 C30 28 4 34 6 50 C10 62 30 62 44 60 Z" fill="#3a2458" stroke="#9a6ad8" stroke-width="1.6" opacity="0.9"/>
  <path d="M52 58 C66 28 92 34 90 50 C86 62 66 62 52 60 Z" fill="#3a2458" stroke="#9a6ad8" stroke-width="1.6" opacity="0.9"/>
  <path d="M44 62 C30 72 16 84 20 90 C28 92 40 80 44 66 Z" fill="#3a2458" stroke="#9a6ad8" stroke-width="1.6" opacity="0.8"/>
  <path d="M52 62 C66 72 80 84 76 90 C68 92 56 80 52 66 Z" fill="#3a2458" stroke="#9a6ad8" stroke-width="1.6" opacity="0.8"/>`;
  }
}

function fairy(o: FairyOpts): Drawing {
  return {
    w: o.size,
    h: o.size,
    scale: 96 / o.size,
    body: (look: Look) => `
  ${wings(o.wings)}
  <!-- back hair -->
  <path d="M28 38 C24 52 26 62 32 64 L64 64 C70 62 72 52 68 38 Z" fill="${o.hairDark}"/>
  ${o.ponytail ? `<path d="M68 30 C84 32 86 52 80 66 C78 56 74 46 66 40 Z" fill="${o.hair}" stroke="${o.hairDark}" stroke-width="1"/>` : ""}
  <!-- dress -->
  <path d="M37 58 L59 58 L68 86 C58 90 38 90 28 86 Z" fill="${o.dress}"/>
  <path d="M28 86 C38 90 58 90 68 86" fill="none" stroke="#ffffff" stroke-width="2.5"/>
  <path d="M43 60 L40 86 M53 60 L56 86" stroke="${o.dressDark}" stroke-width="1.2" opacity="0.6"/>
  <path d="M40 58 L48 64 L56 58 Z" fill="#ffffff"/>
  <path d="M48 62 L43 59 L44 65 Z M48 62 L53 59 L52 65 Z" fill="${o.ribbon}"/>
  <!-- arms -->
  <path d="M38 62 C33 66 31 72 32 76" fill="none" stroke="${o.dress}" stroke-width="6" stroke-linecap="round"/>
  <path d="M58 62 C63 66 65 72 64 76" fill="none" stroke="${o.dress}" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="77.5" r="2.8" fill="#ffeee4"/>
  <circle cx="64" cy="77.5" r="2.8" fill="#ffeee4"/>
  <!-- legs -->
  <ellipse cx="42" cy="91" rx="4.2" ry="2.4" fill="${o.dressDark}"/>
  <ellipse cx="54" cy="91" rx="4.2" ry="2.4" fill="${o.dressDark}"/>
  <g transform="${headShift(look)}">
  <!-- head -->
  <ellipse cx="48" cy="40" rx="21" ry="20" fill="#ffeee4"/>
  <path d="M26 42 C23 24 36 17 48 17 C60 17 73 24 70 42 C67 36 64 33 62 31 C61 36 58 38 55 38 C55 34 53 31 50 29 C48 34 45 37 42 38 C42 34 41 32 39 31 C36 35 32 38 29 40 Z" fill="${o.hair}"/>
  <path d="M26 42 C25 50 27 55 30 58 L32 48 Z M70 42 C71 50 69 55 66 58 L64 48 Z" fill="${o.hair}"/>
  <path d="M36 22 C42 19 52 18 58 21" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <!-- hair ribbon -->
  <path d="M${o.ponytail ? 66 : 62} 24 L${o.ponytail ? 74 : 70} 18 L${o.ponytail ? 74 : 70} 30 Z" fill="${o.ribbon}"/>
  <circle cx="${o.ponytail ? 66 : 62}" cy="24" r="2" fill="${o.ribbon}"/>
  ${face({ ...o.eyes, brow: o.hairDark, mouth: o.mouth ?? "smile" }, look)}
  </g>
  `,
  };
}

export const fairySprite = fairy({
  size: 42,
  hair: "#ffd76a",
  hairDark: "#d9a93a",
  dress: "#5d9dff",
  dressDark: "#3b6fcf",
  ribbon: "#e0314b",
  wings: "soft",
  eyes: { iris: "#3a7fe0", pupil: "#173e86" },
});

export const iceFairySprite = fairy({
  size: 42,
  hair: "#bfeaff",
  hairDark: "#7cc8ff",
  dress: "#8fdcff",
  dressDark: "#4fa8e0",
  ribbon: "#2f6fe0",
  wings: "ice",
  eyes: { iris: "#2f9fe0", pupil: "#123e86" },
  mouth: "grin",
});

export const bigFairySprite = fairy({
  size: 76,
  hair: "#ff9f5a",
  hairDark: "#d9703a",
  dress: "#7bd88f",
  dressDark: "#3f9f5a",
  ribbon: "#ffd84d",
  wings: "leaf",
  eyes: { iris: "#3f9f5a", pupil: "#174a26" },
});

export const daiyouseiSprite = fairy({
  size: 81,
  hair: "#6fd88a",
  hairDark: "#3fa85a",
  dress: "#4f7fe0",
  dressDark: "#2f56b0",
  ribbon: "#ffd84d",
  wings: "leaf",
  eyes: { iris: "#2f8f5a", pupil: "#143a26" },
  ponytail: true,
});

export const duskFairySprite = fairy({
  size: 81,
  hair: "#c8a8ff",
  hairDark: "#8a64d0",
  dress: "#4a2f7a",
  dressDark: "#2e1c52",
  ribbon: "#e0314b",
  wings: "dusk",
  eyes: { iris: "#b02040", pupil: "#4a0a18" },
  mouth: "grin",
});
