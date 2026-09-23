// The dialogue overlay: a VN scene as a child scope of the run. It stores
// only the script id and the line index; the text is content. `vn:next`
// advances, `vn:skip` ends; at the end it tells the run, which closes it.

import { z } from "zod";
import { defineScope, event, input } from "gamebones";
import { script } from "../content/dialogue.ts";
import { RunBase } from "./run.ts";
import { parentPath } from "./levelup.ts";

const VnBase = defineScope("vn", {
  components: { scene: z.strictObject({ script: z.string(), index: z.int(), done: z.boolean() }) },
  events: {
    "vn:start": event({ script: z.string() }),
    "vn:next": input(),
    "vn:skip": input(),
  },
})
  .derive({ scene: (v) => v.q("scene")[0] })
  .exports((v) => {
    const s = v.q("scene")[0]?.scene;
    if (!s) return null;
    const lines = script(s.script);
    return { script: s.script, index: s.index, total: lines.length, line: lines[Math.min(s.index, lines.length - 1)]! };
  });

export const Vn: typeof VnBase = VnBase.rules((r) => [
  r.on("vn:start", (ev, ctx) => void ctx.spawn({ scene: { script: ev.script, index: 0, done: false } }, "scene")),

  r.on("vn:next").check((_, ctx) => (ctx.derived("scene")?.scene.done === false ? undefined : "the scene is over")),
  r.on("vn:next", (_, ctx) => {
    const scene = ctx.derived("scene")!;
    const last = script(scene.scene.script).length - 1;
    if (scene.scene.index < last) {
      ctx.mut(scene, "scene").index += 1;
      return;
    }
    ctx.mut(scene, "scene").done = true;
    ctx.send(parentPath(ctx.path), RunBase, "vn:closed", {});
  }),

  r.on("vn:skip").check((_, ctx) => (ctx.derived("scene")?.scene.done === false ? undefined : "the scene is over")),
  r.on("vn:skip", (_, ctx) => {
    ctx.mut(ctx.derived("scene")!, "scene").done = true;
    ctx.send(parentPath(ctx.path), RunBase, "vn:closed", {});
  }),
]);
