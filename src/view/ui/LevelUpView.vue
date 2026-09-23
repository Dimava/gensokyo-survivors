<script setup lang="ts">
import { computed } from "vue";
import { host, state } from "../host.ts";
import { prefs, markSeen } from "../prefs.ts";
import { audio } from "../audio.ts";
import { LevelUp } from "../../sim/levelup.ts";
import { runView } from "../../sim/game.ts";
import { COIN_OFFER, HEAL_FRACTION } from "../../sim/offers.ts";
import { weaponDef, weaponLevelDelta } from "../../content/weapons.ts";
import { passiveDef } from "../../content/passives.ts";
import { formatBonus } from "../../content/stats.ts";
import { CURRENCY } from "../../content/names.ts";
import { hex } from "./useGame.ts";

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
      };
    }
    if (c.kind === "heal") return { kind: "Recovery", name: "Onigiri", color: "#ff7aa2", tag: "", lines: [`Restore ${HEAL_FRACTION * 100}% of your max HP`], from: "Everything is maxed out" };
    return { kind: "Donation", name: "Offering", color: "#ffc94d", tag: "", lines: [`+${COIN_OFFER} ${CURRENCY.name}`], from: "Everything is maxed out" };
  }),
);

function pick(i: number): void {
  markSeen("levelup");
  host.pickLevelUp(i);
}
function hover(): void {
  audio.play("ui", { vol: 0.4, pitch: 1.4 });
}
</script>

<template>
  <div class="lvl" v-if="offer">
    <div class="head">
      <h2>Level {{ offer.level }}!</h2>
      <p class="muted">
        Choose one upgrade<span v-if="pending > 1"> ({{ pending }} level-ups waiting)</span>
      </p>
      <p v-if="prefs.hints && !prefs.seen.includes('levelup')" class="hint">
        Press <span class="key">1</span> <span class="key">2</span> <span class="key">3</span> or click a card. The run is paused while you choose.
      </p>
    </div>
    <div class="choices">
      <button v-for="(c, i) in choices" :key="offer.level + '-' + i + c.name" class="choice" :style="{ '--c': c.color, animationDelay: `calc(${i * 0.07}s * var(--anim))` }" @mouseenter="hover" @click="pick(i)">
        <span class="key num">{{ i + 1 }}</span>
        <span class="icon"></span>
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
      <button v-if="offer.rerolls > 0" class="btn" @click="host.reroll()">Reroll ({{ offer.rerolls }} left) <span class="key">R</span></button>
    </div>
  </div>
</template>

<style scoped>
.lvl {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: radial-gradient(ellipse at center, rgba(10, 16, 40, 0.75), rgba(4, 6, 16, 0.9));
  animation: fadein calc(0.25s * var(--anim)) both;
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
.hint {
  color: var(--gold);
}
.choices {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
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
.icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--c);
  box-shadow: 0 0 18px var(--c);
  align-self: center;
  margin-bottom: 6px;
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
@keyframes fadein {
  from {
    opacity: 0;
  }
}
</style>
