<script setup lang="ts">
import { computed } from "vue";
import { state } from "../host.ts";
import { ui } from "../presenter.ts";
import { hud } from "./useRun.ts";
import HudView from "./HudView.vue";
import LevelUpView from "./LevelUpView.vue";
import DialogueView from "./DialogueView.vue";
import PauseMenu from "./PauseMenu.vue";
import HintBar from "./HintBar.vue";

const h = computed(() => hud.value);
</script>

<template>
  <div class="run">
    <HudView v-if="h" />
    <div class="banners">
      <TransitionGroup name="banner">
        <div v-for="b in ui.banners" :key="b.id" class="banner" :class="b.tone">
          <div class="btext">{{ b.text }}</div>
          <div v-if="b.sub" class="bsub">{{ b.sub }}</div>
        </div>
      </TransitionGroup>
    </div>
    <HintBar v-if="h && !state.paused" />
    <Transition name="fade">
      <LevelUpView v-if="h && h.overlay === 'levelup' && !state.paused" />
    </Transition>
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
.banner {
  padding: 10px 28px;
  border-radius: 12px;
  background: rgba(10, 14, 30, 0.82);
  border: 1px solid var(--line);
  text-align: center;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
}
.btext {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.bsub {
  font-size: 0.9rem;
  color: var(--muted);
}
.banner.warn {
  border-color: var(--red-2);
  color: #ffc0cc;
  animation: flash calc(0.5s * var(--anim)) 4 alternate;
}
.banner.boss,
.banner.spell {
  border-color: var(--cyan);
  background: linear-gradient(90deg, rgba(10, 30, 60, 0.9), rgba(30, 10, 50, 0.9));
}
.banner.boss .btext {
  color: #d8f6ff;
  font-style: italic;
}
.banner.spell .btext {
  font-size: 1.2rem;
  color: #fff3c4;
}
.banner.good {
  border-color: var(--gold);
  color: #fff0c0;
}
.banner.bad {
  border-color: #777;
  color: #bbb;
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
  font-size: 3.2rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-shadow: 0 4px 20px #000;
  animation: zoom calc(0.8s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1) both;
  pointer-events: none !important;
}
.ending.clear {
  color: #fff0c0;
}
.ending.dead {
  color: #ff9aac;
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
