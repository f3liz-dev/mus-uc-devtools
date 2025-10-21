/**
 * Vitest Pool for Firefox Chrome Context
 * Runs tests inside Firefox via Marionette protocol
 */
const net = require('net');
const { normalize } = require('pathe');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { startTests } = require('@vitest/runner');

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

  async bundleTestFile(filePath) {
    // Create a virtual module that exports our Vitest implementations
    const vitestShimPlugin = {
      name: 'vitest-shim',
      setup(build) {
        build.onResolve({ filter: /^vitest$/ }, args => {
          return { path: args.path, namespace: 'vitest-shim' };
        });

        build.onLoad({ filter: /.*/, namespace: 'vitest-shim' }, () => {
          return {
            contents: `
              // Re-export the globals that will be injected by the banner
              export const describe = globalThis.describe;
              export const it = globalThis.it;
              export const test = globalThis.test;
              export const expect = globalThis.expect;
              export const beforeAll = globalThis.beforeAll;
              export const afterAll = globalThis.afterAll;
              export const beforeEach = globalThis.beforeEach;
              export const afterEach = globalThis.afterEach;
            `,
            loader: 'js'
          };
        });
      }
    };

    // Bundle the test file with all its imports using esbuild
    const result = await esbuild.build({
      entryPoints: [filePath],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      target: 'firefox115',
      plugins: [vitestShimPlugin],
      define: {
        'process.env.NODE_ENV': '"test"',
      },
      // Inject vitest globals
      banner: {
        js: `
          // Vitest test results collector
          globalThis.__vitestResults = {
            passed: [],
            failed: [],
            errors: [],
            suites: []
          };

          // Real Vitest API implementation for Firefox chrome context
          globalThis.__vitestState = {
            currentSuite: null,
            suites: [],
            tests: []
          };

          const describe = globalThis.describe = (name, fn) => {
            const parentSuite = globalThis.__vitestState.currentSuite;
            const suite = { name, tests: [], suites: [], parent: parentSuite };
            
            if (parentSuite) {
              parentSuite.suites.push(suite);
            } else {
              globalThis.__vitestState.suites.push(suite);
            }
            
            globalThis.__vitestState.currentSuite = suite;
            try {
              fn();
            } catch (error) {
              globalThis.__vitestResults.errors.push({ suite: name, error: error.toString(), stack: error.stack });
            }
            globalThis.__vitestState.currentSuite = parentSuite;
          };

          const it = globalThis.it = (name, fn) => {
            const test = { name, fn };
            if (globalThis.__vitestState.currentSuite) {
              globalThis.__vitestState.currentSuite.tests.push(test);
            } else {
              globalThis.__vitestState.tests.push(test);
            }
          };

          const test = globalThis.test = it;

          const expect = globalThis.expect = (actual) => ({
            toBe: (expected) => { 
              if (actual !== expected) {
                const error = new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
                error.actual = actual;
                error.expected = expected;
                throw error;
              }
            },
            toEqual: (expected) => { 
              const actualStr = JSON.stringify(actual);
              const expectedStr = JSON.stringify(expected);
              if (actualStr !== expectedStr) {
                const error = new Error(\`Expected \${expectedStr} but got \${actualStr}\`);
                error.actual = actual;
                error.expected = expected;
                throw error;
              }
            },
            toBeTruthy: () => { 
              if (!actual) {
                const error = new Error(\`Expected truthy but got \${JSON.stringify(actual)}\`);
                error.actual = actual;
                throw error;
              }
            },
            toBeFalsy: () => { 
              if (actual) {
                const error = new Error(\`Expected falsy but got \${JSON.stringify(actual)}\`);
                error.actual = actual;
                throw error;
              }
            },
            toContain: (s) => { 
              if (!actual.includes(s)) {
                const error = new Error(\`Expected to contain \${JSON.stringify(s)}\`);
                error.actual = actual;
                error.expected = s;
                throw error;
              }
            },
            toMatch: (p) => { 
              if (!p.test(actual)) {
                const error = new Error(\`Expected to match \${p}\`);
                error.actual = actual;
                error.expected = p;
                throw error;
              }
            },
            toHaveProperty: (p) => { 
              if (!(p in actual)) {
                const error = new Error(\`Expected property \${p}\`);
                error.actual = actual;
                throw error;
              }
            },
            toBeGreaterThan: (v) => { 
              if (!(actual > v)) {
                const error = new Error(\`Expected > \${v} but got \${actual}\`);
                error.actual = actual;
                error.expected = v;
                throw error;
              }
            },
            toBeGreaterThanOrEqual: (v) => { 
              if (!(actual >= v)) {
                const error = new Error(\`Expected >= \${v} but got \${actual}\`);
                error.actual = actual;
                error.expected = v;
                throw error;
              }
            },
            toBeLessThan: (v) => { 
              if (!(actual < v)) {
                const error = new Error(\`Expected < \${v} but got \${actual}\`);
                error.actual = actual;
                error.expected = v;
                throw error;
              }
            },
            not: {
              toBe: (expected) => {
                if (actual === expected) {
                  const error = new Error(\`Expected not to be \${JSON.stringify(expected)}\`);
                  error.actual = actual;
                  throw error;
                }
              },
              toEqual: (expected) => {
                const actualStr = JSON.stringify(actual);
                const expectedStr = JSON.stringify(expected);
                if (actualStr === expectedStr) {
                  const error = new Error(\`Expected not to equal \${expectedStr}\`);
                  error.actual = actual;
                  error.expected = expected;
                  throw error;
                }
              },
              toBeTruthy: () => {
                if (actual) {
                  const error = new Error(\`Expected not to be truthy but got \${JSON.stringify(actual)}\`);
                  error.actual = actual;
                  throw error;
                }
              },
              toBeFalsy: () => {
                if (!actual) {
                  const error = new Error(\`Expected not to be falsy but got \${JSON.stringify(actual)}\`);
                  error.actual = actual;
                  throw error;
                }
              },
              toContain: (s) => {
                if (actual.includes(s)) {
                  const error = new Error(\`Expected not to contain \${JSON.stringify(s)}\`);
                  error.actual = actual;
                  error.expected = s;
                  throw error;
                }
              }
            }
          });

          const beforeAll = globalThis.beforeAll = (fn) => {
            if (globalThis.__vitestState.currentSuite) {
              globalThis.__vitestState.currentSuite.beforeAll = globalThis.__vitestState.currentSuite.beforeAll || [];
              globalThis.__vitestState.currentSuite.beforeAll.push(fn);
            }
          };

          const afterAll = globalThis.afterAll = (fn) => {
            if (globalThis.__vitestState.currentSuite) {
              globalThis.__vitestState.currentSuite.afterAll = globalThis.__vitestState.currentSuite.afterAll || [];
              globalThis.__vitestState.currentSuite.afterAll.push(fn);
            }
          };

          const beforeEach = globalThis.beforeEach = (fn) => {
            if (globalThis.__vitestState.currentSuite) {
              globalThis.__vitestState.currentSuite.beforeEach = globalThis.__vitestState.currentSuite.beforeEach || [];
              globalThis.__vitestState.currentSuite.beforeEach.push(fn);
            }
          };

          const afterEach = globalThis.afterEach = (fn) => {
            if (globalThis.__vitestState.currentSuite) {
              globalThis.__vitestState.currentSuite.afterEach = globalThis.__vitestState.currentSuite.afterEach || [];
              globalThis.__vitestState.currentSuite.afterEach.push(fn);
            }
          };

          // Firefox-specific helper
          globalThis.firefox = {
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

          // Runner function to execute all collected tests
          globalThis.__runVitestTests = async function() {
            const runTest = async (test, suitePath = []) => {
              const fullName = [...suitePath, test.name].join(' > ');
              try {
                const result = test.fn();
                if (result && typeof result.then === 'function') {
                  await result;
                }
                globalThis.__vitestResults.passed.push(fullName);
              } catch (error) {
                globalThis.__vitestResults.failed.push({ 
                  name: fullName, 
                  error: error.message || error.toString(),
                  stack: error.stack
                });
              }
            };

            const runSuite = async (suite, suitePath = []) => {
              const currentPath = [...suitePath, suite.name];
              
              // Run beforeAll hooks
              if (suite.beforeAll) {
                for (const hook of suite.beforeAll) {
                  try {
                    await hook();
                  } catch (error) {
                    globalThis.__vitestResults.errors.push({ 
                      suite: currentPath.join(' > '), 
                      hook: 'beforeAll',
                      error: error.message || error.toString(),
                      stack: error.stack
                    });
                  }
                }
              }

              // Run tests in this suite
              for (const test of suite.tests) {
                // Run beforeEach hooks
                if (suite.beforeEach) {
                  for (const hook of suite.beforeEach) {
                    try {
                      await hook();
                    } catch (error) {
                      globalThis.__vitestResults.errors.push({ 
                        suite: currentPath.join(' > '),
                        hook: 'beforeEach',
                        error: error.message || error.toString(),
                        stack: error.stack
                      });
                    }
                  }
                }

                await runTest(test, currentPath);

                // Run afterEach hooks
                if (suite.afterEach) {
                  for (const hook of suite.afterEach) {
                    try {
                      await hook();
                    } catch (error) {
                      globalThis.__vitestResults.errors.push({ 
                        suite: currentPath.join(' > '),
                        hook: 'afterEach',
                        error: error.message || error.toString(),
                        stack: error.stack
                      });
                    }
                  }
                }
              }

              // Run nested suites
              for (const nestedSuite of suite.suites) {
                await runSuite(nestedSuite, currentPath);
              }

              // Run afterAll hooks
              if (suite.afterAll) {
                for (const hook of suite.afterAll) {
                  try {
                    await hook();
                  } catch (error) {
                    globalThis.__vitestResults.errors.push({ 
                      suite: currentPath.join(' > '),
                      hook: 'afterAll',
                      error: error.message || error.toString(),
                      stack: error.stack
                    });
                  }
                }
              }
            };

            // Execute all root-level tests
            for (const test of globalThis.__vitestState.tests) {
              await runTest(test);
            }

            // Execute all suites
            for (const suite of globalThis.__vitestState.suites) {
              await runSuite(suite);
            }

            return globalThis.__vitestResults;
          };
        `
      },
      footer: {
        js: `
          // Auto-execute tests after bundle loads
          globalThis.__runVitestTests().then(results => {
            globalThis.__VITEST_RESULTS__ = results;
          }).catch(error => {
            globalThis.__VITEST_RESULTS__ = {
              passed: [],
              failed: [],
              errors: [{ suite: 'Test execution', error: error.toString(), stack: error.stack }]
            };
          });
        `
      }
    });

    return result.outputFiles[0].text;
  }

  async runTestFile(spec) {
    try {
      // Bundle the test file with all imports
      const bundledCode = await this.bundleTestFile(spec.moduleId);
      
      // Execute the bundled code in Firefox
      await this.client.executeScript(bundledCode, []);
      
      // Wait a bit for async tests to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Retrieve results
      const results = await this.client.executeScript('return globalThis.__VITEST_RESULTS__;', []);
      
      return {
        passed: results.passed || [],
        failed: results.failed || [],
        errors: results.errors || []
      };
    } catch (error) {
      return { 
        passed: [], 
        failed: [], 
        errors: [{ 
          suite: 'Execution', 
          error: error.message,
          stack: error.stack 
        }] 
      };
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
