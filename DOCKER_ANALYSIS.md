# Docker Deployment Analysis - PR #1 Review

**PR**: <https://github.com/ArtemisArchitect/AntigravityManager/pull/1>  
**Focus**: Headless proxy server deployment with credential sharing strategy  
**Analysis Date**: 2026-02-12

---

## 📋 Executive Summary

The PR introduces **Docker containerization** for the NestJS proxy service, enabling **headless deployment** separate from the Electron GUI. Your proposed strategy to **mount host credentials into the container** is architecturally sound and offers significant operational benefits.

### ✅ Key Capabilities Added

1. **Standalone NestJS Proxy** (`src/server/standalone.ts`)
   - Runs without Electron dependencies
   - Pure HTTP/gRPC proxy service
   - Independent lifecycle from GUI

2. **Multi-stage Dockerfile**
   - `production`: Headless proxy (recommended)
   - `gui`: Electron + X11 (dev only, requires `privileged: true`)

3. **Volume-based Persistence**
   - Data directory mounted as volume
   - OAuth credentials stored in container
   - File-based encryption (keytar unavailable in container)

4. **OAuth Flow via Host Browser**
   - Container exposes port 8888 for OAuth callback
   - User opens `localhost:8888/auth/start` on host
   - OAuth redirect back to `localhost:8888/oauth-callback`
   - Token stored in mounted volume

---

## 🎯 Your Proposed Architecture

### Strategy: Shared Credential Volume

```
┌─────────────────────────────────────────────────┐
│             Host Machine (Windows)              │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Antigravity Manager (Native Electron)   │  │
│  │  - Full GUI Application                  │  │
│  │  - Account Management                    │  │
│  │  - System Tray                           │  │
│  │  - Data: C:\Users\...\Antigravity\       │──┼──┐
│  └──────────────────────────────────────────┘  │  │
│                                                 │  │
│  ┌──────────────────────────────────────────┐  │  │
│  │  Docker Container (Proxy Service)        │  │  │
│  │  - Headless NestJS Proxy                 │  │  │
│  │  - Port 8045 (API Proxy)                 │  │  │
│  │  - Port 8888 (OAuth Callback)            │  │  │
│  │  - Mounted: /app/data ←──────────────────┼──┘  │
│  │    → C:\Users\...\Antigravity\           │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  Shared Data Directory:                           │
│  ├─ cloud_accounts.db  (SQLite)                   │
│  ├─ gui_config.json                               │
│  └─ .keys/ (encryption keys)                      │
└───────────────────────────────────────────────────┘
```

### Data Flow

1. **GUI (Native)** manages accounts via UI
2. **Container (Proxy)** reads same `cloud_accounts.db` via mounted volume
3. **OAuth tokens** shared automatically
4. **Encryption keys** shared via mounted `.keys/` directory

---

## ✅ Benefits of This Approach

### 1. **Zero Credential Duplication**

- Single source of truth: `cloud_accounts.db`
- Accounts added in GUI instantly available to proxy
- No manual sync required

### 2. **Simplified Operations**

- Manage accounts via native GUI (better UX)
- Proxy container is stateless (restart-safe)
- Consistent encryption across both environments

### 3. **Development Workflow**

- Test proxy changes in container without affecting GUI
- Hot-reload proxy service while GUI runs
- Separate deployment cycles

### 4. **Production Flexibility**

- Deploy proxy to remote server with volume sync
- Scale proxy horizontally (multiple containers, same DB)
- Containerized environments (Kubernetes, Docker Swarm)

---

## ⚠️ Challenges & Mitigations

### Challenge 1: SQLite Locking (Write Conflicts)

**Problem**: Both GUI and container accessing same SQLite DB simultaneously

**Risk Level**: 🟡 Medium (SQLite WAL mode helps, but not perfect)

**Mitigation**:

```yaml
# docker-compose.yml
services:
  proxy:
    volumes:
      - C:\Users\Laptop\AppData\Roaming\Antigravity:/app/data:ro  # READ-ONLY
```

**Recommended Pattern**:

- **GUI**: Read/Write (manages accounts)
- **Container**: Read-only (consumes accounts)

**Implementation**:

```typescript
// src/server/standalone.ts
if (process.env.READONLY_MODE === 'true') {
  // Disable account creation/modification endpoints
  // Only allow account listing and token reading
}
```

---

### Challenge 2: File-based Encryption Key Sharing

**Problem**: Keytar (system keychain) unavailable in container

**Current PR Solution**: File-based fallback in container

**Your Setup**: Share encryption keys via mounted volume

**Security Considerations**:

✅ **Pros**:

- Simple to implement
- Works across environments
- Consistent encryption

❌ **Cons**:

- Encryption keys on disk (less secure than keychain)
- Container compromised = keys compromised

**Best Practice**:

```bash
# Host encryption keys location
C:\Users\Laptop\AppData\Roaming\Antigravity\.keys\

# Mount with restrictive permissions
docker run -v C:\Users\...\Antigravity\.keys:/app/data/.keys:ro
```

---

### Challenge 3: OAuth Callback Port Conflicts

**Problem**: Both GUI and container want port 8888

**Solution 1**: Use different ports

```yaml
# docker-compose.yml
services:
  proxy:
    ports:
      - "8889:8888"  # Map container 8888 to host 8889
    environment:
      - OAUTH_CALLBACK_PORT=8889
```

**Solution 2**: Run only one OAuth server at a time

- GUI handles OAuth (recommended)
- Container reads existing tokens only

---

### Challenge 4: Windows File Permissions in Docker

**Problem**: Windows volume mounts don't preserve Linux permissions

**Impact**: Minimal (Node.js handles this gracefully)

**Workaround**: Ensure container runs as non-root user matching host UID/GID

---

## 🚀 Recommended Implementation

### Step 1: Modify PR to Support `ANTIGRAVITY_DATA_DIR`

**Already implemented in PR**:

```typescript
// src/utils/paths.ts (from PR)
export function getAppDataDir(): string {
  // Check env var first
  if (process.env.ANTIGRAVITY_DATA_DIR) {
    return process.env.ANTIGRAVITY_DATA_DIR;
  }
  
  // Fall back to platform defaults
  // ...
}
```

✅ This enables mounting host directory!

### Step 2: Docker Compose Configuration

**Create**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  antigravity-proxy:
    build:
      context: .
      dockerfile: Dockerfile
      target: production  # Headless NestJS only
    
    container_name: antigravity-proxy
    
    ports:
      - "8045:8045"  # Proxy API
      - "8889:8888"  # OAuth callback (avoid conflict with GUI)
    
    environment:
      # Point to mounted directory
      - ANTIGRAVITY_DATA_DIR=/app/data
      
      # Read-only mode (prevent DB writes from container)
      - READONLY_MODE=true
      
      # OAuth credentials (if needed for token refresh)
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      
      # Proxy configuration
      - PROXY_PORT=8045
      - NODE_ENV=production
    
    volumes:
      # Mount host Antigravity data directory
      - C:\Users\Laptop\AppData\Roaming\Antigravity:/app/data:ro
      
      # Optional: separate logs directory
      - ./logs:/app/logs
    
    restart: unless-stopped
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8045/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    networks:
      - antigravity-net

networks:
  antigravity-net:
    driver: bridge
```

### Step 3: Add Read-Only Mode to Standalone Server

**Modify**: `src/server/standalone.ts` (from PR)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { logger } from '../utils/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const port = process.env.PROXY_PORT || 8045;
  const readOnlyMode = process.env.READONLY_MODE === 'true';
  
  if (readOnlyMode) {
    logger.info('🔒 Starting in READ-ONLY mode');
    logger.info('   - Account creation DISABLED');
    logger.info('   - Account modification DISABLED');
    logger.info('   - Token reading ENABLED');
  }
  
  // Pass read-only flag to services
  app.useGlobalFilters(/* ... */);
  
  await app.listen(port);
  logger.info(`🚀 Proxy service running on port ${port}`);
}

bootstrap();
```

### Step 4: Health Check Endpoint

**Add**: `src/server/modules/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import { CloudAccountRepo } from '@/ipc/database/cloudHandler';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    try {
      // Verify database access
      const accounts = await CloudAccountRepo.getAccounts();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        accounts: accounts.length,
        readOnly: process.env.READONLY_MODE === 'true'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}
```

### Step 5: Usage

**Start GUI (Native)**:

```powershell
# Normal startup - manages accounts
npm start
```

**Start Proxy Container**:

```powershell
# Build and start proxy service
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check health
curl http://localhost:8045/health
```

**Test Proxy**:

```powershell
# List models (should use accounts from GUI)
curl http://localhost:8045/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🔐 Security Recommendations

### 1. Database Access Control

```yaml
# Use read-only mount
volumes:
  - C:\Users\...\Antigravity:/app/data:ro  # ← READ-ONLY
```

### 2. Encryption Key Protection

```yaml
# Separate encryption keys from main data
volumes:
  - C:\Users\...\Antigravity\cloud_accounts.db:/app/data/cloud_accounts.db:ro
  - C:\Users\...\Antigravity\.keys:/app/data/.keys:ro
```

### 3. Network Isolation

```yaml
# Use custom network
networks:
  antigravity-net:
    internal: true  # No external access except exposed ports
```

### 4. Container Hardening

```dockerfile
# In Dockerfile
USER node  # Run as non-root
WORKDIR /app
RUN chown -R node:node /app
```

---

## 📊 Deployment Scenarios

### Scenario 1: Local Development (Your Current Setup)

```
┌─────────────────────────────────────┐
│  Windows Host                       │
│  ├─ GUI (native) - Manages accounts │
│  └─ Proxy (container) - Read-only   │
└─────────────────────────────────────┘
```

**Use Case**: Test proxy changes without affecting GUI

**Command**:

```powershell
docker-compose -f docker-compose.prod.yml up -d
```

---

### Scenario 2: Remote Proxy Server

```
┌──────────────────┐          ┌──────────────────┐
│  Local Machine   │          │  Remote Server   │
│  GUI (manages)   │  rsync   │  Proxy (reads)   │
│  Credentials ────┼─────────>│  Container       │
└──────────────────┘          └──────────────────┘
```

**Use Case**: Run proxy on VPS, manage accounts locally

**Implementation**:

```bash
# Sync credentials to remote server
rsync -avz C:\Users\...\Antigravity\ user@remote:/data/antigravity/

# On remote server
docker-compose -f docker-compose.prod.yml up -d
```

---

### Scenario 3: Multi-Container Proxy Farm

```
┌─────────────────┐
│  Shared Volume  │
│  (NFS/SMB)      │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
  Proxy1   Proxy2   Proxy3   Proxy4
  :8045    :8046    :8047    :8048
```

**Use Case**: Load-balanced proxy deployment

**Implementation**:

```yaml
# docker-compose.scale.yml
services:
  proxy:
    # ... same config ...
    deploy:
      replicas: 4
```

---

## 🎬 Next Steps

### 1. Test the PR Locally

```powershell
# Clone the PR branch
git fetch origin pull/1/head:docker-support
git checkout docker-support

# Build and test
docker-compose up -d

# Verify proxy works
curl http://localhost:8045/health
```

### 2. Add Read-Only Mode

**File**: `src/server/standalone.ts`

- Add `READONLY_MODE` environment variable
- Disable account modification endpoints
- Keep token reading enabled

### 3. Update DEPLOYMENT.md

Add Docker deployment section with:

- Prerequisites (Docker, Docker Compose)
- Configuration guide
- Volume mount instructions
- Security best practices

### 4. Production Deployment Checklist

- [ ] Set up volume backups (cloud_accounts.db)
- [ ] Configure log rotation
- [ ] Set up monitoring (health checks)
- [ ] Document credential sync process
- [ ] Test failover scenarios
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Enable HTTPS with Let's Encrypt

---

## 📝 Additional Recommendations

### 1. Add Volume Backup Script

**Create**: `scripts/backup-credentials.ps1`

```powershell
#Requires -RunAsAdministrator

$SourceDir = "$env:APPDATA\Antigravity"
$BackupDir = "C:\Backups\Antigravity\$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"

Write-Host "Backing up credentials..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $BackupDir -Force

# Copy database
Copy-Item "$SourceDir\cloud_accounts.db" -Destination $BackupDir
Copy-Item "$SourceDir\gui_config.json" -Destination $BackupDir

# Copy encryption keys if they exist
if (Test-Path "$SourceDir\.keys") {
    Copy-Item "$SourceDir\.keys" -Destination $BackupDir -Recurse
}

Write-Host "✅ Backup complete: $BackupDir" -ForegroundColor Green
```

### 2. Add Database Health Monitor

**Create**: `scripts/monitor-db-health.ps1`

```powershell
# Monitor for SQLite lock errors
$DbPath = "$env:APPDATA\Antigravity\cloud_accounts.db"

while ($true) {
    try {
        # Simple read test
        $conn = New-Object System.Data.SQLite.SQLiteConnection("Data Source=$DbPath")
        $conn.Open()
        $conn.Close()
        
        Write-Host "✓ Database accessible" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠ Database locked or error: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 10
}
```

### 3. Container Auto-Update

**Add to** `docker-compose.prod.yml`:

```yaml
services:
  proxy:
    # ... existing config ...
    labels:
      com.centurylinklabs.watchtower.enable: "true"
  
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
```

---

## 🏁 Conclusion

### Your Proposed Strategy: ✅ **EXCELLENT**

**Strengths**:

- ✅ Zero credential duplication
- ✅ Simplified management (GUI for accounts)
- ✅ Container for proxy only (correct separation of concerns)
- ✅ Leverages PR's `ANTIGRAVITY_DATA_DIR` support

**Key Implementation Points**:

1. Mount volume as **read-only** in container
2. Use **GUI for account management** only
3. Container **consumes** accounts, doesn't create them
4. Share **encryption keys** via same volume
5. Use different **OAuth callback port** (8889)

**Production-Ready Enhancements**:

- Add health check endpoint
- Implement read-only mode flag
- Set up automatic backups
- Configure monitoring/alerts
- Document deployment process

---

## 📚 References

- **PR**: <https://github.com/ArtemisArchitect/AntigravityManager/pull/1>
- **Docker Compose**: [docker-compose.prod.yml](#step-2-docker-compose-configuration)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Issues Log**: [Issues.md](Issues.md)

**Next Action**: Test the PR branch and verify volume mounting works as expected with your current credential directory.
