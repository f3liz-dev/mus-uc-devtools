#!/usr/bin/env node

/**
 * MCP Server for Firefox Chrome Testing
 * 
 * Exposes Firefox chrome testing capabilities through MCP (Model Context Protocol)
 * for LLM-driven browser automation and testing.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Session state management
const sessions = new Map();
let sessionIdCounter = 0;

/**
 * Marionette client implementation for Node.js
 */
class MarionetteClient {
  constructor(host = 'localhost', port = 2828) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.messageId = 0;
    this.context = 'chrome';
  }

  async connect() {
    const net = await import('net');
    
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.port, this.host);
      
      this.socket.once('data', (data) => {
        const handshake = JSON.parse(data.toString());
        if (handshake.applicationType !== 'gecko') {
          reject(new Error(`Unexpected application type: ${handshake.applicationType}`));
        } else {
          resolve(handshake);
        }
      });

      this.socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  async sendCommand(name, params = {}) {
    return new Promise((resolve, reject) => {
      this.messageId++;
      const msg = JSON.stringify({
        id: this.messageId,
        name,
        parameters: params
      });

      const msgWithLength = `${msg.length}:${msg}`;
      
      const onData = (data) => {
        const response = data.toString();
        const colonPos = response.indexOf(':');
        if (colonPos === -1) {
          reject(new Error('Invalid response format'));
          return;
        }

        const responseData = JSON.parse(response.substring(colonPos + 1));
        
        if (responseData.error) {
          reject(new Error(JSON.stringify(responseData.error)));
        } else {
          resolve(responseData.value);
        }
        
        this.socket.off('data', onData);
      };

      this.socket.on('data', onData);
      this.socket.write(msgWithLength);
    });
  }

  async setContext(context) {
    await this.sendCommand('Marionette:SetContext', { value: context });
    this.context = context;
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
      this.socket = null;
    }
  }
}

/**
 * Session manager for stateful Firefox testing
 */
class TestSession {
  constructor(id, settings = {}) {
    this.id = id;
    this.client = null;
    this.firefox = null;
    this.settings = {
      host: settings.host || 'localhost',
      port: settings.port || 2828,
      autoConnect: settings.autoConnect !== false,
      context: settings.context || 'chrome'
    };
    this.logs = [];
    this.state = 'initialized';
  }

  log(message, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    this.logs.push(entry);
    console.error(`[Session ${this.id}] ${level.toUpperCase()}: ${message}`);
  }

  async connect() {
    if (this.client) {
      this.log('Already connected', 'warn');
      return { success: true, message: 'Already connected' };
    }

    try {
      this.log('Connecting to Firefox Marionette...');
      this.client = new MarionetteClient(this.settings.host, this.settings.port);
      await this.client.connect();
      await this.client.setContext(this.settings.context);
      this.state = 'connected';
      this.log('Successfully connected to Firefox');
      return { success: true, message: 'Connected to Firefox', context: this.settings.context };
    } catch (error) {
      this.state = 'error';
      this.log(`Connection failed: ${error.message}`, 'error');
      throw new Error(`Failed to connect to Firefox: ${error.message}`);
    }
  }

  async executeScript(script, args = [], options = {}) {
    if (!this.client) {
      await this.connect();
    }

    try {
      const startTime = Date.now();
      this.log(`Executing script (${script.length} chars)`);
      
      const result = await this.client.executeScript(script, args);
      const duration = Date.now() - startTime;
      
      this.log(`Script executed successfully (${duration}ms)`);
      
      return {
        success: true,
        result,
        duration,
        context: this.client.context,
        logs: options.includeLogs ? this.logs.slice(-10) : undefined
      };
    } catch (error) {
      this.log(`Script execution failed: ${error.message}`, 'error');
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  async screenshot(selector = null) {
    if (!this.client) {
      await this.connect();
    }

    const script = selector ? `
      const doc = Services.wm.getMostRecentWindow("navigator:browser").document;
      const element = doc.querySelector(arguments[0]);
      
      if (!element) {
        throw new Error("Element not found: " + arguments[0]);
      }
      
      const rect = element.getBoundingClientRect();
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      
      const canvas = doc.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      const ctx = canvas.getContext("2d");
      ctx.drawWindow(window, rect.left, rect.top, rect.width, rect.height, "rgb(255,255,255)");
      
      return canvas.toDataURL("image/png");
    ` : `
      const window = Services.wm.getMostRecentWindow("navigator:browser");
      const canvas = window.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const ctx = canvas.getContext("2d");
      ctx.drawWindow(window, 0, 0, window.innerWidth, window.innerHeight, "rgb(255,255,255)");
      
      return canvas.toDataURL("image/png");
    `;

    try {
      this.log(`Taking screenshot${selector ? ' of ' + selector : ''}`);
      const result = await this.client.executeScript(script, selector ? [selector] : []);
      this.log('Screenshot captured successfully');
      
      return {
        success: true,
        dataURL: result,
        selector: selector || 'fullscreen',
        format: 'png'
      };
    } catch (error) {
      this.log(`Screenshot failed: ${error.message}`, 'error');
      throw new Error(`Screenshot failed: ${error.message}`);
    }
  }

  getLogs() {
    return this.logs;
  }

  getState() {
    return {
      id: this.id,
      state: this.state,
      connected: !!this.client,
      context: this.client?.context,
      settings: this.settings,
      logCount: this.logs.length
    };
  }

  disconnect() {
    if (this.client) {
      this.log('Disconnecting from Firefox');
      this.client.disconnect();
      this.client = null;
      this.state = 'disconnected';
    }
  }
}

/**
 * Create and configure the MCP server
 */
const server = new Server(
  {
    name: 'mus-uc-firefox-testing',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_script',
        description: 'Execute JavaScript in Firefox chrome context. Returns execution result, logs, and error details. Supports stateful sessions for iterative testing.',
        inputSchema: {
          type: 'object',
          properties: {
            script: {
              type: 'string',
              description: 'JavaScript code to execute in Firefox chrome context. Has access to Services, Cc, Ci, and all Firefox chrome APIs.'
            },
            args: {
              type: 'array',
              description: 'Optional arguments to pass to the script (accessible via arguments[0], arguments[1], etc.)',
              items: {
                type: ['string', 'number', 'boolean', 'object']
              }
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID for stateful testing. If not provided, a new session is created.'
            },
            includeLogs: {
              type: 'boolean',
              description: 'Include recent execution logs in response. Default: false'
            }
          },
          required: ['script']
        }
      },
      {
        name: 'screenshot',
        description: 'Capture a screenshot of Firefox browser window or specific element. Returns base64-encoded PNG data.',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Optional CSS selector to capture specific element. If not provided, captures full window.'
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID to use existing connection. If not provided, creates temporary session.'
            }
          }
        }
      },
      {
        name: 'load_css',
        description: 'Load CSS into Firefox chrome context for UI styling/testing. CSS is applied to the browser UI.',
        inputSchema: {
          type: 'object',
          properties: {
            css: {
              type: 'string',
              description: 'CSS content to load into Firefox chrome context'
            },
            id: {
              type: 'string',
              description: 'Optional ID for the stylesheet to allow unloading later'
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID to use existing connection'
            }
          },
          required: ['css']
        }
      },
      {
        name: 'unload_css',
        description: 'Unload previously loaded CSS by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the stylesheet to unload'
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID to use existing connection'
            }
          },
          required: ['id']
        }
      },
      {
        name: 'create_session',
        description: 'Create a new persistent session for stateful Firefox testing. Returns session ID for use in subsequent calls.',
        inputSchema: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              description: 'Firefox Marionette host. Default: localhost',
              default: 'localhost'
            },
            port: {
              type: 'number',
              description: 'Firefox Marionette port. Default: 2828',
              default: 2828
            },
            autoConnect: {
              type: 'boolean',
              description: 'Automatically connect to Firefox on session creation. Default: true',
              default: true
            }
          }
        }
      },
      {
        name: 'get_session',
        description: 'Get information about a session including state, logs, and connection status',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to query'
            },
            includeLogs: {
              type: 'boolean',
              description: 'Include full logs in response. Default: false',
              default: false
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'close_session',
        description: 'Close and cleanup a session, disconnecting from Firefox',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to close'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'list_sessions',
        description: 'List all active sessions with their current state',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'execute_script': {
        const { script, args: scriptArgs = [], sessionId, includeLogs = false } = args;
        
        let session;
        let shouldCleanup = false;
        
        if (sessionId) {
          session = sessions.get(sessionId);
          if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
          }
        } else {
          // Create temporary session
          session = new TestSession(`temp-${Date.now()}`);
          shouldCleanup = true;
        }

        try {
          const result = await session.executeScript(script, scriptArgs, { includeLogs });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } finally {
          if (shouldCleanup) {
            session.disconnect();
          }
        }
      }

      case 'screenshot': {
        const { selector, sessionId } = args;
        
        let session;
        let shouldCleanup = false;
        
        if (sessionId) {
          session = sessions.get(sessionId);
          if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
          }
        } else {
          session = new TestSession(`temp-${Date.now()}`);
          shouldCleanup = true;
        }

        try {
          const result = await session.screenshot(selector);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: result.success,
                  selector: result.selector,
                  format: result.format,
                  dataURL: result.dataURL.substring(0, 100) + '... (truncated)'
                }, null, 2)
              },
              {
                type: 'image',
                data: result.dataURL.replace(/^data:image\/png;base64,/, ''),
                mimeType: 'image/png'
              }
            ]
          };
        } finally {
          if (shouldCleanup) {
            session.disconnect();
          }
        }
      }

      case 'load_css': {
        const { css, id, sessionId } = args;
        
        let session;
        let shouldCleanup = false;
        
        if (sessionId) {
          session = sessions.get(sessionId);
          if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
          }
        } else {
          session = new TestSession(`temp-${Date.now()}`);
          shouldCleanup = true;
        }

        const sheetId = id || `css-${Date.now()}`;
        const loadScript = `
          const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
          
          const cssStr = arguments[0];
          const uri = Services.io.newURI("data:text/css," + encodeURIComponent(cssStr));
          
          if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
            sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
          }
          
          return { success: true, id: arguments[1], uri: uri.spec };
        `;

        try {
          const result = await session.executeScript(loadScript, [css, sheetId]);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } finally {
          if (shouldCleanup) {
            session.disconnect();
          }
        }
      }

      case 'unload_css': {
        const { id, sessionId } = args;
        
        let session;
        let shouldCleanup = false;
        
        if (sessionId) {
          session = sessions.get(sessionId);
          if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
          }
        } else {
          session = new TestSession(`temp-${Date.now()}`);
          shouldCleanup = true;
        }

        const unloadScript = `
          const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
            .getService(Ci.nsIStyleSheetService);
          
          const uriStr = arguments[0];
          const uri = Services.io.newURI(uriStr);
          
          if (sss.sheetRegistered(uri, sss.USER_SHEET)) {
            sss.unregisterSheet(uri, sss.USER_SHEET);
            return { success: true, unloaded: true };
          }
          
          return { success: false, message: "Stylesheet not registered" };
        `;

        try {
          const result = await session.executeScript(unloadScript, [id]);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } finally {
          if (shouldCleanup) {
            session.disconnect();
          }
        }
      }

      case 'create_session': {
        const sessionId = `session-${++sessionIdCounter}`;
        const session = new TestSession(sessionId, args);
        sessions.set(sessionId, session);
        
        if (args.autoConnect !== false) {
          await session.connect();
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                sessionId,
                state: session.getState()
              }, null, 2)
            }
          ]
        };
      }

      case 'get_session': {
        const { sessionId, includeLogs = false } = args;
        const session = sessions.get(sessionId);
        
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                state: session.getState(),
                logs: includeLogs ? session.getLogs() : undefined
              }, null, 2)
            }
          ]
        };
      }

      case 'close_session': {
        const { sessionId } = args;
        const session = sessions.get(sessionId);
        
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }
        
        session.disconnect();
        sessions.delete(sessionId);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Session ${sessionId} closed`
              }, null, 2)
            }
          ]
        };
      }

      case 'list_sessions': {
        const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
          id,
          state: session.getState()
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: sessionList.length,
                sessions: sessionList
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('mus-uc-devtools MCP server running on stdio');
  console.error('Capabilities: Firefox chrome testing, JavaScript execution, screenshots, CSS management');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
