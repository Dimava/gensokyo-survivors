import { createApp } from "vue";
import App from "./ui/App.vue";
import { vKeynav } from "./keynav.ts";
import { installFabrics } from "./fabric.ts";
// The display face (refs/gui/NOTES.md, Type): Shippori Mincho B1, Latin only (~33 KB a weight);
// kanji keep the system Mincho, so the Japanese subsets never load.
import "@fontsource/shippori-mincho-b1/latin-400.css";
import "@fontsource/shippori-mincho-b1/latin-700.css";
import "@fontsource/shippori-mincho-b1/latin-800.css";
import "./style.css";

installFabrics();

createApp(App).directive("keynav", vKeynav).mount("#app");
