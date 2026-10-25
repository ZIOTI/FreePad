; FreePad Custom NSIS Script — Fait par zioti
; Installe automatiquement le pilote micro direct (APO) lors de l'installation de FreePad

!macro customInstall
  DetailPrint "Installation du Pilote Micro Direct FreePad (Fait par zioti)..."
  nsExec::Exec 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\install_apo.ps1" -Silent'
!macroend

!macro customUnInstall
  DetailPrint "Nettoyage du pilote FreePad..."
!macroend
