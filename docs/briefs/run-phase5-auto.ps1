# Phase 5 -- FULLY AUTOMATED (no pauses between chunks)
# Usage: .\docs\briefs\run-phase5-auto.ps1
# This runs all 5 chunks back-to-back without stopping.
# Use this if you trust the briefs and want to walk away.

$ErrorActionPreference = "Stop"

$briefsDir = Join-Path $PSScriptRoot ""
if (-not $briefsDir) { $briefsDir = ".\docs\briefs\" }

$chunks = @(
    "phase5-chunk0-agents-md.md",
    "phase5-chunk1-memory-reliability.md",
    "phase5-chunk2-build-desk-scaffold.md",
    "phase5-chunk3-schema-and-api.md",
    "phase5-chunk4-docs-and-pr.md"
)

Write-Host "Phase 5: Build Desk Foundation -- FULL AUTO MODE" -ForegroundColor Cyan
Write-Host ""

# Ensure branch exists
$currentBranch = git branch --show-current
if ($currentBranch -ne "claude/phase-5-build-desk-foundation") {
    git fetch origin "claude/setup-malamute-mayhem-zkquO" 2>$null
    git checkout -b "claude/phase-5-build-desk-foundation" "origin/claude/setup-malamute-mayhem-zkquO" 2>$null
    if ($LASTEXITCODE -ne 0) {
        git checkout "claude/phase-5-build-desk-foundation" 2>$null
    }
}

$failed = @()

foreach ($chunk in $chunks) {
    $filePath = Join-Path $briefsDir $chunk

    if (-not (Test-Path $filePath)) {
        Write-Host "SKIP: $chunk not found" -ForegroundColor Red
        $failed += $chunk
        continue
    }

    Write-Host "--- Running: $chunk ---" -ForegroundColor Green

    $briefContent = Get-Content $filePath -Raw
    claude --print -p $briefContent --dangerously-skip-permissions

    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $chunk" -ForegroundColor Red
        $failed += $chunk
    } else {
        Write-Host "DONE: $chunk" -ForegroundColor Green
    }

    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
if ($failed.Count -eq 0) {
    Write-Host "All chunks completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Some chunks failed: $($failed -join ', ')" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
