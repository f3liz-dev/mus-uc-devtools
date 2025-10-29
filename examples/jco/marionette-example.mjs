/**
 * Example: Using Marionette connection via jco-transpiled WebAssembly Component
 * 
 * This example demonstrates how to execute JavaScript in Firefox chrome context
 * from Node.js using the Rust Marionette client.
 * 
 * Prerequisites:
 * 1. Run `npm run build:component` to generate the JS bindings
 * 2. Start Firefox with Marionette enabled on port 2828
 */

import { marionette } from '../../dist/mus_uc_devtools.js';

async function main() {
    console.log('Marionette Example\n');

    // Connect to Marionette
    console.log('1. Connecting to Marionette...');
    const connectResult = marionette.connect('localhost', 2828);
    
    if (connectResult.tag === 'err') {
        console.error('Failed to connect:', connectResult.val);
        console.error('\nMake sure Firefox is running with Marionette enabled on port 2828');
        process.exit(1);
    }
    console.log('   ✓', connectResult.val);

    // Execute a simple script
    console.log('\n2. Getting browser information...');
    const browserInfoScript = `
        const window = Services.wm.getMostRecentWindow("navigator:browser");
        return {
            title: window.document.title,
            url: window.gBrowser.currentURI.spec,
            userAgent: window.navigator.userAgent,
            version: Services.appinfo.version
        };
    `;
    
    const infoResult = marionette.executeScript(browserInfoScript);
    
    if (infoResult.tag === 'ok') {
        const info = JSON.parse(infoResult.val);
        console.log('   Browser Info:');
        console.log('   - Title:', info.title);
        console.log('   - URL:', info.url);
        console.log('   - Version:', info.version);
    } else {
        console.error('   Failed to get info:', infoResult.val);
    }

    // Execute script with arguments
    console.log('\n3. Executing script with arguments...');
    const calcScript = `
        const x = arguments[0];
        const y = arguments[1];
        return {
            sum: x + y,
            product: x * y,
            message: \`Calculated: \${x} + \${y} = \${x + y}\`
        };
    `;
    
    const args = JSON.stringify([10, 20]);
    const calcResult = marionette.executeScript(calcScript, args);
    
    if (calcResult.tag === 'ok') {
        const result = JSON.parse(calcResult.val);
        console.log('   Calculation result:', result);
    } else {
        console.error('   Failed to execute:', calcResult.val);
    }

    // List all tabs
    console.log('\n4. Listing all browser tabs...');
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
        const tabsData = JSON.parse(tabsResult.val);
        console.log(\`   Found \${tabsData.count} tab(s):\`);
        tabsData.tabs.forEach((tab, i) => {
            const marker = tab.selected ? '→' : ' ';
            console.log(\`   \${marker} [\${i + 1}] \${tab.title}\`);
            console.log(\`       \${tab.url}\`);
        });
    } else {
        console.error('   Failed to list tabs:', tabsResult.val);
    }

    console.log('\n✓ Example completed successfully!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
