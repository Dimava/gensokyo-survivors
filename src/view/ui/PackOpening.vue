<script setup lang="ts">
// The pack opening: cards are dealt face down, then revealed one by one.
// Before each flip the card's glow builds for longer and brighter the rarer
// it is; a tap (or key) makes the rest of the sequence go faster, doubling
// each time, but never skips it.
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { prefs } from "../prefs.ts";
import { Pack } from "../../sim/pack.ts";
import { RARITY_INFO, cardDef, type Rarity } from "../../content/cards.ts";
import { CURRENCY } from "../../content/names.ts";
import { packDef } from "../../content/gacha.ts";
import CardFace from "./CardFace.vue";

const opening = computed(() => {
  void state.meta;
  return host.k.paths().includes("/pack") ? host.k.read("/pack", Pack) : null;
});

const CHARGE: Record<Rarity, number> = { N: 0.35, R: 0.7, SR: 1.15, SSR: 1.9 };
const DEAL = 0.18;

interface CardState {
  dealt: number; // 0..1
  charge: number; // 0..1
  flipped: boolean;
}

const cards = reactive<CardState[]>([]);
const speed = ref(1);
const phase = ref<"deal" | "reveal" | "done">("deal");
let current = 0;
let raf = 0;
let last = 0;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000) * prefs.animSpeed * speed.value;
  last = now;
  const pulls = opening.value?.pulls ?? [];
  if (phase.value === "deal") {
    let all = true;
    cards.forEach((c, i) => {
      const start = i * DEAL;
      const t = Math.max(0, Math.min(1, (elapsed - start) / 0.35));
      if (c.dealt < 1 && t >= 1) audio.play("flip");
      c.dealt = t;
      if (t < 1) all = false;
    });
    elapsed += dt;
    if (all) {
      phase.value = "reveal";
      current = 0;
    }
  } else if (phase.value === "reveal") {
    const c = cards[current];
    const pull = pulls[current];
    if (!c || !pull) {
      phase.value = "done";
    } else {
      c.charge = Math.min(1, c.charge + dt / CHARGE[pull.rarity]);
      if (c.charge >= 1 && !c.flipped) {
        c.flipped = true;
        audio.play(`reveal${pull.rarity}` as "revealN");
        if (pull.outcome === "refund") audio.play("coin");
        current++;
        if (current >= cards.length) phase.value = "done";
      }
    }
  }
  raf = requestAnimationFrame(frame);
}
let elapsed = 0;

onMounted(() => {
  const n = opening.value?.pulls.length ?? 0;
  for (let i = 0; i < n; i++) cards.push({ dealt: 0, charge: 0, flipped: false });
  audio.play("whoosh");
  last = performance.now();
  raf = requestAnimationFrame(frame);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener("keydown", onKey);
});

function tap(): void {
  if (phase.value === "done") return;
  speed.value = Math.min(8, speed.value * 2);
  audio.play("ui", { pitch: 1 + speed.value / 8 });
}
function onKey(e: KeyboardEvent): void {
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    if (phase.value === "done") close();
    else tap();
  }
}
function close(): void {
  audio.play("ui");
  host.closePack();
}

const labels = computed(() =>
  (opening.value?.pulls ?? []).map((p) =>
    p.outcome === "new" ? "NEW!" : p.outcome === "level" ? `Level up → ${p.level}` : `Max level: +${p.refund} ${CURRENCY.icon}`,
  ),
);
</script>

<template>
  <div v-if="opening" class="opening" @click="tap">
    <h2>{{ packDef(opening.pack).name }}</h2>
    <p class="muted">
      {{ phase === "done" ? "All revealed." : speed > 1 ? `Faster ×${speed}` : "Click or press Space to speed up" }}
    </p>
    <div class="row">
      <div
        v-for="(p, i) in opening.pulls"
        :key="i"
        class="slot"
        :style="{
          '--rc': RARITY_INFO[p.rarity].css,
          '--glow': cards[i]?.charge ?? 0,
          transform: `translateY(${(1 - (cards[i]?.dealt ?? 0)) * 60}vh) rotate(${(1 - (cards[i]?.dealt ?? 0)) * 25}deg)`,
          opacity: cards[i]?.dealt ?? 0,
        }"
      >
        <div class="flipper" :class="{ flipped: cards[i]?.flipped, ['r' + p.rarity]: true }">
          <div class="back">
            <div class="sigil"></div>
          </div>
          <div class="front">
            <CardFace :card="p.card" :level="p.level" />
          </div>
        </div>
        <div class="label" :class="{ show: cards[i]?.flipped }">
          <b :style="{ color: RARITY_INFO[p.rarity].css }">{{ RARITY_INFO[p.rarity].label }}</b>
          <span>{{ labels[i] }}</span>
          <span v-if="p.pity" class="pity">Pity guarantee</span>
        </div>
      </div>
    </div>
    <div class="foot">
      <button v-if="phase === 'done'" class="btn primary" @click.stop="close">Continue <span class="key">Space</span></button>
    </div>
    <p v-if="phase === 'done'" class="muted small">
      New cards join your deck while it has room ({{ opening.pulls.filter((p) => p.outcome === "new").map((p) => cardDef(p.card).name).join(", ") || "none new this time" }}).
    </p>
  </div>
</template>

<style scoped>
.opening {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: radial-gradient(ellipse at center, rgba(40, 20, 70, 0.9), rgba(4, 4, 12, 0.96));
  z-index: 20;
  cursor: pointer;
}
h2 {
  margin: 0;
  font-size: 2rem;
}
.row {
  display: flex;
  gap: 28px;
  margin: 20px 0;
  perspective: 900px;
}
.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.flipper {
  position: relative;
  width: 170px;
  height: 250px;
  transform-style: preserve-3d;
  transition: transform calc(0.45s * var(--anim)) cubic-bezier(0.3, 1.4, 0.5, 1);
}
.flipper.flipped {
  transform: rotateY(180deg);
}
.back,
.front {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 12px;
}
.front {
  transform: rotateY(180deg);
}
.back {
  border: 2px solid #c9b3ff;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 8px, transparent 8px 16px),
    linear-gradient(160deg, #3b1f6e, #1a0f33);
  /* The glow builds while the card charges; its colour is the rarity's. */
  box-shadow:
    0 0 calc(var(--glow) * 50px) calc(var(--glow) * 12px) var(--rc),
    inset 0 0 calc(var(--glow) * 60px) var(--rc);
  display: grid;
  place-items: center;
  animation: shiver calc(0.08s * var(--anim)) infinite alternate paused;
}
.rSSR .back,
.rSR .back {
  animation-play-state: running;
  animation-duration: calc((0.2s - var(--glow) * 0.15s) * var(--anim));
}
.sigil {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.6);
  background:
    radial-gradient(circle at 50% 25%, #fff 0 9%, transparent 10%),
    radial-gradient(circle at 50% 75%, #e0314b 0 9%, transparent 10%),
    radial-gradient(circle at 50% 25%, #e0314b 0 25%, transparent 26%),
    radial-gradient(circle at 50% 75%, #fff 0 25%, transparent 26%),
    linear-gradient(90deg, #fff 50%, #e0314b 50%);
  transform: rotate(calc(var(--glow) * 720deg));
}
.label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transform: translateY(-10px);
  transition: all calc(0.3s * var(--anim));
  min-height: 60px;
}
.label.show {
  opacity: 1;
  transform: none;
}
.pity {
  font-size: 0.75rem;
  color: var(--gold);
}
.foot {
  min-height: 48px;
}
.small {
  font-size: 0.85rem;
}
@keyframes shiver {
  from {
    transform: translateX(-1px) rotate(-0.5deg);
  }
  to {
    transform: translateX(1px) rotate(0.5deg);
  }
}
</style>
