@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   SIVACAD - Modo Red Local                  ║
echo  ║   Dispositivos moviles y portatiles          ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Buscando tu IP en la red local...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "IP=%%a"
    goto :found
)
:found
set "IP=%IP: =%"

echo  ┌──────────────────────────────────────────────┐
echo  │  IP del servidor:  %IP%
echo  │
echo  │  Abre en tu dispositivo:
echo  │    %IP%:5173
echo  │
echo  │  Backend API:
echo  │    %IP%:3000
echo  └────────────────────────────────────────────══╝
echo.
echo  Asegurate de estar en la misma red WiFi.
echo  Presiona Ctrl+C para detener.
echo.

start "SIVACAD Backend" cmd /k "cd backend && npm run dev"
start "SIVACAD Frontend" cmd /k "cd frontend && npm run dev"
