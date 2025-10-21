/**
 * Example Firefox Chrome Context Test
 * 
 * Tests run directly inside Firefox's chrome context with access to all privileged APIs.
 * No need for firefox.executeScript() - just use Services, Components, etc. directly!
 */

import { describe, it, expect } from 'vitest';

describe('Firefox Chrome Context', () => {
  it('should access Firefox Services API directly', () => {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const result = {
      hasWindow: !!window,
      hasServices: typeof Services !== 'undefined',
      userAgent: window.navigator.userAgent,
    };

    expect(result.hasWindow).toBe(true);
    expect(result.hasServices).toBe(true);
    expect(result.userAgent).toContain('Firefox');
  });

  it('should query DOM elements directly', () => {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const doc = window.document;
    const navbar = doc.querySelector("#nav-bar");
    
    const result = {
      hasNavbar: !!navbar,
      elementType: navbar ? navbar.tagName : null,
    };

    expect(result.hasNavbar).toBe(true);
  });

  it('should take a full screenshot using firefox helper', () => {
    const screenshot = firefox.screenshot();
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
  });

  it('should take an element screenshot using firefox helper', () => {
    const screenshot = firefox.screenshot('#nav-bar');
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
  });
});
