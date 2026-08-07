import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, text

from database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate, ShipmentResponse

router = APIRouter(
    prefix="/shipments",
    tags=["Shipment Tracking"]
)


def build_shipment_response(shipment: Shipment, db: Session) -> dict:
    """Helper to build ShipmentResponse dict with expanded relationships and active trip info."""
    vehicle_reg = None
    driver_name = None
    trip_id = None
    eta = None

    if shipment.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == shipment.vehicle_id).first()
        if vehicle:
            vehicle_reg = vehicle.registration_number

    if shipment.driver_id:
        driver = db.query(Driver).filter(Driver.driver_id == shipment.driver_id).first()
        if driver and driver.user_id:
            user = db.query(User).filter(User.user_id == driver.user_id).first()
            if user:
                driver_name = user.full_name

    # Check for linked active or latest trip
    trip = db.query(Trip).filter(Trip.shipment_id == shipment.shipment_id).order_by(Trip.start_time.desc()).first()
    if trip:
        trip_id = str(trip.trip_id)

    return {
        "shipment_id": shipment.shipment_id,
        "tracking_number": shipment.tracking_number,
        "source": shipment.source,
        "destination": shipment.destination,
        "customer_name": shipment.customer_name,
        "shipment_weight": shipment.shipment_weight,
        "vehicle_id": shipment.vehicle_id,
        "driver_id": shipment.driver_id,
        "status": shipment.status,
        "created_at": shipment.created_at,
        "updated_at": shipment.updated_at,
        "vehicle_reg": vehicle_reg,
        "driver_name": driver_name,
        "trip_id": trip_id
    }


# ---------------------------------------------------------
# Get Shipment History for Customer or Vehicle
# ---------------------------------------------------------
@router.get("/history")
def get_shipment_history(
    customer_name: str | None = Query(None, description="Filter by customer name"),
    vehicle_id: str | None = Query(None, description="Filter by vehicle UUID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Shipment)

    if customer_name:
        query = query.filter(Shipment.customer_name.ilike(f"%{customer_name.strip()}%"))

    if vehicle_id:
        try:
            v_uuid = uuid.UUID(vehicle_id)
            query = query.filter(Shipment.vehicle_id == v_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid vehicle_id UUID format")

    # Scoped by role: Driver sees only their own shipments
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        query = query.filter(Shipment.driver_id == driver.driver_id)

    shipments = query.order_by(Shipment.updated_at.desc()).all()
    return [build_shipment_response(s, db) for s in shipments]


# ---------------------------------------------------------
# Get Delayed Shipments (Alerts)
# ---------------------------------------------------------
@router.get("/alerts", response_model=list[ShipmentResponse])
def get_shipment_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Shipment).filter(Shipment.status == "Delayed")
    
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        query = query.filter(Shipment.driver_id == driver.driver_id)
        
    shipments = query.all()
    return [build_shipment_response(s, db) for s in shipments]


# ---------------------------------------------------------
# Create Shipment
# ---------------------------------------------------------
@router.post("", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
def create_shipment(
    shipment_in: ShipmentCreate,
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    tracking_number = f"SH-{uuid.uuid4().hex[:6].upper()}"
    while db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first():
        tracking_number = f"SH-{uuid.uuid4().hex[:6].upper()}"

    initial_status = shipment_in.status or "Created"
    if shipment_in.vehicle_id or shipment_in.driver_id:
        if initial_status == "Created":
            initial_status = "Assigned"

    new_shipment = Shipment(
        shipment_id=uuid.uuid4(),
        tracking_number=tracking_number,
        source=shipment_in.source,
        destination=shipment_in.destination,
        customer_name=shipment_in.customer_name,
        shipment_weight=shipment_in.shipment_weight,
        vehicle_id=shipment_in.vehicle_id,
        driver_id=shipment_in.driver_id,
        status=initial_status
    )

    db.add(new_shipment)

    # Sync vehicle status if assigned
    if shipment_in.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == shipment_in.vehicle_id).first()
        if vehicle and vehicle.status == "Available":
            vehicle.status = "Assigned"

    db.commit()
    db.refresh(new_shipment)

    return build_shipment_response(new_shipment, db)


# ---------------------------------------------------------
# Get All Shipments (scoped by role)
# ---------------------------------------------------------
@router.get("", response_model=list[ShipmentResponse])
def get_shipments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        shipments = db.query(Shipment).filter(Shipment.driver_id == driver.driver_id).order_by(Shipment.created_at.desc()).all()
    else:
        shipments = db.query(Shipment).order_by(Shipment.created_at.desc()).all()

    return [build_shipment_response(s, db) for s in shipments]


# ---------------------------------------------------------
# Get Shipment by ID
# ---------------------------------------------------------
@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(
    shipment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or shipment.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="Access denied: Not your assigned shipment.")

    return build_shipment_response(shipment, db)


# ---------------------------------------------------------
# Update Shipment
# ---------------------------------------------------------
@router.put("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(
    shipment_id: uuid.UUID,
    shipment_in: ShipmentUpdate,
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    update_data = shipment_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(shipment, field, val)

    # Auto-adjust status if vehicle or driver was newly assigned
    if (shipment.vehicle_id or shipment.driver_id) and shipment.status == "Created":
        shipment.status = "Assigned"

    db.commit()
    db.refresh(shipment)
    return build_shipment_response(shipment, db)


# ---------------------------------------------------------
# Delete / Cancel Shipment
# ---------------------------------------------------------
@router.delete("/{shipment_id}", status_code=status.HTTP_200_OK)
def delete_shipment(
    shipment_id: uuid.UUID,
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Free associated vehicle if assigned
    if shipment.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == shipment.vehicle_id).first()
        if v:
            v.status = "Available"

    db.delete(shipment)
    db.commit()
    return {"message": "Shipment deleted successfully"}


# ---------------------------------------------------------
# Update Shipment Status Only
# ---------------------------------------------------------
@router.put("/{shipment_id}/status", response_model=ShipmentResponse)
def update_shipment_status(
    shipment_id: uuid.UUID,
    status_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or shipment.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="Access denied: Not your assigned shipment.")

    new_status = status_data.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status value is required.")

    shipment.status = new_status

    # Synchronize vehicle & trip statuses when shipment status changes
    if shipment.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == shipment.vehicle_id).first()
        if vehicle:
            if new_status == "Delivered" or new_status == "Cancelled":
                vehicle.status = "Available"
            elif new_status == "In Transit":
                vehicle.status = "In Transit"
            elif new_status == "Assigned":
                vehicle.status = "Assigned"

    # Sync linked trip if exists
    trip = db.query(Trip).filter(Trip.shipment_id == shipment.shipment_id).order_by(Trip.start_time.desc()).first()
    if trip:
        if new_status == "Delivered":
            trip.status = "completed"
            trip.end_time = datetime.now(timezone.utc)
        elif new_status == "In Transit":
            trip.status = "active"

    db.commit()
    db.refresh(shipment)
    return build_shipment_response(shipment, db)
