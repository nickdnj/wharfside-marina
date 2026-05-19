import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest is invoked via `pnpm test` / `pnpm test:watch` (see package.json).
// This config wires up the `@/*` path alias from tsconfig.json so that
// imports like `@/db` and `@/lib/pricing/resolve` resolve at test time.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
