import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      // node:test files run via `tsx --test` in the same npm script.
      "src/memory/__tests__/**",
    ],
  },
});
