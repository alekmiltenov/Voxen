@echo off
title Voxen Launcher
set "ROOT=%~dp0"
set "VENV_PY=%ROOT%.venv\Scripts\python.exe"

echo Starting Voxen...

start "Voxen API :8000" cmd /k "cd /d %ROOT%Interface && ("%VENV_PY%" -m uvicorn server:app --host 0.0.0.0 --port 8000 || py -m uvicorn server:app --host 0.0.0.0 --port 8000 || python -m uvicorn server:app --host 0.0.0.0 --port 8000 || uvicorn server:app --host 0.0.0.0 --port 8000)"

timeout /t 2 /nobreak >nul

cd /d %ROOT%frontend
npm run dev
