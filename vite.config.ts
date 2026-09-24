import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// The kernel is consumed as source through an alias (bun's `file:` install copies the
// kernel's .git folder and fails with EPERM on Windows; see NOTES.md, Kernel friction).
export default defineConfig({
  // Relative asset URLs: the build is served both from a domain root and under a path prefix.
  base: "./",
  plugins: [vue()],
  resolve: {
    alias: {
      gamebones: fileURLToPath(new URL("../gamebones/src/index.ts", import.meta.url)),
      // One zod for kernel and game: two copies make every schema type incompatible (NOTES.md).
      zod: fileURLToPath(new URL("../gamebones/node_modules/zod/index.js", import.meta.url)),
    },
  },
  server: { port: 5190, strictPort: false, fs: { allow: [".."] }, watch: { ignored: ["**/.tmp/**", "**/.shots/**", "**/test/**", "**/scripts/**"] } },
  build: { target: "es2023", chunkSizeWarningLimit: 2000 },
});
