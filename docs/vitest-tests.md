# Vitest Integration Tests

This document describes the additional vitest integration tests added to the project.

## Test File: `tests/vitest/integration.test.js`

This file contains comprehensive integration tests that run directly inside Firefox's chrome context, testing the full workflow of CSS loading, manipulation, and verification.

### Test Cases

1. **Load and verify CSS with multiple style rules**
   - Tests loading CSS with multiple selectors (nav-bar, urlbar, tab-background)
   - Verifies CSS registration with nsIStyleSheetService
   - Ensures proper cleanup

2. **Handle multiple CSS sheets simultaneously**
   - Loads 3 different CSS sheets
   - Verifies all sheets are registered correctly
   - Tests that multiple sheets can coexist

3. **Verify CSS application through computed styles**
   - Queries DOM elements directly (nav-bar)
   - Reads computed styles using window.getComputedStyle()
   - Verifies styles are applied and visible

4. **Test CSS with media queries**
   - Tests responsive CSS with @media queries
   - Tests dark mode support with prefers-color-scheme
   - Verifies media query CSS registration

5. **Test CSS with custom properties**
   - Tests CSS custom properties (variables)
   - Uses var() function in CSS
   - Verifies custom property CSS registration

6. **Handle CSS unloading correctly**
   - Tests the complete lifecycle: load → verify → unload
   - Ensures sheets can be unregistered
   - Verifies unregistration is effective

7. **Verify Firefox Services API availability**
   - Tests Services object availability
   - Tests Components (Cc, Ci) availability
   - Verifies window manager access

8. **Take screenshots before and after CSS application**
   - Takes baseline screenshot
   - Applies CSS changes
   - Takes modified screenshot
   - Verifies screenshots differ

## Running the Tests

### Prerequisites

Firefox must be running with marionette enabled on port 2828:

```bash
# Set in about:config
marionette.port = 2828
```

### Local Testing

```bash
# Run all vitest tests
npm run test:vitest

# Watch mode for development
npm run test:vitest:watch
```

### CI/CD

The `.github/workflows/vitest.yml` workflow automatically:

1. Sets up Node.js and installs dependencies
2. Starts Firefox with marionette in headless mode
3. Runs all vitest tests
4. Cleans up Firefox process

## Test Coverage

The integration tests cover:

- ✅ CSS loading via nsIStyleSheetService
- ✅ Multiple CSS sheets
- ✅ Computed style verification
- ✅ Media queries
- ✅ CSS custom properties
- ✅ CSS unloading
- ✅ Firefox Services API
- ✅ Screenshot comparison

## Existing Tests

The project also includes:

1. **Existing vitest tests** (pre-existing):
   - `tests/vitest/chrome-context.test.js` - Chrome context API tests
   - `tests/vitest/userchrome-css.test.js` - userChrome CSS tests
   - `tests/vitest/visual-regression.test.js` - Visual regression tests

2. **Headless test** (pre-existing):
   - `tests/headless-test.js` - Comprehensive headless Firefox test

All tests run in Firefox's privileged chrome context with direct access to XPCOM APIs.

## Test Architecture

```
┌─────────────────────────────────────┐
│  Vitest Test Runner                 │
│  (Node.js process)                  │
└───────────┬─────────────────────────┘
            │
            │ Marionette Protocol
            │ (TCP port 2828)
            ↓
┌─────────────────────────────────────┐
│  Firefox (Headless)                 │
│  ┌───────────────────────────────┐  │
│  │  Chrome Context               │  │
│  │  - Test code runs HERE        │  │
│  │  - Direct Services access     │  │
│  │  - Direct XPCOM access        │  │
│  │  - No RPC wrappers needed     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Benefits

- **Native Testing**: Tests run directly in Firefox chrome context
- **No Wrappers**: No need for executeScript() wrappers
- **Fast**: Direct API access without RPC overhead
- **Comprehensive**: Full access to Firefox internals
- **Familiar**: Uses standard Vitest syntax

## Future Improvements

Potential areas for expansion:

- Add performance benchmarks
- Add more visual regression tests
- Test with different Firefox versions
- Test with different window sizes
- Add accessibility testing
