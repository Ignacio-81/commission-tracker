@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Publicando CommissionTracker en GitHub
echo ============================================
echo.

REM Limpia un lock de git que pudo quedar por OneDrive
if exist ".git\index.lock" del /f /q ".git\index.lock"

REM Agrega TODOS los cambios (app React, workflow, configs)
git add -A
git commit -m "Deploy app React (v1/v2) a GitHub Pages via Actions"
git push origin main

echo.
echo ============================================
echo   Push terminado.
echo.
echo   FALTA UN PASO MANUAL (una sola vez):
echo   GitHub - Settings - Pages - Build and deployment
echo   En "Source" elegi:  GitHub Actions
echo.
echo   Despues, en la pestana Actions, espera a que el
echo   workflow quede en verde. La web queda en:
echo   https://ignacio-81.github.io/commission-tracker/
echo ============================================
echo.
pause
