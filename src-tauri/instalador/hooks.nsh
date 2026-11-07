; Ozone PDF 2 — pasos extra del instalador (Windows).
; Igual que en Ozone PDF 1: el firewall de Windows bloquea toda salida a red del programa.
; Primero se borra una regla anterior (actualizaciones) y después se crea la nueva.

; Ozone PDF 1 (instalador Inno Setup) se desinstala solo antes de instalar la versión 2,
; así no quedan dos "Ozone PDF" en el equipo. Sus archivos y su regla de firewall se borran;
; los PDF de la persona no se tocan.
!define OZONE1_CLAVE "Software\Microsoft\Windows\CurrentVersion\Uninstall\{5B3E59AC-D9F8-43C8-ABA7-AE1591EFB8BC}_is1"

!macro OZONE1_QUITAR RAIZ
  ReadRegStr $R0 ${RAIZ} "${OZONE1_CLAVE}" "UninstallString"
  StrCmp $R0 "" +4
    DetailPrint "Desinstalando Ozone PDF 1..."
    ExecWait '$R0 /VERYSILENT /SUPPRESSMSGBOXES /NORESTART'
    Sleep 1500
!macroend

!macro NSIS_HOOK_PREINSTALL
  SetRegView 64
  !insertmacro OZONE1_QUITAR HKLM
  !insertmacro OZONE1_QUITAR HKCU
  SetRegView 32
  !insertmacro OZONE1_QUITAR HKLM
  !insertmacro OZONE1_QUITAR HKCU
  SetRegView lastused
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Configurando el firewall de Windows..."
  nsExec::Exec '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="Ozone PDF 2 - sin red"'
  Pop $0
  nsExec::Exec '"$SYSDIR\netsh.exe" advfirewall firewall add rule name="Ozone PDF 2 - sin red" dir=out action=block enable=yes program="$INSTDIR\${MAINBINARYNAME}.exe"'
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="Ozone PDF 2 - sin red"'
  Pop $0
!macroend
