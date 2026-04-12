@echo off
title Lennon Suite -- Launcher
echo Starting Suite Dev Environment...
echo.

:: ── Check MySQL ──────────────────────────────────────────────────────────────
echo Checking MySQL...
"C:\xampp\mysql\bin\mysql.exe" -u root -h 127.0.0.1 -P 3306 -e "SELECT 1;" >nul 2>&1
if %errorlevel% equ 0 goto mysql_ready

echo MySQL not running - attempting to start service...
net start mysql >nul 2>&1

set attempts=0
:wait_loop
timeout /t 1 /nobreak >nul
"C:\xampp\mysql\bin\mysql.exe" -u root -h 127.0.0.1 -P 3306 -e "SELECT 1;" >nul 2>&1
if %errorlevel% equ 0 goto mysql_ready
set /a attempts+=1
if %attempts% lss 15 goto wait_loop
echo.
echo ERROR: MySQL did not start after 15 seconds.
echo Open XAMPP Control Panel and start MySQL manually, then run this script again.
echo.
pause
exit /b 1

:mysql_ready
echo MySQL is running.
echo.

:: ── Laravel API ──────────────────────────────────────────────────────────────
echo Opening Laravel API window...
start "Laravel API" cmd /k ""E:\Lennon Landscaping\Development\Suite\_start-api.bat""

timeout /t 2 /nobreak >nul

:: ── React Frontend ───────────────────────────────────────────────────────────
echo Opening React Frontend window...
start "React Frontend" cmd /k ""E:\Lennon Landscaping\Development\Suite\_start-frontend.bat""

echo.
echo Both processes launched in separate windows.
echo   Laravel API  -^>  http://localhost:8000
echo   Frontend     -^>  http://localhost:5173
echo.
pause
