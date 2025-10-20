#!/usr/bin/env node
/**
 * Headless Firefox test for mus-uc-devtools
 * 
 * This test:
 * 1. Downloads Firefox binary using @puppeteer/browsers
 * 2. Starts Firefox in headless mode with marionette enabled
 * 3. Connects via marionette protocol
 * 4. Loads test CSS into Firefox chrome context
 * 5. Verifies CSS is applied using JavaScript
 */

const { install, canDownload } = require('@puppeteer/browsers');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const FIREFOX_CACHE_DIR = path.join(__dirname, '..', '.firefox-cache');
const MARIONETTE_PORT = 2828;
const TEST_TIMEOUT = 60000; // 60 seconds

/**
 * Get or download Firefox binary
 */
async function getFirefoxPath() {
    console.log('Checking Firefox binary...');
    
    // First, try to use system Firefox
    const { execSync } = require('child_process');
    try {
        const systemFirefoxPath = execSync('which firefox', { encoding: 'utf-8' }).trim();
        if (systemFirefoxPath && fs.existsSync(systemFirefoxPath)) {
            console.log(`Using system Firefox: ${systemFirefoxPath}`);
            const version = execSync(`${systemFirefoxPath} --version`, { encoding: 'utf-8' }).trim();
            console.log(`Firefox version: ${version}`);
            return systemFirefoxPath;
        }
    } catch (e) {
        console.log('System Firefox not found, will try to download...');
    }
    
    // If system Firefox is not available, try to download
    const { Browser, detectBrowserPlatform, resolveBuildId } = require('@puppeteer/browsers');
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(FIREFOX_CACHE_DIR)) {
        fs.mkdirSync(FIREFOX_CACHE_DIR, { recursive: true });
    }

    const platform = detectBrowserPlatform();
    console.log(`Detected platform: ${platform}`);
    
    // Try to resolve build ID for stable channel
    let buildId;
    try {
        buildId = await resolveBuildId(Browser.FIREFOX, platform, 'stable');
        console.log(`Resolved buildId: ${buildId}`);
    } catch (e) {
        console.log('Could not resolve build ID, using fallback version');
        buildId = '129.0'; // Fallback to a known stable version
    }
    
    // Check if we can download
    const available = await canDownload({
        browser: Browser.FIREFOX,
        buildId,
        platform,
        cacheDir: FIREFOX_CACHE_DIR,
    });

    if (!available) {
        throw new Error('Firefox is not available for download and system Firefox not found');
    }

    console.log('Downloading Firefox...');
    const result = await install({
        browser: Browser.FIREFOX,
        buildId,
        platform,
        cacheDir: FIREFOX_CACHE_DIR,
    });

    console.log(`Firefox installed at: ${result.executablePath}`);
    return result.executablePath;
}

/**
 * Wait for a TCP port to be open
 */
function waitForPort(port, timeout = 30000) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout waiting for port ${port}`));
                return;
            }

            const client = new net.Socket();
            
            client.connect(port, '127.0.0.1', () => {
                client.end();
                resolve();
            });

            client.on('error', () => {
                client.destroy();
                setTimeout(tryConnect, 500);
            });
        };

        tryConnect();
    });
}

/**
 * Create a Firefox profile with marionette enabled
 */
function createFirefoxProfile() {
    const profileDir = path.join(FIREFOX_CACHE_DIR, 'test-profile');
    
    // Create profile directory if it doesn't exist
    if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
    }
    
    // Create prefs.js with marionette enabled
    const prefsContent = `
// Enable marionette
user_pref("marionette.port", ${MARIONETTE_PORT});
user_pref("marionette.enabled", true);
user_pref("marionette.defaultPrefs.enabled", true);

// Disable some features that might interfere with testing
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "about:blank");
user_pref("startup.homepage_welcome_url.additional", "");

// Disable updates
user_pref("app.update.enabled", false);
user_pref("app.update.auto", false);
user_pref("app.update.mode", 0);
user_pref("app.update.service.enabled", false);

// Disable telemetry
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.prompted", 2);
user_pref("toolkit.telemetry.rejected", true);
`;
    
    fs.writeFileSync(path.join(profileDir, 'prefs.js'), prefsContent.trim());
    console.log(`Created Firefox profile at: ${profileDir}`);
    
    return profileDir;
}

/**
 * Start Firefox with marionette enabled
 */
async function startFirefox(executablePath) {
    console.log('Starting Firefox in headless mode...');
    
    const profileDir = createFirefoxProfile();
    
    const args = [
        '--headless',
        '--marionette',
        '--no-remote',
        '--remote-allow-system-access',  // Required for chrome context access
        '--profile', profileDir,
    ];

    const firefox = spawn(executablePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            MOZ_HEADLESS: '1',
            MOZ_HEADLESS_WIDTH: '1920',
            MOZ_HEADLESS_HEIGHT: '1080',
        }
    });

    // Log Firefox output for debugging
    firefox.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            console.log(`Firefox stdout: ${output}`);
        }
    });

    firefox.stderr.on('data', (data) => {
        const message = data.toString().trim();
        // Only log important messages
        if (message && (message.includes('Listening on port') || 
                       message.includes('Marionette') ||
                       message.toLowerCase().includes('error'))) {
            console.log(`Firefox stderr: ${message}`);
        }
    });

    firefox.on('exit', (code) => {
        console.log(`Firefox process exited with code ${code}`);
    });

    // Wait for marionette to be ready
    console.log('Waiting for marionette to be ready...');
    await waitForPort(MARIONETTE_PORT);
    
    // Give it a bit more time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Firefox is ready!');
    return firefox;
}

/**
 * Simple Marionette protocol client
 */
class MarionetteClient {
    constructor(port = MARIONETTE_PORT) {
        this.port = port;
        this.socket = null;
        this.messageId = 0;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            
            let handshakeReceived = false;
            let buffer = '';

            this.socket.on('data', (data) => {
                buffer += data.toString();
                
                if (!handshakeReceived) {
                    // Parse the handshake: format is "len:json"
                    const colonPos = buffer.indexOf(':');
                    if (colonPos > 0) {
                        const length = parseInt(buffer.substring(0, colonPos));
                        if (buffer.length >= colonPos + 1 + length) {
                            const jsonStr = buffer.substring(colonPos + 1, colonPos + 1 + length);
                            try {
                                const handshake = JSON.parse(jsonStr);
                                console.log('Marionette handshake:', handshake);
                                handshakeReceived = true;
                                buffer = buffer.substring(colonPos + 1 + length); // Keep remaining data
                                resolve();
                            } catch (e) {
                                reject(new Error(`Failed to parse handshake: ${e.message}`));
                            }
                        }
                    }
                }
            });

            this.socket.on('error', (err) => {
                reject(err);
            });

            this.socket.connect(this.port, '127.0.0.1');
        });
    }

    async sendCommand(name, params = {}) {
        return new Promise((resolve, reject) => {
            this.messageId++;
            const message = [
                0,  // MessageDirection::Incoming (client to server)
                this.messageId,
                name,
                params
            ];

            const messageStr = JSON.stringify(message);
            const messageBytes = `${messageStr.length}:${messageStr}`;
            
            console.log(`Sending command: ${name}`);

            let buffer = '';
            
            const dataHandler = (data) => {
                buffer += data.toString();
                
                // Check if we have a complete response
                const colonPos = buffer.indexOf(':');
                if (colonPos > 0) {
                    const length = parseInt(buffer.substring(0, colonPos));
                    if (buffer.length >= colonPos + 1 + length) {
                        const jsonStr = buffer.substring(colonPos + 1, colonPos + 1 + length);
                        this.socket.removeListener('data', dataHandler);
                        
                        try {
                            const response = JSON.parse(jsonStr);
                            
                            // Response is also a tuple: [direction, id, error_or_null, result]
                            // direction: 1 (outgoing, server to client)
                            // id: message id
                            // error: null or error object
                            // result: the actual result value
                            if (Array.isArray(response)) {
                                const [direction, id, error, result] = response;
                                if (error) {
                                    reject(new Error(`Marionette error: ${JSON.stringify(error)}`));
                                } else {
                                    resolve(result);
                                }
                            } else {
                                // Fallback to old format
                                if (response.error) {
                                    reject(new Error(`Marionette error: ${JSON.stringify(response.error)}`));
                                } else {
                                    resolve(response.value);
                                }
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse response: ${e.message}`));
                        }
                    }
                }
            };

            this.socket.on('data', dataHandler);
            
            this.socket.write(messageBytes, (err) => {
                if (err) {
                    this.socket.removeListener('data', dataHandler);
                    reject(err);
                }
            });

            // Timeout
            setTimeout(() => {
                this.socket.removeListener('data', dataHandler);
                reject(new Error(`Command timeout: ${name}`));
            }, 10000);
        });
    }

    async createSession() {
        const caps = {
            capabilities: {
                alwaysMatch: {
                    acceptInsecureCerts: true
                }
            }
        };
        const result = await this.sendCommand('WebDriver:NewSession', caps);
        console.log('Session created:', result);
        return result;
    }

    async setContext(context) {
        // Use Marionette:SetContext (as per the Rust implementation)
        await this.sendCommand('Marionette:SetContext', { value: context });
    }

    async executeScript(script, args = []) {
        return await this.sendCommand('WebDriver:ExecuteScript', {
            script,
            args
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.end();
        }
    }
}

/**
 * Test CSS loading via marionette
 */
async function testCSSLoading(client) {
    console.log('\n=== Testing CSS Loading ===');
    
    // Switch to chrome context
    console.log('Switching to chrome context...');
    await client.setContext('chrome');
    
    // Test CSS content
    const testCSS = `
        #nav-bar {
            background-color: red !important;
        }
    `;
    
    // Load CSS using nsIStyleSheetService
    console.log('Loading test CSS...');
    const loadScript = `
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
        
        const testId = "test-stylesheet-" + Date.now();
        const cssStr = arguments[0];
        
        const uri = Services.io.newURI("data:text/css," + encodeURIComponent(cssStr));
        
        if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
            sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
        }
        
        return { success: true, id: testId, uri: uri.spec };
    `;
    
    const loadResult = await client.executeScript(loadScript, [testCSS]);
    console.log('CSS loaded:', loadResult);
    
    // Extract the actual result value
    const cssData = loadResult.value || loadResult;
    
    // Verify CSS is applied by checking if the stylesheet is registered
    console.log('Verifying CSS is applied...');
    const verifyScript = `
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
        
        const uriStr = arguments[0];
        const uri = Services.io.newURI(uriStr);
        
        const isRegistered = sss.sheetRegistered(uri, sss.USER_SHEET);
        
        return { 
            isRegistered,
            uriStr 
        };
    `;
    
    const verifyResult = await client.executeScript(verifyScript, [cssData.uri]);
    console.log('Verification result:', verifyResult);
    
    // Extract the actual result value
    const verifyData = verifyResult.value || verifyResult;
    
    if (!verifyData.isRegistered) {
        throw new Error('CSS stylesheet is not registered!');
    }
    
    console.log('✓ CSS is successfully applied!');
    
    // Clean up - unregister the stylesheet
    console.log('Cleaning up...');
    const cleanupScript = `
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
        
        const uriStr = arguments[0];
        const uri = Services.io.newURI(uriStr);
        
        if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
            sss.unregisterSheet(uri, sss.USER_SHEET);
        }
        
        return { unregistered: true };
    `;
    
    await client.executeScript(cleanupScript, [cssData.uri]);
    console.log('✓ Cleanup completed');
    
    return true;
}

/**
 * Test JavaScript execution functionality
 */
async function testJavaScriptExecution(client) {
    console.log('\n=== Testing JavaScript Execution ===');
    
    // Switch to chrome context
    console.log('Switching to chrome context...');
    await client.setContext('chrome');
    
    // Test 1: Simple script execution
    console.log('Test 1: Simple script execution...');
    const simpleScript = `
        return { message: "Hello from Firefox!", timestamp: Date.now() };
    `;
    
    const simpleResult = await client.executeScript(simpleScript, []);
    const simpleData = simpleResult.value || simpleResult;
    
    if (!simpleData.message || !simpleData.timestamp) {
        throw new Error('Simple script did not return expected result');
    }
    
    console.log('✓ Simple script executed successfully:', simpleData.message);
    
    // Test 2: Script with arguments
    console.log('Test 2: Script with arguments...');
    const argsScript = `
        const name = arguments[0];
        const count = arguments[1];
        return { greeting: "Hello " + name + "!", doubled: count * 2 };
    `;
    
    const argsResult = await client.executeScript(argsScript, ["Firefox", 21]);
    const argsData = argsResult.value || argsResult;
    
    if (argsData.greeting !== "Hello Firefox!" || argsData.doubled !== 42) {
        throw new Error('Script with arguments did not return expected result');
    }
    
    console.log('✓ Script with arguments executed successfully:', argsData.greeting);
    
    // Test 3: Chrome context API access
    console.log('Test 3: Chrome context API access...');
    const chromeScript = `
        const window = Services.wm.getMostRecentWindow("navigator:browser");
        const doc = window.document;
        
        return {
            hasWindow: !!window,
            hasDocument: !!doc,
            userAgent: window.navigator.userAgent
        };
    `;
    
    const chromeResult = await client.executeScript(chromeScript, []);
    const chromeData = chromeResult.value || chromeResult;
    
    if (!chromeData.hasWindow || !chromeData.hasDocument || !chromeData.userAgent) {
        throw new Error('Chrome context APIs not accessible');
    }
    
    console.log('✓ Chrome context APIs accessible');
    console.log('  User Agent:', chromeData.userAgent.substring(0, 50) + '...');
    
    console.log('✓ All JavaScript execution tests passed!');
    
    return true;
}

/**
 * Test screenshot functionality
 */
async function testScreenshot(client) {
    console.log('\n=== Testing Screenshot Functionality ===');
    
    // Switch to chrome context
    console.log('Switching to chrome context...');
    await client.setContext('chrome');
    
    // Test full-screen screenshot
    console.log('Taking full-screen screenshot...');
    const fullScreenScript = `
        let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
        let window = Services.wm.getMostRecentWindow("navigator:browser");
        let width = window.innerWidth;
        let height = window.innerHeight;

        canvas.width = width;
        canvas.height = height;

        let ctx = canvas.getContext("2d");
        ctx.drawWindow(window, 0, 0, width, height, "rgb(255,255,255)");

        // Convert to data URL
        let dataURL = canvas.toDataURL("image/png");
        return { dataURL, width, height };
    `;
    
    const result = await client.executeScript(fullScreenScript, []);
    const screenshotData = result.value || result;
    
    console.log(`Screenshot taken: ${screenshotData.width}x${screenshotData.height}`);
    
    // Verify the data URL is valid
    if (!screenshotData.dataURL || !screenshotData.dataURL.startsWith('data:image/png;base64,')) {
        throw new Error('Invalid screenshot data URL format');
    }
    
    console.log('✓ Full-screen screenshot captured successfully!');
    
    // Test element screenshot
    console.log('Testing element screenshot with CSS selector...');
    const elementScreenshotScript = `
        let window = Services.wm.getMostRecentWindow("navigator:browser");
        let doc = window.document;
        
        // Try to find the navigation bar
        let element = doc.querySelector("#nav-bar");
        
        if (!element) {
            // If nav-bar doesn't exist, try other common elements
            element = doc.querySelector("toolbar") || doc.querySelector("*");
        }
        
        if (!element) {
            throw new Error("No element found for screenshot");
        }
        
        // Get element position and dimensions
        let rect = element.getBoundingClientRect();
        
        // Create canvas
        let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
        canvas.width = rect.width;
        canvas.height = rect.height;

        let ctx = canvas.getContext("2d");
        ctx.drawWindow(window, rect.left, rect.top, rect.width, rect.height, "rgb(255,255,255)");

        // Convert to data URL
        let dataURL = canvas.toDataURL("image/png");
        return { dataURL, width: rect.width, height: rect.height };
    `;
    
    const elementResult = await client.executeScript(elementScreenshotScript, []);
    const elementData = elementResult.value || elementResult;
    
    console.log(`Element screenshot taken: ${elementData.width}x${elementData.height}`);
    
    // Verify the data URL is valid
    if (!elementData.dataURL || !elementData.dataURL.startsWith('data:image/png;base64,')) {
        throw new Error('Invalid element screenshot data URL format');
    }
    
    console.log('✓ Element screenshot captured successfully!');
    
    return true;
}

/**
 * Main test function
 */
async function runTest() {
    let firefox = null;
    let client = null;
    
    try {
        // Get Firefox path
        const executablePath = await getFirefoxPath();
        
        // Start Firefox
        firefox = await startFirefox(executablePath);
        
        // Connect to marionette
        client = new MarionetteClient(MARIONETTE_PORT);
        console.log('\nConnecting to marionette...');
        await client.connect();
        console.log('✓ Connected to marionette');
        
        // Create session
        console.log('Creating WebDriver session...');
        await client.createSession();
        console.log('✓ Session created');
        
        // Run CSS loading test
        await testCSSLoading(client);
        
        // Run JavaScript execution test
        await testJavaScriptExecution(client);
        
        // Run screenshot test
        await testScreenshot(client);
        
        console.log('\n✅ All tests passed!');
        return true;
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
        
    } finally {
        // Cleanup
        console.log('\nCleaning up...');
        
        if (client) {
            client.disconnect();
        }
        
        if (firefox) {
            firefox.kill('SIGTERM');
            
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force kill if still running
            if (!firefox.killed) {
                firefox.kill('SIGKILL');
            }
        }
    }
}

// Run the test
runTest()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
