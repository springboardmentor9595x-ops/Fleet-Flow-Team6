import logging
from datetime import date, datetime, timedelta
from typing import Dict, Any

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.maintenance import VehicleMaintenance
from app.models.vehicle import Vehicle
from app.models.notification import Notification
from app.services.webhook_service import send_webhook_alert

logger = logging.getLogger("fleetflow.celery.maintenance")


@celery_app.task(name="app.tasks.maintenance_tasks.check_maintenance_alerts_task")
def check_maintenance_alerts_task(days_ahead: int = 7) -> Dict[str, Any]:
    """
    Periodic/Background task that:
    1. Identifies vehicles with next_service_date approaching (<= days_ahead) or overdue, where is_resolved is False.
    2. Logs alerts to console/logger.
    3. Saves alerts to Notifications table (with 24-hour deduplication for upcoming, and always for overdue).
    """
    db = SessionLocal()
    today = date.today()
    alerts_created = 0
    overdue_count = 0
    upcoming_count = 0

    try:
        # Find all records with next_service_date where is_resolved is False
        records = (
            db.query(VehicleMaintenance)
            .filter(
                VehicleMaintenance.next_service_date != None,
                VehicleMaintenance.is_resolved == False,
            )
            .all()
        )

        for rec in records:
            days_diff = (rec.next_service_date - today).days

            # Skip if it is further out than days_ahead
            if days_diff > days_ahead:
                continue

            should_trigger = False
            is_overdue = False
            bypass_deduplication = False
            alert_title = ""
            alert_msg = ""
            alert_type = "info"

            vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == rec.vehicle_id).first()
            veh_reg = vehicle.registration_number if vehicle else str(rec.vehicle_id)

            if days_diff == 5:
                should_trigger = True
                upcoming_count += 1
                alert_type = "info"
                alert_title = f"Maintenance Upcoming (5 days): {veh_reg}"
                alert_msg = (
                    f"Vehicle {veh_reg} maintenance '{rec.maintenance_type or 'Service'}' "
                    f"is due in 5 days on {rec.next_service_date}."
                )
            elif days_diff == 1:
                should_trigger = True
                upcoming_count += 1
                alert_type = "info"
                alert_title = f"Maintenance Upcoming (1 day): {veh_reg}"
                alert_msg = (
                    f"Vehicle {veh_reg} maintenance '{rec.maintenance_type or 'Service'}' "
                    f"is due tomorrow on {rec.next_service_date}."
                )
            elif days_diff <= 0:
                should_trigger = True
                overdue_count += 1
                is_overdue = True
                bypass_deduplication = True
                alert_type = "warning"
                alert_title = f"Maintenance Overdue: {veh_reg}"
                alert_msg = (
                    f"Vehicle {veh_reg} maintenance '{rec.maintenance_type or 'Service'}' "
                    f"is OVERDUE (due on {rec.next_service_date}) and is not resolved."
                )

            if should_trigger:
                if bypass_deduplication:
                    existing_alert = None
                else:
                    # Avoid duplicate alerts created in the past 24 hours
                    cutoff = datetime.utcnow() - timedelta(days=1)
                    existing_alert = (
                        db.query(Notification)
                        .filter(
                            Notification.title == alert_title,
                            Notification.created_at >= cutoff,
                        )
                        .first()
                    )

                if not existing_alert:
                    notif = Notification(
                        user_id=None,  # Broadcast to Fleet Managers / Admins
                        title=alert_title,
                        message=alert_msg,
                        type=alert_type,
                        is_read=False,
                        created_at=datetime.utcnow(),
                    )
                    db.add(notif)
                    alerts_created += 1
                    logger.warning(f"[MAINTENANCE ALERT] {alert_msg}")
                    print(f"[CELERY WORKER ALERT] {alert_msg}")

                    # Broadcast to Slack / Discord webhook (if configured)
                    send_webhook_alert(alert_title, alert_msg, alert_type)

        db.commit()
        summary = {
            "status": "success",
            "checked_at": datetime.utcnow().isoformat(),
            "total_pending_checked": len(records),
            "overdue_count": overdue_count,
            "upcoming_count": upcoming_count,
            "alerts_created": alerts_created,
        }
        logger.info(f"Maintenance check task completed: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Error in check_maintenance_alerts_task: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.maintenance_tasks.generate_maintenance_fleet_report_task")
def generate_maintenance_fleet_report_task() -> Dict[str, Any]:
    """
    Compiles a fleet-wide maintenance health summary and creates a system broadcast notification.
    """
    db = SessionLocal()
    today = date.today()
    try:
        total_records = db.query(VehicleMaintenance).count()
        in_progress = db.query(VehicleMaintenance).filter(VehicleMaintenance.status == "In Progress").count()
        overdue = (
            db.query(VehicleMaintenance)
            .filter(
                VehicleMaintenance.next_service_date != None,
                VehicleMaintenance.next_service_date < today,
                VehicleMaintenance.status != "Completed",
            )
            .count()
        )

        title = "Daily Fleet Maintenance Summary"
        message = (
            f"Fleet status: {in_progress} vehicles currently in service, "
            f"{overdue} records overdue for maintenance across {total_records} total tracked services."
        )

        notif = Notification(
            user_id=None,
            title=title,
            message=message,
            type="info",
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notif)
        db.commit()

        print(f"[CELERY DAILY REPORT] {message}")
        return {"status": "success", "in_progress": in_progress, "overdue": overdue}
    except Exception as e:
        db.rollback()
        return {"status": "error", "error": str(e)}
    finally:
        db.close()
