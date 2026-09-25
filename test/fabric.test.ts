// The fabric tiles (src/view/fabric.ts): each is a well-formed SVG of its
// stated size, and each drift step maps the pattern onto itself, so the
// sliding layers in style.css loop without a jump. Tiles are rasterised with
// resvg at 2x (every step is then a whole number of pixels) and the tile is
// compared with itself shifted by the step, wrapping around the edges.

import { describe, expect, test } from "bun:test";
import { Resvg } from "@resvg/resvg-js";
import { FABRICS, fabricSvg, fabricUrl } from "../src/view/fabric.ts";

const SCALE = 2;

function raster(svg: string): { w: number; h: number; a: Uint8Array } {
  const img = new Resvg(svg, { fitTo: { mode: "zoom", value: SCALE } }).render();
  const px = img.pixels;
  const a = new Uint8Array(img.width * img.height);
  for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3]!;
  return { w: img.width, h: img.height, a };
}

describe("fabric", () => {
  for (const [name, fab] of Object.entries(FABRICS)) {
    test(`${name}: a ${fab.w}x${fab.h} tile with ink, looping on its step`, () => {
      const svg = fabricSvg(fab);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(fabricUrl(fab)).toMatch(/^url\("data:image\/svg\+xml,[^"]+"\)$/);
      const { w, h, a } = raster(svg);
      expect([w, h]).toEqual([fab.w * SCALE, fab.h * SCALE]);

      let ink = 0;
      for (const v of a) ink += v;
      const mean = ink / a.length / 255;
      // Visible but not a solid fill.
      expect(mean).toBeGreaterThan(0.04);
      expect(mean).toBeLessThan(0.7);

      const sx = fab.step[0] * SCALE;
      const sy = fab.step[1] * SCALE;
      expect(Number.isInteger(sx) && Number.isInteger(sy)).toBe(true);
      expect(sx !== 0 || sy !== 0).toBe(true);
      let diff = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const x2 = (((x + sx) % w) + w) % w;
          const y2 = (((y + sy) % h) + h) % h;
          diff += Math.abs(a[y * w + x]! - a[y2 * w + x2]!);
        }
      // Antialiasing differs a little where shapes were drawn at different coordinates.
      expect(diff / a.length / 255).toBeLessThan(0.02);
    });
  }
});
