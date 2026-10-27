@echo off
setlocal
cd /d "%~dp0"
where dotnet >nul 2>&1
if errorlevel 1 (
 echo Zainstaluj .NET 8 SDK: https://dotnet.microsoft.com/download/dotnet/8.0
 pause
 exit /b 1
)
dotnet publish MSP2TOOL.Desktop.csproj -c Release -r win-x64 --self-contained true -o release\TAPNOVA
if errorlevel 1 (
 echo Nie udalo sie zbudowac TAPNOVA. Sprawdz komunikaty powyzej.
 pause
 exit /b 1
)
echo TAPNOVA - created by 1TapGod
echo Gotowe: release\TAPNOVA\TAPNOVA.exe
pause
