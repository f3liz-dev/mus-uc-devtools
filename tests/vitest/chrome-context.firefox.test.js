/**
 * Example Firefox Chrome Context Test
 * 
 * This test runs in Firefox's chrome context via the custom Vitest pool.
 * It demonstrates accessing Firefox internals and taking screenshots.
 */

import { describe, it, expect } from 'vitest';

describe('Firefox Chrome Context', () => {
  it('should access Firefox Services API', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      return {
        hasWindow: !!window,
        hasServices: typeof Services !== 'undefined',
        userAgent: window.navigator.userAgent,
      };
    `);

    expect(result.hasWindow).toBe(true);
    expect(result.hasServices).toBe(true);
    expect(result.userAgent).toContain('Firefox');
  });

  it('should be able to query DOM elements', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const doc = window.document;
      const navbar = doc.querySelector("#nav-bar");
      
      return {
        hasNavbar: !!navbar,
        elementType: navbar ? navbar.tagName : null,
      };
    `);

    expect(result.hasNavbar).toBe(true);
  });

  it('should take a full screenshot', async ({ firefox }) => {
    const screenshot = await firefox.screenshot();
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
  });

  it('should take an element screenshot', async ({ firefox }) => {
    const screenshot = await firefox.screenshot('#nav-bar');
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
  });
});
