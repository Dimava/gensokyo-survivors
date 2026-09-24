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
import { passiveDef } from "../../content/passives.ts";
import { formatBonus } from "../../content/stats.ts";
import { CURRENCY } from "../../content/names.ts";
import { hex } from "./useGame.ts";
import { keyLabels } from "../keys.ts";
import Keys from "./Keys.vue";
import WeaponPreview from "./WeaponPreview.vue";
import ItemPreview from "./ItemPreview.vue";

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
        tag: c.level === 1 ? "NEW" : `Lv ${c.level - 1} → ${c.level}${c.level === def.levels.length ? " (MAX)" : ""}`,
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
        tag: c.level === 1 ? "NEW" : `Lv ${c.level - 1} → ${c.level}${c.level === def.max ? " (MAX)" : ""}`,
        lines: [formatBonus(def.stat, def.per), `Total after: ${formatBonus(def.stat, def.per * c.level)}`],
        from: def.desc,
        weapon: undefined,
        item: { id: c.id, level: c.level, max: def.max },
      };
    }
    if (c.kind === "heal") return { kind: "Recovery", name: "Onigiri", color: "#ff7aa2", tag: "", lines: [`Restore ${HEAL_FRACTION * 100}% of your max HP`], from: "Everything is maxed out", weapon: undefined, item: { id: "onigiri", level: undefined, max: undefined } };
    return { kind: "Donation", name: "Offering", color: "#ffc94d", tag: "", lines: [`+${COIN_OFFER} ${CURRENCY.name}`], from: "Everything is maxed out", weapon: undefined, item: { id: "offering", level: undefined, max: undefined } };
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
    const ghost: Layer = { ...prev, id: `g${nextGhost++}`, mode, picked: ev?.index ?? -1, chained: !!key };
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
        :class="{ picked: i === L.picked }"
        :style="{ '--c': c.color, '--i': i, animationDelay: L.mode === 'live' ? `calc(${i * 0.07}s * var(--anim))` : undefined }"
        :tabindex="L.mode === 'live' ? undefined : -1"
        @mouseenter="L.mode === 'live' && hover()"
        @click="L.mode === 'live' && pick(i)"
      >
        <span class="key num">{{ keyLabels(`Action:pick${i + 1}`, 1)[0] }}</span>
        <WeaponPreview v-if="c.weapon" :id="c.weapon.id" :level="c.weapon.level" :active="L.mode === 'live'" />
        <ItemPreview v-else-if="c.item" :id="c.item.id" :color="c.item.id === 'onigiri' ? '#fbf6ec' : c.color" :level="c.item.level" :max="c.item.max" :active="L.mode === 'live'" />
        <span class="kind">{{ c.kind }}</span>
        <span class="name">{{ c.name }}</span>
        <span v-if="c.tag" class="tag" :class="{ new: c.tag === 'NEW' }">{{ c.tag }}</span>
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
  background: radial-gradient(ellipse at center, rgba(10, 16, 40, 0.75), rgba(4, 6, 16, 0.9));
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
.lvl.pick .choice.picked {
  animation: taken calc(0.45s * var(--anim)) cubic-bezier(0.3, 0, 0.5, 1) both;
  z-index: 1;
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
  color: #b6ffc8;
  text-shadow: 0 0 20px rgba(123, 216, 143, 0.7);
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
  width: 230px;
  min-height: 250px;
  padding: 18px 16px 14px;
  border-radius: 14px;
  border: 2px solid var(--c);
  background: linear-gradient(180deg, rgba(38, 46, 90, 0.98), rgba(16, 20, 42, 0.98));
  box-shadow: 0 0 24px color-mix(in srgb, var(--c) 35%, transparent);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: deal calc(0.35s * var(--anim)) cubic-bezier(0.2, 1.3, 0.4, 1) both;
  transition: transform calc(0.12s * var(--anim));
}
.choice:hover {
  transform: translateY(-6px) scale(1.03);
}
.num {
  position: absolute;
  top: -12px;
  left: -10px;
  background: #111;
  font-size: 1rem;
}
.kind {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}
.name {
  font-size: 1.2rem;
  font-weight: 800;
}
.tag {
  align-self: flex-start;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}
.tag.new {
  background: var(--gold);
  color: #2a1a00;
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
  35% {
    transform: translateY(-10px) scale(1.12);
    border-color: #fff;
    filter: brightness(1.5);
    box-shadow:
      0 0 36px 6px var(--c),
      0 0 90px 10px color-mix(in srgb, var(--c) 60%, transparent);
    opacity: 1;
  }
  100% {
    transform: translateY(-34px) scale(1.3);
    filter: brightness(2.2) blur(3px);
    box-shadow:
      0 0 60px 16px var(--c),
      0 0 140px 30px color-mix(in srgb, var(--c) 40%, transparent);
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
