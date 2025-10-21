/**
 * Vitest Pool for Firefox Chrome Context  
 * Runs tests inside Firefox via Marionette protocol with native imports
 * Uses HTTP module server with proper Firefox integration
 */
const net = require('net');
const http = require('http');
const { normalize } = require('pathe');
const fs = require('fs');
const path = require('path');
const { startTests } = require('@vitest/runner');

const MARIONETTE_PORT = 2828;
const MODULE_SERVER_PORT = 8765;

/**
 * Module Server - serves modules via HTTP for Firefox to import
 * Note: This works because we use Components.utils.import() in Firefox chrome context
 * which has permissions to load from HTTP in privileged context
 */

/**
 * HTTP server that serves modules to Firefox
 * This allows Firefox to use native ES6 imports
 */
class ModuleServer {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.server = null;
    this.port = MODULE_SERVER_PORT;
    this.moduleCache = new Map();
  }

  /**
   * Create Vitest API module that Firefox can import
   */
  getVitestModule() {
    return `
// Vitest API implementation for Firefox chrome context
export const __vitestResults = {
  passed: [],
  failed: [],
  errors: []
};

export const __vitestState = {
  currentSuite: null,
  suites: [],
  tests: []
};

export const describe = (name, fn) => {
  const parentSuite = __vitestState.currentSuite;
  const suite = { name, tests: [], suites: [], parent: parentSuite };
  
  if (parentSuite) {
    parentSuite.suites.push(suite);
  } else {
    __vitestState.suites.push(suite);
  }
  
  __vitestState.currentSuite = suite;
  try {
    fn();
  } catch (error) {
    __vitestResults.errors.push({ suite: name, error: error.toString(), stack: error.stack });
  }
  __vitestState.currentSuite = parentSuite;
};

export const it = (name, fn) => {
  const test = { name, fn };
  if (__vitestState.currentSuite) {
    __vitestState.currentSuite.tests.push(test);
  } else {
    __vitestState.tests.push(test);
  }
};

export const test = it;

export const expect = (actual) => ({
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

export const beforeAll = (fn) => {
  if (__vitestState.currentSuite) {
    __vitestState.currentSuite.beforeAll = __vitestState.currentSuite.beforeAll || [];
    __vitestState.currentSuite.beforeAll.push(fn);
  }
};

export const afterAll = (fn) => {
  if (__vitestState.currentSuite) {
    __vitestState.currentSuite.afterAll = __vitestState.currentSuite.afterAll || [];
    __vitestState.currentSuite.afterAll.push(fn);
  }
};

export const beforeEach = (fn) => {
  if (__vitestState.currentSuite) {
    __vitestState.currentSuite.beforeEach = __vitestState.currentSuite.beforeEach || [];
    __vitestState.currentSuite.beforeEach.push(fn);
  }
};

export const afterEach = (fn) => {
  if (__vitestState.currentSuite) {
    __vitestState.currentSuite.afterEach = __vitestState.currentSuite.afterEach || [];
    __vitestState.currentSuite.afterEach.push(fn);
  }
};

// Firefox-specific helper
export const firefox = {
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
  }

  /**
   * Resolve module path (similar to Node's resolution)
   */
  resolveModule(requestPath, basePath) {
    // Handle vitest module specially
    if (requestPath === 'vitest' || requestPath === '/vitest') {
      return { type: 'vitest', content: this.getVitestModule() };
    }

    // Resolve relative imports
    let fullPath;
    if (requestPath.startsWith('/')) {
      fullPath = path.join(this.baseDir, requestPath.slice(1));
    } else if (requestPath.startsWith('.')) {
      const baseFile = path.join(this.baseDir, basePath);
      const baseDirectory = path.dirname(baseFile);
      fullPath = path.resolve(baseDirectory, requestPath);
    } else {
      // Try node_modules resolution
      fullPath = require.resolve(requestPath, { paths: [this.baseDir] });
    }

    // Add .js extension if missing
    if (!path.extname(fullPath)) {
      if (fs.existsSync(fullPath + '.js')) {
        fullPath += '.js';
      } else if (fs.existsSync(fullPath + '.mjs')) {
        fullPath += '.mjs';
      } else if (fs.existsSync(path.join(fullPath, 'index.js'))) {
        fullPath = path.join(fullPath, 'index.js');
      }
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Module not found: ${requestPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return { type: 'module', content, fullPath };
  }

  /**
   * Start the HTTP server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        try {
          const url = new URL(req.url, `http://localhost:${this.port}`);
          const modulePath = decodeURIComponent(url.pathname);
          
          console.log(`[module-server] Serving: ${modulePath}`);
          
          const resolved = this.resolveModule(modulePath, '');
          
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          });
          res.end(resolved.content);
        } catch (error) {
          console.error(`[module-server] Error serving ${req.url}:`, error.message);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`Module not found: ${error.message}`);
        }
      });

      this.server.listen(this.port, 'localhost', () => {
        console.log(`[module-server] Started on http://localhost:${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('[module-server] Stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Get the URL for a module
   */
  getModuleUrl(modulePath) {
    return `http://localhost:${this.port}${modulePath.startsWith('/') ? '' : '/'}${modulePath}`;
  }
}

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
  constructor(client, vitest, moduleServer) {
    this.client = client;
    this.vitest = vitest;
    this.moduleServer = moduleServer;
  }

  /**
   * Prepare test file for execution with native ES6 imports
   * Instead of bundling, we transform imports to use the module server
   */
  async prepareTestFile(filePath) {
    const testCode = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(this.moduleServer.baseDir, filePath);
    
    // Transform vitest imports to use our module server
    const transformedCode = testCode.replace(
      /from\s+['"]vitest['"]/g,
      `from '${this.moduleServer.getModuleUrl('/vitest')}'`
    );
    
    // Use .vitest-temp path for the URL since that's where we'll write the file
    const tempRelativePath = path.join('.vitest-temp', path.basename(filePath));
    
    return {
      code: transformedCode,
      url: this.moduleServer.getModuleUrl('/' + tempRelativePath)
    };
  }

  /**
   * Create a bundled runner script with Vitest API and test code inline
   * This avoids HTTP fetch issues in Firefox chrome context
   */
  getBundledRunnerScript(vitestCode, testCode) {
    // Transform ES6 module code by removing export keywords and wrapping in scope
    // This creates local variables that we then expose globally
    const vitestCodeWithoutExports = vitestCode
      .replace(/export const /g, 'const ')
      .replace(/export function /g, 'function ')
      .replace(/export \{[^}]+\};?/g, '');
    
    // Remove import statements from test code
    const transformedTestCode = testCode
      .replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '');
    
    return `
(function() {
  // Initialize results
  globalThis.__VITEST_RESULTS__ = {
    passed: [],
    failed: [],
    errors: []
  };
  globalThis.__VITEST_COMPLETE__ = false;
  
  try {
    // Evaluate Vitest API in local scope
    ${vitestCodeWithoutExports}
    
    // Now expose the local variables globally
    globalThis.describe = describe;
    globalThis.it = it;
    globalThis.test = test;
    globalThis.expect = expect;
    globalThis.beforeAll = beforeAll;
    globalThis.afterAll = afterAll;
    globalThis.beforeEach = beforeEach;
    globalThis.afterEach = afterEach;
    globalThis.firefox = firefox;
    globalThis.__vitestResults = __vitestResults;
    globalThis.__vitestState = __vitestState;
    
    const vitest = {
      __vitestResults: __vitestResults,
      __vitestState: __vitestState
    };
    
    // Inline test code
    ${transformedTestCode}
    
    // Now run tests asynchronously
    (async function() {
      // Runner functions...
      ${this.getTestRunnerFunctions()}
      
      // Execute tests
      for (const test of vitest.__vitestState.tests) {
        await runTest(test);
      }
      for (const suite of vitest.__vitestState.suites) {
        await runSuite(suite);
      }
      
      globalThis.__VITEST_RESULTS__ = vitest.__vitestResults;
      globalThis.__VITEST_COMPLETE__ = true;
    })();
    
  } catch (error) {
    globalThis.__VITEST_RESULTS__ = {
      passed: [],
      failed: [],
      errors: [{ suite: 'Test execution', error: error.toString(), stack: error.stack }]
    };
    globalThis.__VITEST_COMPLETE__ = true;
  }
})();
`;
  }

  /**
   * Get test runner functions as a string
   */
  getTestRunnerFunctions() {
    return `
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

  for (const test of suite.tests) {
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

  for (const nestedSuite of suite.suites) {
    await runSuite(nestedSuite, currentPath);
  }

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
`;
  }



  async runTestFile(spec) {
    try {
      // First test if executeScript works at all
      const testScript = 'globalThis.__TEST__ = "works"; return globalThis.__TEST__;';
      const testResult = await this.client.executeScript(testScript, []);
      console.log('[firefox-pool] Test script result:', JSON.stringify(testResult));
      
      // Read test file and vitest module
      const testCode = fs.readFileSync(spec.moduleId, 'utf-8');
      const vitestCode = this.moduleServer.getVitestModule();
      
      // Create a single bundled script with everything inline
      const runnerScript = this.getBundledRunnerScript(vitestCode, testCode);
      
      // Save for debugging
      const debugPath = path.join(this.moduleServer.baseDir, '.vitest-temp', 'debug-runner.js');
      fs.writeFileSync(debugPath, runnerScript);
      console.log('[firefox-pool] Saved runner script to:', debugPath);
      
      // Execute the bundled script in Firefox
      await this.client.executeScript(runnerScript, []);
      
      // Poll for test completion
      const maxWaitMs = 30000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitMs) {
        const complete = await this.client.executeScript('return globalThis.__VITEST_COMPLETE__;', []);
        if (complete) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Retrieve results
      const results = await this.client.executeScript('return globalThis.__VITEST_RESULTS__;', []);
      
      // Debug logging
      if (!results) {
        console.error('[firefox-pool] __VITEST_RESULTS__ is undefined/null');
      } else {
        console.log('[firefox-pool] Results:', JSON.stringify(results, null, 2));
      }
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempTestPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      return {
        passed: results ? results.passed || [] : [],
        failed: results ? results.failed || [] : [],
        errors: results ? results.errors || [] : []
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
  const baseDir = process.cwd();
  const moduleServer = new ModuleServer(baseDir);

  return {
    name: 'firefox-pool',
    
    async runTests(specs) {
      vitest.logger.console.log('[firefox-pool] Starting module server...');
      
      try {
        // Start the module server
        await moduleServer.start();
        vitest.logger.console.log(`[firefox-pool] Module server running on http://localhost:${MODULE_SERVER_PORT}`);
        
        // Connect to Firefox
        vitest.logger.console.log('[firefox-pool] Connecting to Firefox...');
        await client.connect();
        await client.createSession();
        await client.setContext('chrome');
        vitest.logger.console.log('[firefox-pool] Connected to Firefox');
        
        const testRunner = new FirefoxTestRunner(client, vitest, moduleServer);
        
        for (const spec of specs) {
          vitest.state.clearFiles(spec.project);
          const testPath = normalize(spec.moduleId).replace(normalize(process.cwd()), '');
          vitest.logger.console.log(`[firefox-pool] Running ${testPath}`);
          
          const results = await testRunner.runTestFile(spec);
          const total = results.passed.length + results.failed.length;
          
          vitest.logger.console.log(`[firefox-pool] ${results.passed.length}/${total} passed`);
          results.failed.forEach(({ name, error }) => vitest.logger.console.error(`  ✗ ${name}: ${error}`));
          results.errors.forEach(({ suite, error }) => vitest.logger.console.error(`  ✗ ${suite}: ${error}`));
        }
      } catch (error) {
        vitest.logger.console.error(`[firefox-pool] ${error.message}\nEnsure Firefox is running with marionette.port=2828`);
        throw error;
      } finally {
        // Clean up module server
        await moduleServer.stop();
      }
    },
    
    async collectTests() {
      throw new Error('collectTests not implemented');
    },
    
    async close() {
      vitest.logger.console.log('[firefox-pool] Closing');
      await moduleServer.stop();
      client && client.disconnect();
    },
  };
};
