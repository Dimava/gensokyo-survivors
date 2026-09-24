// The "Icon + effect" look: the item's HUD icon, the same at every level, and
// behind or around it a plain effect layer that grows with the level, showing
// what the item gives (a longer arc, a wider ring, one more line or coin).
// 48x48 viewBox; the icon sits in the middle 26 units. Flat: the item's
// colour (currentColor) and white, thin strokes. The Duplex Tome's effect is
// its shadow copies, which its icon already draws (itemIconAt).

const W = "#ffffff";
const st = (c: string, w = 1.8) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const f1 = (v: number) => v.toFixed(1);
const spark = (x: number, y: number, s: number) =>
  `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${W}"/>`;

/** Each effect by item id, at a step 1..5; drawn before (under) the icon. */
const EFFECTS: Record<string, (k: number) => string> = {
  // Might: chevrons rising beside it.
  power: (k) => [...Array(k).keys()].map((i) => `<path d="M40 ${44 - i * 6.5} l3.5 -3.5 3.5 3.5" ${st(W)}/>`).join(""),
  // Max HP: a halo that grows round it.
  heart: (k) => `<circle cx="24" cy="24" r="${14 + k * 1.9}" fill="currentColor" fill-opacity="${0.06 + k * 0.03}" ${st("currentColor", 1.4)} stroke-opacity="0.7"/>`,
  // Speed: lines trailing behind it.
  geta: (k) => {
    const ys = [24, 18, 30, 12, 36];
    return [...Array(k).keys()].map((i) => `<path d="M${2 + (i % 2)} ${ys[i]} h8" ${st(W)}/>`).join("");
  },
  // Cooldown: a fast-forward arc round it, longer each level.
  clock: (k) => {
    const R = 20;
    const a0 = -Math.PI / 2;
    const a1 = a0 + (Math.PI * 2 * 0.9 * k) / 5;
    const p = (a: number, r = R) => `${f1(24 + Math.cos(a) * r)} ${f1(24 + Math.sin(a) * r)}`;
    const b = a1 - 0.26;
    return `<path d="M${p(a0)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} M${p(b, R + 3)} L${p(a1)} L${p(b, R - 3)}" ${st(W)}/>`;
  },
  // Pickup range: a pull ring, wider each level.
  magnet: (k) => `<circle cx="24" cy="24" r="${f1(14 + k * 1.9)}" ${st(W, 1.3)} stroke-dasharray="3 3"/>`,
  // Area: a reach ring spreading out behind it.
  grimoire: (k) => `<circle cx="24" cy="24" r="${f1(12 + k * 2.3)}" fill="currentColor" fill-opacity="0.16" ${st("currentColor", 1.4)}/>`,
  // Graze: the graze ring, a spark more on it each level.
  ribbon: (k) => {
    let out = `<circle cx="24" cy="24" r="20" ${st(W, 1.2)} stroke-opacity="0.7"/>`;
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + 0.5 + i * ((Math.PI * 2) / 5);
      out += spark(24 + Math.cos(a) * 20, 24 + Math.sin(a) * 20, 3);
    }
    return out;
  },
  // Recovery: pluses rising from it.
  gourd: (k) => {
    const at = [
      [38, 34],
      [41, 24],
      [37, 14],
      [43, 7],
      [33, 5],
    ];
    return at
      .slice(0, k)
      .map(([x, y]) => `<path d="M${x} ${y! - 2.8} v5.6 M${x! - 2.8} ${y} h5.6" ${st("#7bd88f", 2)}/>`)
      .join("");
  },
  // Donations: coins stacking up beside it.
  neko: (k) =>
    [...Array(k).keys()]
      .map((i) => `<ellipse cx="41" cy="${44 - i * 4}" rx="5.5" ry="2.2" fill="#ffd24a" stroke="#5a3508" stroke-width="1"/>`)
      .join(""),
};

/** The effect layer of an item at a step 1..5 ("" for an item without one). */
export function iconEffect(id: string, step: number): string {
  return EFFECTS[id]?.(Math.max(1, Math.min(5, step))) ?? "";
}
