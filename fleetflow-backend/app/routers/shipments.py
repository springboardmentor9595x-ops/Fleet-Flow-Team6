import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.shipment import Shipment
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate, ShipmentResponse

router = APIRouter(
    prefix="/shipments",
    tags=["Shipment Tracking"]
)


# Helper to build the ShipmentResponse dict with relationships
def build_shipment_response(shipment: Shipment, db: Session) -> dict:
    vehicle_reg = None
    driver_name = None

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
        "driver_name": driver_name
    }


# ---------------------------------------------------------
# Get Delayed Shipments (Alerts)
# ---------------------------------------------------------
@router.get("/alerts", response_model=list[ShipmentResponse])
def get_shipment_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Delayed shipments are those explicitly marked as "Delayed"
    # Scoped by role: Drivers see only their own delayed shipments
    query = db.query(Shipment).filter(Shipment.status == "Delayed")
    
    if current_user.role.value == "Driver":
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
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    # Generate unique tracking number
    tracking_number = f"SH-{uuid.uuid4().hex[:6].upper()}"
    while db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first():
        tracking_number = f"SH-{uuid.uuid4().hex[:6].upper()}"

    new_shipment = Shipment(
        shipment_id=uuid.uuid4(),
        tracking_number=tracking_number,
        source=shipment_in.source,
        destination=shipment_in.destination,
        customer_name=shipment_in.customer_name,
        shipment_weight=shipment_in.shipment_weight,
        vehicle_id=shipment_in.vehicle_id,
        driver_id=shipment_in.driver_id,
        status=shipment_in.status
    )

    db.add(new_shipment)
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
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    update_data = shipment_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(shipment, field, val)

    db.commit()
    db.refresh(shipment)
    return build_shipment_response(shipment, db)


# ---------------------------------------------------------
# Delete Shipment
# ---------------------------------------------------------
@router.delete("/{shipment_id}", status_code=status.HTTP_200_OK)
def delete_shipment(
    shipment_id: uuid.UUID,
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    db.delete(shipment)
    db.commit()
    return {"message": "Shipment deleted successfully"}


# ---------------------------------------------------------
# Update Shipment Status Only (can be done by Driver or Fleet Manager/Admin)
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
    db.commit()
    db.refresh(shipment)
    return build_shipment_response(shipment, db)
