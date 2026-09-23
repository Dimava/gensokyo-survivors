<script setup lang="ts">
import { computed } from "vue";
import { host, state } from "../host.ts";
import { PACKS } from "../../content/gacha.ts";
import { CARDS, RARITIES, RARITY_INFO, MAX_CARD_LEVEL } from "../../content/cards.ts";
import { CURRENCY } from "../../content/names.ts";
import { gacha, owned, wallet } from "./useGame.ts";
import PackOpening from "./PackOpening.vue";

const open = computed(() => {
  void state.meta;
  return host.k.paths().includes("/pack");
});
const inRun = computed(() => {
  void state.meta;
  return !!host.path();
});
const ownedIds = computed(() => new Map(owned.value.map((o) => [o.card, o])));

function odds(packId: string) {
  const p = PACKS.find((x) => x.id === packId)!;
  const total = RARITIES.reduce((s, r) => s + p.odds[r], 0);
  return RARITIES.map((r) => {
    const pool = CARDS.filter((c) => c.rarity === r);
    return {
      r,
      pct: ((p.odds[r] / total) * 100).toFixed(1),
      have: pool.filter((c) => ownedIds.value.has(c.id)).length,
      maxed: pool.filter((c) => (ownedIds.value.get(c.id)?.level ?? 0) >= MAX_CARD_LEVEL).length,
      total: pool.length,
    };
  });
}

function buy(id: string): void {
  host.meta("pack:buy", { pack: id });
}
</script>

<template>
  <div class="screen packs">
    <div class="screen-head">
      <div>
        <h1>Card Packs</h1>
        <div class="sub">New skill cards join your collection (and your deck, if it has room). Duplicates level a card up.</div>
      </div>
      <div class="headr">
        <div class="coins"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
        <button class="btn" @click="host.go('cards')">Skill Cards</button>
        <button class="btn" @click="host.go('menu')">Back <span class="key">Esc</span></button>
      </div>
    </div>
    <div class="shop">
      <div v-for="p in PACKS" :key="p.id" class="panel pack">
        <div class="packart">
          <div class="yy"></div>
          <span>{{ p.cards }} cards</span>
        </div>
        <div class="info">
          <h2>{{ p.name }}</h2>
          <p class="muted">{{ p.blurb }}</p>
          <table>
            <thead>
              <tr>
                <th>Rarity</th>
                <th>Chance per card</th>
                <th>Collected</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in odds(p.id)" :key="o.r">
                <td :style="{ color: RARITY_INFO[o.r].css }">
                  <b>{{ o.r }}</b> {{ RARITY_INFO[o.r].label }}
                </td>
                <td>{{ o.pct }}%</td>
                <td>{{ o.have }} / {{ o.total }}<span v-if="o.maxed" class="muted"> ({{ o.maxed }} maxed)</span></td>
              </tr>
            </tbody>
          </table>
          <p class="pity">
            Pity: a {{ RARITY_INFO[p.pity.rarity].label }} or better is guaranteed at least every {{ p.pity.every }} packs.
            <b>Packs since your last one: {{ gacha.sinceHigh }}</b> (guaranteed within {{ Math.max(1, p.pity.every - gacha.sinceHigh) }}).
          </p>
          <p class="muted small">Cards already at level {{ MAX_CARD_LEVEL }} refund {{ CURRENCY.name }} instead: {{ RARITIES.map((r) => `${r} ${RARITY_INFO[r].refund}`).join(", ") }}.</p>
          <button class="btn gold buy" :disabled="wallet.coins < p.cost || inRun || open" @click="buy(p.id)">Open for {{ CURRENCY.icon }} {{ p.cost }}</button>
          <p v-if="inRun" class="muted small">Finish your run in progress first.</p>
          <p v-else-if="wallet.coins < p.cost" class="muted small">You need {{ CURRENCY.icon }} {{ p.cost - wallet.coins }} more. Runs pay out {{ CURRENCY.name }}.</p>
          <p class="muted small">Packs opened: {{ gacha.opened }}</p>
        </div>
      </div>
    </div>
    <Transition name="fade">
      <PackOpening v-if="open" />
    </Transition>
  </div>
</template>

<style scoped>
.headr {
  display: flex;
  gap: 10px;
  align-items: center;
}
.shop {
  width: min(900px, 94vw);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 30px;
}
.pack {
  display: flex;
  gap: 24px;
  padding: 22px;
  flex-wrap: wrap;
}
.packart {
  width: 180px;
  height: 250px;
  border-radius: 14px;
  border: 2px solid #c9b3ff;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 8px, transparent 8px 16px),
    linear-gradient(160deg, #6a2fb8, #22103f);
  box-shadow: 0 0 30px rgba(197, 107, 255, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-weight: 800;
  animation: bob calc(3s * var(--anim)) ease-in-out infinite;
}
.yy {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid #fff;
  background:
    radial-gradient(circle at 50% 25%, #fff 0 9%, transparent 10%),
    radial-gradient(circle at 50% 75%, #e0314b 0 9%, transparent 10%),
    radial-gradient(circle at 50% 25%, #e0314b 0 25%, transparent 26%),
    radial-gradient(circle at 50% 75%, #fff 0 25%, transparent 26%),
    linear-gradient(90deg, #fff 50%, #e0314b 50%);
}
.info {
  flex: 1 1 400px;
}
.info h2 {
  margin: 0 0 6px;
}
table {
  border-collapse: collapse;
  margin: 10px 0;
  width: 100%;
}
th {
  text-align: left;
  color: var(--muted);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 4px 0;
}
td {
  padding: 3px 0;
}
.pity {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 201, 77, 0.08);
  border: 1px solid rgba(255, 201, 77, 0.3);
  font-size: 0.9rem;
}
.small {
  font-size: 0.85rem;
  margin: 6px 0;
}
.buy {
  font-size: 1.1rem;
  margin-top: 6px;
}
@keyframes bob {
  50% {
    transform: translateY(-6px) rotate(-1deg);
  }
}
</style>
