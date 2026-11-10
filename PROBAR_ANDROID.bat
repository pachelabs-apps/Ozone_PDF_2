@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ozone PDF 2 - Probar en Android
echo.
echo  Abriendo Ozone PDF en el celular o en el emulador...
echo  (la primera vez tarda varios minutos: compila todo)
echo.
call npx tauri android dev
if errorlevel 1 (
  echo.
  echo  Algo falló. Mandame una captura de esta ventana.
)
pause
