import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"))

try:
    from celery import Celery
    from celery.schedules import crontab

    celery_app = Celery(
        "fleetflow",
        broker=REDIS_URL,
        backend=REDIS_URL,
        include=[
            "app.tasks.maintenance",
            "app.tasks.shipments",
            "app.tasks.maintenance_tasks",
            "app.tasks.fuel_alert_task",
        ],
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_time_limit=300,
        broker_connection_retry_on_startup=True,
    )

    # Scheduled (recurring) jobs — this is Celery Beat's job list
    celery_app.conf.beat_schedule = {
        "check-maintenance-alerts-every-hour": {
            "task": "app.tasks.maintenance.check_maintenance_alerts",
            "schedule": crontab(minute=0),  # runs at the top of every hour
        },
        "check-delayed-shipments-every-10-min": {
            "task": "app.tasks.shipments.check_delayed_shipments",
            "schedule": crontab(minute="*/10"),  # runs every 10 minutes
        },
        "check-maintenance-alerts-hourly": {
            "task": "app.tasks.maintenance_tasks.check_maintenance_alerts_task",
            "schedule": crontab(minute=0),
        },
        "daily-maintenance-report": {
            "task": "app.tasks.maintenance_tasks.generate_maintenance_fleet_report_task",
            "schedule": crontab(hour=8, minute=0),
        },
        "check-fuel-efficiency-hourly": {
            "task": "app.tasks.fuel_alert_task.check_fuel_efficiency_alerts",
            "schedule": crontab(minute=30),
        },
    }

except ImportError:
    # Graceful fallback when running in environment without celery
    class _DummyConf:
        def __init__(self):
            self.broker_url = REDIS_URL
            self.beat_schedule = {
                "check-maintenance-alerts-every-hour": {},
                "check-delayed-shipments-every-10-min": {},
            }
        def update(self, *args, **kwargs):
            pass

    class _DummyCelery:
        def __init__(self, *args, **kwargs):
            self.conf = _DummyConf()

        def task(self, *args, **kwargs):
            def decorator(fn):
                fn.delay = lambda *a, **k: type("Task", (), {"id": "local-fallback", "get": lambda timeout=None: fn(*a, **k)})()
                fn.apply_async = lambda *a, **k: type("Task", (), {"id": "local-fallback", "get": lambda timeout=None: fn(*a, **k)})()
                return fn
            return decorator

    celery_app = _DummyCelery()
