# Implementation Tasks: Fix StatusBar Polling Regression

## 🚨 **Phase 1: Emergency Fix** (CRITICAL - Do First)

### Task 1.1: Verify and Fix StatusBar Polling Interval

**Priority**: P0 - CRITICAL  
**Estimated Time**: 2 minutes  
**Files**: `src/components/StatusBar.tsx`

**Steps**:

1. Open `src/components/StatusBar.tsx`
2. Locate line 20 with the `useQuery` hook
3. Verify `refetchInterval` is set to `10000` (not `2000`)
4. If incorrect, change `refetchInterval: 2000` to `refetchInterval: 10000`
5. Save file

**Expected Result**: StatusBar polls every 10 seconds instead of every 2 seconds

**Acceptance Criteria**:

- [ ] `refetchInterval` value is `10000` in StatusBar.tsx
- [ ] File saved and TypeScript compiles without errors

---

### Task 1.2: Clean Process State

**Priority**: P0 - CRITICAL  
**Estimated Time**: 1 minute  
**Platform**: Windows PowerShell

**Steps**:

1. Kill ALL existing Antigravity.exe processes:

   ```powershell
   taskkill /F /IM Antigravity.exe
   ```

2. Wait 5 seconds for process cleanup
3. Verify no Antigravity processes remain:

   ```powershell
   tasklist | findstr -i antigravity
   ```

**Expected Result**: Zero Antigravity.exe processes running

**Acceptance Criteria**:

- [ ] All Antigravity processes terminated
- [ ] `tasklist` shows no Antigravity.exe instances

---

### Task 1.3: Fresh Application Start

**Priority**: P0 - CRITICAL  
**Estimated Time**: 2 minutes  
**Command**: `npm start`

**Steps**:

1. Start application in development mode:

   ```bash
   npm start
   ```

2. Wait for application to fully load (browser window appears)
3. Verify tray icon appears
4. Verify UI loads without errors

**Expected Result**: Application starts cleanly with no errors

**Acceptance Criteria**:

- [ ] Electron window opens successfully
- [ ] No console errors during startup
- [ ] Tray icon visible
- [ ] UI fully responsive

---

### Task 1.4: Monitor Process Count (5-Minute Test)

**Priority**: P0 - CRITICAL  
**Estimated Time**: 5 minutes  
**Monitoring Command**: Run every 60 seconds for 5 minutes

**Steps**:

1. Record process count at T=0:

   ```powershell
   @(tasklist | Select-String -Pattern "Antigravity").Count
   ```

2. Record process count at T=60s
3. Record process count at T=120s (2 min)
4. Record process count at T=180s (3 min)
5. Record process count at T=240s (4 min)
6. Record process count at T=300s (5 min)

**Expected Result**:

- Initial count: ~10-15 processes (Electron multi-process architecture)
- Final count: ≤ 15 processes (no accumulation)
- Growth rate: 0-2 processes over 5 minutes

**Acceptance Criteria**:

- [ ] Process count remains ≤ 15 throughout test
- [ ] No exponential growth pattern observed
- [ ] Memory usage stable (< 500MB for main process)
- [ ] UI remains responsive

**STOP HERE IF TEST FAILS** - Escalate to senior engineer

---

## 🔧 **Phase 2: Subprocess Optimization** (HIGH Priority)

### Task 2.1: Add Result Caching to isProcessRunning()

**Priority**: P1 - HIGH  
**Estimated Time**: 20 minutes  
**Files**: `src/ipc/process/handler.ts`

**Implementation**:

```typescript
// Add at the top of the file, outside the function
interface ProcessCache {
  value: boolean;
  timestamp: number;
}

let processCache: ProcessCache = { value: false, timestamp: 0 };
const CACHE_TTL = 60000; // 60 seconds

export async function isProcessRunning(): Promise<boolean> {
  // Check cache first
  const now = Date.now();
  if (now - processCache.timestamp < CACHE_TTL) {
    logger.debug('Using cached process status:', processCache.value);
    return processCache.value;
  }

  // ... existing implementation ...
  
  // Update cache before returning
  processCache = { value: isRunning, timestamp: now };
  return isRunning;
}
```

**Location**: After line 70 in `src/ipc/process/handler.ts`

**Acceptance Criteria**:

- [ ] Cache interface defined
- [ ] Cache checked before subprocess calls
- [ ] Cache updated with fresh results
- [ ] TTL set to 60 seconds
- [ ] Debug logging added
- [ ] TypeScript compiles without errors
- [ ] Unit tests pass

---

### Task 2.2: Consolidate Dual Process Searches

**Priority**: P1 - HIGH  
**Estimated Time**: 15 minutes  
**Files**: `src/ipc/process/handler.ts`

**Current Implementation** (lines 75-90):

```typescript
const searchNames = ['Antigravity', 'antigravity'];
for (const searchName of searchNames) {
  const matches = await findProcess('name', searchName, true);
  // ...
}
```

**Change To**:

```typescript
// Single case-insensitive search instead of dual search
const matches = await findProcess('name', 'antigravity', true);
```

**Rationale**:

- Reduces subprocess calls by 50%
- `find-process` package uses case-insensitive search by default on most platforms
- Eliminates duplicate process detection

**Acceptance Criteria**:

- [ ] Single search call instead of dual loop
- [ ] All processes still detected correctly
- [ ] Unit tests updated and passing
- [ ] Manual testing confirms no regression

---

### Task 2.3: Add Rate Limiting Layer

**Priority**: P1 - HIGH  
**Estimated Time**: 15 minutes  
**Files**: `src/ipc/process/handler.ts`

**Implementation**:

```typescript
// Add at top of file with cache
let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL = 5000; // 5 seconds minimum

export async function isProcessRunning(): Promise<boolean> {
  const now = Date.now();
  
  // Rate limiting check
  if (now - lastCallTimestamp < MIN_CALL_INTERVAL) {
    logger.debug('Rate limit hit, returning cached value');
    return processCache.value;
  }
  
  lastCallTimestamp = now;
  
  // ... rest of implementation with cache ...
}
```

**Rationale**:

- Prevents rapid-fire calls even if polling interval is misconfigured
- Acts as safety net against future regressions
- Minimal performance impact

**Acceptance Criteria**:

- [ ] Rate limiting enforced (5-second minimum)
- [ ] Returns cached value when rate-limited
- [ ] Logging added for debugging
- [ ] Does not break normal operation
- [ ] Unit tests cover rate-limiting scenarios

---

## ✅ **Phase 3: Model Visibility Feature Validation** (MEDIUM Priority)

### Task 3.1: Functional Testing - UI Interaction

**Priority**: P2 - MEDIUM  
**Estimated Time**: 15 minutes  
**Test Environment**: Running application

**Test Scenarios**:

1. **Navigate to Model Settings**:
   - [ ] Open Settings page
   - [ ] Click "Models" tab
   - [ ] ModelVisibilitySettings component renders

2. **Search Functionality**:
   - [ ] Type "gemini" in search box
   - [ ] Verify only models with "gemini" in name appear
   - [ ] Clear search, verify all models return

3. **Toggle Visibility**:
   - [ ] Uncheck 3-5 models
   - [ ] Verify checkbox states update
   - [ ] Verify "Hidden" badge appears on unchecked models

4. **Save Configuration**:
   - [ ] Click "Save Changes" button
   - [ ] Verify success toast appears
   - [ ] Reload page, verify settings persist

5. **Reset Functionality**:
   - [ ] Click "Reset to Defaults" button
   - [ ] Verify all models become visible
   - [ ] Save and verify persistence

**Acceptance Criteria**:

- [ ] All UI interactions work smoothly
- [ ] No console errors during interaction
- [ ] Settings persist across page reloads
- [ ] Translations display correctly (EN/ZH/RU)

---

### Task 3.2: Functional Testing - Model Filtering

**Priority**: P2 - MEDIUM  
**Estimated Time**: 15 minutes  
**Test Environment**: Running application with cloud accounts

**Test Scenarios**:

1. **Verify Filtering Applies to Account Cards**:
   - [ ] Navigate to Accounts page
   - [ ] Hide 3 models via Settings
   - [ ] Return to Accounts page
   - [ ] Verify hidden models don't appear in quota display

2. **Multi-Account Testing**:
   - [ ] Activate multiple cloud accounts (if available)
   - [ ] Verify filtering applies to ALL account cards
   - [ ] Each card respects model visibility settings

3. **Configuration Edge Cases**:
   - [ ] Hide all models, verify "No quota data" message appears
   - [ ] Show all models, verify all quotas display
   - [ ] Test with accounts that have no quota data

**Acceptance Criteria**:

- [ ] Hidden models don't appear in any account card
- [ ] Filtering applies consistently across all accounts
- [ ] Edge cases handled gracefully
- [ ] No UI layout issues with filtered lists

---

### Task 3.3: Memory Leak Testing

**Priority**: P2 - MEDIUM  
**Estimated Time**: 30 minutes  
**Tools**: Chrome DevTools Memory Profiler (Electron)

**Test Procedure**:

1. **Baseline Memory Measurement**:
   - [ ] Start application
   - [ ] Wait 2 minutes for stabilization
   - [ ] Open DevTools → Memory tab
   - [ ] Take heap snapshot (Baseline)
   - [ ] Record memory usage

2. **Stress Testing Model Visibility**:
   - [ ] Toggle 20 models on/off (repeat 10 times)
   - [ ] Save configuration each time
   - [ ] Reset to defaults (repeat 5 times)
   - [ ] Take heap snapshot (After stress)

3. **Analysis**:
   - [ ] Compare snapshots for retained objects
   - [ ] Check for growing arrays or event listeners
   - [ ] Monitor memory growth over 30 minutes
   - [ ] Verify garbage collection occurs

**Expected Result**:

- Memory growth < 50MB over 30 minutes
- No retained React components after unmounting
- No memory leaks in useAppConfig hook

**Acceptance Criteria**:

- [ ] No significant memory leaks detected
- [ ] Memory usage remains stable
- [ ] Heap snapshots show proper cleanup
- [ ] If leaks found, file separate bug report

---

### Task 3.4: Type Safety Validation

**Priority**: P2 - MEDIUM  
**Estimated Time**: 5 minutes  
**Command**: `npm run type-check`

**Steps**:

1. Run TypeScript type checker:

   ```bash
   npm run type-check
   ```

2. Review output for errors in implementation files (ignore test errors)
3. Fix any type errors found

**Expected Result**: Zero TypeScript errors in implementation files

**Files to Check**:

- `src/components/ModelVisibilitySettings.tsx`
- `src/components/CloudAccountCard.tsx`
- `src/routes/settings.tsx`
- `src/types/config.ts`

**Acceptance Criteria**:

- [ ] TypeScript type-check passes for all implementation files
- [ ] No `any` types introduced (except in tests)
- [ ] Zod schema validates correctly
- [ ] Config interface matches schema

---

## 📊 **Phase 4: Final Validation** (Required Before Completion)

### Task 4.1: 30-Minute Uptime Test

**Priority**: P1 - HIGH  
**Estimated Time**: 30 minutes  
**Requirements**: All previous phases complete

**Test Procedure**:

1. **Start Fresh Session**:
   - [ ] Kill all Antigravity processes
   - [ ] Start `npm start`
   - [ ] Record start time

2. **Monitoring** (every 5 minutes):
   - [ ] Process count (should remain ≤ 15)
   - [ ] Memory usage (main process < 500MB)
   - [ ] CPU usage (should be < 5% when idle)
   - [ ] UI responsiveness (click various menus)

3. **Use Application Normally**:
   - [ ] Navigate between pages
   - [ ] Add/remove cloud accounts (if safe)
   - [ ] Toggle model visibility settings
   - [ ] Check quota for accounts

4. **Final Measurements at T=30min**:
   - [ ] Process count: _______
   - [ ] Memory usage: _______
   - [ ] No UI freezes: Yes/No
   - [ ] No console errors: Yes/No

**Acceptance Criteria**:

- [ ] Application runs continuously for 30+ minutes
- [ ] Process count ≤ 15 throughout test
- [ ] Memory usage stable (< 500MB main process)
- [ ] UI remains responsive
- [ ] No critical errors in console

**IF TEST FAILS**: Document failure mode and escalate

---

### Task 4.2: E2E Test Execution (If Available)

**Priority**: P2 - MEDIUM  
**Estimated Time**: 10 minutes  
**Command**: `npm run test:e2e`

**Steps**:

1. Run existing E2E tests:

   ```bash
   npm run test:e2e
   ```

2. Review test results
3. Document any failures
4. Fix critical failures before marking complete

**Acceptance Criteria**:

- [ ] E2E tests run successfully
- [ ] No new test failures introduced
- [ ] StatusBar tests pass (if exist)

---

### Task 4.3: Documentation Update

**Priority**: P3 - LOW  
**Estimated Time**: 10 minutes  
**Files**: `docs/Research/DeepWiki_mem_leak.md`, `CHANGELOG.md`

**Updates Required**:

1. **Update DeepWiki_mem_leak.md**:
   - [ ] Document the regression that occurred
   - [ ] Add final solution (caching + rate limiting)
   - [ ] Include performance metrics

2. **Update CHANGELOG.md**:
   - [ ] Add entry for bug fix under version X.X.X
   - [ ] Reference this change request
   - [ ] Include "BREAKING CHANGE" if API changed

**Acceptance Criteria**:

- [ ] Documentation updated
- [ ] Changes committed to git
- [ ] Changelog includes version bump

---

## ✅ **Completion Checklist**

Before marking this change request as complete, verify:

### **Critical Requirements** (ALL must pass)

- [ ] StatusBar polling interval is 10 seconds
- [ ] 30-minute uptime test passed
- [ ] Process count remains ≤ 15
- [ ] Memory usage stable (< 500MB)
- [ ] UI fully responsive
- [ ] TypeScript type-check passes

### **High Priority Requirements** (SHOULD pass)

- [ ] Result caching implemented and tested
- [ ] Dual search consolidated to single search
- [ ] Rate limiting added
- [ ] Model visibility feature validated

### **Medium Priority Requirements** (NICE to have)

- [ ] Memory leak testing completed
- [ ] E2E tests pass
- [ ] Documentation updated

### **Sign-off**

- [ ] All critical requirements met
- [ ] No production-blocking issues remain
- [ ] Ready for deployment

**Completed By**: _______________  
**Date**: _______________  
**Sign-off**: _______________
