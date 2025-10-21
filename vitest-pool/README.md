# Vitest Integration for mus-uc-devtools

This directory contains a custom Vitest v4 pool that enables testing Firefox chrome context features, visual regression testing, and browser automation.

## Features

- **Firefox Chrome Context Testing**: Run tests that access Firefox internals, XPCOM components, and chrome-privileged APIs
- **Visual Regression Testing**: Capture screenshots of browser UI elements for visual comparison
- **Custom Pool Architecture**: Integrates with Vitest v4's pool system for seamless test execution
- **Dual Environment Support**: Run both Firefox-specific tests and standard Node.js tests in the same project

## Architecture

### Custom Pool (`firefox-pool.js`)

The custom pool implements Vitest v4's pool interface and:
- Connects to Firefox via the Marionette protocol (port 2828)
- Switches to chrome context for privileged access
- Provides a test context with `firefox` utilities:
  - `executeScript(script, args)`: Execute JavaScript in Firefox's chrome context
  - `screenshot(selector?)`: Capture screenshots of the entire window or specific elements

### Configuration (`vitest.config.js`)

The configuration defines two test projects:
1. **firefox-chrome-context**: Runs `*.firefox.test.js` files using the custom Firefox pool
2. **node-tests**: Runs `*.node.test.js` files using the standard threads pool

## Prerequisites

1. Firefox must be running with Marionette enabled
2. Set `marionette.port` to `2828` in Firefox's `about:config`
3. Alternatively, start Firefox with `--marionette` flag

## Usage

### Running Tests

```bash
# Run all tests (both Firefox and Node.js)
npx vitest

# Run only Firefox tests
npx vitest --project firefox-chrome-context

# Run only Node.js tests
npx vitest --project node-tests

# Watch mode
npx vitest --watch
```

### Writing Firefox Tests

Create a test file with `.firefox.test.js` extension:

```javascript
import { describe, it, expect } from 'vitest';

describe('My Firefox Test', () => {
  it('should access Firefox APIs', async ({ firefox }) => {
    const result = await firefox.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      return { userAgent: window.navigator.userAgent };
    `);
    
    expect(result.userAgent).toContain('Firefox');
  });

  it('should take screenshots', async ({ firefox }) => {
    const screenshot = await firefox.screenshot('#nav-bar');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
  });
});
```

### Writing Visual Regression Tests

The `screenshot` function can be used for visual regression testing:

```javascript
import { describe, it, expect } from 'vitest';

describe('Visual Regression', () => {
  it('should match navbar appearance', async ({ firefox }) => {
    // Capture current state
    const screenshot = await firefox.screenshot('#nav-bar');
    
    // Compare with baseline (integrate with visual regression library)
    // e.g., await expect(screenshot.dataURL).toMatchImageSnapshot();
    
    expect(screenshot).toHaveProperty('dataURL');
  });
});
```

## Example Tests

- `chrome-context.firefox.test.js`: Demonstrates accessing Firefox Services API and DOM
- `visual-regression.firefox.test.js`: Shows screenshot capture and visual testing patterns
- `basic.node.test.js`: Standard Node.js tests for comparison

## Integration with Vitest v4

This custom pool follows Vitest v4's pool interface:

```javascript
module.exports = async (vitest, options) => {
  return {
    name: 'firefox-pool',
    async runTests(specs) { /* ... */ },
    async collectTests() { /* ... */ },
    async close() { /* ... */ },
  };
};
```

The pool:
- Accepts test specifications from Vitest
- Manages Firefox connections via Marionette
- Reports test results back to Vitest
- Provides cleanup on shutdown

## Browser Support

Currently supports Firefox via Marionette protocol. Chrome/Chromium support could be added by:
1. Implementing Chrome DevTools Protocol client
2. Creating a `chrome-pool.js` with similar interface
3. Adding a new project configuration in `vitest.config.js`

## Troubleshooting

### "Could not connect to Firefox with Marionette"

- Ensure Firefox is running
- Check that `marionette.port` is set to `2828` in `about:config`
- Verify no firewall is blocking port 2828

### Tests timing out

- Increase `testTimeout` in `vitest.config.js`
- Check Firefox console for errors
- Verify your test scripts are valid Firefox chrome context code

## Future Enhancements

- [ ] Implement `collectTests` for better test discovery
- [ ] Add Chrome/Chromium support via DevTools Protocol  
- [ ] Integration with visual regression libraries (e.g., pixelmatch, playwright-screenshot)
- [ ] Parallel test execution support
- [ ] Browser instance management (auto-start/stop)
- [ ] Code coverage for chrome context code
- [ ] Screenshot comparison utilities
