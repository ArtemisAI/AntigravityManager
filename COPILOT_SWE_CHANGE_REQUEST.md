# 🔴 CRITICAL: StatusBar Polling Regression & Model Visibility Validation

**Change Request ID**: `fix-statusbar-polling-regression`  
**Date Created**: February 15, 2026  
**Priority**: 🔴 **CRITICAL** - Production Blocking  
**Severity**: Application crashes within 3 minutes of startup  
**Estimated Resolution Time**: 2-4 hours  
**Status**: Ready for Implementation

---

## 📋 EXECUTIVE SUMMARY

The Antigravity Manager application has regressed to a critical subprocess spawning crisis. The application accumulates **21+ Antigravity.exe processes** within 3 minutes of startup, consuming **1GB+ memory**, and becomes completely unresponsive (zombie state).

**Root Cause**: The `StatusBar.tsx` component's React Query hook has a 2-second polling interval that triggers `isProcessRunning()` function, which spawns 2 subprocesses per call. This creates 360 subprocess spawns per hour on Windows, causing heap corruption and process accumulation.

**Impact**:

- Application cannot run for more than 2-3 minutes
- UI becomes completely frozen
- Memory consumption spikes to 1GB+
- 21+ zombie processes accumulate

**Good News**: The code fix already exists in `StatusBar.tsx` (10-second interval), but the running application needs a fresh restart to apply it due to React Query's hot-reload limitations.

---

## 📖 WHAT WAS WORKING & WHY IT BROKE

### Expected Behavior (Before Regression)

**StatusBar Component** was designed to poll the Antigravity process status every **10 seconds** to:

- Display "Running" or "Stopped" status in UI
- Show start/stop control buttons
- Minimize subprocess overhead by reasonable polling interval
- Balance UI responsiveness with system resource usage

**Model Visibility Feature** (implemented today, February 15, 2026) was working correctly in development:

- Users could toggle individual model visibility in Settings → Models tab
- Hidden models would not display in CloudAccountCard components
- Settings persisted to config file via IPC calls
- All UI interactions were smooth and responsive

### What Broke & When

**Primary Regression - StatusBar Polling**:

- **When**: Unknown exact commit, discovered February 15, 2026 during app testing
- **What Changed**: `refetchInterval: 10000` was somehow changed to `refetchInterval: 2000`
- **Where**: [src/components/StatusBar.tsx](src/components/StatusBar.tsx#L20)
- **Impact Mechanism**:
  1. React Query polls `isProcessRunning()` every 2 seconds instead of 10
  2. Each `isProcessRunning()` call spawns 2 subprocesses (searches 'Antigravity' + 'antigravity')
  3. Windows platform uses `tasklist` via PowerShell (heavyweight operation)
  4. 2s × 2 searches = 1 call/second = 3600 subprocess spawns/hour
  5. Subprocesses accumulate faster than garbage collection can clean them
  6. Within 3 minutes: 21+ zombie processes, 1GB+ memory, heap corruption
  7. Application becomes unresponsive and crashes

**Why Hot-Reload Didn't Fix It**:

- Code was corrected back to `refetchInterval: 10000` during debugging
- Vite hot-reload updated the component source code
- BUT: React Query instance in memory wasn't re-initialized
- Running application continued using the old 2-second interval
- Solution: Requires full application restart to create fresh React Query instance

**Model Visibility Feature Status**:

- **Code**: ✅ Complete and correct
- **Testing**: ❌ Blocked by StatusBar regression crash
- **Risk Assessment**: Low risk - simple filtering logic, no polling/subprocess operations
- **Needs**: Validation testing once application is stable
- **Files Created/Modified**:
  - `src/components/ModelVisibilitySettings.tsx` (NEW - full settings UI)
  - `src/components/CloudAccountCard.tsx` (MODIFIED - added filter logic)
  - `src/routes/settings.tsx` (MODIFIED - added Models tab)
  - `src/types/config.ts` (MODIFIED - extended schema with `model_visibility`)
  - `src/localization/i18n.ts` (MODIFIED - added EN/ZH/RU translations)

---

## 🎯 OBJECTIVES

### Primary Goals (MUST Complete)

1. ✅ Verify StatusBar polling interval is 10 seconds (not 2 seconds)
2. ✅ Clean restart application to apply the fix
3. ✅ Application runs stably for 30+ minutes without process accumulation
4. ✅ Process count remains ≤ 15 during normal operation
5. ✅ Memory consumption stable (< 500MB for main process)

### Secondary Goals (SHOULD Complete)

1. ✅ Optimize `isProcessRunning()` with 60-second caching
2. ✅ Add 5-second rate limiting to subprocess calls
3. ✅ Consolidate dual subprocess searches to single search
4. ✅ Validate Model Visibility feature (added today)
5. ✅ 30-minute uptime validation test

### Tertiary Goals (NICE to Have)

1. ⚪ Memory leak testing for new features
2. ⚪ E2E test coverage
3. ⚪ Documentation updates

---

## 🔍 TECHNICAL ANALYSIS

### Current Architecture (Broken)

```
┌─────────────────────────────────────────┐
│      StatusBar Component (React)        │
│  useQuery({                             │
│    queryKey: ['process', 'status'],     │
│    queryFn: isProcessRunning,           │
│    refetchInterval: 2000  ❌ TOO FAST  │
│  })                                     │
└─────────────────────────────────────────┘
              ↓ (every 2 seconds)
┌─────────────────────────────────────────┐
│     isProcessRunning() Handler          │
│  - Searches 'Antigravity' (subprocess)  │
│  - Searches 'antigravity' (subprocess)  │
│  - Uses find-process package            │
│  - Windows: execSync('tasklist')        │
└─────────────────────────────────────────┘
              ↓ 
    360 subprocess spawns/hour
    21+ processes in 3 minutes
    1GB+ memory consumption
    APPLICATION CRASH ❌
```

### Target Architecture (Fixed)

```
┌─────────────────────────────────────────┐
│      StatusBar Component (React)        │
│  useQuery({                             │
│    queryKey: ['process', 'status'],     │
│    queryFn: isProcessRunning,           │
│    refetchInterval: 10000  ✅ OPTIMAL  │
│  })                                     │
└─────────────────────────────────────────┘
              ↓ (every 10 seconds)
┌─────────────────────────────────────────┐
│  isProcessRunning() - OPTIMIZED ✨      │
│  1. Rate Limit Check (5s minimum)       │
│  2. Cache Check (60s TTL) → 83% hits    │
│  3. Single Search (consolidated)        │
│  4. Update Cache & Return               │
└─────────────────────────────────────────┘
              ↓ 
    72 subprocess spawns/hour (with cache: 12/hour)
    ≤15 processes stable
    <500MB memory stable
    APPLICATION STABLE ✅
```

**Performance Improvement**: 98% reduction in subprocess overhead

---

## 📂 FILES TO MODIFY

### 1. **src/components/StatusBar.tsx** (ALREADY FIXED - NEEDS VERIFICATION)

**Location**: Line 20  
**Current State**: Should have `refetchInterval: 10000`  
**Action**: VERIFY ONLY (fix already applied)

```typescript
// VERIFY THIS IS PRESENT (Line ~18-22)
const { data: isRunning, isLoading } = useQuery({
  queryKey: ['process', 'status'],
  queryFn: isProcessRunning,
  refetchInterval: 10000, // ✅ Must be 10000, NOT 2000
});
```

**Acceptance Criteria**:

- [ ] Line 20 has `refetchInterval: 10000`
- [ ] No TypeScript errors
- [ ] File saved

---

### 2. **src/ipc/process/handler.ts** (NEEDS OPTIMIZATION)

**Location**: Lines 1-100 (entire `isProcessRunning()` function)  
**Current State**: No caching, dual searches, no rate limiting  
**Action**: ADD optimization layers

#### Step 2.1: Add Module-Level State (Add at top of file, after imports)

```typescript
// ADD AFTER LINE 7 (after const execAsync = promisify(exec);)

/**
 * Process status cache to reduce subprocess overhead
 */
interface ProcessCache {
  value: boolean;
  timestamp: number;
}

let processCache: ProcessCache = { value: false, timestamp: 0 };
let lastCallTimestamp = 0;

// Configuration
const CACHE_TTL = 60000;           // 60 seconds cache lifetime
const MIN_CALL_INTERVAL = 5000;    // 5 seconds minimum between calls
```

#### Step 2.2: Wrap isProcessRunning() with Optimization Layers

**Find** (around line 70):

```typescript
export async function isProcessRunning(): Promise<boolean> {
  try {
    const platform = process.platform;
    const currentPid = process.pid;
```

**Replace with**:

```typescript
export async function isProcessRunning(): Promise<boolean> {
  const now = Date.now();
  
  // Layer 1: Rate Limiting
  if (now - lastCallTimestamp < MIN_CALL_INTERVAL) {
    logger.debug('[ProcessCheck] Rate limit hit, returning cached value');
    return processCache.value;
  }
  
  // Layer 2: Cache Check
  if (now - processCache.timestamp < CACHE_TTL) {
    logger.debug('[ProcessCheck] Cache hit (age: ${now - processCache.timestamp}ms)');
    lastCallTimestamp = now;
    return processCache.value;
  }
  
  // Layer 3: Fresh Query
  logger.debug('[ProcessCheck] Cache miss, executing fresh query');
  lastCallTimestamp = now;
  
  try {
    const platform = process.platform;
    const currentPid = process.pid;
```

#### Step 2.3: Consolidate Dual Search to Single Search

**Find** (around line 75-90):

```typescript
    const processMap = new Map<number, ProcessInfo>();
    const searchNames = ['Antigravity', 'antigravity'];
    let sawNoMatch = false;

    for (const searchName of searchNames) {
      try {
        const matches = await findProcess('name', searchName, true);
        for (const proc of matches) {
          if (typeof proc.pid === 'number') {
            processMap.set(proc.pid, proc);
          }
        }
      } catch (error) {
        if (isPgrepNoMatchError(error)) {
          sawNoMatch = true;
          continue;
        }
        throw error;
      }
    }
```

**Replace with**:

```typescript
    // OPTIMIZED: Single case-insensitive search instead of dual loop
    const processMap = new Map<number, ProcessInfo>();
    let sawNoMatch = false;

    try {
      const matches = await findProcess('name', 'antigravity', true);
      for (const proc of matches) {
        if (typeof proc.pid === 'number') {
          processMap.set(proc.pid, proc);
        }
      }
    } catch (error) {
      if (isPgrepNoMatchError(error)) {
        sawNoMatch = true;
      } else {
        throw error;
      }
    }
```

#### Step 2.4: Update Cache Before Returning

**Find** (end of function, around line 140):

```typescript
    }

    return mainProcesses.length > 0;
  } catch (error) {
```

**Replace with**:

```typescript
    }

    const isRunning = mainProcesses.length > 0;
    
    // Update cache
    processCache = { value: isRunning, timestamp: now };
    logger.debug(`[ProcessCheck] Fresh result: ${isRunning} (${mainProcesses.length} processes)`);
    
    return isRunning;
  } catch (error) {
    logger.error('[ProcessCheck] Query failed:', error);
    
    // Fallback to cached value on error
    if (processCache.timestamp > 0) {
      logger.warn('[ProcessCheck] Using stale cache due to error');
      return processCache.value;
    }
    
    logger.warn('[ProcessCheck] No cache available, assuming not running');
    return false;
  }
```

**Acceptance Criteria**:

- [ ] Module-level cache variables added
- [ ] Rate limiting layer implemented
- [ ] Cache check layer implemented
- [ ] Dual search consolidated to single search
- [ ] Cache updated before return
- [ ] Error handling includes cache fallback
- [ ] Debug logging added
- [ ] TypeScript compiles without errors

---

### 3. **Model Visibility Feature Validation** (NEW FEATURE - NEEDS TESTING)

These files were created/modified today and need validation:

#### Files to Validate

- `src/components/ModelVisibilitySettings.tsx` (NEW)
- `src/components/CloudAccountCard.tsx` (MODIFIED - filtering logic added)
- `src/routes/settings.tsx` (MODIFIED - Models tab added)
- `src/types/config.ts` (MODIFIED - schema extended)
- `src/localization/i18n.ts` (MODIFIED - translations added)

**Action**: Manual testing required

**Test Scenarios**:

**Scenario 1: Navigate to Model Settings**

1. Start application
2. Click Settings icon
3. Click "Models" tab
4. Verify: ModelVisibilitySettings component renders
5. Verify: Search box present
6. Verify: Model list displays with checkboxes

**Scenario 2: Toggle Model Visibility**

1. Uncheck 3-5 models
2. Verify: "Hidden" badge appears on unchecked models
3. Click "Save Changes"
4. Verify: Success toast appears
5. Reload page
6. Verify: Settings persist (models still unchecked)

**Scenario 3: Verify Filtering in Account Cards**

1. Hide "gemini-2.0-flash" model
2. Save settings
3. Navigate to Accounts page
4. Verify: "gemini-2.0-flash" does NOT appear in any account card
5. Return to Settings → Models
6. Show "gemini-2.0-flash" again
7. Return to Accounts
8. Verify: "gemini-2.0-flash" now appears in account cards

**Scenario 4: Edge Cases**

1. Hide all models → Verify "No quota data" message
2. Search for non-existent model → Verify "No models found"
3. Reset to defaults → Verify all models become visible

**Acceptance Criteria**:

- [ ] All UI interactions work smoothly
- [ ] No console errors during interaction
- [ ] Settings persist across page reloads
- [ ] Model filtering applies to account cards
- [ ] Translations work (test in EN/ZH/RU)
- [ ] No memory leaks observed

---

## 🚀 IMPLEMENTATION CHECKLIST

### Phase 1: Emergency Fix (5 minutes) - DO THIS FIRST

**Task 1.1: Verify StatusBar Fix**

```bash
# Open file
code src/components/StatusBar.tsx

# Verify line 20 has: refetchInterval: 10000
# If it has 2000, change to 10000 and save
```

**Task 1.2: Clean Process State**

```powershell
# Kill all Antigravity processes
taskkill /F /IM Antigravity.exe

# Wait 5 seconds
Start-Sleep -Seconds 5

# Verify clean state (should show nothing)
tasklist | findstr -i antigravity
```

**Task 1.3: Fresh Application Start**

```bash
# Start fresh session
npm start

# Wait for app to fully load
# Verify: Browser window appears
# Verify: Tray icon visible
# Verify: No console errors
```

**Task 1.4: Monitor for 5 Minutes**

```powershell
# Run this every 60 seconds for 5 minutes
@(tasklist | Select-String -Pattern "Antigravity").Count

# Expected results:
# T=0s:   10-15 processes (initial)
# T=60s:  ≤15 processes
# T=120s: ≤15 processes
# T=180s: ≤15 processes
# T=240s: ≤15 processes
# T=300s: ≤15 processes

# If count exceeds 15 or grows continuously: STOP AND ESCALATE
```

**STOP POINT**: If 5-minute test fails, do NOT proceed to Phase 2. Escalate immediately.

---

### Phase 2: Subprocess Optimization (1-2 hours)

**Task 2.1: Open Process Handler**

```bash
code src/ipc/process/handler.ts
```

**Task 2.2: Add Cache Infrastructure**

- Add module-level state (see detailed code above)
- Location: After line 7 (after `const execAsync = promisify(exec);`)

**Task 2.3: Wrap isProcessRunning() Function**

- Add rate limiting layer (see detailed code above)
- Add cache check layer (see detailed code above)
- Location: Start of `isProcessRunning()` function (~line 70)

**Task 2.4: Consolidate Searches**

- Replace dual loop with single search (see detailed code above)
- Location: Inside `isProcessRunning()` (~line 75-90)

**Task 2.5: Update Cache**

- Add cache update before return (see detailed code above)
- Add error handling with cache fallback (see detailed code above)
- Location: End of `isProcessRunning()` function (~line 140)

**Task 2.6: Test TypeScript**

```bash
npm run type-check
# Should pass with 0 errors in handler.ts
```

**Task 2.7: Test Optimizations**

```powershell
# Restart application
taskkill /F /IM Antigravity.exe
npm start

# Monitor for 10 minutes
# Check logs for cache hits
# Expected: "Cache hit" messages in console
```

---

### Phase 3: Model Visibility Validation (1 hour)

**Task 3.1: Functional Test**

1. Open Settings → Models tab
2. Search for "gemini"
3. Toggle visibility on 3-5 models
4. Save changes
5. Navigate to Accounts page
6. Verify hidden models don't appear
7. Return to Settings
8. Reset to defaults
9. Verify all models visible again

**Task 3.2: Persistence Test**

1. Hide 3 models
2. Save
3. Close application completely
4. Restart application
5. Open Settings → Models
6. Verify: 3 models still hidden

**Task 3.3: Multi-Account Test**

1. Ensure multiple cloud accounts exist
2. Hide "gemini-2.0-flash"
3. Save
4. Navigate to Accounts page
5. Verify: "gemini-2.0-flash" hidden in ALL account cards

**Task 3.4: Memory Monitoring**

```powershell
# Open Chrome DevTools (Electron)
# Memory tab → Take heap snapshot

# Perform 20 toggle operations
# Take another heap snapshot

# Compare:
# - Should see < 50MB growth
# - No retained React components
# - No growing event listeners
```

---

### Phase 4: Final Validation (30 minutes)

**Task 4.1: 30-Minute Uptime Test**

```powershell
# Start fresh
taskkill /F /IM Antigravity.exe
npm start

# Record start time
$startTime = Get-Date

# Monitor every 5 minutes for 30 minutes
while ((Get-Date) -lt $startTime.AddMinutes(30)) {
    $processCount = @(tasklist | Select-String -Pattern "Antigravity").Count
    $elapsed = ((Get-Date) - $startTime).TotalMinutes
    Write-Host "[$elapsed min] Process Count: $processCount"
    
    if ($processCount -gt 15) {
        Write-Host "❌ FAIL: Process count exceeded 15" -ForegroundColor Red
        break
    }
    
    Start-Sleep -Seconds 300  # 5 minutes
}

Write-Host "✅ PASS: 30-minute uptime test completed" -ForegroundColor Green
```

**Expected Results**:

- Process count: ≤15 throughout test
- Memory usage: <500MB main process
- UI: Fully responsive
- No errors: Console clean

**Task 4.2: TypeScript Validation**

```bash
npm run type-check
# Should pass with 0 errors in implementation files
```

**Task 4.3: Documentation**

```bash
# Update CHANGELOG.md
# Add entry under version X.X.X:
# - Fixed: Critical regression in StatusBar polling causing process accumulation
# - Optimized: Added caching and rate limiting to isProcessRunning()
# - Validated: Model Visibility Settings feature working correctly
```

---

## 📊 ACCEPTANCE CRITERIA

### Critical (ALL must pass)

- [ ] StatusBar polling interval is 10 seconds
- [ ] 30-minute uptime test passed
- [ ] Process count ≤ 15 throughout test
- [ ] Memory usage stable (<500MB)
- [ ] UI remains responsive
- [ ] TypeScript type-check passes
- [ ] No console errors during normal operation

### High Priority (SHOULD pass)

- [ ] Cache infrastructure implemented
- [ ] Rate limiting implemented
- [ ] Single search instead of dual search
- [ ] Debug logging added
- [ ] Model visibility feature validated
- [ ] Settings persist correctly
- [ ] Model filtering works in account cards

### Medium Priority (NICE to have)

- [ ] Memory leak testing completed
- [ ] Multi-account testing completed
- [ ] E2E tests pass (if available)
- [ ] Documentation updated

---

## 🧪 VERIFICATION COMMANDS

### Before Starting

```bash
# Check current StatusBar state
grep -n "refetchInterval" src/components/StatusBar.tsx

# Check process handler state
grep -n "processCache" src/ipc/process/handler.ts

# Should NOT find processCache (not implemented yet)
```

### During Implementation

```bash
# Type check
npm run type-check

# Format check
npm run format

# Lint check
npm run lint
```

### After Implementation

```powershell
# Process count check
@(tasklist | Select-String -Pattern "Antigravity").Count

# Memory check (in DevTools Console)
performance.memory.usedJSHeapSize / 1024 / 1024  # Should be <500MB

# Check logs for cache hits
# Look for: "[ProcessCheck] Cache hit"
```

---

## 📁 COMPLETE FILE PATHS

**Primary Files**:

- `C:\Users\Laptop\Services\AntigravityManager\src\components\StatusBar.tsx`
- `C:\Users\Laptop\Services\AntigravityManager\src\ipc\process\handler.ts`

**Model Visibility Files**:

- `C:\Users\Laptop\Services\AntigravityManager\src\components\ModelVisibilitySettings.tsx`
- `C:\Users\Laptop\Services\AntigravityManager\src\components\CloudAccountCard.tsx`
- `C:\Users\Laptop\Services\AntigravityManager\src\routes\settings.tsx`
- `C:\Users\Laptop\Services\AntigravityManager\src\types\config.ts`
- `C:\Users\Laptop\Services\AntigravityManager\src\localization\i18n.ts`

**Documentation**:

- `C:\Users\Laptop\Services\AntigravityManager\CHANGELOG.md`
- `C:\Users\Laptop\Services\AntigravityManager\docs\Research\DeepWiki_mem_leak.md`

**Change Request**:

- `C:\Users\Laptop\Services\AntigravityManager\openspec\changes\fix-statusbar-polling-regression\`

---

## 🚨 TROUBLESHOOTING

### If 5-Minute Test Fails

1. Check if `refetchInterval` is actually 10000 in code
2. Verify you did a FULL restart (not hot-reload)
3. Check console logs for errors
4. Monitor Windows Task Manager for process spawning pattern
5. Escalate to senior engineer if issues persist

### If Optimization Causes New Issues

**Rollback Plan**:

1. Keep 10-second polling interval ✅
2. Remove cache layer ❌
3. Remove rate limiting ❌
4. Keep single search ✅
5. Monitor for 24 hours before re-attempting optimization

### If Model Visibility Has Issues

1. Check TypeScript errors: `npm run type-check`
2. Check console for runtime errors
3. Verify config schema in `config.ts`
4. Check browser DevTools → Application → Local Storage
5. File separate bug report if memory leak detected

---

## 📞 ESCALATION PATH

**If Critical Test Fails**:

1. Document exact failure mode
2. Capture screenshots/logs
3. Note process count and memory usage
4. Include time elapsed before failure
5. Escalate immediately - do NOT proceed

**Contact**:

- Primary: Senior Engineer
- Backup: Engineering Team Lead
- Reference: This change request + session logs

---

## ✅ COMPLETION SIGN-OFF

Once all tasks complete, verify:

**Functional**:

- [ ] Application runs stable for 30+ minutes
- [ ] Process count ≤ 15
- [ ] Memory <500MB
- [ ] UI responsive
- [ ] Model visibility works

**Technical**:

- [ ] TypeScript compiles
- [ ] No lint errors
- [ ] Code formatted
- [ ] Tests pass (if applicable)

**Documentation**:

- [ ] CHANGELOG updated
- [ ] Change request marked complete
- [ ] Git committed with clear message

**Sign-off**:

```
Completed By: _______________________
Date: _______________________
Time: _______________________
Confirmed By: _______________________
```

---

## 📚 ADDITIONAL CONTEXT

**Research Document**: `docs/Research/DeepWiki_mem_leak.md`  
**Original Analysis**: Session logs from February 15, 2026  
**Root Cause**: Subprocess spawning via `find-process` package on Windows  
**Platform Impact**: Windows most affected (uses PowerShell + tasklist)

**Performance Math**:

- 2s interval: 1800 IPC calls/hour, 360 subprocesses/hour
- 10s interval: 360 IPC calls/hour, 72 subprocesses/hour
- With cache (60s TTL): 60 cache misses/hour, 12 subprocesses/hour
- **Total reduction: 98% fewer subprocess calls**

**Technology Stack**:

- Electron 37.3.1
- React 19.2.0
- TanStack Query (React Query)
- find-process package (cross-platform process detection)
- Windows: PowerShell + tasklist
- Better-SQLite3 for persistence

---

---

# 🎨 NEXT LAYER: Provider Groupings & Advanced Model Management

**Status**: 🟡 DRAFT - Investigation Phase  
**Date**: February 15, 2026  
**Priority**: Medium - Enhancement (implement after StatusBar regression is fixed)  
**Dependencies**: Requires Model Visibility feature to be validated first

---

## 📋 FEATURE OVERVIEW

This enhancement adds intelligent **provider-level grouping** for AI models with shared rate-limiting behavior, plus **hierarchical collapsible UI** for better quota visualization across multiple accounts.

### Business Context

**Antigravity Rate Limiting Behavior** (Critical Understanding):

- All **Google Gemini models** share rate limits per account
  - When `gemini-2.0-flash-exp` hits 429 (rate limit), ALL Gemini models hit 429 simultaneously
  - This includes: `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`, etc.
- All **Anthropic Claude models** share rate limits per account
  - When `claude-3-7-sonnet` hits 429, ALL Claude models hit 429 simultaneously
  - This includes: `claude-3-opus`, `claude-3-5-sonnet`, `claude-3-haiku`, etc.
- **Other providers** may have independent or grouped rate limits (needs investigation)

**Current Problem**:

- Each model displays individually with separate quota bars
- When Gemini models share 429 state, UI shows 20+ redundant quota bars all showing 0% or reset timers
- Users cannot easily see "all my Gemini models are rate-limited" at a glance
- No visual hierarchy showing provider → model relationship
- Account cards expand to massive heights when many models are tracked

---

## 🎯 PROPOSED SOLUTION

### Feature 1: Provider Grouping Toggle (Settings)

**Location**: Settings → Models tab (existing)  
**New Setting**: "Enable Provider Groupings" (boolean toggle)

**Behavior**:

- **When OFF** (default): Models display as flat list (current behavior)
- **When ON**: Models group by provider with collapsible sections

**Visual Mockup (Provider Groupings ON)**:

```
┌─────────────────────────────────────────────────────────┐
│ Settings → Models                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ☑ Enable Provider Groupings                            │
│                                                         │
│ ▼ Claude (Anthropic)                [5/8 models shown] │
│   ├─ ☑ claude-3-7-sonnet                               │
│   ├─ ☑ claude-3-5-sonnet-20241022                      │
│   ├─ ☑ claude-3-opus-20240229                          │
│   ├─ ☑ claude-3-5-haiku-20241022                       │
│   ├─ ☑ claude-3-haiku-20240307                         │
│   ├─ ☐ claude-2.1                          [Hidden]    │
│   ├─ ☐ claude-2.0                          [Hidden]    │
│   └─ ☐ claude-instant-1.2                  [Hidden]    │
│                                                         │
│ ▼ Gemini (Google)                  [4/6 models shown]  │
│   ├─ ☑ gemini-2.0-flash-exp                            │
│   ├─ ☑ gemini-1.5-pro-002                              │
│   ├─ ☑ gemini-1.5-flash-002                            │
│   ├─ ☑ gemini-1.5-flash-8b                             │
│   ├─ ☐ gemini-2.0-flash-thinking-exp      [Hidden]    │
│   └─ ☐ gemini-pro                          [Hidden]    │
│                                                         │
│ ▶ GPT (OpenAI)                      [0/12 models shown]│
│   (collapsed - click to expand)                        │
│                                                         │
│ Save Changes                                            │
└─────────────────────────────────────────────────────────┘
```

### Feature 2: Collapsible Provider Cards (Account Display)

**Location**: Main page → Cloud Account Cards  
**Behavior**: When "Provider Groupings" enabled, transform account cards

**Current Display** (Individual Models):

```
┌─────────────────────────────────────────────────────────┐
│ 🌩️ example@gmail.com                                   │
├─────────────────────────────────────────────────────────┤
│ gemini-2.0-flash-exp        [████████░░] 80% | 2h reset│
│ gemini-1.5-pro-002          [████████░░] 78% | 2h reset│
│ gemini-1.5-flash-002        [████████░░] 79% | 2h reset│
│ gemini-1.5-flash-8b         [████████░░] 81% | 2h reset│
│ claude-3-7-sonnet           [██░░░░░░░░] 20% | 45m reset│
│ claude-3-5-sonnet-20241022  [██░░░░░░░░] 18% | 45m reset│
│ claude-3-opus-20240229      [██░░░░░░░░] 19% | 45m reset│
│ claude-3-5-haiku-20241022   [██░░░░░░░░] 21% | 45m reset│
└─────────────────────────────────────────────────────────┘
```

**Proposed Display** (Provider Grouped):

```
┌─────────────────────────────────────────────────────────┐
│ 🌩️ example@gmail.com                [▼ Average: 50%]   │
├─────────────────────────────────────────────────────────┤
│ ▼ Gemini (4 models)     [████████░░] 80% avg | 2h reset│
│   ├─ gemini-2.0-flash-exp        [████████░░] 80%      │
│   ├─ gemini-1.5-pro-002          [████████░░] 78%      │
│   ├─ gemini-1.5-flash-002        [████████░░] 79%      │
│   └─ gemini-1.5-flash-8b         [████████░░] 81%      │
│                                                         │
│ ▼ Claude (4 models)     [██░░░░░░░░] 20% avg | 45m reset│
│   ├─ claude-3-7-sonnet           [██░░░░░░░░] 20%      │
│   ├─ claude-3-5-sonnet-20241022  [██░░░░░░░░] 18%      │
│   ├─ claude-3-opus-20240229      [██░░░░░░░░] 19%      │
│   └─ claude-3-5-haiku-20241022   [██░░░░░░░░] 21%      │
└─────────────────────────────────────────────────────────┘
```

**Collapsed View**:

```
┌─────────────────────────────────────────────────────────┐
│ ▼ 🌩️ example@gmail.com             [Average: 50%]      │
├─────────────────────────────────────────────────────────┤
│ ▶ Gemini (4 models)     [████████░░] 80% avg | 2h reset│
│ ▶ Claude (4 models)     [██░░░░░░░░] 20% avg | 45m reset│
└─────────────────────────────────────────────────────────┘
```

**Fully Collapsed Account**:

```
┌─────────────────────────────────────────────────────────┐
│ ▶ 🌩️ example@gmail.com   [████░░░░░░] 50% avg | 1h30m  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 TECHNICAL ANALYSIS (INITIAL)

### Provider Detection Strategy

**Option 1: Model Name Prefix Parsing**

```typescript
function detectProvider(modelName: string): string {
  if (modelName.startsWith('claude-')) return 'Claude (Anthropic)';
  if (modelName.startsWith('gemini-')) return 'Gemini (Google)';
  if (modelName.startsWith('gpt-')) return 'GPT (OpenAI)';
  if (modelName.startsWith('o1-')) return 'O1 (OpenAI)';
  if (modelName.startsWith('o3-')) return 'O3 (OpenAI)';
  return 'Other';
}
```

**Option 2: Provider Registry (Extensible)**

```typescript
const PROVIDER_REGISTRY = {
  'claude-': { name: 'Claude', company: 'Anthropic', color: '#D97757' },
  'gemini-': { name: 'Gemini', company: 'Google', color: '#4285F4' },
  'gpt-': { name: 'GPT', company: 'OpenAI', color: '#10A37F' },
  'o1-': { name: 'O1', company: 'OpenAI', color: '#10A37F' },
  // Future: 'llama-', 'mistral-', 'command-', etc.
};
```

**Recommendation**: Option 2 (registry-based) for future extensibility

### Data Aggregation Logic

**Provider-Level Averages**:

```typescript
interface ProviderQuotaStats {
  provider: string;
  models: ModelQuota[];
  avgPercentage: number;  // Mean of all model percentages
  avgResetTime: number;   // Earliest reset time (most conservative)
  minPercentage: number;  // Lowest quota (bottleneck)
  maxPercentage: number;  // Highest quota
}

function calculateProviderStats(models: ModelQuota[]): ProviderQuotaStats {
  return {
    avgPercentage: mean(models.map(m => m.percentage)),
    avgResetTime: min(models.map(m => m.resetTime)),  // Earliest reset
    minPercentage: min(models.map(m => m.percentage)),
    maxPercentage: max(models.map(m => m.percentage)),
  };
}
```

**Account-Level Averages**:

```typescript
interface AccountQuotaStats {
  account: string;
  providers: ProviderQuotaStats[];
  totalModels: number;
  avgPercentage: number;       // Mean across ALL tracked models
  avgResetTime: number;        // Earliest reset across ALL models
  healthStatus: 'healthy' | 'degraded' | 'limited';
}

function calculateAccountStats(providers: ProviderQuotaStats[]): AccountQuotaStats {
  const allModels = providers.flatMap(p => p.models);
  return {
    totalModels: allModels.length,
    avgPercentage: mean(allModels.map(m => m.percentage)),
    avgResetTime: min(allModels.map(m => m.resetTime)),
    healthStatus: calculateHealthStatus(mean(allModels.map(m => m.percentage))),
  };
}
```

### UI State Management

**New Config Schema Addition**:

```typescript
// src/types/config.ts
export const configSchema = z.object({
  // ... existing fields ...
  model_visibility: z.record(z.string(), z.boolean()).default({}),
  
  // NEW FIELD
  provider_groupings_enabled: z.boolean().default(false),
  
  // NEW FIELD (optional - tracks collapse state)
  collapsed_providers: z.record(
    z.string(),  // accountId
    z.array(z.string())  // array of collapsed provider names
  ).default({}),
  
  // NEW FIELD (optional - tracks account collapse state)
  collapsed_accounts: z.array(z.string()).default([]),
});
```

**Component State**:

```typescript
// CloudAccountCard.tsx
const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(new Set());
const [isAccountCollapsed, setIsAccountCollapsed] = useState(false);

// Settings → Models
const { data: config } = useQuery({
  queryKey: ['config'],
  queryFn: getAppConfig,
});

const providerGroupingsEnabled = config?.provider_groupings_enabled ?? false;
```

---

## 📂 FILES TO INVESTIGATE

### Existing Files to Review

1. **src/components/CloudAccountCard.tsx**
   - Current quota display logic
   - Model rendering loop
   - Quota bar component usage
   - Card layout structure

2. **src/components/ModelVisibilitySettings.tsx**
   - Settings UI structure
   - Model list rendering
   - Save mechanism
   - Search/filter logic

3. **src/types/config.ts**
   - Config schema definition
   - Type definitions for model_visibility
   - Default values

4. **src/hooks/useCloudAccounts.ts**
   - Data fetching logic
   - Model quota structure
   - Account data transformation

### New Files to Create (Proposed)

1. **src/utils/provider-grouping.ts**
   - Provider detection function
   - Registry of known providers
   - Stats calculation functions
   - Grouping/sorting utilities

2. **src/components/ProviderGroup.tsx**
   - Collapsible provider section component
   - Provider-level quota bar
   - Model list with indentation
   - Expand/collapse animation

3. **src/components/CollapsibleAccountCard.tsx**
   - Wrapper around CloudAccountCard
   - Account-level collapse state
   - Average quota calculation
   - Collapsed/expanded views

4. **src/hooks/useProviderGrouping.ts**
   - Hook to group models by provider
   - Calculate provider stats
   - Calculate account stats
   - Handle collapse state persistence

---

## 🧪 INVESTIGATION TASKS (DRAFT)

### Phase 1: Research & Analysis (4-6 hours)

**Task 1.1: Map Current Data Flow**

- [ ] Read `useCloudAccounts.ts` to understand data structure
- [ ] Document exact shape of `ModelQuota` type
- [ ] Trace where quota data comes from (ORPC? IPC?)
- [ ] Identify refresh/polling intervals

**Task 1.2: Analyze CloudAccountCard Component**

- [ ] Count current lines of code
- [ ] Identify reusable vs. component-specific logic
- [ ] Document current props interface
- [ ] Check if card supports children/composition

**Task 1.3: Survey Model Name Patterns**

- [ ] List all unique model name prefixes in production data
- [ ] Verify assumption: All Gemini = `gemini-*`, All Claude = `claude-*`
- [ ] Identify edge cases (e.g., `gpt-4-turbo` vs. `gpt-4o`)
- [ ] Create comprehensive provider registry

**Task 1.4: Review Model Visibility Implementation**

- [ ] Check if filtering logic can be reused for grouping
- [ ] Verify config persistence mechanism works for new fields
- [ ] Test search/filter performance with 50+ models

### Phase 2: Design Validation (2-4 hours)

**Task 2.1: Create Interactive Mockups**

- [ ] Design collapsed provider view (Figma/sketch)
- [ ] Design expanded provider view
- [ ] Design fully collapsed account card
- [ ] Design loading/error states

**Task 2.2: Define Calculation Rules**

- [ ] Decide: Average vs. Min vs. Max for provider percentage?
- [ ] Decide: Earliest vs. Latest vs. Average for reset time?
- [ ] Define health status thresholds (<20% = limited, <50% = degraded)
- [ ] Handle edge cases (no models, all hidden, all 0%)

**Task 2.3: Performance Impact Assessment**

- [ ] Estimate: 10 accounts × 8 providers × 5 models = 400 quota bars?
- [ ] Measure: Current render time for CloudAccountCard
- [ ] Estimate: Grouping calculation overhead
- [ ] Plan: Virtualization if >100 models visible

### Phase 3: Prototype (6-8 hours)

**Task 3.1: Build Provider Grouping Utility**

- [ ] Implement provider registry
- [ ] Implement `groupModelsByProvider()` function
- [ ] Implement stats calculation functions
- [ ] Write unit tests for edge cases

**Task 3.2: Build ProviderGroup Component**

- [ ] Create collapsible section UI
- [ ] Add expand/collapse animation
- [ ] Implement provider-level quota bar
- [ ] Add indented model list
- [ ] Handle empty state

**Task 3.3: Extend ModelVisibilitySettings**

- [ ] Add "Enable Provider Groupings" toggle
- [ ] Update model list rendering with conditional grouping
- [ ] Persist toggle state to config
- [ ] Add loading state

**Task 3.4: Modify CloudAccountCard**

- [ ] Add conditional rendering: grouped vs. flat
- [ ] Integrate ProviderGroup components
- [ ] Add account-level collapse toggle
- [ ] Calculate and display account averages
- [ ] Preserve existing behavior when grouping disabled

### Phase 4: Testing & Validation (4-6 hours)

**Task 4.1: Functional Testing**

- [ ] Test with 1 account, 2 providers, 10 models
- [ ] Test with 10 accounts, 5 providers, 50 models
- [ ] Test with 0 models (edge case)
- [ ] Test with all models hidden
- [ ] Test provider grouping toggle ON/OFF
- [ ] Test collapse state persistence

**Task 4.2: Visual Regression Testing**

- [ ] Verify alignment in collapsed state
- [ ] Verify quota bar widths match percentages
- [ ] Verify animations are smooth
- [ ] Test responsive behavior (window resize)
- [ ] Test dark/light theme compatibility

**Task 4.3: Performance Testing**

- [ ] Measure render time with 100 models
- [ ] Check for memory leaks (collapse/expand 50x)
- [ ] Verify no unnecessary re-renders
- [ ] Test with slow network (loading states)

**Task 4.4: Accessibility Testing**

- [ ] Keyboard navigation (Tab, Enter, Space)
- [ ] Screen reader announcements
- [ ] Focus management (expand/collapse)
- [ ] ARIA attributes

---

## 🤔 OPEN QUESTIONS (NEED INVESTIGATION)

### Data & Logic Questions

1. **Rate Limit Sharing**:
   - Do ALL Gemini models share the exact same 429 state?
   - Or do they have separate limits that correlate?
   - Need to verify with actual Antigravity API logs

2. **Reset Time Calculation**:
   - Should provider reset time = MIN(model reset times)?
   - Or should it be MAX (most pessimistic)?
   - Or AVG?

3. **Model Discovery**:
   - How does app discover new models?
   - Does Antigravity API return model list?
   - Or is it hardcoded in frontend?

4. **Quota Update Frequency**:
   - How often does quota data refresh?
   - Is it polled? WebSocket? Server-Sent Events?
   - Could frequent updates cause render thrashing?

### UI/UX Questions

1. **Default Collapse State**:
   - Should providers start collapsed or expanded?
   - Should accounts start collapsed or expanded?
   - Persist per user? Or global default?

2. **Color Coding**:
   - Should providers have brand colors (Anthropic orange, Google blue)?
   - Or use quota-based colors (green/yellow/red)?
   - Consider colorblind accessibility?

3. **Mobile/Responsive**:
   - Does app run on mobile?
   - Should grouping behave differently on small screens?
   - Collapse by default on mobile?

4. **Empty States**:
   - What if user hides all models in a provider?
   - Show provider with "0 models shown"?
   - Or hide provider entirely?

---

## 📊 SUCCESS METRICS (DRAFT)

### User Experience Goals

- [ ] Reduce account card height by 50% when collapsed
- [ ] Identify rate-limited provider in <2 seconds (visual scan)
- [ ] Toggle collapse state in <100ms (feels instant)
- [ ] No performance degradation vs. current implementation

### Technical Goals

- [ ] Zero breaking changes to existing model visibility
- [ ] <5% increase in bundle size
- [ ] <10% increase in render time
- [ ] Maintain <60ms per render (responsive)

### Code Quality Goals

- [ ] 80%+ test coverage for new utilities
- [ ] TypeScript strict mode passing
- [ ] No ESLint errors
- [ ] Accessibility score 90+ (Lighthouse)

---

## 🚧 IMPLEMENTATION PLAN (PRELIMINARY)

### Recommended Approach

**Phase 1: Foundation** (Week 1)

1. Complete StatusBar regression fix (prerequisite)
2. Validate Model Visibility feature
3. Research data flow and model patterns
4. Create prototype of provider grouping utility
5. Design mockups and get UX approval

**Phase 2: Core Implementation** (Week 2)

1. Build provider grouping logic
2. Create ProviderGroup component
3. Add toggle to ModelVisibilitySettings
4. Extend config schema
5. Unit tests for grouping logic

**Phase 3: Integration** (Week 3)

1. Modify CloudAccountCard with conditional rendering
2. Add collapse state management
3. Implement account-level stats
4. Add animations/transitions
5. Integration tests

**Phase 4: Polish & Release** (Week 4)

1. Visual regression testing
2. Performance optimization
3. Accessibility audit
4. Documentation
5. Staged rollout (feature flag)

---

## 🔐 RISK ASSESSMENT

### High Risk

- **Breaking Model Visibility**: New code could interfere with existing filtering
  - Mitigation: Comprehensive regression tests before merging

- **Performance Degradation**: 10 accounts × 50 models = complex render
  - Mitigation: React.memo, virtualization, profiling

### Medium Risk

- **Data Structure Changes**: May require backend/IPC changes
  - Mitigation: Investigate early, minimize schema changes

- **UX Confusion**: Users may not understand grouping
  - Mitigation: Clear labels, tooltips, documentation

### Low Risk

- **Browser Compatibility**: Modern React features
  - Mitigation: Already using React 19, Electron provides modern runtime

---

## 📚 RELATED DOCUMENTS

- **Current Change Request**: `openspec/changes/fix-statusbar-polling-regression/`
- **Model Visibility Implementation**: See files listed in "What Was Working" section
- **Provider Grouping Draft**: This section (to be moved to separate change request)

---

## ✅ NEXT STEPS

### Immediate Actions (Today)

1. **Complete StatusBar fix first** - This is blocking
2. **Validate Model Visibility** - Must confirm it works before building on top
3. **Archive old OpenSpec changes** - Clean up completed work

### Near-Term Actions (This Week)

1. **Create dedicated change request** for provider groupings
2. **Begin Phase 1 investigation** (data flow, model patterns)
3. **Design interactive mockups** for UX review
4. **Estimate effort** for full implementation

### Discussion Topics

1. Should reset time be MIN, MAX, or AVG across provider models?
2. Should accounts collapse by default or expand by default?
3. What happens when user hides all models in a provider?
4. Do we need provider brand colors or quota-based colors?
5. Should this be feature-flagged for gradual rollout?

---

**END OF DRAFT - Provider Groupings Feature**

This section requires deeper investigation before finalizing implementation plan. The above analysis provides initial direction and open questions that need resolution.

---

**END OF CHANGE REQUEST**

This document contains everything needed to implement the fix. Work through each phase in order, validate at each checkpoint, and escalate if critical tests fail.

Good luck! 🚀
