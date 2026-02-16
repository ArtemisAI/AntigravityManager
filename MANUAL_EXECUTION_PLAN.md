# Manual Execution Plan - Terminal Issues Resolution

## Problem

VS Code terminal is opening alternate buffers for all commands, preventing automated execution. All git operations must be performed manually.

## Current State

- **Incomplete Merge**: feature/model-visibility-settings → main (merge state files present)
- **Upstream Divergence**: Local main is 6 commits ahead of upstream
- **Backup Needed**: Before upstream merge

## Required Manual Commands

### Step 1: Complete Current Merge

```bash
# Complete the pending merge
git commit --no-edit
```

### Step 2: Create Backup Branches

```bash
# Backup current main before upstream merge
git branch backup/main-before-upstream-merge

# Backup feature branch
git branch backup/feature-model-visibility-pre-merge feature/model-visibility-settings
```

### Step 3: Align with Upstream

```bash
# Fetch latest upstream changes
git fetch upstream

# Merge upstream changes
git merge upstream/main --no-edit
```

### Step 4: Handle Conflicts (If Any)

```bash
# If conflicts occur, resolve them, then:
git add <resolved-files>
git commit --no-edit
```

### Step 5: Push to Development Remote

```bash
# Push aligned main to dev remote for safety
git push dev main
```

### Step 6: Final Validation

```bash
# Run tests
npm test

# Build verification
npm run type-check
npm run lint

# Application test
npm start
```

## Expected Results

### Success Indicators

- ✅ Merge completes without conflicts
- ✅ All tests pass
- ✅ Application starts successfully
- ✅ Features work correctly
- ✅ No breaking changes

### Conflict Resolution (If Needed)

- **Priority**: Keep upstream changes for core functionality
- **Local Features**: Preserve model visibility settings
- **Testing**: Full validation after resolution

## Documentation Updates Required

### After Successful Merge

1. Update `DEVELOPMENT_CHANGE_LOG_2026-02-15.md` with merge results
2. Update `UPSTREAM_ALIGNMENT_STRATEGY.md` with execution details
3. Document any conflicts and resolutions

### Files to Monitor

- `package.json` - Dependency changes
- `src/components/StatusBar.tsx` - Polling fix integrity
- `src/components/ModelVisibilitySettings.tsx` - Feature functionality
- All configuration files for upstream changes

## Rollback Commands (If Needed)

```bash
# Rollback to backup
git reset --hard backup/main-before-upstream-merge

# Restore feature branch
git checkout backup/feature-model-visibility-pre-merge
git checkout -b feature/model-visibility-settings-restored
```

## Quality Assurance Checklist

### Pre-Execution

- [ ] Backup branches created
- [ ] Current state documented
- [ ] Test suite passes on current main

### Post-Execution

- [ ] Merge successful (no conflicts or resolved)
- [ ] All tests pass
- [ ] Application builds and runs
- [ ] Features functional
- [ ] Documentation updated

## Risk Assessment

### Low Risk

- Clean merge (expected scenario)
- No dependency conflicts
- Feature isolation maintained

### Medium Risk

- Minor conflicts in documentation files
- Dependency version updates
- Configuration changes

### High Risk

- Major breaking changes in upstream
- Core functionality conflicts
- Build system changes

## Emergency Contacts

### If Issues Occur

1. **Immediate**: Use rollback commands above
2. **Assessment**: Check what upstream changes caused issues
3. **Resolution**: Manual conflict resolution or feature adjustment
4. **Documentation**: Update all change logs with issues and fixes

---

**Manual Execution Required**: Due to VS Code terminal buffer issues
**Estimated Time**: 15-30 minutes
**Success Rate**: High (conservative approach)
**Rollback Available**: Yes (backup branches)

**Ready for Manual Execution**: ✅ All commands prepared and documented</content>
<parameter name="filePath">c:\Users\Laptop\Services\AntigravityManager\MANUAL_EXECUTION_PLAN.md
