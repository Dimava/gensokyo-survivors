<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { host } from "../host.ts";
import { kds } from "../keys.ts";
import { GAME_SUBTITLE, GAME_TITLE } from "../../content/names.ts";

// Any key at all (a physical key press, not a release or a virtual code) opens the menu.
const off = kds.on({ screen: "title", mods: undefined, event: { type: "keydown", repeat: false } }, (e) => {
  if (e.code === (e.event as KeyboardEvent).code) host.go("menu");
});
onBeforeUnmount(off);

const build = [`v${__BUILD__.version}`, __BUILD__.commit, __BUILD__.date].filter(Boolean).join(" · ");
</script>

<template>
  <div class="screen title" @click="host.go('menu')">
    <div class="logo">
      <svg class="yy" viewBox="-1 -1 2 2" aria-hidden="true">
        <circle r="1" fill="#fff" />
        <path d="M0-1A1 1 0 0 1 0 1A.5.5 0 0 1 0 0A.5.5 0 0 0 0-1Z" fill="#e0314b" />
        <circle cy="-.5" r=".15" fill="#e0314b" />
        <circle cy=".5" r=".15" fill="#fff" />
      </svg>
      <h1>{{ GAME_TITLE }}</h1>
      <p class="sub">{{ GAME_SUBTITLE }}</p>
    </div>
    <p class="press">Press any key or click to begin</p>
    <p class="foot muted">A Touhou Project fan game · every picture drawn and every sound synthesized in code</p>
    <p class="ver muted">{{ build }}</p>
  </div>
</template>

<style scoped>
.title {
  justify-content: safe center;
  cursor: pointer;
}
.logo {
  text-align: center;
  animation: rise calc(0.9s * var(--anim)) cubic-bezier(0.2, 1, 0.3, 1) both;
}
.yy {
  display: block;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 50%;
  box-shadow: 0 0 40px rgba(224, 49, 75, 0.6);
  animation: spin calc(6s * var(--anim)) linear infinite;
}
h1 {
  margin: 0;
  font-size: clamp(2.4rem, 6vw, 4.6rem);
  letter-spacing: 0.06em;
  text-shadow:
    0 0 24px rgba(224, 49, 75, 0.7),
    0 4px 0 #6a0f1f;
}
.sub {
  margin: 8px 0 0;
  color: #d8def5;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
}
.press {
  margin-top: 48px;
  font-size: 1.2rem;
  font-weight: 600;
  animation: blink calc(1.6s * var(--anim)) ease-in-out infinite;
}
.foot {
  position: absolute;
  bottom: 14px;
  font-size: 0.85rem;
}
.ver {
  position: absolute;
  right: 16px;
  bottom: 14px;
  font-size: 0.75rem;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes blink {
  50% {
    opacity: 0.35;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
}
</style>
