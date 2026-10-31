$ErrorActionPreference = 'Stop'

$SourceUrl = 'https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/worker.glb'
$TargetPath = Join-Path $PSScriptRoot 'worker.glb'
$ExpectedSha256 = '9c28614f465b7dc105f908c20c22fc045f4b07caf8c5ef0e9f8049eceb6dd38d'

Write-Host 'Downloading the CC0 Quaternius boxer base model...'
Invoke-WebRequest -UseBasicParsing -Uri $SourceUrl -OutFile $TargetPath

$ActualSha256 = (Get-FileHash -Path $TargetPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualSha256 -ne $ExpectedSha256) {
    Remove-Item -LiteralPath $TargetPath -Force
    throw "Model checksum mismatch. Expected $ExpectedSha256 but received $ActualSha256. The downloaded file was removed."
}

Write-Host "Model saved and verified: $TargetPath" -ForegroundColor Green
Write-Host "SHA-256: $ActualSha256"
