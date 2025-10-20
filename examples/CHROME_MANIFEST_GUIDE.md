# Chrome Manifest Registration Guide

## Overview

Instead of bundling CSS files, this tool supports registering a `chrome.manifest` file with Firefox. This enables the use of `chrome://` URIs in CSS `@import` statements, allowing for modular CSS development without bundling.

## How It Works

1. **chrome.manifest Registration**: The tool uses Firefox's ComponentRegistrar to register a `chrome.manifest` file
2. **URI Mapping**: The manifest maps namespace URIs (like `mus-uc`) to filesystem directories
3. **CSS Imports**: CSS files can then use `@import 'chrome://mus-uc/content/path/to/file.css'` to load other files

## Setup

### 1. Create chrome.manifest

Create a `chrome.manifest` file in your development directory:

```
# chrome.manifest
content mus-uc ./
content mus-uc-components ./components/
content mus-uc-themes ./themes/
```

### 2. Register the Manifest

```bash
mus-uc register-manifest -m /absolute/path/to/chrome.manifest
```

### 3. Use chrome:// URIs in CSS

**Main CSS file (main.css):**
```css
/* Import component styles using chrome:// URIs */
@import 'chrome://mus-uc-components/content/buttons.css';
@import 'chrome://mus-uc-components/content/tabs.css';
@import 'chrome://mus-uc-themes/content/dark-theme.css';

/* Your custom styles */
#nav-bar {
    background: linear-gradient(to bottom, #2c3e50, #34495e) !important;
}
```

### 4. Load the Main CSS

```bash
mus-uc load -f main.css -i my-custom-theme
```

## chrome.manifest Format

The chrome.manifest file uses a simple line-based format:

```
# Format: <type> <namespace> <path>

# Content registration (most common)
content mus-uc ./
content mus-uc-lib ./lib/

# Skin registration (for themes)
skin mus-uc-skin classic/1.0 ./skins/

# Locale registration (for internationalization)
locale mus-uc en-US ./locale/en-US/
```

### Key Points:

- **Paths are relative** to the chrome.manifest file location
- **content** type is used for general resources (CSS, JS, etc.)
- **skin** type is used for theme resources
- The namespace (e.g., `mus-uc`) becomes part of the chrome:// URI

## Complete Example

**Directory structure:**
```
my-firefox-customization/
├── chrome.manifest
├── main.css
├── components/
│   ├── buttons.css
│   ├── tabs.css
│   └── urlbar.css
└── themes/
    ├── dark-theme.css
    └── light-theme.css
```

**chrome.manifest:**
```
content mus-uc ./
content mus-uc-components ./components/
content mus-uc-themes ./themes/
```

**main.css:**
```css
@import 'chrome://mus-uc-components/content/buttons.css';
@import 'chrome://mus-uc-components/content/tabs.css';
@import 'chrome://mus-uc-themes/content/dark-theme.css';
```

**Register and load:**
```bash
# Register the manifest (one-time setup)
mus-uc register-manifest -m /absolute/path/to/my-firefox-customization/chrome.manifest

# Load the main CSS
mus-uc load -f main.css -i my-theme

# Later, reload if you make changes
mus-uc unload my-theme
mus-uc load -f main.css -i my-theme
```

## Benefits Over Bundling

1. **No build step required** - direct file loading from filesystem
2. **Easier debugging** - CSS files remain separate and identifiable
3. **Faster iteration** - just reload, no bundling needed
4. **Standard Firefox mechanism** - uses the same system Firefox uses internally
5. **Modular development** - organize CSS into logical components

## Technical Details

The registration is done using Firefox's XPCOM API:

```javascript
// Create nsIFile instance
let cmanifest = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
cmanifest.initWithPath('/absolute/path/to/chrome.manifest');

// Register using ComponentRegistrar
let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
registrar.autoRegister(cmanifest);
```

This provides immediate registration of the chrome.manifest, making the URIs available for use in CSS imports.

## Troubleshooting

**Import not working?**
- Ensure the chrome.manifest is registered successfully
- Check that paths in chrome.manifest are correct (relative to manifest location)
- Verify the chrome:// URI format: `chrome://<namespace>/content/<path>`

**Registration fails?**
- Provide absolute path to chrome.manifest
- Ensure Firefox has read permissions for the manifest and CSS files
- Check that marionette is enabled (port 2828)

## References

- [nsIFile Documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile)
- [Chrome Registration](https://developer.mozilla.org/en-US/docs/Mozilla/Chrome_Registration)
- [nsIComponentRegistrar](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIComponentRegistrar)
