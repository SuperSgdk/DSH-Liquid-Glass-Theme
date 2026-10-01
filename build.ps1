# Build this checkout only. Modified by SuperSgdk on 2026-10-01.
param([switch]$Install)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if ($Install) {
        pnpm install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    pnpm run check
    if ($LASTEXITCODE -ne 0) { throw 'Build or checks failed.' }
} finally { Pop-Location }
