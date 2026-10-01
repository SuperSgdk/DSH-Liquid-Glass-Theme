# Build and package this checkout for GitHub Release. Does not publish to npm.
param()
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    pnpm run check
    if ($LASTEXITCODE -ne 0) { throw 'Build or checks failed.' }
    pnpm pack
    if ($LASTEXITCODE -ne 0) { throw 'Package creation failed.' }
} finally { Pop-Location }
