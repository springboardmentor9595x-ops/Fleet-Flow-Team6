from datetime import date, timedelta
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models.maintenance import VehicleMaintenance
from app.models.notification import Notification
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.user import User, RoleEnum

@celery_app.task(name="app.tasks.maintenance.check_maintenance_alerts")
def check_maintenance_alerts():
    db = SessionLocal()
    try:
        today = date.today()
        # Query active maintenance records where status and resolution_status are not Resolved/Completed/Cancelled
        active_maintenance = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.resolution_status != "Resolved",
            VehicleMaintenance.status.not_in(["Completed", "Resolved", "Cancelled"])
        ).all()

        alerts_triggered = 0
        for record in active_maintenance:
            if not record.next_service_date:
                continue

            days_remaining = (record.next_service_date - today).days

            # Determine alert trigger condition:
            # 1. 5 days before service date
            # 2. 1 day before service date
            # 3. Due/Overdue (days_remaining <= 0): KEEP TRIGGERING UNTIL RESOLVED
            should_notify = False
            notif_title = ""
            notif_msg = ""
            alert_kind = "warning"

            vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == record.vehicle_id).first()
            v_reg = vehicle.registration_number if vehicle else f"VEH-{str(record.vehicle_id)[:6].upper()}"

            if days_remaining == 5:
                should_notify = True
                notif_title = f"Maintenance Warning: 5 Days Before Service ({v_reg})"
                notif_msg = f"Vehicle {v_reg} ({record.maintenance_type}) is scheduled for service in 5 days (Date: {record.next_service_date})."
                alert_kind = "info"
            elif days_remaining == 1:
                should_notify = True
                notif_title = f"Maintenance Alert: 1 Day Before Service ({v_reg})"
                notif_msg = f"Urgent: Vehicle {v_reg} ({record.maintenance_type}) is scheduled for service tomorrow ({record.next_service_date})."
                alert_kind = "warning"
            elif days_remaining <= 0:
                should_notify = True
                notif_title = f"OVERDUE Maintenance Alert: Vehicle {v_reg} Due Service!"
                notif_msg = f"ALERT: Vehicle {v_reg} ({record.maintenance_type}) service is DUE/OVERDUE ({record.next_service_date}). Status is unresolved."
                alert_kind = "warning"

            if should_notify:
                # Find target recipients: Driver assigned to vehicle & all Dispatchers
                target_user_ids = set()
                if vehicle and vehicle.assigned_driver:
                    driver = db.query(Driver).filter(Driver.driver_id == vehicle.assigned_driver).first()
                    if driver and driver.user_id:
                        target_user_ids.add(driver.user_id)

                dispatchers = db.query(User).filter(User.role == RoleEnum.Dispatcher).all()
                for d in dispatchers:
                    target_user_ids.add(d.user_id)

                # Send notifications to each recipient
                for u_id in target_user_ids:
                    # For 5-day / 1-day reminders, check if already sent today to prevent duplicate spamming
                    if days_remaining > 0:
                        existing = db.query(Notification).filter(
                            Notification.user_id == u_id,
                            Notification.title == notif_title,
                            Notification.message.like(f"%{record.next_service_date}%")
                        ).first()
                        if existing:
                            continue

                    new_notif = Notification(
                        user_id=u_id,
                        title=notif_title,
                        message=notif_msg,
                        type=alert_kind
                    )
                    db.add(new_notif)
                    alerts_triggered += 1

                # Driver 1-day prior email notification
                if days_remaining == 1 and vehicle and vehicle.assigned_driver:
                    driver = db.query(Driver).filter(Driver.driver_id == vehicle.assigned_driver).first()
                    if driver and driver.user_id:
                        driver_user = db.query(User).filter(User.user_id == driver.user_id).first()
                        if driver_user and driver_user.email:
                            try:
                                from app.services.email_service import send_maintenance_reminder_email
                                send_maintenance_reminder_email(
                                    email=driver_user.email,
                                    name=driver_user.full_name,
                                    vehicle_reg=v_reg,
                                    maintenance_type=record.maintenance_type,
                                    service_date=str(record.next_service_date)
                                )
                            except Exception as email_ex:
                                print(f"Email reminder exception for driver {driver_user.email}: {email_ex}")

                # Also create a system-wide notification (user_id=None) if target_user_ids is empty
                if not target_user_ids:
                    new_notif = Notification(
                        user_id=None,
                        title=notif_title,
                        message=notif_msg,
                        type=alert_kind
                    )
                    db.add(new_notif)
                    alerts_triggered += 1

        db.commit()
        return f"Checked maintenance — {len(active_maintenance)} record(s) checked, {alerts_triggered} alert notification(s) sent."
    except Exception as e:
        db.rollback()
        print(f"Error checking maintenance alerts: {e}")
        return f"Error checking maintenance: {e}"
    finally:
        db.close()
