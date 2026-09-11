import { defineConfig } from 'vitest/config';

/**
 * E2E configuration — deliberately separate from `vitest.config.mts`.
 *
 * The unit suite must stay runnable with no network and no credentials
 * (requirement FR9.4), so these tests are never picked up by `npm test`.
 * They run only via `npm run test:e2e`.
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.test.ts'],
    environment: 'node',
    // Loads .env if present. Suites whose variables are absent skip
    // themselves rather than failing, so this is safe with no .env at all.
    setupFiles: ['e2e/setup.ts'],
    // Real network round trips to Salesforce; the 5s default is too tight.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // These tests mint and revoke real tokens against one org. Running files
    // in parallel invites rate limiting and makes a failure hard to attribute.
    fileParallelism: false,
    retry: 0,
  },
});
