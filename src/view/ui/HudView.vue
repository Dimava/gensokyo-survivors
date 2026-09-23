<script setup lang="ts">
import { computed } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { CHARACTERS, CURRENCY } from "../../content/names.ts";
import { SLOTS } from "../../sim/tuning.ts";
import { fmtTime, hex } from "./useGame.ts";
import { hud } from "./useRun.ts";

const h = computed(() => hud.value!);
const hpPct = computed(() => Math.max(0, Math.min(100, (h.value.hp / h.value.maxHp) * 100)));
const xpPct = computed(() => Math.max(0, Math.min(100, (h.value.xp / h.value.next) * 100)));
const spiritOrbs = computed(() => {
  const out: number[] = [];
  for (let i = 0; i < h.value.spiritMax; i++) out.push(Math.max(0, Math.min(1, h.value.spirit - i)));
  return out;
});
const emptyWeapons = computed(() => Math.max(0, SLOTS.weapons - h.value.weapons.length));
const emptyPassives = computed(() => Math.max(0, SLOTS.passives - h.value.passives.length));
const emptyHand = computed(() => Math.max(0, h.value.handMax - h.value.hand.length));

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
    <div class="xp" title="Experience: collect point items to fill it; a full bar is a level-up.">
      <div class="xpfill" :style="{ width: xpPct + '%' }"></div>
      <span class="xplabel"><b>Lv {{ h.level }}</b> · EXP {{ Math.floor(h.xp) }} / {{ h.next }}</span>
    </div>

    <!-- Left: health, weapons, passives -->
    <div class="tl">
      <div class="hp" title="Health. At 0 the run ends.">
        <div class="hpfill" :style="{ width: hpPct + '%' }" :class="{ low: hpPct < 30 }"></div>
        <span class="hplabel">HP {{ Math.ceil(h.hp) }} / {{ h.maxHp }}</span>
      </div>
      <div class="slots" title="Weapons: they fire on their own.">
        <span class="slotlabel">Weapons</span>
        <div v-for="w in h.weapons" :key="w.id" class="slot" :title="`${w.name} (level ${w.level} of ${w.max}): ${w.desc}`">
          <i :style="{ background: hex(w.color) }"></i><b>{{ w.level === w.max ? "MAX" : w.level }}</b>
        </div>
        <div v-for="n in emptyWeapons" :key="'ew' + n" class="slot empty" title="Empty weapon slot: level-ups can offer a new weapon"></div>
      </div>
      <div class="slots" title="Passive items: they raise your stats.">
        <span class="slotlabel">Items</span>
        <div v-for="p in h.passives" :key="p.id" class="slot" :title="`${p.name} (level ${p.level} of ${p.max}): ${p.desc}`">
          <i class="sq" :style="{ background: hex(p.color) }"></i><b>{{ p.level === p.max ? "MAX" : p.level }}</b>
        </div>
        <div v-for="n in emptyPassives" :key="'ep' + n" class="slot empty" title="Empty item slot: level-ups can offer a new item"></div>
      </div>
      <div v-if="h.revivesLeft" class="revive" title="Hakurei Blessing: you get back up at half HP.">Revivals left: {{ h.revivesLeft }}</div>
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
        <span class="pips" title="Spell cards: captured (gold), broken (blue), timed out (grey), current (outlined)">
          <i v-for="i in h.boss.total" :key="i" :class="h.boss.results[i - 1] ?? (i - 1 === h.boss.index ? 'now' : 'todo')"></i>
        </span>
        <span class="btime" :class="{ hurry: h.boss.timeLeft < 10 }" title="Time left on this spell card">{{ h.boss.timeLeft.toFixed(1) }}s</span>
      </div>
      <div class="bbar" :title="`Spell card HP: ${h.boss.hp}`">
        <div class="bfill" :style="{ width: h.boss.frac * 100 + '%' }"></div>
      </div>
      <div class="spell">{{ h.boss.intro ? "Declaring: " : "" }}{{ h.boss.spell }}</div>
    </div>

    <!-- Right: kills, donations, pause -->
    <div class="tr">
      <div class="stat" title="Enemies defeated this run"><span class="muted">Kills</span> <b>{{ h.kills }}</b></div>
      <div class="stat gold" :title="`${CURRENCY.name} collected this run (paid out at the end, with bonuses)`">
        <span class="muted">{{ CURRENCY.name }}</span> <b>{{ CURRENCY.icon }} {{ h.coins }}</b>
      </div>
      <button class="btn small ghost pausebtn" @click="pause">Pause <span class="key">Esc</span></button>
    </div>

    <!-- Statuses -->
    <div class="statuses">
      <TransitionGroup name="pop">
        <div v-for="s in h.statuses" :key="s.id" class="status" :style="{ borderColor: s.color, color: s.color }" :title="s.help">
          {{ s.label }}<span v-if="s.left !== null"> {{ s.left.toFixed(1) }}s</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- Bottom: spirit, hand, graze meter -->
    <div class="bottom">
      <div class="spirit" :title="`Spirit: cards cost Spirit. It refills by ${h.spiritRate.toFixed(2)} per second.`">
        <div class="blabel">Spirit {{ h.spirit.toFixed(1) }} / {{ h.spiritMax }}</div>
        <div class="orbs">
          <div v-for="(f, i) in spiritOrbs" :key="i" class="orb">
            <div class="orbfill" :style="{ height: f * 100 + '%' }" :class="{ full: f >= 1 }"></div>
          </div>
        </div>
      </div>
      <div class="hand">
        <TransitionGroup name="card">
          <button
            v-for="c in h.hand"
            :key="c.entity"
            class="card"
            :class="['rarity-' + c.rarity, { off: !c.affordable }]"
            :title="`${c.name} (${c.rarity}, level ${c.level}) costs ${c.cost} Spirit: ${c.text}`"
            @click="play(c.slot)"
          >
            <span class="ckey key">{{ c.slot + 1 }}</span>
            <span class="ccost" title="Spirit cost">
              <i v-for="n in c.cost" :key="n" :class="{ lit: h.spirit >= n }"></i>
            </span>
            <span class="cart" :style="{ background: hex(CHARACTERS[c.owner].color) }"></span>
            <span class="cname">{{ c.name }}</span>
            <span class="ctext">{{ c.text }}</span>
          </button>
        </TransitionGroup>
        <div v-for="n in emptyHand" :key="'eh' + n" class="card emptycard" title="Empty hand slot: graze bullets to draw a card">
          <span class="muted">Graze to draw</span>
        </div>
      </div>
      <div class="meter" :title="`Graze meter: pass close to enemy bullets to fill it; when full you draw a card. Grazes this run: ${h.grazes}`">
        <div class="blabel">{{ h.hand.length >= h.handMax && h.meter >= 1 ? "Hand full" : "Graze → next card" }}</div>
        <div class="mbar"><div class="mfill" :style="{ width: h.meter * 100 + '%' }"></div></div>
        <div class="piles muted">Deck {{ h.deck }} · Discard {{ h.discard }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  width: 38px;
  height: 26px;
  border-radius: 6px;
  background: rgba(10, 14, 30, 0.8);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11px;
}
.slot i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.slot i.sq {
  border-radius: 2px;
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
.spell {
  margin-top: 4px;
  text-align: right;
  font-size: 13px;
  font-style: italic;
  color: #ffd6e0;
  text-shadow: 0 1px 3px #000;
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
.card {
  position: relative;
  width: 118px;
  height: 128px;
  padding: 8px 8px 6px;
  border-radius: 10px;
  border: 2px solid var(--rc, #888);
  background: linear-gradient(180deg, rgba(40, 46, 86, 0.97), rgba(18, 22, 44, 0.97));
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 0 14px color-mix(in srgb, var(--rc, #888) 40%, transparent);
  transition:
    transform calc(0.12s * var(--anim)),
    opacity calc(0.12s * var(--anim));
  pointer-events: auto;
}
.card:hover {
  transform: translateY(-8px);
}
.card.off {
  opacity: 0.55;
  filter: saturate(0.5);
}
.emptycard {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: none;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  background: rgba(10, 14, 30, 0.5);
}
.ckey {
  position: absolute;
  top: -10px;
  left: -8px;
  background: #111;
}
.ccost {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 2px;
}
.ccost i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #6fd3ff;
}
.ccost i.lit {
  background: #6fd3ff;
}
.cart {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.cname {
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.15;
}
.ctext {
  font-size: 10px;
  color: #c7cde6;
  line-height: 1.2;
}
.card-enter-active {
  transition: all calc(0.35s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1);
}
.card-leave-active {
  transition: all calc(0.25s * var(--anim)) ease-in;
  position: absolute;
}
.card-enter-from {
  transform: translateY(80px) rotate(8deg);
  opacity: 0;
}
.card-leave-to {
  transform: translateY(-120px) scale(1.3);
  opacity: 0;
}
.card-move {
  transition: transform calc(0.2s * var(--anim));
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
