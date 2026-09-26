// The HUD's own furniture along the screen's edges, for marks on the field (the ENEMY tag, formations'
// chevrons) that must stand clear of it rather than behind a card or a plaque.

/** The bottom shelf's pieces, with how far above each one's top a mark rides (the hand's key caps stand proud of the cards). */
const SHELF: [string, number][] = [
  [".hud .bottom > .hand", 13],
  [".hud .bottom > .spirit", 4],
  [".hud .bottom > .pile", 4],
];
/** The pieces along the top edge: Reimu's corner, the clock, the tally. */
const HEAD = [".hud .tl", ".hud .tc", ".hud .tr"];

/** How high the bottom shelf stands under screen x, in px from the screen's foot (0: nothing there). */
export function shelfLift(x: number, H: number): number {
  let lift = 0;
  for (const [sel, pad] of SHELF) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (x > r.left - 26 && x < r.right + 26) lift = Math.max(lift, H - r.top + pad);
  }
  return lift;
}

/** How far down the top pieces reach over screen x, in px from the screen's top (0: nothing there). */
export function headDrop(x: number): number {
  let drop = 0;
  for (const sel of HEAD) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (x > r.left - 16 && x < r.right + 16) drop = Math.max(drop, r.bottom + 6);
  }
  return drop;
}

/** The bottom shelf's pieces: where each stands along the bottom edge (screen px) and how high its top is from the screen's foot. */
export function shelfPieces(H: number): { from: number; to: number; top: number }[] {
  const out: { from: number; to: number; top: number }[] = [];
  for (const [sel] of SHELF) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    out.push({ from: r.left, to: r.right, top: H - r.top });
  }
  return out.sort((a, b) => a.from - b.from);
}
