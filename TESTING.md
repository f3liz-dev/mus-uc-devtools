# Firefox Headless Testing Implementation

This document describes the headless testing implementation for the mus-uc-devtools project.

## Overview

This implementation adds comprehensive testing infrastructure to verify that the CSS loading functionality works correctly in headless Firefox using the marionette protocol.

## Components

### 1. Node.js Test Infrastructure

**File**: `tests/headless-test.js`

A comprehensive test script that:
- Downloads Firefox binary using `@puppeteer/browsers` (or uses system Firefox)
- Starts Firefox in headless mode with required flags
- Implements a full marionette protocol v3 client
- Creates a WebDriver session
- Switches to chrome context (privileged mode)
- Loads CSS using `nsIStyleSheetService`
- Verifies CSS is registered and applied
- Cleans up resources

**Key Features**:
- Proper marionette protocol v3 implementation using 4-tuple message format: `[direction, id, command, parameters]`
- Handles handshake and message framing correctly
- Supports both system Firefox and downloaded binaries
- Creates Firefox profile with marionette enabled
- Uses `--remote-allow-system-access` flag for chrome context access

### 2. Package Configuration

**File**: `package.json`

Defines:
- `@puppeteer/browsers` dependency for Firefox binary management
- `npm test` script to run the headless tests

### 3. GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

Automated CI/CD pipeline that:
- Runs on push, pull request, and manual dispatch
- Sets up Node.js and Rust environments
- Installs dependencies
- Builds the Rust project
- Runs the Node.js headless test
- Tests the Rust CLI with a live Firefox instance
- Uses minimal permissions (`contents: read`) for security

### 4. Documentation

**File**: `README.md` (updated)

Added sections for:
- Testing instructions
- How to run `npm test`
- Explanation of CI/CD workflow

### 5. Git Configuration

**File**: `.gitignore` (updated)

Added entries to ignore:
- `node_modules/` - Node.js dependencies
- `package-lock.json` - Lock file
- `.firefox-cache/` - Downloaded Firefox binaries and test profiles

## Technical Details

### Marionette Protocol Implementation

The test script implements the marionette protocol v3 correctly:

1. **Handshake**: Receives `{len}:{json}` format with protocol info
2. **Commands**: Sends `[0, id, "CommandName", {params}]` format
3. **Responses**: Receives `[1, id, error|null, result]` format

### Firefox Setup

Firefox is started with these critical flags:
- `--headless`: Run without GUI
- `--marionette`: Enable marionette protocol
- `--no-remote`: Don't connect to existing Firefox instances
- `--remote-allow-system-access`: Enable chrome context access (required for CSS loading)
- `--profile {path}`: Use custom profile with marionette configuration

### CSS Loading Process

1. Connect to marionette on port 2828
2. Create WebDriver session with `WebDriver:NewSession`
3. Switch to chrome context with `Marionette:SetContext`
4. Execute JavaScript to:
   - Get `nsIStyleSheetService` via XPCOM
   - Create data URI with CSS content
   - Register stylesheet with `loadAndRegisterSheet()`
5. Verify registration with `sheetRegistered()`
6. Clean up by unregistering the stylesheet

### JavaScript API Used

The test uses Firefox's XPCOM APIs available in chrome context:
- `Cc` - Component classes (XPCOM components)
- `Ci` - Component interfaces (XPCOM interfaces)
- `Services.io` - IO service for URI creation
- `nsIStyleSheetService` - Service for managing stylesheets

## Testing

Run the tests locally:

```bash
# Install dependencies
npm install

# Run tests
npm test
```

Expected output:
```
✓ Connected to marionette
✓ Session created
✓ CSS is successfully applied!
✓ Cleanup completed
✅ All tests passed!
```

## CI/CD

The GitHub Actions workflow automatically runs on:
- Push to main branch
- Pull requests to main branch
- Manual workflow dispatch

View workflow runs at: https://github.com/f3liz-dev/mus-uc-devtools/actions

## Security

- All CodeQL security checks pass
- Workflow uses minimal required permissions
- No secrets or credentials exposed
- Proper error handling and resource cleanup

## Future Improvements

Potential enhancements:
1. Add more CSS test cases (imports, complex selectors, etc.)
2. Test chrome.manifest registration functionality
3. Add performance benchmarks
4. Test on multiple Firefox versions
5. Add cross-platform testing (macOS, Windows)
