$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root "..\frontend"
$spaDest = Join-Path $root "uploads\static\spa"

Write-Output "Building frontend..."
Push-Location $frontend
cmd /c "npm install && npm run build"
Pop-Location

Write-Output "Copying dist -> $spaDest"
if (Test-Path $spaDest) { Remove-Item $spaDest -Recurse -Force }
New-Item -ItemType Directory -Path $spaDest | Out-Null
Copy-Item (Join-Path $frontend "dist\*") $spaDest -Recurse -Force
Write-Output "Done."
