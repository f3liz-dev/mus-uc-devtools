# Testing

## Overview

Headless testing implementation using Firefox and Marionette protocol.

## Test Infrastructure

**File**: `tests/headless-test.js`

Features:
- Downloads Firefox binary using `@puppeteer/browsers`
- Starts Firefox in headless mode
- Implements marionette protocol v3 client
- Creates WebDriver session
- Switches to chrome context
- Loads CSS using `nsIStyleSheetService`
- Verifies CSS registration

## Running Tests

```bash
npm install
npm test
```

## Firefox Setup

Critical flags:
- `--headless`: Run without GUI
- `--marionette`: Enable marionette protocol
- `--no-remote`: Don't connect to existing instances
- `--remote-allow-system-access`: Enable chrome context
- `--profile {path}`: Use custom profile

## CSS Loading Process

1. Connect to marionette on port 2828
2. Create WebDriver session with `WebDriver:NewSession`
3. Switch to chrome context with `Marionette:SetContext`
4. Execute JavaScript to register stylesheet
5. Verify with `sheetRegistered()`
6. Clean up by unregistering

## CI/CD

GitHub Actions workflow runs on push and pull requests.
View workflow runs at: https://github.com/f3liz-dev/mus-uc-devtools/actions
