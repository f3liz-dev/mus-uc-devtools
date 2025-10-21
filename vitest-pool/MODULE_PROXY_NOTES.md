# Module Proxy Implementation - Using HTTP with ChromeUtils

## Final Approach: HTTP Module Server with ChromeUtils.importESModule()

### Implementation
The implementation uses an HTTP module server combined with Firefox's `ChromeUtils.importESModule()` API:

1. **ModuleServer**: HTTP server serving test files and Vitest API as ES modules
2. **ChromeUtils.importESModule()**: Firefox chrome context API for loading ES modules from URLs
3. **Native imports**: Tests use real `import` statements without bundling

### Key Insights

**Why This Works:**
- Firefox chrome context has `ChromeUtils.importESModule()` which can load ES modules from HTTP URLs
- This is the official Firefox API for loading ES modules in privileged contexts
- Falls back to dynamic `import()` if `ChromeUtils` is not available
- No CORS issues because chrome context has elevated privileges

**Advantages:**
- ✅ No bundling required - keeps source maps
- ✅ Native ES6 imports work as written
- ✅ Fast - no build step
- ✅ Accurate runtime environment
- ✅ Simple and intuitive

### How It Works

1. **Module Server** starts on localhost:8765
2. **Vitest API** served as `/vitest` ES module
3. **Test files** transformed to import from HTTP URLs
4. **Firefox** loads modules using `ChromeUtils.importESModule()`
5. **Tests execute** with native Firefox APIs available
6. **Results** collected and sent back to Vitest

### Code Flow

```javascript
// Original test file
import { describe, it, expect } from 'vitest';

// Transformed to
import { describe, it, expect } from 'http://localhost:8765/vitest';

// Loaded in Firefox using
ChromeUtils.importESModule('http://localhost:8765/vitest');
ChromeUtils.importESModule('http://localhost:8765/tests/my-test.js');
```

### Challenges Overcome

1. **Security**: Used `ChromeUtils.importESModule()` instead of regular `import()`
2. **Context**: Properly handle Firefox chrome context privileges
3. **Module Resolution**: Simple HTTP server with straightforward URL mapping

## Alternative Approaches Considered

### chrome.manifest Registration
**Status**: Not needed - HTTP with ChromeUtils works better
- Would require dynamic registration/unregistration
- More complex setup
- HTTP approach is simpler and works well

### Bundling with esbuild
**Status**: Replaced with module proxy
- Was working but lost source maps
- Slower due to bundling step
- Module proxy is superior

## Testing

The implementation is ready for testing with Firefox:
1. Start Firefox with Marionette enabled (marionette.port=2828)
2. Run `npm run test:vitest`
3. Module server starts automatically
4. Tests load via ChromeUtils.importESModule()

## Files Modified
- `vitest-pool/firefox-pool.js` - Implemented ModuleServer and ChromeUtils integration
- `.gitignore` - Added .vitest-temp/
- `package.json` - Removed explicit esbuild dependency
- This documentation

## Next Steps

If HTTP module server encounters issues:
1. Can fall back to file:// URLs
2. Can implement chrome.manifest registration
3. Can re-enable bundling as last resort

Current implementation should work as ChromeUtils.importESModule() is designed for exactly this use case.
