@echo off
chcp 65001 >nul
title Quiz Games Server
cd /d "%~dp0"

rem A ready-to-run copy ships its own Node.js in node\node.exe; otherwise use the installed one
set "NODE=node"
if exist "%~dp0node\node.exe" (
  set "NODE=%~dp0node\node.exe"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is not installed. Download it from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )
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
  echo.
  echo ============================================================
  echo   FIRST RUN - one-time Windows firewall setup
  echo ============================================================
  echo   Windows blocks other devices from reaching this computer.
  echo   To let students' phones join, this program will now:
  echo     1. Open port 3000 in the Windows firewall ^(inbound, TCP^)
  echo     2. Remove old Windows rules that block Node.js, if any
  echo   Windows will ask for administrator permission - click Yes.
  echo   This happens only once. Nothing else is changed.
  echo ============================================================
  echo.
  pause
  powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\setup-firewall.ps1\" -Port 3000'"
  netsh advfirewall firewall show rule name="Quiz Games 3000" >nul 2>nul
  if errorlevel 1 (
    echo.
    echo The firewall was NOT opened ^(permission was denied^).
    echo The program works on this computer only. To let phones join, run start.bat again and click Yes.
    echo.
  ) else (
    echo Done - phones on the same Wi-Fi can now connect.
    echo.
  )
)

rem Open the host screen in the browser once the server is up
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000/host.html"

echo.
echo Server is running. Close this window to stop it.
echo.
"%NODE%" server/index.js
pause
