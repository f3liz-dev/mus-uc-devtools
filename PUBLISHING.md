# Publishing Guide

This document describes how to publish mus-uc-devtools to various package registries.

## Prerequisites

1. Rust toolchain with `wasm32-wasip1` target installed:
   ```bash
   rustup target add wasm32-wasip1
   ```

2. npm account (for npm publishing)
3. JSR account (for jsr.io publishing)
4. crates.io account (for Rust crate publishing)

## Publishing to npm

1. Build the WASI binary:
   ```bash
   npm run build
   ```

2. Test the package locally:
   ```bash
   npm pack
   ```

3. Publish to npm:
   ```bash
   npm publish
   ```

   Or for a dry-run:
   ```bash
   npm publish --dry-run
   ```

## Publishing to jsr.io

1. Install the JSR CLI if you haven't already:
   ```bash
   npm install -g @jsr/cli
   ```

2. Build the WASI binary:
   ```bash
   npm run build
   ```

3. Publish to jsr.io:
   ```bash
   npx jsr publish
   ```

## Publishing to crates.io

1. Login to crates.io:
   ```bash
   cargo login
   ```

2. Publish the crate:
   ```bash
   cargo publish
   ```

   Or for a dry-run:
   ```bash
   cargo publish --dry-run
   ```

## Version Management

When releasing a new version:

1. Update version in `Cargo.toml`
2. Update version in `package.json`
3. Update version in `jsr.json`
4. Commit the changes
5. Create a git tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

## Notes

- The `prepublishOnly` script in package.json automatically builds the WASI binary and copies it to the `bin/` directory before npm publishing.
- The `bin/` directory is in `.gitignore` as it's generated during the build process.
- Make sure to test your package locally before publishing to ensure everything works correctly.
