import os
import logging
from datetime import datetime, date, timedelta
from celery import Celery

logger = logging.getLogger(__name__)

# Configure Celery with Redis Message Broker
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery(
    "fleetflow_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


def run_maintenance_alert_check():
    """
    Core function that scans vehicle maintenance records for upcoming (5-day and 1-day prior)
    or overdue service dates, dispatches in-app notifications to Drivers and Dispatchers,
    and sends 1-day prior reminder emails to assigned Drivers.
    """
    try:
        from app.tasks.maintenance import check_maintenance_alerts
        result = check_maintenance_alerts()
        logger.info(f"Maintenance alert check result: {result}")
        print(f"[MAINTENANCE CHECK SUCCESS] {result}")
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Error checking maintenance alerts: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="check_maintenance_alerts")
def check_maintenance_alerts_task():
    """Celery scheduled background task wrapper."""
    return run_maintenance_alert_check()
