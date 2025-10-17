# Quick Start Guide: Chrome Manifest Registration

## Prerequisites

1. Firefox with Marionette enabled:
   - Open `about:config` in Firefox
   - Set `marionette.port` to `2828`
   - Restart Firefox

   OR start Firefox from command line:
   ```bash
   firefox --marionette --marionette-port 2828
   ```

2. Build the tool:
   ```bash
   cd /home/runner/work/mus-uc-devtools/mus-uc-devtools
   cargo build --release
   ```

## Quick Test with Demo

The `examples/demo/` directory contains a complete working example.

### Step 1: Navigate to the demo directory

```bash
cd examples/demo
```

### Step 2: Register the chrome.manifest

```bash
../../target/release/chrome-css register-manifest -m $(pwd)/chrome.manifest
```

Expected output:
```
chrome.manifest registered: /absolute/path/to/examples/demo/chrome.manifest
```

### Step 3: Load the main CSS file

```bash
../../target/release/chrome-css load -f main.css -i demo-theme
```

Expected output:
```
CSS loaded with ID: demo-theme
```

### Step 4: Verify it's loaded

```bash
../../target/release/chrome-css list
```

Expected output:
```
Loaded stylesheets:
  - demo-theme
```

### Step 5: Check Firefox

The CSS should now be applied to Firefox:
- Navigation bar should have a dark background (from `themes/dark-theme.css`)
- Any matching elements will have the styles from `components/buttons.css` and `components/tabs.css`

### Step 6: Make changes and reload

Edit any of the CSS files (e.g., `themes/dark-theme.css`), then:

```bash
../../target/release/chrome-css unload demo-theme
../../target/release/chrome-css load -f main.css -i demo-theme
```

The changes should be immediately visible in Firefox!

## What's Happening Behind the Scenes

1. **chrome.manifest registration** maps URI namespaces to directories:
   ```
   content mus-uc ./
   content mus-uc-components ./components/
   content mus-uc-themes ./themes/
   ```

2. **main.css** uses these URIs to import other CSS files:
   ```css
   @import 'chrome://mus-uc-components/content/buttons.css';
   @import 'chrome://mus-uc-themes/content/dark-theme.css';
   ```

3. **Firefox resolves** the chrome:// URIs using the registered manifest:
   - `chrome://mus-uc-components/content/buttons.css` → `./components/buttons.css`
   - `chrome://mus-uc-themes/content/dark-theme.css` → `./themes/dark-theme.css`

## Creating Your Own Setup

1. Create a directory for your Firefox customization:
   ```bash
   mkdir my-firefox-theme
   cd my-firefox-theme
   ```

2. Create a `chrome.manifest`:
   ```
   content my-theme ./
   ```

3. Create your CSS files:
   ```bash
   echo "#nav-bar { background: red !important; }" > style.css
   ```

4. Register and load:
   ```bash
   chrome-css register-manifest -m $(pwd)/chrome.manifest
   chrome-css load -f style.css -i my-theme
   ```

## Troubleshooting

**"Failed to connect" error:**
- Ensure Firefox is running
- Check that Marionette is enabled on port 2828
- Try `netstat -an | grep 2828` to verify the port is listening

**"chrome.manifest file not found" error:**
- Use absolute paths or `$(pwd)/chrome.manifest`
- Verify the file exists: `ls -la chrome.manifest`

**CSS not applying:**
- Check that the manifest was registered successfully
- Verify the chrome:// URIs in your CSS match the namespaces in chrome.manifest
- Use Firefox DevTools to check for CSS errors

**Changes not visible:**
- Ensure you unloaded the old version before loading the new one
- Check that you're editing the correct files
- Try clearing all and reloading: `chrome-css clear && chrome-css load -f main.css`

## Advanced Usage

### Multiple Namespaces

```
content my-theme ./
content my-components ./components/
content my-utils ./utils/
skin my-skin classic/1.0 ./skins/
```

### Subdirectory Organization

```
my-firefox-theme/
├── chrome.manifest
├── main.css
├── components/
│   ├── navbar.css
│   ├── sidebar.css
│   └── tabs.css
├── themes/
│   ├── dark.css
│   └── light.css
└── utils/
    └── reset.css
```

### Using in CSS

```css
/* Import utilities */
@import 'chrome://my-utils/content/reset.css';

/* Import components */
@import 'chrome://my-components/content/navbar.css';
@import 'chrome://my-components/content/sidebar.css';

/* Import theme */
@import 'chrome://my-theme/content/themes/dark.css';
```

## Benefits Over Traditional Bundling

✅ **No build step**: Just edit and reload
✅ **Faster development**: Immediate feedback
✅ **Better debugging**: Files remain separate
✅ **Modular**: Organize by feature/component
✅ **Standard**: Uses Firefox's native mechanism

## Next Steps

- Read the [Chrome Manifest Guide](CHROME_MANIFEST_GUIDE.md) for detailed information
- Explore the [demo directory](demo/) for a complete example
- Check the [Implementation Summary](../CHROME_MANIFEST_IMPLEMENTATION.md) for technical details
