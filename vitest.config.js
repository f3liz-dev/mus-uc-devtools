/**
 * Vitest configuration for mus-uc-devtools
 * 
 * This configuration sets up custom pools for running tests in Firefox and Chrome
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
      chromePool: {
        // Custom options for the Chrome pool
        cdpPort: 9222,
      },
    },
    
    // Projects configuration
    projects: [
      {
        test: {
          name: 'firefox-chrome-context',
          pool: './vitest-pool/firefox-pool.js',
          include: ['tests/vitest/**/*.firefox.test.js'],
          exclude: ['**/*.node.test.js', '**/*.chrome.test.js'],
        },
      },
      {
        test: {
          name: 'chrome-browser',
          pool: './vitest-pool/chrome-pool.js',
          include: ['tests/vitest/**/*.chrome.test.js'],
          exclude: ['**/*.node.test.js', '**/*.firefox.test.js'],
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
