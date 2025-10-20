use crate::marionette_client::MarionetteConnection;
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::Path;

pub struct ScreenshotManager {
    connection: MarionetteConnection,
}

impl ScreenshotManager {
    pub fn new(mut connection: MarionetteConnection) -> Result<Self, Box<dyn std::error::Error>> {
        // Set context to chrome for privileged operations
        connection.set_context("chrome")?;
        Ok(ScreenshotManager { connection })
    }

    /// Take a screenshot of the entire browser window
    pub fn capture_full_screen(&mut self) -> Result<String, Box<dyn std::error::Error>> {
        let script = r#"
            let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
            let window = Services.wm.getMostRecentWindow("navigator:browser");
            let width = window.innerWidth;
            let height = window.innerHeight;

            canvas.width = width;
            canvas.height = height;

            let ctx = canvas.getContext("2d");
            ctx.drawWindow(window, 0, 0, width, height, "rgb(255,255,255)");

            // Convert to data URL
            let dataURL = canvas.toDataURL("image/png");
            return dataURL;
        "#;

        let result = self.connection.execute_script(script, None)?;
        let data_url = result
            .as_str()
            .ok_or("Failed to get data URL from screenshot")?
            .to_string();

        Ok(data_url)
    }

    /// Take a screenshot of a specific element using CSS selector
    pub fn capture_element(
        &mut self,
        selector: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let script = format!(
            r#"
            let window = Services.wm.getMostRecentWindow("navigator:browser");
            let doc = window.document;
            let element = doc.querySelector("{}");
            
            if (!element) {{
                throw new Error("Element not found for selector: {}");
            }}

            // Get element position and dimensions
            let rect = element.getBoundingClientRect();
            
            // Create canvas
            let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
            canvas.width = rect.width;
            canvas.height = rect.height;

            let ctx = canvas.getContext("2d");
            ctx.drawWindow(window, rect.left, rect.top, rect.width, rect.height, "rgb(255,255,255)");

            // Convert to data URL
            let dataURL = canvas.toDataURL("image/png");
            return dataURL;
        "#,
            selector.replace('\\', "\\\\").replace('"', "\\\""),
            selector.replace('\\', "\\\\").replace('"', "\\\"")
        );

        let result = self.connection.execute_script(&script, None)?;
        let data_url = result
            .as_str()
            .ok_or("Failed to get data URL from screenshot")?
            .to_string();

        Ok(data_url)
    }

    /// Save a data URL to a file
    pub fn save_data_url_to_file(
        data_url: &str,
        output_path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Extract base64 data from data URL
        // Format: data:image/png;base64,<base64-data>
        let parts: Vec<&str> = data_url.split(',').collect();
        if parts.len() != 2 {
            return Err("Invalid data URL format".into());
        }

        let base64_data = parts[1];

        // Decode base64 data
        let image_data = general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

        // Write to file
        fs::write(output_path, image_data)?;

        Ok(())
    }

    /// Take a screenshot and save it to a file
    pub fn screenshot_to_file(
        &mut self,
        output_path: &Path,
        selector: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let data_url = if let Some(sel) = selector {
            self.capture_element(sel)?
        } else {
            self.capture_full_screen()?
        };

        Self::save_data_url_to_file(&data_url, output_path)?;

        Ok(())
    }
}
