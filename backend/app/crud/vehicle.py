from sqlalchemy.orm import Session
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def create_vehicle(db: Session, vehicle: VehicleCreate):
    db_vehicle = Vehicle(
        registration_number=vehicle.registration_number,
        vehicle_type=vehicle.vehicle_type,
        brand=vehicle.brand,
        model=vehicle.model,
        manufacture_year=vehicle.manufacture_year,
        fuel_type=vehicle.fuel_type,
        capacity=vehicle.capacity,
        assigned_driver=vehicle.assigned_driver,
        status=vehicle.status,
    )

    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


def get_all_vehicles(db: Session):
    return db.query(Vehicle).all()


def get_vehicle(db: Session, vehicle_id):
    return (
        db.query(Vehicle)
        .filter(Vehicle.vehicle_id == vehicle_id)
        .first()
    )


def update_vehicle(db: Session, vehicle_id, vehicle: VehicleUpdate):
    db_vehicle = get_vehicle(db, vehicle_id)

    if not db_vehicle:
        return None

    update_data = vehicle.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_vehicle, key, value)

    db.commit()
    db.refresh(db_vehicle)

    return db_vehicle


def delete_vehicle(db: Session, vehicle_id):
    db_vehicle = get_vehicle(db, vehicle_id)

    if not db_vehicle:
        return None

    db.delete(db_vehicle)
    db.commit()

    return db_vehicle