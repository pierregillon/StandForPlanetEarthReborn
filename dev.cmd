@echo off
rem Mode developpement : reconstruit le code a chaque modification et sert le jeu sur http://localhost:3000
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node22\node.exe" set "PATH=%~dp0.tools\node22;%PATH%"
call npm run dev
