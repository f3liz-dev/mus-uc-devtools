# Using mus-uc-devtools as a Library

This library provides a JavaScript/TypeScript interface to control Firefox via the Marionette protocol, specifically tailored for developing and testing userChrome CSS.

## Installation

```bash
npm install @f3liz/mus-uc-devtools
# or
yarn add @f3liz/mus-uc-devtools
# or
pnpm add @f3liz/mus-uc-devtools
```

## Usage

The library exports a `client` object which is used to establish a connection. Once connected, you get access to the `css`, `screen`, and `execute` modules.

```javascript
import { client } from '@f3liz/mus-uc-devtools';
```

### 1. Connecting to Firefox

First, you need to connect to a Firefox instance running with Marionette enabled (usually on port 2828).

```javascript
// Connect to Marionette server
const connectionResult = client.connect('localhost', 2828);

if (connectionResult.tag !== 'ok') {
    console.error('Connection failed:', connectionResult.val);
    process.exit(1);
}

// Get the client instance
const conn = connectionResult.val;
console.log('Connected to Firefox!');
```

### 2. Managing CSS

You can load, unload, and list userChrome CSS sheets using the `css` module on the connection instance.

```javascript
// Initialize the CSS manager
conn.css.initialize();

// Load CSS
const cssContent = `
    #nav-bar {
        background: #ff0000 !important;
    }
`;
const loadResult = conn.css.load(cssContent, 'my-custom-style');

if (loadResult.tag === 'ok') {
    console.log('CSS loaded with ID:', loadResult.val);
}

// List loaded sheets
const listResult = conn.css.list();
console.log('Loaded sheets:', listResult.val);

// Unload CSS
conn.css.unload('my-custom-style');

// Clear all loaded sheets
conn.css.clearAll();
```

### 3. Executing JavaScript

You can execute arbitrary JavaScript in the Chrome context (privileged access).

```javascript
// Execute a script
const script = 'return Services.appinfo.version;';
const execResult = conn.execute(script);

if (execResult.tag === 'ok') {
    console.log('Firefox Version:', execResult.val);
}
```

Passing arguments:

```javascript
const scriptWithArgs = `
    const [name, count] = arguments;
    return \`Hello \${name}, count is \${count}\`;
`;
// Arguments must be passed as a JSON string
const args = JSON.stringify(['World', 42]);
const result = conn.execute(scriptWithArgs, args);
```

### 4. Taking Screenshots

Capture screenshots of the browser UI.

```javascript
// Capture the entire window
const fullScreenshot = conn.screen.capture();

// Capture a specific element
const navBarScreenshot = conn.screen.capture('#nav-bar');

if (navBarScreenshot.tag === 'ok') {
    // result.val is a Uint8Array containing PNG data
    const fs = require('fs');
    fs.writeFileSync('navbar.png', navBarScreenshot.val);
}
```

## API Reference

### `client`

*   `connect(host: string, port: number): Result<ClientInstance>`

### `ClientInstance`

Returned by `client.connect()` on success.

#### `css`

*   `initialize(): Result<string>`
*   `load(content: string, id?: string): Result<string>`
*   `unload(id: string): Result<boolean>`
*   `clearAll(): Result<string>`
*   `list(): Result<string[]>`

#### `screen`

*   `capture(selector?: string): Result<Uint8Array>`

#### `execute`

*   `execute(script: string, args?: string): Result<string>`

## Result Type

All functions return a `Result` object which follows this pattern:

```typescript
type Result<T> = 
  | { tag: 'ok', val: T }
  | { tag: 'err', val: string };
```

Always check `tag === 'ok'` before accessing `val`.
