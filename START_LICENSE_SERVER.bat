@echo off
cd /d "%~dp0"
if not exist "license-server\.data\config.json" node license-server/setup.cjs
if errorlevel 1 goto failed
node license-server/server.cjs
:failed
pause
