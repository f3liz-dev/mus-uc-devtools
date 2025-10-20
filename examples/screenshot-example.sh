#!/bin/bash
# Example: CI/CD Screenshot Testing Script
# This script demonstrates how to use the screenshot feature in a CI/CD pipeline

set -e

echo "=== Screenshot Testing Example ==="
echo ""

# Build the project
echo "Building chrome-css..."
cargo build --release
CHROME_CSS="./target/release/chrome-css"

echo ""
echo "Make sure Firefox is running with marionette enabled on port 2828"
echo "You can start Firefox with: firefox --marionette --remote-allow-system-access"
echo ""

# Wait for user confirmation
read -p "Press Enter when Firefox is ready..."

# Take a full-screen screenshot
echo "Taking full-screen screenshot..."
$CHROME_CSS screenshot -o fullscreen.png
echo "✓ Saved to fullscreen.png"

# Take screenshots of specific UI elements
echo "Taking navigation bar screenshot..."
$CHROME_CSS screenshot -s "#nav-bar" -o navbar.png 2>/dev/null || echo "Navigation bar not found (may be hidden in headless mode)"

echo "Taking toolbar screenshot..."
$CHROME_CSS screenshot -s "toolbar" -o toolbar.png 2>/dev/null || echo "Toolbar not found"

echo ""
echo "=== Screenshot Testing Complete ==="
echo "Generated screenshots can be used for:"
echo "  - Visual regression testing"
echo "  - Design documentation"
echo "  - Verifying userChrome CSS changes"
