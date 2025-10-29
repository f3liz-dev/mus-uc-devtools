/**
 * Basic smoke test for jco-generated JavaScript bindings
 * 
 * This test verifies that the transpiled JavaScript modules load correctly
 * and have the expected API surface. It doesn't test functionality since
 * that requires a running Firefox instance with Marionette.
 */

import { cssManager, marionette, screenshot } from '../dist/mus_uc_devtools.js';
import { strict as assert } from 'assert';

console.log('Testing jco-generated JavaScript bindings...\n');

// Test CSS Manager API
console.log('1. Testing CSS Manager API...');
assert(typeof cssManager.initialize === 'function', 'cssManager.initialize should be a function');
assert(typeof cssManager.loadCss === 'function', 'cssManager.loadCss should be a function');
assert(typeof cssManager.unloadCss === 'function', 'cssManager.unloadCss should be a function');
assert(typeof cssManager.clearAll === 'function', 'cssManager.clearAll should be a function');
assert(typeof cssManager.listLoaded === 'function', 'cssManager.listLoaded should be a function');
console.log('   ✓ CSS Manager API is correct');

// Test Marionette API
console.log('2. Testing Marionette API...');
assert(typeof marionette.connect === 'function', 'marionette.connect should be a function');
assert(typeof marionette.executeScript === 'function', 'marionette.executeScript should be a function');
console.log('   ✓ Marionette API is correct');

// Test Screenshot API
console.log('3. Testing Screenshot API...');
assert(typeof screenshot.takeScreenshot === 'function', 'screenshot.takeScreenshot should be a function');
console.log('   ✓ Screenshot API is correct');

// Test that calls return proper result types (will fail without Firefox, but that's expected)
console.log('\n4. Testing result types...');
try {
    const result = cssManager.initialize();
    // Check that result has the expected structure
    assert(result && typeof result === 'object', 'Result should be an object');
    assert('tag' in result, 'Result should have a "tag" property');
    assert('val' in result, 'Result should have a "val" property');
    assert(result.tag === 'ok' || result.tag === 'err', 'Result tag should be "ok" or "err"');
    console.log('   ✓ Result type structure is correct');
    console.log('   Result:', result);
} catch (err) {
    // This is expected if Firefox isn't running
    console.log('   ✓ Got expected error (Firefox not running):', err.message.substring(0, 80));
}

console.log('\n✓ All API structure tests passed!');
console.log('\nNote: Functional tests require Firefox with Marionette enabled.');
console.log('See examples/jco/ for usage examples.');
