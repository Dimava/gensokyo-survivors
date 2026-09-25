<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { host, state } from "../host.ts";
import { prefs } from "../prefs.ts";
import { audio } from "../audio.ts";
import { Vn } from "../../sim/vn.ts";
import { CHARACTERS } from "../../content/names.ts";
import { script } from "../../content/dialogue.ts";
import { hex } from "./useGame.ts";
import Portrait from "./Portrait.vue";
import Keys from "./Keys.vue";
import type { Look } from "../../art/drawing.ts";

/** The two speakers look at each other, toward the screen centre (a look is in screen space, mirrored portraits too). */
const TO_RIGHT: Look = { x: 0.6, y: 0.05 };
const TO_LEFT: Look = { x: -0.6, y: 0.05 };

const scene = computed(() => {
  void state.frame;
  const path = host.path();
  if (!path || !host.k.paths().includes(`${path}/vn`)) return null;
  return host.k.read(`${path}/vn`, Vn);
});

const shown = ref(0);
let timer = 0;
const text = computed(() => scene.value?.line.text ?? "");
const speaker = computed(() => (scene.value ? CHARACTERS[scene.value.line.speaker] : null));
const typing = computed(() => shown.value < text.value.length);

function tick(): void {
  if (shown.value < text.value.length) {
    shown.value = Math.min(text.value.length, shown.value + 1);
    if (shown.value % 3 === 0) audio.play("text");
  }
}

watch(
  () => (scene.value ? `${scene.value.script}:${scene.value.index}` : ""),
  () => {
    shown.value = 0;
  },
);

function advance(): void {
  if (typing.value) shown.value = text.value.length;
  else host.vnNext();
}

onMounted(() => {
  timer = window.setInterval(tick, 28 / prefs.animSpeed);
  host.vnConfirm = advance;
});
onBeforeUnmount(() => {
  clearInterval(timer);
  host.vnConfirm = null;
});

const cast = computed(() => {
  const lines = scene.value ? script(scene.value.script) : [];
  return {
    left: lines.find((l) => l.side === "left")?.speaker ?? "reimu",
    right: lines.find((l) => l.side === "right")?.speaker ?? "cirno",
  };
});

const speakers = computed(() => {
  const s = scene.value;
  if (!s) return { left: null, right: null } as const;
  return s.line.side === "left" ? { left: s.line.speaker, right: null } : { left: null, right: s.line.speaker };
});
</script>

<template>
  <div class="vn" v-if="scene && speaker" @click="advance">
    <div class="portraits">
      <div class="portrait left" :class="{ dim: !speakers.left }">
        <Portrait :who="cast.left" :look="TO_RIGHT" :talking="!!speakers.left && typing" />
        <div class="pname">{{ CHARACTERS[cast.left].short }}</div>
      </div>
      <div class="portrait right" :class="{ dim: !speakers.right }">
        <Portrait :who="cast.right" flip :look="TO_LEFT" :talking="!!speakers.right && typing" />
        <div class="pname">{{ CHARACTERS[cast.right].short }}</div>
      </div>
    </div>
    <div class="box panel">
      <div class="who" :style="{ color: hex(speaker.color === 0x2b2238 ? 0xb9a6ff : speaker.color) }">
        {{ speaker.name }} <span class="muted title">{{ speaker.title }}</span>
      </div>
      <p class="text">{{ text.slice(0, shown) }}<span class="caret" v-if="!typing">▶</span></p>
      <div class="foot">
        <span class="muted">{{ scene.index + 1 }} / {{ scene.total }}</span>
        <button class="btn small ghost" @click.stop="host.vnNext(true)">Skip dialogue <Keys for="Action:skip" :max="1" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vn {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(4, 8, 20, 0.2), rgba(4, 8, 20, 0.85));
  cursor: pointer;
  animation: fadein calc(0.4s * var(--anim)) both;
}
.portraits {
  position: absolute;
  inset: 0 0 180px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 6vw;
  pointer-events: none;
}
.portrait {
  transition:
    opacity calc(0.25s * var(--anim)),
    transform calc(0.25s * var(--anim));
}
.portrait.dim {
  opacity: 0.35;
  transform: scale(0.95) translateY(10px);
}
.sil {
  width: 220px;
  height: 320px;
  border-radius: 110px 110px 20px 20px;
  background: radial-gradient(circle at 50% 22%, #ffe2cc 0 16%, transparent 17%), linear-gradient(180deg, transparent 0 30%, var(--c) 30%);
  border: 3px solid rgba(255, 255, 255, 0.5);
}
.pname {
  text-align: center;
  font-family: var(--display);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #d6c48c;
  margin-top: 6px;
  text-shadow: 0 2px 0 #000;
}
.box {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: min(900px, 92vw);
  padding: 16px 22px 12px;
}
.who {
  font-family: var(--display);
  font-weight: 700;
  font-size: 1.25rem;
}
.title {
  font-weight: 500;
  font-size: 0.85rem;
  margin-left: 8px;
}
/* Spoken words in the display serif, as a VN sets them. */
.text {
  font-family: var(--display);
  font-size: 1.25rem;
  line-height: 1.5;
  min-height: 3.2em;
  margin: 8px 0;
}
.caret {
  margin-left: 6px;
  animation: blink calc(0.8s * var(--anim)) infinite;
}
.foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
@keyframes fadein {
  from {
    opacity: 0;
  }
}
</style>
