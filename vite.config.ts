import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/** What the title screen shows as the build: package.json's version, the commit and the day it was built. */
const git = (cmd: string): string => {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};
const BUILD = {
  version: (JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")) as { version: string }).version,
  commit: git("rev-parse --short HEAD"),
  date: new Date().toLocaleDateString("sv"),
};

// The kernel is consumed as source through an alias (bun's `file:` install copies the
// kernel's .git folder and fails with EPERM on Windows; see NOTES.md, Kernel friction).
export default defineConfig({
  // Relative asset URLs: the build is served both from a domain root and under a path prefix.
  base: "./",
  plugins: [vue()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  resolve: {
    alias: {
      // Before "gamebones": aliases match by prefix, in order.
      "gamebones/std": fileURLToPath(new URL("../gamebones/src/std/index.ts", import.meta.url)),
      gamebones: fileURLToPath(new URL("../gamebones/src/index.ts", import.meta.url)),
      // One zod for kernel and game: two copies make every schema type incompatible (NOTES.md).
      zod: fileURLToPath(new URL("../gamebones/node_modules/zod/index.js", import.meta.url)),
    },
  },
  server: { port: 5190, strictPort: false, fs: { allow: [".."] }, watch: { ignored: ["**/.tmp/**", "**/.shots/**", "**/test/**", "**/scripts/**"] } },
  build: { target: "es2023", chunkSizeWarningLimit: 2000 },
});
