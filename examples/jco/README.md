# JavaScript Component Examples using jco

This directory contains examples of using the mus-uc-devtools library from JavaScript via WebAssembly Components transpiled with jco.

## Prerequisites

1. Build the component:
```bash
npm run build:component
```

2. Ensure Firefox is running with Marionette enabled (port 2828)

## Running Examples

```bash
node examples/jco/css-manager-example.js
node examples/jco/marionette-example.js
```

## What is jco?

[jco](https://github.com/bytecodealliance/jco) is the JavaScript Component Tooling from the Bytecode Alliance. It transpiles WebAssembly Components to JavaScript, allowing you to use Rust code directly in JavaScript/Node.js with full type safety.

## Available Interfaces

### CSS Manager (`cssManager`)
- `initialize()` - Initialize the CSS manager
- `loadCss(content, id?)` - Load CSS into Firefox
- `unloadCss(id)` - Unload CSS by ID
- `clearAll()` - Clear all loaded CSS
- `listLoaded()` - List all loaded CSS IDs

### Marionette (`marionette`)
- `connect(host, port)` - Connect to Marionette
- `executeScript(script, args?)` - Execute JavaScript in Firefox chrome context

### Screenshot (`screenshot`)
- `takeScreenshot(selector?)` - Take a screenshot (optional CSS selector for specific element)

## Type Safety

All functions return Result types with TypeScript definitions:

```typescript
type ResultString = 
  | { tag: 'ok', val: string }
  | { tag: 'err', val: string }
```

Check the `dist/` directory for full TypeScript definitions.
