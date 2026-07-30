@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py "3_make_pdf.py"
    exit /b %errorlevel%
)

where python >nul 2>nul
if %errorlevel%==0 (
    python "3_make_pdf.py"
    exit /b %errorlevel%
)

echo Python was not found.
echo Install Python 3 and try again.
pause
exit /b 1
