mod chrome_css_manager;
mod cli;
mod bundler;

pub use chrome_css_manager::ChromeCSSManager;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    cli::run_cli()
}
