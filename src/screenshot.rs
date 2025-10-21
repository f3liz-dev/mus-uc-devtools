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

    pub fn capture_full_screen(&mut self) -> Result<String, Box<dyn std::error::Error>> {
        let script = r#"
            const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
            const window = Services.wm.getMostRecentWindow("navigator:browser");
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawWindow(window, 0, 0, canvas.width, canvas.height, "rgb(255,255,255)");
            return canvas.toDataURL("image/png");
        "#;

        let result = self.connection.execute_script(script, None)?;
        result
            .as_str()
            .ok_or("Failed to get data URL from screenshot".into())
            .map(String::from)
    }

    pub fn capture_element(
        &mut self,
        selector: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let escaped_selector = selector.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"
            const window = Services.wm.getMostRecentWindow("navigator:browser");
            const element = window.document.querySelector("{}");
            if (!element) throw new Error("Element not found: {}");
            
            const rect = element.getBoundingClientRect();
            const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext("2d");
            ctx.drawWindow(window, rect.left, rect.top, rect.width, rect.height, "rgb(255,255,255)");
            return canvas.toDataURL("image/png");
        "#,
            escaped_selector, escaped_selector
        );

        let result = self.connection.execute_script(&script, None)?;
        result
            .as_str()
            .ok_or("Failed to get data URL from screenshot".into())
            .map(String::from)
    }

    pub fn save_data_url_to_file(
        data_url: &str,
        output_path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let base64_data = data_url
            .split(',')
            .nth(1)
            .ok_or("Invalid data URL format")?;

        let image_data = general_purpose::STANDARD.decode(base64_data)?;
        fs::write(output_path, image_data)?;
        Ok(())
    }

    pub fn screenshot_to_file(
        &mut self,
        output_path: &Path,
        selector: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let data_url = match selector {
            Some(sel) => self.capture_element(sel)?,
            None => self.capture_full_screen()?,
        };
        Self::save_data_url_to_file(&data_url, output_path)
    }
}
