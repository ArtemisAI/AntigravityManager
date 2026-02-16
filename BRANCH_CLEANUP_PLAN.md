# Branch Cleanup Plan - Keep Only Main and Dev Branches

## Current Branch Structure Analysis

### Local Branches (to be cleaned up)

- ✅ **main** - KEEP (has all implemented features)
- ❌ **backup-before-pr-merge** - DELETE (backup no longer needed)
- ❌ **feature/docker-deployment** - DELETE (work completed)
- ❌ **feature/model-visibility-settings** - DELETE (merged to main)
- ❌ **fix/heap-corruption-statusbar-polling** - DELETE (fix applied to main)
- ❌ **pr/docker-support** - DELETE (work completed)

### Remote Branches (dev remote - to be cleaned up)

- ✅ **dev/main** - KEEP (aligned with local main)
- ❌ **dev/copilot/fix-docker-build-issue** - DELETE (PR closed)
- ❌ **dev/copilot/implement-model-visibility-settings-change** - DELETE (PR closed)
- ❌ **dev/feature/docker-deployment** - DELETE (work completed)
- ❌ **dev/feature/model-visibility-settings** - DELETE (merged)

### Target Structure

```
main (production-ready with all features)
└── dev (for future feature development)
```

## Cleanup Execution Plan

### Phase 1: Create Dev Branch

```bash
# Create dev branch from current main
git checkout -b dev

# Push dev branch to origin (fork)
git push -u origin dev

# Switch back to main
git checkout main
```

### Phase 2: Delete Local Branches

```bash
# Delete unnecessary local branches
git branch -D backup-before-pr-merge
git branch -D feature/docker-deployment
git branch -D feature/model-visibility-settings
git branch -D fix/heap-corruption-statusbar-polling
git branch -D pr/docker-support
```

### Phase 3: Delete Remote Branches (After PR Closure)

```bash
# Delete PR-related branches from dev remote
git push dev --delete copilot/fix-docker-build-issue
git push dev --delete copilot/implement-model-visibility-settings-change
git push dev --delete feature/docker-deployment
git push dev --delete feature/model-visibility-settings
```

### Phase 4: Update Remote Tracking

```bash
# Ensure main tracks origin/main
git branch --set-upstream-to=origin/main main

# Ensure dev tracks origin/dev
git branch --set-upstream-to=origin/dev dev
```

## Branch Usage Guidelines

### Main Branch

- **Purpose**: Production-ready code
- **Content**: All implemented features (model visibility, heap corruption fix)
- **Merging**: Only from dev branch after thorough testing
- **Pushing**: To upstream repository for releases

### Dev Branch

- **Purpose**: Feature development and integration
- **Content**: Latest development work
- **Workflow**:

  ```
  # Start new feature
  git checkout dev
  git checkout -b feature/new-feature

  # Develop and test
  # ... development work ...

  # Merge back to dev
  git checkout dev
  git merge feature/new-feature
  git branch -d feature/new-feature

  # When ready for production
  git checkout main
  git merge dev
  ```

## Verification Steps

### After Cleanup

- [ ] Only `main` and `dev` branches exist locally
- [ ] Only `main` and `dev` branches exist on origin remote
- [ ] Dev remote cleaned of PR branches
- [ ] All features preserved in main branch
- [ ] Dev branch ready for new development

### Branch Status Check

```bash
# Should show only main and dev
git branch -a | grep -E "(main|dev)"

# Expected output:
# * main
#   dev
#   remotes/origin/main
#   remotes/origin/dev
```

## Benefits of This Structure

### Simplicity

- **Clear separation**: Main for production, dev for development
- **Reduced complexity**: No feature branches cluttering repository
- **Easy maintenance**: Simple branch management

### Workflow Efficiency

- **Fast development**: Work on dev, merge to main when ready
- **Clean history**: Feature work consolidated before main merges
- **Easy rollback**: Dev branch serves as backup for main

### Upstream Compatibility

- **Clean pushes**: Only main branch pushed upstream
- **No conflicts**: Feature branches don't interfere with upstream sync
- **Organized contributions**: Clear development workflow

## Emergency Rollback

If any issues occur during cleanup:

```bash
# Restore from reflog if needed
git reflog
git checkout <commit-hash>

# Or restore deleted branches from remotes
git checkout -b feature/model-visibility-settings origin/feature/model-visibility-settings
```

---

**Execution Date**: February 15, 2026
**Target State**: Only main and dev branches
**Rationale**: Simplify repository structure for efficient development
**Risk Level**: Low (all work preserved in main)</content>
<parameter name="filePath">c:\Users\Laptop\Services\AntigravityManager\BRANCH_CLEANUP_PLAN.md
