"""
Celery task: Identify shipments that have been "In Transit" for more
than 24 hours and mark them as "Delayed". Also writes a notification.

NOTE: Uses SessionLocal() directly — Celery tasks are outside FastAPI's
dependency injection lifecycle.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.celery_app import celery_app
from database import SessionLocal
from app.models.shipment import Shipment
from app.models.notification import Notification


@celery_app.task(name="app.tasks.shipments.check_delayed_shipments")
def check_delayed_shipments():
    db = SessionLocal()
    try:
        # Threshold: shipments In Transit for more than 24 hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        overdue_shipments = db.query(Shipment).filter(
            Shipment.status == "In Transit",
            Shipment.created_at <= cutoff,
        ).all()

        marked = 0
        for shipment in overdue_shipments:
            shipment.status = "Delayed"
            message = (
                f"Shipment {shipment.tracking_number} ({shipment.source} → {shipment.destination}) "
                f"has been in transit for more than 24 hours and is now marked as Delayed."
            )
            print(f"[SHIPMENT ALERT] {message}")

            notification = Notification(
                notification_id=uuid.uuid4(),
                user_id=None,
                title="Shipment Delayed",
                message=message,
                type="warning",
                is_read=False,
            )
            db.add(notification)
            marked += 1

        db.commit()
        result_msg = f"Shipment delay check complete — {marked} shipment(s) marked Delayed"
        print(f"[CELERY] {result_msg}")
        return result_msg

    except Exception as e:
        db.rollback()
        print(f"[CELERY ERROR] check_delayed_shipments failed: {e}")
        raise
    finally:
        db.close()
