@echo off
title CommissionTracker - Servidor de desarrollo
REM Agrega Node al PATH de esta sesion (evita el error "node no se reconoce")
set "PATH=C:\Program Files\nodejs;%PATH%"
REM Se ubica en la carpeta de este .bat, sin importar desde donde se ejecute
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ============================================================
  echo  No se encontro Node.js en "C:\Program Files\nodejs".
  echo  Instalalo desde https://nodejs.org (version LTS) y reintenta.
  echo ============================================================
  pause
  exit /b 1
)

if not exist node_modules (
  echo ============================================================
  echo  Instalando dependencias por primera vez (~1 min)...
  echo ============================================================
  call npm install
)

echo.
echo ============================================================
echo  Servidor iniciando. Abri esta direccion en el navegador:
echo.
echo      http://localhost:5173
echo.
echo  Para frenar el servidor: Ctrl + C en esta ventana.
echo ============================================================
echo.
call npm run dev
pause
