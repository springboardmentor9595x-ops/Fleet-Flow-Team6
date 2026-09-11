
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.shipment import Shipment, ShipmentStatus
from app.models.driver import Driver
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate


def create_shipment(db: Session, shipment: ShipmentCreate):
    new_shipment = Shipment(**shipment.model_dump())

    db.add(new_shipment)
    db.commit()
    db.refresh(new_shipment)

    return new_shipment


from sqlalchemy import or_
from app.models.user import User, RoleEnum

def _get_driver_id_for_user(db: Session, user_id) -> UUID | None:
    """Look up the drivers.driver_id for a given users.user_id, creating one if not present."""
    driver = db.query(Driver).filter(Driver.user_id == user_id).first()
    if not driver:
        user = db.query(User).filter(User.user_id == user_id).first()
        if user and user.role == RoleEnum.Driver:
            driver = Driver(
                user_id=user.user_id,
                license_number=f"DL-KA-{str(user.user_id)[:8].upper()}",
                status="Available",
                experience_years=3,
            )
            db.add(driver)
            db.commit()
            db.refresh(driver)
    return driver.driver_id if driver else None


def get_all_shipments(db: Session, current_user):
    """
    Admin, FleetManager and Dispatcher:
        Can see all shipments.

    Driver:
        Can see only shipments assigned to that driver (by driver_id or user_id).
    """

    user_role = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else current_user.role
    )

    if user_role == "Driver":
        driver_id = _get_driver_id_for_user(db, current_user.user_id)
        if not driver_id:
            return db.query(Shipment).filter(Shipment.driver_id == current_user.user_id).all()
        return (
            db.query(Shipment)
            .filter(
                or_(
                    Shipment.driver_id == driver_id,
                    Shipment.driver_id == current_user.user_id,
                )
            )
            .all()
        )

    return db.query(Shipment).all()


def get_shipment(
    db: Session,
    shipment_id: UUID,
    current_user=None,
):
    query = db.query(Shipment).filter(
        Shipment.shipment_id == shipment_id
    )

    # If a Driver is requesting the shipment,
    # make sure it belongs to that Driver.
    # NOTE: Shipment.driver_id is a FK to drivers.driver_id, NOT users.user_id.
    if current_user is not None:

        user_role = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else current_user.role
        )

        if user_role == "Driver":
            driver_id = _get_driver_id_for_user(db, current_user.user_id)
            if not driver_id:
                query = query.filter(Shipment.driver_id == current_user.user_id)
            else:
                query = query.filter(
                    or_(
                        Shipment.driver_id == driver_id,
                        Shipment.driver_id == current_user.user_id,
                    )
                )

    return query.first()


def update_shipment(
    db: Session,
    shipment_id: UUID,
    shipment: ShipmentUpdate,
):
    existing = (
        db.query(Shipment)
        .filter(Shipment.shipment_id == shipment_id)
        .first()
    )

    if not existing:
        return None

    update_data = shipment.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(existing, key, value)

    db.commit()
    db.refresh(existing)

    return existing


def cancel_shipment(
    db: Session,
    shipment_id: UUID,
):
    shipment = (
        db.query(Shipment)
        .filter(Shipment.shipment_id == shipment_id)
        .first()
    )

    if not shipment:
        return None

    shipment.status = ShipmentStatus.Cancelled

    db.commit()
    db.refresh(shipment)

    return shipment

