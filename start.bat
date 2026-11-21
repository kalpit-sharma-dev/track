@echo off
cd /d "%~dp0"
start "Daily Tracker" cmd /k "python server.py || py -3 server.py"
echo Waiting for Daily Tracker...
set tries=0
:wait
set /a tries+=1
if %tries% GEQ 20 goto fail
netstat -an | find ":8080" | find "LISTENING" >nul
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait
)
start "" http://127.0.0.1:8080
echo.
echo Notes are saved in tracker-data.json in this folder.
echo Leave the Daily Tracker window open. Close that window to stop the app.
goto end
:fail
echo Could not start. Install Python from https://www.python.org/downloads/ and tick Add Python to PATH.
pause
:end
