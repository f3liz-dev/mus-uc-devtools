//! Component model bindings for mus-uc-devtools
//!
//! This module provides WebAssembly Component Model exports for use with jco.

#[cfg(feature = "component")]
use crate::{ChromeCSSManager, MarionetteConnection, MarionetteSettings};

#[cfg(feature = "component")]
use std::sync::Mutex;

#[cfg(feature = "component")]
wit_bindgen::generate!({
    world: "mus-uc-component",
    path: "wit",
});

#[cfg(feature = "component")]
// Global state for CSS manager
static CSS_MANAGER: Mutex<Option<ChromeCSSManager>> = Mutex::new(None);

#[cfg(feature = "component")]
struct CssManager;

#[cfg(feature = "component")]
impl exports::mus_uc::devtools::css_manager::Guest for CssManager {
    fn initialize() -> exports::mus_uc::devtools::css_manager::ResultString {
        match ChromeCSSManager::new() {
            Ok(mut manager) => {
                match manager.initialize_chrome_context() {
                    Ok(_) => {
                        *CSS_MANAGER.lock().unwrap() = Some(manager);
                        exports::mus_uc::devtools::css_manager::ResultString::Ok(
                            "initialized".to_string(),
                        )
                    }
                    Err(e) => exports::mus_uc::devtools::css_manager::ResultString::Err(
                        e.to_string(),
                    ),
                }
            }
            Err(e) => {
                exports::mus_uc::devtools::css_manager::ResultString::Err(e.to_string())
            }
        }
    }

    fn load_css(
        content: String,
        id: Option<String>,
    ) -> exports::mus_uc::devtools::css_manager::ResultString {
        let mut manager_guard = CSS_MANAGER.lock().unwrap();
        match manager_guard.as_mut() {
            Some(manager) => match manager.load_css(&content, id.as_deref()) {
                Ok(sheet_id) => {
                    exports::mus_uc::devtools::css_manager::ResultString::Ok(sheet_id)
                }
                Err(e) => {
                    exports::mus_uc::devtools::css_manager::ResultString::Err(e.to_string())
                }
            },
            None => exports::mus_uc::devtools::css_manager::ResultString::Err(
                "CSS Manager not initialized. Call initialize() first.".to_string(),
            ),
        }
    }

    fn unload_css(id: String) -> exports::mus_uc::devtools::css_manager::ResultBool {
        let mut manager_guard = CSS_MANAGER.lock().unwrap();
        match manager_guard.as_mut() {
            Some(manager) => match manager.unload_css(&id) {
                Ok(success) => exports::mus_uc::devtools::css_manager::ResultBool::Ok(success),
                Err(e) => {
                    exports::mus_uc::devtools::css_manager::ResultBool::Err(e.to_string())
                }
            },
            None => exports::mus_uc::devtools::css_manager::ResultBool::Err(
                "CSS Manager not initialized. Call initialize() first.".to_string(),
            ),
        }
    }

    fn clear_all() -> exports::mus_uc::devtools::css_manager::ResultString {
        let mut manager_guard = CSS_MANAGER.lock().unwrap();
        match manager_guard.as_mut() {
            Some(manager) => match manager.clear_all() {
                Ok(_) => exports::mus_uc::devtools::css_manager::ResultString::Ok(
                    "cleared".to_string(),
                ),
                Err(e) => {
                    exports::mus_uc::devtools::css_manager::ResultString::Err(e.to_string())
                }
            },
            None => exports::mus_uc::devtools::css_manager::ResultString::Err(
                "CSS Manager not initialized. Call initialize() first.".to_string(),
            ),
        }
    }

    fn list_loaded() -> exports::mus_uc::devtools::css_manager::ResultList {
        let manager_guard = CSS_MANAGER.lock().unwrap();
        match manager_guard.as_ref() {
            Some(manager) => {
                exports::mus_uc::devtools::css_manager::ResultList::Ok(manager.list_loaded())
            }
            None => exports::mus_uc::devtools::css_manager::ResultList::Err(
                "CSS Manager not initialized. Call initialize() first.".to_string(),
            ),
        }
    }
}

#[cfg(feature = "component")]
// Global state for Marionette connection
static MARIONETTE_CONN: Mutex<Option<MarionetteConnection>> = Mutex::new(None);

#[cfg(feature = "component")]
struct Marionette;

#[cfg(feature = "component")]
impl exports::mus_uc::devtools::marionette::Guest for Marionette {
    fn connect(host: String, port: u16) -> exports::mus_uc::devtools::marionette::ResultString {
        let settings = MarionetteSettings {
            host: host.clone(),
            port,
        };

        match MarionetteConnection::connect(&settings) {
            Ok(mut conn) => {
                // Set chrome context by default
                if let Err(e) = conn.set_context("chrome") {
                    return exports::mus_uc::devtools::marionette::ResultString::Err(
                        e.to_string(),
                    );
                }

                *MARIONETTE_CONN.lock().unwrap() = Some(conn);
                exports::mus_uc::devtools::marionette::ResultString::Ok(format!(
                    "Connected to {}:{}",
                    host, port
                ))
            }
            Err(e) => exports::mus_uc::devtools::marionette::ResultString::Err(e.to_string()),
        }
    }

    fn execute_script(
        script: String,
        args: Option<String>,
    ) -> exports::mus_uc::devtools::marionette::ResultString {
        let mut conn_guard = MARIONETTE_CONN.lock().unwrap();
        match conn_guard.as_mut() {
            Some(conn) => {
                let parsed_args = args.and_then(|a| serde_json::from_str(&a).ok());
                match conn.execute_script(&script, parsed_args) {
                    Ok(result) => exports::mus_uc::devtools::marionette::ResultString::Ok(
                        result.to_string(),
                    ),
                    Err(e) => exports::mus_uc::devtools::marionette::ResultString::Err(
                        e.to_string(),
                    ),
                }
            }
            None => exports::mus_uc::devtools::marionette::ResultString::Err(
                "Marionette not connected. Call connect() first.".to_string(),
            ),
        }
    }
}

#[cfg(feature = "component")]
struct Screenshot;

#[cfg(feature = "component")]
impl exports::mus_uc::devtools::screenshot::Guest for Screenshot {
    fn take_screenshot(
        selector: Option<String>,
    ) -> exports::mus_uc::devtools::screenshot::ResultBytes {
        // This requires screenshot functionality which uses Marionette
        let mut conn_guard = MARIONETTE_CONN.lock().unwrap();
        match conn_guard.as_mut() {
            Some(conn) => {
                match crate::screenshot::take_screenshot(conn, selector.as_deref()) {
                    Ok(png_data) => {
                        exports::mus_uc::devtools::screenshot::ResultBytes::Ok(png_data)
                    }
                    Err(e) => {
                        exports::mus_uc::devtools::screenshot::ResultBytes::Err(e.to_string())
                    }
                }
            }
            None => exports::mus_uc::devtools::screenshot::ResultBytes::Err(
                "Marionette not connected. Call marionette.connect() first.".to_string(),
            ),
        }
    }
}

#[cfg(feature = "component")]
exports::mus_uc::devtools::css_manager::__export_mus_uc_devtools_css_manager_0_1_0_cabi!(CssManager with_types_in exports::mus_uc::devtools::css_manager);

#[cfg(feature = "component")]
exports::mus_uc::devtools::marionette::__export_mus_uc_devtools_marionette_0_1_0_cabi!(Marionette with_types_in exports::mus_uc::devtools::marionette);

#[cfg(feature = "component")]
exports::mus_uc::devtools::screenshot::__export_mus_uc_devtools_screenshot_0_1_0_cabi!(Screenshot with_types_in exports::mus_uc::devtools::screenshot);
