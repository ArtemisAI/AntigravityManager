# Deployment & Persistent Execution Guide

This guide covers different strategies for deploying Antigravity Manager with persistent execution across reboots and user sessions.

---

## 🎯 Deployment Strategies

### Strategy 1: Built-in Auto-Start (Recommended for Users)

**Best for**: Regular user deployment, desktop usage

The application **already includes** cross-platform auto-start functionality:

#### How it Works

- **Windows/macOS**: Uses native login item APIs (`app.setLoginItemSettings`)
- **Linux**: Creates `.desktop` file in `~/.config/autostart/`
- Launches automatically when user logs in
- Runs hidden in system tray

#### Enable Auto-Start

1. **Via UI**: Open Settings → Enable "Launch at startup"
2. **Via Config**: Edit `gui_config.json`:

   ```json
   {
     "auto_startup": true
   }
   ```

**Limitations**:

- ❌ Requires user login (not truly "persistent")
- ❌ Stops when user logs out
- ✅ Easy to enable/disable
- ✅ No admin rights needed

---

### Strategy 2: Windows Service with NSSM (Recommended for Servers)

**Best for**: Server deployment, always-on operation, headless environments

#### What is NSSM?

[NSSM (Non-Sucking Service Manager)](https://nssm.cc/) wraps any executable as a Windows Service, enabling:

- ✅ Runs without user login
- ✅ Survives user logoff/reboot
- ✅ Automatic restart on failure
- ✅ Service logging and monitoring

#### Installation Steps

**1. Download NSSM**

```powershell
# Via Chocolatey
choco install nssm

# Or download from https://nssm.cc/download
# Extract to C:\Tools\nssm\
```

**2. Build the Application**

```powershell
cd C:\Users\Laptop\Services\AntigravityManager
npm run package
```

**3. Install as Service**

```powershell
# Using packaged app (recommended)
nssm install AntigravityManager "C:\Users\Laptop\Services\AntigravityManager\out\antigravity-manager-win32-x64\antigravity-manager.exe"

# Or using development build
nssm install AntigravityManager "C:\Program Files\nodejs\node.exe" "C:\Users\Laptop\Services\AntigravityManager\node_modules\.bin\electron-forge" "start"
```

**4. Configure Service**

```powershell
# Set startup directory
nssm set AntigravityManager AppDirectory "C:\Users\Laptop\Services\AntigravityManager"

# Set environment variables
nssm set AntigravityManager AppEnvironmentExtra NODE_ENV=production

# Configure auto-restart
nssm set AntigravityManager AppThrottle 1500
nssm set AntigravityManager AppExit Default Restart

# Set logging
nssm set AntigravityManager AppStdout "C:\Logs\AntigravityManager\stdout.log"
nssm set AntigravityManager AppStderr "C:\Logs\AntigravityManager\stderr.log"

# Start service
nssm start AntigravityManager
```

**5. Manage Service**

```powershell
# Check status
nssm status AntigravityManager

# Stop service
nssm stop AntigravityManager

# Restart service
nssm restart AntigravityManager

# Remove service
nssm remove AntigravityManager confirm
```

#### NSSM GUI Configuration

```powershell
nssm edit AntigravityManager
```

Configure these tabs:

- **Application**: Executable path, arguments, startup directory
- **Details**: Display name, description, startup type
- **Log on**: Run as specific user (if needed)
- **I/O**: Redirect stdout/stderr to log files
- **Rotation**: Log file rotation settings
- **Environment**: Environment variables
- **Exit actions**: Restart on crash/exit
- **Process**: CPU affinity, priority

---

### Strategy 3: Task Scheduler (Windows Alternative)

**Best for**: User-less auto-start without NSSM

```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "C:\Users\Laptop\Services\AntigravityManager\out\antigravity-manager.exe"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AntigravityManager" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

---

### Strategy 4: systemd Service (Linux)

**Best for**: Linux server deployments

**1. Create Service File**

```bash
sudo nano /etc/systemd/system/antigravity-manager.service
```

**2. Service Configuration**

```ini
[Unit]
Description=Antigravity Manager
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/Services/AntigravityManager
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
```

**3. Enable and Start**

```bash
sudo systemctl daemon-reload
sudo systemctl enable antigravity-manager
sudo systemctl start antigravity-manager

# Check status
sudo systemctl status antigravity-manager

# View logs
sudo journalctl -u antigravity-manager -f
```

---

### Strategy 5: Docker Container (Cross-Platform)

**Best for**: Isolated deployment, containerized environments

**1. Create Dockerfile**

```dockerfile
FROM node:20-slim

# Install Electron dependencies
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xvfb \
    libgbm1 \
    libasound2

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# Run with virtual display
CMD ["xvfb-run", "-a", "npm", "start"]
```

**2. Build and Run**

```bash
docker build -t antigravity-manager .
docker run -d --name antigravity-manager \
  --restart unless-stopped \
  -v /path/to/data:/app/data \
  antigravity-manager
```

---

## 📊 Comparison Matrix

| Strategy | Auto-Start | User-less | Crash Recovery | Logging | Admin Required | Complexity |
|----------|------------|-----------|----------------|---------|----------------|------------|
| Built-in Auto-Start | ✅ | ❌ | ❌ | ⚠️ | ❌ | Low |
| NSSM (Windows) | ✅ | ✅ | ✅ | ✅ | ✅ | Medium |
| Task Scheduler | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | Low |
| systemd (Linux) | ✅ | ✅ | ✅ | ✅ | ✅ | Medium |
| Docker | ✅ | ✅ | ✅ | ✅ | ✅ | High |

---

## 🔧 Production Deployment Checklist

### Pre-Deployment

- [ ] Build production package: `npm run package`
- [ ] Test packaged application manually
- [ ] Configure logging directory (writable by service)
- [ ] Set up monitoring/alerting
- [ ] Document deployment-specific environment variables

### NSSM Deployment (Windows)

- [ ] Install NSSM to system PATH
- [ ] Create log directory: `C:\Logs\AntigravityManager\`
- [ ] Install service with appropriate user account
- [ ] Configure auto-restart on failure
- [ ] Set service to start automatically
- [ ] Test service start/stop/restart
- [ ] Verify logs are being written
- [ ] Test automatic restart after reboot

### Monitoring

- [ ] Set up log rotation (NSSM rotation or external tool)
- [ ] Monitor service health (Windows Event Viewer / Task Manager)
- [ ] Configure alerts for service failures
- [ ] Document troubleshooting procedures

### Security

- [ ] Run service as dedicated user (not SYSTEM)
- [ ] Restrict file permissions on installation directory
- [ ] Encrypt sensitive configuration files
- [ ] Enable Windows Firewall rules if needed

---

## 🐛 Troubleshooting

### Service Won't Start (NSSM)

```powershell
# Check event logs
Get-EventLog -LogName Application -Source "AntigravityManager" -Newest 10

# Check NSSM status
nssm status AntigravityManager

# View service configuration
nssm get AntigravityManager *

# Test executable manually
& "C:\path\to\antigravity-manager.exe"
```

### Service Crashes on Startup

1. Check log files in `C:\Logs\AntigravityManager\`
2. Verify working directory is set correctly
3. Ensure all dependencies are in PATH
4. Test with `nssm start AntigravityManager` and check output immediately

### Port Already in Use

```powershell
# Find process using port 8888 (auth server)
netstat -ano | findstr :8888

# Kill process if needed
taskkill /PID <pid> /F
```

---

## 📝 Example: Quick NSSM Setup Script

Save as `install-service.ps1`:

```powershell
#Requires -RunAsAdministrator

$ServiceName = "AntigravityManager"
$AppPath = "C:\Users\Laptop\Services\AntigravityManager\out\antigravity-manager-win32-x64\antigravity-manager.exe"
$WorkingDir = "C:\Users\Laptop\Services\AntigravityManager"
$LogDir = "C:\Logs\AntigravityManager"

# Create log directory
New-Item -ItemType Directory -Force -Path $LogDir

# Install service
nssm install $ServiceName $AppPath
nssm set $ServiceName AppDirectory $WorkingDir
nssm set $ServiceName AppStdout "$LogDir\stdout.log"
nssm set $ServiceName AppStderr "$LogDir\stderr.log"
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateOnline 1
nssm set $ServiceName AppRotateBytes 10485760  # 10MB
nssm set $ServiceName AppThrottle 1500
nssm set $ServiceName AppExit Default Restart

# Start service
nssm start $ServiceName

Write-Host "✅ Service installed and started!" -ForegroundColor Green
Write-Host "Check status: nssm status $ServiceName" -ForegroundColor Cyan
Write-Host "View logs: $LogDir" -ForegroundColor Cyan
```

Run:

```powershell
.\install-service.ps1
```

---

## 🔗 Additional Resources

- **NSSM**: <https://nssm.cc/>
- **Electron Packaging**: <https://www.electronforge.io/>
- **Windows Services**: <https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/sc-create>
- **systemd**: <https://www.freedesktop.org/software/systemd/man/systemd.service.html>
