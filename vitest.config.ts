import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    fileParallelism: false,
    globals: true,
    pool: "vmThreads",
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@shared": new URL("./src/shared", import.meta.url).pathname,
      "@worker": new URL("./src/worker", import.meta.url).pathname,
      "@web": new URL("./src/web", import.meta.url).pathname,
    },
  },
});
