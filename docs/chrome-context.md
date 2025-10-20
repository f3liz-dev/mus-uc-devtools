# Chrome Context

## Overview

Firefox Marionette protocol supports two context types:
- **content**: Regular web page context (default)
- **chrome**: Privileged browser context with XPCOM access

## Setting Context

Use `Marionette:SetContext` command to switch context:

```json
{
  "name": "Marionette:SetContext",
  "parameters": {
    "value": "chrome"
  }
}
```

## Capabilities

Chrome context provides access to:
- XPCOM components via `Cc`/`Ci` globals
- Firefox Services API
- Chrome URIs (`chrome://`)
- nsIStyleSheetService for userChrome CSS

## Example

```javascript
const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
const uri = Services.io.newURI("data:text/css;charset=utf-8,...");
sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
```

## References

- [Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/Protocol.html)
- [XPCOM Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM)
