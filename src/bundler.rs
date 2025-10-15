use std::process::Command;
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub struct CSSBundler {
    temp_dir: TempDir,
    bundler_type: BundlerType,
}

#[derive(Clone, Debug)]
pub enum BundlerType {
    PostCSS,
    Parcel,
    Webpack,
    Rollup,
}

impl CSSBundler {
    pub fn new(bundler: BundlerType) -> Result<Self, Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        Ok(CSSBundler {
            temp_dir,
            bundler_type: bundler,
        })
    }

    pub fn bundle_css(&self, input_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        match self.bundler_type {
            BundlerType::PostCSS => self.bundle_with_postcss(input_path),
            BundlerType::Parcel => self.bundle_with_parcel(input_path),
            BundlerType::Webpack => self.bundle_with_webpack(input_path),
            BundlerType::Rollup => self.bundle_with_rollup(input_path),
        }
    }

    fn bundle_with_postcss(&self, input_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        // Create postcss config
        let config_path = self.temp_dir.path().join("postcss.config.js");
        fs::write(&config_path, r#"
module.exports = {
  plugins: [
    require('postcss-import')({
      resolve: function(id, basedir) {
        // Custom resolution for Firefox chrome paths
        if (id.startsWith('chrome://')) {
          return id;
        }
        return require('postcss-import/lib/resolve-id')(id, basedir);
      }
    }),
    require('cssnano')({
      preset: 'default',
    })
  ]
}
        "#)?;

        let output_path = self.temp_dir.path().join("bundled.css");
        
        let output = Command::new("npx")
            .args(&[
                "postcss",
                input_path.to_str().unwrap(),
                "--config",
                config_path.to_str().unwrap(),
                "--output",
                output_path.to_str().unwrap()
            ])
            .output()?;

        if !output.status.success() {
            return Err(format!("PostCSS failed: {}", String::from_utf8_lossy(&output.stderr)).into());
        }

        Ok(fs::read_to_string(output_path)?)
    }

    fn bundle_with_parcel(&self, input_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        let output_dir = self.temp_dir.path().join("dist");
        
        let output = Command::new("npx")
            .args(&[
                "parcel", "build",
                input_path.to_str().unwrap(),
                "--dist-dir", output_dir.to_str().unwrap(),
                "--no-source-maps",
                "--no-content-hash"
            ])
            .output()?;

        if !output.status.success() {
            return Err(format!("Parcel failed: {}", String::from_utf8_lossy(&output.stderr)).into());
        }

        // Find the output CSS file
        for entry in fs::read_dir(&output_dir)? {
            let entry = entry?;
            if entry.path().extension().unwrap_or_default() == "css" {
                return Ok(fs::read_to_string(entry.path())?);
            }
        }

        Err("No CSS output found from Parcel".into())
    }

    fn bundle_with_webpack(&self, input_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        // Create webpack config
        let config_path = self.temp_dir.path().join("webpack.config.js");
        let output_dir = self.temp_dir.path().join("dist");
        
        fs::write(&config_path, format!(r#"
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {{
  mode: 'production',
  entry: '{}',
  output: {{
    path: '{}',
    filename: 'bundle.js'
  }},
  module: {{
    rules: [
      {{
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }}
    ]
  }},
  plugins: [
    new MiniCssExtractPlugin({{
      filename: 'bundle.css'
    }})
  ]
}};
        "#, input_path.display(), output_dir.display()))?;

        let output = Command::new("npx")
            .args(&[
                "webpack",
                "--config",
                config_path.to_str().unwrap()
            ])
            .output()?;

        if !output.status.success() {
            return Err(format!("Webpack failed: {}", String::from_utf8_lossy(&output.stderr)).into());
        }

        Ok(fs::read_to_string(output_dir.join("bundle.css"))?)
    }

    fn bundle_with_rollup(&self, input_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        // Create rollup config
        let config_path = self.temp_dir.path().join("rollup.config.js");
        let output_path = self.temp_dir.path().join("bundle.css");
        
        fs::write(&config_path, format!(r#"
import {{ postcss }} from 'rollup-plugin-postcss';

export default {{
  input: '{}',
  output: {{
    file: '{}/bundle.js',
    format: 'iife'
  }},
  plugins: [
    postcss({{
      extract: true,
      minimize: true,
      plugins: [
        require('postcss-import')()
      ]
    }})
  ]
}};
        "#, input_path.display(), self.temp_dir.path().display()))?;

        let output = Command::new("npx")
            .args(&[
                "rollup",
                "--config",
                config_path.to_str().unwrap()
            ])
            .output()?;

        if !output.status.success() {
            return Err(format!("Rollup failed: {}", String::from_utf8_lossy(&output.stderr)).into());
        }

        Ok(fs::read_to_string(output_path)?)
    }

    pub fn detect_available_bundler() -> Option<BundlerType> {
        let bundlers = [
            ("postcss", BundlerType::PostCSS),
            ("parcel", BundlerType::Parcel), 
            ("webpack", BundlerType::Webpack),
            ("rollup", BundlerType::Rollup),
        ];

        for (cmd, bundler_type) in &bundlers {
            if Command::new("npx").arg(cmd).arg("--version").output().is_ok() {
                return Some(bundler_type.clone());
            }
        }
        None
    }
}

// Enhanced ChromeCSSManager with bundling support
impl crate::ChromeCSSManager {
    pub fn load_css_with_bundling(
        &mut self, 
        css_path: &Path, 
        id: Option<&str>,
        use_bundler: bool
    ) -> Result<String, Box<dyn std::error::Error>> {
        let css_content = if use_bundler {
            if let Some(bundler_type) = CSSBundler::detect_available_bundler() {
                println!("Using bundler: {:?}", bundler_type);
                let bundler = CSSBundler::new(bundler_type)?;
                bundler.bundle_css(css_path)?
            } else {
                println!("No CSS bundler found, loading file directly");
                fs::read_to_string(css_path)?
            }
        } else {
            fs::read_to_string(css_path)?
        };

        self.load_css(&css_content, id)
    }

    pub fn load_css_with_imports_resolved(
        &mut self,
        css_content: &str,
        base_path: &Path,
        id: Option<&str>
    ) -> Result<String, Box<dyn std::error::Error>> {
        let resolved_css = self.resolve_imports_manually(css_content, base_path)?;
        self.load_css(&resolved_css, id)
    }

    fn resolve_imports_manually(&self, css: &str, base_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
        let mut resolved = String::new();
        let mut processed_files = std::collections::HashSet::new();
        
        self.process_css_imports(css, base_path, &mut resolved, &mut processed_files)?;
        
        Ok(resolved)
    }

    fn process_css_imports(
        &self,
        css: &str,
        base_path: &Path,
        output: &mut String,
        processed: &mut std::collections::HashSet<PathBuf>
    ) -> Result<(), Box<dyn std::error::Error>> {
        for line in css.lines() {
            if line.trim_start().starts_with("@import") {
                if let Some(import_path) = self.extract_import_path(line) {
                    let full_path = base_path.join(&import_path);
                    
                    if !processed.contains(&full_path) && full_path.exists() {
                        processed.insert(full_path.clone());
                        let imported_css = fs::read_to_string(&full_path)?;
                        let import_base = full_path.parent().unwrap_or(base_path);
                        
                        // Recursively process imports in the imported file
                        self.process_css_imports(&imported_css, import_base, output, processed)?;
                    }
                }
            } else {
                output.push_str(line);
                output.push('\n');
            }
        }
        Ok(())
    }

    fn extract_import_path(&self, import_line: &str) -> Option<String> {
        // Extract path from @import "path" or @import url("path")
        if let Some(start) = import_line.find('"') {
            if let Some(end) = import_line[start + 1..].find('"') {
                return Some(import_line[start + 1..start + 1 + end].to_string());
            }
        }
        if let Some(start) = import_line.find('\'') {
            if let Some(end) = import_line[start + 1..].find('\'') {
                return Some(import_line[start + 1..start + 1 + end].to_string());
            }
        }
        None
    }
}