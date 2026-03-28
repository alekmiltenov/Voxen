@echo off
title Voxen Launcher

echo Starting Voxen...

start "Voxen API :8000"  cmd /k "cd /d %~dp0Interface && uvicorn server:app --host 0.0.0.0 --port 8000"
start "Voxen Head :5000" cmd /k "cd /d %~dp0control-service && python app.py"

timeout /t 2 /nobreak >nul

cd /d %~dp0frontend
npm run dev
