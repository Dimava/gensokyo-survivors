<script setup lang="ts">
// The in-run tutorial: one hint at a time, each shown when its situation
// first comes up and retired when the player has done the thing (or after a
// while). Progress lives in prefs, so it teaches once per browser.
import { computed, ref, watch } from "vue";
import { host, state } from "../host.ts";
import { markSeen, prefs } from "../prefs.ts";
import { input } from "../input.ts";
import { runView } from "../../sim/game.ts";
import { hud } from "./useRun.ts";

interface Hint {
  id: string;
  text: string;
  /** When the hint becomes relevant. */
  when: () => boolean;
  /** When it is done (the player did it); otherwise it retires after `seconds`. */
  done?: () => boolean;
  seconds: number;
}

const moved = ref(0);

const HINTS: Hint[] = [
  {
    id: "move",
    text: "Move with WASD or the arrow keys, or hold the mouse button on the field and point where to go.",
    when: () => true,
    done: () => moved.value > 90,
    seconds: 20,
  },
  { id: "auto", text: "Your weapons fire on their own: focus on moving and staying out of reach.", when: () => (hud.value?.seconds ?? 0) > 4, seconds: 7 },
  {
    id: "gems",
    text: "Defeated enemies drop blue point items (experience). Walk close and they fly to you. A full EXP bar at the top is a level-up.",
    when: () => (hud.value?.kills ?? 0) > 0,
    done: () => (hud.value?.level ?? 1) > 1,
    seconds: 16,
  },
  {
    id: "graze",
    text: "Enemy bullets! Your hitbox is only the tiny red dot. Let bullets pass close without touching it to GRAZE: grazing fills the card meter (bottom right).",
    when: () => {
      const path = host.path();
      return !!path && runView(host.k, path).packed("bullets").count > 0;
    },
    done: () => (hud.value?.grazes ?? 0) >= 5,
    seconds: 14,
  },
  {
    id: "cards",
    text: "You hold a skill card. Play it with its number key or by clicking it. Cards cost Spirit (the blue orbs, bottom left), which refills over time.",
    when: () => (hud.value?.hand.some((c) => c.affordable) ?? false),
    done: () => false,
    seconds: 12,
  },
  {
    id: "boss",
    text: "Boss fight: stay inside the ring. Each spell card has its own HP bar and timer. Break it before time runs out; take no hits to capture it for double the bonus.",
    when: () => hud.value?.phase === "boss" && !!hud.value.boss,
    seconds: 12,
  },
];

const current = ref<Hint | null>(null);
let shownAt = 0;

watch(
  () => state.frame,
  () => {
    const h = hud.value;
    if (!prefs.hints || !h || state.paused || h.overlay !== "none") return;
    const m = input.move();
    if (m.x || m.y) moved.value++;
    const now = h.seconds;
    const cur = current.value;
    if (cur) {
      if ((cur.done && cur.done()) || now - shownAt > cur.seconds) {
        markSeen(cur.id);
        current.value = null;
      }
      return;
    }
    const next = HINTS.find((x) => !prefs.seen.includes(x.id) && x.when());
    if (next) {
      current.value = next;
      shownAt = now;
    }
  },
);

const text = computed(() => current.value?.text ?? "");

function dismiss(): void {
  if (current.value) markSeen(current.value.id);
  current.value = null;
}
</script>

<template>
  <Transition name="pop">
    <div v-if="current && prefs.hints" :key="current.id" class="hintbar">
      <span class="tag">Tip</span>
      <span>{{ text }}</span>
      <button class="btn small ghost" @click="dismiss">Got it</button>
    </div>
  </Transition>
</template>

<style scoped>
.hintbar {
  position: absolute;
  top: 110px;
  left: 50%;
  transform: translateX(-50%);
  width: min(640px, 90vw);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(20, 26, 52, 0.95);
  border: 1px solid rgba(255, 201, 77, 0.55);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  font-size: 0.95rem;
  pointer-events: auto;
}
.tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--gold);
  color: #2a1a00;
  font-weight: 800;
  font-size: 0.8rem;
}
</style>
