# Screenshot Feature

The screenshot feature enables capturing images of the Firefox browser window or specific UI elements using CSS selectors. This is particularly useful for CI/CD pipelines, visual regression testing, and documentation.

## Overview

The screenshot functionality uses Firefox's chrome context to access the `drawWindow` API, which allows capturing the actual browser UI (not just web page content). This makes it perfect for:

- **Visual Regression Testing**: Capture screenshots before and after CSS changes to verify the design
- **CI/CD Integration**: Automatically capture browser UI state in automated pipelines
- **Documentation**: Generate visual documentation of browser UI customizations
- **Design Verification**: Verify that userChrome CSS changes look as expected

## Basic Usage

### Full-Screen Screenshot

Capture the entire browser window:

```bash
./mus-uc screenshot -o screenshot.png
```

### Element-Specific Screenshot

Capture a specific element using CSS selectors:

```bash
# Capture navigation bar
./mus-uc screenshot -s "#nav-bar" -o navbar.png

# Capture any toolbar
./mus-uc screenshot -s "toolbar" -o toolbar.png

# Capture element by class
./mus-uc screenshot -s ".my-custom-element" -o element.png

# Capture complex selectors
./mus-uc screenshot -s "#TabsToolbar > .toolbar-items" -o tabs.png
```

## Command-Line Options

- `-o, --output <FILE>`: Specify output file path (default: `screenshot.png`)
- `-s, --selector <CSS_SELECTOR>`: CSS selector to capture a specific element (default: full screen)

## Implementation Details

The screenshot feature is implemented using the following Firefox APIs in chrome context:

```javascript
// Create a canvas element
let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
let window = Services.wm.getMostRecentWindow("navigator:browser");
let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

// Draw the window content to canvas
let ctx = canvas.getContext("2d");
ctx.drawWindow(window, 0, 0, width, height, "rgb(255,255,255)");

// Convert to data URL
let dataURL = canvas.toDataURL("image/png");
```

For element-specific screenshots, the feature:
1. Uses `querySelector` to find the element
2. Gets element dimensions using `getBoundingClientRect()`
3. Creates a canvas with those dimensions
4. Draws only the element region using `drawWindow` with element coordinates

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Visual Regression Testing

on: [push, pull_request]

jobs:
  screenshot-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Firefox
        run: |
          sudo apt-get update
          sudo apt-get install -y firefox
      
      - name: Build mus-uc
        run: cargo build --release
      
      - name: Run Firefox with marionette
        run: |
          firefox --marionette --headless &
          sleep 5
      
      - name: Capture screenshots
        run: |
          ./target/release/mus-uc screenshot -o before.png
          
      - name: Upload screenshots
        uses: actions/upload-artifact@v2
        with:
          name: screenshots
          path: "*.png"
```

### GitLab CI Example

```yaml
screenshot-test:
  image: rust:latest
  script:
    - apt-get update && apt-get install -y firefox
    - cargo build --release
    - firefox --marionette --headless &
    - sleep 5
    - ./target/release/mus-uc screenshot -o screenshot.png
  artifacts:
    paths:
      - "*.png"
```

## Use Cases

### 1. Before/After Comparison

Capture screenshots before and after applying CSS changes:

```bash
# Before changes
./mus-uc screenshot -o before.png

# Apply CSS
./mus-uc load -f my-changes.css

# After changes
./mus-uc screenshot -o after.png

# Compare using image diff tools
compare before.png after.png diff.png
```

### 2. Multi-Element Documentation

Generate documentation for multiple UI elements:

```bash
#!/bin/bash
elements=(
  "#nav-bar:navbar"
  "#TabsToolbar:tabs-toolbar"
  "#PersonalToolbar:bookmarks-bar"
  "menubar:menubar"
)

for element in "${elements[@]}"; do
  selector="${element%%:*}"
  name="${element##*:}"
  ./mus-uc screenshot -s "$selector" -o "docs/${name}.png"
done
```

### 3. Automated Testing

Create a test script that verifies UI elements exist and are visible:

```bash
#!/bin/bash
set -e

echo "Testing UI elements..."

# These should succeed if elements exist
./mus-uc screenshot -s "#nav-bar" -o /tmp/nav-test.png
./mus-uc screenshot -s "toolbar" -o /tmp/toolbar-test.png

echo "✓ All UI elements are present"
```

## Troubleshooting

### Element Not Found

If you get an error about an element not being found:

1. Verify the element exists using Firefox DevTools
2. Make sure you're using the correct CSS selector
3. Some elements may be dynamically created - try waiting a moment before capturing

### Empty/Black Screenshots

If screenshots are empty or black:

1. Ensure Firefox is running with `--remote-allow-system-access` flag
2. Check that marionette is enabled on port 2828
3. Verify the browser window is actually visible (not minimized)

### Headless Mode

Screenshots work in headless mode, but some UI elements may not be visible or may have different dimensions:

```bash
firefox --marionette --headless --remote-allow-system-access
```

## API Reference

### Rust API

The screenshot functionality is available through the `ScreenshotManager` struct. For library usage, you would access it through the crate's public API:

```rust
// Note: This is a CLI tool, not a library. The following is for reference only.
// To use this functionality, run the mus-uc binary with the screenshot subcommand.

// If integrating into your own project, you would need to:
// 1. Add the marionette client dependency
// 2. Implement similar screenshot functionality using the chrome context

use mus_uc_devtools::ScreenshotManager;
use mus_uc_devtools::marionette_client::{MarionetteConnection, MarionetteSettings};
use std::path::Path;

// Create connection
let settings = MarionetteSettings::new();
let connection = MarionetteConnection::connect(&settings)?;

// Create screenshot manager
let mut screenshot_manager = ScreenshotManager::new(connection)?;

// Capture full screen
let data_url = screenshot_manager.capture_full_screen()?;

// Capture specific element
let data_url = screenshot_manager.capture_element("#nav-bar")?;

// Save to file
screenshot_manager.screenshot_to_file(
    Path::new("output.png"), 
    Some("#nav-bar")
)?;
```

**Note**: This tool is primarily designed as a CLI application. For programmatic use, consider running the `mus-uc` binary as a subprocess or adapting the code for your specific needs.

## Performance Considerations

- Screenshots are captured in PNG format with base64 encoding
- Full-screen screenshots of a 1920x1080 window are typically 100-500KB
- Element screenshots are usually smaller (10-100KB depending on element size)
- Screenshot capture is relatively fast (typically < 100ms)

## Limitations

1. **Chrome Context Only**: Requires Firefox to be running with marionette enabled
2. **Firefox Specific**: Only works with Firefox browser
3. **No Web Content**: Designed for browser UI, not web page content (use WebDriver screenshots for web content)
4. **Selector Support**: Uses Firefox's `querySelector`, so only standard CSS selectors are supported
