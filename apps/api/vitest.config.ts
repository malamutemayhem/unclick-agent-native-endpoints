import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run test files sequentially so they share the same in-memory PGlite instance
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['./src/__tests__/env.ts'],
    testTimeout: 30_000,
  },
});
