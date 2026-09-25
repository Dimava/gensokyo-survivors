import { createApp } from "vue";
import App from "./ui/App.vue";
import { vKeynav } from "./keynav.ts";
import { installFabrics } from "./fabric.ts";
import "./style.css";

installFabrics();

createApp(App).directive("keynav", vKeynav).mount("#app");
