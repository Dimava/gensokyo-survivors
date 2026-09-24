<script setup lang="ts">
import { computed } from "vue";
import { host, state } from "../host.ts";
import { PACKS } from "../../content/gacha.ts";
import { CARDS, RARITIES, RARITY_INFO, MAX_CARD_LEVEL } from "../../content/cards.ts";
import { CURRENCY } from "../../content/names.ts";
import { gacha, owned, wallet } from "./useGame.ts";
import PackOpening, { buyPacks, demo, fakePacks } from "./PackOpening.vue";
import CardBack from "./CardBack.vue";
import NavHints from "./NavHints.vue";

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

/** One pack, or ten in a row (a ×10 pull, shown as one opening). Alt+click pretends: free, nothing saved. */
function buy(id: string, count = 1, e?: MouseEvent): void {
  if (e?.altKey) fakePacks(id, count);
  else buyPacks(id, count);
}
/** Alt+click on the pack art pretends too (Alt+Shift: ×10), whatever the wallet says. */
function artClick(id: string, e: MouseEvent): void {
  if (e.altKey && !open.value && !demo.value) fakePacks(id, e.shiftKey ? 10 : 1);
}
</script>

<template>
  <div v-keynav="{ id: 'packs' }" class="screen packs">
    <div class="screen-head">
      <div>
        <h1>Card Packs</h1>
        <div class="sub">New skill cards join your collection (and your deck, if it has room). Duplicates level a card up.</div>
      </div>
      <div class="headr">
        <div class="coins"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
        <button class="btn" @click="host.go('cards')">Skill Cards</button>
        <button class="btn back" @click="host.go('menu')">Back</button>
      </div>
    </div>
    <div class="shop">
      <div v-for="p in PACKS" :key="p.id" class="panel pack">
        <div class="packart" aria-hidden="true" @click="artClick(p.id, $event)">
          <CardBack class="under" />
          <CardBack />
          <div class="band"><span>御神</span><span>籤</span></div>
          <div class="seal">封</div>
          <span class="count">{{ p.cards }} cards</span>
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
          <div class="buys">
            <button class="btn gold buy" :disabled="wallet.coins < p.cost || inRun || open" @click="buy(p.id, 1, $event)">Open for {{ CURRENCY.icon }} {{ p.cost }}</button>
            <button class="btn gold buy" :disabled="wallet.coins < p.cost * 10 || inRun || open" @click="buy(p.id, 10, $event)">Open ×10 for {{ CURRENCY.icon }} {{ p.cost * 10 }}</button>
          </div>
          <p v-if="inRun" class="muted small">Finish your run in progress first.</p>
          <p v-else-if="wallet.coins < p.cost" class="muted small">You need {{ CURRENCY.icon }} {{ p.cost - wallet.coins }} more. Runs pay out {{ CURRENCY.name }}.</p>
          <p class="muted small">Packs opened: {{ gacha.opened }}</p>
        </div>
      </div>
    </div>
    <Transition name="fade">
      <PackOpening v-if="open || demo" :key="demo ? `demo${demo.id}` : gacha.opened" />
    </Transition>
    <NavHints v-if="!open && !demo" />
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
  /* The sealed bundle the opening breaks: lacquer card backs under a paper band and a vermilion seal. */
  position: relative;
  width: 170px;
  height: 250px;
  margin: 4px 6px 12px 4px;
  animation: bob calc(3s * var(--anim)) ease-in-out infinite;
}
.packart > * {
  position: absolute;
  inset: 0;
}
.packart .under {
  transform: translate(6px, 6px) rotate(3deg);
  filter: brightness(0.6);
}
.band {
  inset: 100px -8px auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background:
    repeating-linear-gradient(90deg, rgba(150, 128, 90, 0.1) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, #fbf6ea, #f4ecd8 55%, #e3d5b4);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.7),
    inset 0 -2px 0 rgba(120, 90, 50, 0.4),
    0 3px 8px rgba(0, 0, 0, 0.6);
  font: 900 17px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #1b1512;
}
.seal {
  inset: 96px auto auto 56px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 40% 35%, #f0604a, #b01e1a 60%, #6a0c0a);
  box-shadow:
    inset 0 0 0 3px rgba(255, 190, 160, 0.35),
    inset 0 0 0 6px #a31a16,
    inset 0 0 0 7px rgba(255, 210, 180, 0.5),
    0 3px 6px rgba(0, 0, 0, 0.6);
  font: 900 26px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #ffe4d4;
}
.count {
  inset: auto 0 -26px;
  text-align: center;
  font-weight: 800;
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
.buys {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}
.buy {
  font-size: 1.1rem;
}
@keyframes bob {
  50% {
    transform: translateY(-6px) rotate(-1deg);
  }
}
</style>
