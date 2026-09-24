<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { host, state } from "../host.ts";
import { input } from "../input.ts";
import Keys from "./Keys.vue";
import { audio } from "../audio.ts";
import { CURRENCY } from "../../content/names.ts";
import { SLOTS } from "../../sim/tuning.ts";
import { fmtTime, hex } from "./useGame.ts";
import { hud } from "./useRun.ts";
import { ui } from "../presenter.ts";
import { CARD_KINDS, cardDef } from "../../content/cards.ts";
import { cardIcon } from "./cardIcons.ts";
import SpellBar from "./SpellBar.vue";
import { itemIcon } from "./itemIcons.ts";

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
/** The hand card's look: its kind's colour and badge, its glyph, and how charged its cost is. */
function face(id: string, cost: number) {
  const def = cardDef(id);
  return {
    def,
    icon: cardIcon(id),
    style: {
      "--kc": CARD_KINDS[def.kind].css,
      "--charge": Math.max(0, Math.min(1, h.value.spirit / cost)),
    },
  };
}

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
    <!-- Experience -->
    <div
      class="xp"
      title="Experience: collect point items to fill it; a full bar is a level-up."
    >
      <div class="xpfill" :style="{ width: xpPct + '%' }"></div>
      <span class="xplabel"
        ><b>Lv {{ h.level }}</b> · EXP {{ Math.floor(h.xp) }} /
        {{ h.next }}</span
      >
    </div>

    <!-- Left: health, weapons, passives -->
    <div class="tl">
      <div class="hp" title="Health. At 0 the run ends.">
        <div
          class="hpfill"
          :style="{ width: hpPct + '%' }"
          :class="{ low: hpPct < 30 }"
        ></div>
        <span class="hplabel">HP {{ Math.ceil(h.hp) }} / {{ h.maxHp }}</span>
      </div>
      <div class="slots" title="Weapons: they fire on their own.">
        <span class="slotlabel">Weapons</span>
        <div
          v-for="w in h.weapons"
          :key="w.id"
          class="slot"
          :title="`${w.name} (level ${w.level} of ${w.max}): ${w.desc}`"
        >
          <svg class="ico" viewBox="0 0 24 24" fill="currentColor" :style="{ color: hex(w.color) }" v-html="itemIcon(w.id)"></svg
          ><b>{{ w.level === w.max ? "MAX" : w.level }}</b>
        </div>
        <div
          v-for="n in emptyWeapons"
          :key="'ew' + n"
          class="slot empty"
          title="Empty weapon slot: level-ups can offer a new weapon"
        ></div>
      </div>
      <div class="slots" title="Passive items: they raise your stats.">
        <span class="slotlabel">Items</span>
        <div
          v-for="p in h.passives"
          :key="p.id"
          class="slot"
          :title="`${p.name} (level ${p.level} of ${p.max}): ${p.desc}`"
        >
          <svg class="ico" viewBox="0 0 24 24" fill="currentColor" :style="{ color: hex(p.color) }" v-html="itemIcon(p.id)"></svg
          ><b>{{ p.level === p.max ? "MAX" : p.level }}</b>
        </div>
        <div
          v-for="n in emptyPassives"
          :key="'ep' + n"
          class="slot empty"
          title="Empty item slot: level-ups can offer a new item"
        ></div>
      </div>
      <div
        v-if="h.revivesLeft"
        class="revive"
        title="Hakurei Blessing: you get back up at half HP."
      >
        Revivals left: {{ h.revivesLeft }}
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
        <span
          class="pips"
          title="Spell cards: captured (gold), broken (blue), broken after the timer (grey), current (outlined)"
        >
          <i
            v-for="i in h.boss.total"
            :key="i"
            :class="
              h.boss.results[i - 1] ?? (i - 1 === h.boss.index ? 'now' : 'todo')
            "
          ></i>
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
      <div class="stat" title="Enemies defeated this run">
        <span class="muted">Kills</span> <b>{{ h.kills }}</b>
      </div>
      <div
        class="stat gold"
        :title="`${CURRENCY.name} collected this run (paid out at the end, with bonuses)`"
      >
        <span class="muted">{{ CURRENCY.name }}</span>
        <b>{{ CURRENCY.icon }} {{ h.coins }}</b>
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

    <!-- Bottom: spirit, hand, graze meter -->
    <div class="bottom">
      <Transition name="cast">
        <div
          v-if="cast"
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
        <div class="blabel">
          Spirit {{ h.spirit.toFixed(1) }} / {{ h.spiritMax }}
        </div>
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
             The empty frame always holds the slot; the card animates in and out on top of it. -->
        <div v-for="(c, i) in h.slots" :key="i" class="hslot">
          <div
            class="card emptycard"
            title="Empty hand slot: graze bullets to draw a card"
          >
            <span class="ckey key">{{ i + 1 }}</span>
            <span class="muted">Graze<br />to draw</span>
          </div>
          <Transition name="card">
            <button
              v-if="c"
              class="card slotted"
              :key="c.entity"
              :class="[
                'kind-' + face(c.id, c.cost).def.kind,
                { off: !c.affordable },
              ]"
              :style="face(c.id, c.cost).style"
              :title="`${c.name} (${CARD_KINDS[face(c.id, c.cost).def.kind].label}, ${c.rarity}, level ${c.level}) costs ${c.cost} Spirit: ${c.text}`"
              @click="play(c.slot)"
            >
              <span class="cbadge">
                <svg
                  class="cicon"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  v-html="face(c.id, c.cost).icon"
                ></svg>
              </span>
              <span class="ckey key">{{ c.slot + 1 }}</span>
              <span class="ccost" title="Spirit cost">
                <i
                  v-for="n in c.cost"
                  :key="n"
                  :class="{ lit: h.spirit >= n }"
                ></i>
              </span>
              <span class="cname">{{ face(c.id, c.cost).def.short }}</span>
            </button>
          </Transition>
        </div>
      </div>
      <div
        class="meter"
        :title="`Graze meter: pass close to enemy bullets to fill it; when full you draw a card. Grazes this run: ${h.grazes}`"
      >
        <div class="blabel">
          {{
            h.hand.length >= h.handMax && h.meter >= 1
              ? "Hand full"
              : "Graze → next card"
          }}
        </div>
        <div class="mbar">
          <div class="mfill" :style="{ width: h.meter * 100 + '%' }"></div>
        </div>
        <div class="piles muted">
          Deck {{ h.deck }} · Discard {{ h.discard }}
        </div>
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
.xp {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 18px;
  background: rgba(10, 14, 30, 0.85);
  border-bottom: 1px solid rgba(77, 163, 255, 0.4);
}
.xpfill {
  height: 100%;
  background: linear-gradient(90deg, #2e6fe0, #6fd3ff);
  transition: width calc(0.2s * var(--anim));
}
.xplabel {
  position: absolute;
  inset: 0;
  text-align: center;
  font-size: 12px;
  line-height: 18px;
  text-shadow: 0 1px 2px #000;
}
.tl {
  position: absolute;
  top: 26px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hp {
  position: relative;
  width: 260px;
  height: 22px;
  border-radius: 6px;
  background: rgba(10, 14, 30, 0.85);
  border: 1px solid rgba(255, 92, 122, 0.5);
  overflow: hidden;
}
.hpfill {
  height: 100%;
  background: linear-gradient(90deg, #b8213a, #ff5c7a);
  transition: width calc(0.15s * var(--anim));
}
.hpfill.low {
  animation: pulse calc(0.6s * var(--anim)) infinite alternate;
}
.hplabel {
  position: absolute;
  inset: 0;
  text-align: center;
  line-height: 20px;
  font-weight: 700;
  text-shadow: 0 1px 2px #000;
}
.slots {
  display: flex;
  gap: 4px;
  align-items: center;
}
.slotlabel {
  width: 58px;
  font-size: 11px;
  color: var(--muted);
}
.slot {
  width: 43px;
  height: 26px;
  border-radius: 6px;
  background: rgba(10, 14, 30, 0.8);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: safe center;
  gap: 3px;
  font-size: 11px;
}
.slot .ico {
  width: 15px;
  height: 15px;
  flex: none;
  --hole: #0a0e1e;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.6));
}
.slot.empty {
  opacity: 0.35;
}
.revive {
  font-size: 12px;
  color: var(--gold);
}
.tc {
  position: absolute;
  top: 24px;
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
  font-size: 12px;
  color: var(--muted);
}
.boss {
  position: absolute;
  top: 24px;
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
  font-weight: 800;
  color: var(--cyan);
  text-shadow: 0 1px 3px #000;
}
.pips {
  display: flex;
  gap: 4px;
}
.pips i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  display: inline-block;
}
.pips i.captured {
  background: var(--gold);
  border-color: var(--gold);
}
.pips i.broken {
  background: var(--blue);
  border-color: var(--blue);
}
.pips i.timeout {
  background: #555;
  border-color: #777;
}
.pips i.now {
  box-shadow: 0 0 8px #fff;
}
.pips i.todo {
  opacity: 0.6;
}
.btime {
  margin-left: auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.btime.hurry {
  color: var(--red-2);
}
.bbar {
  margin-top: 4px;
  height: 10px;
  border-radius: 5px;
  background: rgba(10, 14, 30, 0.85);
  border: 1px solid rgba(255, 92, 122, 0.5);
  overflow: hidden;
}
.bfill {
  height: 100%;
  background: linear-gradient(90deg, #ff5c8a, #ffb3c8);
  transition: width calc(0.1s * var(--anim));
}
.tr {
  position: absolute;
  top: 26px;
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.stat {
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(10, 14, 30, 0.8);
  border: 1px solid var(--line);
}
.stat.gold b {
  color: var(--gold);
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
  border-radius: 999px;
  border: 1px solid;
  background: rgba(10, 14, 30, 0.85);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.bottom {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  gap: 14px;
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
  border-radius: 999px;
  border: 2px solid var(--kc);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--kc) 45%, rgba(10, 14, 30, 0.9)),
    rgba(10, 14, 30, 0.9) 60%
  );
  box-shadow: 0 0 18px color-mix(in srgb, var(--kc) 60%, transparent);
  color: #fff;
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
  color: #0b0f22;
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
.blabel {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
  white-space: nowrap;
}
.spirit,
.meter {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(10, 14, 30, 0.85);
  border: 1px solid var(--line);
}
.orbs {
  display: flex;
  gap: 5px;
}
.orb {
  position: relative;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #9ad7ff;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
}
.orbfill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #6fd3ff;
  opacity: 0.6;
}
.orbfill.full {
  opacity: 1;
  box-shadow: 0 0 10px #6fd3ff;
}
.meter {
  width: 150px;
}
.mbar {
  height: 10px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.mfill {
  height: 100%;
  background: linear-gradient(90deg, #c56bff, #ffb3f0);
  transition: width calc(0.15s * var(--anim));
}
.piles {
  margin-top: 4px;
  font-size: 11px;
}
.hand {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.hslot {
  position: relative;
}
.card.slotted {
  position: absolute;
  inset: 0;
}
.card {
  --kc: #888;
  position: relative;
  width: 118px;
  height: 128px;
  padding: 0 6px 7px;
  border-radius: 12px;
  border: 2px solid var(--kc);
  background:
    radial-gradient(
      circle at 50% 42%,
      color-mix(in srgb, var(--kc) 38%, transparent),
      transparent 68%
    ),
    linear-gradient(180deg, rgba(34, 38, 70, 0.97), rgba(12, 15, 32, 0.97));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  overflow: visible;
  box-shadow: 0 0 16px color-mix(in srgb, var(--kc) 55%, transparent);
  transition:
    transform calc(0.12s * var(--anim)),
    opacity calc(0.12s * var(--anim)),
    filter calc(0.12s * var(--anim));
  pointer-events: auto;
}
.card:hover {
  transform: translateY(-8px);
}
/* The badge: the kind's colour in the kind's shape, holding the card's glyph.
   It fills from the bottom as Spirit charges towards the card's cost. */
.cbadge {
  position: absolute;
  top: 10px;
  left: 50%;
  width: 80px;
  height: 80px;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  color: #0b0f22;
  background: linear-gradient(
    0deg,
    var(--kc) calc(var(--charge, 1) * 100%),
    #3b4058 calc(var(--charge, 1) * 100%)
  );
  clip-path: circle(50%);
}
.cicon {
  width: 52px;
  height: 52px;
}
.kind-attack .cbadge {
  clip-path: polygon(
    50% 0%, 60.4% 11.4%, 75% 6.7%, 78.3% 21.7%, 93.3% 25%, 88.6% 39.6%,
    100% 50%, 88.6% 60.4%, 93.3% 75%, 78.3% 78.3%, 75% 93.3%, 60.4% 88.6%,
    50% 100%, 39.6% 88.6%, 25% 93.3%, 21.7% 78.3%, 6.7% 75%, 11.4% 60.4%,
    0% 50%, 11.4% 39.6%, 6.7% 25%, 21.7% 21.7%, 25% 6.7%, 39.6% 11.4%
  );
}
.kind-attack .cicon {
  width: 46px;
  height: 46px;
}
.kind-guard .cbadge {
  clip-path: polygon(50% 0%, 100% 14%, 100% 56%, 50% 100%, 0% 56%, 0% 14%);
}
.kind-guard .cicon {
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
}
.kind-buff .cbadge {
  clip-path: polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%);
}
.kind-buff .cicon {
  width: 46px;
  height: 46px;
  margin-top: 12px;
}
.kind-utility .cbadge {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}
.kind-utility .cicon {
  width: 44px;
  height: 44px;
}
/* Castable: a light sweep runs across the badge now and then. */
.card.slotted:not(.off) .cbadge::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 35%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 65%
  );
  background-size: 300% 100%;
  animation: ready calc(2.4s * var(--anim)) linear infinite;
  pointer-events: none;
}
@keyframes ready {
  0% {
    background-position: 100% 0;
  }
  40%,
  100% {
    background-position: 0% 0;
  }
}
/* Not enough Spirit: the card greys out except the charged part of its badge. */
.card.off {
  border-color: color-mix(in srgb, var(--kc) 35%, #555);
  box-shadow: none;
  background: linear-gradient(180deg, rgba(30, 32, 48, 0.95), rgba(12, 14, 26, 0.95));
}
.card.off .cbadge {
  --hole: #262a3c;
  color: #c3c8dc;
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--kc) 45%, #262a3c) calc(var(--charge) * 100%),
    #262a3c calc(var(--charge) * 100%)
  );
}
.card.off .cname {
  color: #8a90a8;
}
.emptycard {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: none;
  align-items: center;
  justify-content: safe center;
  text-align: center;
  font-size: 11px;
  background: rgba(10, 14, 30, 0.5);
}
.ckey {
  position: absolute;
  top: -10px;
  left: -9px;
  min-width: 26px;
  height: 26px;
  font-size: 15px;
  font-weight: 900;
  line-height: 22px;
  border: 2px solid var(--kc);
  background: #111;
  color: #fff;
}
.ccost {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ccost i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #6fd3ff;
  background: rgba(0, 0, 0, 0.6);
}
.ccost i.lit {
  background: #6fd3ff;
  box-shadow: 0 0 5px #6fd3ff;
}
.off .ccost i:not(.lit) {
  border-color: #ff6b6b;
}
.cname {
  position: relative;
  max-width: 100%;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
  text-shadow: 0 1px 2px #000;
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
