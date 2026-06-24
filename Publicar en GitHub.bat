@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Publicando CommissionTracker en GitHub
echo ============================================
echo.

REM Limpia un lock de git que pudo quedar (por OneDrive)
if exist ".git\index.lock" del /f /q ".git\index.lock"

git add CommissionTracker.html index.html
git commit -m "Mobile: optimizar para celular + index.html para GitHub Pages"
git push origin main

echo.
echo Listo. Si pidio usuario/contrasena, completalo y vuelve a correr.
echo.
pause
