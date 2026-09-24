<script setup lang="ts">
import { computed, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { GAME_TITLE, CURRENCY, CHARACTERS, PLAYER_CHARACTER } from "../../content/names.ts";
import { bossDef, bossName } from "../../content/bosses.ts";
import { DECK_MIN } from "../../content/gacha.ts";
import { affordableNodes, fmtTime, owned, profile, stages, wallet } from "./useGame.ts";
import { stageDef, type StageDef } from "../../content/stages.ts";
import { ENEMIES, enemyIndex } from "../../content/enemies.ts";
import Keys from "./Keys.vue";
import NavHints from "./NavHints.vue";

const midbossName = (s: StageDef): string => {
  const mid = s.script.find((b) => b.form === "midboss");
  return mid ? ENEMIES[enemyIndex(mid.enemy)]!.name : "none";
};
const locked = (s: StageDef): boolean => !!s.requires && !profile.value.cleared.includes(s.requires);

const picking = ref(false);
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
        <h1 class="logo">{{ GAME_TITLE }}</h1>
        <div class="buttons">
          <button v-if="active" class="btn primary big" @mouseenter="hover" @click="resume">Continue Run</button>
          <button v-else class="btn primary big" :disabled="deckSize < DECK_MIN" @mouseenter="hover" @click="picking = true">Start Run</button>
          <button class="btn big" @mouseenter="hover" @click="host.go('tree')">
            Shrine Upgrades <span v-if="affordableNodes" class="badge">{{ affordableNodes }} affordable</span>
          </button>
          <button class="btn big" @mouseenter="hover" @click="host.go('cards')">
            Skill Cards &amp; Deck <span v-if="freshCards" class="badge">{{ freshCards }} new</span>
          </button>
          <button class="btn big" @mouseenter="hover" @click="host.go('packs')">Card Packs</button>
          <button class="btn big" @mouseenter="hover" @click="host.go('expeditions')">
            Expeditions <span v-if="tripsBack" class="badge">{{ tripsBack }} back</span>
          </button>
          <button class="btn big" @mouseenter="hover" @click="host.go('records')">Records</button>
          <button class="btn big" @mouseenter="hover" @click="host.go('gallery')">Gallery</button>
          <button class="btn big" @mouseenter="hover" @click="host.go('settings')">Settings</button>
          <button class="btn big" @mouseenter="hover" @click="host.go('help')">How to Play</button>
        </div>
      </div>
      <div class="right panel">
        <div class="who">
          <div class="dot" :style="{ background: '#e0314b' }"></div>
          <div>
            <div class="name">{{ CHARACTERS[PLAYER_CHARACTER].name }}</div>
            <div class="muted">{{ CHARACTERS[PLAYER_CHARACTER].title }}</div>
          </div>
        </div>
        <div class="coins"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
        <dl>
          <dt>Runs</dt>
          <dd>{{ profile.runs }}</dd>
          <dt>Stage clears</dt>
          <dd>{{ profile.clears }}</dd>
          <dt>Longest survival</dt>
          <dd>{{ fmtTime(profile.bestSeconds) }}</dd>
          <dt>Most kills</dt>
          <dd>{{ profile.bestKills }}</dd>
          <dt>Deck</dt>
          <dd>{{ deckSize }} cards</dd>
        </dl>
        <p v-if="active" class="note">A run is in progress. Continue it, or quit it from its pause menu.</p>
        <p v-else-if="profile.runs === 0" class="note">First time? Start a run: the game teaches you as you play.</p>
        <p v-else-if="affordableNodes" class="note">You can afford {{ affordableNodes }} shrine upgrade{{ affordableNodes > 1 ? "s" : "" }}.</p>
      </div>
    </div>

    <Transition name="pop">
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
                Midboss {{ midbossName(s) }}; boss at {{ fmtTime(s.bossAt) }}: {{ bossName(bossDef(s.boss)) }} with {{ bossDef(s.boss).spells.length }} spell cards · clear bonus {{ CURRENCY.icon }}
                {{ s.clearBonus }}
              </div>
            </div>
            <button v-if="!locked(s)" class="btn primary" @click="start(s.id)">Go</button>
            <span v-else class="lockmsg">Clear {{ stageDef(s.requires!).name }} to open</span>
          </div>
          <button class="btn ghost" @click="picking = false">Back <Keys for="Back" /></button>
        </div>
      </div>
    </Transition>
    <NavHints :back="picking ? 'close' : false" />
  </div>
</template>

<style scoped>
.menu {
  justify-content: safe center;
}
.wrap {
  display: flex;
  gap: 40px;
  align-items: center;
  width: min(1000px, 94vw);
  flex-wrap: wrap;
  justify-content: safe center;
}
.left {
  flex: 1 1 380px;
}
.logo {
  font-size: 2.6rem;
  margin: 0 0 20px;
  text-shadow: 0 0 20px rgba(224, 49, 75, 0.6);
}
.buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 380px;
}
.big {
  justify-content: flex-start;
  font-size: 1.1rem;
  padding: 0.75em 1.2em;
}
.badge {
  margin-left: auto;
  font-size: 0.75em;
  padding: 0.15em 0.6em;
  border-radius: 999px;
  background: var(--gold);
  color: #2a1a00;
}
.right {
  flex: 0 1 340px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.who {
  display: flex;
  gap: 12px;
  align-items: center;
}
.dot {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 3px solid #fff;
}
.name {
  font-weight: 700;
  font-size: 1.1rem;
}
dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 12px;
  margin: 0;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}
.note {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 201, 77, 0.1);
  border: 1px solid rgba(255, 201, 77, 0.3);
  font-size: 0.95rem;
}
.modal-wrap {
  position: absolute;
  inset: 0;
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
  border-radius: 12px;
  background: rgba(111, 211, 255, 0.08);
  border: 1px solid rgba(111, 211, 255, 0.3);
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
