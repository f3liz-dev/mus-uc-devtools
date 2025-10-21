/**
 * Vitest Pool for Firefox Chrome Context
 * Runs tests inside Firefox via Marionette protocol
 */
const net = require('net');
const { normalize } = require('pathe');
const fs = require('fs');

const MARIONETTE_PORT = 2828;

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

class FirefoxTestRunner {
  constructor(client, vitest) {
    this.client = client;
    this.vitest = vitest;
  }

  async runTestFile(spec) {
    const testCode = fs.readFileSync(spec.moduleId, 'utf-8');
    // Remove ES6 import statements since they can't be used in executeScript context
    const strippedTestCode = testCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    const wrapperScript = `
      // Set up global test context
      const testResults = {
        passed: [],
        failed: [],
        errors: []
      };

      // Mock vitest functions that will be available in tests
      const testHooks = {
        beforeAll: [],
        afterAll: []
      };

      const beforeAll = (fn) => {
        testHooks.beforeAll.push(fn);
      };

      const afterAll = (fn) => {
        testHooks.afterAll.push(fn);
      };

      const describe = (name, fn) => {
        try {
          fn();
        } catch (error) {
          testResults.errors.push({ suite: name, error: error.toString() });
        }
      };

      const it = (name, fn) => {
        try {
          // Execute test function
          const result = fn();
          
          // Handle async tests
          if (result && typeof result.then === 'function') {
            return result
              .then(() => {
                testResults.passed.push(name);
              })
              .catch((error) => {
                testResults.failed.push({ name, error: error.toString() });
              });
          } else {
            testResults.passed.push(name);
          }
        } catch (error) {
          testResults.failed.push({ name, error: error.toString() });
        }
      };

      const expect = (actual) => ({
        toBe: (expected) => { if (actual !== expected) throw new Error(\`Expected \${expected} but got \${actual}\`); },
        toEqual: (expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(\`Expected \${expected} but got \${actual}\`); },
        toBeTruthy: () => { if (!actual) throw new Error(\`Expected truthy but got \${actual}\`); },
        toContain: (s) => { if (!actual.includes(s)) throw new Error(\`Expected to contain \${s}\`); },
        toMatch: (p) => { if (!p.test(actual)) throw new Error(\`Expected to match \${p}\`); },
        toHaveProperty: (p) => { if (!(p in actual)) throw new Error(\`Expected property \${p}\`); },
        toBeGreaterThan: (v) => { if (!(actual > v)) throw new Error(\`Expected > \${v}\`); },
      });

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

      // Run beforeAll hooks
      testHooks.beforeAll.forEach(fn => {
        try {
          fn();
        } catch (error) {
          testResults.errors.push({ suite: 'beforeAll', error: error.toString() });
        }
      });

      ${strippedTestCode}

      // Run afterAll hooks
      testHooks.afterAll.forEach(fn => {
        try {
          fn();
        } catch (error) {
          testResults.errors.push({ suite: 'afterAll', error: error.toString() });
        }
      });

      return testResults;
    `;

    try {
      const results = await this.client.executeScript(wrapperScript, []);
      return {
        passed: results.passed || [],
        failed: results.failed || [],
        errors: results.errors || []
      };
    } catch (error) {
      return { passed: [], failed: [], errors: [{ suite: 'Execution', error: error.message }] };
    }
  }
}

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
        
        const testRunner = new FirefoxTestRunner(client, vitest);
        
        for (const spec of specs) {
          vitest.state.clearFiles(spec.project);
          const path = normalize(spec.moduleId).replace(normalize(process.cwd()), '');
          vitest.logger.console.log(`[firefox-pool] Running ${path}`);
          
          const results = await testRunner.runTestFile(spec);
          const total = results.passed.length + results.failed.length;
          
          vitest.logger.console.log(`[firefox-pool] ${results.passed.length}/${total} passed`);
          results.failed.forEach(({ name, error }) => vitest.logger.console.error(`  ✗ ${name}: ${error}`));
          results.errors.forEach(({ suite, error }) => vitest.logger.console.error(`  ✗ ${suite}: ${error}`));
        }
      } catch (error) {
        vitest.logger.console.error(`[firefox-pool] ${error.message}\nEnsure Firefox is running with marionette.port=2828`);
        throw error;
      }
    },
    
    async collectTests() {
      throw new Error('collectTests not implemented');
    },
    
    async close() {
      vitest.logger.console.log('[firefox-pool] Closing');
      client && client.disconnect();
    },
  };
};
