import { createApp } from "vue";
import App from "./ui/App.vue";
import { vKeynav } from "./keynav.ts";
import "./style.css";

createApp(App).directive("keynav", vKeynav).mount("#app");
