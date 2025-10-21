/**
 * Example Visual Regression Test
 * 
 * Tests run directly inside Firefox chrome context.
 * Access Services and XPCOM APIs directly without executeScript wrapper.
 */

import { describe, it, expect } from 'vitest';

describe('Visual Regression', () => {
  it('should capture navbar screenshot for visual comparison', () => {
    // Take screenshot of the navbar using firefox helper
    const screenshot = firefox.screenshot('#nav-bar');
    
    // Verify the screenshot was taken
    expect(screenshot.dataURL).toBeTruthy();
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
  });

  it('should detect visual changes in chrome CSS', () => {
    // Apply test CSS directly using Services
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = "#nav-bar { background-color: red !important; }";
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    const cssUri = uri.spec;

    // Take screenshot with CSS applied
    const screenshotWithCSS = firefox.screenshot('#nav-bar');
    expect(screenshotWithCSS.dataURL).toBeTruthy();

    // Clean up - unregister the stylesheet
    if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.unregisterSheet(uri, sss.USER_SHEET);
    }
  });

  it('should support full-page screenshots', () => {
    const screenshot = firefox.screenshot();
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    
    // Verify it's a reasonable size for a browser window
    expect(screenshot.width).toBeGreaterThan(800);
    expect(screenshot.height).toBeGreaterThan(600);
  });
});
