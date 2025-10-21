# Vitest Integration

Tests run **directly inside** Firefox's chrome context with native API access.

## Setup

1. Firefox must be running with `marionette.port=2828` in `about:config`
2. Run tests: `npm run test:vitest`

## Writing Tests

```javascript
import { describe, it, expect } from 'vitest';

describe('My Test', () => {
  it('accesses Firefox APIs directly', () => {
    const version = Services.appinfo.version;
    expect(version).toBeTruthy();
  });
});
```

## Available APIs

**Firefox APIs:** `Services.*`, `Components.*`, `Cc`, `Ci`, `Cu`  
**Vitest:** `describe()`, `it()`, `expect()`  
**Helper:** `firefox.screenshot(selector?)`

## Examples

### Testing userChrome CSS

```javascript
it('loads CSS', () => {
  const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);
  const css = "#nav-bar { background: red !important; }";
  const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
  
  sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
  expect(sss.sheetRegistered(uri, sss.USER_SHEET)).toBe(true);
  sss.unregisterSheet(uri, sss.USER_SHEET);
});
```

### Visual Regression

```javascript
it('captures screenshot', () => {
  const screenshot = firefox.screenshot('#nav-bar');
  expect(screenshot.dataURL).toBeTruthy();
  expect(screenshot.width).toBeGreaterThan(0);
});
```

## Troubleshooting

**"Could not connect"**: Ensure Firefox is running with `marionette.port=2828`  
**"Services is not defined"**: Check pool configuration in vitest.config.js  
**Screenshots fail**: Firefox window must be visible (not minimized)
