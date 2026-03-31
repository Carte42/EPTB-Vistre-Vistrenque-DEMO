@echo off
title Carte42 - Detection Parkings
cd /d "%~dp0"

:: Installer les dépendances si besoin
if not exist "node_modules" (
    echo Installation des dependances npm...
    npm install
)

echo.
echo  ================================
echo   Carte42 - Detection Parkings
echo  ================================
echo.
echo   [1] Mode travail  (edition, outils complets)
echo   [2] Mode demo     (vue client EPTB)
echo.
set /p choix="Votre choix (1 ou 2) : "

if "%choix%"=="2" goto demo

:travail
echo.
echo Lancement en mode travail...
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
npm run dev
goto fin

:demo
echo.
echo Lancement en mode demo client...
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
set VITE_DEMO_CLIENT=true
npm run dev

:fin
