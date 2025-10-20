# JavaScript Examples

This directory contains example JavaScript files that can be executed in Firefox's chrome context using the `exec` command.

## Usage

```bash
# Execute a JavaScript file
./mus-uc exec -f examples/js/FILE.js

# Execute with arguments
./mus-uc exec -f examples/js/FILE.js -a '["arg1", "arg2"]'

# Execute from stdin
echo 'return { result: 42 };' | ./mus-uc exec
```

## Examples

### browser-info.js
Get information about the Firefox browser instance.

```bash
./mus-uc exec -f examples/js/browser-info.js
```

Returns browser title, URL, user agent, Firefox version, and platform.

### simple-calc.js
Simple calculation example demonstrating basic JavaScript execution.

```bash
./mus-uc exec -f examples/js/simple-calc.js
```

Returns calculation results and timestamp.

### with-args.js
Demonstrates how to use command-line arguments in your script.

```bash
./mus-uc exec -f examples/js/with-args.js -a '["John", 42]'
```

Returns personalized greeting and calculations based on provided arguments.

### list-tabs.js
List all open tabs in the Firefox browser.

```bash
./mus-uc exec -f examples/js/list-tabs.js
```

Returns information about all open tabs including title, URL, and selection status.

## Chrome Context APIs

When scripts are executed with `exec`, they run in Firefox's chrome context, which provides access to:

- `Services`: XPCOM services (e.g., `Services.wm`, `Services.io`, `Services.appinfo`)
- `Cc` / `Ci`: XPCOM component classes and interfaces
- `window`: The browser window object
- `document`: The browser chrome document
- `gBrowser`: The browser's tab browser
- And many more Firefox internals

See [Mozilla's chrome context documentation](https://firefox-source-docs.mozilla.org/devtools-user/browser_console/index.html) for more details.
