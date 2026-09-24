// The level-up card's picture of a passive item: a plain pictogram of what it
// GIVES (its stat in content/passives.ts), the level shown as one obvious
// change in it: one more arrow, a longer arc, a wider ring, one more coin.
// Flat: the item's colour (currentColor) and white, thin even strokes, a few
// shapes. 48x48 viewBox. (The HUD slot keeps its own small icon, itemIcons.ts.)

const W = "#ffffff";
const st = (c: string, w = 2) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const f1 = (v: number) => v.toFixed(1);

/** Might: a power item, and one up-chevron more per level. */
function might(k: number): string {
  let out = `<rect x="5" y="13" width="22" height="22" rx="4" fill="currentColor"/>`;
  out += `<path d="M13 30 V18 h4 a3.7 3.7 0 0 1 0 7.4 h-4" ${st(W, 2.4)}/>`;
  for (let i = 0; i < k; i++) out += `<path d="M34 ${41 - i * 7} l4.5 -4.5 4.5 4.5" ${st(W)}/>`;
  return out;
}

/** Max HP: a heart that fills a fifth more each level. */
function maxHp(k: number): string {
  const heart = "M24 41C12 32 7 26 7 19.5A8.5 8.5 0 0 1 24 15A8.5 8.5 0 0 1 41 19.5C41 26 36 32 24 41Z";
  const top = 41 - (29 * k) / 5;
  return (
    `<clipPath id="i-hp${k}"><rect x="0" y="${f1(top)}" width="48" height="48"/></clipPath>` +
    `<path d="${heart}" fill="currentColor" clip-path="url(#i-hp${k})"/>` +
    `<path d="${heart}" ${st("currentColor")}/>`
  );
}

/** Move speed: a geta, and one speed line more per level. */
function speed(k: number): string {
  const ys = [22, 16, 28, 10, 34];
  let out = "";
  for (let i = 0; i < k; i++) out += `<path d="M${4 + i} ${ys[i]} h10" ${st(W)}/>`;
  // A geta side on: the thong over the sole, two teeth under it.
  out += `<path d="M24 20 Q31 9 38 20" ${st("currentColor", 2.4)}/>`;
  out += `<rect x="19" y="20" width="26" height="6" rx="2" fill="currentColor"/>`;
  out += `<path d="M23.5 26 v6 M40.5 26 v6" ${st("currentColor", 3.4)}/>`;
  return out;
}

/** Cooldown: a clock, its fast-forward arc a fifth of a turn longer each level. */
function cooldown(k: number): string {
  const cx = 24;
  const cy = 25;
  const R = 18;
  const a0 = -Math.PI / 2;
  const a1 = a0 + (Math.PI * 2 * 0.9 * k) / 5;
  const p = (a: number, r = R) => `${f1(cx + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r)}`;
  // The arrowhead: two short strokes back from the arc's end.
  const b = a1 - 0.28;
  return (
    `<circle cx="${cx}" cy="${cy}" r="11" ${st("currentColor")}/>` +
    `<path d="M${cx} ${cy} V${cy - 6.5} M${cx} ${cy} l4.5 2.6" ${st("currentColor")}/>` +
    `<path d="M${p(a0)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} M${p(b, R + 3.5)} L${p(a1)} L${p(b, R - 3.5)}" ${st(W)}/>`
  );
}

/** Pickup range: a magnet inside a pull ring that widens each level. */
function magnet(k: number): string {
  return (
    `<circle cx="24" cy="24" r="${f1(12 + k * 2.2)}" ${st(W, 1.4)} stroke-dasharray="3 3"/>` +
    `<path d="M15.5 14 v10 a8.5 8.5 0 0 0 17 0 v-10 h-5.2 v10 a3.3 3.3 0 0 1 -6.6 0 v-10z" fill="currentColor"/>`
  );
}

/** Area: a spell point, its reach a ring that widens each level. */
function area(k: number): string {
  const r = 8 + k * 3;
  return `<circle cx="24" cy="24" r="${r}" fill="currentColor" fill-opacity="0.25" ${st("currentColor", 1.6)}/><circle cx="24" cy="24" r="4.5" fill="${W}"/>`;
}

/** Graze: the hitbox in its graze ring, a bullet skimming it, one graze mark more per level. */
function graze(k: number): string {
  let out = `<circle cx="22" cy="26" r="14" ${st("currentColor", 1.6)}/><circle cx="22" cy="26" r="2.6" fill="currentColor"/>`;
  out += `<circle cx="37" cy="12" r="4" fill="${W}"/>`;
  // Marks where the bullet grazed, along the ring's upper right.
  for (let i = 0; i < k; i++) {
    const a = -Math.PI + 0.35 + i * 0.4;
    const x = 22 + Math.cos(a) * 14;
    const y = 26 + Math.sin(a) * 14;
    out += `<path d="M${f1(x + Math.cos(a) * 1.5)} ${f1(y + Math.sin(a) * 1.5)} L${f1(x + Math.cos(a) * 5)} ${f1(y + Math.sin(a) * 5)}" ${st(W)}/>`;
  }
  return out;
}

/** Recovery: a heart with one more plus rising from it each level. */
function regen(k: number): string {
  let out = `<path d="M16 42C8 36 4 31 4 26A6.2 6.2 0 0 1 16 22.8A6.2 6.2 0 0 1 28 26C28 31 24 36 16 42Z" fill="currentColor"/>`;
  const at = [
    [34, 30],
    [28, 17],
    [40, 19],
    [34, 7],
    [44, 6],
  ] as const;
  for (let i = 0; i < k; i++) {
    const [x, y] = at[i]!;
    out += `<path d="M${x} ${y - 3} v6 M${x - 3} ${y} h6" ${st(W)}/>`;
  }
  return out;
}

/** Donations: a stack of coins, one more per level. */
function greed(k: number): string {
  let out = "";
  for (let i = 0; i < k; i++) {
    const y = 39 - i * 6;
    out += `<ellipse cx="24" cy="${y}" rx="11" ry="4" fill="currentColor" stroke="#10142e" stroke-width="1.2"/>`;
  }
  out += `<rect x="22" y="${39 - (k - 1) * 6 - 1.3}" width="4" height="2.6" fill="${W}"/>`;
  return out;
}

/** Amount: one more of everything: an amulet, and one more copy per level. */
function amount(level: number): string {
  const n = 1 + level;
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = 24 + (i - (n - 1) / 2) * 13;
    out += `<rect x="${x - 5.5}" y="13" width="11" height="22" rx="1.5" fill="currentColor"/><rect x="${x - 2.5}" y="17" width="5" height="5" fill="${W}"/>`;
  }
  return out;
}

const BY_STAT: Record<string, (k: number) => string> = { might, maxHp, speed, cooldown, magnet, area, graze, regen, greed };

/**
 * An item's picture at a level. `stat` picks the symbol; the level is spread
 * over 1..5 steps of the effect (Duplex Tome: its own count of copies).
 */
export function itemArt(stat: string, level: number, max: number): string {
  if (stat === "amount") return amount(level);
  const draw = BY_STAT[stat];
  if (!draw) return `<circle cx="24" cy="24" r="12" fill="currentColor"/>`;
  return draw(max <= 1 ? 5 : Math.round(1 + ((level - 1) * 4) / (max - 1)));
}
