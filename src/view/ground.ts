// The field's ground: a night meadow drawn once per stage into a tile. No grid
// and no lines: large soft patches of darker and lighter earth, grass tufts and
// pebbles, all at 4-8% contrast so sprites and bullets stay the loudest thing.
// The stage's tint (stages.ts) colours it; each stage adds its own litter.

import { Graphics, Rectangle, type Renderer, type Texture } from "pixi.js";

const S = 512;

/** Same seed, same meadow: the ground never shifts between runs. */
function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Draw at (x, y) and at its wrapped copies, so the tile repeats without seams. */
function wrap(x: number, y: number, r: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    const px = x + dx;
    const py = y + dy;
    if (px + r > 0 && px - r < S && py + r > 0 && py - r < S) draw(px, py);
  }
}

export function groundTexture(renderer: Renderer, stage: string): Texture {
  const g = new Graphics();
  const rnd = rng(stage === "forest" ? 23 : 11);
  g.rect(0, 0, S, S).fill(0x1a2531);
  // Patches: stacked low-alpha ellipses make soft edges.
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 50 + rnd() * 70;
    const k = 0.5 + rnd() * 0.3;
    const color = rnd() < 0.55 ? 0x131b25 : 0x223040;
    wrap(x, y, r, (x, y) => {
      for (let j = 0; j < 6; j++) g.ellipse(x, y, r * (1 - j * 0.14), r * k * (1 - j * 0.14)).fill({ color, alpha: 0.09 });
    });
  }
  // Grass tufts: three blades from one root.
  const tufts = stage === "forest" ? 60 : 90;
  for (let i = 0; i < tufts; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const h = 4 + rnd() * 5;
    const c = rnd() < 0.3 ? 0x2f4a3e : 0x283a45;
    wrap(x, y, 10, (x, y) => {
      g.moveTo(x - 3, y - h * 0.8).lineTo(x, y).lineTo(x + 3, y - h).moveTo(x, y).lineTo(x + 0.5, y - h * 1.1).stroke({ width: 1.1, color: c, alpha: 0.75, cap: "round" });
    });
  }
  // Pebbles.
  for (let i = 0; i < 30; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 1.1 + rnd() * 1.8;
    wrap(x, y, 4, (x, y) => g.ellipse(x, y, r * 1.4, r).fill({ color: 0x2c3a48, alpha: 0.85 }));
  }
  // The Forest of Magic: fallen leaves, small and dark.
  if (stage === "forest") {
    for (let i = 0; i < 70; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 2 + rnd() * 2.2;
      const a = rnd() * Math.PI;
      const c = Math.cos(a);
      const s = Math.sin(a);
      wrap(x, y, 6, (x, y) =>
        g.poly([x + c * r, y + s * r, x - s * r * 0.45, y + c * r * 0.45, x - c * r, y - s * r, x + s * r * 0.45, y - c * r * 0.45]).fill({ color: 0x2a2a30, alpha: 0.8 }),
      );
    }
  }
  const tex = renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, S, S) });
  g.destroy();
  return tex;
}
