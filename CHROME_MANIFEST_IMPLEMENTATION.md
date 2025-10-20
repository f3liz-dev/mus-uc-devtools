# Implementation Summary: Chrome Manifest Registration

## Overview

This implementation adds support for registering a `chrome.manifest` file with Firefox instead of bundling CSS files. This allows CSS files to use `@import` statements with `chrome://` URIs for modular CSS development.

## Changes Made

### 1. New Module: `src/chrome_manifest.rs`

Created a new module that handles chrome.manifest registration:

- **ChromeManifestRegistrar struct**: Manages manifest registration state
- **register_manifest()**: Registers a chrome.manifest file using Firefox's ComponentRegistrar API
- **Implementation details**:
  - Uses `Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile)`
  - Calls `initWithPath()` with absolute path
  - Uses `Components.manager.QueryInterface(Ci.nsIComponentRegistrar)`
  - Calls `registrar.autoRegister()` for immediate registration

### 2. Updated: `src/chrome_css_manager.rs`

Extended ChromeCSSManager to support manifest registration:

- Added `manifest_registrar` field to store ChromeManifestRegistrar instance
- Added `register_chrome_manifest()` method to register manifest files
- Added `get_registered_manifest()` method to query registered manifest path

### 3. Updated: `src/cli.rs`

Added new CLI subcommand:

```bash
mus-uc register-manifest -m /path/to/chrome.manifest
```

This command registers a chrome.manifest file before loading CSS files.

### 4. Updated: `src/main.rs`

Added the new `chrome_manifest` module to the module system and exported `ChromeManifestRegistrar`.

### 5. Documentation

Created comprehensive documentation:

- **README.md**: Updated with chrome.manifest usage examples
- **examples/CHROME_MANIFEST_GUIDE.md**: Complete guide on using chrome.manifest
- **examples/chrome.manifest**: Example manifest file
- **examples/example.css**: Example CSS using chrome:// URIs
- **examples/demo/**: Complete working demo with:
  - chrome.manifest
  - main.css with imports
  - components/ directory with component CSS
  - themes/ directory with theme CSS
  - README.md with step-by-step usage instructions

## How It Works

### 1. chrome.manifest Format

```
content mus-uc ./
content mus-uc-components ./components/
content mus-uc-themes ./themes/
```

This maps URI namespaces to filesystem directories.

### 2. Registration Process

```rust
// Canonicalize path to get absolute path
let absolute_path = manifest_path.canonicalize()?;

// Execute JavaScript in Firefox chrome context to register
let script = format!(r#"
    let cmanifest = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    cmanifest.initWithPath('{}');
    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.autoRegister(cmanifest);
"#, absolute_path);
```

### 3. CSS Usage

After registration, CSS files can use chrome:// URIs:

```css
@import 'chrome://mus-uc-components/content/buttons.css';
@import 'chrome://mus-uc-themes/content/dark-theme.css';
```

## Benefits

1. **No bundling required**: CSS files are loaded directly from the filesystem
2. **Faster iteration**: Just reload, no build step needed
3. **Better debugging**: CSS files remain separate and identifiable
4. **Modular development**: Organize CSS into logical components
5. **Standard Firefox mechanism**: Uses the same system Firefox uses internally

## Testing

- ✅ Code compiles successfully with Rust
- ✅ No security vulnerabilities found (CodeQL check passed)
- ✅ Code formatted with rustfmt
- ✅ Clippy warnings fixed in new code
- ✅ CLI help documentation generated correctly
- ✅ Demo directory with working examples created

## Usage Example

```bash
# 1. Register the chrome.manifest
./mus-uc register-manifest -m /absolute/path/to/chrome.manifest

# 2. Load CSS that uses chrome:// imports
./mus-uc load -f main.css -i my-theme

# 3. List loaded stylesheets
./mus-uc list

# 4. Unload when done
./mus-uc unload my-theme
```

## Technical Details

### XPCOM Components Used

- **nsIFile**: File system abstraction
- **nsIComponentRegistrar**: Component registration interface
- **initWithPath()**: Initialize nsIFile with absolute path
- **autoRegister()**: Register chrome.manifest immediately

### Marionette Protocol

The implementation uses the Marionette protocol to execute JavaScript in Firefox's chrome-privileged context, which provides access to XPCOM components.

## Files Modified

- src/chrome_manifest.rs (new)
- src/chrome_css_manager.rs
- src/cli.rs
- src/main.rs
- README.md
- examples/CHROME_MANIFEST_GUIDE.md (new)
- examples/chrome.manifest (new)
- examples/example.css (new)
- examples/demo/* (new)

## Commits

1. Initial plan for chrome.manifest registration
2. Add chrome.manifest registration functionality
3. Add demo directory with example chrome.manifest usage
4. Format code with rustfmt
5. Fix clippy warning: add Default impl for ChromeManifestRegistrar

## Compatibility

- Works with Firefox Marionette protocol
- Requires Firefox with marionette.port set to 2828
- Uses standard Firefox chrome.manifest format
- Compatible with existing CSS loading functionality
