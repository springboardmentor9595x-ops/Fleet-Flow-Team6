from datetime import datetime

from sqlalchemy.orm import Session

from app.models.trip import Trip, TripStatus
from app.schemas.trip import TripCreate, TripUpdate
from app.models.vehicle import VehicleStatus, Vehicle
from app.models.shipment import ShipmentStatus, Shipment
from app.services.route_service import calculate_route


def create_trip(db: Session, trip: TripCreate):
    """
    Create a new trip.  Route distance, duration, and ETA are automatically
    calculated via OSRM/Haversine so that the trip record is immediately
    populated on creation.
    """
    trip_data = trip.model_dump()

    # Auto-generate route metrics if not supplied by the caller
    if not trip_data.get("distance"):
        try:
            route = calculate_route(
                trip_data["start_location"],
                trip_data["destination"],
                trip_data.get("route_type") or "Fastest",
            )
            trip_data["distance"] = route["distance"]
            trip_data["duration"] = route["duration"]
            trip_data["eta"] = datetime.fromisoformat(route["eta"])
        except Exception as e:
            print(f"[WARN] Auto route calculation failed on trip create: {e}")

    new_trip = Trip(**trip_data)
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    return new_trip


def get_all_trips(db: Session):
    return db.query(Trip).all()


def get_trip(db: Session, trip_id):
    return db.query(Trip).filter(Trip.trip_id == trip_id).first()


def update_trip(db: Session, trip_id, trip: TripUpdate):
    db_trip = get_trip(db, trip_id)

    if not db_trip:
        return None

    for key, value in trip.model_dump(exclude_unset=True).items():
        setattr(db_trip, key, value)

    db.commit()
    db.refresh(db_trip)
    return db_trip


def delete_trip(db: Session, trip_id):
    db_trip = get_trip(db, trip_id)

    if not db_trip:
        return None

    # Free the vehicle when a scheduled trip is deleted
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == db_trip.vehicle_id
    ).first()

    if vehicle:
        vehicle.status = VehicleStatus.Available

    db.delete(db_trip)
    db.commit()
    return True