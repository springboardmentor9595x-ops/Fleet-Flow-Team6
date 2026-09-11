@echo off
echo Starting FleetFlow Celery Beat Scheduler...
set PYTHONPATH=%cd%
call ..\.venv\Scripts\activate.bat 2>nul || call venv\Scripts\activate.bat 2>nul
celery -A app.celery_app beat --loglevel=info
pause
