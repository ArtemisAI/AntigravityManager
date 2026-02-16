#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Install Antigravity Manager as a Windows Service using NSSM

.DESCRIPTION
    This script installs and configures Antigravity Manager as a persistent
    Windows service that starts automatically and survives reboots.

.NOTES
    Requires: NSSM (Non-Sucking Service Manager)
    Install NSSM: choco install nssm
    Or download: https://nssm.cc/download
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$AppPath = "",
    
    [Parameter(Mandatory = $false)]
    [string]$WorkingDir = (Get-Location).Path,
    
    [Parameter(Mandatory = $false)]
    [string]$LogDir = "C:\Logs\AntigravityManager",
    
    [switch]$Uninstall
)

$ServiceName = "AntigravityManager"
$ErrorActionPreference = "Stop"

# Colors
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Cyan }
function Write-Error-Custom { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }

# Check if NSSM is installed
try {
    $null = Get-Command nssm -ErrorAction Stop
}
catch {
    Write-Error-Custom "NSSM not found in PATH"
    Write-Info "Install NSSM:"
    Write-Host "  Option 1: choco install nssm" -ForegroundColor Yellow
    Write-Host "  Option 2: Download from https://nssm.cc/download" -ForegroundColor Yellow
    exit 1
}

# Uninstall if requested
if ($Uninstall) {
    Write-Info "Uninstalling service: $ServiceName"
    
    $status = nssm status $ServiceName 2>&1
    if ($LASTEXITCODE -eq 0) {
        nssm stop $ServiceName
        nssm remove $ServiceName confirm
        Write-Success "Service uninstalled successfully"
    }
    else {
        Write-Info "Service not installed"
    }
    exit 0
}

# Detect application path
if (-not $AppPath) {
    # Check for packaged app
    $packagedPath = Join-Path $WorkingDir "out\antigravity-manager-win32-x64\antigravity-manager.exe"
    
    if (Test-Path $packagedPath) {
        $AppPath = $packagedPath
        Write-Info "Found packaged app: $AppPath"
    }
    else {
        Write-Error-Custom "Packaged application not found"
        Write-Info "Build the app first: npm run package"
        Write-Info "Or specify path manually: -AppPath 'C:\path\to\app.exe'"
        exit 1
    }
}

# Verify app exists
if (-not (Test-Path $AppPath)) {
    Write-Error-Custom "Application not found: $AppPath"
    exit 1
}

# Create log directory
Write-Info "Creating log directory: $LogDir"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Check if service already exists
$existingService = nssm status $ServiceName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Info "Service already exists. Stopping and removing..."
    nssm stop $ServiceName
    nssm remove $ServiceName confirm
}

# Install service
Write-Info "Installing service: $ServiceName"
Write-Info "App path: $AppPath"
Write-Info "Working directory: $WorkingDir"

nssm install $ServiceName "$AppPath"

# Configure service
Write-Info "Configuring service..."

# Working directory
nssm set $ServiceName AppDirectory "$WorkingDir"

# Logging
nssm set $ServiceName AppStdout "$LogDir\stdout.log"
nssm set $ServiceName AppStderr "$LogDir\stderr.log"
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateOnline 1
nssm set $ServiceName AppRotateBytes 10485760  # 10MB rotation

# Auto-restart configuration
nssm set $ServiceName AppThrottle 1500
nssm set $ServiceName AppExit Default Restart
nssm set $ServiceName AppRestartDelay 5000

# Service description
nssm set $ServiceName Description "Antigravity Manager - VPN Account Management & Monitoring"
nssm set $ServiceName DisplayName "Antigravity Manager"

# Start mode
nssm set $ServiceName Start SERVICE_AUTO_START

Write-Success "Service installed successfully!"

# Start service
Write-Info "Starting service..."
nssm start $ServiceName

Start-Sleep -Seconds 2

# Check status
$status = nssm status $ServiceName
if ($status -match "SERVICE_RUNNING") {
    Write-Success "Service is running!"
}
else {
    Write-Error-Custom "Service failed to start"
    Write-Info "Check logs at: $LogDir"
    Write-Info "Status: $status"
    exit 1
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host " Service Installation Complete" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name:  " -NoNewline; Write-Host $ServiceName -ForegroundColor Yellow
Write-Host "Status:        " -NoNewline; Write-Host "Running" -ForegroundColor Green
Write-Host "Startup Type:  " -NoNewline; Write-Host "Automatic" -ForegroundColor Yellow
Write-Host "Log Directory: " -NoNewline; Write-Host $LogDir -ForegroundColor Yellow
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  View status:   " -NoNewline; Write-Host "nssm status $ServiceName" -ForegroundColor White
Write-Host "  Stop service:  " -NoNewline; Write-Host "nssm stop $ServiceName" -ForegroundColor White
Write-Host "  Start service: " -NoNewline; Write-Host "nssm start $ServiceName" -ForegroundColor White
Write-Host "  Restart:       " -NoNewline; Write-Host "nssm restart $ServiceName" -ForegroundColor White
Write-Host "  Configure:     " -NoNewline; Write-Host "nssm edit $ServiceName" -ForegroundColor White
Write-Host "  Uninstall:     " -NoNewline; Write-Host ".\install-service.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
Write-Host "View Logs:" -ForegroundColor Cyan
Write-Host "  Get-Content $LogDir\stdout.log -Tail 20 -Wait" -ForegroundColor White
Write-Host ""
