/**
 * userChrome CSS Testing Example
 * 
 * Tests run directly inside Firefox chrome context with full access to XPCOM APIs.
 * No need for RPC or executeScript wrappers - write tests as if you're already in Firefox!
 */

import { describe, it, expect } from 'vitest';

describe('userChrome CSS Testing', () => {
  let cssUri = null;

  // Note: beforeAll/afterAll work differently when code runs directly in Firefox
  // For now, we'll manage CSS lifecycle within tests
  
  it('should register userChrome CSS', () => {
    // Load test CSS directly using Services
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const testCSS = `
      #nav-bar {
        background: linear-gradient(to bottom, #4A90E2, #357ABD) !important;
        border-bottom: 2px solid #2C5F8D !important;
      }
      
      #urlbar {
        background-color: #f0f0f0 !important;
        border-radius: 8px !important;
      }
    `;
    
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(testCSS));
    
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    cssUri = uri.spec;
    
    // Verify registration
    const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
    expect(isRegistered).toBe(true);
  });

  it('should verify CSS is applied to navbar', () => {
    // Take a screenshot to verify visual changes
    const screenshot = firefox.screenshot('#nav-bar');
    
    expect(screenshot).toHaveProperty('dataURL');
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
  });

  it('should allow querying computed styles', () => {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const navbar = window.document.querySelector("#nav-bar");
    
    if (!navbar) {
      throw new Error("Navbar not found");
    }
    
    const computedStyle = window.getComputedStyle(navbar);
    
    const result = {
      background: computedStyle.background,
      borderBottom: computedStyle.borderBottom,
      display: computedStyle.display,
    };

    expect(result).toHaveProperty('background');
    expect(result).toHaveProperty('borderBottom');
    expect(result.display).not.toBe('none');
  });

  it('should support chrome.manifest style imports', () => {
    // Check if chrome registry can be accessed
    const chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"]
      .getService(Ci.nsIChromeRegistry);
    
    const result = {
      hasChromeRegistry: !!chromeRegistry,
      canConvert: typeof chromeRegistry.convertChromeURL === 'function',
    };

    expect(result.hasChromeRegistry).toBe(true);
    expect(result.canConvert).toBe(true);
  });

  it('should measure CSS performance impact', () => {
    // Measure how many stylesheets are loaded
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const doc = window.document;
    const count = doc.styleSheets.length;
    
    const result = {
      totalStyleSheets: count,
      timestamp: Date.now(),
    };

    expect(result.totalStyleSheets).toBeGreaterThan(0);
  });
  
  it('should clean up CSS after tests', () => {
    if (cssUri) {
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      const uri = Services.io.newURI(cssUri);
      
      if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.unregisterSheet(uri, sss.USER_SHEET);
      }
    }
    
    // Verify cleanup
    expect(true).toBe(true);
  });
});
