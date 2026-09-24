// A picture of the field for a quick look at bullet density: the bot plays a
// run and the view around the player is drawn to a small PNG at the given
// seconds (bullets as dots in their colour, enemies as squares, the player
// white). Prints bullet and enemy counts in view.
//   bun scripts/field-png.ts [seed=a] [stage=lake] [seconds=30,70,120] [outDir=.]
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { activeRun, runView, type Game } from "../src/sim/game.ts";
import { playRun, SKILL } from "../src/sim/bot.ts";
import { ENEMIES } from "../src/content/enemies.ts";
import { BULLET_STYLES } from "../src/content/patterns.ts";
import { fixtureGame } from "../test/helpers.ts";

const seed = process.argv[2] ?? "a";
const stage = process.argv[3] ?? "lake";
const seconds = (process.argv[4] ?? "30,70,120").split(",").map(Number);
const outDir = process.argv[5] ?? ".";
/** The view is 1280x760; the picture is a quarter of that. */
const VW = 1280;
const VH = 760;
const S = 4;
const W = VW / S;
const H = VH / S;
/** A shrine tree a few runs in, so the bot lives long enough to see the field fill. */
const TREE = { core: 3, magnet1: 3, might1: 3, hp1: 3, spirit1: 3, greed1: 2, growth1: 2, graze1: 2, cooldown1: 2, area1: 2, regen1: 2, armor1: 2, speed1: 2 };

function png(rgb: Uint8Array): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer): number => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const td = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    td.copy(out, 4);
    out.writeUInt32BE(crc(td), 8 + data.length);
    return out;
  };
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function draw(k: Game, file: string): string {
  const v = runView(k, activeRun(k)!);
  const { body } = v.derived("player");
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) rgb.set([24, 30, 44], i * 3);
  const put = (wx: number, wy: number, size: number, color: number): boolean => {
    const cx = Math.floor((wx - body.x + VW / 2) / S);
    const cy = Math.floor((wy - body.y + VH / 2) / S);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return false;
    const h = Math.floor(size / 2);
    for (let y = cy - h; y < cy - h + size; y++)
      for (let x = cx - h; x < cx - h + size; x++) if (x >= 0 && y >= 0 && x < W && y < H) rgb.set([(color >> 16) & 255, (color >> 8) & 255, color & 255], (y * W + x) * 3);
    return true;
  };
  const e = v.packed("enemies");
  let enemies = 0;
  for (let i = 0; i < e.count; i++) if (put(e.col("x")[i]!, e.col("y")[i]!, 4, ENEMIES[e.col("kind")[i]!]!.color)) enemies++;
  const b = v.packed("bullets");
  const t = v.now("danmaku");
  const pos = { x: 0, y: 0 };
  let bullets = 0;
  const ages: Record<string, number[]> = {};
  for (let i = 0; i < b.count; i++) {
    const style = BULLET_STYLES[b.styleAt(i, t)]!;
    if (!b.pos(i, t, pos) || !put(pos.x, pos.y, 2, style.color)) continue;
    bullets++;
    (ages[style.id] ??= []).push(t - b.col("t0")[i]!);
  }
  const byStyle = Object.entries(ages)
    .map(([id, a]) => `${id} ${a.length} (median age ${(a.sort((x, y) => x - y)[a.length >> 1]! / 60).toFixed(1)}s)`)
    .join(", ");
  put(body.x, body.y, 3, 0xffffff);
  writeFileSync(file, png(rgb));
  return `${bullets} bullets and ${enemies} enemies in view: ${byStyle}`;
}

const k = fixtureGame(seed, { tree: TREE });
k.dispatch("/", "run:start", { stage });
let next = 0;
playRun(k, {
  ...SKILL.expert,
  maxTicks: Math.max(...seconds) * 60 + 1,
  onTick: () => {
    const path = activeRun(k);
    if (!path || next >= seconds.length) return;
    const t = runView(k, path).now("action");
    if (t < seconds[next]! * 60) return;
    const file = `${outDir}/field-${stage}-${seed}-${seconds[next]}s.png`;
    console.log(`${seconds[next]}s: ${draw(k, file)} -> ${file}`);
    next++;
  },
});
