<script setup lang="ts">
import { computed } from "vue";
import { state } from "../host.ts";
import { ui } from "../presenter.ts";
import { hud } from "./useRun.ts";
import HudView from "./HudView.vue";
import SpellCutIn from "./SpellCutIn.vue";
import LevelUpView from "./LevelUpView.vue";
import DialogueView from "./DialogueView.vue";
import PauseMenu from "./PauseMenu.vue";
import HintBar from "./HintBar.vue";

const h = computed(() => hud.value);
</script>

<template>
  <div class="run">
    <SpellCutIn v-if="h" />
    <HudView v-if="h" />
    <!-- The ending's words replace the banners: "Stage clear!" is not said twice. -->
    <div v-if="!(h && h.phase === 'over')" class="banners">
      <TransitionGroup name="banner">
        <div v-for="b in ui.banners" :key="b.id" class="banner" :class="b.tone">
          <div class="btext">{{ b.text }}</div>
          <div v-if="b.sub" class="bsub">{{ b.sub }}</div>
        </div>
      </TransitionGroup>
    </div>
    <HintBar v-if="h && !state.paused" />
    <LevelUpView v-if="h" :open="h.overlay === 'levelup' && !state.paused" />
    <Transition name="fade">
      <DialogueView v-if="h && h.overlay === 'vn' && !state.paused" />
    </Transition>
    <div v-if="h && h.phase === 'over'" class="ending" :class="h.outcome">
      {{ h.outcome === "clear" ? "Stage Clear!" : h.outcome === "dead" ? "Defeated…" : "Retreating…" }}
    </div>
    <PauseMenu v-if="state.paused" />
  </div>
</template>

<style scoped>
.run {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.run > :deep(*) {
  pointer-events: auto;
}
.run > :deep(.hud) {
  pointer-events: none;
}
.banners {
  position: absolute;
  top: 34%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none !important;
}
/* A banner is a title strip: serif words on a flat ink band between two
   hairlines (straw; vermilion for a warning, gold for good news). */
.banner {
  padding: 7px 44px 9px;
  background: rgba(18, 14, 12, 0.8);
  border-block: 1px solid rgba(214, 196, 140, 0.55);
  text-align: center;
  color: #f6f0e1;
}
.btext {
  font-family: var(--display);
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 0 #000;
}
.bsub {
  font-size: 0.9rem;
  color: #cfc6b0;
}
.banner.warn {
  border-color: rgba(229, 83, 45, 0.85);
  color: #ffd2c4;
  animation: flash calc(0.5s * var(--anim)) 4 alternate;
}
.banner.boss .btext {
  font-style: italic;
}
.banner.spell .btext {
  font-size: 1.2rem;
}
.banner.good {
  border-color: rgba(232, 193, 90, 0.85);
  color: #e8c15a;
}
.banner.bad {
  border-color: rgba(150, 140, 125, 0.6);
  color: #b9b2a4;
}
.banner-enter-active {
  transition: all calc(0.35s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1);
}
.banner-leave-active {
  transition: all calc(0.3s * var(--anim)) ease-in;
}
.banner-enter-from {
  opacity: 0;
  transform: scaleX(0.3);
}
.banner-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
.ending {
  position: absolute;
  top: 40%;
  left: 0;
  right: 0;
  text-align: center;
  font-family: var(--display);
  font-size: 3.2rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  /* As the results' title: gold on a clear, vermilion on a defeat, a hard dark-red drop. */
  text-shadow: 0 4px 0 #3a0a12;
  animation: zoom calc(0.8s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1) both;
  pointer-events: none !important;
}
.ending.clear {
  color: #e8c15a;
}
.ending.dead {
  color: #e8604a;
  /* After the death animation's burst (fx-death.ts). */
  animation-delay: calc(0.7s * var(--anim));
}
@keyframes flash {
  to {
    background: rgba(120, 10, 30, 0.85);
  }
}
@keyframes zoom {
  from {
    opacity: 0;
    transform: scale(1.6);
  }
}
</style>
