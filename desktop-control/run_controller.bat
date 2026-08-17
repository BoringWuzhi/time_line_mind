@echo off
rem Harness Desktop Control launcher (no console window)
cd /d "%~dp0"
start "" pythonw.exe "%~dp0harness_control.py"
