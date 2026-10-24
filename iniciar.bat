@echo off
REM Inicia o Simulador AZ-900 em http://localhost:8900
cd /d "%~dp0"
start "" http://localhost:8900
python -m http.server 8900 --bind 127.0.0.1
