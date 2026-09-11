"""
Fuel Efficiency Alerts — Celery Task
-------------------------------------
Periodically checks each vehicle's average fuel efficiency (km per litre)
against a configurable baseline. Vehicles that fall below the threshold
trigger an alert notification visible to Admins and Fleet Managers.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.vehicle import Vehicle
from app.models.fuel_record import FuelRecord
from app.models.trip import Trip, TripStatus
from app.models.notification import Notification

from sqlalchemy import func

logger = logging.getLogger("fleetflow.celery.fuel_alerts")

# Baseline from .env — vehicles averaging fewer km/L than this will be flagged
BASELINE_KM_PER_L = float(os.getenv("FUEL_EFFICIENCY_BASELINE_KM_PER_L", "8.0"))


@celery_app.task(name="app.tasks.fuel_alert_task.check_fuel_efficiency_alerts")
def check_fuel_efficiency_alerts() -> Dict[str, Any]:
    """
    For every vehicle with at least one fuel record:
      1. Total fuel consumed (litres) from fuel_records
      2. Total distance driven (km) from completed trips
      3. Compute efficiency = total_distance / total_fuel
      4. If efficiency < BASELINE_KM_PER_L  →  create a Notification alert
    """
    db = SessionLocal()
    alerts_created = 0
    vehicles_checked = 0
    flagged_vehicles = []
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    try:
        vehicles = db.query(Vehicle).all()

        for vehicle in vehicles:
            # Total distance from completed trips
            total_distance = (
                db.query(func.sum(Trip.distance))
                .filter(
                    Trip.vehicle_id == vehicle.vehicle_id,
                    Trip.status == TripStatus.Completed,
                    Trip.start_time >= thirty_days_ago,
                )
                .scalar()
                or 0.0
            )

            # Total fuel consumed
            total_fuel = (
                db.query(func.sum(FuelRecord.fuel_amount))
                .filter(
                    FuelRecord.vehicle_id == vehicle.vehicle_id,
                    FuelRecord.refill_date >= thirty_days_ago.date(),
                )
                .scalar()
                or 0.0
            )
            if not total_fuel or float(total_fuel) <= 0 or not total_distance or float(total_distance) <= 0:
                continue

            vehicles_checked += 1
            efficiency = round(float(total_distance) / float(total_fuel), 2)

            if efficiency < BASELINE_KM_PER_L:
                reg = vehicle.registration_number or str(vehicle.vehicle_id)[:8]
                title = f"Low Fuel Efficiency Alert: {reg}"
                message = (
                    f"Vehicle {reg} is averaging {efficiency} km/L, which is below "
                    f"the baseline of {BASELINE_KM_PER_L} km/L. "
                    f"Consider scheduling a preventative engine checkup."
                )

                # Deduplicate: don't create if same alert exists in last 24 hours
                cutoff = datetime.utcnow() - timedelta(days=1)
                existing = (
                    db.query(Notification)
                    .filter(
                        Notification.title == title,
                        Notification.created_at >= cutoff,
                    )
                    .first()
                )

                if not existing:
                    notif = Notification(
                        user_id=None,  # broadcast
                        title=title,
                        message=message,
                        type="warning",
                        is_read=False,
                        created_at=datetime.utcnow(),
                    )
                    db.add(notif)
                    alerts_created += 1
                    flagged_vehicles.append({"reg": reg, "efficiency": efficiency})
                    logger.warning(f"[FUEL ALERT] {message}")
                    print(f"[CELERY FUEL ALERT] {message}")

        db.commit()

        summary = {
            "status": "success",
            "checked_at": datetime.utcnow().isoformat(),
            "vehicles_checked": vehicles_checked,
            "alerts_created": alerts_created,
            "flagged_vehicles": flagged_vehicles,
            "baseline_km_per_l": BASELINE_KM_PER_L,
        }
        logger.info(f"Fuel efficiency check completed: {summary}")
        return summary

    except Exception as e:
        db.rollback()
        logger.error(f"Error in check_fuel_efficiency_alerts: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()
