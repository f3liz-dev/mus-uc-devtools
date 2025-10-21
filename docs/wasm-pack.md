# wasm-pack Support

This project now supports building with wasm-pack for WebAssembly library distribution.

## Overview

While the primary use case for mus-uc-devtools is as a WASI CLI tool, the project now includes a library interface (`src/lib.rs`) that can be built with wasm-pack for use in JavaScript environments.

## Building with wasm-pack

### Prerequisites

1. Install wasm-pack:
   ```bash
   cargo install wasm-pack
   # or
   curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
   ```

2. Add the wasm32-unknown-unknown target:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

### Build Commands

```bash
# Build for Node.js
npm run build:wasm-pack

# Or use wasm-pack directly
wasm-pack build --target nodejs --out-dir pkg --release

# Build for web browsers
wasm-pack build --target web --out-dir pkg-web --release

# Build for bundlers
wasm-pack build --target bundler --out-dir pkg-bundler --release
```

### Output

The build generates the following files in the `pkg/` directory:

- `mus_uc_devtools.js` - JavaScript bindings
- `mus_uc_devtools_bg.wasm` - WebAssembly binary
- `mus_uc_devtools.d.ts` - TypeScript definitions
- `package.json` - npm package metadata

## Library Interface

The library exports the following modules and types:

```rust
pub use chrome_css_manager::ChromeCSSManager;
pub use chrome_manifest::ChromeManifestRegistrar;
pub use marionette_client::{MarionetteConnection, MarionetteSettings};
```

### Example Usage

```javascript
const mus_uc = require('./pkg/mus_uc_devtools');

// Use the library (note: functionality depends on WASI environment)
```

## Limitations

**Important**: The library is primarily designed for WASI environments and depends on:

- File system access (WASI)
- Network access for Marionette protocol
- Firefox with Marionette enabled

These dependencies mean that while the library can be built with wasm-pack, it may have limited functionality in browser environments without appropriate WASI polyfills or browser extensions that provide the necessary capabilities.

## Build Targets

The project supports three build targets:

1. **Native binary** (`cargo build --release`)
   - Full CLI functionality
   - Direct system access
   
2. **WASI binary** (`cargo build --target wasm32-wasip1`)
   - Portable WASM binary for WASI runtimes
   - Primary distribution method via npm
   
3. **wasm-pack** (`wasm-pack build`)
   - Library interface for JavaScript
   - Experimental support

## Configuration

### Cargo.toml

```toml
[lib]
name = "mus_uc_devtools"
path = "src/lib.rs"
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = { version = "0.2", optional = true }

[features]
default = []
wasm = ["wasm-bindgen"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = false

[package.metadata.wasm-pack.profile.dev]
wasm-opt = false
```

The `wasm-opt = false` configuration disables automatic optimization with wasm-opt, which can be enabled if needed.

## CI/CD

The GitHub Actions workflow `.github/workflows/build-wasi.yml` includes a job that builds with wasm-pack to verify the library builds correctly:

```yaml
- name: Build with wasm-pack
  run: npm run build:wasm-pack
```

This ensures that wasm-pack compatibility is maintained without requiring publication to npm, JSR, or other registries.

## Not Publishing

As per the requirements, this setup makes the project **ready** for wasm-pack but does not publish the wasm-pack output to any registry. The builds are:

- ✅ Verified in CI/CD
- ✅ Ready for future use
- ❌ Not published to npm
- ❌ Not published to JSR
- ❌ Not published to other registries

The WASI binary remains the primary distribution method via npm.
