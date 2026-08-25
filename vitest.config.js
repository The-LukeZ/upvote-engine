import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      $: path.resolve(process.cwd(), "src"),
      $types: path.resolve(process.cwd(), "types"),
    },
  },
  test: {
    dir: "src/test",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
