use std::path::Path;

#[derive(Default)]
pub struct ChromeManifestRegistrar {
    manifest_path: Option<String>,
}

impl ChromeManifestRegistrar {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a chrome.manifest file with Firefox
    /// This allows CSS files to use @import 'mus-uc/<relative-path>' syntax
    pub fn register_manifest(
        &mut self,
        manifest_path: &Path,
        connection: &mut crate::marionette_client::MarionetteConnection,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let absolute_path = manifest_path.canonicalize()?;
        let path_str = absolute_path.to_str().ok_or("Invalid path encoding")?;

        // Script to register chrome.manifest using ComponentRegistrar
        let script = format!(
            r#"
            try {{
                // Create nsIFile instance for the chrome.manifest
                let cmanifest = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                cmanifest.initWithPath('{}');
                
                // Register using ComponentRegistrar for immediate registration
                let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
                registrar.autoRegister(cmanifest);
                
                return {{ success: true, path: '{}' }};
            }} catch (e) {{
                return {{ success: false, error: e.toString() }};
            }}
        "#,
            path_str, path_str
        );

        let result = connection.execute_script(&script, None)?;

        // Check if registration was successful
        if let Some(success) = result.get("success").and_then(|v| v.as_bool()) {
            if success {
                self.manifest_path = Some(path_str.to_string());
                Ok(())
            } else {
                let error = result
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error");
                Err(format!("Failed to register chrome.manifest: {}", error).into())
            }
        } else {
            Err("Unexpected response from manifest registration".into())
        }
    }

    pub fn get_registered_path(&self) -> Option<&str> {
        self.manifest_path.as_deref()
    }
}
