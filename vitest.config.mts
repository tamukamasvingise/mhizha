import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The fast-check runs take several seconds each when every test file runs at once on a slow machine.
    testTimeout: 30_000,
  },
});
