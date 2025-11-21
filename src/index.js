/* @ts-self-types="./index.d.ts"*/
/**
 * mus-uc-devtools
 * A tool to develop userChrome CSS for Firefox using the Marionette protocol
 */

import { client as wasmClient } from '../dist/mus_uc_devtools.js';

/**
 * Marionette connection interface
 */
export const client = {
    /**
     * Connect to Marionette server
     * @param {string} host - Hostname
     * @param {number} port - Port number
     * @returns {object} Result object containing client instance on success
     */
    connect: (host, port) => {
        const result = wasmClient.connect(host, port);
        if (result.tag === 'ok') {
            const conn = result.val;
            return {
                tag: 'ok',
                val: {
                    css: {
                        /**
                         * Initialize the Chrome CSS manager
                         * @returns {object} Result object {tag: 'ok'|'err', val: string}
                         */
                        initialize: () => conn.cssInitialize(),

                        /**
                         * Load CSS content into Firefox chrome context
                         * @param {string} content - CSS content
                         * @param {string} [id] - Optional sheet ID
                         * @returns {object} Result object {tag: 'ok'|'err', val: string}
                         */
                        load: (content, id) => conn.cssLoad(content, id),

                        /**
                         * Unload CSS by ID
                         * @param {string} id - Sheet ID
                         * @returns {boolean} Success status
                         */
                        unload: (id) => conn.cssUnload(id),

                        /**
                         * Clear all loaded CSS sheets
                         * @returns {string} Result message
                         */
                        clearAll: () => conn.cssClearAll(),

                        /**
                         * List all loaded CSS sheet IDs
                         * @returns {string[]} List of IDs
                         */
                        list: () => conn.cssList()
                    },
                    screen: {
                        /**
                         * Take a screenshot
                         * @param {string} [selector] - Optional CSS selector
                         * @returns {object} Result object {tag: 'ok'|'err', val: Uint8Array}
                         */
                        capture: (selector) => conn.screenshot(selector)
                    },
                    /**
                     * Execute JavaScript in chrome context
                     * @param {string} script - JavaScript code
                     * @param {string} [args] - Optional arguments (JSON string)
                     * @returns {object} Result object {tag: 'ok'|'err', val: string}
                     */
                    execute: (script, args) => conn.execute(script, args)
                }
            };
        }
        return result;
    }
};
