<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { host } from "../host.ts";
import { kds } from "../keys.ts";
import { GAME_SUBTITLE, GAME_TITLE } from "../../content/names.ts";
import HakureiSeal from "./HakureiSeal.vue";

// Any key at all (a physical key press, not a release or a virtual code) opens the menu.
const off = kds.on({ screen: "title", mods: undefined, event: { type: "keydown", repeat: false } }, (e) => {
  if (e.code === (e.event as KeyboardEvent).code) host.go("menu");
});
onBeforeUnmount(off);

const build = [`v${__BUILD__.version}`, __BUILD__.commit, __BUILD__.date].filter(Boolean).join(" · ");
</script>

<template>
  <div class="screen title" @click="host.go('menu')">
    <!-- A title lockup the Touhou way: the place's kanji small above, the name, a Hakurei seal
         stamped at its end, and the subtitle behind a wave dash. -->
    <div class="logo">
      <p class="kanji" lang="ja">幻想郷</p>
      <h1>
        {{ GAME_TITLE }}
        <HakureiSeal class="seal" />
      </h1>
      <p class="sub">～ {{ GAME_SUBTITLE }}</p>
    </div>
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
  padding-bottom: 6vh;
}
.kanji {
  margin: 0 0 6px;
  font: 700 1.5rem/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  letter-spacing: 0.9em;
  /* The letter-spacing trails the last glyph: pull it back so the word sits centred. */
  margin-right: -0.9em;
  color: #d6c48c;
  animation: fade calc(1.2s * var(--anim)) ease-out both;
}
h1 {
  position: relative;
  display: inline-block;
  margin: 0;
  font-size: clamp(2.4rem, 6vw, 4.6rem);
  letter-spacing: 0.04em;
  text-shadow: 0 4px 0 #6a0f1f;
  animation: rise calc(0.9s * var(--anim)) cubic-bezier(0.2, 1, 0.3, 1) calc(0.2s * var(--anim)) both;
}
/* A vermilion seal stamped at the end of the name, a little crooked. */
.seal {
  position: absolute;
  left: calc(100% + 0.16em);
  top: 0.12em;
  width: 0.86em;
  height: 0.86em;
  rotate: -7deg;
  animation: stamp calc(0.45s * var(--anim)) cubic-bezier(0.3, 1.6, 0.5, 1) calc(0.9s * var(--anim)) both;
}
.sub {
  margin: 14px 0 0;
  font-family: var(--display);
  font-style: italic;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
  color: #d6c48c;
  animation: fade calc(1s * var(--anim)) ease-out calc(0.6s * var(--anim)) both;
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
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
@keyframes stamp {
  from {
    opacity: 0;
    scale: 1.8;
    rotate: 4deg;
  }
}
</style>
