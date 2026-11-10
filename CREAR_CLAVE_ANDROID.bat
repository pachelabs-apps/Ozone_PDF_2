@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Ozone PDF 2 - Crear la clave de firma de Android
echo.
echo  ================================================
echo    Ozone PDF 2 - Clave de firma para Google Play
echo  ================================================
echo.
echo  Google Play exige que cada versión de la app venga firmada con LA MISMA clave.
echo  Se crea una sola vez y se guarda FUERA de este repositorio (no se sube a GitHub).
echo.

set "CARPETA=%USERPROFILE%\Ozone PDF - clave Android"
set "CLAVEJKS=%CARPETA%\ozone-pdf-subida.jks"
set "PROPS=src-tauri\gen\android\keystore.properties"

if exist "%CLAVEJKS%" (
  echo  Ya tenés una clave en:
  echo    %CLAVEJKS%
  echo  No se crea otra: si la reemplazás, no vas a poder actualizar la app en Google Play.
  goto fin_ok
)

set "KT=%JAVA_HOME%\bin\keytool.exe"
if not exist "%KT%" set "KT=%ProgramFiles%\Android\Android Studio\jbr\bin\keytool.exe"
if not exist "%KT%" (
  echo  No encuentro keytool, que viene con Android Studio. Corré antes PREPARAR_ANDROID.bat.
  goto fin_error
)

echo  Elegí una contraseña para la clave: al menos 8 caracteres, SOLO letras y números.
echo  Anotala en un lugar seguro: sin ella no se puede actualizar la app.
echo.
set "CLAVE="
set /p "CLAVE= Contraseña: "
if not defined CLAVE goto fin_error
set "CLAVE2="
set /p "CLAVE2= Repetila: "
if not "!CLAVE!"=="!CLAVE2!" (
  echo  Las contraseñas no coinciden.
  goto fin_error
)

if not exist "%CARPETA%" mkdir "%CARPETA%"
"%KT%" -genkeypair -keystore "%CLAVEJKS%" -storetype PKCS12 -keyalg RSA -keysize 2048 -validity 10000 -alias ozone -storepass "!CLAVE!" -keypass "!CLAVE!" -dname "CN=Nicolas Pacheco, O=Pache Labs, C=AR"
if errorlevel 1 goto fin_error

rem el archivo que le dice a Android dónde está la clave (está en .gitignore: no se sube)
set "RUTA=%CLAVEJKS:\=/%"
> "%PROPS%" echo keyAlias=ozone
>> "%PROPS%" echo password=!CLAVE!
>> "%PROPS%" echo storeFile=!RUTA!

echo.
echo  ================================================
echo    Listo: la clave quedó en
echo      %CARPETA%
echo.
echo    MUY IMPORTANTE: copiá esa carpeta a un pendrive y a tu nube,
echo    y guardá la contraseña. Si se pierde, no se puede actualizar la app.
echo  ================================================
explorer "%CARPETA%"

:fin_ok
pause
exit /b 0

:fin_error
echo.
echo  No se creó la clave. Si no sabés por qué, mandame una captura de esta ventana.
pause
exit /b 1
