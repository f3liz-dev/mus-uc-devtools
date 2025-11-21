import { cssManager, marionette, screenshot } from '../dist/mus_uc_devtools.js';

export const css: {
    initialize: typeof cssManager.initialize;
    load: (content: string, id?: string) => string;
    unload: typeof cssManager.unloadCss;
    clearAll: typeof cssManager.clearAll;
    list: typeof cssManager.listLoaded;
};

export const client: {
    connect: typeof marionette.connect;
    execute: (script: string, args?: string) => string;
};

export const screen: {
    capture: typeof screenshot.takeScreenshot;
};

export { cssManager, marionette, screenshot };
