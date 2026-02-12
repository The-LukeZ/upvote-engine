import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "src/test",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
