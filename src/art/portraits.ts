// Dialogue portraits: one bust (head, neck, shoulders) in a 220x320 frame,
// with each character's hair, outfit and accessories layered on. The face
// is larger and more detailed than the chibi sprites', and follows the look.

import type { Drawing, Look } from "./drawing.ts";

export interface BustOpts {
  id: string;
  skin?: string;
  /** Iris colours: outer, inner (gradient), and the pupil. */
  iris: [string, string];
  pupil: string;
  brow: string;
  mouth: "smile" | "grin" | "o" | "smirk" | "calm";
  /** Layers, back to front. */
  backHair: string;
  outfit: string;
  bangs: string;
  /** Hats, bows, ribbons: drawn last. */
  top?: string;
  /** A soft glow behind the character. */
  glow: string;
}

const SKIN = "#ffe9dc";

function eyes(o: BustOpts, look: Look): string {
  const ex = look.x * 4.5;
  const ey = look.y * 3.5;
  const one = (cx: number, flip: 1 | -1) => `
  <clipPath id="pe-${o.id}-${cx}"><path d="M${cx - 15} 142 C${cx - 14} 124 ${cx + 14} 122 ${cx + 15} 140 C${cx + 15} 156 ${cx - 13} 160 ${cx - 15} 142 Z"/></clipPath>
  <path d="M${cx - 15} 142 C${cx - 14} 124 ${cx + 14} 122 ${cx + 15} 140 C${cx + 15} 156 ${cx - 13} 160 ${cx - 15} 142 Z" fill="#ffffff"/>
  <g clip-path="url(#pe-${o.id}-${cx})">
    <ellipse cx="${cx + ex}" cy="${142 + ey}" rx="11" ry="15" fill="url(#iris-${o.id})"/>
    <ellipse cx="${cx + ex}" cy="${144 + ey}" rx="6" ry="8" fill="${o.pupil}"/>
    <ellipse cx="${cx - 4 + ex}" cy="${135 + ey}" rx="4" ry="5" fill="#ffffff"/>
    <circle cx="${cx + 4 + ex}" cy="${150 + ey}" r="2" fill="#ffffff" opacity="0.85"/>
    <path d="M${cx - 15} 128 L${cx + 15} 128 L${cx + 15} 136 L${cx - 15} 136 Z" fill="#000" opacity="0.12"/>
  </g>
  <path d="M${cx - 17} 140 C${cx - 15} 122 ${cx + 13} 119 ${cx + 17} 136" fill="none" stroke="#2a1618" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M${cx + flip * 16} ${flip > 0 ? 136 : 140} l${flip * 4} -4" stroke="#2a1618" stroke-width="2.5" stroke-linecap="round"/>`;
  return one(86, -1) + one(134, 1);
}

function mouth(kind: BustOpts["mouth"]): string {
  switch (kind) {
    case "smile":
      return `<path d="M103 176 Q110 181 117 176" fill="none" stroke="#b0505a" stroke-width="2.4" stroke-linecap="round"/>`;
    case "grin":
      return `<path d="M100 173 Q110 188 120 173 Z" fill="#b83a4c"/><path d="M102 174 L118 174" stroke="#ffffff" stroke-width="2.5"/><path d="M106 181 Q110 184 114 181" fill="#ff8a9a"/>`;
    case "o":
      return `<ellipse cx="110" cy="178" rx="4" ry="3.5" fill="#b83a4c"/>`;
    case "smirk":
      return `<path d="M103 177 Q111 180 118 173" fill="none" stroke="#b0505a" stroke-width="2.4" stroke-linecap="round"/>`;
    case "calm":
      return `<path d="M105 177 L115 177" stroke="#b0505a" stroke-width="2.2" stroke-linecap="round"/>`;
  }
}

export function bust(o: BustOpts): Drawing {
  const skin = o.skin ?? SKIN;
  return {
    w: 220,
    h: 320,
    scale: 1,
    body: (look) => {
      const hx = look.x * 5;
      const hy = look.y * 3;
      return `
  <defs>
    <radialGradient id="glow-${o.id}" cx="50%" cy="42%" r="58%"><stop offset="0%" stop-color="${o.glow}" stop-opacity="0.5"/><stop offset="100%" stop-color="${o.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="iris-${o.id}" cx="50%" cy="65%" r="60%"><stop offset="0%" stop-color="${o.iris[1]}"/><stop offset="100%" stop-color="${o.iris[0]}"/></radialGradient>
    <linearGradient id="skin-${o.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${skin}"/><stop offset="100%" stop-color="#ffd9c8"/></linearGradient>
  </defs>
  <circle cx="110" cy="150" r="140" fill="url(#glow-${o.id})"/>
  <g transform="translate(${hx} ${hy})">${o.backHair}</g>
  <!-- neck and shoulders -->
  <path d="M96 180 L124 180 L126 214 L94 214 Z" fill="#f4cdb8"/>
  ${o.outfit}
  <g transform="translate(${hx} ${hy})">
    <path d="M48 128 C46 70 78 56 110 56 C142 56 174 70 172 128 C170 170 146 196 110 198 C74 196 50 170 48 128 Z" fill="url(#skin-${o.id})"/>
    <ellipse cx="78" cy="166" rx="12" ry="6" fill="#ff8fa3" opacity="0.45"/>
    <ellipse cx="142" cy="166" rx="12" ry="6" fill="#ff8fa3" opacity="0.45"/>
    ${eyes(o, look)}
    <path d="M72 116 Q86 108 99 114" fill="none" stroke="${o.brow}" stroke-width="3" stroke-linecap="round"/>
    <path d="M121 114 Q134 108 148 116" fill="none" stroke="${o.brow}" stroke-width="3" stroke-linecap="round"/>
    <path d="M110 160 l-2 5 l3 0" fill="none" stroke="#e0a090" stroke-width="1.6" stroke-linecap="round"/>
    ${mouth(o.mouth)}
    ${o.bangs}
    ${o.top ?? ""}
  </g>`;
    },
  };
}
