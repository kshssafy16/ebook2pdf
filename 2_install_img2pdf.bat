@echo off
setlocal
cd /d "%~dp0"

echo Installing img2pdf...
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py -m pip install img2pdf
    goto :check
)

where python >nul 2>nul
if %errorlevel%==0 (
    python -m pip install img2pdf
    goto :check
)

echo Python was not found.
echo Install Python 3 and try again.
pause
exit /b 1

:check
if %errorlevel% neq 0 (
    echo.
    echo Installation failed.
    pause
    exit /b 1
)

echo.
echo Installation completed.
echo Next, run 3_run_pdf_conversion.bat
pause
