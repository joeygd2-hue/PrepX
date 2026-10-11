import { defineConfig } from "vitest/config";

/** Content validation only: no database, safe to run in parallel (`npm run test:content`). */
export default defineConfig({
  test: { environment: "node", include: ["tests/unit/content.test.ts"] },
});
