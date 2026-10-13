import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Integration tests that need live Supabase credentials live in tests/
    // and skip themselves when env vars are absent (see PRD/ARCHITECTURE).
    setupFiles: ["./tests/setup.ts"],
  },
});
