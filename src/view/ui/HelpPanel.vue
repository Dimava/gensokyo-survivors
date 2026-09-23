<script setup lang="ts">
import { ENEMIES } from "../../content/enemies.ts";
import { CURRENCY } from "../../content/names.ts";
import { STAGES } from "../../content/stages.ts";
import { bossDef } from "../../content/bosses.ts";
import { fmtTime, hex } from "./useGame.ts";
const first = STAGES[0]!;
const spells = bossDef(first.boss).spells.length;
</script>

<template>
  <div class="help">
    <section>
      <h3>Controls</h3>
      <table>
        <tbody>
          <tr><td><span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> or arrows</td><td>Move (or hold the mouse button on the field and point)</td></tr>
          <tr><td><span class="key">1</span>–<span class="key">5</span> or click</td><td>Play a skill card from your hand</td></tr>
          <tr><td><span class="key">1</span><span class="key">2</span><span class="key">3</span></td><td>Pick a level-up upgrade; <span class="key">R</span> rerolls if you have rerolls</td></tr>
          <tr><td><span class="key">Space</span> / <span class="key">Enter</span></td><td>Advance dialogue; <span class="key">X</span> skips it</td></tr>
          <tr><td><span class="key">Esc</span> / <span class="key">P</span></td><td>Pause (the run also pauses when the tab is hidden)</td></tr>
        </tbody>
      </table>
    </section>
    <section>
      <h3>How a run goes</h3>
      <ul>
        <li>Your weapons fire on their own. You only move.</li>
        <li>Defeated enemies drop <b style="color: #4da3ff">point items</b> (experience). A full EXP bar is a level-up: pick one of three upgrades.</li>
        <li>At {{ fmtTime(first.bossAt) }} the stage boss arrives. She has {{ spells }} <b>spell cards</b>, each with its own HP bar and timer. Break them by damage for a bonus; take no hits during one to <b>capture</b> it for double.</li>
        <li>Clearing the stage, surviving, kills and coins pay out <b>{{ CURRENCY.name }}</b> ({{ CURRENCY.icon }}) when the run ends, even if you fall.</li>
      </ul>
    </section>
    <section>
      <h3>Danmaku, graze and skill cards</h3>
      <ul>
        <li>Your danmaku hitbox is the tiny red dot at your centre, shown when bullets are near. Enemy bodies hurt on contact.</li>
        <li><b>Grazing</b> (letting a bullet pass through the faint ring around you without touching the dot) fills the <b>graze meter</b>. Full meter: draw a skill card.</li>
        <li>Cards cost <b>Spirit</b>, which refills slowly. Build your deck between runs in Skill Cards &amp; Deck; get new cards from Card Packs.</li>
      </ul>
    </section>
    <section>
      <h3>Between runs</h3>
      <ul>
        <li><b>Shrine Upgrades</b>: a tree of permanent upgrades. Buy nodes next to ones you own; each has several levels.</li>
        <li><b>Card Packs</b>: three cards each. Duplicates level a card up (to 3), then refund {{ CURRENCY.name }}. A pity counter guarantees a Super Rare or better.</li>
      </ul>
    </section>
    <section>
      <h3>Who you will meet</h3>
      <div class="codex">
        <div v-for="e in ENEMIES" :key="e.id" class="enemy">
          <i :style="{ background: hex(e.color) }"></i>
          <div>
            <b>{{ e.name }}</b> <span class="muted">HP {{ e.hp }} · contact {{ e.dmg }} · EXP {{ e.xp }}</span>
            <div class="muted">{{ e.blurb }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.help {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h3 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--cyan);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
table {
  border-collapse: collapse;
}
td {
  padding: 4px 12px 4px 0;
  vertical-align: top;
}
td:first-child {
  white-space: nowrap;
}
.key {
  margin-right: 3px;
}
ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.5;
}
.codex {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
}
.enemy {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 0.9rem;
}
.enemy i {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-top: 2px;
}
</style>
