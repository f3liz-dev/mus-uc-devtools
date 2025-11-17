# MCP Client Integration Guide

This guide shows how to integrate the mus-uc-devtools MCP server with various MCP clients and LLM tools.

## Prerequisites

1. Install mus-uc-devtools:
   ```bash
   # From jsr.io (recommended)
   npx jsr add @f3liz/mus-uc-devtools
   
   # Or from npm
   npm install mus-uc-devtools
   ```

2. Enable Firefox Marionette:
   - Open Firefox
   - Navigate to `about:config`
   - Set `marionette.port` to `2828`
   - Restart Firefox

## Integration Methods

### Method 1: Claude Desktop (Anthropic)

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "firefox-testing": {
      "command": "node",
      "args": [
        "/absolute/path/to/mus-uc-devtools/src/mcp-server.js"
      ]
    }
  }
}
```

Replace `/absolute/path/to/mus-uc-devtools` with the actual path to your installation.

After restarting Claude Desktop, you'll see the Firefox testing tools available.

### Method 2: Custom MCP Client

If you're building your own MCP client:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// Start the server process
const serverProcess = spawn('node', [
  '/path/to/mus-uc-devtools/src/mcp-server.js'
]);

// Create transport
const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/mus-uc-devtools/src/mcp-server.js']
});

// Create client
const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

// Connect
await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool({
  name: 'execute_script',
  arguments: {
    script: 'return Services.appinfo.version;'
  }
});

console.log('Result:', result);
```

### Method 3: Using jsr with npx

For temporary/testing use with jsr:

```bash
# Using npx with jsr
npx jsr add @f3liz/mus-uc-devtools

# Then run
npm run mcp
```

Or with npm package:

```bash
npx mus-uc-devtools mcp
```

Or with the CLI wrapper:

```bash
npx mus-uc-devtools mcp-cli test
npx mus-uc-devtools mcp-cli exec "return Services.appinfo.version;"
```

### Method 4: Global Installation

Install globally for system-wide access:

```bash
# From jsr.io (recommended)
npx jsr add -g @f3liz/mus-uc-devtools

# Or from npm
npm install -g mus-uc-devtools
```

Then use in any MCP client configuration:

```json
{
  "mcpServers": {
    "firefox-testing": {
      "command": "mus-uc-mcp"
    }
  }
}
```

## Verifying the Installation

Test the server is working:

```bash
# Using the CLI wrapper
node src/mcp-cli.js test

# Or directly
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node src/mcp-server.js
```

You should see a list of 8 available tools.

## Available Tools

Once integrated, you'll have access to these tools:

1. **execute_script** - Run JavaScript in Firefox chrome context
2. **screenshot** - Capture browser/element screenshots
3. **load_css** - Load CSS into Firefox
4. **unload_css** - Remove loaded CSS
5. **create_session** - Start a persistent session
6. **get_session** - Get session info
7. **close_session** - Close a session
8. **list_sessions** - List all sessions

## Example LLM Interactions

Once integrated, you can ask your LLM:

> "Execute JavaScript in Firefox to get the browser version"

The LLM will use the `execute_script` tool:
```javascript
return Services.appinfo.version;
```

> "Take a screenshot of the navigation bar"

The LLM will use the `screenshot` tool with selector `#nav-bar`.

> "Load this CSS to make the navigation bar red"

The LLM will use the `load_css` tool with your CSS.

## Troubleshooting

### Server won't start

1. Check Node.js version: `node --version` (requires 18+)
2. Verify installation: `npm list @modelcontextprotocol/sdk`
3. Check file permissions: `ls -la src/mcp-server.js`

### Can't connect to Firefox

1. Verify Firefox is running
2. Check Marionette is enabled: `about:config` → `marionette.port` = 2828
3. Test connection: `telnet localhost 2828`

### Tools not showing in client

1. Restart your MCP client
2. Check client logs for errors
3. Verify server path in configuration
4. Test server manually: `node src/mcp-cli.js test`

## Security Notes

- The MCP server runs with full Firefox chrome privileges
- Only use trusted scripts and CSS
- Don't expose the server to network access
- Use sessions to avoid leaving connections open

## Advanced Configuration

### Custom Marionette Port

If Firefox uses a different Marionette port, use the `create_session` tool:

```json
{
  "tool": "create_session",
  "arguments": {
    "port": 3333
  }
}
```

### Multiple Firefox Instances

Run multiple Firefox instances on different Marionette ports and create separate sessions for each.

### Persistent Sessions

For long-running test workflows, create a session at the start:

1. Create session → get `sessionId`
2. Use `sessionId` in all subsequent tool calls
3. Close session when done

This avoids reconnection overhead.

## Support

- Documentation: [docs/mcp-server.md](../mcp-server.md)
- Examples: [examples/mcp/README.md](../examples/mcp/README.md)
- Issues: https://github.com/f3liz-dev/mus-uc-devtools/issues

## Related Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Firefox Marionette](https://firefox-source-docs.mozilla.org/testing/marionette/)
- [Chrome Context APIs](https://firefox-source-docs.mozilla.org/)
