//! mus-uc-devtools library
//!
//! This library provides the core functionality for developing userChrome CSS for Firefox
//! using the Marionette protocol.
//!
//! Note: This library is primarily designed for WASI environments and CLI usage.
//! The wasm-pack build support is experimental and may have limitations.

pub mod chrome_css_manager;
pub mod chrome_manifest;
pub mod marionette_client;
pub mod screenshot;

// Re-export main types
pub use chrome_css_manager::ChromeCSSManager;
pub use chrome_manifest::ChromeManifestRegistrar;
pub use marionette_client::{MarionetteConnection, MarionetteSettings};
