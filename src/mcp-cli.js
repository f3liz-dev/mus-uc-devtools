#!/usr/bin/env node

/**
 * CLI wrapper for mus-uc-devtools MCP server
 * 
 * Provides easy command-line access to MCP tools for testing and debugging
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const usage = `
mus-uc-mcp - CLI wrapper for MCP server tools

Usage:
  mus-uc-mcp <command> [options]

Commands:
  server                     Start the MCP server (stdio mode)
  test                       Test server by listing available tools
  exec <script> [args]       Execute JavaScript in Firefox chrome context
  screenshot [selector]      Take a screenshot (optional CSS selector)
  load-css <file> [id]       Load CSS from file
  unload-css <id>            Unload CSS by ID
  help                       Show this help message

Examples:
  # Start MCP server
  mus-uc-mcp server

  # Execute JavaScript
  mus-uc-mcp exec "return Services.appinfo.version;"
  
  # Execute with arguments
  mus-uc-mcp exec "return arguments[0] + arguments[1];" '["Hello", " World"]'
  
  # Take screenshot
  mus-uc-mcp screenshot
  mus-uc-mcp screenshot "#nav-bar"
  
  # Load CSS
  mus-uc-mcp load-css style.css my-theme
  
  # Unload CSS
  mus-uc-mcp unload-css my-theme

For MCP client integration, use:
  node src/mcp-server.js
`;

async function sendMCPRequest(method, params = {}) {
  const serverPath = join(__dirname, 'mcp-server.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stdoutData = '';
  let stderrData = '';

  server.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  server.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method,
    params
  }) + '\n';

  server.stdin.write(request);

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  server.kill();

  // Parse response
  if (stdoutData) {
    const lines = stdoutData.trim().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch (e) {
        // Continue to next line
      }
    }
  }

  throw new Error('No valid response received');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    console.log(usage);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'server':
        // Start server in passthrough mode
        const serverPath = join(__dirname, 'mcp-server.js');
        const { spawn: spawnSync } = await import('child_process');
        const server = spawnSync('node', [serverPath], { stdio: 'inherit' });
        break;

      case 'test':
        console.log('Testing MCP server...\n');
        const response = await sendMCPRequest('tools/list');
        if (response.result && response.result.tools) {
          console.log(`✅ Server is working! Found ${response.result.tools.length} tools:\n`);
          response.result.tools.forEach(tool => {
            console.log(`  ${tool.name}`);
            console.log(`    ${tool.description.substring(0, 70)}...`);
          });
        }
        break;

      case 'exec':
        if (args.length < 2) {
          console.error('Error: Missing script argument');
          console.error('Usage: mus-uc-mcp exec <script> [args]');
          process.exit(1);
        }
        
        const script = args[1];
        const scriptArgs = args[2] ? JSON.parse(args[2]) : [];
        
        console.log('Executing script...');
        const execResponse = await sendMCPRequest('tools/call', {
          name: 'execute_script',
          arguments: { script, args: scriptArgs }
        });
        
        if (execResponse.result) {
          console.log('\nResult:');
          console.log(execResponse.result.content[0].text);
        } else if (execResponse.error) {
          console.error('\nError:', execResponse.error.message);
        }
        break;

      case 'screenshot':
        const selector = args[1];
        console.log(`Taking screenshot${selector ? ' of ' + selector : ''}...`);
        
        const screenshotResponse = await sendMCPRequest('tools/call', {
          name: 'screenshot',
          arguments: selector ? { selector } : {}
        });
        
        if (screenshotResponse.result) {
          console.log('\nScreenshot captured!');
          console.log(screenshotResponse.result.content[0].text);
          // Image data is in content[1]
        } else if (screenshotResponse.error) {
          console.error('\nError:', screenshotResponse.error.message);
        }
        break;

      case 'load-css':
        if (args.length < 2) {
          console.error('Error: Missing CSS file argument');
          console.error('Usage: mus-uc-mcp load-css <file> [id]');
          process.exit(1);
        }
        
        const cssFile = args[1];
        const cssId = args[2];
        const css = await readFile(cssFile, 'utf-8');
        
        console.log('Loading CSS...');
        const loadResponse = await sendMCPRequest('tools/call', {
          name: 'load_css',
          arguments: { css, id: cssId }
        });
        
        if (loadResponse.result) {
          console.log('\nCSS loaded:');
          console.log(loadResponse.result.content[0].text);
        } else if (loadResponse.error) {
          console.error('\nError:', loadResponse.error.message);
        }
        break;

      case 'unload-css':
        if (args.length < 2) {
          console.error('Error: Missing CSS ID argument');
          console.error('Usage: mus-uc-mcp unload-css <id>');
          process.exit(1);
        }
        
        const unloadId = args[1];
        console.log('Unloading CSS...');
        
        const unloadResponse = await sendMCPRequest('tools/call', {
          name: 'unload_css',
          arguments: { id: unloadId }
        });
        
        if (unloadResponse.result) {
          console.log('\nCSS unloaded:');
          console.log(unloadResponse.result.content[0].text);
        } else if (unloadResponse.error) {
          console.error('\nError:', unloadResponse.error.message);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(usage);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
