@echo off
chcp 65001 >nul
title discover.me - server local
echo.
echo  Pornesc discover.me... se deschide in browser.
echo  Lasa aceasta fereastra deschisa cat folosesti aplicatia.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1"
echo.
pause
