/**
 * Example Node.js test (runs in standard Node.js environment)
 * 
 * This demonstrates that the Vitest setup supports both Firefox tests
 * and standard Node.js tests in the same project.
 */

import { describe, it, expect } from 'vitest';

describe('Node.js Environment Tests', () => {
  it('should run basic JavaScript tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with async functions', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should test helper functions', () => {
    const helper = (x, y) => x + y;
    expect(helper(2, 3)).toBe(5);
  });
});
