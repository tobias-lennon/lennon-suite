@echo off
title Lennon Landscaping - Suite
echo Starting Suite Dev Environment...
echo.

start /B "" C:\xampp\php\php.exe "E:\Lennon Landscaping\Development\Suite\backend\artisan" serve

timeout /t 2 /nobreak >nul
echo API running at http://localhost:8000
echo Frontend starting...
echo.

cd /d "E:\Lennon Landscaping\Development\Suite\frontend"
npm run dev
