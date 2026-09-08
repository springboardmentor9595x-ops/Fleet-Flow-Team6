"""
Celery task: Scan vehicle_maintenance table for upcoming/overdue records
and write alerts to the notifications table.

NOTE: Uses SessionLocal() directly (not FastAPI's get_db() dependency)
because Celery tasks run outside the request/response cycle.
"""

import uuid
from datetime import date, timedelta

from app.celery_app import celery_app
from database import SessionLocal
from app.models.maintenance import VehicleMaintenance
from app.models.notification import Notification
from app.models.vehicle import Vehicle


@celery_app.task(name="app.tasks.maintenance.check_maintenance_alerts")
def check_maintenance_alerts():
    db = SessionLocal()
    try:
        today = date.today()
        upcoming_cutoff = today + timedelta(days=7)

        # Fetch records that are pending AND due within 7 days or already overdue
        records = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.status != "completed",
            VehicleMaintenance.next_service_date <= upcoming_cutoff,
        ).all()

        alerts_triggered = 0
        for record in records:
            is_overdue = record.next_service_date < today

            # Get vehicle registration number for the alert message
            vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).first()
            reg = vehicle.registration_number if vehicle else str(record.vehicle_id)

            if is_overdue:
                days_overdue = (today - record.next_service_date).days
                title = "Maintenance Overdue"
                message = (
                    f"Vehicle {reg} — {record.maintenance_type} is overdue by {days_overdue} day(s). "
                    f"Next service was due on {record.next_service_date}."
                )
                notif_type = "warning"
            else:
                days_until = (record.next_service_date - today).days
                title = "Maintenance Due Soon"
                message = (
                    f"Vehicle {reg} — {record.maintenance_type} is due in {days_until} day(s) "
                    f"(on {record.next_service_date})."
                )
                notif_type = "info"

            # Console log (always)
            print(f"[MAINTENANCE ALERT] {message}")

            # Write to notifications table to surface in the UI
            notification = Notification(
                notification_id=uuid.uuid4(),
                user_id=None,   # fleet-wide alert — not user-specific
                title=title,
                message=message,
                type=notif_type,
                is_read=False,
            )
            db.add(notification)
            alerts_triggered += 1

        db.commit()
        result_msg = f"Maintenance check complete — {alerts_triggered} alert(s) triggered"
        print(f"[CELERY] {result_msg}")
        return result_msg

    except Exception as e:
        db.rollback()
        print(f"[CELERY ERROR] check_maintenance_alerts failed: {e}")
        raise
    finally:
        db.close()
