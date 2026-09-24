// A rigged sprite's idle cycle baked once into a flip-book strip (the frames
// side by side, as a PNG data URL), so the credits can show a crowd of rigged
// fairies idling for the cost of a CSS animation: no live rig, no per-frame
// drawing. The field bakes its sprites the same way (a few frames per cycle).

import { Container } from "pixi.js";
import { cycle } from "../../../art-l2d/animator.ts";
import type { SpriteRig } from "../../../art-l2d/index.ts";
import { drawInto, partImages, RigView, sharedRenderer } from "../../../art-l2d/pixi-model.ts";
import { Rig } from "../../../art-l2d/rig.ts";

const baked = new Map<string, Promise<string>>();
/** Bakes run one at a time, each in an idle moment, so a row of fairies coming into view never stalls a frame. */
let queue: Promise<unknown> = Promise.resolve();
const idle = () => new Promise<void>((ok) => requestIdleCallback(() => ok(), { timeout: 300 }));

/** The strip for a sprite rig shown at w x h CSS px, `frames` frames per idle cycle (cached). */
export function flipbook(key: string, sr: SpriteRig, w: number, h: number, frames: number): Promise<string> {
  const res = Math.min(2, window.devicePixelRatio || 1);
  const id = `${key}:${w}x${h}@${res}/${frames}`;
  let got = baked.get(id);
  if (!got) {
    got = queue.then(idle).then(() => bake(sr, w, h, frames, res));
    queue = got.catch(() => undefined);
    baked.set(id, got);
  }
  return got;
}

async function bake(sr: SpriteRig, w: number, h: number, frames: number, res: number): Promise<string> {
  const [renderer, imgs] = await Promise.all([sharedRenderer(), partImages(sr.model)]);
  const rig = new Rig(sr.model);
  const view = new RigView(rig, imgs);
  const s = Math.min(w / sr.model.w, h / sr.model.h);
  view.scale.set(s, s);
  view.position.set((w - sr.model.w * s) / 2, h - sr.model.h * s);
  const root = new Container();
  root.addChild(view);
  const one = document.createElement("canvas");
  one.width = Math.round(w * res);
  one.height = Math.round(h * res);
  const ctx = one.getContext("2d")!;
  const strip = document.createElement("canvas");
  strip.width = one.width * frames;
  strip.height = one.height;
  const out = strip.getContext("2d")!;
  for (let i = 0; i < frames; i++) {
    cycle(rig, i / frames);
    view.update();
    drawInto(renderer, root, ctx, w, h, res);
    out.drawImage(one, i * one.width, 0);
  }
  root.destroy({ children: true });
  // Encoded off the main thread (toDataURL would stall a frame).
  const blob = await new Promise<Blob | null>((ok) => strip.toBlob(ok));
  return blob ? URL.createObjectURL(blob) : strip.toDataURL();
}
