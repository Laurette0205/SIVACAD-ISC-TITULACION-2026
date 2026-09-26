@echo off
title SIVACAD-ISC
cd /d "%~dp0"

echo ===== SIVACAD-ISC: Iniciando servicios =====

echo [1/3] Verificando MySQL ^(puerto 3306^)...
call :portInUse 3306
if not errorlevel 1 goto dbOk

set "MYSQL_STARTED="
if exist "C:\Xampp\mysql\bin\mysqld.exe" (
    echo Puerto 3306 libre. Iniciando MySQL de XAMPP ^(no cierres la ventana SIVACAD-MySQL^)...
    start "SIVACAD-MySQL XAMPP" "C:\Xampp\mysql\bin\mysqld.exe"
    set "MYSQL_STARTED=1"
)
if defined MYSQL_STARTED goto dbWait

echo MySQL de XAMPP no encontrado. Probando el servicio MySQL80...
sc query MySQL80 >nul 2>&1
if errorlevel 1 goto dbNone
net start MySQL80 >nul 2>&1
if errorlevel 1 goto dbNoPerm
goto dbWait

:dbNone
echo ! No se encontro MySQL ^(ni XAMPP en C:\Xampp\mysql ni servicio MySQL80^)
echo ! Instala o arranca MySQL manualmente y vuelve a ejecutar este .bat
goto dbFail

:dbNoPerm
echo ! No se pudo iniciar el servicio MySQL80 ^(Acceso denegado^)
echo ! Ejecuta este .bat como Administrador o usa XAMPP Control Panel
goto dbFail

:dbWait
set /a dbWait=0
:dbLoop
call :portInUse 3306
if not errorlevel 1 goto dbOk
set /a dbWait+=1
if %dbWait% geq 20 goto dbFail
ping -n 2 127.0.0.1 >nul
goto dbLoop

:dbFail
echo ! MySQL no responde en el puerto 3306
echo ! Abre XAMPP Control Panel ^(o services.msc^) y arranca MySQL, luego vuelve a ejecutar este .bat
goto dbDone

:dbOk
echo MySQL activo en el puerto 3306
goto dbDone

:dbDone
call :portInUse 3000
if not errorlevel 1 (
    echo [2/3] Backend ya esta corriendo en el puerto 3000. Se omite.
) else (
    echo [2/3] Iniciando backend ^(puerto 3000^)...
    start "SIVACAD-Backend" cmd /c "cd /d backend && npm run dev"
)

call :portInUse 5173
if not errorlevel 1 (
    echo [3/3] Frontend ya esta corriendo en el puerto 5173. Se omite.
) else (
    echo [3/3] Iniciando frontend ^(puerto 5173^)...
    start "SIVACAD-Frontend" cmd /c "cd /d frontend && npm run dev"
)

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
goto :eof

:portInUse
netstat -an | findstr /c:":%~1 " | findstr LISTENING >nul
exit /b %errorlevel%
