
@echo off
title Smart Inventory System - Launcher
color 0A

rem This file starts the whole system. It lives in the same folder as the
rem "backend" and "frontend" folders, and uses its own location, so it works
rem no matter where the project is copied to.
set "ROOT=%~dp0"

echo ============================================================
echo             SMART INVENTORY SYSTEM
echo ============================================================
echo.
echo  Starting everything. Two black windows will open and must
echo  stay open while you use the system. Please wait...
echo.

echo  [1 of 3]  Making sure the database is running...
net start postgresql-x64-17 >nul 2>&1
echo           Database is ready.
echo.

echo  [2 of 3]  Starting the backend (the brain and database)...
start "Smart Inventory - BACKEND  (keep open)" /D "%ROOT%backend" cmd /k "php artisan serve --host=0.0.0.0 --port=8000"

echo  [3 of 3]  Starting the app (the screens)...
start "Smart Inventory - APP  (keep open)" /D "%ROOT%frontend" cmd /k "npx expo start --lan --port 8081"

echo.
echo  Building the app for the first time. This takes about
echo  40 seconds. The browser will open by itself...
timeout /t 45 /nobreak >nul

start "" "http://localhost:8081"

for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -eq 'Dhcp'} | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "IP=%%a"

echo.
echo ============================================================
echo    THE SYSTEM IS RUNNING
echo ============================================================
echo.
echo    ON THIS COMPUTER (best for the demo):
echo       A browser tab has opened. If the page is blank,
echo       wait a few seconds and refresh it.
echo       Address:  http://localhost:8081
echo.
echo    ON A PHONE (same Wi-Fi, using Expo Go):
echo       exp://%IP%:8081
echo.
echo    LOG IN WITH:
echo       Workspace slug :  demo-shop
echo       Email          :  demo@shop.com
echo       Password       :  password123
echo.
echo    TO STOP:  close the two black server windows.
echo ============================================================
echo.
echo  You can close THIS window now. The two server windows must
echo  stay open.
echo.
pause
