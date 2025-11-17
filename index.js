#!/usr/bin/env node

/**
 * mus-uc-devtools
 * A tool to develop userChrome CSS for Firefox using the Marionette protocol
 * 
 * This package provides a WASI-compiled binary that can be run with Node.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Export the path to the WASI binary for programmatic use
export const wasmPath = resolve(__dirname, 'bin', 'mus-uc.wasm');
export const wasmBuffer = () => readFileSync(resolve(__dirname, 'bin', 'mus-uc.wasm'));

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('mus-uc-devtools WASI binary location:', wasmPath);
  console.log('\nTo run the WASI binary, use a WASI-compatible runtime such as:');
  console.log('  - wasmtime: https://wasmtime.dev/');
  console.log('  - wasmer: https://wasmer.io/');
  console.log('\nExample:');
  console.log(`  wasmtime ${wasmPath} -- --help`);
  console.log('\nOr run the MCP server for LLM integration:');
  console.log('  npm run mcp');
}
