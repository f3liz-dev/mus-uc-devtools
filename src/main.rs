mod chrome_css_manager;
mod cli;
mod bundler;
mod marionette_client;
mod chrome_manifest;

pub use chrome_css_manager::ChromeCSSManager;
pub use chrome_manifest::ChromeManifestRegistrar;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    cli::run_cli()
}
