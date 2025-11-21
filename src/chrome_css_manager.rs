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
        let mut connection = MarionetteConnection::connect(&MarionetteSettings::new())?;
        connection.set_context("chrome")?;
        Ok(Self::new_with_connection(connection))
    }

    pub fn new_with_connection(connection: MarionetteConnection) -> Self {
        ChromeCSSManager {
            connection,
            loaded_sheets: HashMap::new(),
            manifest_registrar: ChromeManifestRegistrar::new(),
        }
    }

    pub fn connection_mut(&mut self) -> &mut MarionetteConnection {
        &mut self.connection
    }

    pub fn initialize_chrome_context(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let chrome_script = r#"
            if (typeof window.chromeCssManager === 'undefined') {
                window.chromeCssManager = {
                    sheets: new Map(),
                    sss: Cc["@mozilla.org/content/style-sheet-service;1"]
                         .getService(Ci.nsIStyleSheetService),

                    load(css, id) {
                        const sheetId = id || `sheet-${Date.now()}`;
                        const uri = Services.io.newURI(`data:text/css;charset=utf-8,${encodeURIComponent(css)}`);
                        
                        this.sss.loadAndRegisterSheet(uri, this.sss.USER_SHEET);
                        this.sheets.set(sheetId, uri);
                        return sheetId;
                    },

                    unload(id) {
                        const uri = this.sheets.get(id);
                        if (!uri) return false;

                        if (this.sss.sheetRegistered(uri, this.sss.USER_SHEET)) {
                            this.sss.unregisterSheet(uri, this.sss.USER_SHEET);
                        }
                        this.sheets.delete(id);
                        return true;
                    },

                    clear() {
                        for (const id of this.sheets.keys()) {
                            this.unload(id);
                        }
                    }
                };
            }
            return "initialized";
        "#;

        self.connection.execute_script(chrome_script, None)?;
        Ok(())
    }

    pub fn load_css(
        &mut self,
        css_content: &str,
        id: Option<&str>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let id_param = id.map(|s| format!(", '{}'", s)).unwrap_or_default();
        let script = format!(
            "return window.chromeCssManager.load(`{}`{});",
            css_content.replace('`', r"\`"),
            id_param
        );

        let result = self.connection.execute_script(&script, None)?;
        let sheet_id = result.as_str().unwrap_or("unknown").to_string();
        self.loaded_sheets
            .insert(sheet_id.clone(), css_content.to_string());

        Ok(sheet_id)
    }

    pub fn unload_css(&mut self, id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let script = format!("return window.chromeCssManager.unload('{}');", id);
        let result = self.connection.execute_script(&script, None)?;
        let success = result.as_bool().unwrap_or(false);

        if success {
            self.loaded_sheets.remove(id);
        }
        Ok(success)
    }

    pub fn clear_all(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.connection
            .execute_script("window.chromeCssManager.clear();", None)?;
        self.loaded_sheets.clear();
        Ok(())
    }

    pub fn list_loaded(&self) -> Vec<String> {
        self.loaded_sheets.keys().cloned().collect()
    }

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

    pub fn watch_and_reload(
        &mut self,
        file_path: &str,
        id: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        use std::fs;

        let path = Path::new(file_path);
        if !path.exists() {
            return Err(format!("File not found: {}", file_path).into());
        }

        let sheet_id = id.unwrap_or("watched-sheet").to_string();

        // Load initial CSS
        let css_content = fs::read_to_string(path)?;
        self.load_css(&css_content, Some(&sheet_id))?;
        println!("Initial CSS loaded with ID: {}", sheet_id);

        let (tx, rx) = channel();
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                tx.send(event).ok();
            }
        })?;

        watcher.watch(path, RecursiveMode::NonRecursive)?;

        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(event) if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) => {
                    println!("File changed, reloading CSS...");
                    self.unload_css(&sheet_id)?;
                    std::thread::sleep(Duration::from_millis(50));

                    match fs::read_to_string(path) {
                        Ok(css) => {
                            self.load_css(&css, Some(&sheet_id))?;
                            println!("CSS reloaded successfully");
                        }
                        Err(e) => eprintln!("Error reading file: {}", e),
                    }
                }
                Ok(_) => {} // Other events, ignore
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("File watcher disconnected".into());
                }
            }
        }
    }
}
