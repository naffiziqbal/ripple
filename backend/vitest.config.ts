import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: './tests/global-setup.ts',
    // Test files share one Postgres database — run them sequentially.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://ripple:ripple@localhost:5433/ripple_test',
      JWT_SECRET: 'test-secret-at-least-16-chars',
    },
  },
});
