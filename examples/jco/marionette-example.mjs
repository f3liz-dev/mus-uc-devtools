/**
 * Example: Marionette via jco WebAssembly Component
 * 
 * Prerequisites:
 * 1. Run `npm run build:component`
 * 2. Start Firefox with Marionette enabled on port 2828
 */

import { marionette } from '../../dist/mus_uc_devtools.js';

async function main() {
    console.log('Marionette Example\n');

    // Connect
    console.log('1. Connecting...');
    const connectResult = marionette.connect('localhost', 2828);
    if (connectResult.tag === 'err') {
        console.error('Failed:', connectResult.val);
        console.error('\nEnsure Firefox is running with Marionette on port 2828');
        process.exit(1);
    }
    console.log('   ✓', connectResult.val);

    // Get browser info
    console.log('\n2. Getting browser info...');
    const infoScript = `
        const window = Services.wm.getMostRecentWindow("navigator:browser");
        return {
            title: window.document.title,
            url: window.gBrowser.currentURI.spec,
            version: Services.appinfo.version
        };
    `;
    
    const infoResult = marionette.executeScript(infoScript);
    if (infoResult.tag === 'ok') {
        const info = JSON.parse(infoResult.val);
        console.log('   Title:', info.title);
        console.log('   URL:', info.url);
        console.log('   Version:', info.version);
    } else {
        console.error('   Failed:', infoResult.val);
    }

    // Execute with arguments
    console.log('\n3. Script with arguments...');
    const calcScript = `
        const x = arguments[0], y = arguments[1];
        return { sum: x + y, product: x * y, message: 'Result: ' + (x + y) };
    `;
    
    const calcResult = marionette.executeScript(calcScript, JSON.stringify([10, 20]));
    if (calcResult.tag === 'ok') {
        console.log('   Result:', JSON.parse(calcResult.val));
    } else {
        console.error('   Failed:', calcResult.val);
    }

    // List tabs
    console.log('\n4. Listing tabs...');
    const tabsScript = `
        const window = Services.wm.getMostRecentWindow("navigator:browser");
        const tabs = [];
        for (let tab of window.gBrowser.tabs) {
            tabs.push({
                title: tab.label,
                url: tab.linkedBrowser.currentURI.spec,
                selected: tab.selected
            });
        }
        return { count: tabs.length, tabs: tabs };
    `;
    
    const tabsResult = marionette.executeScript(tabsScript);
    if (tabsResult.tag === 'ok') {
        const data = JSON.parse(tabsResult.val);
        console.log(`   Found ${data.count} tab(s):`);
        data.tabs.forEach((tab, i) => {
            const marker = tab.selected ? '→' : ' ';
            console.log(`   ${marker} [${i + 1}] ${tab.title}`);
            console.log(`       ${tab.url}`);
        });
    } else {
        console.error('   Failed:', tabsResult.val);
    }

    console.log('\n✓ Completed successfully!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
