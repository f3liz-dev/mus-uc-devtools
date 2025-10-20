// Example: List open tabs
// Usage: ./mus-uc exec -f examples/js/list-tabs.js

const window = Services.wm.getMostRecentWindow("navigator:browser");
const tabs = window.gBrowser.tabs;

const tabInfo = Array.from(tabs).map(tab => {
    const browser = tab.linkedBrowser;
    return {
        title: browser.contentTitle || "Untitled",
        url: browser.currentURI ? browser.currentURI.spec : "about:blank",
        selected: tab.selected
    };
});

return {
    totalTabs: tabs.length,
    tabs: tabInfo
};
