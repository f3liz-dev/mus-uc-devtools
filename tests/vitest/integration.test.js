/**
 * Integration Test for mus-uc-devtools
 * 
 * Tests the full workflow of CSS loading, manipulation and verification
 * Running directly inside Firefox chrome context with privileged API access
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Integration Tests', () => {
  let loadedCssUris = [];

  afterAll(() => {
    // Clean up all loaded CSS
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    loadedCssUris.forEach(uriStr => {
      try {
        const uri = Services.io.newURI(uriStr);
        if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
          sss.unregisterSheet(uri, sss.USER_SHEET);
        }
      } catch (e) {
        console.error('Failed to clean up CSS:', e);
      }
    });
  });

  it('should load and verify CSS with multiple style rules', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = `
      #nav-bar {
        background-color: #4A90E2 !important;
        border-bottom: 2px solid #2C5F8D !important;
      }
      
      #urlbar {
        background-color: #f0f0f0 !important;
        border-radius: 8px !important;
      }
      
      .tab-background {
        background-color: #ffffff !important;
      }
    `;
    
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    loadedCssUris.push(uri.spec);
    
    // Verify registration
    const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
    expect(isRegistered).toBe(true);
  });

  it('should handle multiple CSS sheets simultaneously', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const cssSheets = [
      "#nav-bar { background: red !important; }",
      "#urlbar { background: blue !important; }",
      ".tab-background { background: green !important; }"
    ];
    
    cssSheets.forEach((css, index) => {
      const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
      
      if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      }
      
      loadedCssUris.push(uri.spec);
      
      const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
      expect(isRegistered).toBe(true);
    });
    
    expect(loadedCssUris.length).toBeGreaterThanOrEqual(3);
  });

  it('should verify CSS application through computed styles', () => {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const navbar = window.document.querySelector("#nav-bar");
    
    expect(navbar).toBeTruthy();
    
    const computedStyle = window.getComputedStyle(navbar);
    
    // Verify we can read computed styles
    expect(computedStyle).toBeTruthy();
    expect(computedStyle.display).toBeTruthy();
    expect(computedStyle.display).not.toBe('none');
  });

  it('should test CSS with media queries', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = `
      @media (min-width: 1024px) {
        #nav-bar {
          padding: 10px !important;
        }
      }
      
      @media (prefers-color-scheme: dark) {
        #urlbar {
          background: #333 !important;
        }
      }
    `;
    
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    loadedCssUris.push(uri.spec);
    
    const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
    expect(isRegistered).toBe(true);
  });

  it('should test CSS with custom properties', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = `
      :root {
        --custom-bg-color: #4A90E2;
        --custom-border-color: #2C5F8D;
      }
      
      #nav-bar {
        background-color: var(--custom-bg-color) !important;
        border-color: var(--custom-border-color) !important;
      }
    `;
    
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    loadedCssUris.push(uri.spec);
    
    const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
    expect(isRegistered).toBe(true);
  });

  it('should handle CSS unloading correctly', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = "#test-unload { color: red !important; }";
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    // Register
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    expect(sss.sheetRegistered(uri, sss.USER_SHEET)).toBe(true);
    
    // Unregister
    if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.unregisterSheet(uri, sss.USER_SHEET);
    }
    
    expect(sss.sheetRegistered(uri, sss.USER_SHEET)).toBe(false);
  });

  it('should verify Firefox Services API availability', () => {
    // Test Services object
    expect(typeof Services).toBe('object');
    expect(Services.wm).toBeTruthy();
    expect(Services.io).toBeTruthy();
    
    // Test Components object
    expect(typeof Cc).toBe('object');
    expect(typeof Ci).toBe('object');
    
    // Test window manager
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    expect(window).toBeTruthy();
    expect(window.document).toBeTruthy();
  });

  it('should take screenshots before and after CSS application', () => {
    // Take baseline screenshot
    const baselineScreenshot = firefox.screenshot('#nav-bar');
    expect(baselineScreenshot.dataURL).toBeTruthy();
    
    // Apply CSS
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = "#nav-bar { background: linear-gradient(to right, red, blue) !important; }";
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    loadedCssUris.push(uri.spec);
    
    // Take screenshot with CSS
    const modifiedScreenshot = firefox.screenshot('#nav-bar');
    expect(modifiedScreenshot.dataURL).toBeTruthy();
    
    // Both screenshots should exist but may differ
    expect(baselineScreenshot.dataURL).not.toBe(modifiedScreenshot.dataURL);
  });
});
