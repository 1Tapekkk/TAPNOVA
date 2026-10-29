@echo off
cd /d "%~dp0"
call pnpm cloudflare:setup
pause
