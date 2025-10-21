/**
 * Vitest configuration for mus-uc-devtools
 * 
 * This configuration sets up a custom pool for running tests inside Firefox chrome context
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test timeout
    testTimeout: 30000,
    
    // Pool configuration for Firefox chrome context
    pool: './vitest-pool/firefox-pool.js',
    
    // Pool options
    poolOptions: {
      firefox: {
        // Marionette port for Firefox connection
        marionettePort: 2828,
      },
    },
    
    // Test file patterns
    include: ['tests/vitest/**/*.test.js'],
  },
});
