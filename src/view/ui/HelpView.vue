<script setup lang="ts">
import HelpPanel from "./HelpPanel.vue";
defineEmits<{ close: [] }>();
</script>

<template>
  <div class="screen">
    <div class="screen-head">
      <h1>How to Play</h1>
      <button class="btn" @click="$emit('close')">Back <span class="key">Esc</span></button>
    </div>
    <div class="panel body">
      <HelpPanel />
    </div>
  </div>
</template>

<style scoped>
.body {
  width: min(900px, 94vw);
  padding: 22px 26px;
  margin-bottom: 30px;
}
</style>
