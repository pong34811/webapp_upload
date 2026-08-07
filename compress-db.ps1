param(
    [string]$SourcePath = "backend\db.sqlite3",
    [string]$ZipPath = "backend\db.sqlite3.zip"
)

if (-not (Test-Path $SourcePath)) {
    Write-Error "ไม่พบไฟล์: $SourcePath"
    exit 1
}

$TempCopy = $SourcePath + "_copy"
Copy-Item $SourcePath $TempCopy -Force

try {
    Compress-Archive -Path $TempCopy -DestinationPath $ZipPath -Force
    Write-Host "Compressed: $SourcePath → $ZipPath ($(Get-Item $ZipPath).Length bytes)"
}
finally {
    if (Test-Path $TempCopy) { Remove-Item $TempCopy -Force }
}