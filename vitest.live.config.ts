import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Calls the real AI provider and costs money. Run with: npm run test:live */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/live/**/*.live.ts"], testTimeout: 600_000, hookTimeout: 60_000 },
});
