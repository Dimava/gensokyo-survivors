<script setup lang="ts">
import { ENEMIES, enemyIndex } from "../../content/enemies.ts";
import { CURRENCY } from "../../content/names.ts";
import { STAGES } from "../../content/stages.ts";
import { bossDef } from "../../content/bosses.ts";
import { fmtTime, hex } from "./useGame.ts";
import Keys from "./Keys.vue";
const first = STAGES[0]!;
const spells = bossDef(first.boss).spells.length;
const mid = first.script.find((b) => b.form === "midboss");
const midMove = mid ? ENEMIES[enemyIndex(mid.enemy)]!.move : undefined;
const midStay = midMove?.kind === "hover" ? Math.round(midMove.stay / 60) : 0;
</script>

<template>
  <div class="help">
    <section>
      <h3>Controls</h3>
      <table>
        <tbody>
          <tr><td><Keys for="Move" /></td><td>Move (or hold the mouse button on the field and point)</td></tr>
          <tr><td>Hold <Keys for="Focus" /></td><td>Focus: move slowly and see your hitbox, for threading through bullets. Your shots gather in too: tighter fans, knives thrown ahead, orbs closer, the border shoves enemies back harder, a narrower, stronger beam</td></tr>
          <tr><td><Keys for="Action:card1" :max="1" />–<Keys for="Action:card5" :max="1" /> or click</td><td>Play a skill card from your hand</td></tr>
          <tr><td><Keys for="Action:pick1" :max="1" /><Keys for="Action:pick2" :max="1" /><Keys for="Action:pick3" :max="1" /></td><td>Pick a level-up upgrade; <Keys for="Action:reroll" /> rerolls if you have rerolls</td></tr>
          <tr><td><Keys for="Action:confirm" /></td><td>Advance dialogue; <Keys for="Action:skip" /> skips it</td></tr>
          <tr><td><Keys for="Action:pause" /></td><td>Pause (the run also pauses when the tab is hidden)</td></tr>
          <tr><td><Keys for="Action:fullscreen" /></td><td>Fullscreen on and off</td></tr>
          <tr><td><Keys :for="['ArrowY', 'ArrowX']" /> <Keys for="Confirm" :max="2" /> <Keys for="Back" /></td><td>Menus: select, confirm, back. The mouse works everywhere too</td></tr>
        </tbody>
      </table>
    </section>
    <section>
      <h3>How a run goes</h3>
      <ul>
        <li>Your weapons fire on their own. You only move.</li>
        <li>Defeated enemies drop <b style="color: #4da3ff">point items</b> (experience). A full EXP bar is a level-up: pick one of three upgrades.</li>
        <li>Enemies come in <b>formations</b>: fairies fly across in lines and streams, take up posts around you, or circle you, fire, and leave. Defeat them before they go. Only the fuzzballs simply chase you.</li>
        <li>Halfway through, a <b>midboss</b> holds the stage for up to {{ midStay }} seconds. Defeat her and every bullet on screen turns into points.</li>
        <li>At {{ fmtTime(first.bossAt) }} (plus the time the midboss held you up) the field turns into points and the stage boss arrives. She has {{ spells }} <b>spell cards</b>, each with its own HP bar and timer. Break each by damage before its timer runs out for a bonus (after that it must still be broken, without bonus); take no hits during one to <b>capture</b> it for double.</li>
        <li>Clearing the stage, surviving, kills and coins pay out <b>{{ CURRENCY.name }}</b> ({{ CURRENCY.icon }}) when the run ends, even if you fall.</li>
      </ul>
    </section>
    <section>
      <h3>Danmaku, graze and skill cards</h3>
      <ul>
        <li>Your danmaku hitbox is the tiny red dot at your centre, shown when bullets are near. Enemy bodies hurt on contact.</li>
        <li><b>Grazing</b> (letting a bullet pass close to you without touching your hitbox; the graze ring flashes when you do) fills the <b>graze meter</b>. Full meter: draw a skill card. A grazed bullet loses its white core: it still hurts, but can't be grazed again.</li>
        <li>Cards cost <b>Spirit</b>, which refills slowly. Build your deck between runs in Skill Cards &amp; Deck; get new cards from Card Packs.</li>
      </ul>
    </section>
    <section>
      <h3>Between runs</h3>
      <ul>
        <li><b>Shrine Upgrades</b>: a tree of permanent upgrades. Buy nodes next to ones you own; each has several levels.</li>
        <li><b>Expeditions</b>: send companions away for real minutes or hours (the game can be closed); they come back with {{ CURRENCY.name }}.</li>
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
