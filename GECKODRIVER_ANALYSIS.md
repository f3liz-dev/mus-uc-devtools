# Geckodriver Analysis - Chrome-Privileged Context

## Overview

This document summarizes findings from analyzing the Mozilla geckodriver release branch regarding how to execute scripts in chrome-privileged JavaScript contexts.

## Key Findings

### 1. Context Types

Firefox Marionette protocol supports two context types:
- **`content`**: Regular web page context (default)
- **`chrome`**: Privileged browser context with access to XPCOM components

### 2. Setting Chrome Context

To execute scripts with chrome privileges, you must first set the context using the `Marionette:SetContext` command:

```rust
// From geckodriver/src/command.rs
pub enum GeckoContext {
    Content,
    Chrome,
}

pub struct GeckoContextParameters {
    pub context: GeckoContext,
}
```

The command is sent as:
```json
{
  "name": "Marionette:SetContext",
  "parameters": {
    "value": "chrome"
  }
}
```

### 3. Chrome Context Capabilities

When in chrome context, scripts have access to:
- **XPCOM components** via `Components` or `Cc`/`Ci` globals
- **Services** - Firefox internal services
- **Chrome URIs** - `chrome://` protocol for browser internals
- **Privileged APIs** - nsIStyleSheetService, etc.

### 4. Protocol Communication

The Marionette protocol (version 3) uses a simple text-based format:
- Messages are prefixed with length: `LENGTH:JSON`
- Each message is terminated with a newline
- Handshake is received upon connection with protocol version

### 5. Implementation Details

From geckodriver source (`src/marionette.rs`):
- Connection is established via TCP (default port 2828)
- Handshake validates protocol version and application type
- Commands are sent as JSON with unique message IDs
- Responses include the same message ID for correlation

### 6. Example Chrome Context Script

```javascript
// This script accesses XPCOM to manipulate stylesheets
const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
const uri = Services.io.newURI("data:text/css;charset=utf-8,...");
sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
```

## Implementation in mus-uc-devtools

Based on these findings, the implementation:

1. **Created custom Marionette client** (`marionette_client.rs`)
   - The `marionette` crate v0.7.0 only provides protocol definitions
   - Implemented TCP connection handling
   - Implemented message serialization/deserialization
   - Added `set_context()` method for switching to chrome context

2. **Updated ChromeCSSManager**
   - Sets context to "chrome" during initialization
   - Can now access XPCOM components for style sheet manipulation
   - Executes JavaScript in privileged context

3. **Chrome Context Benefits**
   - Direct access to nsIStyleSheetService for CSS injection
   - More reliable than content-level DOM manipulation
   - Can affect browser UI, not just web pages

## References

- Mozilla Marionette Protocol: https://firefox-source-docs.mozilla.org/testing/marionette/Protocol.html
- Geckodriver Source: https://github.com/mozilla/geckodriver
- XPCOM Reference: https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM
