// Example: Get Firefox browser information
// Usage: ./mus-uc exec -f examples/js/browser-info.js

const window = Services.wm.getMostRecentWindow("navigator:browser");
const doc = window.document;

return {
    title: doc.title,
    url: window.location.href,
    userAgent: window.navigator.userAgent,
    firefoxVersion: Services.appinfo.version,
    platform: Services.appinfo.OS
};
