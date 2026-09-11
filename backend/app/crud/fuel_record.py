from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.fuel_record import FuelRecord
from app.models.trip import Trip, TripStatus
from app.schemas.fuel_record import FuelRecordCreate


# ==========================================================
# CREATE
# ==========================================================

def create_fuel_record(db: Session, data: FuelRecordCreate) -> FuelRecord:
    record = FuelRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ==========================================================
# GET ALL (optionally filtered by vehicle)
# ==========================================================

def get_all_fuel_records(db: Session, vehicle_id=None):
    q = db.query(FuelRecord)
    if vehicle_id:
        q = q.filter(FuelRecord.vehicle_id == vehicle_id)
    return q.order_by(FuelRecord.refill_date.desc()).all()


# ==========================================================
# GET ONE
# ==========================================================

def get_fuel_record(db: Session, fuel_id):
    return db.query(FuelRecord).filter(
        FuelRecord.fuel_id == fuel_id
    ).first()


# ==========================================================
# FUEL EFFICIENCY ANALYTICS
# fuel_efficiency = total_trip_distance / total_fuel_amount
# (km per litre per vehicle)
# ==========================================================

def get_fuel_efficiency(db: Session):
    """
    Returns a list of dicts: {vehicle_id, total_fuel, total_cost, total_distance, km_per_litre}
    Distance comes from the Trips table (OSRM-calculated, reliable).
    """
    fuel_stats = (
        db.query(
            FuelRecord.vehicle_id,
            func.sum(FuelRecord.fuel_amount).label("total_fuel"),
            func.sum(FuelRecord.fuel_cost).label("total_cost"),
        )
        .group_by(FuelRecord.vehicle_id)
        .all()
    )

    trip_distance = (
        db.query(
            Trip.vehicle_id,
            func.sum(Trip.distance).label("total_distance"),
        )
        .filter(
            Trip.status == TripStatus.Completed,
            Trip.distance != None,
        )
        .group_by(Trip.vehicle_id)
        .all()
    )

    distance_map = {str(r.vehicle_id): float(r.total_distance or 0) for r in trip_distance}

    result = []
    for row in fuel_stats:
        vid = str(row.vehicle_id)
        total_fuel = float(row.total_fuel or 0)
        total_cost = float(row.total_cost or 0)
        total_dist = distance_map.get(vid, 0.0)
        km_per_litre = round(total_dist / total_fuel, 2) if total_fuel > 0 else None

        result.append({
            "vehicle_id": vid,
            "total_fuel_litres": round(total_fuel, 2),
            "total_cost": round(total_cost, 2),
            "total_distance_km": round(total_dist, 2),
            "km_per_litre": km_per_litre,
        })

    return result


# ==========================================================
# COST TRENDS (monthly)
# ==========================================================

def get_fuel_cost_trends(db: Session):
    """Monthly fuel cost totals across the fleet."""
    rows = (
        db.query(
            func.date_trunc("month", FuelRecord.refill_date).label("month"),
            func.sum(FuelRecord.fuel_cost).label("total_cost"),
            func.sum(FuelRecord.fuel_amount).label("total_fuel"),
        )
        .filter(FuelRecord.refill_date != None)
        .group_by(func.date_trunc("month", FuelRecord.refill_date))
        .order_by(func.date_trunc("month", FuelRecord.refill_date))
        .all()
    )

    return [
        {
            "month": str(r.month)[:7] if r.month else None,
            "total_cost": float(r.total_cost or 0),
            "total_fuel": float(r.total_fuel or 0),
        }
        for r in rows
    ]
