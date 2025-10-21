/**
 * Vitest configuration for mus-uc-devtools
 * 
 * This configuration sets up a custom pool for running tests in Firefox via Marionette
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test timeout
    testTimeout: 30000,
    
    // Pool options
    poolOptions: {
      firefoxPool: {
        // Custom options for the Firefox pool
        marionettePort: 2828,
      },
    },
    
    // Projects configuration
    projects: [
      {
        test: {
          name: 'firefox-chrome-context',
          pool: './vitest-pool/firefox-pool.js',
          include: ['tests/vitest/**/*.firefox.test.js'],
          exclude: ['**/*.node.test.js'],
        },
      },
      {
        test: {
          name: 'node-tests',
          pool: 'threads',
          include: ['tests/vitest/**/*.node.test.js'],
        },
      },
    ],
  },
});
