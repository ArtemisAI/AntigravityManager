# Internal Issues Log

This document tracks technical issues encountered during development and deployment for internal reference.

---

## Issue #1: Sentry Integration Build Failure

**Date**: 2026-02-12  
**Severity**: High (Blocking)  
**Status**: ✅ Resolved (Workaround Applied)

### Problem

Application failed to launch with build errors:

```
Could not resolve "./integrations/scope-to-main.js" from node_modules/@sentry/electron/esm/renderer/index.js
Could not resolve "./integrations/event-loop-block.js" from node_modules/@sentry/electron/esm/renderer/index.js
```

### Root Cause

- Missing integration files in `@sentry/electron@^7.7.0` package
- Corrupted or incomplete package installation
- Build system unable to resolve internal Sentry module paths

### Resolution

**Temporary Fix** (Applied):

1. Disabled Sentry imports in all entry points:
   - `src/instrument.ts` (main process)
   - `src/preload.ts` (preload script)
   - `src/renderer.ts` (renderer process)
2. Commented out all Sentry initialization code
3. Set error reporting to disabled by default

**Files Modified**:

- `src/instrument.ts`: Lines 1-3, 20-58
- `src/preload.ts`: Lines 1-3, 35-41
- `src/renderer.ts`: Lines 1-9

### Impact

- ✅ Application launches successfully
- ❌ Error telemetry disabled
- ✅ All core functionality intact (accounts, cloud monitoring, process management)

### Long-term Fix Required

1. Upgrade to latest `@sentry/electron` (check for v8.x compatibility)
2. OR: Use alternative error reporting (e.g., `winston` file logging only)
3. OR: Implement custom lightweight crash reporter

### Prevention

- Add package integrity checks to CI/CD pipeline
- Test fresh installations in isolated environment
- Consider pinning Sentry version to known-working release

---

## Issue Tracking

| ID | Date | Severity | Status | Component |
|----|------|----------|--------|-----------|
| 1  | 2026-02-12 | High | ✅ Resolved | Sentry/Build |

---

**Legend**:

- ✅ Resolved
- 🔄 In Progress
- ⏸️ Deferred
- ❌ Blocked
