<script setup lang="ts">
import HelpPanel from "./HelpPanel.vue";
import NavHints from "./NavHints.vue";
defineEmits<{ close: [] }>();
</script>

<template>
  <div v-keynav class="screen help-screen">
    <div class="screen-head">
      <h1>How to Play</h1>
      <button class="btn back" @click="$emit('close')">Back</button>
    </div>
    <div class="panel body">
      <HelpPanel />
    </div>
    <NavHints />
  </div>
</template>

<style scoped>
.body {
  width: min(900px, 94vw);
  padding: 22px 26px;
  margin-bottom: 64px;
}
/* The page scrolls under the key legend: its text fades into the backdrop above the legend instead of running through it. */
.help-screen::after {
  content: "";
  position: sticky;
  bottom: 0;
  flex: none;
  align-self: stretch;
  height: 64px;
  margin-top: -64px;
  background: linear-gradient(rgba(21, 32, 45, 0), rgb(21, 32, 45) 75%);
  pointer-events: none;
}
</style>
