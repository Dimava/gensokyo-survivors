<script setup lang="ts">
// The credits as a screen of their own (for a roll at the end of the game):
// the roll fills the screen, the back button floats over it, and when the
// roll has rested on its closing card it returns to the menu.
import { host } from "../host.ts";
import CreditsRoll from "./CreditsRoll.vue";
</script>

<template>
  <div v-keynav class="screen credits">
    <CreditsRoll class="roll" :loop="false" @end="host.go('menu')" />
    <div class="screen-head">
      <h1 class="sr">Credits</h1>
      <button class="btn back" @click="host.go('menu')">Back</button>
    </div>
  </div>
</template>

<style scoped>
.credits {
  overflow: hidden;
}
.roll {
  position: absolute;
  inset: 0;
}
.screen-head {
  position: relative;
  justify-content: flex-end;
  pointer-events: none;
}
.screen-head .btn {
  pointer-events: auto;
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
