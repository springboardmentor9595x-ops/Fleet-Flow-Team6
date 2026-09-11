from uuid import UUID

from sqlalchemy.orm import Session

from app.models.gps_tracking import GPSTracking
from app.schemas.gps_tracking import GPSCreate


def save_location(
    db: Session,
    gps: GPSCreate
):
    new_location = GPSTracking(
        **gps.model_dump()
    )

    db.add(new_location)
    db.commit()
    db.refresh(new_location)

    return new_location


def get_vehicle_locations(
    db: Session,
    vehicle_id: UUID
):
    return (
        db.query(GPSTracking)
        .filter(
            GPSTracking.vehicle_id == vehicle_id
        )
        .order_by(
            GPSTracking.recorded_time.desc()
        )
        .all()
    )