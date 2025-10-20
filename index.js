#!/usr/bin/env node

/**
 * mus-uc-devtools
 * A tool to develop userChrome CSS for Firefox using the Marionette protocol
 * 
 * This package provides a WASI-compiled binary that can be run with Node.js
 */

const { readFileSync } = require('fs');
const { resolve } = require('path');

// Export the path to the WASI binary for programmatic use
module.exports = {
  wasmPath: resolve(__dirname, 'bin', 'mus-uc.wasm'),
  wasmBuffer: () => readFileSync(resolve(__dirname, 'bin', 'mus-uc.wasm'))
};

// CLI execution
if (require.main === module) {
  console.log('mus-uc-devtools WASI binary location:', module.exports.wasmPath);
  console.log('\nTo run the WASI binary, use a WASI-compatible runtime such as:');
  console.log('  - wasmtime: https://wasmtime.dev/');
  console.log('  - wasmer: https://wasmer.io/');
  console.log('\nExample:');
  console.log(`  wasmtime ${module.exports.wasmPath} -- --help`);
}
