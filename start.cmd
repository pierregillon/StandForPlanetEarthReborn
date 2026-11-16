@echo off
rem Lance le jeu : construit le code puis demarre le serveur sur http://localhost:3000
rem Utilise le Node 22 portable de .tools\node22 s'il est present (voir ADR-009).
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node22\node.exe" set "PATH=%~dp0.tools\node22;%PATH%"
call npm start
