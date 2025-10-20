use crate::{ChromeCSSManager, ScreenshotManager};
use crate::marionette_client::{MarionetteConnection, MarionetteSettings};
use clap::{App, Arg, SubCommand};
use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

pub fn run_cli() -> Result<(), Box<dyn std::error::Error>> {
    let matches = App::new("mus-uc-devtools")
        .version("1.0.0")
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
            let css_content = if let Some(file_path) = sub_matches.value_of("file") {
                fs::read_to_string(file_path)?
            } else {
                println!("Enter CSS content (Ctrl+D to finish):");
                let mut buffer = String::new();
                io::stdin().read_to_string(&mut buffer)?;
                buffer
            };

            let id = sub_matches.value_of("id");
            let sheet_id = manager.load_css(&css_content, id)?;
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
            if manager.unload_css(id)? {
                println!("CSS unloaded: {}", id);
            } else {
                println!("Failed to unload CSS: {}", id);
            }
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
            let output_path = sub_matches.value_of("output").unwrap_or("screenshot.png");
            let selector = sub_matches.value_of("selector");

            // Create a new connection for screenshot (reuses same marionette settings)
            let settings = MarionetteSettings::new();
            let connection = MarionetteConnection::connect(&settings)?;
            let mut screenshot_manager = ScreenshotManager::new(connection)?;

            screenshot_manager.screenshot_to_file(Path::new(output_path), selector)?;
            
            if let Some(sel) = selector {
                println!("Screenshot of element '{}' saved to: {}", sel, output_path);
            } else {
                println!("Full-screen screenshot saved to: {}", output_path);
            }
        }

        ("exec", Some(sub_matches)) => {
            let js_content = if let Some(file_path) = sub_matches.value_of("file") {
                fs::read_to_string(file_path)?
            } else {
                println!("Enter JavaScript code (Ctrl+D to finish):");
                let mut buffer = String::new();
                io::stdin().read_to_string(&mut buffer)?;
                buffer
            };

            // Validate that we have some JavaScript to execute
            if js_content.trim().is_empty() {
                return Err("No JavaScript code provided. Use -f to specify a file or provide code via stdin.".into());
            }

            // Parse arguments if provided
            let args = if let Some(args_str) = sub_matches.value_of("args") {
                let parsed: serde_json::Value = serde_json::from_str(args_str)?;
                if let serde_json::Value::Array(arr) = parsed {
                    Some(arr)
                } else {
                    return Err("Arguments must be a JSON array (e.g., '[\"arg1\", 42]')".into());
                }
            } else {
                None
            };

            // Create a new connection for script execution
            let settings = MarionetteSettings::new();
            let mut connection = MarionetteConnection::connect(&settings)?;
            
            // Switch to chrome context
            connection.set_context("chrome")?;
            
            // Execute the script
            let result = connection.execute_script(&js_content, args)?;
            
            // Print the result
            println!("{}", serde_json::to_string_pretty(&result)?);
        }

        _ => {
            println!("Use --help for usage information");
        }
    }

    Ok(())
}

pub fn run_interactive_mode(
    manager: &mut ChromeCSSManager,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("Firefox Chrome CSS Interactive Mode");
    println!("Commands: load [filepath] [id] [-b], unload <id>, clear, list, quit");

    loop {
        print!("> ");
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        let parts: Vec<&str> = input.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0] {
            "load" => {
                let css_content = if parts.len() >= 2 {
                    // Check if second argument is a file path
                    let potential_path = parts[1];
                    if Path::new(potential_path).exists() {
                        match fs::read_to_string(potential_path) {
                            Ok(content) => {
                                println!("Loading CSS from file: {}", potential_path);
                                content
                            }
                            Err(e) => {
                                println!("Error reading file {}: {}", potential_path, e);
                                continue;
                            }
                        }
                    } else {
                        println!(
                            "File not found: {}. Enter CSS content manually:",
                            potential_path
                        );
                        let mut css_lines = Vec::new();
                        println!("Enter CSS content (empty line to finish):");
                        loop {
                            let mut line = String::new();
                            io::stdin().read_line(&mut line)?;
                            let line = line.trim_end();
                            if line.is_empty() {
                                break;
                            }
                            css_lines.push(line.to_string());
                        }
                        css_lines.join("\n")
                    }
                } else {
                    println!("Enter CSS content (empty line to finish):");
                    let mut css_lines = Vec::new();
                    loop {
                        let mut line = String::new();
                        io::stdin().read_line(&mut line)?;
                        let line = line.trim_end();
                        if line.is_empty() {
                            break;
                        }
                        css_lines.push(line.to_string());
                    }
                    css_lines.join("\n")
                };

                if !css_content.is_empty() {
                    let custom_id = if parts.len() >= 3 {
                        Some(parts[2])
                    } else {
                        None
                    };
                    match manager.load_css(&css_content, custom_id) {
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
                println!(
                    "Available commands: load [filepath] [id], unload <id>, clear, list, quit"
                );
            }
        }
    }

    Ok(())
}
