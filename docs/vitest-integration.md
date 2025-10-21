# Vitest v4 Integration Guide

## Overview

This integration adds custom Vitest v4 pool support for running tests in browser environments, with a focus on Firefox chrome context testing for userChrome CSS development.

## What's New

### Custom Pools
- **firefox-pool**: Connects to Firefox via Marionette protocol for chrome context testing
- **chrome-pool**: Basic template for Chrome DevTools Protocol integration (extensible)

### Test Capabilities
1. **Chrome Context Testing**: Access Firefox internals (Services, Components, XPCOM)
2. **Visual Regression**: Capture screenshots of browser UI elements
3. **CSS Testing**: Test userChrome CSS in live Firefox environment
4. **JavaScript Execution**: Run privileged JavaScript in browser context

## Architecture

```
vitest.config.js
  ├── firefox-chrome-context project
  │   └── vitest-pool/firefox-pool.js
  │       └── MarionetteClient (port 2828)
  │           └── Firefox Browser
  │
  ├── chrome-browser project
  │   └── vitest-pool/chrome-pool.js
  │       └── CDPClient (port 9222)
  │           └── Chrome Browser
  │
  └── node-tests project
      └── Built-in threads pool
          └── Node.js runtime
```

## Quick Start

### 1. Setup Firefox
```bash
# Open Firefox and navigate to about:config
# Set: marionette.port = 2828
# Restart Firefox
```

### 2. Run Tests
```bash
# Install dependencies (already done)
npm install

# Run all tests
npm run test:vitest

# Run specific test suites
npm run test:vitest:firefox  # Firefox chrome context tests
npm run test:vitest:node     # Standard Node.js tests
npm run test:vitest:chrome   # Chrome tests (requires implementation)
```

### 3. Write Your First Test

Create `tests/vitest/my-test.firefox.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

describe('My Firefox Test', () => {
  it('should access Firefox APIs', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      return {
        version: Services.appinfo.version,
        platform: Services.appinfo.OS,
      };
    `);
    
    expect(result.version).toBeTruthy();
    expect(result.platform).toBeTruthy();
  });
});
```

## API Reference

### Test Context (Firefox)

When running Firefox tests, your test receives a `firefox` object in the test context:

#### `firefox.executeScript(script, args?)`

Execute JavaScript in Firefox's chrome context.

```javascript
const result = await firefox.executeScript(`
  const window = Services.wm.getMostRecentWindow("navigator:browser");
  return { title: window.document.title };
`);
```

With arguments:
```javascript
const result = await firefox.executeScript(`
  const selector = arguments[0];
  const doc = Services.wm.getMostRecentWindow("navigator:browser").document;
  const element = doc.querySelector(selector);
  return { found: !!element };
`, ['#nav-bar']);
```

#### `firefox.screenshot(selector?)`

Capture a screenshot of the browser window or a specific element.

```javascript
// Full window
const fullPage = await firefox.screenshot();

// Specific element
const navbar = await firefox.screenshot('#nav-bar');

// Returns: { dataURL: string, width: number, height: number }
```

## Test Patterns

### Testing userChrome CSS

```javascript
import { describe, it, beforeAll, afterAll } from 'vitest';

describe('My CSS', () => {
  let cssUri;

  beforeAll(async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      
      const css = "#nav-bar { background: red !important; }";
      const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
      
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      return { uri: uri.spec };
    `);
    
    cssUri = result.uri;
  });

  afterAll(async ({ firefox }) => {
    await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      const uri = Services.io.newURI(arguments[0]);
      sss.unregisterSheet(uri, sss.USER_SHEET);
    `, [cssUri]);
  });

  it('should apply CSS', async ({ firefox }) => {
    // Your test here
  });
});
```

### Visual Regression Testing

```javascript
import { describe, it } from 'vitest';
import { writeFileSync } from 'fs';
import { join } from 'path';

describe('Visual Tests', () => {
  it('should match baseline', async ({ firefox }) => {
    const screenshot = await firefox.screenshot('#nav-bar');
    
    // Save baseline (first run)
    if (process.env.UPDATE_BASELINE) {
      const buffer = Buffer.from(
        screenshot.dataURL.replace(/^data:image\/png;base64,/, ''),
        'base64'
      );
      writeFileSync('baseline-navbar.png', buffer);
    }
    
    // Compare with baseline (subsequent runs)
    // Use a library like pixelmatch or jest-image-snapshot
  });
});
```

### Component Testing

```javascript
describe('Browser UI Components', () => {
  it('should find and interact with toolbar buttons', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const doc = window.document;
      
      // Find all toolbar buttons
      const buttons = doc.querySelectorAll('toolbar toolbarbutton');
      
      return {
        count: buttons.length,
        hasBackButton: !!doc.getElementById('back-button'),
        hasForwardButton: !!doc.getElementById('forward-button'),
      };
    `);
    
    expect(result.count).toBeGreaterThan(0);
    expect(result.hasBackButton).toBe(true);
  });
});
```

## Advanced Configuration

### Custom Marionette Port

Edit `vitest.config.js`:

```javascript
poolOptions: {
  firefoxPool: {
    marionettePort: 3333, // Custom port
  },
}
```

### Custom Test Timeout

```javascript
test: {
  testTimeout: 60000, // 60 seconds
}
```

### Parallel Test Execution

Currently, tests run sequentially within each pool. For parallel execution:

1. Use multiple Firefox profiles
2. Assign different Marionette ports
3. Create multiple pool instances

```javascript
projects: [
  {
    test: {
      name: 'firefox-profile-1',
      pool: './vitest-pool/firefox-pool.js',
      poolOptions: { firefoxPool: { marionettePort: 2828 } },
      include: ['tests/suite1/**/*.firefox.test.js'],
    },
  },
  {
    test: {
      name: 'firefox-profile-2',
      pool: './vitest-pool/firefox-pool.js',
      poolOptions: { firefoxPool: { marionettePort: 2829 } },
      include: ['tests/suite2/**/*.firefox.test.js'],
    },
  },
]
```

## Extending Chrome Support

To fully implement Chrome support:

### Option 1: Using Puppeteer

```bash
npm install puppeteer
```

Update `chrome-pool.js`:

```javascript
const puppeteer = require('puppeteer');

class ChromePool {
  async initialize() {
    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--remote-debugging-port=9222']
    });
    this.page = await this.browser.newPage();
  }
  
  async executeScript(script, args) {
    return await this.page.evaluate(script, ...args);
  }
  
  async screenshot(selector) {
    if (selector) {
      const element = await this.page.$(selector);
      return await element.screenshot({ encoding: 'base64' });
    }
    return await this.page.screenshot({ encoding: 'base64' });
  }
}
```

### Option 2: Using Chrome Remote Interface

```bash
npm install chrome-remote-interface
```

Implement CDP client using WebSocket protocol.

## Comparison with Other Tools

| Feature | mus-uc-devtools + Vitest | Puppeteer | Playwright | Selenium |
|---------|-------------------------|-----------|------------|----------|
| Firefox Chrome Context | ✅ Full access | ❌ No | ❌ No | ❌ No |
| userChrome CSS Testing | ✅ Native | ❌ No | ❌ No | ❌ No |
| Chrome/Firefox Browser | ✅ Both | ✅ Chrome | ✅ Both | ✅ Both |
| Modern Test Framework | ✅ Vitest v4 | ⚠️ Custom | ⚠️ Custom | ⚠️ Custom |
| Visual Regression | ✅ Built-in | ✅ Via plugins | ✅ Via plugins | ✅ Via plugins |

## Troubleshooting

### "Could not connect to Firefox"
- Ensure Firefox is running
- Verify `marionette.port=2828` in about:config
- Check firewall settings

### "Command timeout"
- Increase `testTimeout` in config
- Check if Firefox is responsive
- Verify script syntax is valid

### Tests are slow
- Use `watch` mode for development
- Run specific test suites
- Consider parallel execution with multiple profiles

## Future Roadmap

- [ ] Auto-start/stop Firefox instances
- [ ] Built-in visual regression comparison
- [ ] Code coverage for chrome context
- [ ] Integration with CI/CD pipelines
- [ ] Multi-profile parallel execution
- [ ] Performance benchmarking utilities
- [ ] Full Chrome CDP implementation
- [ ] Cross-browser testing utilities

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Firefox Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/Protocol.html)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [userChrome CSS](https://www.userchrome.org/)
