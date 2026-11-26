# Deploy Generali OneForm full Node/API package to VibeHost (Windows PowerShell)
# Requires the VibeHost Node runtime to be enabled for your account/app.
$ErrorActionPreference = 'Stop'
$app = 'generali-oneform-tera-kinabalu'
Write-Host '== Generali OneForm: VibeHost Node deployment ==' -ForegroundColor Cyan
if (-not (Get-Command vibehost -ErrorAction SilentlyContinue)) {
  Write-Host 'VibeHost CLI not found. Install it from official VibeHost documentation, restart PowerShell, then run this script again.' -ForegroundColor Yellow
  Write-Host 'Docs: https://docs.vibehost.com/guides/quickstart/'
  exit 1
}
try { vibehost whoami | Out-Null } catch {
  Write-Host 'Sign-in required. Starting VibeHost login...' -ForegroundColor Yellow
  vibehost login
}
Write-Host 'Checking project files...'
if (-not (Test-Path '.\server.js') -or -not (Test-Path '.\package.json') -or -not (Test-Path '.\public\index.html')) {
  throw 'Run this script from the extracted Generali OneForm FULL NODE package root.'
}
Write-Host 'Deploying as Node runtime (not static)...' -ForegroundColor Cyan
vibehost deploy . --app $app --runtime node --build server
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Deploy did not complete. If runtime=node is rejected, your VibeHost account may not have Node runtime beta access. Do not deploy the full-stack package as static and expect APIs to work.' -ForegroundColor Red
  exit $LASTEXITCODE
}
Write-Host 'Deploy command returned success. Open the production URL and test routes; deployment success alone is not production readiness.' -ForegroundColor Green
Write-Host 'Production app: https://generali-oneform-tera-kinabalu.vibehost.space'
