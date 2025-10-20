# mus-uc-devtools

A tool to develop userChrome CSS for Firefox using the Marionette protocol.

<img width="128px" height="128px" src=".github/assets/mus-css.png" alt="mus-uc-devtools logo"></img>

## Features

- Load CSS into Firefox chrome context via Marionette protocol
- Register chrome.manifest files for modular CSS development
- Screenshot capture for browser UI elements
- Watch mode for automatic CSS reload on file changes

## Implementation

Uses Firefox Marionette protocol to execute JavaScript in chrome-privileged context, providing access to XPCOM components like `nsIStyleSheetService` for CSS injection.

See [docs/chrome-context.md](docs/chrome-context.md) for details on chrome context implementation.

## Usage

### Register chrome.manifest

```bash
./mus-uc register-manifest -m /path/to/chrome.manifest
./mus-uc load -f path/to/style.css
```

chrome.manifest example:
```
content mus-uc ./
content mus-uc-components ./components/
```

CSS with chrome:// imports:
```css
@import 'chrome://mus-uc/content/components/button.css';
#nav-bar { background: red !important; }
```

### CSS Commands

```bash
# Load CSS
./mus-uc load -f path/to/style.css
./mus-uc load -f path/to/style.css -i my-id

# Watch for changes and auto-reload
./mus-uc watch -f path/to/style.css -i my-id

# Manage loaded CSS
./mus-uc unload my-id
./mus-uc list
./mus-uc clear
```

### Screenshot

```bash
./mus-uc screenshot -o output.png
./mus-uc screenshot -s "#nav-bar" -o navbar.png
```

### Execute JavaScript

Run arbitrary JavaScript in Firefox chrome context:

```bash
# Execute from file
./mus-uc exec -f script.js

# Execute from stdin
echo 'return { result: 1 + 1 };' | ./mus-uc exec

# Pass arguments to the script
./mus-uc exec -f script.js -a '["arg1", 42]'
```

Example scripts:

```javascript
// Get browser info
const window = Services.wm.getMostRecentWindow("navigator:browser");
return {
    title: window.document.title,
    url: window.location.href
};
```

```javascript
// Use arguments
const name = arguments[0];
const count = arguments[1];
return { greeting: `Hello ${name}!`, count: count * 2 };
```

## Requirements

- Firefox with Marionette enabled (set `marionette.port` to 2828 in `about:config`)
- Rust toolchain

## Building

```bash
cargo build --release
```

## Testing

```bash
npm install
npm test
```

## Documentation

- [Chrome Context](docs/chrome-context.md)
- [Chrome Manifest](docs/chrome-manifest.md)
- [Screenshot](docs/screenshot.md)
- [Testing](docs/testing.md)
