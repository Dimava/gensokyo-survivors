<script setup lang="ts">
// A rigged character (src/art-l2d) drawn live into its own canvas (through
// the one shared Pixi renderer, see pixi-model.ts):
// it looks toward `look` when given, else toward the cursor if `follow` (the
// gallery), else straight ahead, and blinks, breathes and sways on its own.
// Mirrored portraits mirror the look too.
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Container } from "pixi.js";
import type { Look } from "../../art/drawing.ts";
import type { Model } from "../../art-l2d/rig.ts";
import { Rig } from "../../art-l2d/rig.ts";
import { Animator } from "../../art-l2d/animator.ts";
import { drawInto, partImages, RigView, sharedRenderer } from "../../art-l2d/pixi-model.ts";
import { prefs } from "../prefs.ts";

const props = defineProps<{ model: Model; width: number; height: number; look?: Look; flip?: boolean; talking?: boolean; rate?: number; follow?: boolean }>();

const canvas = ref<HTMLCanvasElement>();
/** The cursor this far away (px) makes the model look fully that way. */
const REACH = 360;
const res = Math.min(2, window.devicePixelRatio || 1);
let raf = 0;
let alive = true;
let view: RigView | null = null;
const mouse = { x: -1, y: -1 };

function onMove(e: PointerEvent): void {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

function target(): Look {
  if (props.look) return props.flip ? { x: -props.look.x, y: props.look.y } : props.look;
  const el = canvas.value;
  // Not following: back to the neutral look (the animator eases there).
  if (!props.follow || !el || mouse.x < 0) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  // The eyes sit at about 42% of the model's height.
  let dx = mouse.x - (r.left + r.width / 2);
  const dy = mouse.y - (r.top + r.height * 0.42);
  if (props.flip) dx = -dx;
  const len = Math.hypot(dx, dy);
  const k = Math.min(1, len / REACH) / (len || 1);
  return { x: dx * k, y: dy * k };
}

onMounted(async () => {
  window.addEventListener("pointermove", onMove);
  const [renderer, imgs] = await Promise.all([sharedRenderer(), partImages(props.model)]);
  const ctx = canvas.value?.getContext("2d");
  if (!alive || !ctx) return;
  const rig = new Rig(props.model);
  view = new RigView(rig, imgs);
  const root = new Container();
  root.addChild(view);
  const s = Math.min(props.width / props.model.w, props.height / props.model.h);
  view.scale.set(s, s);
  view.position.set((props.width - props.model.w * s) / 2, props.height - props.model.h * s);
  const anim = new Animator(rig);
  // Sprites run their idle cycle (wings, bobbing, spin); portraits only breathe.
  anim.rate = props.rate ?? 0;
  anim.target = target();
  anim.snap();
  let last = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    anim.target = target();
    anim.talking = !!props.talking;
    anim.step(Math.min(0.1, (now - last) / 1000) * prefs.animSpeed);
    last = now;
    view!.update();
    drawInto(renderer, root, ctx, props.width, props.height, res);
  };
  raf = requestAnimationFrame(frame);
});

onBeforeUnmount(() => {
  alive = false;
  cancelAnimationFrame(raf);
  window.removeEventListener("pointermove", onMove);
  view?.destroy();
  view = null;
});
</script>

<template>
  <canvas
    ref="canvas"
    class="live"
    :width="Math.round(width * res)"
    :height="Math.round(height * res)"
    :style="{ width: `${width}px`, height: `${height}px`, transform: flip ? 'scaleX(-1)' : undefined }"
  ></canvas>
</template>

<style scoped>
.live {
  display: block;
}
</style>
