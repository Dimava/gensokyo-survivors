<script setup lang="ts">
import { computed, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { GAME_TITLE, CURRENCY, PLAYER_CHARACTER } from "../../content/names.ts";
import { bossDef, bossName } from "../../content/bosses.ts";
import { DECK_MIN } from "../../content/gacha.ts";
import { EXPEDITIONS_ENABLED } from "../../content/expeditions.ts";
import { affordableNodes, fmtTime, owned, profile, stages, wallet } from "./useGame.ts";
import { stageDef, type StageDef } from "../../content/stages.ts";
import { ENEMIES, enemyIndex } from "../../content/enemies.ts";
import NavHints from "./NavHints.vue";
import Portrait from "./Portrait.vue";
import HakureiSeal from "./HakureiSeal.vue";
import LivePortrait from "./LivePortrait.vue";
import { livePortrait } from "../art-set.ts";
import { prefs } from "../prefs.ts";

const midbossName = (s: StageDef): string => {
  const mid = s.script.find((b) => b.form === "midboss");
  return mid ? ENEMIES[enemyIndex(mid.enemy)]!.name : "none";
};
/** What capturing every spell card of the stage's boss pays (a capture pays twice the bonus). */
const captures = (s: StageDef): number => bossDef(s.boss).spells.reduce((sum, c) => sum + c.bonus * 2, 0);
const locked = (s: StageDef): boolean => !!s.requires && !profile.value.cleared.includes(s.requires);

const picking = ref(false);
/** Reimu stands on the shrine steps beside the menu, her rigged bust when the art style has one. */
const heroine = computed(() => livePortrait(PLAYER_CHARACTER, prefs.artStyle));
const active = computed(() => {
  void state.meta;
  return host.path();
});
const deckSize = computed(() => owned.value.filter((o) => o.inDeck).length);
const freshCards = computed(() => owned.value.filter((o) => o.fresh).length);
const tripsBack = computed(() => {
  void state.meta;
  return host.k.view().derived("trips").filter((t) => t.expedition.back).length;
});

function start(stage: string): void {
  picking.value = false;
  host.startRun(stage);
}
function resume(): void {
  audio.play("ui");
  state.screen = "run";
  state.paused = true;
}
function hover(): void {
  audio.play("ui", { vol: 0.4, pitch: 1.3 });
}
</script>

<template>
  <div v-keynav="{ id: 'menu' }" class="screen menu">
    <div class="wrap">
      <div class="left">
        <h1 class="logo">{{ GAME_TITLE }}<HakureiSeal class="seal" /></h1>
        <!-- Touhou's title menu: words, no boxes; the selected one sits in 「 」 on a vermilion brush stroke. -->
        <nav class="entries">
          <button v-if="active" class="entry" @mouseenter="hover" @click="resume"><span>Continue Run</span></button>
          <button v-else class="entry" :disabled="deckSize < DECK_MIN" @mouseenter="hover" @click="picking = true"><span>Start Run</span></button>
          <button class="entry" @mouseenter="hover" @click="host.go('tree')">
            <span>Shrine Upgrades</span><small v-if="affordableNodes" class="badge">{{ affordableNodes }} affordable</small>
          </button>
          <button class="entry" @mouseenter="hover" @click="host.go('cards')">
            <span>Skill Cards &amp; Deck</span><small v-if="freshCards" class="badge">{{ freshCards }} new</small>
          </button>
          <button class="entry" @mouseenter="hover" @click="host.go('packs')"><span>Card Packs</span></button>
          <button v-if="EXPEDITIONS_ENABLED" class="entry" @mouseenter="hover" @click="host.go('expeditions')">
            <span>Expeditions</span><small v-if="tripsBack" class="badge">{{ tripsBack }} back</small>
          </button>
          <button class="entry" @mouseenter="hover" @click="host.go('records')"><span>Records</span></button>
          <button class="entry" @mouseenter="hover" @click="host.go('gallery')"><span>Gallery</span></button>
          <button class="entry" @mouseenter="hover" @click="host.go('settings')"><span>Settings</span></button>
          <button class="entry" @mouseenter="hover" @click="host.go('help')"><span>How to Play</span></button>
        </nav>
      </div>
    </div>
    <div class="coins wallet"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
    <div class="heroine" aria-hidden="true">
      <LivePortrait v-if="heroine" :model="heroine" :width="400" :height="566" follow />
      <div v-else class="drawn"><Portrait :who="PLAYER_CHARACTER" /></div>
    </div>

    <Transition name="modal">
      <div v-if="picking" v-keynav="{ back: () => (picking = false) }" class="modal-wrap" @click.self="picking = false">
        <div class="panel stagepick">
          <h2>Choose a stage</h2>
          <div v-for="s in stages" :key="s.id" class="stage" :class="{ locked: locked(s) }">
            <div>
              <div class="sname">
                {{ s.name }} <span v-if="profile.cleared.includes(s.id)" class="clearmark" title="Cleared at least once">✓ cleared</span>
              </div>
              <div class="muted">{{ s.blurb }}</div>
              <div class="muted small">
                Midboss {{ midbossName(s) }}; boss at {{ fmtTime(s.bossAt) }}: {{ bossName(bossDef(s.boss)) }} with {{ bossDef(s.boss).spells.length }} spell cards · spell captures pay {{ CURRENCY.icon }}
                {{ captures(s) }}
              </div>
            </div>
            <button v-if="!locked(s)" class="btn primary" @click="start(s.id)">Go</button>
            <span v-else class="lockmsg">Clear {{ stageDef(s.requires!).name }} to open</span>
          </div>
          <button class="btn back" @click="picking = false">Back</button>
        </div>
      </div>
    </Transition>
    <NavHints :back="picking ? 'close' : false" />
  </div>
</template>

<style scoped>
/* The menu stands high on the left, clear of the torii below it. */
.menu {
  justify-content: flex-start;
  padding-top: 11vh;
}
.wrap {
  position: relative;
  z-index: 1;
  width: min(1200px, 94vw);
}
.left {
  width: fit-content;
  margin-left: 4%;
}
.logo {
  font-size: 2.6rem;
  margin: 0 0 18px;
}
.logo .seal {
  width: 0.82em;
  height: 0.82em;
  margin-left: 0.22em;
  vertical-align: -0.02em;
  rotate: -7deg;
}
.entries {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.entry {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: baseline;
  gap: 12px;
  padding: 0.1em 0.9em 0.16em;
  border: none;
  background: none;
  font-family: var(--display);
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
  color: rgba(233, 225, 207, 0.6);
  text-shadow: 0 2px 0 rgba(6, 5, 12, 0.75);
  transition: color var(--glide);
}
.entry > span {
  position: relative;
}
/* The brush stroke and the brackets show on the selected entry only; the stroke is swept in. */
.entry::before {
  content: "";
  position: absolute;
  inset: 2% -7% -6% -9%;
  z-index: -1;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 60' preserveAspectRatio='none'%3E%3Cpath d='M4 30C30 17 110 10 220 11S372 14 397 21L392 27C396 31 384 36 370 38C300 46 220 50 140 49S34 49 8 45C14 41 2 38 4 30Z' fill='%23b3261e'/%3E%3Cpath d='M30 20C120 14 260 12 380 18' stroke='%23d9443a' stroke-width='2' fill='none' opacity='.6'/%3E%3Cpath d='M20 44C120 48 260 46 360 40' stroke='%238a1a14' stroke-width='3' fill='none' opacity='.6'/%3E%3C/svg%3E") no-repeat center / 100% 100%;
  clip-path: inset(0 100% 0 0);
  transition: clip-path calc(0.22s * var(--anim)) ease-out;
}
.entry > span::before,
.entry > span::after {
  position: absolute;
  top: 0;
  opacity: 0;
  transition: opacity var(--glide);
}
.entry > span::before {
  content: "「";
  right: calc(100% + 0.1em);
}
.entry > span::after {
  content: "」";
  left: calc(100% + 0.1em);
}
.entry:is(:hover, [data-nav-sel]):not(:disabled) {
  color: #fff8ea;
}
.entry:is(:hover, [data-nav-sel]):not(:disabled)::before {
  clip-path: inset(0 0 0 0);
}
.entry:is(:hover, [data-nav-sel]):not(:disabled) > span::before,
.entry:is(:hover, [data-nav-sel]):not(:disabled) > span::after {
  opacity: 1;
}
.entry:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.badge {
  font-family: "Segoe UI", system-ui, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0 6px;
  border: 1px solid rgba(232, 193, 90, 0.6);
  border-radius: 2px;
  color: #e8c15a;
  text-shadow: none;
}
/* Reimu on the shrine steps, right of the menu; her feet fade into the dark below. She watches the cursor. */
.heroine {
  position: absolute;
  bottom: 0;
  right: max(2vw, calc(50% - 600px));
  width: 400px;
  height: 566px;
  pointer-events: none;
  mask-image: linear-gradient(180deg, #000 78%, transparent 99%);
  animation: arrive calc(0.7s * var(--anim)) cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.heroine .drawn {
  width: 240px;
  height: 340px;
  transform: scale(1.66);
  transform-origin: 50% 100%;
  margin: 226px 0 0 80px;
}
.wallet {
  position: absolute;
  top: 18px;
  right: max(3vw, calc(50% - 600px));
  z-index: 1;
}
@keyframes arrive {
  from {
    opacity: 0;
    translate: 24px 0;
  }
}
.modal-wrap {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
}
.stagepick {
  padding: 22px 26px;
  width: min(560px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.stagepick h2 {
  margin: 0;
}
.stage {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(214, 196, 140, 0.35);
}
.stage.locked {
  opacity: 0.55;
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--line);
}
.lockmsg {
  font-size: 0.85rem;
  color: var(--muted);
  text-align: right;
  max-width: 130px;
}
.clearmark {
  font-size: 0.75rem;
  color: var(--gold);
  margin-left: 6px;
}
.sname {
  font-size: 1.2rem;
  font-weight: 700;
}
.small {
  font-size: 0.85rem;
  margin-top: 4px;
}
</style>
