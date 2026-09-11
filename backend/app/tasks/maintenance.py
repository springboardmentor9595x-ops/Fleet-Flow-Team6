from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.maintenance import VehicleMaintenance
from app.models.vehicle import Vehicle
from app.models.notification import Notification
from datetime import date, timedelta, datetime

@celery_app.task(name="app.tasks.maintenance.check_maintenance_alerts")
def check_maintenance_alerts():
    db = SessionLocal()
    try:
        today = date.today()
        records = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.next_service_date != None,
            VehicleMaintenance.is_resolved == False,
        ).all()

        triggered_count = 0

        for record in records:
            days_diff = (record.next_service_date - today).days
            should_trigger = False
            is_overdue = False
            bypass_deduplication = False
            alert_title = ""
            alert_msg = ""

            if days_diff == 5:
                should_trigger = True
                alert_title = f"Maintenance Upcoming (5 days): {record.vehicle_id}"
                alert_msg = f"Vehicle service ({record.maintenance_type or 'General Inspection'}) is due in 5 days on {record.next_service_date}."
            elif days_diff == 1:
                should_trigger = True
                alert_title = f"Maintenance Upcoming (1 day): {record.vehicle_id}"
                alert_msg = f"Vehicle service ({record.maintenance_type or 'General Inspection'}) is due in 1 day on {record.next_service_date}."
            elif days_diff <= 0:
                should_trigger = True
                is_overdue = True
                bypass_deduplication = True
                alert_title = f"Maintenance Overdue: {record.vehicle_id}"
                alert_msg = f"Vehicle service ({record.maintenance_type or 'General Inspection'}) is OVERDUE (due on {record.next_service_date}) and is not resolved."

            if should_trigger:
                vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).first()
                veh_name = vehicle.registration_number if vehicle else str(record.vehicle_id)
                
                alert_title = alert_title.replace(str(record.vehicle_id), veh_name)
                alert_msg = alert_msg.replace(str(record.vehicle_id), veh_name)

                print(f"[MAINTENANCE ALERT] {alert_msg}")

                if bypass_deduplication:
                    existing = None
                else:
                    cutoff = datetime.utcnow() - timedelta(days=1)
                    existing = db.query(Notification).filter(
                        Notification.title == alert_title,
                        Notification.created_at >= cutoff,
                    ).first()

                if not existing:
                    notif = Notification(
                        user_id=None,
                        title=alert_title,
                        message=alert_msg,
                        type="warning" if is_overdue else "info",
                        is_read=False,
                        created_at=datetime.utcnow(),
                    )
                    db.add(notif)
                    triggered_count += 1

        db.commit()
        return f"Checked maintenance — {triggered_count} alert(s) triggered"
    finally:
        db.close()
