from uuid import UUID
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import (
    get_current_user,
    require_roles,
)
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.shipment import Shipment, ShipmentStatus
from app.models.trip import Trip, TripStatus
from app.schemas.shipment import (
    ShipmentCreate,
    ShipmentUpdate,
    ShipmentOut,
)
from app.crud.shipment import (
    create_shipment,
    get_all_shipments,
    get_shipment,
    update_shipment,
    cancel_shipment,
    _get_driver_id_for_user,
)
from app.services.notification_service import create_broadcast_notification

router = APIRouter()


class StatusUpdateBody(BaseModel):
    status: ShipmentStatus


# =========================================================
# CREATE SHIPMENT
# Admin, FleetManager and Dispatcher
# =========================================================

@router.post(
    "/",
    response_model=ShipmentOut,
)
def add_shipment(
    shipment: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            "Admin",
            "FleetManager",
            "Dispatcher",
        )
    ),
):
    return create_shipment(
        db,
        shipment,
    )


# =========================================================
# LIST SHIPMENTS
#
# Admin / FleetManager / Dispatcher → all shipments
# Driver → only assigned shipments
# =========================================================

@router.get(
    "/",
    response_model=list[ShipmentOut],
)
def list_shipments(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    return get_all_shipments(
        db,
        current_user,
    )


# =========================================================
# SHIPMENT HISTORY (by customer or vehicle)
# =========================================================

@router.get("/history", response_model=list[ShipmentOut])
def shipment_history(
    customer_name: Optional[str] = None,
    vehicle_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch shipment delivery history filtered by customer name or vehicle ID."""
    q = db.query(Shipment)

    if current_user.role == RoleEnum.Driver:
        driver_id = _get_driver_id_for_user(db, current_user.user_id)
        if not driver_id:
            return []
        q = q.filter(Shipment.driver_id == driver_id)

    if customer_name:
        q = q.filter(Shipment.customer_name.ilike(f"%{customer_name.strip()}%"))

    if vehicle_id:
        q = q.filter(Shipment.vehicle_id == vehicle_id)

    return q.order_by(Shipment.created_at.desc()).all()


# =========================================================
# SHIPMENT ALERTS (delayed or approaching deadline)
# =========================================================

@router.get("/alerts", response_model=list[ShipmentOut])
def shipment_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve active shipments that are marked as Delayed or have active alerts."""
    q = db.query(Shipment).filter(
        Shipment.status == ShipmentStatus.Delayed
    )
    if current_user.role == RoleEnum.Driver:
        driver_id = _get_driver_id_for_user(db, current_user.user_id)
        if not driver_id:
            return []
        q = q.filter(Shipment.driver_id == driver_id)

    return q.order_by(Shipment.created_at.desc()).all()


# =========================================================
# GET SINGLE SHIPMENT
# =========================================================

@router.get(
    "/{shipment_id}",
    response_model=ShipmentOut,
)
def shipment_details(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    shipment = get_shipment(
        db,
        shipment_id,
        current_user,
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    return shipment


# =========================================================
# UPDATE DELIVERY STATUS (Created -> Assigned -> In Transit -> Delivered)
# Driver or Dispatcher / Admin / FleetManager
# =========================================================

@router.put("/{shipment_id}/status", response_model=ShipmentOut)
def update_delivery_status(
    shipment_id: UUID,
    body: StatusUpdateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update shipment status. Drivers can only update their own shipments."""
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if current_user.role == RoleEnum.Driver:
        driver_id = _get_driver_id_for_user(db, current_user.user_id)
        if not driver_id or shipment.driver_id != driver_id:
            raise HTTPException(status_code=403, detail="Drivers can only update their own shipments")

    shipment.status = body.status
    db.commit()
    db.refresh(shipment)

    # --- Notification: status change alert ---
    if body.status == ShipmentStatus.Delayed:
        create_broadcast_notification(
            db,
            title=f"Shipment Delayed: {shipment.tracking_number}",
            message=f"Shipment {shipment.tracking_number} (to {shipment.destination}) has been marked as Delayed.",
            type="warning",
        )
        db.commit()
    elif body.status == ShipmentStatus.Cancelled:
        create_broadcast_notification(
            db,
            title=f"Shipment Cancelled: {shipment.tracking_number}",
            message=f"Shipment {shipment.tracking_number} (to {shipment.destination}) has been cancelled.",
            type="error",
        )
        db.commit()

    return shipment


# =========================================================
# UPDATE SHIPMENT
# Admin, FleetManager and Dispatcher
# =========================================================

@router.put(
    "/{shipment_id}",
    response_model=ShipmentOut,
)
def edit_shipment(
    shipment_id: UUID,
    shipment: ShipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            "Admin",
            "FleetManager",
            "Dispatcher",
        )
    ),
):
    updated = update_shipment(
        db,
        shipment_id,
        shipment,
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    return updated


# =========================================================
# CANCEL SHIPMENT
# =========================================================

@router.delete(
    "/{shipment_id}",
    response_model=ShipmentOut,
)
def remove_shipment(
    shipment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            "Admin",
            "FleetManager",
            "Dispatcher",
        )
    ),
):
    shipment = cancel_shipment(
        db,
        shipment_id,
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found",
        )

    return shipment
