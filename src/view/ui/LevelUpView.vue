<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { host, state } from "../host.ts";
import { anim } from "../prefs.ts";
import { ui } from "../presenter.ts";
import { audio } from "../audio.ts";
import { LevelUp } from "../../sim/levelup.ts";
import { runView } from "../../sim/game.ts";
import { COIN_OFFER, HEAL_FRACTION } from "../../sim/offers.ts";
import { weaponDef, weaponLevelDelta } from "../../content/weapons.ts";
import { passiveBonus, passiveDef, passiveGains } from "../../content/passives.ts";
import { formatBonus } from "../../content/stats.ts";
import { CURRENCY } from "../../content/names.ts";
import { hex } from "./useGame.ts";
import { keyLabels } from "../keys.ts";
import Keys from "./Keys.vue";
import WeaponPreview from "./WeaponPreview.vue";
import ItemPreview from "./ItemPreview.vue";
import Hanko from "./Hanko.vue";

const offer = computed(() => {
  void state.frame;
  const path = host.path();
  if (!path || !host.k.paths().includes(`${path}/levelup`)) return null;
  return host.k.read(`${path}/levelup`, LevelUp);
});

const pending = computed(() => {
  void state.frame;
  const path = host.path();
  return path ? runView(host.k, path).derived("player").progress.pending : 0;
});

const choices = computed(() =>
  (offer.value?.choices ?? []).map((c) => {
    if (c.kind === "weapon") {
      const def = weaponDef(c.id);
      return {
        kind: "Weapon",
        name: def.name,
        color: hex(def.color),
        isNew: c.level === 1,
        lv: c.level === 1 ? null : { from: c.level - 1, to: c.level, max: c.level === def.levels.length },
        lines: weaponLevelDelta(def, c.level - 1),
        from: `from ${def.from}`,
        weapon: { id: c.id, level: c.level },
        item: undefined,
      };
    }
    if (c.kind === "passive") {
      const def = passiveDef(c.id);
      return {
        kind: "Item",
        name: def.name,
        color: hex(def.color),
        isNew: c.level === 1,
        lv: c.level === 1 ? null : { from: c.level - 1, to: c.level, max: c.level === def.max },
        lines: [...passiveGains(def, c.level), `Total after: ${formatBonus(def.stat, passiveBonus(def, c.level)[0]![1])}`],
        from: def.desc,
        weapon: undefined,
        item: { id: c.id, level: c.level, max: def.max },
      };
    }
    if (c.kind === "heal") return { kind: "Recovery", name: "Onigiri", color: "#ff7aa2", isNew: false, lv: null, lines: [`Restore ${HEAL_FRACTION * 100}% of your max HP`], from: "Everything is maxed out", weapon: undefined, item: { id: "onigiri", level: undefined, max: undefined } };
    return { kind: "Donation", name: "Offering", color: "#ffc94d", isNew: false, lv: null, lines: [`+${COIN_OFFER} ${CURRENCY.name}`], from: "Everything is maxed out", weapon: undefined, item: { id: "offering", level: undefined, max: undefined } };
  }),
);

/** Shown: the overlay is up and the pause menu isn't over it (RunView decides). */
const props = defineProps<{ open: boolean }>();

type Choice = (typeof choices.value)[number];
interface Layer {
  id: string;
  level: number;
  pending: number;
  rerolls: number;
  choices: Choice[];
  /** live: the offer being chosen; the others are short-lived copies of an offer the sim already closed. */
  mode: "live" | "pick" | "reroll" | "fade";
  picked: number;
  /** Another offer replaced this one at once (chained level-up, reroll): its title and buttons stay hidden. */
  chained: boolean;
  /** Where the picked tablet flies: from its centre to the kit slot (or bar) it went to, in px. */
  fly?: { x: number; y: number };
}

/**
 * The HUD place a choice goes to: its weapon plaque or item medallion (a new one takes the first
 * empty slot of its shape), life for the onigiri, the tally's Donations row for an offering.
 */
function kitTarget(c: Choice): HTMLElement | null {
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);
  if (c.weapon) return q(`.hud .kit [data-kit="${c.weapon.id}"]`) ?? q(".hud .kit .tile.empty:not(.round)");
  if (c.item?.id === "onigiri") return q(".hud .hp");
  if (c.item?.id === "offering") return q(".hud .trow.gold");
  if (c.item) return q(`.hud .kit [data-kit="${c.item.id}"]`) ?? q(".hud .kit .tile.round.empty");
  return null;
}
/** The vector from a live tablet to where its choice goes, measured before the tablets are replaced. */
function flight(index: number, c: Choice): { x: number; y: number } | undefined {
  const tablet = document.querySelectorAll<HTMLElement>(".lvl.live .choice")[index];
  const to = kitTarget(c);
  if (!tablet || !to) return undefined;
  const a = tablet.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  // The UI may be zoomed (App.vue): translate in its own px.
  const z = tablet.offsetWidth ? a.width / tablet.offsetWidth : 1;
  return { x: (b.left + b.width / 2 - (a.left + a.width / 2)) / z, y: (b.top + b.height / 2 - (a.top + a.height / 2)) / z };
}

// The sim resolves a pick at once and the run goes on; the exit is played by a
// copy of the old cards, so the view never holds the game paused.
const offerKey = computed(() => (offer.value ? `${offer.value.level}|${offer.value.rerolls}|${choices.value.map((c) => c.name).join(",")}` : ""));
const ghosts = ref<Layer[]>([]);
let current: Omit<Layer, "id" | "mode" | "picked" | "chained"> | null = null;
let seenPick = ui.levelPick?.id ?? 0;
let nextGhost = 0;
const timers = new Set<number>();

watch(
  offerKey,
  (key) => {
    const prev = current;
    current = key ? { level: offer.value!.level, pending: pending.value, rerolls: offer.value!.rerolls, choices: choices.value } : null;
    if (!prev || state.paused) return;
    const ev = ui.levelPick && ui.levelPick.id > seenPick ? ui.levelPick : null;
    if (ev) seenPick = ev.id;
    const mode = !ev ? "fade" : ev.index === null ? "reroll" : "pick";
    const choice = ev && ev.index !== null ? prev.choices[ev.index] : undefined;
    const fly = choice && ev && ev.index !== null ? flight(ev.index, choice) : undefined;
    const ghost: Layer = { ...prev, id: `g${nextGhost++}`, mode, picked: ev?.index ?? -1, chained: !!key, fly };
    ghosts.value = [...ghosts.value.slice(-2), ghost];
    const t = window.setTimeout(
      () => {
        timers.delete(t);
        ghosts.value = ghosts.value.filter((g) => g.id !== ghost.id);
      },
      anim(0.6) * 1000,
    );
    timers.add(t);
  },
  { immediate: true },
);
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t)));

const layers = computed<Layer[]>(() => {
  const live: Layer[] = props.open && offer.value ? [{ id: "live", level: offer.value.level, pending: pending.value, rerolls: offer.value.rerolls, choices: choices.value, mode: "live", picked: -1, chained: false }] : [];
  return [...live, ...ghosts.value];
});

/**
 * Past the offer's guard (host LEVELUP_GUARD) the live cards are a keynav scope: the arrows
 * select (the first press selects the first card; none is preselected, so a stray confirm
 * never picks) and Enter/Space/Z confirm. Before it the arrows and confirm do nothing here.
 */
const armed = computed(() => {
  void state.frame;
  return host.levelUpArmed();
});

function pick(i: number): void {
  host.pickLevelUp(i);
}
function hover(): void {
  audio.play("ui", { vol: 0.4, pitch: 1.4 });
}
</script>

<template>
  <Transition name="lvlbg">
    <div v-if="open && offer" class="lvlbg"></div>
  </Transition>
  <div v-for="L in layers" :key="L.id" v-keynav="L.mode === 'live' && armed && { autofocus: false }" class="lvl" :class="[L.mode, { chained: L.chained }]">
    <div class="head">
      <h2>Level {{ L.level }}!</h2>
      <p class="muted">
        Choose one upgrade<span v-if="L.pending > 1"> ({{ L.pending }} level-ups waiting)</span>
      </p>
    </div>
    <div class="choices">
      <button
        v-for="(c, i) in L.choices"
        :key="L.level + '-' + i + c.name"
        class="choice"
        :class="{ picked: i === L.picked, flies: i === L.picked && !!L.fly }"
        :style="{
          '--c': c.color,
          '--i': i,
          '--tx': i === L.picked && L.fly ? `${L.fly.x}px` : undefined,
          '--ty': i === L.picked && L.fly ? `${L.fly.y}px` : undefined,
          animationDelay: L.mode === 'live' ? `calc(${i * 0.07 + (ghosts.length ? 0.16 : 0)}s * var(--anim))` : undefined,
        }"
        :tabindex="L.mode === 'live' ? undefined : -1"
        @mouseenter="L.mode === 'live' && hover()"
        @click="L.mode === 'live' && pick(i)"
      >
        <span class="key num">{{ keyLabels(`Action:pick${i + 1}`, 1)[0] }}</span>
        <WeaponPreview v-if="c.weapon" :id="c.weapon.id" :level="c.weapon.level" :active="L.mode === 'live'" />
        <ItemPreview v-else-if="c.item" :id="c.item.id" :color="c.item.id === 'onigiri' ? '#fbf6ec' : c.color" :level="c.item.level" :max="c.item.max" :active="L.mode === 'live'" />
        <span class="kind">{{ c.kind }}</span>
        <span class="name">{{ c.name }}</span>
        <span v-if="c.isNew" class="tag new"><Hanko ch="新" />New</span>
        <span v-else-if="c.lv" class="tag lv"
          >Lv {{ c.lv.from }} → {{ c.lv.to }}<span v-if="c.lv.max" class="max"><Hanko ch="極" />Max</span></span
        >
        <ul>
          <li v-for="l in c.lines" :key="l">{{ l }}</li>
        </ul>
        <span class="from muted">{{ c.from }}</span>
      </button>
    </div>
    <div class="foot">
      <button v-if="L.rerolls > 0" class="btn" :tabindex="L.mode === 'live' ? undefined : -1" @click="L.mode === 'live' && host.reroll()">Reroll ({{ L.rerolls }} left) <Keys for="Action:reroll" /></button>
    </div>
  </div>
</template>

<style scoped>
.lvlbg {
  position: absolute;
  inset: 0;
  background: rgba(8, 6, 10, 0.72);
}
.lvlbg-enter-active {
  transition: opacity calc(0.25s * var(--anim)) ease;
}
.lvlbg-leave-active {
  transition: opacity calc(0.4s * var(--anim)) ease calc(0.05s * var(--anim));
}
.lvlbg-enter-from,
.lvlbg-leave-to {
  opacity: 0;
}
.lvl {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  gap: 18px;
}
.lvl.live {
  animation: fadein calc(0.25s * var(--anim)) both;
}
/* The leaving copies: never clickable, never over the live offer. */
.lvl:not(.live) {
  pointer-events: none !important;
  z-index: 1;
}
.lvl:not(.live) .choice {
  animation: drop calc(0.3s * var(--anim)) ease-in calc(var(--i) * 0.04s * var(--anim)) both;
}
.lvl:not(.live) .head,
.lvl:not(.live) .foot {
  animation: rise calc(0.3s * var(--anim)) ease-in both;
}
.lvl.chained .head,
.lvl.chained .foot {
  visibility: hidden;
}
/* The chosen tablet is pressed, then flies into Reimu's kit and shrinks to its slot (HudView bumps the slot as it lands);
   with nowhere to go it only sinks away. The others drop out quickly, and a following offer deals in after them. */
.lvl.pick .choice.picked {
  animation: taken calc(0.3s * var(--anim)) ease-in both;
  z-index: 1;
}
.lvl.pick .choice.picked.flies {
  animation: tokit calc(0.5s * var(--anim)) linear both;
}
.lvl:not(.live) .choice:not(.picked) {
  animation-duration: calc(0.22s * var(--anim));
}
.lvl.reroll .choice {
  animation: flip calc(0.25s * var(--anim)) ease-in calc(var(--i) * 0.04s * var(--anim)) both;
}
.lvl.fade .choice {
  animation: fadeout calc(0.3s * var(--anim)) ease both;
}
.head {
  text-align: center;
}
h2 {
  margin: 0;
  font-size: 2.4rem;
  color: #e8c15a;
  text-shadow: 0 2px 0 #3a2a0c;
}
.head p {
  margin: 6px 0 0;
}
.choices {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: safe center;
}
.choice {
  position: relative;
  --sel-inset: -8px;
  width: 230px;
  min-height: 250px;
  padding: 18px 16px 14px;
  /* A lacquer tablet: gold hairline, the offer's colour as a band across its head. */
  border-radius: 2px;
  border: 1px solid rgba(232, 193, 90, 0.55);
  border-top: 4px solid var(--c);
  background: #17110e;
  box-shadow:
    0 3px 0 rgba(0, 0, 0, 0.5),
    0 14px 30px rgba(0, 0, 0, 0.45);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: deal calc(0.35s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1) both;
  transition: transform calc(0.12s * var(--anim));
}
/* The chosen tablet rises: the keyboard's selection, or the one under the pointer while the keys hold none. */
.choice[data-nav-sel],
.choices:not(:has(> [data-nav-sel])) > .choice:hover {
  transform: translateY(-6px) scale(1.03);
}
.num {
  position: absolute;
  top: -12px;
  left: -10px;
  font-size: 1rem;
}
.kind {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--head);
}
.name {
  font-family: var(--display);
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.25;
}
/* The offer's news in straw caps: a 新 seal for something new, the level step, and a 極 seal
   when the step reaches the top (the same seals the results stamp on a record). */
.tag {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #d6c48c;
  font-variant-numeric: tabular-nums;
}
.tag :deep(.hanko) {
  width: 19px;
  height: 19px;
}
.tag .max {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 10px;
  color: #e8c15a;
}
ul {
  margin: 4px 0;
  padding-left: 18px;
  font-size: 0.95rem;
}
.from {
  margin-top: auto;
  font-size: 0.8rem;
}
@keyframes deal {
  from {
    opacity: 0;
    transform: translateY(40px) rotate(-4deg);
  }
}
@keyframes drop {
  to {
    opacity: 0;
    transform: translateY(46px) rotate(calc((var(--i) - 1) * 4deg)) scale(0.94);
  }
}
@keyframes rise {
  to {
    opacity: 0;
    transform: translateY(-14px);
  }
}
@keyframes taken {
  0% {
    transform: translateY(-6px) scale(1.03);
  }
  30% {
    transform: translateY(-1px) scale(0.98);
  }
  100% {
    transform: translateY(-40px) scale(0.9);
    opacity: 0;
  }
}
@keyframes tokit {
  0% {
    transform: translate(0, -6px) scale(1.03);
    animation-timing-function: ease-out;
  }
  16% {
    transform: translate(0, -1px) scale(0.97);
    border-color: #e8c15a;
    animation-timing-function: cubic-bezier(0.55, 0, 0.8, 0.4);
  }
  92% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(0.1);
    border-color: #e8c15a;
    opacity: 0;
  }
}
@keyframes flip {
  to {
    opacity: 0;
    transform: perspective(700px) rotateY(80deg) scale(0.9);
  }
}
@keyframes fadeout {
  to {
    opacity: 0;
  }
}
@keyframes fadein {
  from {
    opacity: 0;
  }
}
</style>
