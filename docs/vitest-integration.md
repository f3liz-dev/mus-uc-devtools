# Vitest v4 Integration Guide

## Overview

This integration provides a custom Vitest v4 pool that runs tests **directly inside** Firefox's chrome context. Inspired by `@cloudflare/vitest-pool-workers`, this approach gives you native access to Firefox APIs without RPC overhead.

## Key Innovation

**Traditional browser testing:** Tests run in Node.js, send commands to browser via protocol  
**This approach:** Tests run **inside** the browser with direct API access

This means you can write:
```javascript
const version = Services.appinfo.version;  // Direct access!
```

Instead of:
```javascript
const version = await page.evaluate(() => Services.appinfo.version);  // RPC
```

## Quick Start

### 1. Prerequisites

- Firefox must be running
- Set `marionette.port=2828` in Firefox's `about:config`
- Restart Firefox after changing the setting

### 2. Install & Run

```bash
npm install

# Run tests
npm run test:vitest

# Watch mode (recommended for development)
npm run test:vitest:watch
```

### 3. Write Your First Test

Create `tests/vitest/my-test.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

describe('My Firefox Test', () => {
  it('should access Firefox APIs directly', () => {
    // You're already running inside Firefox chrome context!
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const version = Services.appinfo.version;
    
    expect(version).toBeTruthy();
    expect(window).toBeTruthy();
  });
});
```

## Architecture

```
Vitest (Node.js)  ←→  Marionette Protocol  ←→  Firefox Chrome Context
                        (port 2828)              (Tests execute here)
                                                 
                                                 Available in tests:
                                                 - Services.*
                                                 - Components.*  
                                                 - Cc, Ci, Cu
                                                 - describe, it, expect
                                                 - firefox.screenshot()
```

## Available APIs

### Firefox Chrome Context APIs

All standard Firefox chrome APIs are available:

```javascript
// Services
Services.wm.getMostRecentWindow("navigator:browser")
Services.appinfo.version
Services.io.newURI(url)

// XPCOM Components
Cc["@mozilla.org/content/style-sheet-service;1"]
  .getService(Ci.nsIStyleSheetService)

// DOM Access
const window = Services.wm.getMostRecentWindow("navigator:browser");
const element = window.document.querySelector("#nav-bar");
```

### Vitest Test APIs

Standard Vitest functions:

```javascript
describe(name, fn)  // Group tests
it(name, fn)        // Define test  
expect(value)       // Assertions
```

### Helper APIs

Custom helpers provided by the pool:

```javascript
// Screenshot full window
const screenshot = firefox.screenshot();

// Screenshot specific element
const screenshot = firefox.screenshot('#nav-bar');

// Returns: { dataURL: string, width: number, height: number }
```

## Common Patterns

### Testing userChrome CSS

```javascript
import { describe, it, expect } from 'vitest';

describe('My CSS Theme', () => {
  it('should load CSS', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const css = `
      #nav-bar {
        background: linear-gradient(to bottom, #667eea, #764ba2) !important;
      }
    `;
    
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
    
    // Load the CSS
    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    
    // Verify it's loaded
    expect(sss.sheetRegistered(uri, sss.USER_SHEET)).toBe(true);
    
    // Clean up
    sss.unregisterSheet(uri, sss.USER_SHEET);
  });
});
```

### Visual Regression Testing

```javascript
describe('Visual Tests', () => {
  it('should match navbar appearance', () => {
    // Take screenshot
    const screenshot = firefox.screenshot('#nav-bar');
    
    expect(screenshot.dataURL).toBeTruthy();
    expect(screenshot.width).toBeGreaterThan(0);
    
    // In production: compare with baseline image
    // await compareWithBaseline(screenshot, 'navbar-baseline.png');
  });
});
```

### Testing DOM Manipulation

```javascript
describe('DOM Tests', () => {
  it('should find and query elements', () => {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const doc = window.document;
    
    // Query elements
    const navbar = doc.querySelector("#nav-bar");
    const urlbar = doc.querySelector("#urlbar");
    
    expect(navbar).toBeTruthy();
    expect(urlbar).toBeTruthy();
    
    // Check computed styles
    const style = window.getComputedStyle(navbar);
    expect(style.display).not.toBe('none');
  });
});
```

### Testing Firefox Services

```javascript
describe('Firefox Services', () => {
  it('should access application info', () => {
    const appInfo = Services.appinfo;
    
    expect(appInfo.version).toBeTruthy();
    expect(appInfo.platformVersion).toBeTruthy();
    expect(appInfo.name).toBe('Firefox');
  });
  
  it('should access window manager', () => {
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    
    expect(window).toBeTruthy();
    expect(window.location.href).toContain('chrome://browser');
  });
});
```

## Configuration

### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    pool: './vitest-pool/firefox-pool.js',
    poolOptions: {
      firefox: {
        marionettePort: 2828,  // Custom port if needed
      },
    },
    include: ['tests/vitest/**/*.test.js'],
  },
});
```

## Limitations

- **Sequential execution**: Tests run one file at a time
- **No beforeAll/afterAll**: Lifecycle hooks not yet fully supported
- **Error stacks**: May be less detailed than Node.js stack traces
- **Vitest features**: Some advanced features may not work in Firefox context

## Comparison with Other Tools

| Feature | Puppeteer/Playwright | This Integration |
|---------|---------------------|------------------|
| Test Location | Node.js (RPC to browser) | Inside Firefox |
| API Access | Via evaluate() | Direct |
| Chrome Context | ❌ No access | ✅ Full access |
| userChrome CSS | ❌ Cannot test | ✅ Native support |
| Performance | RPC overhead | Native speed |
| Complexity | Higher (protocol) | Lower (direct) |

## Troubleshooting

### Connection Issues

**"Could not connect to Firefox"**
- Ensure Firefox is running
- Check `marionette.port=2828` in about:config
- Try restarting Firefox
- Check firewall settings

### API Errors

**"Services is not defined"**
- Test is not running in Firefox chrome context
- Check Marionette connection
- Verify pool configuration

### Screenshot Issues

**Screenshots failing or empty**
- Firefox window must be visible (not minimized)
- Check element selector is correct
- Verify Firefox window has focus

## Advanced Topics

### Manual Test Execution

```javascript
// The pool injects these globals:
// - describe, it, expect (Vitest)
// - Services, Components, Cc, Ci, Cu (Firefox)
// - firefox.screenshot() (helper)

describe('Advanced Test', () => {
  it('can use all Firefox APIs', () => {
    // Direct access to everything!
    const chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"]
      .getService(Ci.nsIChromeRegistry);
    
    expect(chromeRegistry).toBeTruthy();
  });
});
```

### Custom Assertions

```javascript
const expectElement = (selector) => {
  const window = Services.wm.getMostRecentWindow("navigator:browser");
  const element = window.document.querySelector(selector);
  
  return {
    toExist: () => expect(element).toBeTruthy(),
    toBeVisible: () => {
      const style = window.getComputedStyle(element);
      expect(style.display).not.toBe('none');
      expect(style.visibility).not.toBe('hidden');
    },
  };
};

// Usage
it('should have visible navbar', () => {
  expectElement('#nav-bar').toExist();
  expectElement('#nav-bar').toBeVisible();
});
```

## Best Practices

1. **Keep tests focused**: Test one thing per `it()` block
2. **Clean up resources**: Unregister CSS, close tabs, etc.
3. **Use descriptive names**: Make test names clear and specific
4. **Avoid side effects**: Tests should not affect each other
5. **Check Firefox state**: Verify Firefox is in expected state before testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Firefox Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/)
- [XPCOM Reference](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM)
- [Firefox Services](https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Services.jsm)
- [userChrome CSS](https://www.userchrome.org/)

## Getting Help

If you encounter issues:

1. Check Firefox console for errors
2. Verify Marionette connection (port 2828)
3. Review test syntax for typos
4. Check documentation and examples
5. Open an issue with error details

## Next Steps

1. Write tests for your userChrome CSS
2. Set up visual regression baselines
3. Integrate with CI/CD pipeline
4. Share your testing patterns with the community
