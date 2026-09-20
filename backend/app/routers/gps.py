import asyncio
import random
import uuid
import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session, sessionmaker
from database import engine, get_db
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.shipment import Shipment
from app.models.gps_tracking import GPSTracking
from app.models.notification import Notification
from app.services.routing_service import (
    get_city_coords, generate_curved_path, calculate_haversine_distance, calculate_live_progress_and_eta
)
from app.services.redis_service import redis_service

router = APIRouter(
    prefix="/gps",
    tags=["GPS Tracking"]
)

# Global connection manager for WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # 1. Publish to local WebSocket connections
        stale_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                stale_connections.append(connection)
        
        for stale in stale_connections:
            self.disconnect(stale)

        # 2. Publish to Redis channel for multi-instance broadcast
        redis_service.publish("gps_channel", message)

manager = ConnectionManager()

# Global state for simulation index tracking (trip_id -> current_index)
SIMULATION_STATES = {}

# Session factory for background database tasks
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def gps_simulation_loop():
    """Background loop simulating GPS movement for active trips with geofence event detection."""
    print("Starting background GPS simulation loop...")
    while True:
        try:
            await asyncio.sleep(4.0)  # 4-second ping interval
            db = SessionLocal()
            try:
                active_trips = db.query(Trip).filter(Trip.status == "active").all()
                
                for trip in active_trips:
                    start_coords = get_city_coords(trip.start_location or "Chennai")
                    end_coords = get_city_coords(trip.destination or "Bangalore")
                    
                    path = generate_curved_path(start_coords, end_coords, num_points=20, variance=0.03)
                    trip_str = str(trip.trip_id)
                    current_idx = SIMULATION_STATES.get(trip_str, 0)
                    
                    if current_idx >= len(path):
                        # Trip completed & Geofence destination reached
                        trip.status = "completed"
                        trip.end_time = datetime.datetime.now(datetime.timezone.utc)
                        
                        if trip.vehicle_id:
                            v = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
                            if v:
                                v.status = "Available"
                                
                        if trip.shipment_id:
                            s = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
                            if s:
                                s.status = "Delivered"

                        # Log notification in DB
                        notif = Notification(
                            notification_id=uuid.uuid4(),
                            title="Shipment Delivered",
                            message=f"Vehicle reached destination for shipment from {trip.start_location} to {trip.destination}.",
                            type="success"
                        )
                        db.add(notif)
                        db.commit()
                        
                        if trip_str in SIMULATION_STATES:
                            del SIMULATION_STATES[trip_str]
                            
                        await manager.broadcast({
                            "type": "geofence_event",
                            "event": "arrived_at_destination",
                            "trip_id": trip_str,
                            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
                            "shipment_id": str(trip.shipment_id) if trip.shipment_id else None,
                            "message": f"Vehicle arrived at destination ({trip.destination}). Trip completed!"
                        })
                    else:
                        lat, lng = path[current_idx]
                        speed = round(52.0 + random.uniform(-6, 10), 1)
                        
                        # Calculate live ETA and progress
                        total_dist = float(trip.distance or 300.0)
                        eta_info = calculate_live_progress_and_eta((lat, lng), end_coords, total_dist, speed)
                        
                        # Save tracking ping to DB
                        ping = GPSTracking(
                            tracking_id=uuid.uuid4(),
                            vehicle_id=trip.vehicle_id,
                            latitude=lat,
                            longitude=lng,
                            speed=speed,
                            recorded_time=datetime.datetime.now(datetime.timezone.utc)
                        )
                        db.add(ping)
                        db.commit()
                        
                        reg = "TRK-2026"
                        if trip.vehicle_id:
                            v = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
                            if v:
                                reg = v.registration_number
                        
                        # Broadcast live coordinates + ETA + remaining distance
                        await manager.broadcast({
                            "type": "gps_update",
                            "trip_id": trip_str,
                            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
                            "shipment_id": str(trip.shipment_id) if trip.shipment_id else None,
                            "vehicle_reg": reg,
                            "latitude": lat,
                            "longitude": lng,
                            "speed": speed,
                            "progress": round((current_idx / (len(path) - 1)) * 100, 1),
                            "remaining_distance_km": eta_info["remaining_distance_km"],
                            "eta": eta_info["eta"]
                        })
                        
                        SIMULATION_STATES[trip_str] = current_idx + 1
            except Exception as inner_err:
                print(f"Error in GPS simulation step: {inner_err}")
                db.rollback()
            finally:
                db.close()
        except Exception as loop_err:
            print(f"GPS simulation loop error: {loop_err}")


@router.post("/ping", status_code=status.HTTP_201_CREATED)
def submit_gps_ping(data: dict, db: Session = Depends(get_db)):
    """API endpoint for receiving location pings directly from hardware telematics or mobile apps."""
    try:
        vehicle_uuid = uuid.UUID(data.get("vehicle_id"))
        lat = float(data.get("latitude"))
        lng = float(data.get("longitude"))
        speed = float(data.get("speed", 0.0))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid vehicle_id, latitude, or longitude values.")

    ping = GPSTracking(
        tracking_id=uuid.uuid4(),
        vehicle_id=vehicle_uuid,
        latitude=lat,
        longitude=lng,
        speed=speed,
        recorded_time=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(ping)
    db.commit()
    return {"message": "GPS ping recorded successfully"}


@router.get("/latest/{vehicle_id}")
def get_latest_location(vehicle_id: str, db: Session = Depends(get_db)):
    """Fetch latest recorded location ping for a given vehicle."""
    try:
        v_uuid = uuid.UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle_id format")

    ping = db.query(GPSTracking).filter(GPSTracking.vehicle_id == v_uuid).order_by(GPSTracking.recorded_time.desc()).first()
    if not ping:
        return {"vehicle_id": vehicle_id, "location": None}
    
    return {
        "vehicle_id": str(ping.vehicle_id),
        "latitude": ping.latitude,
        "longitude": ping.longitude,
        "speed": ping.speed,
        "recorded_time": ping.recorded_time
    }


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            else:
                await websocket.send_json({"echo": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
