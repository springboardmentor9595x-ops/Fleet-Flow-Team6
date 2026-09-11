from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.trip import TripCreate, TripUpdate, TripOut
from app.crud.trip import (
    create_trip,
    get_all_trips,
    get_trip,
    update_trip,
    delete_trip,
)
from app.models.trip import TripStatus
from app.models.shipment import ShipmentStatus, Shipment
from app.models.vehicle import VehicleStatus, Vehicle
from app.models.driver import Driver
from app.models.gps_tracking import GPSTracking
from app.models.user import User, RoleEnum
from app.models.trip import Trip
from app.services.route_service import calculate_route, recalculate_route_from_position, calculate_route_with_waypoints
from app.services.notification_service import create_notification, create_broadcast_notification
from app.core.deps import get_current_user, require_roles

router = APIRouter()


def _resolve_driver_id(db: Session, driver_id_or_user_id: UUID) -> UUID:
    """
    The trips.driver_id FK in PostgreSQL references drivers(driver_id).
    The frontend may send either driver_id or user_id.  This helper
    ensures we always store the correct driver_id.
    """
    # First check if the supplied ID is already a valid driver_id
    driver = db.query(Driver).filter(Driver.driver_id == driver_id_or_user_id).first()
    if driver:
        return driver.driver_id
    # Otherwise look it up via user_id
    driver = db.query(Driver).filter(Driver.user_id == driver_id_or_user_id).first()
    if driver:
        return driver.driver_id
    raise HTTPException(status_code=404, detail="Driver not found.")


# ==========================================================
# BASIC CRUD
# ==========================================================

@router.post("/", response_model=TripOut)
def add_trip(
    trip: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Dispatcher")),
):
    """Create a trip.  Route metrics are auto-calculated via OSRM."""
    # Check if vehicle is already assigned or in transit
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
    if vehicle and vehicle.status != VehicleStatus.Available:
        status_label = vehicle.status.value if hasattr(vehicle.status, 'value') else str(vehicle.status)
        raise HTTPException(
            status_code=400,
            detail=f"Vehicle is currently '{status_label}' and cannot be scheduled. Only 'Available' vehicles can be assigned to new trips."
        )

    # Resolve driver_id: frontend may pass user_id, but DB FK expects drivers.driver_id
    resolved_driver_id = _resolve_driver_id(db, trip.driver_id)
    trip_data = trip.model_copy(update={"driver_id": resolved_driver_id})

    new_t = create_trip(db, trip_data)

    # Persist waypoints on the trip record if provided
    if trip.waypoints:
        new_t.waypoints = trip.waypoints
        db.commit()
        db.refresh(new_t)

    out = TripOut.model_validate(new_t)
    if new_t.start_location and new_t.destination:
        try:
            if new_t.waypoints:
                route_res = calculate_route_with_waypoints(
                    new_t.start_location, new_t.destination,
                    new_t.waypoints, new_t.route_type or "Fastest",
                )
            else:
                route_res = calculate_route(new_t.start_location, new_t.destination, new_t.route_type or "Fastest")
            out.geometry = route_res.get("geometry", [])
            out.start_coords = route_res.get("start_coords")
            out.destination_coords = route_res.get("destination_coords")
            out.route_options = route_res.get("route_options")
        except Exception as e:
            print(f"[WARN] Route calculation failed for new trip: {e}")
    return out


@router.get("/", response_model=list[TripOut])
def list_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        trips = db.query(Trip).filter(Trip.driver_id == driver.driver_id).all()
    else:
        trips = get_all_trips(db)

    results = []
    for t in trips:
        out = TripOut.model_validate(t)
        if t.start_location and t.destination:
            try:
                route_res = calculate_route(t.start_location, t.destination, t.route_type or "Fastest")
                out.geometry = route_res.get("geometry", [])
                out.start_coords = route_res.get("start_coords")
                out.destination_coords = route_res.get("destination_coords")
                out.route_options = route_res.get("route_options")
            except Exception:
                pass
        results.append(out)
    return results


@router.get("/{trip_id}", response_model=TripOut)
def trip_details(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or trip.driver_id != driver.driver_id:
            raise HTTPException(
                status_code=403,
                detail="Access forbidden: You can only view your own trips"
            )

    out = TripOut.model_validate(trip)
    if trip.start_location and trip.destination:
        try:
            route_res = calculate_route(trip.start_location, trip.destination, trip.route_type or "Fastest")
            out.geometry = route_res.get("geometry", [])
            out.start_coords = route_res.get("start_coords")
            out.destination_coords = route_res.get("destination_coords")
            out.route_options = route_res.get("route_options")
        except Exception:
            pass
    return out


@router.put("/{trip_id}", response_model=TripOut)
def edit_trip(
    trip_id: UUID,
    trip: TripUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Dispatcher")),
):
    updated = update_trip(db, trip_id, trip)
    if not updated:
        raise HTTPException(status_code=404, detail="Trip not found")
    return updated


@router.delete("/{trip_id}")
def remove_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager")),
):
    deleted = delete_trip(db, trip_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"message": "Trip deleted successfully"}


@router.put("/{trip_id}/start", response_model=TripOut)
def start_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Dispatchers cannot start trips"
        )

    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or trip.driver_id != driver.driver_id:
            raise HTTPException(
                status_code=403,
                detail="Access forbidden: Drivers can only start their own trips"
            )

    if trip.status != TripStatus.Scheduled:
        raise HTTPException(
            status_code=400,
            detail=f"Trip is already {trip.status.value}. Only Scheduled trips can be started.",
        )

    # Update trip
    trip.status = TripStatus.InTransit
    trip.start_time = datetime.utcnow()

    # Lock vehicle
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
    if vehicle:
        vehicle.status = VehicleStatus.InTransit

    # Mark driver on trip
    driver = db.query(Driver).filter(
        (Driver.driver_id == trip.driver_id) | (Driver.user_id == trip.driver_id)
    ).first()
    if driver:
        driver.status = "On Trip"

    # Update linked shipment
    shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
    if shipment:
        shipment.status = ShipmentStatus.InTransit

    db.commit()
    db.refresh(trip)

    out = TripOut.model_validate(trip)
    if trip.start_location and trip.destination:
        try:
            route_res = calculate_route(trip.start_location, trip.destination, trip.route_type or "Fastest")
            out.geometry = route_res.get("geometry", [])
            out.start_coords = route_res.get("start_coords")
            out.destination_coords = route_res.get("destination_coords")
            out.route_options = route_res.get("route_options")
        except Exception:
            pass
    return out


# ==========================================================
# END TRIP
# Sets trip → Completed; shipment → Delivered; vehicle → Available; driver → Available
# ==========================================================

@router.put("/{trip_id}/end", response_model=TripOut)
def end_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Dispatchers cannot end trips"
        )

    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or trip.driver_id != driver.driver_id:
            raise HTTPException(
                status_code=403,
                detail="Access forbidden: Drivers can only end their own trips"
            )

    if trip.status != TripStatus.InTransit:
        raise HTTPException(
            status_code=400,
            detail=f"Trip is currently {trip.status.value}. Only In Transit trips can be ended.",
        )

    # Record actual end time
    trip.status = TripStatus.Completed
    trip.end_time = datetime.utcnow()

    # Free vehicle
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
    if vehicle:
        vehicle.status = VehicleStatus.Available

    # Free driver
    driver = db.query(Driver).filter(
        (Driver.driver_id == trip.driver_id) | (Driver.user_id == trip.driver_id)
    ).first()
    if driver:
        driver.status = "Available"

    # Mark shipment delivered
    shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
    if shipment:
        shipment.status = ShipmentStatus.Delivered

    # --- Notification: Delivery ---
    # Notify the driver personally
    if driver and driver.user_id:
        create_notification(
            db,
            title=f"Delivery Completed",
            message=f"Trip to {trip.destination} has been marked as Delivered. Great work!",
            type="success",
            user_id=driver.user_id,
        )
    # Broadcast for Admin/FleetManager/Dispatcher
    tracking = shipment.tracking_number if shipment else str(trip.shipment_id)
    create_broadcast_notification(
        db,
        title=f"Shipment Delivered: {tracking}",
        message=f"Trip #{str(trip.trip_id)[:8]} to {trip.destination} completed successfully.",
        type="success",
    )

    db.commit()
    db.refresh(trip)

    out = TripOut.model_validate(trip)
    if trip.start_location and trip.destination:
        try:
            route_res = calculate_route(trip.start_location, trip.destination, trip.route_type or "Fastest")
            out.geometry = route_res.get("geometry", [])
            out.start_coords = route_res.get("start_coords")
            out.destination_coords = route_res.get("destination_coords")
            out.route_options = route_res.get("route_options")
        except Exception:
            pass
    return out


# ==========================================================
# OPTIMIZE / SET ROUTE  (manual route-type selection)
# ==========================================================

@router.post("/{trip_id}/route", response_model=TripOut)
def optimize_route(
    trip_id: UUID,
    route_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Dispatcher")),
):
    """
    Recalculate route from the original start_location → destination using the
    requested route_type (Fastest / Shortest / Traffic Avoidance / Fuel-Efficient).
    """
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    result = calculate_route(trip.start_location, trip.destination, route_type)

    trip.distance = result["distance"]
    trip.duration = result["duration"]
    trip.eta = datetime.fromisoformat(result["eta"])
    trip.route_type = result["route_type"]

    db.commit()
    db.refresh(trip)

    # Attach geometry and route options to the response so the frontend map can render it
    out = TripOut.model_validate(trip)
    out.geometry = result.get("geometry", [])
    out.start_coords = result.get("start_coords")
    out.destination_coords = result.get("destination_coords")
    out.route_options = result.get("route_options")
    return out


# ==========================================================
# RECALCULATE ROUTE  (mid-trip: from current GPS position)
# ==========================================================

@router.post("/{trip_id}/recalculate", response_model=TripOut)
def recalculate_route(
    trip_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Admin", "FleetManager", "Dispatcher")),
):
    """
    Triggered when the vehicle deviates from the planned route or when a stop
    is added/removed mid-trip.

    1. Fetches the vehicle's latest GPS location from the database.
    2. Recalculates the route from that position to the original destination.
    3. Updates the trip's remaining distance, duration, and ETA.

    Falls back to the original start_location if no GPS data is available.
    """
    trip = get_trip(db, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Get the latest GPS reading for this vehicle
    latest_gps = (
        db.query(GPSTracking)
        .filter(GPSTracking.vehicle_id == trip.vehicle_id)
        .order_by(GPSTracking.recorded_time.desc())
        .first()
    )

    if latest_gps:
        result = recalculate_route_from_position(
            current_lat=latest_gps.latitude,
            current_lon=latest_gps.longitude,
            destination=trip.destination,
            route_type=trip.route_type or "Fastest",
        )
    else:
        # Fallback: recalculate from original start_location
        result = calculate_route(trip.start_location, trip.destination, trip.route_type or "Fastest")

    trip.distance = result["distance"]
    trip.duration = result["duration"]
    trip.eta = datetime.fromisoformat(result["eta"])

    # --- Notification: Route Recalculated ---
    # Notify the driver on this trip
    trip_driver = db.query(Driver).filter(
        (Driver.driver_id == trip.driver_id) | (Driver.user_id == trip.driver_id)
    ).first()
    if trip_driver and trip_driver.user_id:
        create_notification(
            db,
            title="Route Updated",
            message=f"Your route to {trip.destination} has been recalculated. New ETA: {trip.eta.strftime('%H:%M') if trip.eta else 'TBD'}.",
            type="info",
            user_id=trip_driver.user_id,
        )
    # Also broadcast so fleet can see it
    create_broadcast_notification(
        db,
        title=f"Route Recalculated: Trip #{str(trip.trip_id)[:8]}",
        message=f"Mid-trip route recalculation to {trip.destination}. Updated ETA: {trip.eta.strftime('%Y-%m-%d %H:%M') if trip.eta else 'N/A'}.",
        type="info",
    )

    db.commit()
    db.refresh(trip)

    out = TripOut.model_validate(trip)
    out.geometry = result.get("geometry", [])
    out.start_coords = result.get("start_coords")
    out.destination_coords = result.get("destination_coords")
    out.route_options = result.get("route_options")
    return out