use crate::marionette_client::{MarionetteConnection, MarionetteSettings};
use crate::chrome_manifest::ChromeManifestRegistrar;
use std::collections::HashMap;
use std::path::Path;

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

    pub fn load_css(&mut self, css_content: &str, id: Option<&str>) -> Result<String, Box<dyn std::error::Error>> {
        let script = if let Some(sheet_id) = id {
            format!(r#"
                const result = window.__$ff_chrome_css_mgr$__.load(`{}`, '{}');
                return result;
            "#, css_content.replace('`', r"\`"), sheet_id)
        } else {
            format!(r#"
                const result = window.__$ff_chrome_css_mgr$__.load(`{}`);
                return result;
            "#, css_content.replace('`', r"\`"))
        };

        let result = self.connection.execute_script(&script, None)?;
        let sheet_id = result.as_str().unwrap_or("unknown").to_string();
        self.loaded_sheets.insert(sheet_id.clone(), css_content.to_string());
        
        Ok(sheet_id)
    }

    pub fn unload_css(&mut self, id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let script = format!(r#"
            const result = window.__$ff_chrome_css_mgr$__.unload('{}');
            return result;
        "#, id);

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
    pub fn register_chrome_manifest(&mut self, manifest_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        self.manifest_registrar.register_manifest(manifest_path, &mut self.connection)
    }

    pub fn get_registered_manifest(&self) -> Option<&str> {
        self.manifest_registrar.get_registered_path()
    }
}
