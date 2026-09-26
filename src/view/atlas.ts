// Placeholder art, drawn once with Pixi Graphics into a single texture atlas
// (a ParticleContainer needs every particle's texture on one source). Shapes
// and colours only; characters are recognisable by palette and silhouette.

import { Container, Graphics, Rectangle, Texture, type Renderer } from "pixi.js";
import { ENEMIES, type EnemyShape } from "../content/enemies.ts";
import { BULLET_STYLES } from "../content/patterns.ts";
import { WEAPONS } from "../content/weapons.ts";

export interface Atlas {
  enemy: Texture[];
  enemyWhite: Texture[];
  bullet: Texture[];
  /** The same bullets with their inner glow put out, drawn once grazed. */
  bulletSpent: Texture[];
  /** Gems by tier (blue, green, red), and the same catching the light (a moment of a twinkle). */
  drop: { gems: Texture[]; glints: Texture[]; coin: Texture; heart: Texture };
  shot: Texture[];
  spark: Texture;
  star: Texture;
  player: Texture;
  hitbox: Texture;
  /** Boss sprite by boss id (a placeholder generic one for bosses without art). */
  boss: Record<string, Texture>;
  yinyang: Texture;
  circle: Texture;
  ring: Texture;
}

interface Cell {
  name: string;
  w: number;
  h: number;
  draw: (g: Graphics, cx: number, cy: number) => void;
  x?: number;
  y?: number;
}

function drawEnemy(g: Graphics, cx: number, cy: number, shape: EnemyShape, r: number, color: number, white: boolean): void {
  const c = white ? 0xffffff : color;
  const dark = white ? 0xffffff : 0x1a1426;
  switch (shape) {
    case "fuzz":
      g.star(cx, cy, 14, r * 1.15, r * 0.8).fill(c);
      g.circle(cx, cy, r * 0.82).fill(white ? 0xffffff : 0xffffff);
      break;
    case "fairy":
    case "bigfairy": {
      const wing = white ? 0xffffff : 0xdff4ff;
      g.ellipse(cx - r * 0.95, cy - r * 0.2, r * 0.75, r * 0.4).fill({ color: wing, alpha: white ? 1 : 0.75 });
      g.ellipse(cx + r * 0.95, cy - r * 0.2, r * 0.75, r * 0.4).fill({ color: wing, alpha: white ? 1 : 0.75 });
      if (shape === "bigfairy" && !white) g.circle(cx, cy, r * 1.05).stroke({ width: 3, color: 0xb6ffc8, alpha: 0.8 });
      g.circle(cx, cy + r * 0.25, r * 0.62).fill(c);
      g.circle(cx, cy - r * 0.35, r * 0.45).fill(white ? 0xffffff : 0xffe2cc);
      g.circle(cx, cy - r * 0.55, r * 0.42).fill(white ? 0xffffff : color);
      g.circle(cx, cy - r * 0.3, r * 0.3).fill(white ? 0xffffff : 0xffe2cc);
      break;
    }
    case "flower":
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.ellipse(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.38, r * 0.38).fill(c);
      }
      g.circle(cx, cy, r * 0.55).fill(white ? 0xffffff : 0x8a5a2b);
      break;
    case "ghost":
      g.circle(cx, cy - r * 0.1, r * 0.8).fill({ color: c, alpha: white ? 1 : 0.85 });
      g.poly([cx - r * 0.8, cy, cx + r * 0.8, cy, cx + r * 0.2, cy + r * 1.1, cx - r * 0.1, cy + r * 0.7]).fill({ color: c, alpha: white ? 1 : 0.85 });
      break;
    case "orb": {
      g.circle(cx, cy, r).fill(white ? 0xffffff : 0xffffff);
      if (!white) {
        g.moveTo(cx, cy).arc(cx, cy, r, -Math.PI / 2, Math.PI / 2).fill(color);
        g.circle(cx, cy - r / 2, r / 2).fill(color);
        g.circle(cx, cy + r / 2, r / 2).fill(0xffffff);
        g.circle(cx, cy - r / 2, r / 6).fill(0xffffff);
        g.circle(cx, cy + r / 2, r / 6).fill(color);
        g.circle(cx, cy, r).stroke({ width: 2, color: 0x2b0b16 });
      }
      break;
    }
  }
  if (!white && shape !== "orb" && shape !== "flower") {
    const ey = shape === "fairy" || shape === "bigfairy" ? cy - r * 0.3 : cy - r * 0.1;
    g.circle(cx - r * 0.22, ey, Math.max(1.5, r * 0.1)).fill(dark);
    g.circle(cx + r * 0.22, ey, Math.max(1.5, r * 0.1)).fill(dark);
  }
  if (!white && shape === "flower") {
    g.circle(cx - r * 0.18, cy - r * 0.05, Math.max(1.5, r * 0.09)).fill(0x1a1426);
    g.circle(cx + r * 0.18, cy - r * 0.05, Math.max(1.5, r * 0.09)).fill(0x1a1426);
  }
}

/** A grazed bullet's core: its own colour, dark (the inner glow put out). */
function spentCore(c: number): number {
  const ch = (v: number) => Math.round(v * 0.3);
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

function drawBullet(g: Graphics, cx: number, cy: number, shape: string, size: number, color: number, core: number): void {
  const r = size / 2;
  switch (shape) {
    case "orb":
      g.circle(cx, cy, r).fill({ color, alpha: 0.95 });
      g.circle(cx, cy, r * 0.55).fill(core);
      break;
    case "big":
      g.circle(cx, cy, r).fill({ color, alpha: 0.5 });
      g.circle(cx, cy, r * 0.8).fill({ color, alpha: 0.9 });
      g.circle(cx, cy, r * 0.5).fill(core);
      break;
    case "rice":
      g.ellipse(cx, cy, r, r * 0.55).fill(color);
      g.ellipse(cx, cy, r * 0.6, r * 0.28).fill(core);
      break;
    case "star":
      g.star(cx, cy, 5, r, r * 0.45).fill(color);
      g.circle(cx, cy, r * 0.3).fill(core);
      break;
    case "ice":
      g.poly([cx - r, cy, cx, cy - r * 0.45, cx + r, cy, cx, cy + r * 0.45]).fill(color);
      g.poly([cx - r * 0.55, cy, cx, cy - r * 0.2, cx + r * 0.55, cy, cx, cy + r * 0.2]).fill(core);
      break;
    case "knife":
      g.poly([cx - r, cy - r * 0.18, cx + r * 0.6, cy - r * 0.18, cx + r, cy, cx + r * 0.6, cy + r * 0.18, cx - r, cy + r * 0.18]).fill(color);
      g.rect(cx - r, cy - r * 0.08, r * 1.3, r * 0.16).fill(core);
      break;
  }
}

export function buildAtlas(renderer: Renderer): Atlas {
  const cells: Cell[] = [];
  ENEMIES.forEach((e, i) => {
    const s = Math.ceil(e.radius * 2.8 + 8);
    cells.push({ name: `enemy${i}`, w: s, h: s, draw: (g, cx, cy) => drawEnemy(g, cx, cy, e.shape, e.radius, e.color, false) });
    cells.push({ name: `enemyW${i}`, w: s, h: s, draw: (g, cx, cy) => drawEnemy(g, cx, cy, e.shape, e.radius, e.color, true) });
  });
  BULLET_STYLES.forEach((b, i) => {
    const s = Math.ceil(b.size + 6);
    cells.push({ name: `bullet${i}`, w: s, h: s, draw: (g, cx, cy) => drawBullet(g, cx, cy, b.shape, b.size, b.color, b.core) });
    // Grazed ("spent"): the coloured glow stays, the white inner glow goes out. Tint only multiplies, so this is its own texture.
    cells.push({ name: `bulletS${i}`, w: s, h: s, draw: (g, cx, cy) => drawBullet(g, cx, cy, b.shape, b.size, b.color, spentCore(b.color)) });
  });
  // EXP drops are gems: a small square-cut stone seen from above (the square is Touhou's item
  // silhouette, which no bullet has), its bevel in four facets around a flat table, lit from the top
  // left, on a faint dark rim; blue, then green, then red as they grow. A field can hold hundreds, so
  // they stay small and quiet: no halo, no bright centre. Now and then one catches the light (the glint
  // cells: the table paled and a four-point sparkle).
  const gem =
    ([base, lit, dark]: readonly number[], glint: boolean) =>
    (g: Graphics, cx: number, cy: number): void => {
      const o = 5;
      const i = 2.4;
      g.rect(cx - o - 0.9, cy - o - 0.9, (o + 0.9) * 2, (o + 0.9) * 2).fill({ color: 0x0b0a14, alpha: 0.55 });
      g.rect(cx - o, cy - o, o * 2, o * 2).fill(base!);
      g.poly([cx - o, cy - o, cx + o, cy - o, cx + i, cy - i, cx - i, cy - i]).fill({ color: lit!, alpha: 0.85 });
      g.poly([cx - o, cy - o, cx - i, cy - i, cx - i, cy + i, cx - o, cy + o]).fill({ color: lit!, alpha: 0.4 });
      g.poly([cx + o, cy - o, cx + o, cy + o, cx + i, cy + i, cx + i, cy - i]).fill({ color: dark!, alpha: 0.6 });
      g.poly([cx - o, cy + o, cx - i, cy + i, cx + i, cy + i, cx + o, cy + o]).fill({ color: dark!, alpha: 0.9 });
      if (glint) {
        g.rect(cx - i, cy - i, i * 2, i * 2).fill({ color: 0xffffff, alpha: 0.55 });
        g.star(cx - 1.1, cy - 1.1, 4, 5.2, 0.8).fill({ color: 0xffffff, alpha: 0.95 });
      } else g.circle(cx - 1.1, cy - 1.1, 0.8).fill({ color: 0xffffff, alpha: 0.9 });
    };
  const TIERS = [
    [0x4d8fe8, 0xa9ccff, 0x1f4589],
    [0x4aa66a, 0xa4e6b8, 0x1a4f2e],
    [0xd0454c, 0xffaaa6, 0x6e161c],
  ] as const;
  TIERS.forEach((c, i) => {
    cells.push({ name: `gem${i}`, w: 20, h: 22, draw: gem(c, false) });
    cells.push({ name: `glint${i}`, w: 20, h: 22, draw: gem(c, true) });
  });
  cells.push({
    // A mon: a round coin with a square hole.
    name: "coin",
    w: 22,
    h: 22,
    draw: (g, cx, cy) => {
      g.circle(cx, cy, 8).fill(0x8a6418);
      g.circle(cx, cy, 6.8).fill(0xe8c15a);
      g.circle(cx, cy, 5).stroke({ width: 1, color: 0xb48a2c });
      g.rect(cx - 2.2, cy - 2.2, 4.4, 4.4).fill(0x3a2a0c);
    },
  });
  cells.push({
    name: "heart",
    w: 24,
    h: 22,
    draw: (g, cx, cy) => {
      g.circle(cx - 4, cy - 2, 5).fill(0xe8506a);
      g.circle(cx + 4, cy - 2, 5).fill(0xe8506a);
      g.poly([cx - 9, cy, cx + 9, cy, cx, cy + 9]).fill(0xe8506a);
      g.circle(cx - 5, cy - 4, 1.8).fill({ color: 0xffffff, alpha: 0.8 });
    },
  });
  WEAPONS.forEach((w, i) => {
    cells.push({
      name: `shot${i}`,
      w: 28,
      h: 28,
      draw: (g, cx, cy) => {
        if (w.id === "amulet") {
          g.rect(cx - 8, cy - 5, 16, 10).fill(0xffffff);
          g.rect(cx - 8, cy - 5, 16, 10).stroke({ width: 2, color: 0xe0314b });
          g.rect(cx - 3, cy - 2, 6, 4).fill(0xe0314b);
        } else if (w.id === "needle") {
          g.rect(cx - 11, cy - 1.5, 22, 3).fill(0xffb3c1);
          g.rect(cx - 11, cy - 0.5, 22, 1).fill(0xffffff);
        } else if (w.id === "knives") {
          drawBullet(g, cx, cy, "knife", 20, 0xc0c8e0, 0xffffff);
        } else {
          g.circle(cx, cy, 7).fill(w.color);
        }
      },
    });
  });
  cells.push({
    name: "spark",
    w: 20,
    h: 20,
    draw: (g, cx, cy) => {
      g.circle(cx, cy, 8).fill({ color: 0xffffff, alpha: 0.25 });
      g.circle(cx, cy, 5).fill({ color: 0xffffff, alpha: 0.5 });
      g.circle(cx, cy, 2.5).fill(0xffffff);
    },
  });
  cells.push({ name: "star", w: 20, h: 20, draw: (g, cx, cy) => void g.star(cx, cy, 4, 9, 2.5).fill(0xffffff) });
  cells.push({
    name: "player",
    w: 48,
    h: 52,
    draw: (g, cx, cy) => {
      // Reimu: red and white, a big red bow.
      g.circle(cx - 12, cy + 6, 6).fill(0xffffff);
      g.circle(cx + 12, cy + 6, 6).fill(0xffffff);
      g.poly([cx - 10, cy + 2, cx + 10, cy + 2, cx + 13, cy + 20, cx - 13, cy + 20]).fill(0xe0314b);
      g.rect(cx - 5, cy + 2, 10, 5).fill(0xffe08a);
      g.circle(cx, cy - 8, 9).fill(0xffe2cc);
      g.moveTo(cx, cy - 9).arc(cx, cy - 9, 9.5, Math.PI, 0).fill(0x2a1a14);
      g.poly([cx - 16, cy - 24, cx - 2, cy - 17, cx - 16, cy - 10]).fill(0xe0314b);
      g.poly([cx + 16, cy - 24, cx + 2, cy - 17, cx + 16, cy - 10]).fill(0xe0314b);
      g.circle(cx, cy - 17, 3).fill(0xffffff);
      g.circle(cx - 3, cy - 7, 1.4).fill(0x3a1a14);
      g.circle(cx + 3, cy - 7, 1.4).fill(0x3a1a14);
    },
  });
  cells.push({
    name: "hitbox",
    w: 14,
    h: 14,
    draw: (g, cx, cy) => {
      g.circle(cx, cy, 5).fill(0xff2050);
      g.circle(cx, cy, 3).fill(0xffffff);
    },
  });
  cells.push({
    name: "boss:cirno",
    w: 80,
    h: 80,
    draw: (g, cx, cy) => {
      // Cirno: blue, with ice-crystal wings.
      for (let i = 0; i < 3; i++) {
        const y = cy - 10 + i * 10;
        g.poly([cx - 14, y, cx - 34, y - 8, cx - 30, y + 4]).fill({ color: 0xa8ecff, alpha: 0.9 });
        g.poly([cx + 14, y, cx + 34, y - 8, cx + 30, y + 4]).fill({ color: 0xa8ecff, alpha: 0.9 });
      }
      g.poly([cx - 12, cy + 2, cx + 12, cy + 2, cx + 16, cy + 24, cx - 16, cy + 24]).fill(0x3a78d8);
      g.rect(cx - 6, cy + 2, 12, 5).fill(0xffffff);
      g.circle(cx, cy - 9, 10).fill(0xffe8dc);
      g.moveTo(cx, cy - 10).arc(cx, cy - 10, 10.5, Math.PI, 0).fill(0x6fd3ff);
      g.poly([cx - 12, cy - 22, cx, cy - 18, cx - 10, cy - 12]).fill(0x3a78d8);
      g.poly([cx + 12, cy - 22, cx, cy - 18, cx + 10, cy - 12]).fill(0x3a78d8);
      g.circle(cx - 3.5, cy - 8, 1.6).fill(0x1a3a8a);
      g.circle(cx + 3.5, cy - 8, 1.6).fill(0x1a3a8a);
    },
  });
  cells.push({
    name: "boss:rumia",
    w: 80,
    h: 80,
    draw: (g, cx, cy) => {
      // Rumia: black dress, blonde hair, red ribbon, arms out like a cross; a haze of darkness.
      g.circle(cx, cy, 30).fill({ color: 0x1a1030, alpha: 0.55 });
      g.rect(cx - 30, cy - 2, 60, 5).fill(0x2b2238);
      g.poly([cx - 12, cy + 2, cx + 12, cy + 2, cx + 16, cy + 24, cx - 16, cy + 24]).fill(0x2b2238);
      g.rect(cx - 6, cy + 2, 12, 5).fill(0xffffff);
      g.circle(cx, cy - 9, 10).fill(0xffe8dc);
      g.moveTo(cx, cy - 10).arc(cx, cy - 10, 10.5, Math.PI, 0).fill(0xf2e27a);
      g.poly([cx + 6, cy - 22, cx + 14, cy - 26, cx + 12, cy - 16]).fill(0xe0314b);
      g.circle(cx - 3.5, cy - 8, 1.6).fill(0xb3122b);
      g.circle(cx + 3.5, cy - 8, 1.6).fill(0xb3122b);
    },
  });
  cells.push({
    name: "yinyang",
    w: 30,
    h: 30,
    draw: (g, cx, cy) => {
      const r = 12;
      // A thin ink rim, not a pale halo: the orb reads as an object on any ground.
      g.circle(cx, cy, r + 1).fill({ color: 0x1b1512, alpha: 0.75 });
      g.circle(cx, cy, r).fill(0xffffff);
      g.moveTo(cx, cy).arc(cx, cy, r, -Math.PI / 2, Math.PI / 2).fill(0xe0314b);
      g.circle(cx, cy - r / 2, r / 2).fill(0xe0314b);
      g.circle(cx, cy + r / 2, r / 2).fill(0xffffff);
      g.circle(cx, cy - r / 2, r / 6).fill(0xffffff);
      g.circle(cx, cy + r / 2, r / 6).fill(0xe0314b);
    },
  });
  cells.push({
    name: "circle",
    w: 132,
    h: 132,
    draw: (g, cx, cy) => {
      // A spell-card magic circle, drawn white and tinted at use.
      g.circle(cx, cy, 62).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      g.circle(cx, cy, 54).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        pts.push(cx + Math.cos(a) * 54, cy + Math.sin(a) * 54);
      }
      g.poly([pts[0]!, pts[1]!, pts[4]!, pts[5]!, pts[8]!, pts[9]!]).stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
      g.poly([pts[2]!, pts[3]!, pts[6]!, pts[7]!, pts[10]!, pts[11]!]).stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.circle(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58, 2).fill({ color: 0xffffff, alpha: 0.9 });
      }
    },
  });
  cells.push({
    name: "ring",
    w: 132,
    h: 132,
    draw: (g, cx, cy) => {
      g.circle(cx, cy, 62).stroke({ width: 4, color: 0xffffff, alpha: 1 });
      g.circle(cx, cy, 57).stroke({ width: 6, color: 0xffffff, alpha: 0.25 });
    },
  });

  // Shelf packing into a 1024-wide sheet.
  const W = 1024;
  let x = 0;
  let y = 0;
  let row = 0;
  for (const c of cells) {
    if (x + c.w > W) {
      x = 0;
      y += row + 2;
      row = 0;
    }
    c.x = x;
    c.y = y;
    x += c.w + 2;
    row = Math.max(row, c.h);
  }
  const H = y + row + 2;
  const root = new Container();
  for (const c of cells) {
    const g = new Graphics();
    c.draw(g, c.x! + c.w / 2, c.y! + c.h / 2);
    root.addChild(g);
  }
  const sheet = renderer.generateTexture({ target: root, frame: new Rectangle(0, 0, W, H), resolution: 2, antialias: true });
  root.destroy({ children: true });
  const frames = new Map<string, Texture>();
  for (const c of cells) {
    frames.set(c.name, new Texture({ source: sheet.source, frame: new Rectangle(c.x!, c.y!, c.w, c.h) }));
  }
  const f = (n: string): Texture => frames.get(n)!;
  return {
    enemy: ENEMIES.map((_, i) => f(`enemy${i}`)),
    enemyWhite: ENEMIES.map((_, i) => f(`enemyW${i}`)),
    bullet: BULLET_STYLES.map((_, i) => f(`bullet${i}`)),
    bulletSpent: BULLET_STYLES.map((_, i) => f(`bulletS${i}`)),
    drop: { gems: [0, 1, 2].map((i) => f(`gem${i}`)), glints: [0, 1, 2].map((i) => f(`glint${i}`)), coin: f("coin"), heart: f("heart") },
    shot: WEAPONS.map((_, i) => f(`shot${i}`)),
    spark: f("spark"),
    star: f("star"),
    player: f("player"),
    hitbox: f("hitbox"),
    boss: { cirno: f("boss:cirno"), rumia: f("boss:rumia") },
    yinyang: f("yinyang"),
    circle: f("circle"),
    ring: f("ring"),
  };
}
