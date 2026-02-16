# Proposal: Fix StatusBar Polling Regression and Validate Model Visibility Feature

## 🎯 **Objective**

Fix critical regression in StatusBar polling interval that causes subprocess spawning crisis, causing the application to accumulate 21+ Antigravity.exe processes and consume 1GB+ memory, making the application unresponsive.

Additionally, validate that the newly implemented Model Visibility Settings feature introduced today (February 15, 2026) is functioning correctly and not contributing to memory issues.

## 🔴 **Problem Statement**

### **Critical Issue: StatusBar Polling Regression**

The `StatusBar.tsx` component has regressed to a **2-second polling interval** instead of the previously fixed **10-second interval**. This causes the `isProcessRunning()` function to be called at 5x the intended frequency, which:

1. Spawns **2 subprocesses per polling cycle** (searches for 'Antigravity' + 'antigravity')
2. Creates **360 subprocess spawns per hour** instead of 72
3. Results in **21+ Antigravity.exe processes** accumulating within minutes
4. Consumes **1GB+ memory** from cumulative process spawning
5. Makes the **application completely unresponsive** (zombie state)

### **Secondary Issue: Model Visibility Feature Validation**

New feature implemented today needs validation:

- **Files Modified**: `ModelVisibilitySettings.tsx`, `CloudAccountCard.tsx`, `settings.tsx`, `config.ts`, `i18n.ts`
- **Risk**: May introduce memory leaks or performance degradation
- **Status**: Feature complete but untested due to application crash from primary issue

### **Tertiary Issue: Subprocess Optimization Opportunity**

The `isProcessRunning()` function in `src/ipc/process/handler.ts`:

- Performs dual subprocess searches per call
- Uses heavyweight `find-process` package on Windows (`tasklist` via PowerShell)
- No caching or rate limiting
- No optimization for frequent polling scenarios

## 📊 **Current State**

**Application Status**: 🔴 **BROKEN** - Cannot run for more than 2-3 minutes without crashing

**Observed Behavior**:

1. App starts normally
2. StatusBar begins polling at 2s intervals
3. After 30-60 seconds: 5-10 processes spawn
4. After 3 minutes: 21 processes spawned
5. Memory spikes to 1GB+
6. UI freezes/becomes unresponsive

**Files Affected**:

| File | Issue | Impact |
|------|-------|--------|
| `src/components/StatusBar.tsx:20` | `refetchInterval: 2000` (should be `10000`) | 🔴 CRITICAL |
| `src/ipc/process/handler.ts:70-100` | Dual subprocess spawning, no cache | 🟠 HIGH |
| `src/components/ModelVisibilitySettings.tsx` | Untested in production scenario | 🟡 MEDIUM |

## ✅ **Success Criteria**

### **Primary Goals** (Must Complete)

1. ✅ StatusBar polling interval fixed to 10 seconds
2. ✅ Application runs stably for 30+ minutes without process accumulation
3. ✅ Process count remains ≤ 15 Antigravity.exe instances during normal operation
4. ✅ Memory consumption remains stable (< 500MB for main process)
5. ✅ TypeScript type-check passes with zero errors in implementation files

### **Secondary Goals** (Should Complete)

1. ✅ Optimize `isProcessRunning()` with caching (60-second TTL)
2. ✅ Add rate limiting to subprocess calls
3. ✅ Validate Model Visibility feature works correctly
4. ✅ Test with all 9 cloud accounts active
5. ✅ E2E test coverage for model visibility scenarios

### **Tertiary Goals** (Nice to Have)

1. ⚪ Replace `find-process` with native Node.js APIs for Windows
2. ⚪ Add monitoring/telemetry for subprocess call frequency
3. ⚪ Document process management architecture

## 🔧 **Proposed Solution**

### **Phase 1: Emergency Fix** (Priority 1 - ~5 minutes)

1. Verify `src/components/StatusBar.tsx:20` has `refetchInterval: 10000`
2. Kill all existing terminal/dev processes to ensure clean state
3. Start fresh `npm start` session
4. Monitor process count for 5 minutes
5. Verify no accumulation beyond 15 processes

### **Phase 2: Subprocess Optimization** (Priority 2 - ~1-2 hours)

1. Add result caching to `isProcessRunning()`:

   ```typescript
   const cache = { value: false, timestamp: 0 };
   const CACHE_TTL = 60000; // 60 seconds
   
   if (Date.now() - cache.timestamp < CACHE_TTL) {
     return cache.value;
   }
   ```

2. Consolidate dual searches into single search:

   ```typescript
   // Instead of searching 'Antigravity' AND 'antigravity'
   // Use case-insensitive single search
   const matches = await findProcess('name', 'antigravity', true);
   ```

3. Add rate limiting layer:

   ```typescript
   let lastCall = 0;
   const MIN_INTERVAL = 5000; // 5 seconds minimum
   
   if (Date.now() - lastCall < MIN_INTERVAL) {
     return cachedResult;
   }
   ```

### **Phase 3: Feature Validation** (Priority 3 - ~1 hour)

1. Test Model Visibility Settings UI:
   - Open Settings → Models tab
   - Search functionality works
   - Toggle model visibility
   - Save changes persist to config
   - Verify filtered models don't appear in account cards

2. Memory leak testing:
   - Monitor memory usage during 30-minute session
   - Toggle 20+ models multiple times
   - Save/reset configurations repeatedly
   - Check for memory growth patterns

3. Multi-account testing:
   - Activate all 9 cloud accounts
   - Verify model filtering applies to all accounts
   - Check performance with large model lists

## 📝 **Implementation Notes**

### **Known Constraints**

- Application uses Electron multi-process architecture
- `find-process` package spawns platform-specific subprocesses
- Windows uses heavyweight `tasklist` command via PowerShell
- Hot-reload doesn't reset React Query polling intervals

### **Testing Strategy**

1. **Unit Tests**: Add tests for cached `isProcessRunning()`
2. **Integration Tests**: Test StatusBar with mocked process queries
3. **E2E Tests**: Verify model visibility across all UI flows
4. **Manual Testing**: 30-minute uptime validation

### **Rollback Plan**

If optimization causes issues:

1. Revert caching changes
2. Keep 10-second polling interval
3. Monitor for 24 hours before re-attempting optimization

## 🚨 **Risk Assessment**

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Polling fix doesn't prevent spawning | Low | High | Add subprocess optimization as backup |
| Cache causes stale process detection | Medium | Medium | Use short TTL (60s), monitor closely |
| Model visibility has memory leak | Low | Medium | Add memory profiling, revert if needed |
| E2E tests reveal new regressions | Medium | Medium | Fix before deployment |

## 📚 **References**

- **Original Fix**: [Session earlier today - StatusBar polling increased from 2s to 10s]
- **Subprocess Analysis**: `docs/Research/DeepWiki_mem_leak.md`
- **Process Handler**: `src/ipc/process/handler.ts:70-100`
- **StatusBar Component**: `src/components/StatusBar.tsx`
- **Model Visibility Files**:
  - `src/components/ModelVisibilitySettings.tsx`
  - `src/components/CloudAccountCard.tsx`
  - `src/routes/settings.tsx`
  - `src/types/config.ts`
  - `src/localization/i18n.ts`

## 👥 **Ownership**

- **Assigned To**: Copilot SWE
- **Created By**: Claude (diagnostic analysis)
- **Date**: February 15, 2026
- **Severity**: 🔴 **CRITICAL** - Production-blocking issue
- **Expected Resolution Time**: 2-4 hours total (Emergency fix: 5 min, Full optimization: 2-4 hours)
