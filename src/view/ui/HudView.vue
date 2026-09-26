<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { host, state } from "../host.ts";
import { input } from "../input.ts";
import Keys from "./Keys.vue";
import { audio } from "../audio.ts";
import { CURRENCY, PLAYER_CHARACTER } from "../../content/names.ts";
import { SLOTS } from "../../sim/tuning.ts";
import { fmtTime, hex } from "./useGame.ts";
import { hud } from "./useRun.ts";
import { ui } from "../presenter.ts";
import { CARD_KINDS, cardDef } from "../../content/cards.ts";
import { cardIcon } from "./cardIcons.ts";
import SpellBar from "./SpellBar.vue";
import CardFace from "./CardFace.vue";
import CardBack from "./CardBack.vue";
import { itemIcon } from "./itemIcons.ts";
import Face from "./Face.vue";

const h = computed(() => hud.value!);
const hpPct = computed(() =>
  Math.max(0, Math.min(100, (h.value.hp / h.value.maxHp) * 100)),
);
const xpPct = computed(() =>
  Math.max(0, Math.min(100, (h.value.xp / h.value.next) * 100)),
);
const spiritOrbs = computed(() => {
  const out: number[] = [];
  for (let i = 0; i < h.value.spiritMax; i++)
    out.push(Math.max(0, Math.min(1, h.value.spirit - i)));
  return out;
});
const emptyWeapons = computed(() =>
  Math.max(0, SLOTS.weapons - h.value.weapons.length),
);
const emptyPassives = computed(() =>
  Math.max(0, SLOTS.passives - h.value.passives.length),
);
/** The card just played: its glyph and name rise from the hand and fade, in its kind's colour. */
const cast = computed(() => {
  if (!ui.cardFlash) return null;
  const def = cardDef(ui.cardFlash.card);
  return { id: ui.cardFlash.id, def, icon: cardIcon(def.id), kc: CARD_KINDS[def.kind].css };
});

/** Touch screens have no Shift: focus is a button held with the other thumb. */
const touch = matchMedia("(pointer: coarse)").matches;
const focusHeld = ref(false);
function holdFocus(on: boolean): void {
  focusHeld.value = on;
  input.touchFocus = on;
}
onBeforeUnmount(() => holdFocus(false));

function play(slot: number): void {
  host.playCard(slot);
}
function pause(): void {
  state.paused = true;
  state.pausePage = "main";
  audio.play("back");
  host.save();
}
</script>

<template>
  <div class="hud">
    <!-- Left: Reimu's corner. Her face in a gold ring with her level on a tab at its foot; her life,
         her charms and her experience (point-item blue) beside it; under them her kit: weapons as
         square plaques, items as round medallions, a pip under each per level, a full one framed in gold. -->
    <div class="tl">
      <div class="facewrap">
        <Face :who="PLAYER_CHARACTER" :size="48" class="lface" :class="{ hurt: hpPct < 30 }" />
        <span class="lv" :title="`Level ${h.level}`"><small>Lv</small>{{ h.level }}</span>
      </div>
      <div class="lcol">
        <div class="liferow">
          <div class="hp" :title="`Health: ${Math.ceil(h.hp)} of ${h.maxHp}. At 0 the run ends.`">
            <div class="hpfill" :style="{ width: hpPct + '%' }" :class="{ low: hpPct < 30 }"></div>
            <span class="hpnum">{{ Math.ceil(h.hp) }}<small> / {{ h.maxHp }}</small></span>
          </div>
          <span
            v-if="h.revivesLeft"
            class="charms"
            :title="`Last Stand: ${h.revivesLeft === 1 ? 'once more' : `${h.revivesLeft} more times`} this run, a hit that would fell you leaves you at 5% HP instead.`"
          >
            <svg v-for="n in h.revivesLeft" :key="n" class="omamori" viewBox="0 0 12 16" aria-hidden="true">
              <path d="M2 5.5Q2 3 6 3Q10 3 10 5.5V15H2Z" fill="#c8352a" stroke="#6a1510" stroke-width="0.8" />
              <path d="M3.4 7.5H8.6M3.4 9.6H8.6" stroke="#e8c15a" stroke-width="0.9" />
              <path d="M6 3V0.8M4.6 1.6L6 3L7.4 1.6" stroke="#e8c15a" stroke-width="0.9" fill="none" />
            </svg>
          </span>
        </div>
        <div class="xp" :title="`Experience ${Math.floor(h.xp)} of ${h.next}: point items fill it, and a full bar is a level-up.`">
          <div class="xpfill" :style="{ width: xpPct + '%' }"></div>
        </div>
        <div class="kit">
          <div
            v-for="w in h.weapons"
            :key="w.id"
            class="tile"
            :class="{ max: w.level === w.max }"
            :title="`${w.name} (level ${w.level} of ${w.max}): ${w.desc}`"
          >
            <svg class="ico" viewBox="0 0 24 24" fill="currentColor" :style="{ color: hex(w.color) }" v-html="itemIcon(w.id)"></svg>
            <i class="pips"><b v-for="n in w.level" :key="n"></b></i>
          </div>
          <div v-for="n in emptyWeapons" :key="'ew' + n" class="tile empty" title="Empty weapon slot: level-ups can offer a new weapon"></div>
          <span class="kitgap" aria-hidden="true"></span>
          <div
            v-for="p in h.passives"
            :key="p.id"
            class="tile round"
            :class="{ max: p.level === p.max }"
            :title="`${p.name} (level ${p.level} of ${p.max}): ${p.desc}`"
          >
            <svg class="ico" viewBox="0 0 24 24" fill="currentColor" :style="{ color: hex(p.color) }" v-html="itemIcon(p.id)"></svg>
            <i class="pips"><b v-for="n in p.level" :key="n"></b></i>
          </div>
          <div v-for="n in emptyPassives" :key="'ep' + n" class="tile round empty" title="Empty item slot: level-ups can offer a new item"></div>
        </div>
      </div>
    </div>

    <!-- Centre: time, stage -->
    <div class="tc" v-if="!h.boss">
      <div class="time" title="Run time">{{ fmtTime(h.seconds) }}</div>
      <div class="stage">{{ h.stage }}</div>
    </div>

    <!-- Boss -->
    <div class="boss" v-else>
      <div class="bossrow">
        <span class="bname">{{ h.boss.name }}</span>
        <!-- Her spell cards as Touhou's stars: captured gold, broken washi, timed out grey, the current one lit, the rest outlined. -->
        <span
          class="stars"
          title="Spell cards: captured (gold), broken (white), broken after the timer (grey), current (lit), still to come (outlined)"
        >
          <svg
            v-for="i in h.boss.total"
            :key="i"
            viewBox="0 0 12 12"
            :class="h.boss.results[i - 1] ?? (i - 1 === h.boss.index ? 'now' : 'todo')"
          >
            <path d="M6 .9 7.5 4.2l3.6.4-2.7 2.4.8 3.6L6 8.8l-3.2 1.8.8-3.6L.9 4.6l3.6-.4Z" />
          </svg>
        </span>
        <span
          v-if="h.boss.late"
          class="btime hurry"
          title="The bonus timer ran out: break the card to go on"
          >Bonus failed</span
        >
        <span
          v-else
          class="btime"
          :class="{ hurry: h.boss.timeLeft < 10 }"
          title="Bonus time left on this spell card"
          >{{ h.boss.timeLeft.toFixed(1) }}s</span
        >
      </div>
      <div class="bbar" :title="`Spell card HP: ${h.boss.hp}`">
        <div class="bfill" :style="{ width: h.boss.frac * 100 + '%' }"></div>
      </div>
      <SpellBar :who="h.boss.who" :spell="h.boss.spell" :index="h.boss.index" :bonus="h.boss.bonus" :late="h.boss.late" :intro="h.boss.intro" />
    </div>

    <!-- Right: kills, donations, pause -->
    <div class="tr">
      <!-- The run's tally, as Touhou's side panel keeps score: serif labels, numbers on hairlines. -->
      <div class="tally">
        <div class="trow" title="Enemies defeated this run">
          <span class="tlabel">Kills</span><b>{{ h.kills }}</b>
        </div>
        <div class="trow gold" :title="`${CURRENCY.name} collected this run (paid out at the end, with bonuses)`">
          <span class="tlabel">{{ CURRENCY.name }}</span><b>{{ CURRENCY.icon }} {{ h.coins }}</b>
        </div>
      </div>
      <button class="btn small ghost pausebtn" @click="pause">
        Pause <Keys for="Action:pause" :max="1" />
      </button>
    </div>

    <!-- Statuses -->
    <div class="statuses">
      <TransitionGroup name="pop">
        <div
          v-for="s in h.statuses"
          :key="s.id"
          class="status"
          :style="{ borderColor: s.color, color: s.color }"
          :title="s.help"
        >
          {{ s.label
          }}<span v-if="s.left !== null"> {{ s.left.toFixed(1) }}s</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- Bottom: Spirit, the hand, the draw pile with the graze meter -->
    <div class="bottom" :class="{ away: state.paused }">
      <!-- A card just played: its name rises from the hand. Not under a level-up or a dialogue, where it would hang frozen between the tablets. -->
      <Transition name="cast">
        <div
          v-if="cast && h.overlay === 'none'"
          :key="cast.id"
          class="cast"
          :style="{ '--kc': cast.kc }"
        >
          <svg
            class="casticon"
            viewBox="0 0 24 24"
            fill="currentColor"
            v-html="cast.icon"
          ></svg>
          <span>{{ cast.def.name }}</span>
        </div>
      </Transition>
      <div
        class="spirit"
        :title="`Spirit: cards cost Spirit. It refills by ${h.spiritRate.toFixed(2)} per second.`"
      >
        <div class="blabel">Spirit</div>
        <div class="orbs">
          <div v-for="(f, i) in spiritOrbs" :key="i" class="orb">
            <div
              class="orbfill"
              :style="{ height: f * 100 + '%' }"
              :class="{ full: f >= 1 }"
            ></div>
          </div>
        </div>
      </div>
      <div class="hand">
        <!-- Fixed slots: a played card leaves its slot empty; a drawn card takes the first empty one.
             The empty frame always holds the slot; the card animates in and out on top of it.
             The cards are the collection's own faces, held low: their foot runs off the screen. -->
        <div v-for="(c, i) in h.slots" :key="i" class="hslot">
          <div class="card emptycard" title="Empty hand slot: graze bullets to draw a card">
            <span class="ckey key">{{ i + 1 }}</span>
          </div>
          <Transition name="card">
            <button
              v-if="c"
              class="card slotted"
              :key="c.entity"
              :class="{ off: !c.affordable }"
              :style="{ '--charge': Math.max(0, Math.min(1, h.spirit / c.cost)) }"
              :title="`${c.name} (${CARD_KINDS[cardDef(c.id).kind].label}, ${c.rarity}, level ${c.level}) costs ${c.cost} Spirit: ${c.text}`"
              @click="play(c.slot)"
            >
              <span class="cf"><CardFace :card="c.id" :level="c.level" /></span>
              <span class="ckey key">{{ c.slot + 1 }}</span>
            </button>
          </Transition>
        </div>
      </div>
      <div
        class="pile"
        :title="`Graze meter: pass close to enemy bullets to fill it; when full you draw a card. Grazes this run: ${h.grazes}`"
      >
        <div class="blabel">{{ h.hand.length >= h.handMax && h.meter >= 1 ? "Hand full" : "Graze" }}</div>
        <div class="deck">
          <span class="cb"><CardBack /></span>
          <span class="count">{{ h.deck }}</span>
        </div>
        <div class="mbar">
          <div class="mfill" :style="{ width: h.meter * 100 + '%' }"></div>
        </div>
        <div class="piles">Discard {{ h.discard }}</div>
      </div>
    </div>

    <button
      v-if="touch"
      class="focusbtn"
      :class="{ on: focusHeld }"
      @pointerdown.prevent="holdFocus(true)"
      @pointerup="holdFocus(false)"
      @pointercancel="holdFocus(false)"
      @lostpointercapture="holdFocus(false)"
      @contextmenu.prevent
    >
      Focus
    </button>
  </div>
</template>

<style scoped>
.focusbtn {
  position: absolute;
  right: 18px;
  bottom: 40%;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  background: rgba(20, 26, 56, 0.55);
  color: var(--text);
  font-weight: 700;
  touch-action: none;
}
.focusbtn.on {
  background: rgba(224, 49, 75, 0.6);
  border-color: #fff;
}
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-size: 14px;
}
.hud button,
.hud [title] {
  pointer-events: auto;
}
.tl {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.facewrap {
  position: relative;
  flex: none;
}
/* Her level on a small lacquer tab hung from the ring's foot. */
.lv {
  position: absolute;
  left: 50%;
  top: 40px;
  translate: -50% 0;
  padding: 0 5px;
  border: 1px solid #e8c15a;
  border-radius: 1px;
  background: #17110e;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
  color: #f6f0e1;
  font: 700 12px/15px var(--display);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.lv small {
  margin-right: 2px;
  font-size: 9px;
  color: #d6c48c;
}
/* Experience: a thin trough under her life, filled in the blue of the point items that fill it. */
.xp {
  width: 230px;
  height: 5px;
  margin-top: -2px;
  background: rgba(8, 6, 5, 0.85);
  box-shadow:
    0 0 0 1px rgba(232, 193, 90, 0.3),
    0 2px 0 1px rgba(0, 0, 0, 0.4);
}
.xpfill {
  height: 100%;
  background: #4d8fe8;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: width calc(0.2s * var(--anim));
}
/* Her face in a gold ring; low on life, the ring turns vermilion. */
.lface {
  flex: none;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
  transition: box-shadow var(--glide);
}
.lface.hurt {
  box-shadow:
    0 0 0 2px #c8352a,
    0 2px 0 rgba(0, 0, 0, 0.5);
}
.lcol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 3px;
}
.liferow {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hp {
  position: relative;
  width: 230px;
  height: 16px;
  border-radius: 1px;
  background: rgba(23, 17, 14, 0.88);
  border: 1px solid rgba(232, 193, 90, 0.55);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.hpfill {
  height: 100%;
  background: #c8352a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: width calc(0.15s * var(--anim));
}
.hpfill.low {
  animation: pulse calc(0.6s * var(--anim)) infinite alternate;
}
.hpnum {
  position: absolute;
  right: 6px;
  top: 0;
  line-height: 14px;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f6f0e1;
  text-shadow: 0 1px 1px #000;
}
.hpnum small {
  font-size: 10px;
  font-weight: 600;
  color: rgba(246, 240, 225, 0.7);
}
/* Revivals: little omamori, one per Hakurei Blessing left. */
.charms {
  display: flex;
  gap: 2px;
}
.omamori {
  width: 12px;
  height: 16px;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6));
}
.kit {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.kitgap {
  width: 6px;
}
/* A weapon is a small square plaque, an item a round medallion; levels are pips under it. */
.tile {
  position: relative;
  width: 26px;
  height: 26px;
  margin-bottom: 6px;
  border-radius: 1px;
  background: rgba(23, 17, 14, 0.85);
  border: 1px solid rgba(232, 193, 90, 0.35);
  display: grid;
  place-items: center;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}
.tile.round {
  border-radius: 50%;
}
.tile .ico {
  width: 17px;
  height: 17px;
  --hole: #17110e;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.7));
}
.tile.max {
  border-color: #e8c15a;
  background: rgba(58, 42, 22, 0.92);
}
.tile.empty {
  opacity: 0.35;
  box-shadow: none;
}
.pips {
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  translate: -50% 0;
  display: flex;
  gap: 1px;
}
.pips b {
  width: 2px;
  height: 3px;
  background: #d6c48c;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
}
.tile.max .pips b {
  background: #e8c15a;
}
.tc {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}
.time {
  font-size: 30px;
  font-weight: 800;
  text-shadow: 0 2px 6px #000;
  font-variant-numeric: tabular-nums;
}
.stage {
  font-family: var(--display);
  font-style: italic;
  font-size: 13px;
  color: #d6c48c;
  text-shadow: 0 1px 2px #000;
}
.boss {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, 60vw);
}
.bossrow {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bname {
  font-family: var(--display);
  font-weight: 700;
  font-size: 15px;
  color: #f6f0e1;
  text-shadow: 0 1px 2px #000;
}
.stars {
  display: flex;
  gap: 3px;
}
.stars svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: #d6c48c;
  stroke-width: 1.1;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.7));
}
.stars .now {
  fill: #f6f0e1;
  stroke: #f6f0e1;
}
.stars .captured {
  fill: #e8c15a;
  stroke: #e8c15a;
}
.stars .broken {
  fill: #b9ab8a;
  stroke: #b9ab8a;
}
.stars .timeout {
  fill: #5a534a;
  stroke: #5a534a;
}
.btime {
  margin-left: auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.btime.hurry {
  color: #f0604a;
}
.bbar {
  margin-top: 4px;
  height: 10px;
  border-radius: 0;
  background: rgba(23, 17, 14, 0.88);
  border: 1px solid rgba(232, 193, 90, 0.45);
  overflow: hidden;
}
.bfill {
  height: 100%;
  background: #e6dcc4;
  transition: width calc(0.1s * var(--anim));
}
.tr {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.tally {
  min-width: 176px;
  padding: 2px 10px;
  border-radius: 1px;
  background: rgba(23, 17, 14, 0.85);
  border: 1px solid rgba(232, 193, 90, 0.35);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}
.trow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  line-height: 24px;
}
.trow + .trow {
  border-top: 1px solid rgba(232, 193, 90, 0.2);
}
.tlabel {
  font-family: var(--display);
  font-size: 13px;
  font-weight: 700;
  color: #d6c48c;
}
.trow b {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.trow.gold b {
  color: #e8c15a;
}
.pausebtn {
  pointer-events: auto;
}
.statuses {
  position: absolute;
  bottom: 150px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}
.status {
  padding: 3px 10px;
  border-radius: 2px;
  border: 1px solid;
  background: rgba(23, 17, 14, 0.88);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.bottom {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 14px;
  transition:
    opacity calc(0.2s * var(--anim)),
    translate calc(0.25s * var(--anim)) ease-out;
}
/* Paused, the hand steps down out of the way: nothing in it can be played, and the menu's key legend takes the foot of the screen. */
.bottom.away {
  opacity: 0;
  translate: 0 24px;
}
.cast {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 4px 6px;
  border: 1px solid rgba(232, 193, 90, 0.55);
  border-left: 4px solid var(--kc);
  background: rgba(23, 17, 14, 0.94);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45);
  color: #f6f0e1;
  font-family: var(--display);
  font-size: 0.95rem;
  font-weight: 700;
  pointer-events: none;
}
.casticon {
  width: 30px;
  height: 30px;
  padding: 4px;
  border-radius: 50%;
  background: var(--kc);
  color: #17110e;
}
.cast-enter-active {
  transition: all calc(0.25s * var(--anim)) ease-out;
}
.cast-leave-active {
  transition: all calc(0.5s * var(--anim)) ease-in;
}
.cast-enter-from {
  opacity: 0;
  transform: translate(-50%, 12px);
}
.cast-leave-to {
  opacity: 0;
  transform: translate(-50%, -24px);
}
/* Labels on lacquer: small straw caps. */
.blabel {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--head);
  margin-bottom: 5px;
  white-space: nowrap;
}
.spirit,
.pile {
  margin-bottom: 10px;
  padding: 7px 10px 8px;
  border-radius: 2px;
  background: rgba(23, 17, 14, 0.88);
  border: 1px solid rgba(232, 193, 90, 0.35);
}
.orbs {
  display: flex;
  gap: 5px;
}
/* Spirit is SWR's blue spirit orbs: a dark socket that fills from the foot. */
.orb {
  position: relative;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid #9cc8ee;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.5);
}
.orbfill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #6fb6ff;
  opacity: 0.55;
}
.orbfill.full {
  opacity: 1;
}
/* The draw pile: a small stack of card backs with the count on it, the graze meter under it. */
.pile {
  width: 104px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.deck {
  position: relative;
  width: 58px;
  height: 85px;
  margin-bottom: 6px;
}
.deck .cb {
  position: absolute;
  left: 0;
  top: 0;
  transform: scale(0.34);
  transform-origin: top left;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.6));
}
.deck .count {
  position: absolute;
  right: -8px;
  bottom: -4px;
  min-width: 22px;
  padding: 0 4px;
  border: 1px solid #1b1512;
  border-radius: 1px;
  background: #f6f0e1;
  box-shadow: 0 2px 0 #b9ab8a;
  color: #1b1512;
  font: 700 12px/18px var(--display);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.mbar {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
.mfill {
  height: 100%;
  background: #f4b7c6;
  transition: width calc(0.15s * var(--anim));
}
.piles {
  margin-top: 4px;
  font-size: 10px;
  color: #b9ab8a;
}
/* The hand: the collection's card faces at 68%, held low: the art, the emblem and the name show,
   the rules are below the screen's edge and rise into view on hover. */
.hand {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.hslot {
  position: relative;
  width: 116px;
  height: 106px;
}
.card {
  position: absolute;
  left: 0;
  top: 0;
  width: 116px;
  height: 170px;
  padding: 0;
  border: none;
  background: none;
  pointer-events: auto;
}
.card.slotted {
  cursor: pointer;
  transition:
    transform calc(0.12s * var(--anim)),
    filter calc(0.12s * var(--anim));
}
.card.slotted:hover {
  transform: translateY(-62px);
}
.cf {
  position: absolute;
  left: 0;
  top: 0;
  transform: scale(0.68);
  transform-origin: top left;
  filter: drop-shadow(0 -2px 0 rgba(0, 0, 0, 0.45));
}
/* Not enough Spirit: the card is veiled from the top, and the veil sinks as Spirit charges
   toward its cost; its lower edge is a thin spirit-blue line, the level. */
.card.slotted::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: calc((1 - var(--charge, 1)) * 106px);
  background: rgba(8, 6, 12, 0.62);
  border-bottom: 1px solid rgba(111, 182, 255, 0.8);
  border-radius: 3px 3px 0 0;
  pointer-events: none;
}
.card.slotted:not(.off)::after {
  display: none;
}
.card.off {
  filter: saturate(0.55);
}
.emptycard {
  height: 106px;
  border: 1px solid rgba(232, 193, 90, 0.2);
  border-bottom: none;
  border-radius: 3px 3px 0 0;
  background: rgba(23, 17, 14, 0.4);
}
/* The slot's key: a scrap of washi with an ink number. */
.ckey {
  position: absolute;
  top: -9px;
  left: -7px;
  z-index: 1;
  min-width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 1px;
  border: 1px solid #1b1512;
  background: #f6f0e1;
  box-shadow: 0 2px 0 #b9ab8a;
  color: #1b1512;
  font: 700 13px/18px var(--display);
}
.card-enter-active {
  transition: all calc(0.35s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1);
}
.card-leave-active {
  transition: all calc(0.25s * var(--anim)) ease-in;
}
.card-enter-from {
  transform: translateY(80px) rotate(8deg);
  opacity: 0;
}
.card-leave-to {
  transform: translateY(-120px) scale(1.3);
  opacity: 0;
}
@keyframes pulse {
  from {
    filter: brightness(1);
  }
  to {
    filter: brightness(1.6);
  }
}
</style>
