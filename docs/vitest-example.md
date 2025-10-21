# Example: Testing userChrome CSS with Vitest

This example demonstrates a complete workflow for testing userChrome CSS modifications using the Vitest integration.

## Scenario

You're developing a custom Firefox theme that modifies the navbar and tabs. You want to:
1. Test that your CSS loads correctly
2. Verify visual changes
3. Ensure no conflicts with Firefox's default styles

## Project Structure

```
my-firefox-theme/
├── src/
│   ├── navbar.css
│   └── tabs.css
├── tests/
│   └── vitest/
│       ├── navbar.firefox.test.js
│       └── tabs.firefox.test.js
├── vitest.config.js
└── package.json
```

## Step 1: Install Dependencies

```bash
npm install mus-uc-devtools --save-dev
npm install vitest @vitest/runner pathe --save-dev
```

## Step 2: Create CSS Files

**src/navbar.css:**
```css
/* Custom navbar styling */
#nav-bar {
  background: linear-gradient(to bottom, #667eea 0%, #764ba2 100%) !important;
  border-bottom: 2px solid #5a67d8 !important;
  padding: 4px 8px !important;
}

#urlbar {
  background-color: rgba(255, 255, 255, 0.9) !important;
  border-radius: 8px !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

#urlbar:focus-within {
  background-color: white !important;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.5) !important;
}
```

**src/tabs.css:**
```css
/* Custom tab styling */
.tabbrowser-tab {
  border-radius: 8px 8px 0 0 !important;
  margin: 0 2px !important;
}

.tabbrowser-tab[selected] {
  background: linear-gradient(to bottom, #667eea 0%, #764ba2 100%) !important;
}

.tab-label {
  font-weight: 500 !important;
}
```

## Step 3: Create Vitest Configuration

**vitest.config.js:**
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    poolOptions: {
      firefoxPool: {
        marionettePort: 2828,
      },
    },
    projects: [
      {
        test: {
          name: 'firefox-theme-tests',
          pool: './node_modules/mus-uc-devtools/vitest-pool/firefox-pool.js',
          include: ['tests/vitest/**/*.firefox.test.js'],
        },
      },
    ],
  },
});
```

## Step 4: Write Tests

**tests/vitest/navbar.firefox.test.js:**
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Navbar Theme', () => {
  let cssUri;

  beforeAll(async ({ firefox }) => {
    // Load the navbar CSS
    const cssContent = readFileSync(join(process.cwd(), 'src/navbar.css'), 'utf-8');
    
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      
      const css = arguments[0];
      const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
      
      if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      }
      
      return { uri: uri.spec };
    `, [cssContent]);

    cssUri = result.uri;
  });

  afterAll(async ({ firefox }) => {
    // Clean up
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

  it('should register the navbar CSS', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      const uri = Services.io.newURI(arguments[0]);
      
      return { isRegistered: sss.sheetRegistered(uri, sss.USER_SHEET) };
    `, [cssUri]);

    expect(result.isRegistered).toBe(true);
  });

  it('should apply gradient background to navbar', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const navbar = window.document.querySelector("#nav-bar");
      const style = window.getComputedStyle(navbar);
      
      return {
        hasNavbar: !!navbar,
        background: style.background,
        backgroundImage: style.backgroundImage,
      };
    `);

    expect(result.hasNavbar).toBe(true);
    expect(result.backgroundImage).toContain('gradient');
  });

  it('should style the URL bar', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const urlbar = window.document.querySelector("#urlbar");
      const style = window.getComputedStyle(urlbar);
      
      return {
        hasUrlbar: !!urlbar,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
      };
    `);

    expect(result.hasUrlbar).toBe(true);
    expect(result.borderRadius).toBe('8px');
  });

  it('should capture navbar screenshot for visual regression', async ({ firefox }) => {
    const screenshot = await firefox.screenshot('#nav-bar');
    
    expect(screenshot.dataURL).toBeTruthy();
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
    
    // In production, compare with baseline:
    // await compareWithBaseline(screenshot, 'navbar-baseline.png');
  });
});
```

**tests/vitest/tabs.firefox.test.js:**
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tabs Theme', () => {
  let cssUri;

  beforeAll(async ({ firefox }) => {
    const cssContent = readFileSync(join(process.cwd(), 'src/tabs.css'), 'utf-8');
    
    const result = await firefox.executeScript(`
      const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
      
      const css = arguments[0];
      const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
      
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
      return { uri: uri.spec };
    `, [cssContent]);

    cssUri = result.uri;
  });

  afterAll(async ({ firefox }) => {
    if (cssUri) {
      await firefox.executeScript(`
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
          .getService(Ci.nsIStyleSheetService);
        const uri = Services.io.newURI(arguments[0]);
        sss.unregisterSheet(uri, sss.USER_SHEET);
      `, [cssUri]);
    }
  });

  it('should style tab borders', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const tab = window.document.querySelector(".tabbrowser-tab");
      
      if (!tab) {
        throw new Error("No tab found");
      }
      
      const style = window.getComputedStyle(tab);
      
      return {
        borderRadius: style.borderRadius,
        margin: style.margin,
      };
    `);

    expect(result.borderRadius).toContain('8px');
  });

  it('should apply gradient to selected tab', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const selectedTab = window.document.querySelector(".tabbrowser-tab[selected]");
      
      if (!selectedTab) {
        throw new Error("No selected tab found");
      }
      
      const style = window.getComputedStyle(selectedTab);
      
      return {
        hasSelectedTab: true,
        background: style.background,
        backgroundImage: style.backgroundImage,
      };
    `);

    expect(result.hasSelectedTab).toBe(true);
    expect(result.backgroundImage).toContain('gradient');
  });

  it('should capture tab bar screenshot', async ({ firefox }) => {
    const screenshot = await firefox.screenshot('.tabbrowser-tabs');
    
    expect(screenshot.dataURL).toBeTruthy();
  });
});
```

## Step 5: Run Tests

```bash
# Start Firefox with marionette enabled first
# Set marionette.port=2828 in about:config

# Run all tests
npx vitest

# Run in watch mode during development
npx vitest --watch

# Run specific test file
npx vitest tests/vitest/navbar.firefox.test.js
```

## Step 6: Visual Regression Testing (Advanced)

For automated visual regression testing, integrate with a comparison library:

```bash
npm install pixelmatch pngjs --save-dev
```

**tests/helpers/screenshot-compare.js:**
```javascript
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function compareScreenshot(screenshot, baselineName) {
  const baselinePath = join(process.cwd(), 'tests/baselines', baselineName);
  const currentBuffer = Buffer.from(
    screenshot.dataURL.replace(/^data:image\/png;base64,/, ''),
    'base64'
  );
  
  // If baseline doesn't exist, create it
  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, currentBuffer);
    return { isNew: true, difference: 0 };
  }
  
  // Compare with baseline
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const current = PNG.sync.read(currentBuffer);
  
  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  
  const numDiffPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );
  
  const diffPercentage = (numDiffPixels / (width * height)) * 100;
  
  // Save diff image if there are differences
  if (numDiffPixels > 0) {
    const diffPath = join(process.cwd(), 'tests/diffs', baselineName);
    writeFileSync(diffPath, PNG.sync.write(diff));
  }
  
  return {
    isNew: false,
    difference: diffPercentage,
    numDiffPixels,
  };
}
```

Update your tests to use the comparison:

```javascript
import { compareScreenshot } from '../helpers/screenshot-compare.js';

it('should match navbar baseline', async ({ firefox }) => {
  const screenshot = await firefox.screenshot('#nav-bar');
  const result = await compareScreenshot(screenshot, 'navbar.png');
  
  // Allow up to 2% difference (for anti-aliasing, etc.)
  expect(result.difference).toBeLessThan(2);
});
```

## Benefits

1. **Automated Testing**: No more manual verification of CSS changes
2. **Regression Detection**: Catch unintended visual changes immediately
3. **CI/CD Integration**: Run tests in your pipeline
4. **Documentation**: Tests serve as documentation of intended behavior
5. **Confidence**: Refactor with confidence knowing tests will catch issues

## Continuous Integration

Add to your GitHub Actions workflow:

```yaml
name: Theme Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Firefox
        run: |
          sudo apt-get update
          sudo apt-get install -y firefox
      
      - name: Start Firefox with Marionette
        run: |
          firefox --marionette --headless &
          sleep 5
      
      - name: Run tests
        run: npm test
```

## Next Steps

1. Add more tests for edge cases
2. Set up visual regression baselines
3. Configure CI/CD pipeline
4. Document your theme's features through tests
5. Share your testing setup with the community
