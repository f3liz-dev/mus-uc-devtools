/**
 * Example: CSS Manager via jco WebAssembly Component
 * 
 * Prerequisites:
 * 1. Run `npm run build:component`
 * 2. Start Firefox with Marionette enabled on port 2828
 */

import { cssManager } from '../../dist/mus_uc_devtools.js';

async function main() {
    console.log('CSS Manager Example\n');

    // Initialize
    console.log('1. Initializing...');
    const initResult = cssManager.initialize();
    if (initResult.tag === 'err') {
        console.error('Failed:', initResult.val);
        console.error('\nEnsure Firefox is running with Marionette on port 2828');
        process.exit(1);
    }
    console.log('   ✓', initResult.val);

    // Load CSS
    console.log('\n2. Loading CSS...');
    const css = `
        #nav-bar { background: linear-gradient(to right, #667eea, #764ba2) !important; }
        .tab-background { background: #1a1a1a !important; }
    `;
    
    const loadResult = cssManager.loadCss(css, 'example-theme');
    if (loadResult.tag === 'err') {
        console.error('Failed:', loadResult.val);
        process.exit(1);
    }
    console.log('   ✓ Loaded with ID:', loadResult.val);

    // List loaded sheets
    console.log('\n3. Listing loaded CSS...');
    const listResult = cssManager.listLoaded();
    if (listResult.tag === 'ok') {
        console.log('   Loaded IDs:', listResult.val);
    }

    // Wait to see changes
    console.log('\n4. Waiting 5 seconds (check Firefox)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Unload
    console.log('\n5. Unloading CSS...');
    const unloadResult = cssManager.unloadCss('example-theme');
    console.log(unloadResult.tag === 'ok' && unloadResult.val ? '   ✓ Unloaded' : '   ✗ Failed');

    // Verify
    const finalList = cssManager.listLoaded();
    if (finalList.tag === 'ok') {
        console.log('   Remaining:', finalList.val);
    }

    console.log('\n✓ Completed successfully!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
