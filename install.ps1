# DSH liquid glass installer. Modified by SuperSgdk on 2026-10-01.
# Installs into the selected profile; backs up patch and manifest first.
param(
    [string]$Source = 'https://github.com/SuperSgdk/DSH-Liquid-Glass-Theme',
    [string]$Version = 'latest',
    [string]$DshHome = $env:DSH_HOME,
    [string]$Profile = 'web'
)
$ErrorActionPreference = 'Stop'
if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid profile name.' }
$profileDir = [IO.Path]::GetFullPath((Join-Path $DshHome "profiles\$Profile"))
if (-not (Test-Path -LiteralPath $profileDir -PathType Container)) {
    throw "Profile does not exist: $profileDir. Initialize it in DSH first."
}
$plugin = 'dsh-liquid-glass-theme'
$legacy = '@deepseek-ai/dsh-client-ui-aqua'
$patchFile = Join-Path $profileDir 'cordis.patch.yml'
$manifestFile = Join-Path $profileDir 'package.json'
$linkPath = Join-Path $profileDir "node_modules\$plugin"
if (-not [IO.Path]::GetFullPath($linkPath).StartsWith($profileDir + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Plugin link escaped the selected profile.'
}

if ($Source -match '^https?://github\.com/([^/]+/[^/]+?)(?:\.git)?/?$') {
    $slug = $Matches[1]
    $ref = $Version
    if ($ref -eq 'latest') {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$slug/releases/latest" -TimeoutSec 30
        $ref = $release.tag_name
        if (-not $ref) { throw 'No published release. Use a known tag or -Version main.' }
    }
    if ($ref -notmatch '^[a-zA-Z0-9._/-]+$' -or $ref -match '\.\.') { throw 'Invalid source ref.' }
    $kind = if ($ref -match '^v\d+\.\d+') { 'tags' } else { 'heads' }
    $stage = Join-Path $DshHome ("plugins\$plugin\" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    $archive = Join-Path $stage 'source.zip'
    Invoke-WebRequest -Uri "https://github.com/$slug/archive/refs/$kind/$ref.zip" -OutFile $archive -TimeoutSec 60 -UseBasicParsing
    Expand-Archive -LiteralPath $archive -DestinationPath $stage
    $sourceDir = Get-ChildItem -LiteralPath $stage -Directory | Select-Object -First 1
    if (-not $sourceDir) { throw 'Archive has no source directory.' }
    $src = $sourceDir.FullName
    Remove-Item -LiteralPath $archive
} elseif (Test-Path -LiteralPath $Source -PathType Container) {
    $src = (Resolve-Path -LiteralPath $Source).Path
} else { throw 'Source must be a local directory or a GitHub repository URL.' }

$packageFile = Join-Path $src 'package.json'
if (-not (Test-Path -LiteralPath $packageFile)) { throw 'Source has no package.json.' }
$package = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
if ($package.name -ne $plugin) { throw "Unexpected package name: $($package.name)" }
foreach ($file in @('lib\client.js', 'lib\index.js', 'LICENSE', 'NOTICE')) {
    if (-not (Test-Path -LiteralPath (Join-Path $src $file))) { throw "Source is missing $file. Build it first." }
}
$currentLink = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
if ($currentLink -and -not $currentLink.LinkType) {
    throw "Refusing to replace an ordinary directory: $linkPath. Keep or move it yourself first."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupDir = Join-Path $profileDir "backups\liquid-glass-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($file in @($patchFile, $manifestFile)) {
    if (Test-Path -LiteralPath $file) { Copy-Item -LiteralPath $file -Destination $backupDir }
}
$oldTarget = if ($currentLink) { [string](@($currentLink.Target)[0]) } else { '' }
[ordered]@{ linkPath = $linkPath; previousTarget = $oldTarget; installedSource = $src } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupDir 'link.json') -Encoding UTF8
Write-Host "Backup: $backupDir"

$patch = if (Test-Path -LiteralPath $patchFile) { Get-Content -LiteralPath $patchFile -Raw } else { '' }
if ($null -eq $patch) { $patch = '' }
# DSH's initial empty array may follow header comments. Remove that array
# before writing list entries, while keeping every comment.
$patch = $patch -replace '(?m)^[ \t]*\[[ \t]*\][ \t]*\r?\n?', ''
# Only an active name line is migrated; comments and other plugins survive.
$legacyPattern = '(?m)^([ \t]*name:[ \t]*)(["' + "'" + ']?)' + [regex]::Escape($legacy) + '\2([ \t]*(?:#.*)?\r?)$'
$patch = [regex]::Replace($patch, $legacyPattern, '${1}' + "'$plugin'" + '${3}')
$registeredPattern = '(?m)^[ \t]*name:[ \t]*["' + "'" + ']?' + [regex]::Escape($plugin) + '["' + "'" + ']?[ \t]*(?:#.*)?\r?$'
if ($patch -notmatch $registeredPattern) {
    $base = ($patch -replace '(?s)^\s*\[\s*\]\s*$', '').TrimEnd()
    $entry = "- insert:`n    - id: liquid-glass-theme`n      name: '$plugin'`n"
    $patch = if ($base) { $base + "`n`n" + $entry } else { $entry }
}
$manifest = if (Test-Path -LiteralPath $manifestFile) { Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json } else {
    [pscustomobject]@{ name = "dsh-profile-$Profile"; private = $true }
}
if (-not $manifest.dependencies) { $manifest | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force }
$manifest.dependencies.PSObject.Properties.Remove($legacy)
$manifest.dependencies | Add-Member -NotePropertyName $plugin -NotePropertyValue ('link:' + $src.Replace('\', '/')) -Force

try {
    New-Item -ItemType Directory -Path (Split-Path $linkPath -Parent) -Force | Out-Null
    if ($currentLink) { [IO.Directory]::Delete($linkPath) }
    New-Item -ItemType Junction -Path $linkPath -Target $src | Out-Null
    $manifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $manifestFile -Encoding UTF8
    Set-Content -LiteralPath $patchFile -Value $patch -Encoding UTF8
} catch {
    # Undo just this transaction, leaving the downloaded/source directories intact.
    $failedLink = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
    if ($failedLink -and $failedLink.LinkType) { [IO.Directory]::Delete($linkPath) }
    if ($oldTarget) { New-Item -ItemType Junction -Path $linkPath -Target $oldTarget | Out-Null }
    foreach ($file in @($patchFile, $manifestFile)) {
        $saved = Join-Path $backupDir (Split-Path $file -Leaf)
        if (Test-Path -LiteralPath $saved) { Copy-Item -LiteralPath $saved -Destination $file -Force }
        elseif (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
    }
    throw
}
Write-Host 'Installed DSH液态玻璃皮肤插件. Restart this DSH profile to load it.' -ForegroundColor Green
Write-Host "Source: $src"
Write-Host "To restore: copy the backup patch and package.json back, and restore the junction described in link.json."
