/**
 * Test script for MCP server
 * 
 * This is a simple test to verify the MCP server can list tools
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testMCPServer() {
  console.log('Testing MCP Server...\n');
  
  // Start the MCP server
  const serverPath = join(__dirname, '..', 'src', 'mcp-server.js');
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

  // Send tools/list request
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  }) + '\n';

  console.log('Sending request:', request.trim());
  server.stdin.write(request);

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  server.kill();

  console.log('\n=== STDERR (Server logs) ===');
  console.log(stderrData);

  console.log('\n=== STDOUT (MCP responses) ===');
  console.log(stdoutData);

  // Parse and validate response
  if (stdoutData) {
    try {
      // MCP responses may be on separate lines
      const lines = stdoutData.trim().split('\n').filter(line => line.trim());
      for (const line of lines) {
        const response = JSON.parse(line);
        console.log('\n=== Parsed Response ===');
        console.log(JSON.stringify(response, null, 2));

        if (response.result && response.result.tools) {
          console.log('\n✅ Success! Server returned tools:');
          response.result.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
          });
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to parse response:', error.message);
      return false;
    }
  }

  console.error('\n❌ No valid response received');
  return false;
}

// Run test
testMCPServer()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
