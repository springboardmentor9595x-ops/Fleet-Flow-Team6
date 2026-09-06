import uuid
import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, status, Body
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
# Users Endpoints (Admin Only)
# -----------------------------
@router.get("/users")
def get_users(current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users

@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(data: dict, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
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
def delete_user(user_id: str, current_user: User = Depends(require_roles(["Admin"])), db: Session = Depends(get_db)):
    user_uuid = uuid.UUID(user_id)
    target_user = db.query(User).filter(User.user_id == user_uuid).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    user_role_str = target_user.role.value if hasattr(target_user.role, 'value') else str(target_user.role)
    if user_role_str == "Admin" or target_user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete Admin accounts or your own account.")

    db.delete(target_user)
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
    try:
        driver_uuid = uuid.UUID(driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver UUID format")

    driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Unlink assigned vehicles
    assigned_vehicles = db.query(Vehicle).filter(Vehicle.assigned_driver == driver_uuid).all()
    for v in assigned_vehicles:
        v.assigned_driver = None
        if v.status == "Assigned":
            v.status = "Available"

    # Unlink shipments and trips
    from app.models.shipment import Shipment
    shipments = db.query(Shipment).filter(Shipment.driver_id == driver_uuid).all()
    for s in shipments:
        s.driver_id = None

    trips = db.query(Trip).filter(Trip.driver_id == driver_uuid).all()
    for t in trips:
        t.driver_id = None

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
    assigned_driver_val = data.get("assigned_driver")
    if assigned_driver_val and str(assigned_driver_val).strip():
        try:
            assigned_driver_uuid = uuid.UUID(str(assigned_driver_val))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid assigned_driver UUID format")
        
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
    try:
        vehicle_uuid = uuid.UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle UUID format")

    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # 1. Unlink from Shipments
    shipments = db.query(Shipment).filter(Shipment.vehicle_id == vehicle_uuid).all()
    for s in shipments:
        s.vehicle_id = None

    # 2. Unlink from Trips
    trips = db.query(Trip).filter(Trip.vehicle_id == vehicle_uuid).all()
    for t in trips:
        t.vehicle_id = None

    # 3. Clean up vehicle maintenance records
    from app.models.maintenance import VehicleMaintenance
    db.query(VehicleMaintenance).filter(VehicleMaintenance.vehicle_id == vehicle_uuid).delete(synchronize_session=False)

    # 4. Clean up fuel records
    from app.models.fuel_record import FuelRecord
    db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_uuid).delete(synchronize_session=False)

    # 5. Clean up GPS tracking logs
    from app.models.gps_tracking import GPSTracking
    db.query(GPSTracking).filter(GPSTracking.vehicle_id == vehicle_uuid).delete(synchronize_session=False)

    # Delete vehicle
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
@router.post("/trips/schedule", status_code=status.HTTP_201_CREATED)
def schedule_trip(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Schedule a trip by linking a shipment, vehicle, and driver, generating the planned OSRM route.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Dispatcher":
        raise HTTPException(status_code=403, detail="Access denied: Dispatchers cannot schedule trips.")

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=403, detail="Access denied: Driver profile not found.")
        data["driver_id"] = str(driver.driver_id)

    try:
        vehicle_uuid = uuid.UUID(str(data.get("vehicle_id"))) if data.get("vehicle_id") and str(data.get("vehicle_id")).strip() else None
        driver_uuid = uuid.UUID(str(data.get("driver_id"))) if data.get("driver_id") and str(data.get("driver_id")).strip() else None
        shipment_uuid = uuid.UUID(str(data.get("shipment_id"))) if data.get("shipment_id") and str(data.get("shipment_id")).strip() else None
    except ValueError as err:
        raise HTTPException(status_code=400, detail=f"Invalid UUID format in request: {err}")
    
    start_location = data.get("start_location")
    destination = data.get("destination")
    route_type = data.get("route_type", "fastest").lower()

    # Look up locations from shipment if not provided explicitly
    if shipment_uuid and (not start_location or not destination):
        shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_uuid).first()
        if shipment:
            start_location = start_location or shipment.source
            destination = destination or shipment.destination

    start_location = start_location or "Chennai"
    destination = destination or "Bangalore"

    # Generate route options via Nominatim + OSRM
    route_opts = get_route_options(start_location, destination)
    selected_opt = next((r for r in route_opts if r["id"] == route_type), route_opts[0])

    distance_val = float(data.get("distance")) if data.get("distance") else float(selected_opt["distance"])
    duration_val = float(selected_opt["duration_mins"]) * 60.0  # Duration in seconds
    planned_route_json = json.dumps(selected_opt["path"])

    new_trip = Trip(
        trip_id=uuid.uuid4(),
        vehicle_id=vehicle_uuid,
        driver_id=driver_uuid,
        shipment_id=shipment_uuid,
        start_location=start_location,
        destination=destination,
        start_time=None,  # Not started yet
        distance=distance_val,
        duration=duration_val,
        route_type=route_type,
        planned_route=planned_route_json,
        status="Scheduled"
    )
    db.add(new_trip)
    
    # Update vehicle status to Assigned
    if vehicle_uuid:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
        if vehicle:
            vehicle.status = "Assigned"

    # Update driver status to Assigned
    if driver_uuid:
        driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
        if driver:
            driver.status = "Assigned"

    # Update shipment status to Scheduled / Assigned
    if shipment_uuid:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_uuid).first()
        if shipment:
            shipment.status = "Assigned"
            if vehicle_uuid:
                shipment.vehicle_id = vehicle_uuid
            if driver_uuid:
                shipment.driver_id = driver_uuid
            
    db.commit()
    db.refresh(new_trip)

    return {
        "trip_id": str(new_trip.trip_id),
        "route_type": new_trip.route_type,
        "distance": float(new_trip.distance or 0.0),
        "duration": float(new_trip.duration or 0.0),
        "status": "Scheduled",
        "start_location": new_trip.start_location,
        "destination": new_trip.destination,
        "planned_route": selected_opt["path"],
        "vehicle_id": str(new_trip.vehicle_id) if new_trip.vehicle_id else None,
        "driver_id": str(new_trip.driver_id) if new_trip.driver_id else None,
        "shipment_id": str(new_trip.shipment_id) if new_trip.shipment_id else None
    }

@router.put("/trips/{trip_id}/start")
@router.post("/trips/{trip_id}/start")
def start_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Dispatcher":
        raise HTTPException(status_code=403, detail="Access denied: Dispatchers cannot start trips.")

    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip_id UUID format")
        
    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or trip.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only start your own assigned trip.")
        
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    trip.status = "In Transit"
    trip.start_time = now_utc
    
    # Update vehicle status to Unavailable / In Transit
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "Unavailable"
            
    # Update driver status to Unavailable
    if trip.driver_id:
        driver = db.query(Driver).filter(Driver.driver_id == trip.driver_id).first()
        if driver:
            driver.status = "Unavailable"

    # Update shipment status to In Transit
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "In Transit"
            
    db.commit()
    return {
        "trip_id": str(trip.trip_id),
        "trip_status": "In Transit",
        "shipment_status": "In Transit",
        "vehicle_status": "Unavailable",
        "driver_status": "Unavailable",
        "start_time": now_utc.isoformat()
    }

@router.put("/trips/{trip_id}/end")
@router.post("/trips/{trip_id}/end")
def end_trip(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Dispatcher":
        raise HTTPException(status_code=403, detail="Access denied: Dispatchers cannot end trips.")

    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip_id UUID format")

    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or trip.driver_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only end your own assigned trip.")
        
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    trip.status = "Completed"
    trip.end_time = now_utc
    trip.actual_distance = float(trip.distance or 0.0)
    
    # Update vehicle status to Available
    if trip.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
        if vehicle:
            vehicle.status = "Available"

    # Update driver status to Available
    if trip.driver_id:
        driver = db.query(Driver).filter(Driver.driver_id == trip.driver_id).first()
        if driver:
            driver.status = "Available"
            
    # Update shipment status to Delivered
    if trip.shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
        if shipment:
            shipment.status = "Delivered"
            
    db.commit()
    return {
        "trip_id": str(trip.trip_id),
        "trip_status": "Completed",
        "shipment_status": "Delivered",
        "vehicle_status": "Available",
        "driver_status": "Available",
        "end_time": now_utc.isoformat(),
        "actual_distance": float(trip.actual_distance or 0.0)
    }

@router.post("/trips/{trip_id}/recalculate")
@router.post("/trips/{trip_id}/recalculate-route")
def recalculate_trip_route(trip_id: str, db: Session = Depends(get_db)):
    try:
        trip_uuid = uuid.UUID(trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip_id UUID format")

    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Generate updated OSRM route options from start to destination
    route_opts = get_route_options(trip.start_location or "Chennai", trip.destination or "Bangalore")
    traffic_route = next((r for r in route_opts if r["id"] == "traffic_avoidance"), route_opts[0])
    
    trip.planned_route = json.dumps(traffic_route["path"])
    trip.distance = float(traffic_route["distance"])
    trip.duration = float(traffic_route["duration_mins"]) * 60.0

    # Trigger Notifications for Route Change
    from app.services.notification_service import notify_roles, notify_user
    notify_roles(db, ["Admin", "FleetManager", "Dispatcher"], "Route Recalculated", f"Trip TRP-{str(trip.trip_id)[:4].upper()} ({trip.start_location} → {trip.destination}) route recalculated.", "info")
    if trip.driver_id:
        d = db.query(Driver).filter(Driver.driver_id == trip.driver_id).first()
        if d and d.user_id:
            notify_user(db, d.user_id, "Route Updated", f"Your trip TRP-{str(trip.trip_id)[:4].upper()} route has been recalculated for optimal traffic flow.", "info")

    db.commit()
    
    return {
        "message": "Route recalculated successfully based on real-time traffic conditions.",
        "recalculated": True,
        "new_distance": float(trip.distance),
        "new_duration_mins": traffic_route["duration_mins"],
        "updated_eta": (datetime.datetime.now() + datetime.timedelta(minutes=traffic_route["duration_mins"])).strftime("%I:%M %p"),
        "planned_route": traffic_route["path"]
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
