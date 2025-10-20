# Chrome Manifest Registration

## Overview

Register a `chrome.manifest` file with Firefox to enable `chrome://` URIs in CSS `@import` statements.

## Setup

### 1. Create chrome.manifest

```
content mus-uc ./
content mus-uc-components ./components/
content mus-uc-themes ./themes/
```

### 2. Register

```bash
mus-uc-devtools register-manifest -m /path/to/chrome.manifest
```

### 3. Use in CSS

```css
@import 'chrome://mus-uc-components/content/buttons.css';
@import 'chrome://mus-uc-themes/content/dark-theme.css';
```

## Implementation

Uses Firefox's ComponentRegistrar API to register manifest:

```javascript
let cmanifest = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
cmanifest.initWithPath(absolutePath);
let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
registrar.autoRegister(cmanifest);
```

## Benefits

- No bundling required
- Direct file loading from filesystem
- Modular development
- Native Firefox mechanism
