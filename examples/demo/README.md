# Demo: Chrome Manifest Registration

This directory contains a complete demo of the chrome.manifest registration feature.

## Directory Structure

```
demo/
├── chrome.manifest      # Chrome manifest file that maps URIs to directories
├── main.css            # Main CSS file with chrome:// imports
├── components/         # Component CSS files
│   ├── buttons.css
│   └── tabs.css
└── themes/            # Theme CSS files
    └── dark-theme.css
```

## How to Use

### 1. Start Firefox with Marionette enabled

First, ensure Firefox is running with Marionette enabled on port 2828:

```bash
# In about:config
marionette.port = 2828
```

Or start Firefox from command line:

```bash
firefox --marionette --marionette-port 2828
```

### 2. Register the chrome.manifest

From the repository root:

```bash
cargo build --release
./target/release/chrome-css register-manifest -m examples/demo/chrome.manifest
```

You should see output like:
```
chrome.manifest registered: /absolute/path/to/examples/demo/chrome.manifest
```

### 3. Load the main CSS file

```bash
./target/release/chrome-css load -f examples/demo/main.css -i demo-theme
```

### 4. Verify it's loaded

```bash
./target/release/chrome-css list
```

You should see:
```
Loaded stylesheets:
  - demo-theme
```

### 5. Make changes and reload

Edit any of the component CSS files (e.g., `components/buttons.css`) and reload:

```bash
./target/release/chrome-css unload demo-theme
./target/release/chrome-css load -f examples/demo/main.css -i demo-theme
```

## What's Happening

1. **chrome.manifest registration**: The manifest file maps URI namespaces to filesystem directories:
   - `chrome://mus-uc/content/` → `./`
   - `chrome://mus-uc-components/content/` → `./components/`
   - `chrome://mus-uc-themes/content/` → `./themes/`

2. **CSS imports**: The `main.css` file uses these chrome:// URIs to import other CSS files:
   ```css
   @import 'chrome://mus-uc-components/content/buttons.css';
   ```

3. **No bundling required**: Changes to component files are immediately available - just reload the main CSS.

## Benefits

- **Modular development**: Organize CSS into logical components
- **No build step**: Direct file loading from filesystem
- **Easy debugging**: CSS files remain separate and identifiable
- **Fast iteration**: Just reload, no bundling needed

## Troubleshooting

**"chrome.manifest file not found" error:**
- Ensure you're providing the correct path to the manifest file
- The path can be relative or absolute

**Imports not working:**
- Verify the chrome.manifest was registered successfully
- Check that the chrome:// URIs in main.css match the namespaces in chrome.manifest
- Ensure all CSS files exist in the correct directories

**Firefox not responding:**
- Ensure Firefox is running with Marionette enabled
- Check that Marionette is listening on port 2828
- Verify no firewall is blocking the connection
