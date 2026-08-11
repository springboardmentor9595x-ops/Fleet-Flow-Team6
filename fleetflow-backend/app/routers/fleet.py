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
from app.core.security import hash_password, get_current_user, require_roles

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
def create_user(data: dict, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
    # Simple dict parsing to avoid pydantic model overhead for quick mock
    email = data.get("email")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        user_id=uuid.uuid4(),
        full_name=data.get("full_name"),
        email=email,
        password=hash_password(data.get("password", "password123")),
        phone=data.get("phone", ""),
        role=data.get("role", "Driver")
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
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
def get_drivers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    results = db.query(Driver, User).join(User, Driver.user_id == User.user_id).all()
    drivers_list = []
    for driver, user in results:
        drivers_list.append({
            "driver_id": str(driver.driver_id),
            "user_id": str(user.user_id),
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
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
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
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
        experience_years=int(data.get("experience_years", 0)),
        address=data.get("address", ""),
        status=data.get("status", "Active")
    )
    db.add(new_driver)
    db.commit()
    
    return {"message": "Driver created successfully", "driver_id": str(new_driver.driver_id)}

@router.delete("/drivers/{driver_id}")
def delete_driver(driver_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
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
    vehicles = db.query(Vehicle).all()
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
    assigned_driver_uuid = None
    if data.get("assigned_driver"):
        assigned_driver_uuid = uuid.UUID(data.get("assigned_driver"))
        
    new_vehicle = Vehicle(
        vehicle_id=uuid.uuid4(),
        registration_number=data.get("registration_number"),
        vehicle_type=data.get("vehicle_type"),
        brand=data.get("brand"),
        model=data.get("model"),
        manufacture_year=int(data.get("manufacture_year", 2024)),
        fuel_type=data.get("fuel_type", "Diesel"),
        capacity=int(data.get("capacity", 1000)),
        assigned_driver=assigned_driver_uuid,
        status=data.get("status", "Available")
    )
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle

@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
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
def get_trip_route_options(source: str, destination: str):
    return get_route_options(source, destination)

@router.get("/trips")
def get_trips(db: Session = Depends(get_db)):
    results = db.query(Trip, Vehicle, Driver, User, Shipment).outerjoin(
        Vehicle, Trip.vehicle_id == Vehicle.vehicle_id
    ).outerjoin(
        Driver, Trip.driver_id == Driver.driver_id
    ).outerjoin(
        User, Driver.user_id == User.user_id
    ).outerjoin(
        Shipment, Trip.shipment_id == Shipment.shipment_id
    ).order_by(Trip.trip_id).all()
    
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
def create_trip(data: dict, db: Session = Depends(get_db)):
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
        distance=float(data.get("distance", 0.0)),
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
            
    db.commit()
    db.refresh(new_trip)
    return new_trip

@router.put("/trips/{trip_id}/start")
def start_trip(trip_id: str, db: Session = Depends(get_db)):
    trip_uuid = uuid.UUID(trip_id)
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
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
def end_trip(trip_id: str, db: Session = Depends(get_db)):
    trip_uuid = uuid.UUID(trip_id)
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
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
            
    db.delete(trip)
    db.commit()
    return {"message": "Trip deleted successfully"}


# -----------------------------
# Maintenance Endpoints
# -----------------------------
@router.get("/maintenance")
def get_maintenance(current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])), db: Session = Depends(get_db)):
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
    v_id = uuid.UUID(data.get("vehicle_id"))
    m_type = data.get("maintenance_type")
    s_date = datetime.date.fromisoformat(data.get("service_date"))
    n_date = datetime.date.fromisoformat(data.get("next_service_date"))
    cost = float(data.get("cost", 0.0))
    remarks = data.get("remarks", "")
    status = data.get("status", "pending")
    
    query = text("""
        INSERT INTO vehicle_maintenance (maintenance_id, vehicle_id, maintenance_type, service_date, next_service_date, cost, remarks, status)
        VALUES (:m_id, :v_id, :m_type, :s_date, :n_date, :cost, :remarks, :status)
    """)
    db.execute(query, {
        "m_id": m_id,
        "v_id": v_id,
        "m_type": m_type,
        "s_date": s_date,
        "n_date": n_date,
        "cost": cost,
        "remarks": remarks,
        "status": status
    })
    db.commit()
    return {"message": "Maintenance record created successfully", "maintenance_id": str(m_id)}

@router.delete("/maintenance/{maintenance_id}")
def delete_maintenance(maintenance_id: str, current_user: User = Depends(require_roles(["Admin", "FleetManager"])), db: Session = Depends(get_db)):
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
def create_notification(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
