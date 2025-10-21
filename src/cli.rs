use crate::marionette_client::{MarionetteConnection, MarionetteSettings};
use crate::{ChromeCSSManager, ScreenshotManager};
use clap::{crate_version, App, Arg, SubCommand};
use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

fn read_input(file: Option<&str>, prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
    match file {
        Some(path) => fs::read_to_string(path).map_err(Into::into),
        None => {
            println!("{}", prompt);
            let mut buffer = String::new();
            io::stdin().read_to_string(&mut buffer)?;
            Ok(buffer)
        }
    }
}

pub fn run_cli() -> Result<(), Box<dyn std::error::Error>> {
    let matches = App::new("mus-uc-devtools")
        .version(crate_version!())
        .about("Loads userChrome CSS into Firefox chrome context via Marionette")
        .subcommand(
            SubCommand::with_name("load")
                .about("Load CSS from file or stdin")
                .arg(
                    Arg::with_name("file")
                        .short("f")
                        .long("file")
                        .value_name("FILE")
                        .help("CSS file to load")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("id")
                        .short("i")
                        .long("id")
                        .value_name("ID")
                        .help("Custom ID for the stylesheet")
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("watch")
                .about("Watch CSS file for changes and auto-reload")
                .arg(
                    Arg::with_name("file")
                        .short("f")
                        .long("file")
                        .value_name("FILE")
                        .help("CSS file to watch")
                        .required(true)
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("id")
                        .short("i")
                        .long("id")
                        .value_name("ID")
                        .help("Custom ID for the stylesheet")
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("register-manifest")
                .about("Register chrome.manifest to enable chrome:// URIs in CSS imports")
                .arg(
                    Arg::with_name("manifest")
                        .short("m")
                        .long("manifest")
                        .value_name("MANIFEST")
                        .help("Path to chrome.manifest file")
                        .required(true)
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("unload")
                .about("Unload CSS by ID")
                .arg(
                    Arg::with_name("id")
                        .required(true)
                        .help("ID of stylesheet to unload")
                        .index(1),
                ),
        )
        .subcommand(SubCommand::with_name("clear").about("Clear all loaded stylesheets"))
        .subcommand(SubCommand::with_name("list").about("List all loaded stylesheets"))
        .subcommand(SubCommand::with_name("interactive").about("Start interactive mode"))
        .subcommand(
            SubCommand::with_name("screenshot")
                .about("Take a screenshot of the browser window")
                .arg(
                    Arg::with_name("output")
                        .short("o")
                        .long("output")
                        .value_name("FILE")
                        .help("Output file path (default: screenshot.png)")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("selector")
                        .short("s")
                        .long("selector")
                        .value_name("CSS_SELECTOR")
                        .help("CSS selector to capture a specific element (default: full screen)")
                        .takes_value(true),
                ),
        )
        .subcommand(
            SubCommand::with_name("exec")
                .about("Execute JavaScript in Firefox chrome context")
                .arg(
                    Arg::with_name("file")
                        .short("f")
                        .long("file")
                        .value_name("FILE")
                        .help("JavaScript file to execute")
                        .takes_value(true),
                )
                .arg(
                    Arg::with_name("args")
                        .short("a")
                        .long("args")
                        .value_name("JSON")
                        .help("Arguments to pass to the script as JSON array")
                        .takes_value(true),
                ),
        )
        .get_matches();

    let mut manager = ChromeCSSManager::new()?;
    manager.initialize_chrome_context()?;

    match matches.subcommand() {
        ("register-manifest", Some(sub_matches)) => {
            let manifest_path = sub_matches.value_of("manifest").unwrap();
            let path = Path::new(manifest_path);

            if !path.exists() {
                return Err(format!("chrome.manifest file not found: {}", manifest_path).into());
            }

            manager.register_chrome_manifest(path)?;
            println!(
                "chrome.manifest registered: {}",
                manager.get_registered_manifest().unwrap_or("unknown")
            );
        }

        ("load", Some(sub_matches)) => {
            let css = read_input(sub_matches.value_of("file"), "Enter CSS content (Ctrl+D to finish):")?;
            let sheet_id = manager.load_css(&css, sub_matches.value_of("id"))?;
            println!("CSS loaded with ID: {}", sheet_id);
        }

        ("watch", Some(sub_matches)) => {
            let file_path = sub_matches.value_of("file").unwrap();
            let id = sub_matches.value_of("id");

            println!("Watching {} for changes (Ctrl+C to stop)...", file_path);
            manager.watch_and_reload(file_path, id)?;
        }

        ("unload", Some(sub_matches)) => {
            let id = sub_matches.value_of("id").unwrap();
            let msg = if manager.unload_css(id)? {
                format!("CSS unloaded: {}", id)
            } else {
                format!("Failed to unload CSS: {}", id)
            };
            println!("{}", msg);
        }

        ("clear", Some(_)) => {
            manager.clear_all()?;
            println!("All CSS cleared");
        }

        ("list", Some(_)) => {
            let loaded = manager.list_loaded();
            if loaded.is_empty() {
                println!("No stylesheets loaded");
            } else {
                println!("Loaded stylesheets:");
                for id in loaded {
                    println!("  - {}", id);
                }
            }
        }

        ("interactive", Some(_)) => {
            run_interactive_mode(&mut manager)?;
        }

        ("screenshot", Some(sub_matches)) => {
            let output = sub_matches.value_of("output").unwrap_or("screenshot.png");
            let selector = sub_matches.value_of("selector");

            let connection = MarionetteConnection::connect(&MarionetteSettings::new())?;
            let mut screenshot_manager = ScreenshotManager::new(connection)?;
            screenshot_manager.screenshot_to_file(Path::new(output), selector)?;

            match selector {
                Some(sel) => println!("Screenshot of element '{}' saved to: {}", sel, output),
                None => println!("Full-screen screenshot saved to: {}", output),
            }
        }

        ("exec", Some(sub_matches)) => {
            let js = read_input(sub_matches.value_of("file"), "Enter JavaScript code (Ctrl+D to finish):")?;
            if js.trim().is_empty() {
                return Err("No JavaScript code provided".into());
            }

            let args = sub_matches
                .value_of("args")
                .map(|s| -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error>> {
                    match serde_json::from_str(s)? {
                        serde_json::Value::Array(arr) => Ok(arr),
                        _ => Err("Arguments must be a JSON array".into()),
                    }
                })
                .transpose()?;

            let mut connection = MarionetteConnection::connect(&MarionetteSettings::new())?;
            connection.set_context("chrome")?;
            let result = connection.execute_script(&js, args)?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }

        _ => {
            println!("Use --help for usage information");
        }
    }

    Ok(())
}

fn read_css_lines() -> Result<String, Box<dyn std::error::Error>> {
    println!("Enter CSS content (empty line to finish):");
    let mut lines = Vec::new();
    loop {
        let mut line = String::new();
        io::stdin().read_line(&mut line)?;
        if line.trim().is_empty() {
            break;
        }
        lines.push(line.trim_end().to_string());
    }
    Ok(lines.join("\n"))
}

pub fn run_interactive_mode(
    manager: &mut ChromeCSSManager,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Firefox Chrome CSS Interactive Mode");
    println!("Commands: load [filepath] [id], unload <id>, clear, list, quit");

    loop {
        print!("> ");
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let parts: Vec<&str> = input.trim().split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0] {
            "load" => {
                let css = if parts.len() >= 2 && Path::new(parts[1]).exists() {
                    fs::read_to_string(parts[1])?
                } else {
                    read_css_lines()?
                };

                if !css.is_empty() {
                    let id = parts.get(2).copied();
                    match manager.load_css(&css, id) {
                        Ok(id) => println!("CSS loaded with ID: {}", id),
                        Err(e) => println!("Error loading CSS: {}", e),
                    }
                }
            }

            "unload" => {
                if parts.len() < 2 {
                    println!("Usage: unload <id>");
                    continue;
                }
                match manager.unload_css(parts[1]) {
                    Ok(true) => println!("CSS unloaded: {}", parts[1]),
                    Ok(false) => println!("Failed to unload CSS: {}", parts[1]),
                    Err(e) => println!("Error: {}", e),
                }
            }

            "clear" => match manager.clear_all() {
                Ok(()) => println!("All CSS cleared"),
                Err(e) => println!("Error: {}", e),
            },

            "list" => {
                let loaded = manager.list_loaded();
                if loaded.is_empty() {
                    println!("No stylesheets loaded");
                } else {
                    println!("Loaded stylesheets:");
                    for id in loaded {
                        println!("  - {}", id);
                    }
                }
            }

            "quit" | "exit" => {
                println!("Goodbye!");
                break;
            }

            _ => {
                println!("Unknown command: {}", parts[0]);
                println!("Available commands: load [filepath] [id], unload <id>, clear, list, quit");
            }
        }
    }
    Ok(())
}
