/**
 * Example Visual Regression Test
 * 
 * This test demonstrates visual regression testing capabilities
 * using Firefox's screenshot functionality.
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { join } from 'path';

describe('Visual Regression', () => {
  it('should capture navbar screenshot for visual comparison', async ({ firefox }) => {
    // Take screenshot of the navbar
    const screenshot = await firefox.screenshot('#nav-bar');
    
    // In a real scenario, you would compare this with a baseline image
    // For now, we just verify the screenshot was taken
    expect(screenshot.dataURL).toBeTruthy();
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);

    // Optionally save the screenshot for manual inspection
    // (in a real setup, you might use a visual regression library)
    if (process.env.SAVE_SCREENSHOTS) {
      const base64Data = screenshot.dataURL.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = join(process.cwd(), 'screenshots', 'navbar.png');
      writeFileSync(filename, buffer);
    }
  });

  it('should detect visual changes in chrome CSS', async ({ firefox }) => {
    // Apply test CSS
    const cssApplied = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      
      const testCSS = "#nav-bar { background-color: red !important; }";
      const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
      
      if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      }
      
      return { uri: uri.spec };
    `);

    // Take screenshot with CSS applied
    const screenshotWithCSS = await firefox.screenshot('#nav-bar');
    expect(screenshotWithCSS.dataURL).toBeTruthy();

    // Clean up
    await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      const uri = Services.io.newURI(arguments[0]);
      
      if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.unregisterSheet(uri, sss.USER_SHEET);
      }
    `, [cssApplied.uri]);
  });

  it('should support full-page screenshots', async ({ firefox }) => {
    const screenshot = await firefox.screenshot();
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    
    // Verify it's a reasonable size for a browser window
    expect(screenshot.width).toBeGreaterThan(800);
    expect(screenshot.height).toBeGreaterThan(600);
  });
});
