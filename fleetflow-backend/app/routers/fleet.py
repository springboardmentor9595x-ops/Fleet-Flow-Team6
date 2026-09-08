import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.models.notification import Notification
from app.core.security import hash_password, get_current_user, require_roles, get_role_str, get_driver_for_user

router = APIRouter(
    prefix="/fleet",
    tags=["Fleet Management"]
)

# -----------------------------
# Users Endpoints
# -----------------------------

@router.get("/users")
def get_users(current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users

@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(data: dict, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    """Admin-only: create any user. Role escalation to Admin is blocked."""
    email = data.get("email")
    role_requested = data.get("role", "Driver")
    # Hard block: no one can create an Admin via this endpoint
    if role_requested == "Admin":
        raise HTTPException(status_code=403, detail="Cannot create Admin accounts via this endpoint")
    if db.query(User).filter(User.email == email, User.role == role_requested).first():
        raise HTTPException(status_code=400, detail="Email already registered for this role")
    new_user = User(
        user_id=uuid.uuid4(),
        full_name=data.get("full_name"),
        email=email,
        password=hash_password(data.get("password", "password123")),
        phone=data.get("phone", ""),
        role=role_requested,
        is_verified=True,
    )
    db.add(new_user)
    
    # Create notification for dashboard
    db.add(Notification(
        notification_id=uuid.uuid4(),
        type="info",
        message=f"New user {new_user.full_name} ({new_user.role}) registered.",
        title="User Registered"
    ))
    
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/users/{user_id}")
def update_user(user_id: str, data: dict, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    """Admin-only: update user details."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "full_name" in data:
        user.full_name = data["full_name"]
    if "phone" in data:
        user.phone = data["phone"]
    if "password" in data and data["password"]:
        user.password = hash_password(data["password"])
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    user_uuid = uuid.UUID(user_id)
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


# -----------------------------
# Drivers Endpoints
# -----------------------------
@router.get("/drivers")
def get_drivers(current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher", "Driver"])), db: Session = Depends(get_db)):
    results = db.query(Driver, User).outerjoin(User, Driver.user_id == User.user_id).all()
    drivers_list = []
    for driver, user in results:
        drivers_list.append({
            "driver_id": str(driver.driver_id),
            "user_id": str(user.user_id) if user else None,
            "full_name": user.full_name if user else "Driver",
            "email": user.email if user else "",
            "phone": user.phone if user else "",
            "license_number": driver.license_number,
            "experience_years": driver.experience_years,
            "address": driver.address,
            "status": driver.status or "Active",
            "created_at": driver.created_at
        })
    return drivers_list

@router.post("/drivers", status_code=status.HTTP_201_CREATED)
def create_driver(data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    email = data.get("email")
    existing_user = db.query(User).filter(User.email == email).first()
    
    if existing_user:
        # Check if they already have a driver profile
        existing_driver = db.query(Driver).filter(Driver.user_id == existing_user.user_id).first()
        if existing_driver:
            raise HTTPException(status_code=400, detail="Driver profile already exists for this email")
        
        # Ensure role is Driver
        if existing_user.role != "Driver":
            existing_user.role = "Driver"
        
        user_id = existing_user.user_id
        new_user = existing_user
    else:
        user_id = uuid.uuid4()
        new_user = User(
            user_id=user_id,
            full_name=data.get("full_name"),
            email=email,
            password=hash_password(data.get("password", "password123")),
            phone=data.get("phone", ""),
            role="Driver"
        )
        db.add(new_user)
    
    new_driver = Driver(
        driver_id=uuid.uuid4(),
        user_id=user_id,
        license_number=data.get("license_number"),
        experience_years=int(data.get("experience_years") or 0),
        address=data.get("address", ""),
        status=data.get("status", "Active")
    )
    db.add(new_driver)
    
    # Create notification for dashboard
    db.add(Notification(
        notification_id=uuid.uuid4(),
        type="info",
        message=f"New driver {new_user.full_name} registered.",
        title="Driver Registered"
    ))
    
    db.commit()

    return {"message": "Driver created successfully", "driver_id": str(new_driver.driver_id)}

@router.put("/drivers/{driver_id}")
def update_driver(driver_id: str, data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    """Admin/FleetManager: update driver and associated user details."""
    try:
        driver_uuid = uuid.UUID(driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id format")
    driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    # Update driver fields
    driver_fields = ["license_number", "experience_years", "address", "status"]
    for field in driver_fields:
        if field in data and data[field] is not None:
            setattr(driver, field, data[field])
    # Update linked user fields
    if driver.user_id:
        linked_user = db.query(User).filter(User.user_id == driver.user_id).first()
        if linked_user:
            if "full_name" in data and data["full_name"]:
                linked_user.full_name = data["full_name"]
            if "phone" in data:
                linked_user.phone = data["phone"]
    db.commit()
    return {"message": "Driver updated successfully"}

@router.delete("/drivers/{driver_id}")
def delete_driver(driver_id: str, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    """Admin-only: delete driver profile and their user account."""
    driver_uuid = uuid.UUID(driver_id)
    driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Also delete associated user
    if driver.user_id:
        user = db.query(User).filter(User.user_id == driver.user_id).first()
        if user:
            db.delete(user)
            
    db.delete(driver)
    db.commit()
    return {"message": "Driver and user account deleted successfully"}


# -----------------------------
# Vehicles Endpoints
# -----------------------------
@router.get("/vehicles")
def get_vehicles(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Admin/FleetManager: all vehicles.
    Driver: only their assigned vehicle.
    """
    role = get_role_str(current_user)
    vehicles_query = db.query(Vehicle)
    if role == "Driver":
        driver = get_driver_for_user(current_user, db)
        if not driver:
            return []
        vehicles_query = vehicles_query.filter(Vehicle.assigned_driver == driver.driver_id)
    vehicles = vehicles_query.all()
    vehicles_list = []
    for v in vehicles:
        driver_name = "None"
        if v.assigned_driver:
            driver_user = db.query(User).join(Driver, Driver.user_id == User.user_id).filter(Driver.driver_id == v.assigned_driver).first()
            if driver_user:
                driver_name = driver_user.full_name
                
        vehicles_list.append({
            "vehicle_id": str(v.vehicle_id),
            "registration_number": v.registration_number,
            "vehicle_type": v.vehicle_type,
            "brand": v.brand,
            "model": v.model,
            "manufacture_year": v.manufacture_year,
            "fuel_type": v.fuel_type,
            "capacity": v.capacity,
            "assigned_driver": str(v.assigned_driver) if v.assigned_driver else None,
            "assigned_driver_name": driver_name,
            "status": v.status or "Available",
            "created_at": v.created_at
        })
    return vehicles_list

@router.post("/vehicles", status_code=status.HTTP_201_CREATED)
def create_vehicle(data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    # Check for duplicate registration number
    reg_number = data.get("registration_number", "").strip()
    if not reg_number:
        raise HTTPException(status_code=400, detail="registration_number is required")
    existing = db.query(Vehicle).filter(Vehicle.registration_number == reg_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="A vehicle with this registration number already exists")

    assigned_driver_uuid = None
    if data.get("assigned_driver"):
        assigned_driver_uuid = uuid.UUID(data.get("assigned_driver"))

    new_vehicle = Vehicle(
        vehicle_id=uuid.uuid4(),
        registration_number=reg_number,
        vehicle_type=data.get("vehicle_type"),
        brand=data.get("brand"),
        model=data.get("model"),
        manufacture_year=int(data.get("manufacture_year") or 2024),
        fuel_type=data.get("fuel_type", "Diesel"),
        capacity=int(data.get("capacity") or 1000),
        assigned_driver=assigned_driver_uuid,
        status=data.get("status", "Available")
    )
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle

@router.put("/vehicles/{vehicle_id}")
def update_vehicle(vehicle_id: str, data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    """Admin/FleetManager: update vehicle details."""
    try:
        vehicle_uuid = uuid.UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle_id format")
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    # Check registration uniqueness if changing it
    new_reg = data.get("registration_number")
    if new_reg and new_reg != vehicle.registration_number:
        dup = db.query(Vehicle).filter(Vehicle.registration_number == new_reg).first()
        if dup:
            raise HTTPException(status_code=409, detail="A vehicle with this registration number already exists")
    updatable = ["registration_number", "vehicle_type", "brand", "model", "manufacture_year", "fuel_type", "capacity", "status"]
    for field in updatable:
        if field in data and data[field] is not None:
            setattr(vehicle, field, data[field])
    if "assigned_driver" in data:
        vehicle.assigned_driver = uuid.UUID(data["assigned_driver"]) if data["assigned_driver"] else None
    db.commit()
    db.refresh(vehicle)
    return vehicle

@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    """Admin-only: delete vehicle."""
    vehicle_uuid = uuid.UUID(vehicle_id)
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}


# -----------------------------
# Trips Endpoints
# -----------------------------
from app.models.shipment import Shipment
from app.services.routing_service import get_route_options

@router.get("/route-options")
def get_trip_route_options(source: str, destination: str, current_user: User = Depends(get_current_user)):
    return get_route_options(source, destination)

@router.get("/trips")
def get_trips(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Admin/FleetManager: all trips.
    Driver: only their assigned trips.
    """
    role = get_role_str(current_user)
    query = db.query(Trip, Vehicle, Driver, User, Shipment).outerjoin(
        Vehicle, Trip.vehicle_id == Vehicle.vehicle_id
    ).outerjoin(
        Driver, Trip.driver_id == Driver.driver_id
    ).outerjoin(
        User, Driver.user_id == User.user_id
    ).outerjoin(
        Shipment, Trip.shipment_id == Shipment.shipment_id
    )
    if role == "Driver":
        drv = get_driver_for_user(current_user, db)
        if not drv:
            return []
        query = query.filter(Trip.driver_id == drv.driver_id)
    results = query.order_by(Trip.trip_id).all()
    
    trips_list = []
    for trip, vehicle, driver, user, shipment in results:
        trips_list.append({
            "trip_id": str(trip.trip_id),
            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
            "vehicle_reg": vehicle.registration_number if vehicle else "N/A",
            "driver_id": str(trip.driver_id) if trip.driver_id else None,
            "driver_name": user.full_name if user else "N/A",
            "shipment_id": str(trip.shipment_id) if trip.shipment_id else None,
            "shipment_tracking": shipment.tracking_number if shipment else "N/A",
            "start_location": trip.start_location,
            "destination": trip.destination,
            "start_time": trip.start_time.isoformat() if trip.start_time else None,
            "end_time": trip.end_time.isoformat() if trip.end_time else None,
            "distance": float(trip.distance) if trip.distance else 0.0,
            "status": trip.status or "pending"
        })
    return trips_list

@router.post("/trips", status_code=status.HTTP_201_CREATED)
def create_trip(data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    """Admin/FleetManager only: create a trip."""
    vehicle_uuid = uuid.UUID(data.get("vehicle_id")) if data.get("vehicle_id") else None
    driver_uuid = uuid.UUID(data.get("driver_id")) if data.get("driver_id") else None
    shipment_uuid = uuid.UUID(data.get("shipment_id")) if data.get("shipment_id") else None
    
    new_trip = Trip(
        trip_id=uuid.uuid4(),
        vehicle_id=vehicle_uuid,
        driver_id=driver_uuid,
        shipment_id=shipment_uuid,
        start_location=data.get("start_location"),
        destination=data.get("destination"),
        start_time=None,  # Not started yet
        distance=float(data.get("distance") or 0.0),
        status="pending"
    )
    db.add(new_trip)
    
    # Update vehicle status to Assigned
    if vehicle_uuid:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
        if vehicle:
            vehicle.status = "Assigned"

    # Update shipment status to Assigned
    if shipment_uuid:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_uuid).first()
        if shipment:
            shipment.status = "Assigned"
            shipment.vehicle_id = vehicle_uuid
            shipment.driver_id = driver_uuid
            
    db.commit()
    db.refresh(new_trip)
    return new_trip

@router.put("/trips/{trip_id}/start")
def start_trip(trip_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Driver: can only start their own trip. Admin/FleetManager: any trip."""
    role = get_role_str(current_user)
    trip_uuid = uuid.UUID(trip_id)
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if role == "Driver":
        drv = get_driver_for_user(current_user, db)
        if not drv or trip.driver_id != drv.driver_id:
            raise HTTPException(status_code=403, detail="You can only start your own assigned trips")
        
    trip.status = "active"
    trip.start_time = datetime.datetime.now()
    
    # Update vehicle status to In Transit
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "In Transit"
            
    # Update shipment status to In Transit
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "In Transit"
            
    db.commit()
    return {"message": "Trip started successfully", "status": "active"}

@router.put("/trips/{trip_id}/end")
def end_trip(trip_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Driver: can only end their own trip. Admin/FleetManager: any trip."""
    role = get_role_str(current_user)
    trip_uuid = uuid.UUID(trip_id)
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if role == "Driver":
        drv = get_driver_for_user(current_user, db)
        if not drv or trip.driver_id != drv.driver_id:
            raise HTTPException(status_code=403, detail="You can only end your own assigned trips")
        
    trip.status = "completed"
    trip.end_time = datetime.datetime.now()
    
    # Update vehicle status to Available
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "Available"
            
    # Update shipment status to Delivered
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "Delivered"
            
    db.commit()
    return {"message": "Trip completed successfully", "status": "completed"}

@router.post("/trips/{trip_id}/recalculate")
def recalculate_trip_route(trip_id: str, db: Session = Depends(get_db)):
    trip_uuid = uuid.UUID(trip_id)
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Return simulated recalculated path or updated ETA
    return {
        "message": "Route recalculated successfully based on real-time traffic updates.",
        "recalculated": True,
        "new_distance": float(trip.distance or 0.0) * 1.03,  # Slight detour
        "updated_eta": (datetime.datetime.now() + datetime.timedelta(hours=4)).strftime("%I:%M %p")
    }

@router.delete("/trips/{trip_id}")
def delete_trip(trip_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    trip_uuid = uuid.UUID(trip_id)
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Reset vehicle and shipment statuses if cancelled
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "Available"
            
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "Created"
            shipment.vehicle_id = None
            shipment.driver_id = None
            
    db.delete(trip)
    db.commit()
    return {"message": "Trip deleted successfully"}


# -----------------------------
# Maintenance Endpoints
# -----------------------------
@router.get("/maintenance")
def get_maintenance(current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    query = text("""
        SELECT vm.maintenance_id, vm.vehicle_id, vm.maintenance_type, vm.service_date, vm.next_service_date, vm.cost, vm.remarks, vm.status, v.registration_number 
        FROM vehicle_maintenance vm 
        JOIN vehicles v ON vm.vehicle_id = v.vehicle_id
        ORDER BY vm.service_date DESC
    """)
    results = db.execute(query).all()
    maintenance_list = []
    for r in results:
        maintenance_list.append({
            "maintenance_id": str(r[0]),
            "vehicle_id": str(r[1]),
            "maintenance_type": r[2],
            "service_date": r[3].isoformat() if hasattr(r[3], 'isoformat') else str(r[3]),
            "next_service_date": r[4].isoformat() if hasattr(r[4], 'isoformat') else str(r[4]),
            "cost": float(r[5]) if r[5] else 0.0,
            "remarks": r[6],
            "status": r[7],
            "vehicle_reg": r[8]
        })
    return maintenance_list

@router.post("/maintenance", status_code=status.HTTP_201_CREATED)
def create_maintenance(data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    m_id = uuid.uuid4()
    v_id_str = data.get("vehicle_id")
    if not v_id_str:
        raise HTTPException(status_code=400, detail="vehicle_id is required")
    v_id = uuid.UUID(v_id_str)
    m_type = data.get("maintenance_type")
    if not m_type:
        raise HTTPException(status_code=400, detail="maintenance_type is required")
    s_date_str = data.get("service_date")
    n_date_str = data.get("next_service_date")
    if not s_date_str or not n_date_str:
        raise HTTPException(status_code=400, detail="service_date and next_service_date are required")
    s_date = datetime.date.fromisoformat(s_date_str)
    n_date = datetime.date.fromisoformat(n_date_str)
    cost = float(data.get("cost", 0.0))
    remarks = data.get("remarks", "")
    m_status = data.get("status", "pending")  # renamed from 'status' to avoid shadowing FastAPI status module

    query = text("""
        INSERT INTO vehicle_maintenance (maintenance_id, vehicle_id, maintenance_type, service_date, next_service_date, cost, remarks, status)
        VALUES (:m_id, :v_id, :m_type, :s_date, :n_date, :cost, :remarks, :m_status)
    """)
    db.execute(query, {
        "m_id": m_id,
        "v_id": v_id,
        "m_type": m_type,
        "s_date": s_date,
        "n_date": n_date,
        "cost": cost,
        "remarks": remarks,
        "m_status": m_status
    })
    db.commit()
    return {"message": "Maintenance record created successfully", "maintenance_id": str(m_id)}

@router.put("/maintenance/{maintenance_id}")
def update_maintenance(maintenance_id: str, data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    """Admin/FleetManager: update a maintenance record."""
    try:
        m_uuid = uuid.UUID(maintenance_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid maintenance_id format")
    # Check record exists
    existing = db.execute(text("SELECT maintenance_id FROM vehicle_maintenance WHERE maintenance_id = :m_id"), {"m_id": m_uuid}).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    # Build dynamic update
    updates = []
    params = {"m_id": m_uuid}
    allowed = {"maintenance_type": str, "service_date": str, "next_service_date": str, "cost": float, "remarks": str, "status": str}
    for field, cast in allowed.items():
        if field in data and data[field] is not None:
            updates.append(f"{field} = :{field}")
            params[field] = cast(data[field])
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields provided to update")
    db.execute(text(f"UPDATE vehicle_maintenance SET {', '.join(updates)} WHERE maintenance_id = :m_id"), params)
    db.commit()
    return {"message": "Maintenance record updated successfully"}

@router.delete("/maintenance/{maintenance_id}")
def delete_maintenance(maintenance_id: str, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    """Admin-only: permanently delete a maintenance record."""
    m_uuid = uuid.UUID(maintenance_id)
    query = text("DELETE FROM vehicle_maintenance WHERE maintenance_id = :m_id")
    db.execute(query, {"m_id": m_uuid})
    db.commit()
    return {"message": "Maintenance record deleted successfully"}


# -----------------------------
# Notifications Endpoints
# -----------------------------
@router.get("/notifications")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifications = db.query(Notification).order_by(Notification.created_at.desc()).all()
    return notifications

@router.put("/notifications/{notification_id}/read")
def read_notification(notification_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n_uuid = uuid.UUID(notification_id)
    notif = db.query(Notification).filter(Notification.notification_id == n_uuid).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}

@router.post("/notifications", status_code=status.HTTP_201_CREATED)
def create_notification(data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    """Admin/FleetManager only: create system notifications."""
    new_notif = Notification(
        notification_id=uuid.uuid4(),
        user_id=uuid.UUID(data.get("user_id")) if data.get("user_id") else None,
        title=data.get("title"),
        message=data.get("message"),
        type=data.get("type", "info"),
        is_read=False
    )
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    return new_notif
