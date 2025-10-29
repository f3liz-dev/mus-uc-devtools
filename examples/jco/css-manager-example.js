/**
 * Example: Using CSS Manager via jco-transpiled WebAssembly Component
 * 
 * This example demonstrates how to use the Rust CSS manager from JavaScript.
 * 
 * Prerequisites:
 * 1. Run `npm run build:component` to generate the JS bindings
 * 2. Start Firefox with Marionette enabled on port 2828
 */

import { cssManager } from '../../dist/mus_uc_devtools.js';

async function main() {
    console.log('CSS Manager Example\n');

    // Initialize the CSS manager
    console.log('1. Initializing CSS manager...');
    const initResult = cssManager.initialize();
    
    if (initResult.tag === 'err') {
        console.error('Failed to initialize:', initResult.val);
        console.error('\nMake sure Firefox is running with Marionette enabled on port 2828');
        process.exit(1);
    }
    console.log('   ✓ Initialized:', initResult.val);

    // Load some CSS
    console.log('\n2. Loading CSS...');
    const css = `
        #nav-bar {
            background: linear-gradient(to right, #667eea, #764ba2) !important;
        }
        
        .tab-background {
            background: #1a1a1a !important;
        }
    `;
    
    const loadResult = cssManager.loadCss(css, 'example-theme');
    
    if (loadResult.tag === 'err') {
        console.error('Failed to load CSS:', loadResult.val);
        process.exit(1);
    }
    console.log('   ✓ CSS loaded with ID:', loadResult.val);

    // List loaded CSS
    console.log('\n3. Listing loaded CSS...');
    const listResult = cssManager.listLoaded();
    
    if (listResult.tag === 'ok') {
        console.log('   Loaded CSS IDs:', listResult.val);
    }

    // Wait a bit so you can see the changes
    console.log('\n4. Waiting 5 seconds (check Firefox to see the changes)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Unload the CSS
    console.log('\n5. Unloading CSS...');
    const unloadResult = cssManager.unloadCss('example-theme');
    
    if (unloadResult.tag === 'ok' && unloadResult.val) {
        console.log('   ✓ CSS unloaded successfully');
    } else {
        console.log('   ✗ Failed to unload CSS');
    }

    // Verify it's gone
    const finalListResult = cssManager.listLoaded();
    if (finalListResult.tag === 'ok') {
        console.log('   Remaining CSS IDs:', finalListResult.val);
    }

    console.log('\n✓ Example completed successfully!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
