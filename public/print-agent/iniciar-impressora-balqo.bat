@echo off
title BALQO Impressora
cd /d "%~dp0"
echo Iniciando o agente de impressao BALQO...
echo Deixe esta janela aberta enquanto usa o PDV.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0balqo-print-agent.ps1"
echo.
echo Agente encerrado.
pause
