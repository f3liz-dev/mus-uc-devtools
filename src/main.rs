mod bundler;
mod chrome_css_manager;
mod chrome_manifest;
mod cli;
mod marionette_client;

pub use chrome_css_manager::ChromeCSSManager;
pub use chrome_manifest::ChromeManifestRegistrar;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    cli::run_cli()
}
