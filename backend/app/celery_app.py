import os
import sys

# Ensure backend root and app directory are both in sys.path
APP_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(APP_DIR)

for path in [BASE_DIR, APP_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "fleetflow",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.maintenance", "app.tasks.shipments"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Scheduled (recurring) jobs — Celery Beat's job list
celery_app.conf.beat_schedule = {
    "check-maintenance-alerts-every-hour": {
        "task": "app.tasks.maintenance.check_maintenance_alerts",
        "schedule": crontab(minute=0),  # runs at the top of every hour
    },
    "check-delayed-shipments-every-10-min": {
        "task": "app.tasks.shipments.check_delayed_shipments",
        "schedule": crontab(minute="*/10"),  # runs every 10 minutes
    },
}
