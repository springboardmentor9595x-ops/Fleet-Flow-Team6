from datetime import datetime, timedelta, timezone
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.shipment import Shipment
from app.models.notification import Notification

@celery_app.task(name="app.tasks.shipments.check_delayed_shipments")
def check_delayed_shipments():
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        overdue = db.query(Shipment).filter(
            Shipment.status == "In Transit",
            Shipment.created_at <= cutoff,
        ).all()

        updated_count = 0
        for shipment in overdue:
            shipment.status = "Delayed"
            print(f"[SHIPMENT ALERT] Shipment {shipment.tracking_number} marked as Delayed (in transit > 24h)")

            notif_title = f"Shipment Delayed: {shipment.tracking_number}"
            existing_notif = db.query(Notification).filter(
                Notification.title == notif_title
            ).first()

            if not existing_notif:
                new_notif = Notification(
                    title=notif_title,
                    message=f"Shipment {shipment.tracking_number} from {shipment.source} to {shipment.destination} has been marked Delayed.",
                    type="shipment"
                )
                db.add(new_notif)

            updated_count += 1

        db.commit()
        return f"Checked shipments — {updated_count} shipment(s) marked Delayed"
    except Exception as e:
        db.rollback()
        print(f"Error checking delayed shipments: {e}")
        return f"Error checking shipments: {e}"
    finally:
        db.close()
