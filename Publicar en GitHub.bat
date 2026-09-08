@echo off
chcp 65001 >nul
title CommissionTracker - Publicar en GitHub
REM Agrega Node al PATH de esta sesion (evita el error "node no se reconoce")
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo ============================================================
echo   Publicando CommissionTracker en GitHub
echo ============================================================
echo.

REM Limpia un lock de git que pudo quedar por OneDrive o por un proceso cortado
if exist ".git\index.lock" del /f /q ".git\index.lock"

REM ---------------------------------------------------------------
REM  1. Verificacion previa: no publicar algo que no da bien
REM ---------------------------------------------------------------
echo [1/4] Verificando tasas, comisiones y rutas...
echo.
REM Nota: se evitan bloques ( ) alrededor de variables leidas con set /p,
REM porque cmd expande %VAR% al parsear el bloque y no al ejecutarlo.
node scripts\verify-rates.mjs
if not errorlevel 1 goto :verif_ok

echo.
echo ============================================================
echo   La verificacion encontro diferencias.
echo   Revisa la salida de arriba antes de publicar.
echo ============================================================
echo.
set "FORZAR="
set /p FORZAR="Publicar igual de todos modos? (escribi SI para continuar): "
if /i "%FORZAR%"=="SI" goto :verif_ok

echo.
echo Publicacion cancelada.
echo.
pause
exit /b 1

:verif_ok

REM ---------------------------------------------------------------
REM  2. Mostrar que se va a publicar
REM ---------------------------------------------------------------
echo.
echo [2/4] Cambios que se van a publicar:
echo.
git status --short
echo.

REM ---------------------------------------------------------------
REM  3. Mensaje de commit
REM ---------------------------------------------------------------
echo [3/4] Mensaje del commit
echo.
set "MSG="
set /p MSG="Describi que cambiaste: "

if "%MSG%"=="" (
  echo.
  echo ============================================================
  echo   Mensaje vacio. Publicacion cancelada.
  echo   Un commit sin mensaje util hace ilegible el historial.
  echo ============================================================
  echo.
  pause
  exit /b 1
)

REM ---------------------------------------------------------------
REM  4. Commit y push
REM ---------------------------------------------------------------
echo.
echo [4/4] Publicando...
echo.
git add -A
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo No habia nada para commitear, o el commit fallo.
  echo.
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo.
  echo ============================================================
  echo   El push fallo. El commit quedo hecho localmente.
  echo   Revisa la conexion o si hay cambios remotos sin bajar
  echo   ^(proba: git pull --rebase^) y volve a intentar.
  echo ============================================================
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   Push terminado.
echo.
echo   GitHub Actions va a redeployar solo. La web queda en:
echo   https://ignacio-81.github.io/commission-tracker/
echo.
echo   Si es la primera vez: GitHub - Settings - Pages -
echo   Build and deployment - Source: GitHub Actions
echo ============================================================
echo.
pause
