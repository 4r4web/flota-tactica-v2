# Expone la beta local con un túnel gratuito de Cloudflare en Windows.
#
# Uso (PowerShell, en la raíz del proyecto):
#   .\scripts\tunnel.ps1
#   .\scripts\tunnel.ps1 -Port 8080
#
param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$toolsDir = Join-Path $env:LOCALAPPDATA 'flota-tactica'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$cloudflared = Join-Path $toolsDir 'cloudflared.exe'

if (-not (Test-Path $cloudflared)) {
  $found = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($found) {
    $cloudflared = $found.Source
  } else {
    Write-Host "Descargando cloudflared..."
    Invoke-WebRequest `
      -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
      -OutFile $cloudflared
  }
}

Write-Host ""
Write-Host "Exponiendo http://localhost:$Port"
Write-Host "Copia la URL https://....trycloudflare.com que aparezca. Ctrl+C para cerrar."
Write-Host ""

& $cloudflared tunnel --url "http://localhost:$Port" --no-autoupdate
