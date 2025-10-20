mod chrome_css_manager;
mod chrome_manifest;
mod cli;
mod marionette_client;
mod screenshot;

pub use chrome_css_manager::ChromeCSSManager;
pub use chrome_manifest::ChromeManifestRegistrar;
pub use screenshot::ScreenshotManager;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    cli::run_cli()
}
