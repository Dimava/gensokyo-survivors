/// <reference types="vite/client" />

/** The build, from vite.config.ts: package.json's version, the short commit hash and the build day. */
declare const __BUILD__: { version: string; commit: string; date: string };

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
