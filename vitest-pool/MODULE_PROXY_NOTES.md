# Module Proxy Implementation - Challenges and Solutions

## Attempted Approach: HTTP Module Server

### Implementation
Created an HTTP server (`ModuleServer` class) that:
- Serves test files and dependencies
- Provides Vitest API as an ES module
- Uses Firefox's native `import()` to load modules

### Challenges Encountered

1. **CORS and Security Context**
   - Firefox's chrome context has strict security policies
   - `import()` from HTTP URLs may be blocked due to CORS
   - chrome:// URLs are privileged and can't be easily created dynamically

2. **Module Resolution**
   - Node.js-style module resolution needs to be replicated
   - Relative imports need special handling
   - node_modules traversal is complex

3. **Dynamic import() in executeScript**
   - `executeScript()` runs in a limited context
   - Dynamic `import()` may not work the same way as in regular Firefox code
   - Context isolation makes it difficult to share module state

## Alternative Approaches

### Option 1: chrome.manifest Registration (Recommended by @nyanrus)
**Pros:**
- Native Firefox module loading
- Proper chrome:// URL support
- Best performance and source maps

**Cons:**
- Requires dynamic chrome.manifest generation
- Need to register/unregister for each test run
- More complex setup

**Implementation Steps:**
1. Generate chrome.manifest dynamically
2. Register content paths for node_modules and test files
3. Use chrome:// URLs in imports
4. Clean up after tests

### Option 2: File Protocol with Module Map
**Pros:**
- Simpler than chrome.manifest
- Can use file:// URLs
- Better security model

**Cons:**
- Still needs module resolution
- Path handling can be tricky
- May have similar import() issues

### Option 3: Hybrid Bundling (Current Fallback)
**Pros:**
- Works reliably
- No security/CORS issues
- Tested and validated

**Cons:**
- Loses source maps
- Slower (bundling step)
- Not using native imports

## Current Status

The HTTP module server implementation is in place but may encounter issues due to:
- Firefox's security policies for chrome context
- CORS restrictions on dynamic imports
- executeScript context limitations

**Next Steps:**
1. Test HTTP module server approach
2. If it fails, implement chrome.manifest registration
3. Keep bundling as ultimate fallback

## Files Modified
- `vitest-pool/firefox-pool.js` - Added ModuleServer class and proxy approach
- `.gitignore` - Added .vitest-temp/ for temporary files
- `package.json` - Removed explicit esbuild dependency (still available via vite)
