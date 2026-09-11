from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.gps_tracking import GPSCreate, GPSOut
from app.crud.gps_tracking import save_location, get_vehicle_locations
from app.models.trip import Trip, TripStatus
from app.models.notification import Notification
from app.models.vehicle import Vehicle
from app.services.route_service import recalculate_route_from_position

router = APIRouter()


@router.post("/", response_model=GPSOut)
def add_location(gps: GPSCreate, db: Session = Depends(get_db)):
    """
    Save a new GPS position for a vehicle.

    1. Persists the GPS location.
    2. If the vehicle currently has an In Transit trip, recalculates remaining distance and ETA.
    3. Geofencing check: detects when vehicle arrives at destination (remaining distance < 0.3 km)
       and generates an arrival event/notification.
    """
    saved = save_location(db, gps)

    # Recompute ETA and check geofence for active trip (In Transit)
    try:
        active_trip = (
            db.query(Trip)
            .filter(
                Trip.vehicle_id == gps.vehicle_id,
                Trip.status == TripStatus.InTransit,
            )
            .first()
        )

        if active_trip:
            route = recalculate_route_from_position(
                current_lat=gps.latitude,
                current_lon=gps.longitude,
                destination=active_trip.destination,
                route_type=active_trip.route_type or "Fastest",
            )
            active_trip.distance = route["distance"]
            active_trip.duration = route["duration"]
            active_trip.eta = datetime.fromisoformat(route["eta"])

            # Geofencing Event Detection: Arrived within 300 meters (0.3 km)
            if route["distance"] <= 0.3:
                vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == gps.vehicle_id).first()
                veh_name = vehicle.registration_number if vehicle else str(gps.vehicle_id)
                notif_title = f"Geofence Alert: Vehicle Arrived at Destination"
                notif_msg = f"Vehicle {veh_name} has arrived at destination: {active_trip.destination}."

                # Check if already notified
                existing_geofence = (
                    db.query(Notification)
                    .filter(
                        Notification.title == notif_title,
                        Notification.message == notif_msg,
                    )
                    .first()
                )
                if not existing_geofence:
                    geofence_notif = Notification(
                        user_id=active_trip.driver_id,
                        title=notif_title,
                        message=notif_msg,
                        type="success",
                        is_read=False,
                    )
                    db.add(geofence_notif)
                    print(f"[GEOFENCE EVENT] {notif_msg}")

            db.commit()
    except Exception as e:
        print(f"[WARN] ETA recalculation / geofencing failed: {e}")

    return saved


@router.get("/{vehicle_id}", response_model=list[GPSOut])
def vehicle_locations(vehicle_id: UUID, db: Session = Depends(get_db)):
    return get_vehicle_locations(db, vehicle_id)