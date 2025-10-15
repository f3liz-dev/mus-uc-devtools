# Example: Using Chrome Context with Marionette

This example demonstrates how to use the Marionette protocol to execute JavaScript in Firefox's chrome-privileged context.

## What is Chrome Context?

Chrome context provides access to Firefox's internal APIs and XPCOM components, allowing you to:
- Manipulate browser UI
- Access privileged services
- Inject userChrome CSS
- Interact with browser internals

## Example 1: Basic Chrome Context Script

```rust
use firefox_chrome_css_cli::marionette_client::{MarionetteClient, MarionetteSettings};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to Firefox (must have marionette enabled on port 2828)
    let settings = MarionetteSettings::new();
    let mut client = MarionetteClient::connect(&settings.host, settings.port)?;
    
    // Switch to chrome context
    client.set_context("chrome")?;
    
    // Execute a script in chrome context
    let script = r#"
        // Access XPCOM component
        const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                    .getService(Ci.nsIStyleSheetService);
        
        // Create a data URI for CSS
        const css = `#nav-bar { background: red !important; }`;
        const uri = Services.io.newURI(
            `data:text/css;charset=utf-8,${encodeURIComponent(css)}`
        );
        
        // Load the stylesheet
        sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
        
        return "Navigation bar styled!";
    "#;
    
    let result = client.execute_script(script, None)?;
    println!("Result: {:?}", result);
    
    Ok(())
}
```

## Example 2: Query Browser Information

```javascript
// In chrome context, you can access browser internals
const script = `
    return {
        version: Services.appinfo.version,
        buildID: Services.appinfo.appBuildID,
        OS: Services.appinfo.OS,
        platformVersion: Services.appinfo.platformVersion
    };
`;
```

## Example 3: Manipulate Browser UI

```javascript
// Hide the bookmark bar
const script = `
    const bookmarksBar = document.getElementById("PersonalToolbar");
    if (bookmarksBar) {
        bookmarksBar.style.display = "none";
        return "Bookmarks bar hidden";
    }
    return "Bookmarks bar not found";
`;
```

## Important Notes

1. **Security**: Chrome context provides full access to browser internals. Use responsibly.
2. **Persistence**: Changes made via chrome context are not persistent across browser restarts unless using proper stylesheet services.
3. **Error Handling**: Always check for errors when accessing XPCOM components.

## References

- See `../GECKODRIVER_ANALYSIS.md` for implementation details
- [Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/Protocol.html)
- [XPCOM Components](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM)
