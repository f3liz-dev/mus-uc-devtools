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
use exports::mus_uc::devtools::client::{
    Guest, GuestConnection, ResultBool, ResultBytes, ResultList, ResultString,
};
// Import the generated client module so we can reference the exported resource
// type `client::Connection` when returning from `connect`.
use exports::mus_uc::devtools::client;

#[cfg(feature = "component")]
pub struct Component;

#[cfg(feature = "component")]
pub struct Connection {
    manager: Mutex<ChromeCSSManager>,
}

#[cfg(feature = "component")]
impl Guest for Component {
    // The WIT-generated `Guest` trait expects the exported resource type
    // defined in `exports::mus_uc::devtools::client::Connection`.
    // Wrap our local `Connection` (which implements `GuestConnection`) using
    // `client::Connection::new` when returning a new connection from `connect`.
    type Connection = client::Connection;

    fn connect(host: String, port: u16) -> Result<Self::Connection, String> {
        MarionetteConnection::connect(&MarionetteSettings { host, port })
            .and_then(|mut conn| {
                conn.set_context("chrome")?;
                Ok(conn)
            })
            .map(|conn| {
                // construct our internal Connection type and wrap it with the
                // WIT-generated resource type so it matches the expected return
                // signature.
                client::Connection::new(Connection {
                    manager: Mutex::new(ChromeCSSManager::new_with_connection(conn)),
                })
            })
            .map_err(|e| e.to_string())
    }
}

#[cfg(feature = "component")]
impl GuestConnection for Connection {
    fn css_initialize(&self) -> ResultString {
        self.manager
            .lock()
            .unwrap()
            .initialize_chrome_context()
            .map(|_| "initialized".to_string())
            .map(ResultString::Ok)
            .unwrap_or_else(|e| ResultString::Err(e.to_string()))
    }

    fn css_load(&self, content: String, id: Option<String>) -> ResultString {
        self.manager
            .lock()
            .unwrap()
            .load_css(&content, id.as_deref())
            .map(ResultString::Ok)
            .unwrap_or_else(|e| ResultString::Err(e.to_string()))
    }

    fn css_unload(&self, id: String) -> ResultBool {
        self.manager
            .lock()
            .unwrap()
            .unload_css(&id)
            .map(ResultBool::Ok)
            .unwrap_or_else(|e| ResultBool::Err(e.to_string()))
    }

    fn css_clear_all(&self) -> ResultString {
        self.manager
            .lock()
            .unwrap()
            .clear_all()
            .map(|_| "cleared".to_string())
            .map(ResultString::Ok)
            .unwrap_or_else(|e| ResultString::Err(e.to_string()))
    }

    fn css_list(&self) -> ResultList {
        let mgr = self.manager.lock().unwrap();
        ResultList::Ok(mgr.list_loaded())
    }

    fn execute(&self, script: String, args: Option<String>) -> ResultString {
        let mut mgr = self.manager.lock().unwrap();
        let parsed_args = args.and_then(|a| serde_json::from_str(&a).ok());
        mgr.connection_mut()
            .execute_script(&script, parsed_args)
            .map(|r| r.to_string())
            .map(ResultString::Ok)
            .unwrap_or_else(|e| ResultString::Err(e.to_string()))
    }

    fn screenshot(&self, selector: Option<String>) -> ResultBytes {
        let mut mgr = self.manager.lock().unwrap();
        crate::screenshot::take_screenshot(mgr.connection_mut(), selector.as_deref())
            .map(ResultBytes::Ok)
            .unwrap_or_else(|e| ResultBytes::Err(e.to_string()))
    }
}

// Delegate the generated resource `client::Connection` to our local `Connection`
// implementation. The WIT-generated exports expect the exported resource type to
// implement `GuestConnection`. We already implemented the trait for our local
// `Connection`; here we forward the calls so the exported resource works as
// expected.
#[cfg(feature = "component")]
impl client::GuestConnection for client::Connection {
    fn css_initialize(&self) -> ResultString {
        self.get::<Connection>().css_initialize()
    }

    fn css_load(&self, content: String, id: Option<String>) -> ResultString {
        self.get::<Connection>().css_load(content, id)
    }

    fn css_unload(&self, id: String) -> ResultBool {
        self.get::<Connection>().css_unload(id)
    }

    fn css_clear_all(&self) -> ResultString {
        self.get::<Connection>().css_clear_all()
    }

    fn css_list(&self) -> ResultList {
        self.get::<Connection>().css_list()
    }

    fn execute(&self, script: String, args: Option<String>) -> ResultString {
        self.get::<Connection>().execute(script, args)
    }

    fn screenshot(&self, selector: Option<String>) -> ResultBytes {
        self.get::<Connection>().screenshot(selector)
    }
}

#[cfg(feature = "component")]
export!(Component);
