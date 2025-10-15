mod chrome_css_manager;
mod cli;
mod bundler;
mod marionette_client;

pub use chrome_css_manager::ChromeCSSManager;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    cli::run_cli()
}
