# Vitest Integration Tests

Integration tests run directly inside Firefox's chrome context with native XPCOM API access.

## Test Cases (`tests/vitest/integration.test.js`)

1. **CSS with multiple style rules** - Tests loading, registration, cleanup
2. **Multiple CSS sheets** - Verifies simultaneous sheet handling
3. **Computed styles** - Validates CSS application via DOM
4. **Media queries** - Tests responsive CSS and dark mode
5. **Custom properties** - Tests CSS variables with var()
6. **CSS unloading** - Tests complete lifecycle
7. **Services API** - Validates Services, Cc, Ci access
8. **Screenshots** - Captures before/after CSS changes

## Running Tests

```bash
# Local (requires Firefox with marionette.port=2828)
npm run test:vitest

# Watch mode
npm run test:vitest:watch
```

CI workflow (`.github/workflows/vitest.yml`) auto-starts Firefox and runs tests.

## Architecture

```
Vitest (Node.js) → Marionette Protocol (port 2828) → Firefox Chrome Context
                                                      └─ Tests run here
                                                      └─ Direct XPCOM access
```

## Existing Tests

- `chrome-context.test.js` - Chrome context APIs
- `userchrome-css.test.js` - userChrome CSS features
- `visual-regression.test.js` - Visual comparisons
- `tests/headless-test.js` - Headless Firefox test

All run with direct Services/XPCOM access, no RPC wrappers needed.

