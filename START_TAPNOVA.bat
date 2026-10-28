@echo off
cd /d "%~dp0"
if exist "release\4.1.0\win-unpacked\TAPNOVA.exe" (
 start "" "release\4.1.0\win-unpacked\TAPNOVA.exe"
 exit /b 0
)
if exist "release\desktop-workspace\win-unpacked\TAPNOVA.exe" (
 start "" "release\desktop-workspace\win-unpacked\TAPNOVA.exe"
 exit /b 0
)
if exist "release\desktop-comments\win-unpacked\TAPNOVA.exe" (
 start "" "release\desktop-comments\win-unpacked\TAPNOVA.exe"
 exit /b 0
)
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
