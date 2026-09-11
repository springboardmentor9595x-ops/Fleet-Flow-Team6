from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.shipment import Shipment, ShipmentStatus
from app.models.notification import Notification
from datetime import datetime, timedelta


@celery_app.task(name="app.tasks.shipments.check_delayed_shipments")
def check_delayed_shipments():
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)  # adjust threshold as needed
        overdue = db.query(Shipment).filter(
            Shipment.status == ShipmentStatus.InTransit,
            Shipment.created_at <= cutoff,
        ).all()

        for shipment in overdue:
            shipment.status = ShipmentStatus.Delayed
            print(f"[SHIPMENT ALERT] {shipment.tracking_number} marked as Delayed")

            # Insert a Notification record so the bell catches it
            notif = Notification(
                user_id=None,  # broadcast
                title=f"Shipment Auto-Delayed: {shipment.tracking_number}",
                message=(
                    f"Shipment {shipment.tracking_number} "
                    f"(to {shipment.destination}) has been automatically "
                    f"marked as Delayed after 24 hours in transit."
                ),
                type="warning",
                is_read=False,
                created_at=datetime.utcnow(),
            )
            db.add(notif)

        db.commit()
        return f"Checked shipments — {len(overdue)} marked Delayed"
    finally:
        db.close()
