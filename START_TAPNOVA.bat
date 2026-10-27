@echo off
cd /d "%~dp0"
if exist "release\desktop-v4\win-unpacked\TAPNOVA.exe" (
 start "" "release\desktop-v4\win-unpacked\TAPNOVA.exe"
 exit /b 0
)
if exist "release\desktop\win-unpacked\TAPNOVA.exe" (
 start "" "release\desktop\win-unpacked\TAPNOVA.exe"
 exit /b 0
)
if not exist "release\TAPNOVA\TAPNOVA.exe" (
 echo Brak pliku aplikacji. Uruchom BUILD_TAPNOVA.bat.
 pause
 exit /b 1
)
start "" "release\TAPNOVA\TAPNOVA.exe"
