@echo off
title Generali OneForm
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or later is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
start "" http://localhost:3000
node server.js
pause
