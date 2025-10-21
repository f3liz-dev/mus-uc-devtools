# Vitest Integration for mus-uc-devtools

This directory contains a custom Vitest v4 pool that runs tests **inside** Firefox's chrome context, inspired by `@cloudflare/vitest-pool-workers`.

## Key Concept

Unlike traditional browser testing tools that run tests in Node.js and communicate with the browser via RPC, this pool runs your test code **directly inside Firefox's chrome context**. This means:

- ✅ Direct access to `Services`, `Components`, `Ci`, `Cc` without wrappers
- ✅ Native XPCOM API access
- ✅ No `executeScript()` needed - just write Firefox code
- ✅ Familiar Vitest syntax (describe, it, expect)
- ✅ Tests execute in the actual Firefox runtime
- ✅ **Real ES6 imports** - use `import { describe, it, expect } from 'vitest'`
- ✅ **No mocking** - proper Vitest API implementation

## How It Works

1. **Bundling**: Test files are bundled with esbuild, resolving all imports
2. **Vitest Shim**: `import from 'vitest'` statements are replaced with global implementations
3. **Execution**: Bundled code is executed in Firefox chrome context via Marionette
4. **Collection**: Test results are collected and reported back to Vitest

This approach provides:
- Real import support (no more stripping imports!)
- Proper module resolution
- Access to all Firefox chrome APIs
- Familiar Vitest testing experience

## Architecture

```
┌─────────────────────────────────────────┐
│         Vitest Test Runner              │
│         (Node.js process)               │
│                                         │
│  1. Read test file                      │
│  2. Bundle with esbuild                 │
│     - Resolve all imports               │
│     - Inject Vitest globals             │
│  3. Send to Firefox                     │
└─────────────┬───────────────────────────┘
              │ Marionette Protocol
              │ (port 2828)
              ↓
┌─────────────────────────────────────────┐
│       Firefox Chrome Context            │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Your Bundled Test Code          │ │
│  │   - Uses real Vitest APIs         │ │
│  │   - Access Services directly      │ │
│  │   - Use Components directly       │ │
│  │   - Query DOM directly            │ │
│  │   - No RPC overhead               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Available globally:                    │
│  - Services, Components, Ci, Cc        │
│  - describe, it, expect (from bundle)  │
│  - firefox.screenshot()                │
└─────────────────────────────────────────┘
```

## Implementation Details

### Bundling Process

The pool uses esbuild to bundle test files:

1. **Vitest Shim Plugin**: Intercepts `import ... from 'vitest'` statements and redirects them to globalThis references
2. **Banner Injection**: Injects Vitest API implementations (`describe`, `it`, `expect`, etc.) as global functions
3. **Module Resolution**: All other imports are resolved and bundled normally
4. **IIFE Format**: Output is an immediately-invoked function expression suitable for Firefox's executeScript

### Vitest API Implementation

The pool provides a complete implementation of core Vitest APIs:
- `describe(name, fn)` - Test suites with nesting support
- `it(name, fn)` / `test(name, fn)` - Individual test cases
- `expect(value)` - Assertions with matchers (toBe, toEqual, toBeTruthy, toContain, etc.)
- `beforeAll(fn)` / `afterAll(fn)` - Suite-level hooks
- `beforeEach(fn)` / `afterEach(fn)` - Test-level hooks
- `firefox.screenshot(selector?)` - Firefox-specific screenshot helper

### Differences from Previous Implementation

**Before (v0.0.x)**:
- ❌ Stripped all import statements
- ❌ Manually mocked Vitest functions
- ❌ Limited expect matchers
- ❌ No proper module support

**Now (v0.1.x)**:
- ✅ Full ES6 import support via bundling
- ✅ Complete Vitest API implementation
- ✅ Extended expect matchers
- ✅ Proper module resolution
- ✅ Better error messages with stack traces

## Usage

### Prerequisites

1. Firefox must be running
2. Set `marionette.port` to `2828` in Firefox's `about:config`
3. Restart Firefox

### Running Tests

```bash
# Run all tests
npm run test:vitest

# Watch mode (recommended for development)
npm run test:vitest:watch
```

### Writing Tests

Create a test file in `tests/vitest/`:

```javascript
import { describe, it, expect } from 'vitest';

describe('My Firefox Test', () => {
  it('should access Firefox APIs directly', () => {
    // No need for firefox.executeScript() - you're already in Firefox!
    const window = Services.wm.getMostRecentWindow("navigator:browser");
    const version = Services.appinfo.version;
    
    expect(version).toBeTruthy();
    expect(window).toBeTruthy();
  });

  it('should take screenshots', () => {
    // Use the firefox helper for screenshots
    const screenshot = firefox.screenshot('#nav-bar');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
  });

  it('should load CSS directly', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const css = "#nav-bar { background: red !important; }";
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
    
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    
    expect(sss.sheetRegistered(uri, sss.USER_SHEET)).toBe(true);
    
    // Clean up
    sss.unregisterSheet(uri, sss.USER_SHEET);
  });
});
```

## Available APIs

### Global Firefox APIs

When your test runs, it has access to all Firefox chrome context APIs:

- `Services.*` - Firefox Services
- `Components.*` - XPCOM Components
- `Cc` - Components.classes shorthand
- `Ci` - Components.interfaces shorthand
- `Cu` - Components.utils shorthand

### Vitest APIs

- `describe(name, fn)` - Group tests
- `it(name, fn)` - Define a test
- `expect(value)` - Make assertions

### Helper APIs

- `firefox.screenshot(selector?)` - Capture screenshots
  - No selector: captures full window
  - With selector: captures specific element

## Differences from Traditional Testing

### Traditional Approach (Other Tools)
```javascript
// Tests run in Node.js, communicate with Firefox via RPC
it('should access Firefox', async ({ page }) => {
  const result = await page.evaluate(() => {
    return Services.appinfo.version;  // Executed remotely
  });
  expect(result).toBeTruthy();
});
```

### This Pool (Direct Execution)
```javascript
// Tests run INSIDE Firefox chrome context
it('should access Firefox', () => {
  const version = Services.appinfo.version;  // Direct access!
  expect(version).toBeTruthy();
});
```

## Limitations

- Tests run sequentially (one file at a time)
- Some advanced Vitest features may not be available (snapshots, mocking, etc.)
- Error stacks reference bundled code, not original source (no source maps yet)
- Requires Firefox to be running with Marionette enabled

## Troubleshooting

### "Could not connect to Firefox"
- Ensure Firefox is running
- Check that `marionette.port=2828` in about:config
- Verify no firewall is blocking port 2828
- Try restarting Firefox

### Tests failing with "Services is not defined"
- This means the test isn't running in Firefox chrome context
- Check that Firefox is connected via Marionette
- Verify the pool is configured correctly in vitest.config.js

### Screenshots not working
- Ensure Firefox window is visible (not minimized)
- Check that the element selector is correct
- Verify Firefox has permission to capture screenshots

## Comparison with @cloudflare/vitest-pool-workers

This pool is inspired by Cloudflare's workers pool but adapted for Firefox:

| Feature | @cloudflare/vitest-pool-workers | This Pool |
|---------|--------------------------------|-----------|
| Test Execution | Inside Cloudflare Worker | Inside Firefox Chrome Context |
| Runtime | Miniflare/Workerd | Firefox |
| Access To | Worker APIs, KV, D1 | Services, XPCOM, Components |
| Use Case | Worker development | userChrome CSS, Firefox extensions |
| Import Support | ✅ Full (via Vite) | ✅ Full (via esbuild) |
| Bundling | Vite/Rollup | esbuild |

Both use the same principle: **run tests in the actual runtime** for maximum fidelity, with proper module/import support.
