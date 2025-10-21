/**
 * Custom Vitest Pool for Firefox Chrome Context Testing
 * 
 * This pool runs tests directly inside Firefox's chrome context using the Marionette protocol.
 * Inspired by @cloudflare/vitest-pool-workers, tests execute in the actual Firefox runtime
 * with direct access to Services, Components, and XPCOM APIs.
 * 
 * Architecture:
 * 1. Pool connects to Firefox via Marionette (port 2828)
 * 2. Test files are loaded into Firefox chrome context
 * 3. Tests execute directly in Firefox with access to all chrome APIs
 * 4. Results are reported back to Vitest via Marionette
 */

const { createMethodsRPC } = require('vitest/node');
const net = require('net');
const { normalize } = require('pathe');
const fs = require('fs');
const path = require('path');

// Configuration
const MARIONETTE_PORT = 2828;

/**
 * Simple Marionette protocol client
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
              try {
                buffer = buffer.substring(colonPos + 1 + length);
                handshakeReceived = true;
                this.connected = true;
                resolve();
              } catch (e) {
                reject(new Error(`Failed to parse handshake: ${e.message}`));
              }
            }
          }
        }
      });

      this.socket.on('error', (err) => {
        this.connected = false;
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
      });

      this.socket.connect(this.port, '127.0.0.1');
    });
  }

  async sendCommand(name, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to Marionette');
    }

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
            const jsonStr = buffer.substring(colonPos + 1, colonPos + 1 + length);
            this.socket.removeListener('data', dataHandler);
            
            try {
              const response = JSON.parse(jsonStr);
              
              if (Array.isArray(response)) {
                const [direction, id, error, result] = response;
                if (error) {
                  reject(new Error(`Marionette error: ${JSON.stringify(error)}`));
                } else {
                  resolve(result);
                }
              } else {
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

      setTimeout(() => {
        this.socket.removeListener('data', dataHandler);
        reject(new Error(`Command timeout: ${name}`));
      }, 30000);
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
    return await this.sendCommand('WebDriver:NewSession', caps);
  }

  async setContext(context) {
    await this.sendCommand('Marionette:SetContext', { value: context });
  }

  async executeScript(script, args = []) {
    const result = await this.sendCommand('WebDriver:ExecuteScript', {
      script,
      args
    });
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
 * Firefox test runner that executes inside Firefox chrome context
 */
class FirefoxTestRunner {
  constructor(client, vitest) {
    this.client = client;
    this.vitest = vitest;
  }

  /**
   * Run a test file inside Firefox chrome context
   */
  async runTestFile(spec) {
    const { project, moduleId } = spec;
    
    // Read the test file
    const testCode = fs.readFileSync(moduleId, 'utf-8');
    
    // Create a wrapper script that sets up the test environment in Firefox
    const wrapperScript = `
      // Set up global test context
      const testResults = {
        passed: [],
        failed: [],
        errors: []
      };

      // Mock vitest functions that will be available in tests
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
        toBe: (expected) => {
          if (actual !== expected) {
            throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
          }
        },
        toEqual: (expected) => {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
          }
        },
        toBeTruthy: () => {
          if (!actual) {
            throw new Error(\`Expected truthy value but got \${JSON.stringify(actual)}\`);
          }
        },
        toContain: (substring) => {
          if (typeof actual === 'string' && !actual.includes(substring)) {
            throw new Error(\`Expected "\${actual}" to contain "\${substring}"\`);
          }
          if (Array.isArray(actual) && !actual.includes(substring)) {
            throw new Error(\`Expected array to contain \${JSON.stringify(substring)}\`);
          }
        },
        toMatch: (pattern) => {
          if (!pattern.test(actual)) {
            throw new Error(\`Expected "\${actual}" to match pattern \${pattern}\`);
          }
        },
        toHaveProperty: (prop) => {
          if (!(prop in actual)) {
            throw new Error(\`Expected object to have property "\${prop}"\`);
          }
        },
        toBeGreaterThan: (value) => {
          if (!(actual > value)) {
            throw new Error(\`Expected \${actual} to be greater than \${value}\`);
          }
        },
      });

      // Provide Firefox-specific helpers directly in the global scope
      const firefox = {
        executeScript: (script, args) => {
          // Since we're already in chrome context, just eval the script
          const fn = new Function('arguments', script);
          return fn(args || []);
        },
        screenshot: (selector) => {
          let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
          let window = Services.wm.getMostRecentWindow("navigator:browser");
          
          if (selector) {
            let element = window.document.querySelector(selector);
            if (!element) {
              throw new Error("Element not found: " + selector);
            }
            let rect = element.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            let ctx = canvas.getContext("2d");
            ctx.drawWindow(window, rect.left, rect.top, rect.width, rect.height, "rgb(255,255,255)");
          } else {
            let width = window.innerWidth;
            let height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            let ctx = canvas.getContext("2d");
            ctx.drawWindow(window, 0, 0, width, height, "rgb(255,255,255)");
          }
          
          return {
            dataURL: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height
          };
        }
      };

      // Inject test code
      ${testCode}

      // Return test results
      return testResults;
    `;

    try {
      // Execute the wrapped test in Firefox chrome context
      const results = await this.client.executeScript(wrapperScript, []);
      
      return {
        passed: results.passed || [],
        failed: results.failed || [],
        errors: results.errors || []
      };
    } catch (error) {
      return {
        passed: [],
        failed: [],
        errors: [{ suite: 'Execution', error: error.message }]
      };
    }
  }
}

/**
 * Create the custom pool for Vitest
 */
module.exports = async (vitest, options) => {
  const poolOptions = vitest.config.poolOptions?.firefox || {};
  const port = poolOptions.marionettePort || MARIONETTE_PORT;
  
  const client = new MarionetteClient(port);
  let testRunner = null;

  return {
    name: 'firefox-pool',
    
    async runTests(specs, invalidates) {
      vitest.logger.console.log('[firefox-pool] Connecting to Firefox...');
      
      try {
        await client.connect();
        await client.createSession();
        await client.setContext('chrome');
        
        vitest.logger.console.log('[firefox-pool] Connected to Firefox chrome context');
        
        testRunner = new FirefoxTestRunner(client, vitest);
        
        for (const spec of specs) {
          const { project, moduleId } = spec;
          
          vitest.state.clearFiles(project);
          
          const normalizedPath = normalize(moduleId)
            .toLowerCase()
            .replace(normalize(process.cwd()).toLowerCase(), '');
          
          vitest.logger.console.log(`[firefox-pool] Running ${normalizedPath}`);
          
          // Run the test file
          const results = await testRunner.runTestFile(spec);
          
          // Report results
          const totalTests = results.passed.length + results.failed.length;
          vitest.logger.console.log(
            `[firefox-pool] ${results.passed.length}/${totalTests} tests passed`
          );
          
          if (results.failed.length > 0) {
            results.failed.forEach(({ name, error }) => {
              vitest.logger.console.error(`  ✗ ${name}: ${error}`);
            });
          }
          
          if (results.errors.length > 0) {
            results.errors.forEach(({ suite, error }) => {
              vitest.logger.console.error(`  ✗ Error in ${suite}: ${error}`);
            });
          }
        }
      } catch (error) {
        vitest.logger.console.error(
          `[firefox-pool] Error: ${error.message}\n` +
          'Make sure Firefox is running with marionette.port=2828 in about:config'
        );
        throw error;
      }
    },
    
    async collectTests() {
      // For now, test collection is handled by Vitest's default mechanism
      throw new Error('collectTests not implemented - tests are collected by Vitest');
    },
    
    async close() {
      vitest.logger.console.log('[firefox-pool] Closing Firefox pool');
      if (client) {
        client.disconnect();
      }
    },
  };
};
