<script setup lang="ts">
// The back of a skill card, to match CardFace: the same bevelled metal rim
// (a neutral bronze: the back never tells the rarity), a dark red lacquer
// field with a faint seigaiha wave, and a yin-yang orb sealed under a paper
// ofuda strip stamped 封 ("sealed"). Soku's deck cards are red lacquer too.
</script>

<template>
  <div class="cback" aria-hidden="true">
    <div class="ring"></div>
    <div class="band"><span>博麗神社</span></div>
    <div class="orb"></div>
    <div class="stamp">封</div>
  </div>
</template>

<style scoped>
.cback {
  --m1: #f3dfae;
  --m2: #a07a3a;
  --m3: #4a3210;
  width: 170px;
  height: 250px;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 120, 90, 0.18), transparent 60%),
    radial-gradient(circle at 50% 100%, transparent 0 9px, rgba(255, 200, 150, 0.07) 9px 10px, transparent 10px 14px, rgba(255, 200, 150, 0.06) 14px 15px, transparent 15px) 0 0 / 24px 12px,
    linear-gradient(160deg, #7a1420, #3a060c 60%, #1c0306);
  box-shadow:
    inset 0 0 0 1px var(--m3),
    inset 2px 2px 0 1px var(--m1),
    inset -2px -2px 0 1px var(--m3),
    inset 0 0 0 4px var(--m2),
    inset 0 0 0 5px #000,
    inset 0 0 0 9px rgba(0, 0, 0, 0),
    inset 0 0 0 10px rgba(243, 223, 174, 0.35),
    0 4px 12px rgba(0, 0, 0, 0.55);
}
.ring {
  /* A thin gilt circle with eight tomoe-like dots around the orb. */
  position: absolute;
  left: 50%;
  top: 50%;
  width: 112px;
  height: 112px;
  translate: -50% -50%;
  border-radius: 50%;
  border: 1.5px solid rgba(243, 223, 174, 0.55);
  background: repeating-conic-gradient(from 11deg, rgba(243, 223, 174, 0.5) 0 4deg, transparent 4deg 45deg);
  mask: radial-gradient(circle, transparent 0 46px, #000 47px 50px, transparent 51px 53px, #000 54px);
}
.band {
  /* The ofuda strip sealing the card, top to bottom. */
  position: absolute;
  left: 50%;
  top: -4px;
  bottom: -4px;
  width: 30px;
  translate: -50% 0;
  display: flex;
  justify-content: center;
  padding-top: 20px;
  background:
    repeating-linear-gradient(0deg, rgba(150, 128, 90, 0.1) 0 1px, transparent 1px 5px),
    linear-gradient(90deg, #e8dcc0, #fbf6ea 45%, #efe4c8);
  box-shadow:
    inset 0 0 0 1px rgba(27, 21, 18, 0.35),
    0 0 6px rgba(0, 0, 0, 0.6);
  font: 900 13px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #1b1512;
}
.band span {
  writing-mode: vertical-rl;
  letter-spacing: 0.12em;
}
.orb {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 64px;
  height: 64px;
  translate: -50% -50%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 25%, #fff 0 9%, transparent 10%),
    radial-gradient(circle at 50% 75%, #c8202e 0 9%, transparent 10%),
    radial-gradient(circle at 50% 25%, #c8202e 0 25%, transparent 26%),
    radial-gradient(circle at 50% 75%, #fff 0 25%, transparent 26%),
    linear-gradient(90deg, #fff 50%, #c8202e 50%);
  box-shadow:
    0 0 0 2px #1a0406,
    0 0 0 4px var(--m2),
    0 0 0 5px #1a0406,
    0 0 18px 4px rgba(255, 150, 110, 0.35);
  rotate: -20deg;
}
.stamp {
  /* The vermilion seal pressed over the strip's foot. */
  position: absolute;
  left: 50%;
  bottom: 30px;
  width: 26px;
  height: 26px;
  translate: -50% 0;
  rotate: -8deg;
  display: grid;
  place-items: center;
  font: 900 17px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #d23a2a;
  border: 2px solid #d23a2a;
  outline: 1px solid rgba(210, 58, 42, 0.6);
  outline-offset: -5px;
  border-radius: 2px;
  mix-blend-mode: multiply;
  opacity: 0.92;
}
</style>
