@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
  echo Execute a preparacao inicial descrita em docs\INSTALLATION_PHASE.md.
  pause
  exit /b 1
)
start "" ".venv\Scripts\pythonw.exe" "scripts\central_desktop.py"
