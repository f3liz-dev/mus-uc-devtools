#!/usr/bin/env node

/**
 * Complete MCP Integration Example
 * 
 * Demonstrates how to use the mus-uc-devtools MCP server programmatically
 * for LLM-driven Firefox chrome testing.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FirefoxMCPClient {
  constructor(serverPath) {
    this.serverPath = serverPath;
    this.client = null;
    this.transport = null;
  }

  async connect() {
    console.log('Connecting to MCP server...');
    
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [this.serverPath]
    });

    this.client = new Client({
      name: 'firefox-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    console.log('✅ Connected to MCP server\n');
  }

  async listTools() {
    console.log('Listing available tools...');
    const result = await this.client.listTools();
    
    console.log(`Found ${result.tools.length} tools:\n`);
    result.tools.forEach(tool => {
      console.log(`  ${tool.name}`);
      console.log(`    ${tool.description.substring(0, 70)}...`);
    });
    console.log('');
    
    return result.tools;
  }

  async executeScript(script, args = []) {
    console.log('Executing JavaScript in Firefox...');
    console.log(`Script: ${script.substring(0, 60)}...`);
    
    const result = await this.client.callTool({
      name: 'execute_script',
      arguments: {
        script,
        args,
        includeLogs: true
      }
    });

    const data = JSON.parse(result.content[0].text);
    
    if (data.success) {
      console.log('✅ Script executed successfully');
      console.log('Result:', JSON.stringify(data.result, null, 2));
      console.log(`Duration: ${data.duration}ms\n`);
    } else {
      console.error('❌ Script execution failed');
      console.error('Error:', data.error);
    }
    
    return data;
  }

  async screenshot(selector = null) {
    console.log(`Taking screenshot${selector ? ' of ' + selector : ''}...`);
    
    const result = await this.client.callTool({
      name: 'screenshot',
      arguments: selector ? { selector } : {}
    });

    const data = JSON.parse(result.content[0].text);
    
    if (data.success) {
      console.log('✅ Screenshot captured');
      console.log(`Format: ${data.format}, Selector: ${data.selector}\n`);
      
      // Image data is in content[1] if you need it
      if (result.content[1] && result.content[1].type === 'image') {
        console.log('Image data available (base64)');
      }
    } else {
      console.error('❌ Screenshot failed');
      console.error('Error:', data.error);
    }
    
    return data;
  }

  async loadCSS(css, id) {
    console.log('Loading CSS...');
    
    const result = await this.client.callTool({
      name: 'load_css',
      arguments: { css, id }
    });

    const data = JSON.parse(result.content[0].text);
    
    if (data.success) {
      console.log('✅ CSS loaded');
      console.log(`ID: ${data.result.id}\n`);
    } else {
      console.error('❌ CSS loading failed');
      console.error('Error:', data.error);
    }
    
    return data;
  }

  async createSession() {
    console.log('Creating persistent session...');
    
    const result = await this.client.callTool({
      name: 'create_session',
      arguments: {
        host: 'localhost',
        port: 2828,
        autoConnect: true
      }
    });

    const data = JSON.parse(result.content[0].text);
    
    if (data.success) {
      console.log('✅ Session created');
      console.log(`Session ID: ${data.sessionId}`);
      console.log(`State: ${data.state.state}\n`);
    } else {
      console.error('❌ Session creation failed');
      console.error('Error:', data.error);
    }
    
    return data;
  }

  async closeSession(sessionId) {
    console.log('Closing session...');
    
    const result = await this.client.callTool({
      name: 'close_session',
      arguments: { sessionId }
    });

    const data = JSON.parse(result.content[0].text);
    
    if (data.success) {
      console.log('✅ Session closed\n');
    } else {
      console.error('❌ Session close failed');
      console.error('Error:', data.error);
    }
    
    return data;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MCP server');
    }
  }
}

// Example workflows
async function runExamples() {
  const serverPath = join(__dirname, '..', 'src', 'mcp-server.js');
  const client = new FirefoxMCPClient(serverPath);

  try {
    // Connect to MCP server
    await client.connect();

    // List available tools
    await client.listTools();

    console.log('=== Example 1: Simple Script Execution ===\n');
    await client.executeScript('return Services.appinfo.version;');

    console.log('=== Example 2: Get Browser Information ===\n');
    await client.executeScript(`
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      return {
        title: window.document.title,
        url: window.location.href,
        version: Services.appinfo.version,
        platform: Services.appinfo.OS
      };
    `);

    console.log('=== Example 3: Screenshot ===\n');
    await client.screenshot();

    console.log('=== Example 4: Load CSS ===\n');
    await client.loadCSS(
      '#nav-bar { background: linear-gradient(to right, #667eea, #764ba2) !important; }',
      'gradient-theme'
    );

    // Wait a bit for CSS to apply
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('=== Example 5: Screenshot with CSS Applied ===\n');
    await client.screenshot('#nav-bar');

    console.log('=== Example 6: Stateful Session Workflow ===\n');
    const session = await client.createSession();
    
    if (session.success) {
      const sessionId = session.sessionId;
      
      // Use session for multiple operations
      await client.executeScript(
        'return window.location.href;',
        [],
        sessionId
      );
      
      await client.closeSession(sessionId);
    }

    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error.message);
    console.error(error.stack);
  } finally {
    await client.disconnect();
  }
}

// Check if Firefox is running
console.log('mus-uc-devtools MCP Integration Example');
console.log('==========================================\n');
console.log('⚠️  Make sure Firefox is running with Marionette enabled:');
console.log('   1. Open Firefox');
console.log('   2. Go to about:config');
console.log('   3. Set marionette.port to 2828');
console.log('   4. Restart Firefox\n');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  runExamples()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}, 3000);
