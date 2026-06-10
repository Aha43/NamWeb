#!/usr/bin/env pwsh
# One-command dev launcher for NamWeb.
#
# Ensures everything NamWeb needs is in place, then starts the dev server:
#   1. npm dependencies installed
#   2. .env present (copied from .env.example)
#   3. local Supabase stack up on 127.0.0.1:54321 — it lives in the sibling
#      NamDesktop repo; started there with `supabase start` if not already running
#   4. `npm run dev`
#
# Cross-platform (PowerShell Core on macOS/Linux/Windows). Requires: node/npm,
# the Supabase CLI, and Docker running (for the Supabase stack).

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot                       # NamWeb repo root
$namDesktop = Join-Path (Split-Path -Parent $root) 'NamDesktop'
$dbHost = '127.0.0.1'
$dbPort = 54321

function Test-Port {
    param([string] $TargetHost, [int] $Port)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect($TargetHost, $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

# 1. Dependencies.
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host '==> Installing npm dependencies...' -ForegroundColor Cyan
    npm install
}

# 2. Environment file.
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
    Write-Host '==> Creating .env from .env.example...' -ForegroundColor Cyan
    Copy-Item (Join-Path $root '.env.example') $envFile
}

# 3. Supabase stack.
if (Test-Port -TargetHost $dbHost -Port $dbPort) {
    Write-Host "==> Supabase already running on ${dbHost}:${dbPort}." -ForegroundColor Green
} else {
    if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
        throw 'Supabase CLI not found on PATH. See NamDesktop/docs/features/supabase-poc/setup.md.'
    }
    if (-not (Test-Path (Join-Path $namDesktop 'supabase/config.toml'))) {
        throw "Cannot find the Supabase project at $namDesktop/supabase. Is NamDesktop a sibling of NamWeb?"
    }

    Write-Host '==> Starting the local Supabase stack (from NamDesktop)...' -ForegroundColor Cyan
    Push-Location $namDesktop
    try {
        supabase start
    } finally {
        Pop-Location
    }

    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Test-Port -TargetHost $dbHost -Port $dbPort)) {
        if ((Get-Date) -gt $deadline) { throw 'Supabase did not become ready within 120s.' }
        Start-Sleep -Seconds 2
    }
    Write-Host '==> Supabase is up.' -ForegroundColor Green
}

# 4. Launch the UI.
Write-Host '==> Launching NamWeb dev server...' -ForegroundColor Cyan
npm run dev
