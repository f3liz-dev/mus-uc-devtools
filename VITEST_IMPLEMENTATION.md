# Vitest v4 Integration - Implementation Summary

## Overview

Custom Vitest v4 pool that runs tests **inside** Firefox chrome context, inspired by `@cloudflare/vitest-pool-workers`.

## Key Innovation

**Tests execute directly in Firefox** with native API access, not via RPC.

### Before (RPC-based approach)
```javascript
it('test', async ({ firefox }) => {
  const result = await firefox.executeScript(`
    return Services.appinfo.version;
  `);
  expect(result).toBeTruthy();
});
```

### After (Direct execution)
```javascript
it('test', () => {
  const version = Services.appinfo.version;  // Direct access!
  expect(version).toBeTruthy();
});
```

## Architecture

```
┌──────────────┐    Marionette     ┌────────────────────┐
│   Vitest     │ ←────(2828)────→ │  Firefox Chrome    │
│  (Node.js)   │                   │    Context         │
└──────────────┘                   │                    │
                                    │  Tests run HERE    │
                                    │  - Services.*      │
                                    │  - Components.*    │
                                    │  - Direct DOM      │
                                    └────────────────────┘
```

## What Was Built

### Core Implementation

1. **firefox-pool.js** - Custom Vitest pool
   - Connects to Firefox via Marionette (port 2828)
   - Injects test code into Firefox chrome context
   - Provides Vitest APIs (describe, it, expect)
   - Provides Firefox helper (firefox.screenshot)
   - Reports results back to Vitest

2. **vitest.config.js** - Configuration
   - Single pool setup (Firefox only)
   - Simple configuration
   - Test file patterns

### Example Tests

1. **chrome-context.test.js** - Firefox API access
2. **visual-regression.test.js** - Screenshot testing
3. **userchrome-css.test.js** - CSS testing with lifecycle

### Documentation

1. **vitest-pool/README.md** - Pool architecture & usage
2. **docs/vitest-integration.md** - Comprehensive guide

## How It Works

### Test Execution Flow

1. Vitest finds test files
2. Pool connects to Firefox via Marionette
3. Test file is read
4. Code is wrapped with Vitest globals
5. Wrapped code is executed in Firefox chrome context
6. Results are collected and reported back

### Code Wrapping

The pool wraps your test code like this:

```javascript
// Vitest globals injected
const describe = (name, fn) => { /* ... */ };
const it = (name, fn) => { /* ... */ };
const expect = (actual) => ({ /* ... */ });

// Firefox helper injected
const firefox = {
  screenshot: (selector) => { /* ... */ }
};

// Your test code here
import { describe, it, expect } from 'vitest';

describe('My Test', () => {
  it('works', () => {
    expect(Services.appinfo.version).toBeTruthy();
  });
});
```

## Benefits

1. **Direct API Access**: No RPC overhead or wrapper functions
2. **Native Performance**: Tests run at native Firefox speed
3. **Full Chrome Context**: Access to everything Firefox has
4. **Simpler Tests**: Write Firefox code directly
5. **Better Integration**: Tests feel like normal Vitest tests

## Limitations

1. **Sequential Execution**: One test file at a time
2. **Limited Lifecycle**: beforeAll/afterAll not fully supported
3. **Error Reporting**: Stack traces less detailed than Node.js
4. **Firefox Required**: Must have Firefox running with Marionette

## Design Decisions

### Why Run Tests Inside Firefox?

- Maximum fidelity - tests run in actual environment
- No protocol overhead or serialization issues
- Direct access to all Firefox internals
- Matches how @cloudflare/vitest-pool-workers works

### Why Remove Chrome/Node Tests?

- Project focuses on Firefox userChrome development
- Simplified architecture and maintenance
- Clearer purpose and documentation
- User feedback requested Firefox-only focus

### Why This Approach vs RPC?

**RPC Approach:**
- ❌ Overhead from protocol communication
- ❌ Serialization/deserialization costs
- ❌ Complex context passing
- ❌ Need wrapper functions

**Direct Execution:**
- ✅ Native speed
- ✅ Direct API access
- ✅ Simpler test code
- ✅ Better developer experience

## Technical Details

### Marionette Client

- Connects to Firefox on port 2828
- Implements WebDriver protocol subset
- Handles session management
- Executes commands in chrome context

### Test Wrapper

- Provides Vitest APIs (describe, it, expect)
- Injects firefox.screenshot() helper
- Collects test results
- Handles errors and timeouts

### Result Reporting

- Tests report pass/fail status
- Errors include messages and names
- Results sent back via Marionette
- Vitest displays standard output

## Future Enhancements

### Short Term
- Better lifecycle hook support (beforeAll/afterAll)
- Improved error stack traces
- Parallel test execution (multiple Firefox profiles)

### Medium Term
- Test coverage for chrome context code
- Visual regression baseline management
- Better async test support

### Long Term
- Auto-start/stop Firefox
- Integration with visual diffing tools
- CI/CD templates
- Browser extension testing

## Usage

```bash
# Run tests
npm run test:vitest

# Watch mode
npm run test:vitest:watch
```

## Example Test

```javascript
import { describe, it, expect } from 'vitest';

describe('Firefox Chrome Context', () => {
  it('accesses Services directly', () => {
    const version = Services.appinfo.version;
    expect(version).toBeTruthy();
  });
  
  it('takes screenshots', () => {
    const screenshot = firefox.screenshot('#nav-bar');
    expect(screenshot.dataURL).toMatch(/^data:image\/png;base64,/);
  });
  
  it('loads CSS', () => {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    
    const css = "#nav-bar { background: red !important; }";
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
    
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    expect(sss.sheetRegistered(uri, sss.USER_SHEET)).toBe(true);
    
    sss.unregisterSheet(uri, sss.USER_SHEET);
  });
});
```

## Comparison with Inspiration

| Feature | @cloudflare/vitest-pool-workers | This Integration |
|---------|--------------------------------|------------------|
| Runtime | Miniflare (Workers) | Firefox (Chrome Context) |
| Test Location | Inside Worker | Inside Firefox |
| Access To | Worker APIs, KV, D1 | Services, XPCOM, Components |
| Protocol | Internal (Miniflare) | Marionette |
| Use Case | Worker development | userChrome CSS testing |
| Principle | ✅ Same: Run tests in actual runtime |

Both implementations follow the same core principle: **run tests in the actual runtime environment** for maximum testing fidelity.

## Security

- ✅ CodeQL scan: 0 alerts
- ✅ No security vulnerabilities
- ✅ Marionette connects to localhost only
- ✅ No external network access from pool
- ✅ Uses official Firefox APIs

## Conclusion

This implementation provides a modern, efficient way to test Firefox chrome context features using Vitest v4. By running tests directly inside Firefox, it eliminates RPC overhead and provides the best possible developer experience for userChrome CSS development.

The design is inspired by proven patterns from @cloudflare/vitest-pool-workers and adapted specifically for Firefox's unique requirements and APIs.
