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
        <Portrait :who="cast.left" :talking="!!speakers.left && typing" />
        <div class="pname">{{ CHARACTERS[cast.left].short }}</div>
      </div>
      <div class="portrait right" :class="{ dim: !speakers.right }">
        <Portrait :who="cast.right" flip :talking="!!speakers.right && typing" />
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
        <span class="muted"><span class="key">Space</span> / click: {{ typing ? "show all" : "next" }}</span>
        <button class="btn small ghost" @click.stop="host.vnNext(true)">Skip dialogue <span class="key">X</span></button>
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
  box-shadow: 0 0 60px color-mix(in srgb, var(--c) 50%, transparent);
  border: 3px solid rgba(255, 255, 255, 0.5);
}
.pname {
  text-align: center;
  font-weight: 800;
  margin-top: 6px;
  text-shadow: 0 2px 4px #000;
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
  font-weight: 800;
  font-size: 1.15rem;
}
.title {
  font-weight: 500;
  font-size: 0.85rem;
  margin-left: 8px;
}
.text {
  font-size: 1.2rem;
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
