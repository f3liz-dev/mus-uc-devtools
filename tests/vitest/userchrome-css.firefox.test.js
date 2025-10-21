/**
 * userChrome CSS Testing Example
 * 
 * This test demonstrates how to test userChrome CSS modifications
 * in Firefox's chrome context using the Vitest integration.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('userChrome CSS Testing', () => {
  let cssUri = null;

  beforeAll(async ({ firefox }) => {
    // Load test CSS before running tests
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      
      const testCSS = \`
        #nav-bar {
          background: linear-gradient(to bottom, #4A90E2, #357ABD) !important;
          border-bottom: 2px solid #2C5F8D !important;
        }
        
        #urlbar {
          background-color: #f0f0f0 !important;
          border-radius: 8px !important;
        }
      \`;
      
      const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
      
      if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      }
      
      return { uri: uri.spec };
    `);

    cssUri = result.uri;
  });

  afterAll(async ({ firefox }) => {
    // Clean up - unregister the stylesheet
    if (cssUri) {
      await firefox.executeScript(`
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
          .getService(Ci.nsIStyleSheetService);
        const uri = Services.io.newURI(arguments[0]);
        
        if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
          sss.unregisterSheet(uri, sss.USER_SHEET);
        }
      `, [cssUri]);
    }
  });

  it('should register userChrome CSS', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      const uri = Services.io.newURI(arguments[0]);
      
      return { isRegistered: sss.sheetRegistered(uri, sss.USER_SHEET) };
    `, [cssUri]);

    expect(result.isRegistered).toBe(true);
  });

  it('should verify CSS is applied to navbar', async ({ firefox }) => {
    // Take a screenshot to verify visual changes
    const screenshot = await firefox.screenshot('#nav-bar');
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
    
    // In a real visual regression test, you would compare this screenshot
    // with a baseline image to detect visual changes
  });

  it('should allow querying computed styles', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const navbar = window.document.querySelector("#nav-bar");
      
      if (!navbar) {
        throw new Error("Navbar not found");
      }
      
      const computedStyle = window.getComputedStyle(navbar);
      
      return {
        background: computedStyle.background,
        borderBottom: computedStyle.borderBottom,
        display: computedStyle.display,
      };
    `);

    expect(result).toHaveProperty('background');
    expect(result).toHaveProperty('borderBottom');
    expect(result.display).not.toBe('none');
  });

  it('should support chrome.manifest style imports', async ({ firefox }) => {
    // Test that chrome:// URLs can be registered and loaded
    const result = await firefox.executeScript(`
      // Check if chrome registry can be accessed
      const chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"]
        .getService(Ci.nsIChromeRegistry);
      
      return {
        hasChromeRegistry: !!chromeRegistry,
        canConvert: typeof chromeRegistry.convertChromeURL === 'function',
      };
    `);

    expect(result.hasChromeRegistry).toBe(true);
    expect(result.canConvert).toBe(true);
  });

  it('should measure CSS performance impact', async ({ firefox }) => {
    // Measure how many stylesheets are loaded
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      
      // Count registered USER_SHEET stylesheets
      let count = 0;
      try {
        // This is a simplified check - actual implementation may vary
        const window = Services.wm.getMostRecentWindow("navigator:browser");
        const doc = window.document;
        count = doc.styleSheets.length;
      } catch (e) {
        count = -1;
      }
      
      return {
        totalStyleSheets: count,
        timestamp: Date.now(),
      };
    `);

    expect(result.totalStyleSheets).toBeGreaterThan(0);
  });
});
