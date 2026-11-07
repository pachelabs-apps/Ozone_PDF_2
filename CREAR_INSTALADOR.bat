@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ozone PDF 2 - Crear instalador
echo.
echo  ================================================
echo    Ozone PDF 2 - Crear instalador para Windows
echo  ================================================
echo.

rem --- 1. Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo  [FALTA] Node.js. Instalalo desde https://nodejs.org ^(version LTS^) y volve a abrir este archivo.
  goto :fin
)
for /f "delims=" %%v in ('node -v') do echo  [OK] Node.js %%v

rem --- 2. Rust ---
where cargo >nul 2>nul
if errorlevel 1 (
  echo  [FALTA] Rust. Instalalo desde https://rustup.rs ^(rustup-init.exe, opcion 1 por defecto^).
  echo          El instalador de Rust tambien ofrece instalar las herramientas de C++ de Visual Studio: acepta.
  goto :fin
)
for /f "delims=" %%v in ('cargo -V') do echo  [OK] %%v

echo.
echo  [1/2] Instalando dependencias (la primera vez tarda unos minutos)...
call npm install --no-fund --no-audit
if errorlevel 1 (
  echo  [ERROR] No se pudieron instalar las dependencias. Revisa tu conexion a internet.
  goto :fin
)

echo.
echo  [2/2] Compilando Ozone PDF (la primera vez puede tardar 5 a 15 minutos)...
call npx tauri build
if errorlevel 1 (
  echo.
  echo  [ERROR] La compilacion fallo. Copia el mensaje de arriba y pasaselo a Claude.
  goto :fin
)

echo.
echo  ================================================
echo    Listo! Los instaladores quedaron en:
echo  ================================================
echo.
for %%f in ("src-tauri\target\release\bundle\msi\*.msi") do echo    MSI:  %%~ff
for %%f in ("src-tauri\target\release\bundle\nsis\*.exe") do echo    EXE:  %%~ff
echo.
echo  Para probarlo sin instalar, tambien podes abrir:
echo    %~dp0src-tauri\target\release\ozone-pdf.exe
echo.
start "" "src-tauri\target\release\bundle"

:fin
echo.
pause
