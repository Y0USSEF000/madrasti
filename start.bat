@echo off
title Madrasti
cd /d "%~dp0"
echo Starting Madrasti (MongoDB starts automatically)...
start "" http://localhost:5050
node server.js
pause
