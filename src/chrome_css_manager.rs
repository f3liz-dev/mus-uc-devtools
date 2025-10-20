use crate::chrome_manifest::ChromeManifestRegistrar;
use crate::marionette_client::{MarionetteConnection, MarionetteSettings};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;

pub struct ChromeCSSManager {
    connection: MarionetteConnection,
    loaded_sheets: HashMap<String, String>,
    manifest_registrar: ChromeManifestRegistrar,
}

impl ChromeCSSManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let settings = MarionetteSettings::new();
        let mut connection = MarionetteConnection::connect(&settings)?;

        // Set context to chrome for privileged operations
        // This allows access to XPCOM components like nsIStyleSheetService
        // which is required for userChrome CSS manipulation.
        // See GECKODRIVER_ANALYSIS.md for details on chrome context.
        connection.set_context("chrome")?;

        Ok(ChromeCSSManager {
            connection,
            loaded_sheets: HashMap::new(),
            manifest_registrar: ChromeManifestRegistrar::new(),
        })
    }

    pub fn initialize_chrome_context(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Switch to chrome context for privileged operations
        let chrome_script = r#"
            // Initialize ChromeCSS class in chrome context with unique variable names
            if (typeof _$chrome#css$manager_# === 'undefined') {
                _$chrome#css$manager_# = class {
                    constructor() {
                        this.sheets = new Map();
                        this.sss = Cc["@mozilla.org/content/style-sheet-service;1"]
                                   .getService(Ci.nsIStyleSheetService);
                    }

                    load(css, id) {
                        const sheetId = id || `sheet-${Date.now()}`;
                        const uri = Services.io.newURI(`data:text/css;charset=utf-8,${encodeURIComponent(css)}`);
                        
                        this.sss.loadAndRegisterSheet(uri, this.sss.USER_SHEET);
                        this.sheets.set(sheetId, uri);
                        
                        return sheetId;
                    }

                    unload(id) {
                        const uri = this.sheets.get(id);
                        if (!uri) return false;

                        if (this.sss.sheetRegistered(uri, this.sss.USER_SHEET)) {
                            this.sss.unregisterSheet(uri, this.sss.USER_SHEET);
                        }
                        
                        this.sheets.delete(id);
                        return true;
                    }

                    clear() {
                        Array.from(this.sheets.keys()).forEach(id => this.unload(id));
                    }
                };
                
                window.__$ff_chrome_css_mgr$__ = new _$chrome#css$manager_#();
            }
            return "_$chrome#css$manager_# initialized";
        "#;

        self.connection.execute_script(chrome_script, None)?;
        Ok(())
    }

    pub fn load_css(
        &mut self,
        css_content: &str,
        id: Option<&str>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let script = if let Some(sheet_id) = id {
            format!(
                r#"
                const result = window.__$ff_chrome_css_mgr$__.load(`{}`, '{}');
                return result;
            "#,
                css_content.replace('`', r"\`"),
                sheet_id
            )
        } else {
            format!(
                r#"
                const result = window.__$ff_chrome_css_mgr$__.load(`{}`);
                return result;
            "#,
                css_content.replace('`', r"\`")
            )
        };

        let result = self.connection.execute_script(&script, None)?;
        let sheet_id = result.as_str().unwrap_or("unknown").to_string();
        self.loaded_sheets
            .insert(sheet_id.clone(), css_content.to_string());

        Ok(sheet_id)
    }

    pub fn unload_css(&mut self, id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let script = format!(
            r#"
            const result = window.__$ff_chrome_css_mgr$__.unload('{}');
            return result;
        "#,
            id
        );

        let result = self.connection.execute_script(&script, None)?;
        let success = result.as_bool().unwrap_or(false);

        if success {
            self.loaded_sheets.remove(id);
        }

        Ok(success)
    }

    pub fn clear_all(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let script = r#"
            window.__$ff_chrome_css_mgr$__.clear();
            return "cleared";
        "#;

        self.connection.execute_script(script, None)?;
        self.loaded_sheets.clear();

        Ok(())
    }

    pub fn list_loaded(&self) -> Vec<String> {
        self.loaded_sheets.keys().cloned().collect()
    }

    /// Register a chrome.manifest file to enable chrome:// URI loading in CSS
    /// This allows CSS files to use @import 'mus-uc/<relative-path>' syntax
    pub fn register_chrome_manifest(
        &mut self,
        manifest_path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.manifest_registrar
            .register_manifest(manifest_path, &mut self.connection)
    }

    pub fn get_registered_manifest(&self) -> Option<&str> {
        self.manifest_registrar.get_registered_path()
    }

    /// Watch a CSS file for changes and automatically reload it
    pub fn watch_and_reload(
        &mut self,
        file_path: &str,
        id: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        use std::fs;

        // Constants for watch behavior
        const POLL_INTERVAL_MS: u64 = 100; // Check for events every 100ms
        const FILE_WRITE_DELAY_MS: u64 = 50; // Wait for file write to complete

        let path = Path::new(file_path);
        if !path.exists() {
            return Err(format!("File not found: {}", file_path).into());
        }

        // Determine the ID to use for the stylesheet
        let sheet_id = id.unwrap_or("watched-sheet").to_string();

        // Load the initial CSS
        let css_content = fs::read_to_string(path)?;
        self.load_css(&css_content, Some(&sheet_id))?;
        println!("Initial CSS loaded with ID: {}", sheet_id);

        // Create a channel for file system events
        let (tx, rx) = channel();

        // Create a watcher
        // The watcher must remain in scope for the duration of the watch loop
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                tx.send(event).ok();
            }
        })?;

        // Watch the file
        watcher.watch(path, RecursiveMode::NonRecursive)?;

        // Watch loop - runs until Ctrl+C or error
        loop {
            match rx.recv_timeout(Duration::from_millis(POLL_INTERVAL_MS)) {
                Ok(event) => {
                    // Check if the event is a modify or create event
                    // (some editors save by deleting and recreating)
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        println!("File changed, reloading CSS...");

                        // Unload the current CSS
                        if let Err(e) = self.unload_css(&sheet_id) {
                            eprintln!("Error unloading CSS: {}", e);
                            continue;
                        }

                        // Small delay to ensure file write is complete
                        std::thread::sleep(Duration::from_millis(FILE_WRITE_DELAY_MS));

                        // Reload the CSS
                        match fs::read_to_string(path) {
                            Ok(new_css) => match self.load_css(&new_css, Some(&sheet_id)) {
                                Ok(_) => println!("CSS reloaded successfully"),
                                Err(e) => eprintln!("Error loading CSS: {}", e),
                            },
                            Err(e) => eprintln!("Error reading file: {}", e),
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // No events, continue waiting
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("File watcher disconnected".into());
                }
            }
        }
    }
}
