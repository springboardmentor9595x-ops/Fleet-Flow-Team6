@echo off
echo Starting FleetFlow Celery Worker...
set PYTHONPATH=%cd%
call ..\.venv\Scripts\activate.bat 2>nul || call venv\Scripts\activate.bat 2>nul
celery -A app.celery_app worker --loglevel=info --pool=solo
pause
