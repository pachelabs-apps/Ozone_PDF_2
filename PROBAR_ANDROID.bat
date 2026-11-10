@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Ozone PDF 2 - Probar en Android
echo.
rem si quedó abierta una prueba anterior, se cierra (si no, el servidor no puede arrancar)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":1420 .*LISTENING" /c:":1421 .*LISTENING"') do (
  echo  Cerrando una prueba anterior que quedó abierta...
  taskkill /pid %%p /f >nul 2>&1
)
echo  Abriendo Ozone PDF en el celular o en el emulador...
echo  La primera vez tarda varios minutos: compila todo.
echo  Cuando termine, la app se abre sola. Para cerrarla del todo, cerrá esta ventana.
echo.
call npx tauri android dev
if errorlevel 1 (
  echo.
  echo  Algo falló. Mandame una captura de esta ventana.
)
pause
