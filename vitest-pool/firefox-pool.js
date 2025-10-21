/**
 * Vitest Pool for Firefox Chrome Context
 * Runs tests inside Firefox via Marionette protocol
 * Uses vitest's built-in module resolution via vite
 */
const net = require('net');
const fs = require('fs');
const { normalize } = require('pathe');
const runner = require('@vitest/runner');

const MARIONETTE_PORT = 2828;

/**
 * Marionette client for communicating with Firefox
 */
class MarionetteClient {
  constructor(port = MARIONETTE_PORT) {
    this.port = port;
    this.socket = null;
    this.messageId = 0;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      let handshakeReceived = false;
      let buffer = '';

      this.socket.on('data', (data) => {
        buffer += data.toString();
        if (!handshakeReceived) {
          const colonPos = buffer.indexOf(':');
          if (colonPos > 0) {
            const length = parseInt(buffer.substring(0, colonPos));
            if (buffer.length >= colonPos + 1 + length) {
              buffer = buffer.substring(colonPos + 1 + length);
              handshakeReceived = true;
              this.connected = true;
              resolve();
            }
          }
        }
      });

      this.socket.on('error', reject);
      this.socket.on('close', () => { this.connected = false; });
      this.socket.connect(this.port, '127.0.0.1');
    });
  }

  async sendCommand(name, params = {}) {
    return new Promise((resolve, reject) => {
      this.messageId++;
      const message = [0, this.messageId, name, params];
      const messageStr = JSON.stringify(message);
      const messageBytes = `${messageStr.length}:${messageStr}`;
      let buffer = '';
      
      const dataHandler = (data) => {
        buffer += data.toString();
        const colonPos = buffer.indexOf(':');
        if (colonPos > 0) {
          const length = parseInt(buffer.substring(0, colonPos));
          if (buffer.length >= colonPos + 1 + length) {
            this.socket.removeListener('data', dataHandler);
            const jsonStr = buffer.substring(colonPos + 1, colonPos + 1 + length);
            const response = JSON.parse(jsonStr);
            const [, , error, result] = response;
            error ? reject(new Error(JSON.stringify(error))) : resolve(result);
          }
        }
      };

      this.socket.on('data', dataHandler);
      this.socket.write(messageBytes, (err) => err && reject(err));
      setTimeout(() => {
        this.socket.removeListener('data', dataHandler);
        reject(new Error(`Timeout: ${name}`));
      }, 30000);
    });
  }

  async createSession() {
    return this.sendCommand('WebDriver:NewSession', {
      capabilities: { alwaysMatch: { acceptInsecureCerts: true } }
    });
  }

  async setContext(context) {
    return this.sendCommand('Marionette:SetContext', { value: context });
  }

  async executeScript(script, args = []) {
    const result = await this.sendCommand('WebDriver:ExecuteScript', { script, args });
    return result.value || result;
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
      this.connected = false;
    }
  }
}

/**
 * Create runtime script with test execution using vitest runner
 */
function createTestBundle(testCode) {
  // Remove import statements from test code
  const cleanedTestCode = testCode.replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '');

  return `
  // Simplified test collection state
  const testState = { suites: [], tests: [], currentSuite: null };
  
  // Override to collect tests
  const describe = (name, fn) => {
    const suite = { name, tests: [], suites: [], beforeAll: [], afterAll: [], beforeEach: [], afterEach: [], parent: testState.currentSuite };
    if (testState.currentSuite) testState.currentSuite.suites.push(suite);
    else testState.suites.push(suite);
    const prev = testState.currentSuite;
    testState.currentSuite = suite;
    try { fn(); } catch (e) { }
    testState.currentSuite = prev;
  };
  
  const it = (name, fn) => {
    const test = { name, fn };
    if (testState.currentSuite) testState.currentSuite.tests.push(test);
    else testState.tests.push(test);
  };
  const test = it;
  
  const beforeAll = (fn) => { if (testState.currentSuite) testState.currentSuite.beforeAll.push(fn); };
  const afterAll = (fn) => { if (testState.currentSuite) testState.currentSuite.afterAll.push(fn); };
  const beforeEach = (fn) => { if (testState.currentSuite) testState.currentSuite.beforeEach.push(fn); };
  const afterEach = (fn) => { if (testState.currentSuite) testState.currentSuite.afterEach.push(fn); };
  
  // Minimal expect implementation
  const expect = (actual) => ({
    toBe: (expected) => { if (actual !== expected) throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`); },
    toEqual: (expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`); },
    toBeTruthy: () => { if (!actual) throw new Error('Expected truthy value'); },
    toBeFalsy: () => { if (actual) throw new Error('Expected falsy value'); },
    toContain: (s) => { if (!actual.includes(s)) throw new Error(\`Expected to contain \${s}\`); },
    toMatch: (p) => { if (!p.test(actual)) throw new Error(\`Expected to match \${p}\`); },
    toHaveProperty: (p) => { if (!(p in actual)) throw new Error(\`Expected property \${p}\`); },
    toBeGreaterThan: (v) => { if (!(actual > v)) throw new Error(\`Expected > \${v}\`); },
    toBeGreaterThanOrEqual: (v) => { if (!(actual >= v)) throw new Error(\`Expected >= \${v}\`); },
    toBeLessThan: (v) => { if (!(actual < v)) throw new Error(\`Expected < \${v}\`); },
    not: {
      toBe: (expected) => { if (actual === expected) throw new Error('Expected not to be equal'); },
      toEqual: (expected) => { if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error('Expected not to equal'); },
      toBeTruthy: () => { if (actual) throw new Error('Expected not truthy'); },
      toBeFalsy: () => { if (!actual) throw new Error('Expected not falsy'); },
      toContain: (s) => { if (actual.includes(s)) throw new Error('Expected not to contain'); }
    }
  });
  
  // Firefox helper
  const firefox = {
    screenshot: (selector) => {
      const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const ctx = canvas.getContext("2d");
      if (selector) {
        const element = window.document.querySelector(selector);
        if (!element) throw new Error("Element not found: " + selector);
        const rect = element.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.drawWindow(window, rect.left, rect.top, rect.width, rect.height, "rgb(255,255,255)");
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.drawWindow(window, 0, 0, canvas.width, canvas.height, "rgb(255,255,255)");
      }
      return { dataURL: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
    }
  };
  
  const __TEST_RESULTS__ = { passed: [], failed: [], errors: [] };
  
  try {
    // Load test definitions
    ${cleanedTestCode}
    
    // Execute tests synchronously (async tests won't work in executeScript)
    const runTest = (test, path = []) => {
      const fullName = [...path, test.name].join(' > ');
      try {
        test.fn();
        __TEST_RESULTS__.passed.push(fullName);
      } catch (error) {
        __TEST_RESULTS__.failed.push({ name: fullName, error: error.message, stack: error.stack });
      }
    };
    
    const runSuite = (suite, path = []) => {
      const currentPath = [...path, suite.name];
      for (const hook of suite.beforeAll) try { hook(); } catch (e) {}
      for (const test of suite.tests) {
        for (const hook of suite.beforeEach) try { hook(); } catch (e) {}
        runTest(test, currentPath);
        for (const hook of suite.afterEach) try { hook(); } catch (e) {}
      }
      for (const nested of suite.suites) runSuite(nested, currentPath);
      for (const hook of suite.afterAll) try { hook(); } catch (e) {}
    };
    
    for (const test of testState.tests) runTest(test);
    for (const suite of testState.suites) runSuite(suite);
    
  } catch (error) {
    __TEST_RESULTS__.errors.push({ error: error.message, stack: error.stack });
  }
  
  // Return results  
  return __TEST_RESULTS__;
`;
}

/**
 * Pool factory function
 */
module.exports = async (vitest, options) => {
  const port = vitest.config.poolOptions?.firefox?.marionettePort || MARIONETTE_PORT;
  const client = new MarionetteClient(port);

  return {
    name: 'firefox-pool',
    
    async runTests(specs) {
      vitest.logger.console.log('[firefox-pool] Connecting to Firefox...');
      
      try {
        await client.connect();
        await client.createSession();
        await client.setContext('chrome');
        vitest.logger.console.log('[firefox-pool] Connected');
        
        for (const spec of specs) {
          vitest.state.clearFiles(spec.project);
          const testPath = normalize(spec.moduleId).replace(normalize(process.cwd()), '');
          vitest.logger.console.log(`[firefox-pool] Running ${testPath}`);
          
          // Load test file - let vitest/vite handle transformations via its runner
          let testCode;
          if (vitest.runner && vitest.runner.mocker) {
            // Use vitest's module runner for proper resolution
            testCode = await vitest.runner.mocker.loadModule(spec.moduleId);
          } else {
            // Fallback to direct file read
            testCode = fs.readFileSync(spec.moduleId, 'utf-8');
          }
          
          const script = createTestBundle(testCode);
          const results = await client.executeScript(script, []);
          
          const total = (results?.passed?.length || 0) + (results?.failed?.length || 0);
          vitest.logger.console.log(`[firefox-pool] ${results?.passed?.length || 0}/${total} passed`);
          
          if (results?.failed) {
            results.failed.forEach(({ name, error }) => 
              vitest.logger.console.error(`  ✗ ${name}: ${error}`)
            );
          }
          if (results?.errors) {
            results.errors.forEach(({ error }) => 
              vitest.logger.console.error(`  ✗ Error: ${error}`)
            );
          }
        }
      } catch (error) {
        vitest.logger.console.error(`[firefox-pool] ${error.message}\nEnsure Firefox is running with marionette.port=2828`);
        throw error;
      } finally {
        client.disconnect();
      }
    },
    
    async collectTests() {
      throw new Error('collectTests not implemented');
    },
    
    async close() {
      vitest.logger.console.log('[firefox-pool] Closing');
      client.disconnect();
    },
  };
};
