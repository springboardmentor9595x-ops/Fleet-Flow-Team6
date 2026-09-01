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
    Core function that scans vehicle maintenance records for upcoming (within 7 days)
    or overdue service dates, prints console/log alerts, and records notifications.
    """
    from database import SessionLocal
    from app.models.maintenance import VehicleMaintenance
    from app.models.vehicle import Vehicle
    from app.models.notification import Notification
    from app.models.user import User

    db = SessionLocal()
    try:
        today = date.today()
        seven_days_out = today + timedelta(days=7)

        records = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.status.notin_(["Completed", "Cancelled"])
        ).all()

        alert_count = 0
        admin_users = db.query(User).filter(User.role.in_(["Admin", "FleetManager"])).all()

        for rec in records:
            if not rec.next_service_date:
                continue

            v = db.query(Vehicle).filter(Vehicle.vehicle_id == rec.vehicle_id).first()
            v_reg = v.registration_number if v else "Unknown Vehicle"

            alert_type = None
            if rec.next_service_date < today:
                alert_type = "Overdue"
            elif rec.next_service_date <= seven_days_out:
                alert_type = "Upcoming"

            if alert_type:
                alert_msg = f"[MAINTENANCE ALERT] Vehicle {v_reg} has {alert_type.upper()} {rec.maintenance_type} service due on {rec.next_service_date}."
                print(alert_msg)
                logger.info(alert_msg)

                # Avoid duplicate notifications for the same maintenance title
                title_str = f"Maintenance Alert: {alert_type} ({v_reg})"
                existing = db.query(Notification).filter(
                    Notification.title == title_str,
                    Notification.type == "Maintenance"
                ).first()

                if not existing:
                    for user in admin_users:
                        new_notif = Notification(
                            user_id=user.user_id,
                            title=title_str,
                            message=alert_msg,
                            type="Maintenance"
                        )
                        db.add(new_notif)
                    alert_count += 1

        db.commit()
        return {"status": "success", "alerts_generated": alert_count}
    except Exception as e:
        db.rollback()
        logger.error(f"Error checking maintenance alerts: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="check_maintenance_alerts")
def check_maintenance_alerts_task():
    """Celery scheduled background task wrapper."""
    return run_maintenance_alert_check()
