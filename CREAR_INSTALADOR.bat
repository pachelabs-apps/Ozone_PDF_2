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

rem --- 3. Herramientas de C++ de Visual Studio (el "linker" que arma el .exe) ---
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VCOK="
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VCOK=1"
)
if not defined VCOK (
  echo  [FALTA] Herramientas de compilacion de C++ de Visual Studio.
  echo.
  echo          1. Abri https://visualstudio.microsoft.com/es/visual-cpp-build-tools/
  echo             y baja "Build Tools para Visual Studio".
  echo          2. En el instalador tilda "Desarrollo para el escritorio con C++".
  echo             ^(deja marcados "MSVC" y "Windows 11 SDK", que vienen por defecto^)
  echo          3. Instala ^(unos 6 GB^), reinicia la compu y volve a abrir este archivo.
  echo.
  echo          Atajo: en una terminal podes pegar
  echo          winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  goto :fin
)
echo  [OK] Herramientas de C++ de Visual Studio

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
for %%f in ("src-tauri\target\release\bundle\nsis\*.exe") do echo    EXE ^(recomendado^):  %%~ff
echo          Muestra los terminos, crea la regla del firewall y reemplaza a Ozone PDF 1.
for %%f in ("src-tauri\target\release\bundle\msi\*.msi") do echo    MSI ^(para empresas^):  %%~ff
echo.
echo  Para probarlo sin instalar, tambien podes abrir:
echo    %~dp0src-tauri\target\release\ozone-pdf.exe
echo.
start "" "src-tauri\target\release\bundle"

:fin
echo.
pause
