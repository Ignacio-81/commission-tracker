@echo off
chcp 65001 >nul
title CommissionTracker - Verificacion de tasas y comisiones
REM Agrega Node al PATH de esta sesion (evita el error "node no se reconoce")
set "PATH=C:\Program Files\nodejs;%PATH%"
REM Se ubica en la carpeta de este .bat, sin importar desde donde se ejecute
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ============================================================
  echo  No se encontro Node.js en "C:\Program Files\nodejs".
  echo  Instalalo desde https://nodejs.org ^(version LTS^) y reintenta.
  echo ============================================================
  pause
  exit /b 1
)

echo ============================================================
echo   Verificando tasas, comisiones y rutas
echo ============================================================
echo.

node scripts\verify-rates.mjs
set RESULT=%ERRORLEVEL%

echo.
if %RESULT%==0 (
  echo ============================================================
  echo   OK - sin diferencias.
  echo ============================================================
) else (
  echo ============================================================
  echo   ATENCION - se encontraron diferencias ^(codigo %RESULT%^).
  echo.
  echo   Revisa la salida de arriba. Las causas tipicas son:
  echo     - Cambio de esquema en la API de CriptoYa
  echo     - Una comision del codigo que ya no coincide con
  echo       EXPECTED_FEES en scripts\verify-rates.mjs
  echo     - Sin conexion: las tasas mostradas serian el snapshot
  echo       guardado, NO valores actuales
  echo ============================================================
)
echo.
pause
exit /b %RESULT%
