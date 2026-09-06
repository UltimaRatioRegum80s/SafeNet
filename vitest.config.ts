import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    environment: "node",
    // shared/__tests__/schema.incident.test.ts predates this config: it is a
    // console.log script run by hand with tsx, not a vitest suite, so it is
    // deliberately not picked up here.
    include: ["tests/**/*.test.ts"],
    // Booting an embedded PostgreSQL for the integration suite takes a while.
    testTimeout: 30_000,
    hookTimeout: 180_000,
    // The integration suite shares one database; run files serially.
    fileParallelism: false,
  },
});
