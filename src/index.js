/* @ts-self-types="./index.d.ts"*/
/**
 * mus-uc-devtools
 * A tool to develop userChrome CSS for Firefox using the Marionette protocol
 */

import { cssManager, marionette, screenshot } from '../dist/mus_uc_devtools.js';

/**
 * Chrome CSS Manager interface for loading CSS into Firefox chrome context
 */
export const css = {
    /**
     * Initialize the Chrome CSS manager
     * @returns {string} Result message
     */
    initialize: cssManager.initialize,

    /**
     * Load CSS content into Firefox chrome context
     * @param {string} content - CSS content
     * @param {string} [id] - Optional sheet ID
     * @returns {string} Result message (contains sheet ID)
     */
    load: (content, id) => cssManager.loadCss(content, id),

    /**
     * Unload CSS by ID
     * @param {string} id - Sheet ID
     * @returns {boolean} Success status
     */
    unload: cssManager.unloadCss,

    /**
     * Clear all loaded CSS sheets
     * @returns {string} Result message
     */
    clearAll: cssManager.clearAll,

    /**
     * List all loaded CSS sheet IDs
     * @returns {string[]} List of IDs
     */
    list: cssManager.listLoaded
};

/**
 * Marionette connection interface
 */
export const client = {
    /**
     * Connect to Marionette server
     * @param {string} host - Hostname
     * @param {number} port - Port number
     * @returns {string} Result message
     */
    connect: marionette.connect,

    /**
     * Execute JavaScript in chrome context
     * @param {string} script - JavaScript code
     * @param {string} [args] - Optional arguments (JSON string)
     * @returns {string} Execution result
     */
    execute: (script, args) => marionette.executeScript(script, args)
};

/**
 * Screenshot interface
 */
export const screen = {
    /**
     * Take a screenshot
     * @param {string} [selector] - Optional CSS selector
     * @returns {Uint8Array} PNG image data
     */
    capture: screenshot.takeScreenshot
};

// Re-export raw interfaces if needed
export { cssManager, marionette, screenshot };
