import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // No coverage threshold is configured: the Minimal test strategy for this
    // change set is requirement-driven, not coverage-driven.
  },
});
