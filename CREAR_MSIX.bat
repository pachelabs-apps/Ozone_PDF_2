@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
rem Arma el paquete MSIX de Ozone PDF 2 para actualizar la app en la Microsoft Store.
rem Usa el programa que genera CREAR_INSTALADOR.bat: ejecutalo primero.
rem Necesita el Windows SDK (MakeAppx y MakePri). La Store firma el paquete al publicarlo.

set "VERSION="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw 'src-tauri\tauri.conf.json' | ConvertFrom-Json).version"`) do set "VERSION=%%v"
if not defined VERSION (
  echo  No se pudo leer la version de src-tauri\tauri.conf.json.
  goto fin_error
)
title Crear paquete MSIX - Ozone PDF %VERSION%
echo.
echo  ==========================================
echo     Paquete MSIX de Ozone PDF %VERSION%
echo  ==========================================
echo.

if not exist "src-tauri\target\release\ozone-pdf.exe" (
  echo  Falta el programa compilado. Ejecuta primero CREAR_INSTALADOR.bat.
  goto fin_error
)

rem ---------- 1. Identidad de la Store (la misma de la version 1) ----------
rem msix_identidad.txt: linea 1 = Package/Identity/Name, linea 2 = Package/Identity/Publisher,
rem linea 3 (opcional) = nombre del editor que se ve (Package/Properties/PublisherDisplayName).
if not exist "msix_identidad.txt" (
  > "msix_identidad.txt" echo PEGAR-ACA-Package-Identity-Name
  >> "msix_identidad.txt" echo CN=PEGAR-ACA-Package-Identity-Publisher
  echo  Se creo msix_identidad.txt. Pega los datos de Partner Center ^(Identidad del producto^)
  echo  o copialo de la carpeta Pache_PDF. Despues volve a ejecutar este script.
  goto fin_error
)
set "NOMBRE="
set "EDITOR="
set "EDITOR_VISIBLE="
for /f "usebackq delims=" %%L in ("msix_identidad.txt") do (
  if not defined NOMBRE (set "NOMBRE=%%L") else if not defined EDITOR (set "EDITOR=%%L") else if not defined EDITOR_VISIBLE set "EDITOR_VISIBLE=%%L"
)
if not defined EDITOR_VISIBLE set "EDITOR_VISIBLE=PacheLabs"
echo !NOMBRE!!EDITOR! | findstr /c:"PEGAR-ACA" >nul
if not errorlevel 1 (
  echo  Completa msix_identidad.txt con los datos de Partner Center y volve a ejecutar.
  goto fin_error
)
echo  [1/4] Identidad: !NOMBRE!  ^(editor: !EDITOR_VISIBLE!^)

rem ---------- 2. Windows SDK ----------
set "SDKBIN="
for /d %%D in ("%ProgramFiles(x86)%\Windows Kits\10\bin\10.*") do (
  if exist "%%D\x64\makeappx.exe" set "SDKBIN=%%D\x64"
)
if not defined SDKBIN (
  echo  No se encontro MakeAppx. Instala el Windows SDK:
  echo  https://developer.microsoft.com/windows/downloads/windows-sdk/
  goto fin_error
)
echo  [2/4] Windows SDK: !SDKBIN!

rem ---------- 3. Carpeta del paquete ----------
echo  [3/4] Preparando los archivos...
set "PAQ=build\msix"
if exist "%PAQ%" rmdir /s /q "%PAQ%"
mkdir "%PAQ%"
copy /y "src-tauri\target\release\ozone-pdf.exe" "%PAQ%\" >nul
if errorlevel 1 goto error
robocopy "msix\Assets" "%PAQ%\Assets" /e /nfl /ndl /njh /njs /np >nul
if errorlevel 8 goto error
set "VERSION4=%VERSION%.0"
powershell -NoProfile -Command "$m = Get-Content -Raw -Encoding UTF8 'msix\AppxManifest.xml'; $m = $m.Replace('$NOMBRE$', $env:NOMBRE).Replace('$EDITOR_VISIBLE$', $env:EDITOR_VISIBLE).Replace('$EDITOR$', $env:EDITOR).Replace('$VERSION$', $env:VERSION4); [IO.File]::WriteAllText((Join-Path $PWD '%PAQ%\AppxManifest.xml'), $m, (New-Object Text.UTF8Encoding $false))"
if errorlevel 1 goto error
"!SDKBIN!\makepri.exe" createconfig /cf "build\priconfig.xml" /dq es-AR /o >nul
if errorlevel 1 goto error
"!SDKBIN!\makepri.exe" new /pr "%PAQ%" /cf "build\priconfig.xml" /of "%PAQ%\resources.pri" /o >nul
if errorlevel 1 goto error

rem ---------- 4. Empaquetar ----------
echo  [4/4] Generando el paquete...
if not exist "instalador" mkdir "instalador"
set "MSIX=instalador\Ozone_PDF_%VERSION%.msix"
"!SDKBIN!\makeappx.exe" pack /d "%PAQ%" /p "!MSIX!" /o
if errorlevel 1 goto error

echo.
echo  ==========================================
echo     LISTO: !MSIX!
echo  ==========================================
echo.
echo  Subilo en Partner Center ^> Ozone PDF ^> Actualizar ^> Paquetes ^(reemplaza al 1.2.0^).
echo  Para probarlo antes en esta PC ^(con "Modo de desarrollador" activado^):
echo    powershell Add-AppxPackage -Register "%CD%\%PAQ%\AppxManifest.xml"
echo  y para quitarlo:  powershell "Get-AppxPackage *OzonePDF* ^| Remove-AppxPackage"
echo.
pause
exit /b 0

:error
echo.
echo  Hubo un error al armar el paquete. Revisa los mensajes de arriba.
:fin_error
echo.
pause
exit /b 1
