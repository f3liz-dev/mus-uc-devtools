# MCP Server Examples

This directory contains examples of using the MCP server for LLM-driven Firefox chrome testing.

## Files

- `README.md` - This file with usage examples
- `integration-example.js` - Complete Node.js integration example
- `simple-cli.sh` - Simple bash script for command-line usage

## Running the Examples

1. **Start Firefox with Marionette enabled**:
   - Open Firefox
   - Navigate to `about:config`
   - Set `marionette.port` to `2828`
   - Restart Firefox

2. **Install dependencies**:
   ```bash
   # From jsr.io (recommended)
   npx jsr add @f3liz/mus-uc-devtools
   
   # Or from npm
   npm install mus-uc-devtools
   
   # Or install dev dependencies if working from source
   npm install
   ```

3. **Run examples**:
   ```bash
   # Node.js integration example
   node examples/mcp/integration-example.js
   
   # Simple CLI
   ./examples/mcp/simple-cli.sh info
   ./examples/mcp/simple-cli.sh screenshot
   ```

## Example Use Cases

### 1. Simple Script Execution

Execute JavaScript and get the result:

```json
{
  "tool": "execute_script",
  "arguments": {
    "script": "return Services.appinfo.version;"
  }
}
```

Response:
```json
{
  "success": true,
  "result": "122.0",
  "duration": 45,
  "context": "chrome"
}
```

### 2. Get Browser Information

```json
{
  "tool": "execute_script",
  "arguments": {
    "script": "const window = Services.wm.getMostRecentWindow('navigator:browser'); return { title: window.document.title, url: window.location.href, version: Services.appinfo.version, platform: Services.appinfo.OS };"
  }
}
```

### 3. List Open Tabs

```json
{
  "tool": "execute_script",
  "arguments": {
    "script": "const window = Services.wm.getMostRecentWindow('navigator:browser'); const tabs = window.gBrowser.tabs; return Array.from(tabs).map(tab => ({ title: tab.linkedBrowser.contentTitle, url: tab.linkedBrowser.currentURI.spec, selected: tab.selected }));"
  }
}
```

### 4. Screenshot Full Window

```json
{
  "tool": "screenshot",
  "arguments": {}
}
```

Returns base64-encoded PNG image.

### 5. Screenshot Specific Element

```json
{
  "tool": "screenshot",
  "arguments": {
    "selector": "#nav-bar"
  }
}
```

### 6. Load CSS for Testing

```json
{
  "tool": "load_css",
  "arguments": {
    "css": "#nav-bar { background: red !important; }",
    "id": "test-theme"
  }
}
```

### 7. Stateful Testing Workflow

Create a session and reuse it for multiple operations:

**Step 1: Create Session**
```json
{
  "tool": "create_session",
  "arguments": {
    "host": "localhost",
    "port": 2828,
    "autoConnect": true
  }
}
```

Response:
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

**Step 2: Execute Tests with Session**
```json
{
  "tool": "execute_script",
  "arguments": {
    "sessionId": "session-1",
    "script": "return window.location.href;"
  }
}
```

**Step 3: Take Screenshot**
```json
{
  "tool": "screenshot",
  "arguments": {
    "sessionId": "session-1",
    "selector": "#nav-bar"
  }
}
```

**Step 4: Close Session**
```json
{
  "tool": "close_session",
  "arguments": {
    "sessionId": "session-1"
  }
}
```

## Advanced Examples

### Test UI Element Visibility

```json
{
  "tool": "execute_script",
  "arguments": {
    "script": "const doc = Services.wm.getMostRecentWindow('navigator:browser').document; const element = doc.querySelector(arguments[0]); if (!element) throw new Error('Element not found'); const style = window.getComputedStyle(element); return { exists: true, visible: style.display !== 'none' && style.visibility !== 'hidden', dimensions: { width: element.offsetWidth, height: element.offsetHeight } };",
    "args": ["#nav-bar"]
  }
}
```

### Check if Element Has Specific Class

```json
{
  "tool": "execute_script",
  "arguments": {
    "script": "const doc = Services.wm.getMostRecentWindow('navigator:browser').document; const element = doc.querySelector(arguments[0]); return { exists: !!element, hasClass: element ? element.classList.contains(arguments[1]) : false };",
    "args": ["#nav-bar", "toolbar-dark"]
  }
}
```

### Get Computed Styles

```json
{
  "tool": "execute_script",
  "arguments": {
    "script": "const doc = Services.wm.getMostRecentWindow('navigator:browser').document; const element = doc.querySelector(arguments[0]); if (!element) throw new Error('Element not found'); const style = window.getComputedStyle(element); return { backgroundColor: style.backgroundColor, color: style.color, fontSize: style.fontSize, display: style.display };",
    "args": ["#nav-bar"]
  }
}
```

### Inject and Test CSS

```json
{
  "tool": "load_css",
  "arguments": {
    "css": "#nav-bar { background: linear-gradient(to right, red, blue) !important; }",
    "id": "gradient-test"
  }
}
```

Then verify:
```json
{
  "tool": "screenshot",
  "arguments": {
    "selector": "#nav-bar"
  }
}
```

And cleanup:
```json
{
  "tool": "unload_css",
  "arguments": {
    "id": "gradient-test"
  }
}
```

## Error Handling

All tools return structured errors:

```json
{
  "success": false,
  "error": "Failed to connect to Firefox: Connection refused",
  "stack": "Error: Failed to connect...\n    at ..."
}
```

## Best Practices

1. **Use sessions for multiple operations** - Reduces connection overhead
2. **Include error handling** - Check `success` field in responses
3. **Clean up sessions** - Call `close_session` when done
4. **Use meaningful CSS IDs** - Makes unloading easier
5. **Test incrementally** - Execute simple scripts first to verify connection
6. **Screenshot for verification** - Visual feedback is helpful for UI testing

## Troubleshooting

### Connection Issues

If you get "Connection refused":
1. Verify Firefox is running
2. Check `about:config` → `marionette.port` = 2828
3. Restart Firefox after changing config

### Script Errors

If scripts fail:
1. Test with simple script first: `return 42;`
2. Check syntax (no console.log in return value)
3. Verify API availability in chrome context
4. Add error handling in script

### Screenshot Issues

If screenshots are black:
1. Ensure Firefox window is visible (not minimized)
2. Try full-screen screenshot first
3. Verify CSS selector is correct

## More Information

See [docs/mcp-server.md](../../docs/mcp-server.md) for complete documentation.
