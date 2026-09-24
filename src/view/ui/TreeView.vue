<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { TREE, treeNode, type TreeNode } from "../../content/tree.ts";
import { formatBonus, STAT_DEFS } from "../../content/stats.ts";
import { weaponDef } from "../../content/weapons.ts";
import { CURRENCY } from "../../content/names.ts";
import { nodeState, type NodeState } from "../../sim/meta.ts";
import { treeLevels, wallet } from "./useGame.ts";
import Keys from "./Keys.vue";
import NavHints from "./NavHints.vue";

const UNIT = 104;
const selected = ref<string>("core");
const bought = ref<{ id: string; n: number } | null>(null);

const bounds = computed(() => {
  const xs = TREE.map((n) => n.x);
  const ys = TREE.map((n) => n.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
});
const size = computed(() => ({
  w: (bounds.value.maxX - bounds.value.minX + 1) * UNIT,
  h: (bounds.value.maxY - bounds.value.minY + 1) * UNIT,
}));
// Fit the whole board on screen (it scrolls only on very small windows).
const vh = ref(window.innerHeight);
const onResize = (): void => {
  vh.value = window.innerHeight;
};
onMounted(() => window.addEventListener("resize", onResize));
onBeforeUnmount(() => window.removeEventListener("resize", onResize));
const fit = computed(() => Math.max(0.6, Math.min(1, (vh.value - 130) / size.value.h)));
const px = (n: TreeNode): { x: number; y: number } => ({
  x: (n.x - bounds.value.minX + 0.5) * UNIT,
  y: (n.y - bounds.value.minY + 0.5) * UNIT,
});

const states = computed(() => {
  void state.meta;
  const v = host.k.view();
  const out: Record<string, NodeState> = {};
  for (const n of TREE) out[n.id] = nodeState(v, n.id);
  return out;
});
const level = (id: string): number => treeLevels.value[id] ?? 0;

const edges = computed(() => {
  const out: { a: { x: number; y: number }; b: { x: number; y: number }; lit: boolean; id: string }[] = [];
  for (const n of TREE) {
    for (const r of n.requires) {
      out.push({ a: px(treeNode(r)), b: px(n), lit: level(r) > 0, id: `${r}-${n.id}` });
    }
  }
  return out;
});

function effectAt(n: TreeNode, lvl: number): string {
  if (n.effect.kind === "unlock") return lvl > 0 ? `${weaponDef(n.effect.weapon).name} can appear in level-ups` : "Not yet unlocked";
  if (lvl === 0) return "Nothing yet";
  return formatBonus(n.effect.stat, n.effect.per * lvl);
}

const sel = computed(() => {
  const n = treeNode(selected.value);
  const lvl = level(n.id);
  const st = states.value[n.id]!;
  const cost = n.costs[lvl];
  return {
    n,
    lvl,
    max: n.costs.length,
    st,
    cost,
    now: effectAt(n, lvl),
    next: lvl < n.costs.length ? (n.effect.kind === "unlock" ? `Adds ${weaponDef(n.effect.weapon).name} (${weaponDef(n.effect.weapon).desc}) to the level-up pool` : effectAt(n, lvl + 1)) : null,
    help: n.effect.kind === "stat" ? STAT_DEFS[n.effect.stat].help : weaponDef(n.effect.weapon).desc,
    requires: n.requires.map((r) => treeNode(r).name),
  };
});

function pick(id: string): void {
  selected.value = id;
  audio.play("ui", { vol: 0.5, pitch: 1.2 });
}

function buy(): void {
  const id = selected.value;
  const res = host.meta("tree:buy", { node: id });
  if (res.ok) bought.value = { id, n: Date.now() };
}
</script>

<template>
  <div v-keynav="{ id: 'tree' }" class="screen tree">
    <div class="screen-head">
      <div>
        <h1>Shrine Upgrades</h1>
        <div class="sub">Permanent upgrades for every future run. Buy a node next to one you own; most have several levels.</div>
      </div>
      <div class="headr">
        <div class="coins"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
        <button class="btn" @click="host.go('menu')">Back <Keys for="Back" /></button>
      </div>
    </div>
    <div class="body">
      <div class="boardwrap panel">
        <div class="board" :style="{ width: size.w + 'px', height: size.h + 'px', zoom: fit }">
          <svg :width="size.w" :height="size.h" class="edges">
            <line v-for="e in edges" :key="e.id" :x1="e.a.x" :y1="e.a.y" :x2="e.b.x" :y2="e.b.y" :class="{ lit: e.lit }" />
          </svg>
          <button
            v-for="n in TREE"
            :key="n.id"
            class="node"
            :class="[states[n.id], { sel: selected === n.id, owned: level(n.id) > 0, justbought: bought?.id === n.id, unlock: n.effect.kind === 'unlock' }]"
            :style="{ left: px(n).x + 'px', top: px(n).y + 'px' }"
            :title="n.name"
            :data-autofocus="selected === n.id || undefined"
            @click="selected !== n.id && pick(n.id)"
            @focus="selected !== n.id && pick(n.id)"
            @navactivate.prevent="buy()"
          >
            <span class="nname">{{ n.name }}</span>
            <span class="pips">
              <i v-for="i in n.costs.length" :key="i" :class="{ on: i <= level(n.id) }"></i>
            </span>
            <span v-if="bought?.id === n.id" :key="bought.n" class="burst"></span>
          </button>
        </div>
      </div>
      <div class="detail panel">
        <h2>{{ sel.n.name }}</h2>
        <p class="muted flavour">“{{ sel.n.flavour }}”</p>
        <div class="row"><span class="muted">Level</span><b>{{ sel.lvl }} / {{ sel.max }}</b></div>
        <div class="row"><span class="muted">Now</span><b>{{ sel.now }}</b></div>
        <div v-if="sel.next" class="row next"><span class="muted">Next level</span><b>{{ sel.next }}</b></div>
        <p class="help muted">{{ sel.help }}</p>
        <p v-if="sel.st === 'locked'" class="req">Needs {{ sel.requires.join(" or ") }} first.</p>
        <button v-if="sel.st !== 'maxed'" class="btn buy" :class="{ gold: sel.st === 'buyable' }" :disabled="sel.st !== 'buyable'" @click="buy">
          {{ sel.st === "locked" ? "Locked" : `Buy for ${CURRENCY.icon} ${sel.cost}` }}
        </button>
        <p v-if="sel.st === 'poor'" class="req">You need {{ CURRENCY.icon }} {{ (sel.cost ?? 0) - wallet.coins }} more.</p>
        <p v-if="sel.st === 'maxed'" class="maxed">Fully upgraded</p>
      </div>
    </div>
    <NavHints confirm="buy" />
  </div>
</template>

<style scoped>
.headr {
  display: flex;
  gap: 12px;
  align-items: center;
}
.body {
  display: flex;
  gap: 16px;
  width: min(1100px, 94vw);
  flex-wrap: wrap;
  padding-bottom: 20px;
}
.boardwrap {
  flex: 1 1 560px;
  overflow: auto;
  padding: 10px;
  display: flex;
  justify-content: safe center;
}
.board {
  position: relative;
  flex: none;
}
.edges {
  position: absolute;
  inset: 0;
}
.edges line {
  stroke: rgba(255, 255, 255, 0.12);
  stroke-width: 3;
}
.edges line.lit {
  stroke: rgba(255, 201, 77, 0.6);
}
.node {
  position: absolute;
  width: 86px;
  height: 86px;
  margin: -43px 0 0 -43px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: radial-gradient(circle at 50% 35%, #2b355f, #151a33);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  gap: 4px;
  padding: 6px;
  transition:
    transform calc(0.12s * var(--anim)),
    box-shadow calc(0.2s * var(--anim)),
    filter var(--glide),
    border-color var(--glide);
}
.node:hover {
  transform: scale(1.08);
}
.node.unlock {
  border-radius: 16px;
}
.nname {
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
}
.pips {
  display: flex;
  gap: 2px;
}
.pips i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid var(--gold);
}
.pips i.on {
  background: var(--gold);
}
.node.locked {
  opacity: 0.35;
}
.node.poor {
  border-color: rgba(255, 255, 255, 0.35);
}
.node.buyable {
  border-color: var(--gold);
  box-shadow: 0 0 16px rgba(255, 201, 77, 0.55);
  animation: glow calc(1.4s * var(--anim)) ease-in-out infinite alternate;
}
.node.owned {
  background: radial-gradient(circle at 50% 35%, #6b4b12, #2a1d05);
}
.node.maxed {
  border-color: var(--gold);
  background: radial-gradient(circle at 50% 35%, #a8791c, #4a3306);
}
.node.sel {
  outline: 3px solid #fff;
  outline-offset: 3px;
}
.node.justbought {
  animation: bought calc(0.5s * var(--anim)) cubic-bezier(0.2, 1.6, 0.4, 1);
}
.burst {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  border: 4px solid var(--gold);
  animation: burst calc(0.6s * var(--anim)) ease-out forwards;
  pointer-events: none;
}
.detail {
  flex: 0 1 320px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-start;
}
.detail h2 {
  margin: 0;
}
.flavour {
  margin: 0;
  font-style: italic;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.row.next b {
  color: #b6ffc8;
}
.help {
  font-size: 0.85rem;
  margin: 0;
}
.req {
  color: #ffc0cc;
  margin: 0;
  font-size: 0.9rem;
}
.maxed {
  color: var(--gold);
  font-weight: 700;
}
.buy {
  margin-top: 6px;
}
@keyframes glow {
  to {
    box-shadow: 0 0 26px rgba(255, 201, 77, 0.9);
  }
}
@keyframes bought {
  from {
    transform: scale(1.4);
  }
}
@keyframes burst {
  from {
    transform: scale(0.8);
    opacity: 1;
  }
  to {
    transform: scale(1.8);
    opacity: 0;
  }
}
</style>
