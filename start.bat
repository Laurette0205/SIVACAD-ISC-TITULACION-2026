@echo off
title SIVACAD-ISC
cd /d "%~dp0"

echo ===== SIVACAD-ISC: Iniciando servicios =====

echo [1/3] Verificando MySQL...
sc query MySQL80 | findstr RUNNING >nul
if errorlevel 1 (
    echo MySQL80 detenido. Intentando iniciar...
    net start MySQL80 >nul 2>&1
    if errorlevel 1 (
        echo ! No se pudo iniciar MySQL80 (ejecuta este .bat como Administrador)
        echo ! O inicia MySQL manualmente desde Servicios (services.msc)
    ) else (
        echo MySQL80 iniciado correctamente
    )
) else (
    echo MySQL80 ya esta corriendo
)

echo [2/3] Iniciando backend (puerto 3000)...
start "SIVACAD-Backend" cmd /c "cd /d backend && npm run dev"

echo [3/3] Iniciando frontend (puerto 5173)...
start "SIVACAD-Frontend" cmd /c "cd /d frontend && npm run dev"

echo.
echo ===== Servicios iniciados =====
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Credenciales de prueba:
echo   admin@tesi.edu.mx / Testing123!
echo   coordinador@tesi.edu.mx / Testing123!
echo   docente@tesi.edu.mx / Testing123!
echo   alumno@tesi.edu.mx / Testing123!
echo.
pause
