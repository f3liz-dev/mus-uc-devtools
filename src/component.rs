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
use exports::mus_uc::devtools::{
    css_manager::{ResultBool, ResultList, ResultString},
    marionette::ResultString as MarionetteResultString,
    screenshot::ResultBytes,
};

#[cfg(feature = "component")]
static CSS_MANAGER: Mutex<Option<ChromeCSSManager>> = Mutex::new(None);

#[cfg(feature = "component")]
const NOT_INITIALIZED: &str = "CSS Manager not initialized. Call initialize() first.";

#[cfg(feature = "component")]
struct CssManager;

#[cfg(feature = "component")]
impl exports::mus_uc::devtools::css_manager::Guest for CssManager {
    fn initialize() -> ResultString {
        ChromeCSSManager::new()
            .and_then(|mut m| m.initialize_chrome_context().map(|_| m))
            .map(|m| {
                *CSS_MANAGER.lock().unwrap() = Some(m);
                ResultString::Ok("initialized".to_string())
            })
            .unwrap_or_else(|e| ResultString::Err(e.to_string()))
    }

    fn load_css(content: String, id: Option<String>) -> ResultString {
        CSS_MANAGER
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| NOT_INITIALIZED.to_string())
            .and_then(|m| m.load_css(&content, id.as_deref()).map_err(|e| e.to_string()))
            .map(ResultString::Ok)
            .unwrap_or_else(|e| ResultString::Err(e))
    }

    fn unload_css(id: String) -> ResultBool {
        CSS_MANAGER
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| NOT_INITIALIZED.to_string())
            .and_then(|m| m.unload_css(&id).map_err(|e| e.to_string()))
            .map(ResultBool::Ok)
            .unwrap_or_else(|e| ResultBool::Err(e))
    }

    fn clear_all() -> ResultString {
        CSS_MANAGER
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| NOT_INITIALIZED.to_string())
            .and_then(|m| m.clear_all().map(|_| "cleared".to_string()).map_err(|e| e.to_string()))
            .map(ResultString::Ok)
            .unwrap_or_else(|e| ResultString::Err(e))
    }

    fn list_loaded() -> ResultList {
        CSS_MANAGER
            .lock()
            .unwrap()
            .as_ref()
            .ok_or_else(|| NOT_INITIALIZED.to_string())
            .map(|m| ResultList::Ok(m.list_loaded()))
            .unwrap_or_else(|e| ResultList::Err(e))
    }
}

#[cfg(feature = "component")]
static MARIONETTE_CONN: Mutex<Option<MarionetteConnection>> = Mutex::new(None);

#[cfg(feature = "component")]
const NOT_CONNECTED: &str = "Marionette not connected. Call connect() first.";

#[cfg(feature = "component")]
struct Marionette;

#[cfg(feature = "component")]
impl exports::mus_uc::devtools::marionette::Guest for Marionette {
    fn connect(host: String, port: u16) -> MarionetteResultString {
        MarionetteConnection::connect(&MarionetteSettings { host: host.clone(), port })
            .and_then(|mut conn| {
                conn.set_context("chrome")?;
                Ok(conn)
            })
            .map(|conn| {
                *MARIONETTE_CONN.lock().unwrap() = Some(conn);
                MarionetteResultString::Ok(format!("Connected to {}:{}", host, port))
            })
            .unwrap_or_else(|e| MarionetteResultString::Err(e.to_string()))
    }

    fn execute_script(script: String, args: Option<String>) -> MarionetteResultString {
        MARIONETTE_CONN
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| NOT_CONNECTED.to_string())
            .and_then(|conn| {
                let parsed_args = args.and_then(|a| serde_json::from_str(&a).ok());
                conn.execute_script(&script, parsed_args)
                    .map(|r| r.to_string())
                    .map_err(|e| e.to_string())
            })
            .map(MarionetteResultString::Ok)
            .unwrap_or_else(|e| MarionetteResultString::Err(e))
    }
}

#[cfg(feature = "component")]
struct Screenshot;

#[cfg(feature = "component")]
impl exports::mus_uc::devtools::screenshot::Guest for Screenshot {
    fn take_screenshot(selector: Option<String>) -> ResultBytes {
        MARIONETTE_CONN
            .lock()
            .unwrap()
            .as_mut()
            .ok_or_else(|| "Marionette not connected. Call marionette.connect() first.".to_string())
            .and_then(|conn| {
                crate::screenshot::take_screenshot(conn, selector.as_deref())
                    .map_err(|e| e.to_string())
            })
            .map(ResultBytes::Ok)
            .unwrap_or_else(|e| ResultBytes::Err(e))
    }
}

#[cfg(feature = "component")]
exports::mus_uc::devtools::css_manager::__export_mus_uc_devtools_css_manager_0_1_0_cabi!(CssManager with_types_in exports::mus_uc::devtools::css_manager);

#[cfg(feature = "component")]
exports::mus_uc::devtools::marionette::__export_mus_uc_devtools_marionette_0_1_0_cabi!(Marionette with_types_in exports::mus_uc::devtools::marionette);

#[cfg(feature = "component")]
exports::mus_uc::devtools::screenshot::__export_mus_uc_devtools_screenshot_0_1_0_cabi!(Screenshot with_types_in exports::mus_uc::devtools::screenshot);
