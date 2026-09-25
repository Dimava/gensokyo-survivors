/**
 * Fabric: traditional Japanese textile patterns as small repeating SVG tiles,
 * drawn here in code and handed to style.css as custom properties on :root:
 * `--fab-<name>` (a data-URI image, full-strength ink on transparent),
 * `--fab-<name>-w` / `-h` (the tile's size in px), `--fab-<name>-dx` / `-dy`
 * (the drift's loop step, a shift that maps the pattern onto itself) and
 * `--fab-<name>-faint` (the ink baked at FAINT, for the panels that scroll and
 * so wear the cloth as a still background; the sliding layers set their
 * strength with opacity instead).
 *
 * Every tile is drawn as a luminance mask (white = ink, black = nothing) over
 * a rect of the ink colour. A shape that should hide the ones under it (a wave
 * scale, a cloud, a petal notch) is simply painted black on top.
 */

export type FabricName = "asanoha" | "sayagata" | "seigaiha" | "kikko" | "yagasuri" | "shippo" | "kumo" | "sakura";

export interface Fabric {
  w: number;
  h: number;
  /**
   * The drift's loop step in px: the shortest shift that maps the pattern onto
   * itself in a pleasing direction (often half a tile on the diagonal), so the
   * sliding layer needs little room and loops without a seam.
   */
  step: [number, number];
  /** Ink colour: light washi on lacquer and red, dark on gold leaf. */
  ink: string;
  /** Mask content (white strokes and fills on black), in tile coordinates. */
  body: string;
}

const f = (n: number): string => String(Math.round(n * 100) / 100);

/** Draw `one(dx, dy)` at the tile and its eight neighbours, so shapes that cross an edge wrap. */
function wrap(w: number, h: number, one: (dx: number, dy: number) => string): string {
  let s = "";
  for (const dy of [-h, 0, h]) for (const dx of [-w, 0, w]) s += one(dx, dy);
  return s;
}
const line = (pts: [number, number][]): string => `<polyline points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}"/>`;
const poly = (pts: [number, number][], fill: string): string => `<polygon fill="${fill}" points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}"/>`;
const strokes = (sw: number, inner: string, cap = "round"): string => `<g fill="none" stroke="#fff" stroke-width="${sw}" stroke-linejoin="${cap === "round" ? "round" : "miter"}" stroke-linecap="${cap}">${inner}</g>`;

/** Asanoha (hemp leaf): a triangle lattice, each triangle with spokes from its corners to its centre. */
function asanoha(): Fabric {
  const w = 28;
  const h = 48; // 28·√3 ≈ 48.5: two rows of near-equilateral triangles
  const r = h / 2;
  type P = [number, number];
  const tris: [P, P, P][] = [
    [[0, 0], [w, 0], [w / 2, r]],
    [[0, 0], [-w / 2, r], [w / 2, r]],
    [[w / 2, r], [0, h], [w, h]],
    [[-w / 2, r], [w / 2, r], [0, h]],
  ];
  const body = strokes(
    1,
    wrap(w, h, (dx, dy) =>
      tris
        .map((t) => {
          const [a, b, e] = t.map(([x, y]): P => [x + dx, y + dy]) as [P, P, P];
          const c: P = [(a[0] + b[0] + e[0]) / 3, (a[1] + b[1] + e[1]) / 3];
          return line([a, b, e, a]) + [a, b, e].map((q) => line([q, c])).join("");
        })
        .join(""),
    ),
  );
  return { w, h, step: [w / 2, -h / 2], ink: "#f3e2b0", body };
}

/**
 * Sayagata: interlocking manji on a lattice turned a little off square
 * (steps (3,1) and (-1,3) of a 4px grid, which repeat every 10×10 steps).
 */
function sayagata(): Fabric {
  const u = 4;
  const n = 10;
  const w = n * u;
  const h = n * u;
  const arms = (cx: number, cy: number): string => {
    const a = 1;
    const b = 2;
    const pts: [number, number][][] = [
      [[0, 0], [0, -a], [b, -a]],
      [[0, 0], [a, 0], [a, b]],
      [[0, 0], [0, a], [-b, a]],
      [[0, 0], [-a, 0], [-a, -b]],
    ];
    return pts.map((arm) => line(arm.map(([x, y]) => [(cx + x) * u, (cy + y) * u]))).join("");
  };
  let inner = "";
  for (let i = -4; i <= 6; i++)
    for (let j = -4; j <= 6; j++) {
      const cx = 3 * i - j;
      const cy = i + 3 * j;
      if (cx < -3 || cx > n + 3 || cy < -3 || cy > n + 3) continue;
      inner += arms(cx, cy);
    }
  return { w, h, step: [-4 * u, 2 * u], ink: "#eef0ff", body: strokes(1.2, inner, "square") };
}

/** Seigaiha (blue sea waves): rows of concentric arcs, each row half hiding the one behind. */
function seigaiha(): Fabric {
  const R = 16;
  const w = 2 * R;
  const h = R;
  const rings = [R - 0.8, R * 0.76, R * 0.52, R * 0.28];
  let s = "";
  // Back rows first; a row sits R/2 below and R across from the one before.
  for (let k = -2; k <= 4; k++) {
    const y = (k * R) / 2;
    const x0 = k % 2 === 0 ? 0 : R;
    for (let x = x0 - 2 * w; x <= w + 2 * R; x += w) {
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${R}" fill="#000"/>`;
      s += rings.map((r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="#fff" stroke-width="1.1"/>`).join("");
    }
  }
  return { w, h, step: [-R, R / 2], ink: "#ffd6dc", body: s };
}

/** Kikkō (tortoiseshell): a honeycomb of hexagons, each with a smaller one inside. */
function kikko(): Fabric {
  const w = 21;
  const h = 36;
  const s = h / 3;
  const hex = (cx: number, cy: number, k: number): string =>
    line([
      [cx, cy - s * k],
      [cx + (w / 2) * k, cy - (s / 2) * k],
      [cx + (w / 2) * k, cy + (s / 2) * k],
      [cx, cy + s * k],
      [cx - (w / 2) * k, cy + (s / 2) * k],
      [cx - (w / 2) * k, cy - (s / 2) * k],
      [cx, cy - s * k],
    ]);
  const body = strokes(
    1,
    wrap(w, h, (dx, dy) => ([[0, 0], [w / 2, h / 2]] as const).map(([x, y]) => hex(x + dx, y + dy, 1) + hex(x + dx, y + dy, 0.62)).join("")),
  );
  return { w, h, step: [w / 2, h / 2], ink: "#eef0ff", body };
}

/**
 * Yagasuri (arrow feathers), laid on its side so the fletchings point left,
 * the way Back goes. Each feather is split along its shaft into a shaded and
 * a bare half, alternating; every other row is shifted half a feather.
 */
function yagasuri(): Fabric {
  const L = 16; // feather length
  const c = 12; // row height
  const d = 6; // chevron depth
  const w = 2 * L;
  const h = 2 * c;
  const feather = (x: number, y: number, flip: boolean): string => {
    const top: [number, number][] = [[x, y + c / 2], [x + d, y], [x + L + d, y], [x + L, y + c / 2]];
    const bot: [number, number][] = [[x, y + c / 2], [x + L, y + c / 2], [x + L + d, y + c], [x + d, y + c]];
    return poly(flip ? bot : top, "#777") + line([[x, y + c / 2], [x + d, y], [x + L + d, y], [x + L, y + c / 2], [x + L + d, y + c], [x + d, y + c], [x, y + c / 2]]);
  };
  let inner = "";
  for (let row = -1; row <= 2; row++)
    for (let i = -2; i <= 3; i++) {
      const x = i * L + (row % 2 === 0 ? 0 : L / 2);
      inner += feather(x, row * c, (i + row) % 2 === 0);
    }
  return { w, h, step: [-w, 0], ink: "#eef0ff", body: `<g fill="none" stroke="#fff" stroke-width="1" stroke-linejoin="round">${inner}</g>` };
}

/** Shippō (seven treasures): circles on a diagonal lattice, overlapping into four-petal rings. */
function shippo(): Fabric {
  const r = 12;
  const w = 2 * r;
  const h = 2 * r;
  const body =
    strokes(1.1, wrap(w, h, (dx, dy) => ([[0, 0], [r, r]] as const).map(([x, y]) => `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="${r}"/>`).join(""))) +
    `<g fill="#fff">${wrap(w, h, (dx, dy) => `<circle cx="${f(r + dx)}" cy="${f(dy)}" r="1.4"/><circle cx="${f(dx)}" cy="${f(r + dy)}" r="1.4"/>`)}</g>`;
  return { w, h, step: [r, r], ink: "#5a3a06", body };
}

/** Kumo (clouds): little scalloped clouds with a curled tail, in staggered rows. */
function kumo(): Fabric {
  const w = 64;
  const h = 40;
  const bumps: [number, number, number][] = [
    [-11, 2, 5],
    [-4, -2, 6.5],
    [5, -3, 7],
    [12, 2, 5],
  ];
  const cloud = (cx: number, cy: number): string => {
    const disk = (grow: number, fill: string): string =>
      bumps.map(([x, y, r]) => `<circle cx="${f(cx + x)}" cy="${f(cy + y)}" r="${f(r + grow)}" fill="${fill}"/>`).join("") +
      `<rect x="${f(cx - 11 - grow)}" y="${f(cy + 1 - grow)}" width="${f(23 + 2 * grow)}" height="${f(6 + 2 * grow)}" rx="${f(3 + grow)}" fill="${fill}"/>`;
    const tail = `<path d="M${f(cx + 16)} ${f(cy + 5)} q 7 1 8 -4 q 0.5 -4 -3.5 -3.5" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`;
    const curl = `<path d="M${f(cx - 2)} ${f(cy + 4)} q -1 -5 4 -5 q 4 0.5 3 4" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round"/>`;
    return tail + disk(1.1, "#fff") + disk(0, "#000") + curl;
  };
  return { w, h, step: [w / 2, h / 2], ink: "#e9edff", body: wrap(w, h, (dx, dy) => cloud(16 + dx, 12 + dy) + cloud(48 + dx, 32 + dy)) };
}

/** Sakura: scattered five-petal blossoms with notched petals, two sizes. */
function sakura(): Fabric {
  const w = 44;
  const h = 44;
  const flower = (cx: number, cy: number, s: number, rot: number, tone: string): string => {
    let p = "";
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 72 * Math.PI) / 180;
      const ex = cx + Math.sin(a) * s * 0.55;
      const ey = cy - Math.cos(a) * s * 0.55;
      const deg = rot * (180 / Math.PI) + i * 72;
      p += `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(s * 0.3)}" ry="${f(s * 0.5)}" transform="rotate(${f(deg)} ${f(ex)} ${f(ey)})" fill="${tone}"/>`;
      const nx = cx + Math.sin(a) * s * 1.05;
      const ny = cy - Math.cos(a) * s * 1.05;
      p += `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(s * 0.13)}" fill="#000"/>`;
    }
    return p + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.16)}" fill="#000"/>`;
  };
  const body = wrap(w, h, (dx, dy) => flower(11 + dx, 12 + dy, 7, 0.2, "#fff") + flower(33 + dx, 32 + dy, 5, 0.9, "#aaa") + `<circle cx="${f(34 + dx)}" cy="${f(9 + dy)}" r="1.3" fill="#888"/><circle cx="${f(9 + dx)}" cy="${f(35 + dy)}" r="1" fill="#888"/>`);
  return { w, h, step: [0, h], ink: "#ffe3ea", body };
}

export const FABRICS: Record<FabricName, Fabric> = {
  asanoha: asanoha(),
  sayagata: sayagata(),
  seigaiha: seigaiha(),
  kikko: kikko(),
  yagasuri: yagasuri(),
  shippo: shippo(),
  kumo: kumo(),
  sakura: sakura(),
};

/** How strong the ink is baked for the still cloth of scrolling panels (a sliding panel layer's opacity). */
export const FAINT = 0.07;

/** The tile as a standalone SVG document, the ink at `alpha`. */
export function fabricSvg(fab: Fabric, alpha = 1): string {
  const { w, h } = fab;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/>${fab.body}</mask>` +
    `<rect width="${w}" height="${h}" fill="${fab.ink}" fill-opacity="${alpha}" mask="url(#m)"/></svg>`
  );
}

export function fabricUrl(fab: Fabric, alpha = 1): string {
  return `url("data:image/svg+xml,${encodeURIComponent(fabricSvg(fab, alpha))}")`;
}

/** Put every tile on :root as custom properties for style.css. */
export function installFabrics(root: HTMLElement = document.documentElement): void {
  for (const [name, fab] of Object.entries(FABRICS)) {
    root.style.setProperty(`--fab-${name}`, fabricUrl(fab));
    root.style.setProperty(`--fab-${name}-faint`, fabricUrl(fab, FAINT));
    root.style.setProperty(`--fab-${name}-w`, `${fab.w}px`);
    root.style.setProperty(`--fab-${name}-h`, `${fab.h}px`);
    root.style.setProperty(`--fab-${name}-dx`, `${fab.step[0]}px`);
    root.style.setProperty(`--fab-${name}-dy`, `${fab.step[1]}px`);
  }
}
