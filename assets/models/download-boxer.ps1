$ErrorActionPreference = 'Stop'

$SourceUrl = 'https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/casual-character.glb'
$TargetPath = Join-Path $PSScriptRoot 'casual-character.glb'
$ExpectedGitBlobSha = 'f31ba8b389268d4df6005cc62d4d7011de728bce'

Write-Host 'Downloading the Quaternius CC0 casual character rig...'
Invoke-WebRequest -UseBasicParsing -Uri $SourceUrl -OutFile $TargetPath

$Bytes = [System.IO.File]::ReadAllBytes($TargetPath)
$Header = [System.Text.Encoding]::ASCII.GetBytes("blob $($Bytes.Length)`0")
$GitObject = New-Object byte[] ($Header.Length + $Bytes.Length)
[Array]::Copy($Header, 0, $GitObject, 0, $Header.Length)
[Array]::Copy($Bytes, 0, $GitObject, $Header.Length, $Bytes.Length)
$Hasher = [System.Security.Cryptography.SHA1]::Create()
try {
    $ActualGitBlobSha = (($Hasher.ComputeHash($GitObject) | ForEach-Object { $_.ToString('x2') }) -join '')
} finally {
    $Hasher.Dispose()
}

if ($ActualGitBlobSha -ne $ExpectedGitBlobSha) {
    Remove-Item -LiteralPath $TargetPath -Force
    throw "Model checksum mismatch. Expected Git blob $ExpectedGitBlobSha but received $ActualGitBlobSha. The downloaded file was removed."
}

Write-Host "Verified local boxer model: $TargetPath" -ForegroundColor Green
Write-Host "Git blob SHA-1: $ActualGitBlobSha"
