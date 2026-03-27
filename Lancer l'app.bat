@echo off
title Carte42 - Detection Parkings
cd /d "%~dp0"

:: Installer les dépendances si besoin
if not exist "node_modules" (
    echo Installation des dependances npm...
    npm install
)

:: Lancer le serveur de dev en arrière-plan
echo Lancement du serveur...
start "" /b npm run dev > .dev.log 2>&1

:: Attendre que Vite soit prêt
echo En attente du serveur...
timeout /t 3 /nobreak >nul
:wait
findstr /m "localhost" .dev.log >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait
)

:: Ouvrir le navigateur
start "" "http://localhost:5173"
echo.
echo App disponible sur http://localhost:5173
echo Fermer cette fenetre pour arreter le serveur.
echo.

:: Garder la fenêtre ouverte (le serveur tourne en arrière-plan via npm)
npm run dev
