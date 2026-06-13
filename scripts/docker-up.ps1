#!/usr/bin/env pwsh
# Ensure the Docker daemon is running, starting it in the background if it isn't.
#
# The local Supabase stack (started by dev-up.ps1) needs Docker up first. This script
# is idempotent: if the daemon already answers it returns immediately, otherwise it
# launches Docker Desktop headless and polls until the daemon is ready.
#
# Cross-platform (PowerShell Core on macOS/Linux/Windows). Requires the `docker` CLI.

$ErrorActionPreference = 'Stop'

function Test-DockerDaemon {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI not found on PATH. Install Docker Desktop (https://www.docker.com/products/docker-desktop/).'
}

if (Test-DockerDaemon) {
    Write-Host '==> Docker already running.' -ForegroundColor Green
    return
}

Write-Host '==> Starting Docker in the background...' -ForegroundColor Cyan
if ($IsMacOS) {
    # -g: do not bring the app to the foreground; -a: launch the named application.
    open -ga Docker
} elseif ($IsWindows) {
    $exe = Join-Path $Env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path $exe)) { throw "Docker Desktop not found at $exe. Start Docker manually." }
    Start-Process -FilePath $exe
} else {
    throw 'Cannot auto-start Docker on this OS. Start the Docker daemon manually (e.g. `sudo systemctl start docker`).'
}

$deadline = (Get-Date).AddSeconds(120)
while (-not (Test-DockerDaemon)) {
    if ((Get-Date) -gt $deadline) { throw 'Docker did not become ready within 120s.' }
    Start-Sleep -Seconds 2
}
Write-Host '==> Docker is up.' -ForegroundColor Green
