# Git Workflow & Repository Strategy

**Last Updated**: 2026-02-12  
**Security Level**: 🔴 CRITICAL - Credential Protection Enforced

---

## 🎯 Repository Structure

### **Three-Repository Strategy**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Repository Hierarchy                         │
└─────────────────────────────────────────────────────────────────┘

1. UPSTREAM (Original/Head)
   └─ https://github.com/Draculabo/AntigravityManager.git
      ├─ Public repository
      ├─ Original source
      └─ Target for PRs when contributing back

2. ORIGIN (Public Fork)
   └─ https://github.com/ArtemisArchitect/AntigravityManager.git
      ├─ Public repository
      ├─ Fork of Draculabo/AntigravityManager
      ├─ Syncs with upstream
      └─ Used for public PRs

3. DEV (Private Development)
   └─ https://github.com/ArtemisArchitect/DEV-AntigravityManager.git
      ├─ 🔒 PRIVATE repository
      ├─ Active development work
      ├─ Testing and experimentation
      └─ May contain work-in-progress code
```

---

## 🔧 Initial Setup

### 1. Configure Remotes

```powershell
# View current remotes
git remote -v

# Add private dev remote
git remote add dev https://github.com/ArtemisArchitect/DEV-AntigravityManager.git

# Verify all remotes
git remote -v
# Should show:
# origin   https://github.com/ArtemisArchitect/AntigravityManager.git (fetch/push)
# upstream https://github.com/Draculabo/AntigravityManager.git (fetch/push)
# dev      https://github.com/ArtemisArchitect/DEV-AntigravityManager.git (fetch/push)
```

### 2. Verify .gitignore Protection

**CRITICAL**: Ensure `.gitignore` prevents credential leaks:

```bash
# Check current .gitignore
cat .gitignore

# Verify these patterns are included:
# - *.db, *.sqlite (databases with tokens)
# - data/, .antigravity-agent/ (credential directories)
# - .env, .env.* (environment variables)
# - gui_config.json (user configuration)
# - *.key, .keys/ (encryption keys)
# - backups/, *.bak (backup files)
```

### 3. Pre-Commit Security Check

**Before EVERY commit**:

```powershell
# 1. Check what will be committed
git status
git diff --cached

# 2. Search for potential secrets
git diff --cached | Select-String -Pattern "(password|secret|token|key|api)" -CaseSensitive

# 3. Verify no database files
git diff --cached --name-only | Select-String "\.db$|\.sqlite$"

# 4. Check for environment files
git diff --cached --name-only | Select-String "^\.env|gui_config\.json"
```

---

## 📋 Development Workflow

### Daily Development Cycle

```powershell
# ========================================
# STEP 1: Start of Day - Sync with Upstream
# ========================================

# Fetch latest from upstream (Draculabo)
git fetch upstream

# Merge upstream changes into main
git checkout main
git merge upstream/main

# Push to private dev for backup
git push dev main

# ========================================
# STEP 2: Feature Development
# ========================================

# Create feature branch (on dev remote)
git checkout -b feature/my-feature

# Make changes, test locally
# ... development work ...

# Commit frequently (stays in private repo)
git add .
git commit -m "WIP: feature description"
git push dev feature/my-feature

# ========================================
# STEP 3: Testing & Refinement
# ========================================

# Use Copilot SWE for complex changes
# Push to dev remote for Copilot to access

# Test locally
npm test
npm run lint
npm run type-check

# ========================================
# STEP 4: Ready for Public (Optional)
# ========================================

# When feature is complete and tested:

# 1. Squash commits (clean history)
git rebase -i main

# 2. Security audit
git diff main --name-only
# Verify NO credentials or sensitive files

# 3. Push to public fork
git push origin feature/my-feature

# 4. Create PR to upstream (if contributing back)
# Go to: https://github.com/Draculabo/AntigravityManager
# Click "New Pull Request"
```

---

## 🔐 Security Workflow

### Before Every Push

**Security Checklist**:

```powershell
# ✅ 1. Verify no credentials in diff
git diff main | Select-String -Pattern "(sk-|GOOGLE_API|CLIENT_SECRET|password|token)" -CaseSensitive

# ✅ 2. Check no database files staged
git diff --cached --name-only | Select-String "\.db$|\.sqlite$|\.bak$"

# ✅ 3. Verify no env files
git diff --cached --name-only | Select-String "^\.env|gui_config"

# ✅ 4. Scan entire commit for secrets
git diff --cached

# ✅ 5. If ALL CLEAR, then push
git push dev <branch-name>
```

### Emergency: Credential Leaked

**If credentials are accidentally committed**:

```powershell
# 🚨 IMMEDIATE ACTION REQUIRED

# 1. DO NOT PUSH if not yet pushed
# 2. Remove from last commit
git reset --soft HEAD~1  # Undo commit, keep changes
git restore --staged <file-with-secret>  # Unstage sensitive file

# 3. If already pushed to dev (private repo):
# - Rotate all exposed credentials immediately
# - Use git-filter-branch or BFG Repo-Cleaner to remove from history

# 4. If pushed to public repo:
# 🆘 Critical security incident:
#    - Rotate ALL credentials immediately
#    - Contact repository admin
#    - Consider repository deletion if very sensitive
```

---

## 🔄 Branch Strategy

### Branch Naming Convention

```
main                    Production-ready code
feature/<name>          New features
fix/<name>              Bug fixes
refactor/<name>         Code refactoring
docs/<name>             Documentation updates
test/<name>             Test additions
docker/<name>           Docker-related changes
```

### Branching Rules

```powershell
# ✅ DO: Work on feature branches
git checkout -b feature/docker-deployment

# ✅ DO: Push WIP to private dev repo
git push dev feature/docker-deployment

# ❌ DON'T: Push experimental code to public fork
# ❌ DON'T: Push directly to main
# ❌ DON'T: Force push to public repositories
```

---

## 🚀 Working with PR #1 (Docker Support)

### Fetch PR Changes

```powershell
# Fetch PR #1 from ArtemisArchitect/AntigravityManager
git fetch origin pull/1/head:pr/docker-support

# Checkout the PR branch
git checkout pr/docker-support

# Review changes
git log origin/main..pr/docker-support
git diff origin/main..pr/docker-support

# Merge into feature branch for testing
git checkout -b feature/docker-deployment
git merge pr/docker-support

# Test locally
npm install
npm start

# If good, push to private dev for further work
git push dev feature/docker-deployment
```

### Implement Analysis Recommendations

```powershell
# Apply changes from DOCKER_ANALYSIS.md

# 1. Create docker-compose files
# 2. Add read-only mode
# 3. Implement health checks
# 4. Test with mounted volumes

# Commit incrementally
git add docker-compose.prod.yml
git commit -m "feat(docker): add production compose config"

git add src/server/standalone.ts
git commit -m "feat(docker): add read-only mode to standalone server"

git add src/server/modules/health/
git commit -m "feat(docker): add health check endpoint"

# Push to dev for Copilot SWE to work on
git push dev feature/docker-deployment
```

---

## 🤖 Using Copilot SWE

### When to Use Copilot SWE

✅ **Good Use Cases**:

- Complex refactoring across multiple files
- Adding comprehensive test coverage
- Implementing well-defined features
- Large-scale code migrations
- Documentation generation

❌ **Avoid for**:

- Security-sensitive code (credential handling)
- Local testing required (hardware dependencies)
- Quick fixes (faster to do manually)

### Copilot SWE Workflow

```powershell
# 1. Push current state to dev remote
git push dev feature/copilot-task

# 2. Open GitHub issue on DEV repo with task description
# Title: "[Copilot] Add health check endpoints"
# Body: Detailed specification

# 3. Let Copilot SWE create PR

# 4. Review PR locally
git fetch dev pull/<pr-number>/head:copilot-pr
git checkout copilot-pr

# 5. Test locally
npm install
npm test

# 6. If good, merge into feature branch
git checkout feature/docker-deployment
git merge copilot-pr

# 7. Push final version
git push dev feature/docker-deployment
```

---

## 📊 Repository Sync Strategy

### Sync Upstream → Origin → Dev

```powershell
# ========================================
# Weekly Sync (or before major work)
# ========================================

# 1. Fetch all remotes
git fetch --all

# 2. Update local main from upstream
git checkout main
git merge upstream/main

# 3. Push to public fork
git push origin main

# 4. Push to private dev
git push dev main

# ========================================
# When to Create Public PR
# ========================================

# Only when:
# - Feature is complete and tested
# - No credentials or sensitive data
# - Code is clean and documented
# - Passes all tests and lints

# Process:
# 1. Merge feature into main locally
# 2. Security audit (see checklist above)
# 3. Push to public fork
git push origin main

# 4. Create PR on GitHub
# From: ArtemisArchitect/AntigravityManager
# To: Draculabo/AntigravityManager
```

---

## 🗺️ Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Flow                         │
└─────────────────────────────────────────────────────────────┘

1. Fetch Updates
   upstream/main ──fetch──> local/main ──push──> dev/main
                                        ──push──> origin/main

2. Feature Development (Private)
   local/main ─branch─> feature/x
   ├─ commit, commit, commit
   └─ push dev feature/x  (WIP, experimental)

3. Copilot SWE Work (Private)
   dev/feature/x ─PR─> dev/feature/x-copilot
   ├─ AI makes changes
   ├─ fetch locally
   ├─ test
   └─push dev feature/x

4. Public Release (Selective)
   ├─ Security audit
   ├─ Clean commit history
   ├─ push origin feature/x
   └─ PR to upstream/main

5. Maintenance
   ├─ Weekly sync upstream → origin
   └─ Daily backup to dev
```

---

## 🔑 Security Best Practices

### ❌ NEVER Commit

- Database files (`*.db`, `*.sqlite`)
- Configuration with credentials (`gui_config.json`, `.env`)
- API keys or tokens
- Encryption keys (`.keys/`, `*.pem`)
- User data directories (`data/`, `.antigravity-agent/`)
- Log files that may contain tokens
- Backup files (`*.bak`, `backups/`)

### ✅ ALWAYS Commit

- Source code (`src/`)
- Tests (`tests/`)
- Documentation (`*.md`)
- Configuration templates (`.env.example`)
- Package definitions (`package.json`, `package-lock.json`)
- Build configurations (`tsconfig.json`, `vite.*.config.mts`)

### 🛡️ Double-Check Before Push

```powershell
# Run this before every push:
function Test-GitSecurity {
    Write-Host "🔍 Security Scan..." -ForegroundColor Cyan
    
    # Check for DB files
    $dbFiles = git diff --cached --name-only | Select-String "\.db$|\.sqlite$"
    if ($dbFiles) {
        Write-Host "❌ Database files detected!" -ForegroundColor Red
        return $false
    }
    
    # Check for env files
    $envFiles = git diff --cached --name-only | Select-String "^\.env|gui_config"
    if ($envFiles) {
        Write-Host "❌ Environment files detected!" -ForegroundColor Red
        return $false
    }
    
    # Check for potential secrets in diff
    $secrets = git diff --cached | Select-String "sk-|GOOGLE_API|CLIENT_SECRET|password|token|key.*:" -CaseSensitive
    if ($secrets) {
        Write-Host "⚠️  Potential secrets detected! Review carefully:" -ForegroundColor Yellow
        $secrets
        return $false
    }
    
    Write-Host "✅ Security scan passed" -ForegroundColor Green
    return $true
}

# Use before push
Test-GitSecurity
if ($?) {
    git push dev <branch>
}
```

---

## 📝 Quick Reference

### Common Commands

```powershell
# Daily Start
git fetch --all
git checkout main
git merge upstream/main
git push dev main

# New Feature
git checkout -b feature/name
# ... work ...
git push dev feature/name

# Security Check
git diff --cached
Test-GitSecurity

# Sync All Remotes
git push dev main
git push origin main
```

### Remote Aliases

```powershell
# Add to PowerShell profile for quick access
function Push-Dev { git push dev $(git branch --show-current) }
function Push-Origin { git push origin $(git branch --show-current) }
function Sync-Upstream { 
    git fetch upstream
    git checkout main
    git merge upstream/main
    git push dev main
}

# Usage:
Push-Dev
Push-Origin
Sync-Upstream
```

---

## 📚 Additional Resources

- **Draculabo/AntigravityManager**: <https://github.com/Draculabo/AntigravityManager>
- **ArtemisArchitect/AntigravityManager** (fork): <https://github.com/ArtemisArchitect/AntigravityManager>
- **ArtemisArchitect/DEV-AntigravityManager** (private): <https://github.com/ArtemisArchitect/DEV-AntigravityManager>
- **PR #1 Docker Support**: <https://github.com/ArtemisArchitect/AntigravityManager/pull/1>

---

## 🆘 Emergency Contacts

**If credentials are exposed**:

1. Immediately rotate all affected credentials
2. Review git history for exposure extent
3. Document incident in `Issues.md`
4. Update this workflow if new protections needed
