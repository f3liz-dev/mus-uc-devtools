use std::path::Path;

#[derive(Default)]
pub struct ChromeManifestRegistrar {
    manifest_path: Option<String>,
}

impl ChromeManifestRegistrar {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_manifest(
        &mut self,
        manifest_path: &Path,
        connection: &mut crate::marionette_client::MarionetteConnection,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let path_str = manifest_path
            .canonicalize()?
            .to_str()
            .ok_or("Invalid path encoding")?
            .to_string();

        let script = format!(
            r#"
            try {{
                const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
                file.initWithPath('{}');
                const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
                registrar.autoRegister(file);
                return {{ success: true }};
            }} catch (e) {{
                return {{ success: false, error: e.toString() }};
            }}
        "#,
            path_str
        );

        let result = connection.execute_script(&script, None)?;
        let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

        if success {
            self.manifest_path = Some(path_str);
            Ok(())
        } else {
            let error = result
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(format!("Failed to register chrome.manifest: {}", error).into())
        }
    }

    pub fn get_registered_path(&self) -> Option<&str> {
        self.manifest_path.as_deref()
    }
}
