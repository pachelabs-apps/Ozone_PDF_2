@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ozone PDF 2 - Crear el paquete para Google Play
echo.
echo  ================================================
echo    Ozone PDF 2 - Paquete para Google Play (.aab)
echo  ================================================
echo.

if not exist "src-tauri\gen\android\keystore.properties" (
  echo  Falta la clave de firma. Corré primero CREAR_CLAVE_ANDROID.bat.
  goto fin_error
)

set "VERSION="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw 'package.json' | ConvertFrom-Json).version"`) do set "VERSION=%%v"
echo  Versión: %VERSION%
echo  Esto compila la app para todos los celulares Android: tarda entre 10 y 30 minutos.
echo  La versión que se arma acá NO tiene permiso de internet.
echo.

call npm install
if errorlevel 1 goto fin_error
call npx tauri android build --aab
if errorlevel 1 goto fin_error

set "AAB=src-tauri\gen\android\app\build\outputs\bundle\universalRelease\app-universal-release.aab"
if not exist "%AAB%" (
  echo  No encuentro el paquete que se tendría que haber creado:
  echo    %AAB%
  goto fin_error
)
copy /y "%AAB%" "Ozone_PDF_%VERSION%.aab" >nul

echo.
echo  ================================================
echo    Listo: Ozone_PDF_%VERSION%.aab
echo    Es el archivo que se sube en Google Play Console.
echo  ================================================
explorer /select,"%CD%\Ozone_PDF_%VERSION%.aab"
pause
exit /b 0

:fin_error
echo.
echo  Algo falló. Mandame una captura de esta ventana.
pause
exit /b 1
