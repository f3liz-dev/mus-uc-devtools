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
 * Create runtime script that bundles vitest APIs and test code
 */
function createTestBundle(testCode) {
  // Extract vitest runner functions as strings to inject into Firefox
  const runnerFunctions = `
    const describe = ${runner.describe.toString()};
    const it = ${runner.it.toString()};
    const test = ${runner.test.toString()};
    const beforeAll = ${runner.beforeAll.toString()};
    const afterAll = ${runner.afterAll.toString()};
    const beforeEach = ${runner.beforeEach.toString()};
    const afterEach = ${runner.afterEach.toString()};
    
    // Simple expect implementation
    const expect = (actual) => ({
      toBe: (expected) => { 
        if (actual !== expected) throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      },
      toEqual: (expected) => { 
        if (JSON.stringify(actual) !== JSON.stringify(expected)) 
          throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      },
      toBeTruthy: () => { if (!actual) throw new Error(\`Expected truthy but got \${JSON.stringify(actual)}\`); },
      toBeFalsy: () => { if (actual) throw new Error(\`Expected falsy but got \${JSON.stringify(actual)}\`); },
      toContain: (s) => { if (!actual.includes(s)) throw new Error(\`Expected to contain \${JSON.stringify(s)}\`); },
      toMatch: (p) => { if (!p.test(actual)) throw new Error(\`Expected to match \${p}\`); },
      toHaveProperty: (p) => { if (!(p in actual)) throw new Error(\`Expected property \${p}\`); },
      toBeGreaterThan: (v) => { if (!(actual > v)) throw new Error(\`Expected > \${v} but got \${actual}\`); },
      toBeGreaterThanOrEqual: (v) => { if (!(actual >= v)) throw new Error(\`Expected >= \${v} but got \${actual}\`); },
      toBeLessThan: (v) => { if (!(actual < v)) throw new Error(\`Expected < \${v} but got \${actual}\`); },
      not: {
        toBe: (expected) => { if (actual === expected) throw new Error(\`Expected not to be \${JSON.stringify(expected)}\`); },
        toEqual: (expected) => { if (JSON.stringify(actual) === JSON.stringify(expected)) throw new Error(\`Expected not to equal \${JSON.stringify(expected)}\`); },
        toBeTruthy: () => { if (actual) throw new Error(\`Expected not to be truthy\`); },
        toBeFalsy: () => { if (!actual) throw new Error(\`Expected not to be falsy\`); },
        toContain: (s) => { if (actual.includes(s)) throw new Error(\`Expected not to contain \${JSON.stringify(s)}\`); }
      }
    });
    
    // Firefox-specific helper
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
  `;

  // Remove import statements from test code as we're bundling
  const cleanedTestCode = testCode.replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '');

  return `
(async function() {
  ${runnerFunctions}
  
  globalThis.__TEST_RESULTS__ = { passed: [], failed: [], errors: [] };
  
  try {
    // Run test code
    ${cleanedTestCode}
    
    // Use vitest runner to execute tests
    const files = [{ file: 'test', tasks: globalThis.tests || [] }];
    await startTests(files, runner);
    
  } catch (error) {
    globalThis.__TEST_RESULTS__.errors.push({ error: error.message, stack: error.stack });
  }
  
  return globalThis.__TEST_RESULTS__;
})();
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
