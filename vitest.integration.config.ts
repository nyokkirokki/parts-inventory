import { defineConfig } from "vitest/config";

// In-process integration harness. The Cloudflare workerd runtime cannot start on
// this machine (workerd.exe -> STATUS_DLL_NOT_FOUND / 0xC0000135), so
// @cloudflare/vitest-pool-workers and wrangler unstable_dev are both unusable.
// Instead we drive the REAL Hono app (src/worker/app.ts) via app.fetch against a
// real migrated SQLite DB (node:sqlite) through a D1-compatible adapter, exercising
// the genuine route -> service -> repository -> SQL layer with no deployed server.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
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
