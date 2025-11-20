# MCP Server for Firefox Chrome Testing

This document describes the MCP (Model Context Protocol) server implementation for LLM-friendly Firefox chrome testing.

## Overview

The MCP server exposes Firefox chrome testing capabilities through a standardized protocol that LLMs can use to:
- Execute JavaScript in Firefox's privileged chrome context
- Capture screenshots for visual verification
- Manage CSS for UI testing
- Maintain stateful sessions for iterative testing workflows

## Architecture

```
┌─────────────────┐
│   LLM/Client    │
└────────┬────────┘
         │ MCP Protocol (stdio/JSON-RPC)
         │
┌────────▼────────┐
│   MCP Server    │
│  (Node.js)      │
└────────┬────────┘
         │ Marionette Protocol (TCP)
         │
┌────────▼────────┐
│     Firefox     │
│  (Chrome Ctx)   │
└─────────────────┘
```

## Installation

```bash
# Install from jsr.io
npx jsr add @f3liz/mus-uc-devtools

# Or install dependencies if working from source
npm install

# Or install just the MCP SDK
npm install @modelcontextprotocol/sdk
```

## Running the Server

### Standalone Mode

```bash
node src/mcp-server.js
```

The server runs on stdio, reading MCP requests from stdin and writing responses to stdout.

### With MCP Client

Configure your MCP client to use this server:

```json
{
  "mcpServers": {
    "firefox-testing": {
      "command": "node",
      "args": ["/path/to/mus-uc-devtools/src/mcp-server.js"]
    }
  }
}
```

## Prerequisites

1. **Firefox with Marionette enabled**
   - Open Firefox
   - Navigate to `about:config`
   - Set `marionette.port` to `2828`
   - Restart Firefox

2. **Node.js 18+**

## Available Tools

### 1. execute_script

Execute JavaScript code in Firefox chrome context with full access to Firefox internals.

**Input:**
```json
{
  "script": "return Services.appinfo.version;",
  "args": [],
  "sessionId": "optional-session-id",
  "includeLogs": false
}
```

**Output:**
```json
{
  "success": true,
  "result": "122.0",
  "duration": 45,
  "context": "chrome",
  "logs": []
}
```

**Example Scripts:**

Get browser information:
```javascript
const window = Services.wm.getMostRecentWindow("navigator:browser");
return {
  title: window.document.title,
  url: window.location.href,
  version: Services.appinfo.version
};
```

List open tabs:
```javascript
const window = Services.wm.getMostRecentWindow("navigator:browser");
const tabs = window.gBrowser.tabs;
return Array.from(tabs).map(tab => ({
  title: tab.linkedBrowser.contentTitle,
  url: tab.linkedBrowser.currentURI.spec
}));
```

### 2. screenshot

Capture a screenshot of the browser window or specific element.

**Input:**
```json
{
  "selector": "#nav-bar",
  "sessionId": "optional-session-id"
}
```

**Output:**
```json
{
  "success": true,
  "selector": "#nav-bar",
  "format": "png",
  "dataURL": "data:image/png;base64,..."
}
```

Also returns an image content block with the actual PNG data.

### 3. load_css

Load CSS into Firefox chrome context for UI styling/testing.

**Input:**
```json
{
  "css": "#nav-bar { background: red !important; }",
  "id": "my-theme",
  "sessionId": "optional-session-id"
}
```

**Output:**
```json
{
  "success": true,
  "id": "my-theme",
  "uri": "data:text/css,..."
}
```

### 4. unload_css

Remove previously loaded CSS by ID.

**Input:**
```json
{
  "id": "my-theme",
  "sessionId": "optional-session-id"
}
```

**Output:**
```json
{
  "success": true,
  "unloaded": true
}
```

### 5. create_session

Create a persistent session for stateful testing.

**Input:**
```json
{
  "host": "localhost",
  "port": 2828,
  "autoConnect": true
}
```

**Output:**
```json
{
  "success": true,
  "sessionId": "session-1",
  "state": {
    "id": "session-1",
    "state": "connected",
    "connected": true,
    "context": "chrome"
  }
}
```

### 6. get_session

Get information about a session.

**Input:**
```json
{
  "sessionId": "session-1",
  "includeLogs": true
}
```

**Output:**
```json
{
  "success": true,
  "state": {
    "id": "session-1",
    "state": "connected",
    "connected": true,
    "logCount": 42
  },
  "logs": [...]
}
```

### 7. close_session

Close and cleanup a session.

**Input:**
```json
{
  "sessionId": "session-1"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Session session-1 closed"
}
```

### 8. list_sessions

List all active sessions.

**Input:**
```json
{}
```

**Output:**
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "id": "session-1",
      "state": { "state": "connected", "connected": true }
    },
    {
      "id": "session-2",
      "state": { "state": "disconnected", "connected": false }
    }
  ]
}
```

## Session Management

### Stateless Mode

For one-off operations, omit the `sessionId` parameter. The server will create a temporary session, execute the operation, and clean up automatically.

```json
{
  "script": "return Services.appinfo.version;"
}
```

### Stateful Mode

For iterative testing workflows:

1. Create a session: `create_session`
2. Use the returned `sessionId` in subsequent calls
3. Close when done: `close_session`

This maintains the connection and allows for faster repeated operations.

## Error Handling

All tools return structured error information:

```json
{
  "success": false,
  "error": "Failed to connect to Firefox: Connection refused",
  "stack": "Error: Failed to connect...\n    at ..."
}
```

Common errors:
- **Connection refused**: Firefox not running or Marionette not enabled
- **Session not found**: Invalid sessionId
- **Script execution failed**: JavaScript error in the provided script
- **Element not found**: Invalid CSS selector for screenshot

## Logging

The server logs to stderr (won't interfere with MCP protocol on stdout):

```
[Session session-1] INFO: Connecting to Firefox Marionette...
[Session session-1] INFO: Successfully connected to Firefox
[Session session-1] INFO: Executing script (234 chars)
[Session session-1] INFO: Script executed successfully (45ms)
```

Session logs are also stored in memory and can be retrieved via `get_session` with `includeLogs: true`.

## Security Considerations

1. **Privileged Access**: Scripts execute with full Firefox chrome privileges. Only run trusted code.
2. **Local Only**: Server connects to localhost:2828 by default. Don't expose Marionette to the network.
3. **Session Isolation**: Each session maintains its own connection but shares the same Firefox instance.

## Chrome Context APIs

Scripts have access to all Firefox chrome APIs including:

- `Services.*` - XPCOM services
- `Cc`, `Ci`, `Cu`, `Cr` - XPCOM components
- `window` - Browser window
- `document` - Chrome document
- `gBrowser` - Tab browser
- `Components.*` - Component manager

See [Mozilla's Chrome Documentation](https://firefox-source-docs.mozilla.org/) for details.

## Performance

- Session reuse significantly improves performance for repeated operations
- First connection: ~100-200ms
- Subsequent script executions with session: ~20-50ms
- Screenshots: ~50-100ms depending on size

## Examples

### Example 1: Simple Script Execution

```javascript
// LLM perspective - using MCP client
const result = await callTool('execute_script', {
  script: 'return { version: Services.appinfo.version, platform: Services.appinfo.OS };'
});

console.log(result.result);
// { version: "122.0", platform: "Linux" }
```

### Example 2: Stateful Testing Workflow

```javascript
// Create session
const session = await callTool('create_session', {});
const sessionId = session.sessionId;

// Execute multiple operations
await callTool('load_css', {
  sessionId,
  css: '#nav-bar { background: red !important; }',
  id: 'test-css'
});

const screenshot = await callTool('screenshot', {
  sessionId,
  selector: '#nav-bar'
});

const info = await callTool('execute_script', {
  sessionId,
  script: 'return window.location.href;'
});

// Cleanup
await callTool('close_session', { sessionId });
```

### Example 3: UI Testing

```javascript
// Test that a UI element exists and is visible
const result = await callTool('execute_script', {
  script: `
    const doc = Services.wm.getMostRecentWindow("navigator:browser").document;
    const element = doc.querySelector(arguments[0]);
    
    if (!element) {
      throw new Error("Element not found");
    }
    
    const style = window.getComputedStyle(element);
    
    return {
      exists: true,
      visible: style.display !== "none" && style.visibility !== "hidden",
      dimensions: {
        width: element.offsetWidth,
        height: element.offsetHeight
      }
    };
  `,
  args: ['#nav-bar']
});

console.log(result.result);
```

## Troubleshooting

### Firefox not connecting

1. Check Firefox is running
2. Verify Marionette is enabled: `about:config` → `marionette.port` = 2828
3. Check port is not in use: `netstat -an | grep 2828`
4. Try restarting Firefox

### Scripts timing out

- Increase timeout in client
- Check for infinite loops in script
- Verify script syntax is correct

### Screenshots empty/black

- Ensure Firefox window is visible (not minimized)
- Try full-screen screenshot first to test
- Check CSS selector is valid for element screenshots

## Development

### Testing the Server

```bash
# Start the server
node src/mcp-server.js

# In another terminal, send test requests
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node src/mcp-server.js
```

### Adding New Tools

1. Add tool definition in `ListToolsRequestSchema` handler
2. Add case in `CallToolRequestSchema` handler
3. Implement the tool logic
4. Update this documentation

## Related Documentation

- [Chrome Context](chrome-context.md)
- [Screenshot](screenshot.md)
- [Testing](testing.md)
- [MCP Specification](https://modelcontextprotocol.io/)
