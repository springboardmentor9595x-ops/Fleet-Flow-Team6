import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from database import get_db
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    total_vehicles = db.query(Vehicle).count()
    active_trips = db.query(Trip).filter(Trip.status == "active").count()
    maintenance_due = db.query(Vehicle).filter(Vehicle.status == "Maintenance").count()
    
    # 1. Total Vehicles Delta: new vehicles added in the last 7 days
    new_vehicles = db.query(Vehicle).filter(Vehicle.created_at >= func.now() - text("INTERVAL '7 days'")).count()
    vehicle_delta = f"+{new_vehicles} this week" if new_vehicles > 0 else f"{new_vehicles} this week"
    
    # 2. Active Trips Delta: count of pending trips
    pending_trips = db.query(Trip).filter(Trip.status == "pending").count()
    trips_delta = f"{pending_trips} pending"
    
    # 3. Maintenance Due Delta: count of overdue maintenance tasks
    try:
        overdue_maintenance = db.execute(
            text("SELECT COUNT(*) FROM vehicle_maintenance WHERE status = 'pending' AND next_service_date < CURRENT_DATE")
        ).scalar() or 0
    except Exception:
        overdue_maintenance = 0
    maintenance_delta = f"{overdue_maintenance} overdue"
    
    # 4. On-Time Rate: calculate dynamically for completed trips
    completed_trips = db.query(Trip).filter(Trip.status == "completed").all()
    on_time_count = 0
    for trip in completed_trips:
        if trip.start_time and trip.end_time and trip.distance:
            duration_hours = (trip.end_time - trip.start_time).total_seconds() / 3600.0
            # Assume an expected average speed of 30 km/h
            expected_hours = float(trip.distance) / 30.0
            if duration_hours <= expected_hours:
                on_time_count += 1
        else:
            on_time_count += 1
            
    total_completed = len(completed_trips)
    if total_completed > 0:
        on_time_rate = (on_time_count / total_completed) * 100
    else:
        on_time_rate = 100.0
        
    # Delta comparison to target of 90.0%
    target_rate = 90.0
    diff = on_time_rate - target_rate
    if diff >= 0:
        on_time_delta = f"+{diff:.1f}% vs target"
        on_time_positive = True
    else:
        on_time_delta = f"{diff:.1f}% vs target"
        on_time_positive = False
    
    return [
        {
            "label": "Total Vehicles",
            "value": str(total_vehicles),
            "delta": vehicle_delta,
            "positive": True,
            "icon": "Truck",
            "color": "#3b82f6",
            "bg": "#eff6ff",
            "border": "#bfdbfe"
        },
        {
            "label": "Active Trips",
            "value": str(active_trips),
            "delta": trips_delta,
            "positive": True,
            "icon": "Route",
            "color": "#059669",
            "bg": "#ecfdf5",
            "border": "#a7f3d0"
        },
        {
            "label": "Maintenance Due",
            "value": str(maintenance_due),
            "delta": maintenance_delta,
            "positive": overdue_maintenance == 0,
            "icon": "Wrench",
            "color": "#d97706",
            "bg": "#fffbeb",
            "border": "#fde68a"
        },
        {
            "label": "On-Time Rate",
            "value": f"{on_time_rate:.1f}%",
            "delta": on_time_delta,
            "positive": on_time_positive,
            "icon": "TrendingUp",
            "color": "#8b5cf6",
            "bg": "#f5f3ff",
            "border": "#ddd6fe"
        }
    ]

@router.get("/trips")
def get_trips(db: Session = Depends(get_db)):
    results = db.query(Trip, Vehicle, User).outerjoin(
        Vehicle, Trip.vehicle_id == Vehicle.vehicle_id
    ).outerjoin(
        Driver, Trip.driver_id == Driver.driver_id
    ).outerjoin(
        User, Driver.user_id == User.user_id
    ).order_by(Trip.start_time.desc()).limit(5).all()
    
    trips = []
    for trip, vehicle, user in results:
        trips.append({
            "id": f"TRP-{str(trip.trip_id)[:4].upper()}",
            "driver": user.full_name if user else "Unknown Driver",
            "vehicle": vehicle.registration_number if vehicle else "Unknown Vehicle",
            "route": f"{trip.start_location} → {trip.destination}" if (trip.start_location and trip.destination) else "Unknown Route",
            "status": trip.status or "pending",
            "started": trip.start_time.strftime("%I:%M %p") if trip.start_time else "N/A"
        })
    return trips

@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    notifications = db.query(Notification).order_by(Notification.created_at.desc()).limit(4).all()
    
    alerts = []
    for n in notifications:
        time_str = "just now"
        if n.created_at:
            now = datetime.datetime.now(n.created_at.tzinfo)
            diff = now - n.created_at
            if diff.total_seconds() < 60:
                time_str = "just now"
            elif diff.total_seconds() < 3600:
                time_str = f"{int(diff.total_seconds() // 60)}m ago"
            elif diff.total_seconds() < 86400:
                time_str = f"{int(diff.total_seconds() // 3600)}h ago"
            else:
                time_str = f"{int(diff.total_seconds() // 86400)}d ago"
        alerts.append({
            "type": n.type or "info",
            "text": n.message or "",
            "time": time_str
        })
    return alerts
