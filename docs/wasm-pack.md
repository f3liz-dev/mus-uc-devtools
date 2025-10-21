# wasm-pack Support

This project supports building with wasm-pack for WebAssembly library distribution, though the primary use case remains as a WASI CLI tool.

## Quick Start

```bash
# Install prerequisites
cargo install wasm-pack
rustup target add wasm32-unknown-unknown

# Build
npm run build:wasm-pack
```

Output in `pkg/`: JavaScript bindings, WASM binary, TypeScript definitions, package metadata.

## Library Interface

```rust
pub use chrome_css_manager::ChromeCSSManager;
pub use chrome_manifest::ChromeManifestRegistrar;
pub use marionette_client::{MarionetteConnection, MarionetteSettings};
```

## Build Targets

1. **Native** (`cargo build --release`) - Full CLI functionality
2. **WASI** (`cargo build --target wasm32-wasip1`) - Primary distribution via npm
3. **wasm-pack** (`wasm-pack build`) - Experimental library interface

## Limitations

The library requires WASI environment with file system access, network for Marionette protocol, and Firefox with Marionette enabled. Limited functionality in browser environments.

## Configuration

Key Cargo.toml settings:
- `[lib]` with `crate-type = ["cdylib", "rlib"]`
- `wasm-bindgen` as optional dependency
- `wasm-opt = false` in metadata

## Status

- ✅ Builds verified in CI/CD
- ❌ Not published to npm/JSR
- WASI binary remains primary distribution

