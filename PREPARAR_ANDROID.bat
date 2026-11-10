@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ozone PDF 2 - Preparar Android
echo.
echo  ================================================
echo    Ozone PDF 2 - Preparar la compu para Android
echo  ================================================
echo.

rem --- 1. Buscar lo que instaló Android Studio ---
set "SDK=%LOCALAPPDATA%\Android\Sdk"
if not exist "%SDK%\platform-tools" (
  echo  No encuentro el SDK de Android en:
  echo    %SDK%
  echo  Abrí Android Studio una vez y completá la instalación "Standard".
  goto fin_error
)
set "JBR=%ProgramFiles%\Android\Android Studio\jbr"
if not exist "%JBR%\bin\java.exe" (
  echo  No encuentro el Java que trae Android Studio en:
  echo    %JBR%
  goto fin_error
)
set "NDK="
for /f "delims=" %%d in ('dir /b /ad /o:n "%SDK%\ndk" 2^>nul') do set "NDK=%SDK%\ndk\%%d"
if not defined NDK (
  echo  Falta el NDK. En Android Studio: More Actions, SDK Manager, pestaña SDK Tools,
  echo  tildá "NDK (Side by side)" y "Android SDK Command-line Tools", y tocá Apply.
  goto fin_error
)
echo  SDK:  %SDK%
echo  NDK:  %NDK%
echo  Java: %JBR%
echo.

rem --- 2. Variables de entorno (quedan guardadas para tu usuario) ---
echo  [1/4] Guardando las variables de entorno...
setx JAVA_HOME "%JBR%" >nul
setx ANDROID_HOME "%SDK%" >nul
setx NDK_HOME "%NDK%" >nul
set "JAVA_HOME=%JBR%"
set "ANDROID_HOME=%SDK%"
set "NDK_HOME=%NDK%"

rem --- 3. Rust para celulares ---
echo  [2/4] Agregando a Rust los procesadores de los celulares Android...
rem si la descarga se corta, se reintenta cada uno hasta 4 veces (lo ya bajado no se vuelve a bajar)
for %%t in (aarch64-linux-android x86_64-linux-android armv7-linux-androideabi i686-linux-android) do (
  call :agregar %%t
  if errorlevel 1 goto fin_error
)

rem --- 4. Dependencias y proyecto de Android ---
echo  [3/4] Instalando dependencias...
call npm install
if errorlevel 1 goto fin_error

echo  [4/4] Creando el proyecto de Android...
if exist "src-tauri\gen\android" (
  echo  Ya existe src-tauri\gen\android: se deja como está.
) else (
  call npx tauri android init
  if errorlevel 1 goto fin_error
)

echo.
echo  ================================================
echo    Listo. Para probar la app en Android:
echo    - Conectá el celular por USB con la "Depuración USB" activada,
echo      o abrí un emulador desde Android Studio (Device Manager).
echo    - Después hacé doble clic en PROBAR_ANDROID.bat
echo  ================================================
pause
exit /b 0

:agregar
for /l %%i in (1,1,4) do (
  rustup target add %1 && exit /b 0
  echo  Se cortó la descarga de %1. Reintento %%i de 4...
  timeout /t 5 /nobreak >nul
)
exit /b 1

:fin_error
echo.
echo  Algo falló. Mandame una captura de esta ventana.
pause
exit /b 1
