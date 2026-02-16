# Fix StatusBar Polling Regression - Change Request Summary

## 📋 **Quick Reference**

**Change Name**: `fix-statusbar-polling-regression`  
**Status**: 🟡 Ready for Implementation  
**Priority**: 🔴 **CRITICAL** - Production Blocking  
**Estimated Time**: 2-4 hours  
**Assigned To**: Copilot SWE

---

## 🎯 **What's Broken**

The application accumulates **21+ Antigravity.exe processes** within 3 minutes of startup, consuming **1GB+ memory** and becoming completely unresponsive (zombie state).

**Root Cause**: StatusBar component's `isProcessRunning()` polling creates excessive subprocess spawning pressure on Windows.

---

## ✅ **What Needs to Happen**

### **Phase 1: Emergency Fix** (5 minutes)

1. ✅ Verify `StatusBar.tsx` has `refetchInterval: 10000` (ALREADY FIXED IN CODE)
2. ❗ Kill all existing processes for clean state
3. ❗ Fresh `npm start` to apply the fix
4. ❗ Monitor for 5 minutes to confirm no process accumulation

### **Phase 2: Optimization** (1-2 hours)

1. Add result caching (60s TTL) to `isProcessRunning()`
2. Add rate limiting (5s minimum interval)
3. Consolidate dual subprocess searches to single search

### **Phase 3: Validation** (1 hour)

1. Validate Model Visibility feature (added today) works correctly
2. Memory leak testing
3. 30-minute uptime test

---

## 📂 **Files to Work With**

| File | Action | Line |
|------|--------|------|
| `src/components/StatusBar.tsx` | ✅ VERIFIED (already has fix) | 20 |
| `src/ipc/process/handler.ts` | OPTIMIZE (add cache + rate limit) | 70-100 |
| `src/components/ModelVisibilitySettings.tsx` | VALIDATE (new feature) | - |
| `src/components/CloudAccountCard.tsx` | VALIDATE (filtering logic) | - |

---

## 🚨 **Critical Information**

### **Current Code State**

- ✅ `StatusBar.tsx` already has `refetchInterval: 10000`
- ❌ Running application has NOT picked up this fix (hot-reload limitation)
- ❌ React Query interval needs fresh app restart to apply

### **Why The Issue Persists**

Hot-reload updated the component code but didn't re-initialize the React Query hook with the new interval configuration. The running query still uses the old 2-second interval.

### **Solution**

1. Kill all Antigravity processes
2. Start fresh `npm start` session
3. New query instance will use 10-second interval

---

## 📄 **Complete Documentation**

All details are in the change request directory:

```
openspec/changes/fix-statusbar-polling-regression/
├── proposal.md      # Full problem statement and objectives
├── design.md        # Technical architecture and optimization details
├── tasks.md         # Step-by-step implementation checklist
└── specs/           # (empty - add delta specs if needed)
```

---

## 🎬 **Next Steps for Copilot SWE**

1. **Read** `proposal.md` for full context
2. **Review** `design.md` for technical architecture
3. **Execute** `tasks.md` checklist step-by-step
4. **Verify** all acceptance criteria met
5. **Document** results and close change request

---

## 📞 **Questions or Issues?**

If you encounter blockers:

- Check `docs/Research/DeepWiki_mem_leak.md` for subprocess analysis
- Review earlier session logs for context
- Escalate if 30-minute uptime test fails

---

**Ready to proceed? Start with Task 1.1 in `tasks.md`** 🚀
