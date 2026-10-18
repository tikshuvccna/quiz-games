@echo off
chcp 65001 >nul
title Quiz Games Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

rem One-time: let phones on the WiFi reach the server (Windows asks for permission once)
netsh advfirewall firewall show rule name="Quiz Games 3000" >nul 2>nul
if errorlevel 1 (
  echo Allowing phones to connect - approve the Windows prompt...
  powershell -NoProfile -Command "Start-Process netsh -Verb RunAs -Wait -ArgumentList 'advfirewall firewall add rule name=\"Quiz Games 3000\" dir=in action=allow protocol=TCP localport=3000'" >nul 2>nul
)

rem Open the host screen in the browser once the server is up
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000/host.html"

echo.
echo Server is running. Close this window to stop it.
echo.
node server/index.js
pause
